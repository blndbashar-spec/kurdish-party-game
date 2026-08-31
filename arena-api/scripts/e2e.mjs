// ═══════════════════════════════════════════════════════════════
//  E2E تاقیکردنەوە — هەموو Stack: Postgres + Redis + API + Socket.io
//  بەکارهێنان: node scripts/e2e.mjs
// ═══════════════════════════════════════════════════════════════
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';
import { io } from 'socket.io-client';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4100;
const BASE = `http://127.0.0.1:${PORT}`;
const PG_PORT = 5433;
const REDIS_PORT = 6390;
const ENV = {
  ...process.env,
  NODE_ENV: 'development',
  PORT: String(PORT),
  DATABASE_URL: `postgresql://arena:arena_secret_2026@127.0.0.1:${PG_PORT}/arena_db`,
  REDIS_URL: `redis://127.0.0.1:${REDIS_PORT}`,
  JWT_SECRET: 'e2e_test_secret_at_least_16_chars',
  JWT_EXPIRES_IN: '15m',
  REFRESH_EXPIRES_DAYS: '30',
  CORS_ORIGINS: 'http://localhost:5173',
  TRUST_PROXY: 'false',
  AUTH_RATE_LIMIT: '50',
};

let checks = 0;
const ok = (msg) => {
  checks++;
  console.log(`  ✔ ${msg}`);
};

function run(script, env = ENV, stdio = 'inherit') {
  return new Promise((resolve, reject) => {
    const p = spawn('npx', ['tsx', script], { cwd: ROOT, env, stdio });
    let out = '';
    p.stdout?.on('data', (d) => (out += d));
    p.stderr?.on('data', (d) => (out += d));
    p.on('close', (code) =>
      code === 0 ? resolve(out) : reject(new Error(`${script} → ${code}\n${out}`)),
    );
  });
}

const j = async (method, p, { token, body, cookie } = {}) => {
  const res = await fetch(BASE + p, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(cookie ? { cookie } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  const setCookie = res.headers.get('set-cookie') ?? '';
  return { status: res.status, data, setCookie };
};

const waitFor = (ms) => new Promise((r) => setTimeout(r, ms));

const socketOnce = (sock, event, timeoutMs = 10000) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`چاوەڕوانی ${event} بەتا بوو`)), timeoutMs);
    sock.once(event, (data) => {
      clearTimeout(t);
      resolve(data);
    });
  });

// کۆنێکت با retry — ئەگەر هەڵەیەکی وشکاڵ (transient) ڕوویدا، دووبارە هەوڵ دەدات
const connectGameSocket = async (token, attempts = 5) => {
  for (let i = 0; i < attempts; i++) {
    const s = io(`${BASE}/game`, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
    });
    let engineOpen = false;
    s.io.engine.on('open', () => (engineOpen = true));
    const result = await new Promise((resolve) => {
      const t = setTimeout(() => resolve(`timeout(engineOpen=${engineOpen})`), 6000);
      s.once('connect', () => {
        clearTimeout(t);
        resolve('ok');
      });
      s.once('connect_error', (e) => {
        clearTimeout(t);
        resolve(`err:${e?.message}`);
      });
    });
    if (result === 'ok') return s;
    console.error(`  [connect attempt ${i + 1} failed: ${result}]`);
    s.close();
    await waitFor(300);
  }
  throw new Error('کۆنێکت-کردن لە هەموو هەوڵەکاندا شکستی هێنا');
};

// پێش تاقیکردنەوە: دڵنیابوونەوەی ئەوەی پۆرتەکان ئازادن (server-ێکی ماوە)
async function preflight() {
  const out = await new Promise((res) => {
    const p = spawn('sh', ['-c', `ss -tln 2>/dev/null | grep -E ":${PORT}\\b|:${PG_PORT}\\b|:${REDIS_PORT}\\b" || true`]);
    let s = '';
    p.stdout.on('data', (d) => (s += d));
    p.on('close', () => res(s));
  });
  if (out.trim()) {
    console.log(`⚠️  پۆرتێک وەستاوە — پاک دەکرێتەوە:\n${out.trim()}`);
    spawn('sh', ['-c', 'pkill -f "tsx src/index.ts" 2>/dev/null; pkill -f "redis-stub.mjs" 2>/dev/null; true']);
    await waitFor(2000);
  }
}

