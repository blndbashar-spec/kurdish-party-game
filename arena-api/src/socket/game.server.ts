import { Namespace } from 'socket.io';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../config/db';
import {
  games as gamesTable,
  gameSessions,
  questions,
  rooms,
  roomPlayers,
  scores,
} from '../models/schema';
import {
  describeRoom,
  getRoomByCode,
  listMembers,
  markPlaying,
  redisScore,
} from '../services/room.service';
import { verifyAccessToken } from '../utils/jwt';
import { shuffle } from '../utils/shuffle';

// ═══════════════════════════════════════════════════════════════
//  Namespace-ی /game — سیستەمی ژووری یارییە ڕەقەبەرەکان
//
//  ڕووداوەکان (کڕانت → سێرڤەر):
//    room:join    { roomCode }                 → داخڵبوونی ژوور
//    room:leave   { roomCode }                 → چوونەدەرەوە
//    room:ready   { roomCode, ready }          → ئامادەیی
//    game:start   { roomCode }                 → دەستپێکردن (خاوەن ژوور)
//    game:answer  { roomCode, answerIndex }    → وەڵام
//    game:skip    { roomCode }                 → پاڵاوی نۆرەکە
//    room:close   { roomCode }                 → داخستن (خاوەن ژوور)
//
//  ڕووداوەکان (سێرڤەر → کڕانت):
//    room:updated, room:closed, player:left
//    game:started, game:turn, game:turn:end, game:reveal,
//    game:result, game:skipped, game:finished
// ═══════════════════════════════════════════════════════════════

export interface GamePlayer {
  id: string;
  username: string;
}

export interface GameQuestion {
  id: string;
  content: string;
  options: string[] | null;
  correctIndex: number | null;
}

export interface ActiveGame {
  roomCode: string;
  roomId: string;
  gameId: string | null;
  slug: string;
  timeLimit: number; // چرکە بۆ هەر نۆرەیەک
  rounds: number; // ژمارەی خول بۆ هەر یاریزانێک
  pointsPerCorrect: number;
  players: GamePlayer[];
  questions: GameQuestion[];
  turnIndex: number;
  scores: Record<string, number>;
  timer: NodeJS.Timeout | null;
  finished: boolean;
}

// دۆخی یارییە چالاکەکان — هەر ژوورێک یەک ActiveGame
const activeGames = new Map<string, ActiveGame>();

const errMessage = (e: unknown) => (e instanceof Error ? e.message : 'هەڵەیەکی نەناسراو');

type Ack = (r: { ok: boolean; error?: string; [k: string]: unknown }) => void;

// ── پاککردنەوەی ژوور (داخستن / بەتاوبوون) ──────────────────────
export function teardownGame(nsp: Namespace, code: string) {
  const g = activeGames.get(code);
  if (g && !g.finished) {
    g.finished = true;
    if (g.timer) clearTimeout(g.timer);
    activeGames.delete(code);
    nsp.to(code).emit('room:closed', { reason: 'closed' });
  } else {
    activeGames.delete(code);
  }
  redisScore.del(code).catch(() => {});
}

// ── بارکردنی ناوەڕۆکی یاری (پرسیار / وشە / شوێن) ──────────────
async function buildActiveGame(
  code: string,
  roomId: string,
  gameId: string | null,
): Promise<ActiveGame> {
  const members = await listMembers(roomId);
  const [game] = gameId
    ? await db.select().from(gamesTable).where(eq(gamesTable.id, gameId)).limit(1)
    : [undefined as (typeof gamesTable.$inferSelect) | undefined];
  const [room] = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);

  // config ی یاری + config ی ژوور (ژوور دەتوانێت بگۆڕێت)
  const config: Record<string, unknown> = {
    ...(((game?.config as Record<string, unknown>) ?? {}) as Record<string, unknown>),
    ...(((room?.config as Record<string, unknown>) ?? {}) as Record<string, unknown>),
  };

  // پرسیارەکان لە بنکەی داتا
  const rows = gameId
    ? await db.select().from(questions).where(eq(questions.gameId, gameId)).limit(20)
    : [];
  const qs: GameQuestion[] = shuffle(rows).map((q) => ({
    id: q.id,
    content: q.content,
    options: (q.options as string[] | null) ?? null,
    correctIndex: q.correctIndex,
  }));

  // ئەگەر بنکە بەتا بوو — items لە config (بۆ spy, charades, truth & dare)
  const cfgItems = config.items;
  if (qs.length === 0 && Array.isArray(cfgItems)) {
    for (const item of shuffle(cfgItems as string[])) {
      qs.push({ id: 'cfg', content: item, options: null, correctIndex: null });
    }
  }

  return {
    roomCode: code,
    roomId,
    gameId,
    slug: game?.slug ?? 'custom',
    timeLimit: Number(config.timeLimit ?? 15),
    rounds: Number(config.rounds ?? 3),
    pointsPerCorrect: Number(config.pointsPerCorrect ?? 10),
    players: members
      .filter((m) => m.username)
      .map((m) => ({ id: m.userId, username: m.username as string })),
    questions: qs,
    turnIndex: 0,
    scores: {},
    timer: null,
    finished: false,
  };
}