async function main() {
  await preflight();
  console.log('\n🐘 Postgres دەستپێدەکات...');
  const pgdata = fs.mkdtempSync(path.join(os.tmpdir(), 'arena-pg-'));
  const pg = new EmbeddedPostgres({
    databaseDir: pgdata,
    user: 'arena',
    password: 'arena_secret_2026',
    port: PG_PORT,
    persistent: false,
  });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('arena_db');
  ok(`Postgres ئامادەیە (port ${PG_PORT})`);

  console.log('🔴 Redis stub دەستپێدەکات...');
  const redisStub = spawn('node', ['scripts/redis-stub.mjs'], {
    cwd: ROOT,
    env: { ...process.env, STUB_PORT: String(REDIS_PORT) },
  });
  redisStub.stdout?.on('data', () => {});
  redisStub.stderr?.on('data', (d) => console.error('[redis-stub]', d.toString()));
  await waitFor(700);
  ok('Redis stub ئامادەیە');

  console.log('🗄  Migration جێبەجێ دەکرێت...');
  await run('src/db/migrate.ts');
  ok('Migration تەواو بوو');

  console.log('🌱 Seed جێبەجێ دەکرێت...');
  const seedOut = await run('src/seed/seed.ts');
  ok(seedOut.trim().split('\n').pop() ?? 'Seed تەواو بوو');

  console.log('🚀 Server دەستپێدەکات...');
  const server = spawn('npx', ['tsx', 'src/index.ts'], {
    cwd: ROOT,
    env: ENV,
    stdio: 'pipe',
    detached: true, // process group — بۆ دابەزینی پاک
  });
  server.stdout?.on('data', (d) => process.stdout.write(`  [api] ${d}`));
  server.stderr?.on('data', (d) => process.stderr.write(`  [api!] ${d}`));

  // چاوەڕوانی /health
  let health = null;
  for (let i = 0; i < 40; i++) {
    await waitFor(500);
    try {
      const r = await fetch(`${BASE}/health`);
      if (r.ok) {
        health = await r.json();
        break;
      }
    } catch {
      /* دووبارە هەوڵبدەرەوە */
    }
  }
  assert.ok(health?.ok, 'server دەبێت ئامادە بێت');
  ok('Server ئامادەیە (/health)');

  try {
    // ── ١. Auth ─────────────────────────────────────────────────
    console.log('\n── Auth ──');
    const alice = await j('POST', '/api/auth/register', {
      body: { username: 'alice', email: 'alice@example.com', password: 'pass123' },
    });
    assert.equal(alice.status, 201);
    assert.ok(alice.data.accessToken);
    assert.ok(alice.setCookie.includes('refresh_token'));
    ok('register (alice) + refresh cookie');
    const aliceToken = alice.data.accessToken;
    const aliceCookie = alice.setCookie.split(';')[0];

    const bob = await j('POST', '/api/auth/register', {
      body: { username: 'bob', password: 'pass123' },
    });
    assert.equal(bob.status, 201);
    ok('register (bob)');
    const bobToken = bob.data.accessToken;

    const bad = await j('POST', '/api/auth/register', {
      body: { username: 'alice', password: 'pass123' },
    });
    assert.equal(bad.status, 409);
    ok('دووبارە username → 409');

    const weak = await j('POST', '/api/auth/register', {
      body: { username: 'x1', password: '123' },
    });
    assert.equal(weak.status, 422);
    ok('وشەی نهێنی لاواز → 422 (Zod)');

    const admin = await j('POST', '/api/auth/login', {
      body: { username: 'admin', password: 'admin1234' },
    });
    assert.equal(admin.status, 200);
    const adminToken = admin.data.accessToken;
    ok('login (admin لە seed)');

    const me = await j('GET', '/api/auth/me', { token: aliceToken });
    assert.equal(me.status, 200);
    assert.equal(me.data.user.username, 'alice');
    ok('GET /me');

    const noTok = await j('POST', '/api/rooms', { body: {} });
    assert.equal(noTok.status, 401);
    ok('بەبێ توکن → 401');

    const wrong = await j('POST', '/api/auth/login', {
      body: { username: 'admin', password: 'wrong' },
    });
    assert.equal(wrong.status, 401);
    ok('وشەی نهێنی هەڵە → 401');

    // refresh rotation
    const r1 = await j('POST', '/api/auth/refresh', { cookie: aliceCookie });
    assert.equal(r1.status, 200);
    const aliceCookie2 = r1.setCookie.split(';')[0];
    const r2 = await j('POST', '/api/auth/refresh', { cookie: aliceCookie });
    assert.equal(r2.status, 401);
    ok('refresh rotation — توکنی کۆن ڕەتدەکرێتەوە');

    // ── ٢. Games / Questions / Categories ───────────────────────
    console.log('\n── Games & Questions ──');
    const games = await j('GET', '/api/games');
    assert.equal(games.status, 200);
    assert.equal(games.data.length, 18);
    const quiz = games.data.find((g) => g.slug === 'quiz');
    ok(`١٨ یاری (quiz, spy, bomb, ...) — ${games.data.length}`);

    const game404 = await j('GET', '/api/games/nope');
    assert.equal(game404.status, 404);
    ok('یاری نەناسراو → 404');

    const qs = await j('GET', `/api/questions?gameId=${quiz.id}&limit=50`);
    assert.equal(qs.status, 200);
    assert.ok(qs.data.length >= 8);
    ok(`${qs.data.length} پرسیار بۆ quiz`);

    const cats = await j('GET', '/api/categories');
    assert.equal(cats.status, 200);
    assert.ok(cats.data.length >= 6);
    ok(`${cats.data.length} پۆل`);

    const notAdmin = await j('POST', '/api/games', {
      token: aliceToken,
      body: { slug: 'hack', nameKu: 'هەڵە' },
    });
    assert.equal(notAdmin.status, 403);
    ok('دروستکردنی یاری بە player → 403');

    const newGame = await j('POST', '/api/games', {
      token: adminToken,
      body: { slug: 'e2e-game', nameKu: 'یاری تاقیکردنەوە', config: { timeLimit: 5 } },
    });
    assert.equal(newGame.status, 201);
    ok('دروستکردنی یاری بە admin');

    const delGame = await j('DELETE', `/api/games/e2e-game`, { token: adminToken });
    assert.equal(delGame.status, 200);
    ok('سڕینەوەی یاری');

    // ── ٣. Rooms (REST) ─────────────────────────────────────────
    console.log('\n── Rooms (REST) ──');
    const room = await j('POST', '/api/rooms', {
      token: aliceToken,
      body: { gameId: quiz.id, maxPlayers: 4, config: { timeLimit: 3, rounds: 1 } },
    });
    assert.equal(room.status, 201);
    const code = room.data.code;
    assert.equal(code.length, 6);
    assert.ok(/[A-Z2-9]{6}/.test(code));
    assert.equal(room.data.players.length, 1);
    assert.ok(room.data.players[0].isHost);
    ok(`دروستکردنی ژوور — کۆد: ${code}`);

    const roomPub = await j('GET', `/api/rooms/${code}`);
    assert.equal(roomPub.status, 200);
    assert.equal(roomPub.data.game.slug, 'quiz');
    ok('GET ژوور (ڕەسەن)');

    const join = await j('POST', `/api/rooms/${code}/join`, { token: bobToken });
    assert.equal(join.status, 200);
    assert.equal(join.data.players.length, 2);
    ok('bob داخڵ بوو — ٢ ئەندام');

    const rejoin = await j('POST', `/api/rooms/${code}/join`, { token: bobToken });
    assert.equal(rejoin.status, 200);
    assert.equal(rejoin.data.players.length, 2);
    ok('دووبارە داخڵبوون → هەر ٢ ئەندام (idempotent)');

    const room404 = await j('GET', '/api/rooms/ZZZZZZ');
    assert.equal(room404.status, 404);
    ok('ژووری نەناسراو → 404');

    const ready = await j('POST', `/api/rooms/${code}/ready`, {
      token: bobToken,
      body: { ready: true },
    });
    assert.equal(ready.status, 200);
    assert.ok(ready.data.players.find((p) => p.username === 'bob').isReady);
    ok('ready (bob)');

    // ── ٤. Socket.io ────────────────────────────────────────────
    // (پێکەنینەوەی برۆوزەری ڕاستەقینە: سەرەتا سۆکێتە ڕەسەنەکان)
    console.log('\n── Socket.io (/game) ──');
    const aliceSock = await connectGameSocket(aliceToken);
    const bobSock = await connectGameSocket(bobToken);
    ok('دوو socket یەکتەوە');

    // توکنی هەڵە → reject (ئەمە manager ی خۆیەتی — کاریگەری لە ڕەسەنەکان ناکات)
    const badSock = io(`${BASE}/game`, {
      auth: { token: 'fake' },
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
    });
    const sockErr = await socketOnce(badSock, 'connect_error', 5000).catch((e) => e);
    assert.ok(sockErr?.message?.includes('token'));
    ok('socket بە توکنی هەڵە → reject');
    badSock.close();

    const roomUpdates = [];
    aliceSock.on('room:updated', (r) => roomUpdates.push(r));
    const ackJoin = await new Promise((res) =>
      aliceSock.emit('room:join', { roomCode: code }, res),
    );
    assert.ok(ackJoin.ok);
    const ackJoinBob = await new Promise((res) =>
      bobSock.emit('room:join', { roomCode: code }, res),
    );
    assert.ok(ackJoinBob.ok);
    await waitFor(300);
    ok('room:join (هەردووکیان) + room:updated');

    // بێ ئەندامی داخڵبوون
    const carol = await j('POST', '/api/auth/register', {
      body: { username: 'carol', password: 'pass123' },
    });
    const carolSock = await connectGameSocket(carol.data.accessToken);
    const ackNo = await new Promise((res) =>
      carolSock.emit('room:join', { roomCode: code }, res),
    );
    assert.ok(!ackNo.ok);
    ok('ئەندام نەبوو → reject');
    carolSock.close();

    // ── . یاری — دەستپێکردن، وەڵام، خاڵ، تەواوبوون ────────────
    console.log('\n── Game flow ──');

    // turn-queue — هەموو game:turn-ەکان لە سەرەتا کۆدەکەینەوە
    // (ئەگەر پێش چاوەڕوانبوون firing بکەن، لە queue-دا دەمێننەوە)
    const turnQueue = [];
    const turnWaiters = [];
    const nextTurn = () =>
      turnQueue.length
        ? Promise.resolve(turnQueue.shift())
        : new Promise((r) => turnWaiters.push(r));
    // تەنها یەک socket فیدەر دەبێت — هەردووکیان هەمان broadcast وەردەگرن
    aliceSock.on('game:turn', (t) => {
      const w = turnWaiters.shift();
      if (w) w(t);
      else turnQueue.push(t);
    });

    const startedP = new Promise((res) => aliceSock.once('game:started', res));
    const ackStart = await new Promise((res) =>
      aliceSock.emit('game:start', { roomCode: code }, res),
    );
    assert.ok(ackStart.ok, ackStart.error);
    const started = await startedP;
    assert.equal(started.slug, 'quiz');
    assert.equal(started.players.length, 2);
    ok(`game:started — ${started.slug}، تایمەر ${started.timeLimit}چ`);

    // نۆرەی یەکەم — وەڵامی دروست (بە یاریزانەکەی خۆی)
    const t1 = await nextTurn();
    assert.ok(t1.question?.options?.length, 'پرسیارەکە دەبێت options بێت');
    const revealP = new Promise((res) => aliceSock.once('game:reveal', res));
    // players[0] = alice (seat 0) — وەڵامەکە بە یاریزانەکەی نۆرەکە بنێرین
    const t1Socket = t1.playerId === started.players[0].id ? aliceSock : bobSock;
    const ackAnswer = await new Promise((res) =>
      t1Socket.emit(
        'game:answer',
        { roomCode: code, answerIndex: t1.question.correctIndex },
        res,
      ),
    );
    assert.ok(ackAnswer.ok, ackAnswer.error);
    assert.equal(ackAnswer.isCorrect, true);
    assert.equal(ackAnswer.points, 10);
    const reveal = await revealP;
    assert.equal(reveal.isCorrect, true);
    ok(`نۆرەی ١ — وەڵامی دروست بە ${t1.username} (+${ackAnswer.points})`);

    // نۆرەی دووەم — وەڵامی هەڵە
    const t2 = await nextTurn();
    assert.notEqual(t2.playerId, t1.playerId);
    const wrongIdx = (t2.question.correctIndex + 1) % t2.question.options.length;
    const ackWrong = await new Promise((res) =>
      bobSock.emit('game:answer', { roomCode: code, answerIndex: wrongIdx }, res),
    );
    assert.equal(ackWrong.isCorrect, false, ackWrong.error);
    assert.equal(ackWrong.points, 0);
    ok('نۆرەی ٢ — وەڵامی هەڵە (0 خاڵ)');

    // یاریزانەکەی نۆرەکە ناتوانێت وەڵامی تر بدات
    const ackNotTurn = await new Promise((res) =>
      aliceSock.emit('game:answer', { roomCode: code, answerIndex: 0 }, res),
    );
    assert.ok(!ackNotTurn.ok);
    ok('وەڵام بەدوای نۆرەکەدا → reject');

    const finished = await socketOnce(aliceSock, 'game:finished', 15000);
    const alicePts = finished.finalScores.find((s) => s.username === 'alice').points;
    assert.equal(alicePts, 10);
    assert.ok(finished.winner?.username === 'alice');
    ok(`game:finished — وینەڕ: ${finished.winner.username} (${alicePts} خاڵ)`);

    // ── ٦. دوای تەواوبوون ───────────────────────────────────────
    console.log('\n── After game ──');
    const finalRoom = await j('GET', `/api/rooms/${code}`);
    assert.equal(finalRoom.data.status, 'finished');
    ok('ژوورەکە تەواو بوو');

    const lb = await j('GET', '/api/games/leaderboard');
    assert.equal(lb.status, 200);
    assert.ok(lb.data.find((x) => x.username === 'alice'));
    ok(`leaderboard — ${lb.data.length} یاریزان`);

    const logout = await j('POST', '/api/auth/logout', {
      cookie: aliceCookie2,
    });
    assert.equal(logout.status, 200);
    const refreshAfterLogout = await j('POST', '/api/auth/refresh', {
      cookie: aliceCookie2,
    });
    assert.equal(refreshAfterLogout.status, 401);
    ok('logout — refresh token مرد');

    aliceSock.close();
    bobSock.close();

    console.log(`\n🏆 ${checks} تاقیکردنەوە سەرکەوتوو بوون — هەموو Stackەکە کاردەکات!`);
  } finally {
    // داڕوئانی process group-ی تەواو (npx + tsx + node)
    try {
      process.kill(-server.pid, 'SIGTERM');
    } catch {
      server.kill('SIGTERM');
    }
    redisStub.kill('SIGTERM');
    try {
      await pg.stop();
    } catch {
      /* ignore */
    }
    fs.rmSync(pgdata, { recursive: true, force: true });
    await waitFor(2000);
    // ئەگەر هێشتا بەرزبووەوە — بە زۆرڕاستی
    try {
      const still = spawnSync('sh', ['-c', `ss -tln 2>/dev/null | grep -c ":${PORT}\\b"`]);
      if (Number(still.stdout?.toString().trim() || 0) > 0) {
        process.kill(-server.pid, 'SIGKILL');
      }
    } catch {
      /* ignore */
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('\n❌ E2E شکستی هێنا:', e);
    process.exit(1);
  });