const currentQuestion = (g: ActiveGame): GameQuestion | null =>
  g.questions.length ? g.questions[g.turnIndex % g.questions.length] : null;

// ── نۆرەی داهاتوو + تایمەر ─────────────────────────────────────
function startTurn(nsp: Namespace, g: ActiveGame) {
  if (g.finished) return;
  if (g.timer) clearTimeout(g.timer);

  const totalTurns = g.players.length * g.rounds;
  if (g.players.length === 0 || g.turnIndex >= totalTurns) {
    void finishGame(nsp, g);
    return;
  }

  const current = g.players[g.turnIndex % g.players.length];
  nsp.to(g.roomCode).emit('game:turn', {
    playerId: current.id,
    username: current.username,
    turnIndex: g.turnIndex,
    totalTurns,
    timeLimit: g.timeLimit,
    question: currentQuestion(g),
  });

  // کاتژمێر کۆتایی — ئەگەر وەڵام نەدات، نۆرەکە خۆکارانە دەپەڕێت
  g.timer = setTimeout(() => {
    nsp.to(g.roomCode).emit('game:turn:end', {
      playerId: current.id,
      turnIndex: g.turnIndex,
    });
    g.turnIndex += 1;
    startTurn(nsp, g);
  }, g.timeLimit * 1000);
}

// ── تەواوبوونی یاری ───────────────────────────────────────────
async function finishGame(nsp: Namespace, g: ActiveGame) {
  if (g.finished) return;
  g.finished = true;
  if (g.timer) clearTimeout(g.timer);
  activeGames.delete(g.roomCode);

  const finalScores = g.players
    .map((p) => ({ userId: p.id, username: p.username, points: g.scores[p.id] ?? 0 }))
    .sort((a, b) => b.points - a.points);
  const winner = finalScores.length && finalScores[0].points > 0 ? finalScores[0] : null;

  try {
    await db.update(rooms).set({ status: 'finished' }).where(eq(rooms.id, g.roomId));

    const sessions = await db
      .select()
      .from(gameSessions)
      .where(eq(gameSessions.roomId, g.roomId))
      .orderBy(desc(gameSessions.startedAt))
      .limit(1);
    if (sessions[0]) {
      await db
        .update(gameSessions)
        .set({
          endedAt: new Date(),
          winnerId: winner?.userId ?? null,
          finalState: { scores: finalScores, turns: g.turnIndex, slug: g.slug },
        })
        .where(eq(gameSessions.id, sessions[0].id));
    }
  } catch (e) {
    console.error('finishGame — هەڵەیەکی بنکەی داتا:', e);
  }

  redisScore.del(g.roomCode).catch(() => {});
  nsp.to(g.roomCode).emit('game:finished', { finalScores, winner, slug: g.slug });
}

// ═══════════════════════════════════════════════════════════════
//  تۆمارکردنی namespace
// ═══════════════════════════════════════════════════════════════
export function registerGameNamespace(nsp: Namespace) {
  // ── چەکی توکن لە handshake ────────────────────────────────────
  nsp.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error('token نییە'));
    try {
      const p = verifyAccessToken(token);
      socket.data.user = { id: p.sub, username: p.username, role: p.role };
      next();
    } catch {
      next(new Error('token نامۆ یان بێهەتا'));
    }
  });

  nsp.on('connection', (socket) => {
    const userId = socket.data.user.id as string;
    const username = socket.data.user.username as string;
    console.log(`[nsp] یەکتەوە: ${username} (${socket.id})`);

    // ── داخڵبوونی ژوور ─────────────────────────────────────────
    socket.on(
      'room:join',
      async ({ roomCode }: { roomCode: string }, ack?: Ack) => {
        try {
          const code = String(roomCode).toUpperCase();
          const room = await getRoomByCode(code);
          if (!room) return ack?.({ ok: false, error: 'ژوور نەدۆزرایەوە' });

          const [membership] = await db
            .select()
            .from(roomPlayers)
            .where(and(eq(roomPlayers.roomId, room.id), eq(roomPlayers.userId, userId)))
            .limit(1);
          if (!membership) return ack?.({ ok: false, error: 'لەم ژوورەوە ئەندام نیت' });

          socket.data.roomCode = code;
          await socket.join(code);
          const payload = await describeRoom(code);
          nsp.to(code).emit('room:updated', payload);
          ack?.({ ok: true, room: payload });
        } catch (e) {
          ack?.({ ok: false, error: errMessage(e) });
        }
      },
    );

    // ── چوونەدەرەوە ─────────────────────────────────────────────
    socket.on(
      'room:leave',
      async ({ roomCode }: { roomCode: string }, ack?: Ack) => {
        try {
          const code = String(roomCode).toUpperCase();
          socket.data.roomCode = undefined;
          await socket.leave(code);
          nsp.to(code).emit('room:updated', await describeRoom(code));
          ack?.({ ok: true });
        } catch (e) {
          ack?.({ ok: false, error: errMessage(e) });
        }
      },
    );

    // ── ئامادەیی ────────────────────────────────────────────────
    socket.on(
      'room:ready',
      async ({ roomCode, ready }: { roomCode: string; ready: boolean }, ack?: Ack) => {
        try {
          const code = String(roomCode).toUpperCase();
          const room = await getRoomByCode(code);
          if (!room) return ack?.({ ok: false, error: 'ژوور نەدۆزرایەوە' });
          await db
            .update(roomPlayers)
            .set({ isReady: Boolean(ready) })
            .where(
              and(eq(roomPlayers.roomId, room.id), eq(roomPlayers.userId, userId)),
            );
          nsp.to(code).emit('room:updated', await describeRoom(code));
          ack?.({ ok: true });
        } catch (e) {
          ack?.({ ok: false, error: errMessage(e) });
        }
      },
    );

    // ── دەستپێکردنی یاری (خاوەن ژوور) ──────────────────────────
    socket.on('game:start', async ({ roomCode }: { roomCode: string }, ack?: Ack) => {
      try {
        const code = String(roomCode).toUpperCase();
        const { room } = await markPlaying(code, userId);
        const g = await buildActiveGame(code, room.id, room.gameId);
        activeGames.set(code, g);
        redisScore.del(code).catch(() => {});

        nsp.to(code).emit('game:started', {
          slug: g.slug,
          gameId: g.gameId,
          timeLimit: g.timeLimit,
          rounds: g.rounds,
          players: g.players,
        });
        startTurn(nsp, g);
        ack?.({ ok: true });
      } catch (e) {
        ack?.({ ok: false, error: errMessage(e) });
      }
    });

    // ── وەڵام (بۆ نۆرەی ئێستا) ─────────────────────────────────
    socket.on(
      'game:answer',
      async (
        { roomCode, answerIndex }: { roomCode: string; answerIndex: number },
        ack?: Ack,
      ) => {
        try {
          const code = String(roomCode).toUpperCase();
          const g = activeGames.get(code);
          if (!g || g.finished) return ack?.({ ok: false, error: 'یارییەکی چالاک نییە' });

          // ئەگەر هەموو نۆرەکان تەواو بوون (بەڵام delay-ی تەواوبوون ماوە)
          if (g.turnIndex >= g.players.length * g.rounds) {
            return ack?.({ ok: false, error: 'یاری تەواو بووە' });
          }

          const current = g.players[g.turnIndex % g.players.length];
          if (!current || current.id !== userId) {
            return ack?.({ ok: false, error: 'نۆرت نەیە — چاوەڕێ بکە' });
          }
          if (g.timer) clearTimeout(g.timer);

          const q = currentQuestion(g);
          const idx = Number(answerIndex);
          // وەڵامەکە بە بنکەی داتای سێرڤەر پشکنێت — کڕانت ناتوانێت ڕاستی داهێنێت
          const isCorrect = Boolean(q && q.correctIndex !== null && idx === q.correctIndex);
          let points = 0;

          if (isCorrect) {
            points = g.pointsPerCorrect;
            g.scores[current.id] = (g.scores[current.id] ?? 0) + points;

            // ١) Redis ٢) بنکەی داتا (score ی ژوور + خاڵی گشتی)
            await redisScore.incr(code, current.id, points);
            await db
              .update(roomPlayers)
              .set({ score: g.scores[current.id] })
              .where(
                and(eq(roomPlayers.roomId, g.roomId), eq(roomPlayers.userId, current.id)),
              );
            await db.insert(scores).values({
              userId: current.id,
              gameId: g.gameId,
              points,
            });
            // ژمارەبەکارهێنانی پرسیارەکە بۆ ڕیپلەی
            if (q && q.id !== 'cfg') {
              await db
                .update(questions)
                .set({ usageCount: sql`${questions.usageCount} + 1` })
                .where(eq(questions.id, q.id));
            }
          }

          nsp.to(code).emit('game:reveal', {
            question: q,
            isCorrect,
            points,
            answeredBy: current.id,
            answeredByUsername: current.username,
          });
          nsp.to(code).emit('game:result', {
            isCorrect,
            points,
            scores: { ...g.scores },
          });

          g.turnIndex += 1;
          setTimeout(() => startTurn(nsp, g), 1500);
          ack?.({ ok: true, isCorrect, points, scores: { ...g.scores } });
        } catch (e) {
          ack?.({ ok: false, error: errMessage(e) });
        }
      },
    );

    // ── پاڵاوی نۆرەکە ──────────────────────────────────────────
    socket.on('game:skip', ({ roomCode }: { roomCode: string }, ack?: Ack) => {
      try {
        const code = String(roomCode).toUpperCase();
        const g = activeGames.get(code);
        if (!g || g.finished) return ack?.({ ok: false, error: 'یارییەکی چالاک نییە' });
        if (g.turnIndex >= g.players.length * g.rounds) {
          return ack?.({ ok: false, error: 'یاری تەواو بووە' });
        }
        const current = g.players[g.turnIndex % g.players.length];
        if (!current || current.id !== userId) {
          return ack?.({ ok: false, error: 'نۆرت نەیە' });
        }
        if (g.timer) clearTimeout(g.timer);
        nsp.to(code).emit('game:skipped', { playerId: current.id, username: current.username });
        g.turnIndex += 1;
        setTimeout(() => startTurn(nsp, g), 800);
        ack?.({ ok: true });
      } catch (e) {
        ack?.({ ok: false, error: errMessage(e) });
      }
    });

    // ── داخستنی ژوور (خاوەنەکە) ────────────────────────────────
    socket.on('room:close', async ({ roomCode }: { roomCode: string }, ack?: Ack) => {
      try {
        const code = String(roomCode).toUpperCase();
        const room = await getRoomByCode(code);
        if (!room) return ack?.({ ok: false, error: 'ژوور نەدۆزرایەوە' });
        if (room.hostId !== userId) return ack?.({ ok: false, error: 'تەنها خاوەن ژوور' });

        teardownGame(nsp, code);
        await db.update(rooms).set({ status: 'finished' }).where(eq(rooms.id, room.id));
        nsp.to(code).emit('room:updated', await describeRoom(code));
        ack?.({ ok: true });
      } catch (e) {
        ack?.({ ok: false, error: errMessage(e) });
      }
    });

    // ── دابەزینی بەستەر (disconnect) — بە وردی لێ دەچینەوە ─────
    socket.on('disconnect', async () => {
      const code = socket.data.roomCode as string | undefined;
      if (!code) return;

      const g = activeGames.get(code);
      if (g && !g.finished) {
        const current = g.players[g.turnIndex % g.players.length];
        nsp.to(code).emit('player:left', { userId, username });
        // ئەگەر کەسی دابەزی نۆری هەبوو — نۆرەکە دەپەڕێت
        if (current && current.id === userId) {
          if (g.timer) clearTimeout(g.timer);
          g.turnIndex += 1;
          startTurn(nsp, g);
        }
      }

      try {
        const socketsInRoom = await nsp.in(code).fetchSockets();
        if (socketsInRoom.length === 0) {
          // ژوورەکە بەتا بوو
          teardownGame(nsp, code);
          const room = await getRoomByCode(code);
          if (room && room.status === 'playing') {
            await db.update(rooms).set({ status: 'finished' }).where(eq(rooms.id, room.id));
          }
        }
      } catch {
        /* ignore */
      }
    });
  });
}
