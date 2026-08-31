import { and, desc, eq, ne, sql } from 'drizzle-orm';
import { db } from '../config/db';
import { redis } from '../config/redis';
import { games, gameSessions, rooms, roomPlayers, users } from '../models/schema';
import { ApiError } from '../middleware/error';
import { generateRoomCode } from '../utils/roomCode';

// ═══════════════════════════════════════════════════════════════
//  خزمەتگوزاری ژوورەکان — دروستکردن / داخڵبوون / دەستپێکردن
// ═══════════════════════════════════════════════════════════════

// ── دروستکردنی ژوور بە کۆدی ٦ پیتی تایبەت ────────────────────
export async function createRoom(
  hostId: string,
  input: { gameId: string; maxPlayers?: number; config?: Record<string, unknown> },
) {
  const [game] = await db.select().from(games).where(eq(games.id, input.gameId)).limit(1);
  if (!game || !game.isActive) throw new ApiError(404, 'یاری نەدۆزرایەوە یان چالاک نییە');

  // هەوڵدان بۆ کۆدی تایبەت (ئەگەر conflict بوو، کۆدێکی تر)
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateRoomCode(6);
    try {
      const [room] = await db
        .insert(rooms)
        .values({
          code,
          hostId,
          gameId: game.id,
          maxPlayers: input.maxPlayers ?? Math.min(8, game.maxPlayers),
          config: input.config ?? {},
        })
        .returning();

      // خاوەنەکە خۆی یەکەم ئەندامە
      await db.insert(roomPlayers).values({
        roomId: room.id,
        userId: hostId,
        seatIndex: 0,
        isReady: true,
      });

      return { room, game };
    } catch (err) {
      // 23505 = unique violation (کۆدەکە پێشتر وەستاوە)
      if (String((err as { code?: string })?.code ?? '') === '23505' && attempt < 4) continue;
      throw err;
    }
  }
  throw new ApiError(500, 'نەتوانرا کۆدی ژوور دروست بکرێت');
}

export async function getRoomByCode(code: string) {
  const [room] = await db.select().from(rooms).where(eq(rooms.code, code.toUpperCase())).limit(1);
  return room ?? null;
}

// ── ئەندامانی ژوور (لەگەڵ زانیاری بەکارهێنەر) ─────────────────
export async function listMembers(roomId: string) {
  return db
    .select({
      userId: roomPlayers.userId,
      username: users.username,
      seatIndex: roomPlayers.seatIndex,
      score: roomPlayers.score,
      isReady: roomPlayers.isReady,
    })
    .from(roomPlayers)
    .leftJoin(users, eq(roomPlayers.userId, users.id))
    .where(eq(roomPlayers.roomId, roomId))
    .orderBy(roomPlayers.seatIndex);
}

// ── وەسفکردنی ژوور بۆ کڕانت ───────────────────────────────────
export async function describeRoom(code: string) {
  const room = await getRoomByCode(code);
  if (!room) throw new ApiError(404, 'ژوور نەدۆزرایەوە');

  const [game] = room.gameId
    ? await db.select().from(games).where(eq(games.id, room.gameId)).limit(1)
    : [undefined as (typeof games.$inferSelect) | undefined];

  const members = await listMembers(room.id);

  return {
    id: room.id,
    code: room.code,
    status: room.status,
    maxPlayers: room.maxPlayers,
    hostId: room.hostId,
    createdAt: room.createdAt,
    expiresAt: room.expiresAt,
    config: room.config,
    game: game ?? null,
    players: members
      .filter((m) => m.username)
      .map((m) => ({
        userId: m.userId,
        username: m.username,
        seatIndex: m.seatIndex,
        score: m.score,
        isReady: m.isReady,
        isHost: m.userId === room.hostId,
      })),
  };
}

// ── داخڵبوونی ئەندام ──────────────────────────────────────────
export async function joinRoom(roomCode: string, userId: string) {
  const code = roomCode.toUpperCase();
  const room = await getRoomByCode(code);
  if (!room) throw new ApiError(404, 'ژوور نەدۆزرایەوە');
  if (room.status === 'finished') throw new ApiError(400, 'ئەم ژوورە تەواو بووە');
  if (room.expiresAt < new Date()) throw new ApiError(410, 'کاتی ژوورەکە بەتا بووە');

  const [membership] = await db
    .select()
    .from(roomPlayers)
    .where(and(eq(roomPlayers.roomId, room.id), eq(roomPlayers.userId, userId)))
    .limit(1);
  if (membership) return { room, already: true };

  const [countRow] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(roomPlayers)
    .where(eq(roomPlayers.roomId, room.id));
  if (countRow.n >= room.maxPlayers) throw new ApiError(400, 'ژوورەکە پڕ بووە');

  await db.insert(roomPlayers).values({
    roomId: room.id,
    userId,
    seatIndex: countRow.n,
  });

  return { room, already: false };
}

// ── بەجیهێشتنی ژوور (خاوەن بگۆڕدرێت) ──────────────────────────
export async function leaveRoom(roomCode: string, userId: string) {
  const room = await getRoomByCode(roomCode);
  if (!room) throw new ApiError(404, 'ژوور نەدۆزرایەوە');

  if (room.hostId === userId) {
    const others = await db
      .select()
      .from(roomPlayers)
      .where(and(eq(roomPlayers.roomId, room.id), ne(roomPlayers.userId, userId)))
      .orderBy(roomPlayers.seatIndex)
      .limit(1);
    if (others.length) {
      await db.update(rooms).set({ hostId: others[0].userId }).where(eq(rooms.id, room.id));
    }
  }

  await db
    .delete(roomPlayers)
    .where(and(eq(roomPlayers.roomId, room.id), eq(roomPlayers.userId, userId)));
}

// ── ئامادەیی (ready) ───────────────────────────────────────────
export async function setReady(roomCode: string, userId: string, ready: boolean) {
  const room = await getRoomByCode(roomCode);
  if (!room) throw new ApiError(404, 'ژوور نەدۆزرایەوە');
  await db
    .update(roomPlayers)
    .set({ isReady: ready })
    .where(and(eq(roomPlayers.roomId, room.id), eq(roomPlayers.userId, userId)));
}

// ── چەکی ئەندامی بۆ socket ────────────────────────────────────
export async function verifyMembership(code: string, userId: string) {
  const room = await getRoomByCode(code);
  if (!room) throw new ApiError(404, 'ژوور نەدۆزرایەوە');
  const [membership] = await db
    .select()
    .from(roomPlayers)
    .where(and(eq(roomPlayers.roomId, room.id), eq(roomPlayers.userId, userId)))
    .limit(1);
  if (!membership) throw new ApiError(403, 'لەم ژوورەوە ئەندام نیت');
  return room;
}

// ── گۆڕینی دۆخ بۆ "playing" + دروستکردنی session ─────────────
export async function markPlaying(roomCode: string, hostId: string) {
  const code = roomCode.toUpperCase();
  const room = await getRoomByCode(code);
  if (!room) throw new ApiError(404, 'ژوور نەدۆزرایەوە');
  if (room.status === 'finished') throw new ApiError(400, 'ئەم ژوورە تەواو بووە');
  if (room.hostId !== hostId) {
    throw new ApiError(403, 'تەنها خاوەن ژوور دەتوانێت یاری دەستپێبکات');
  }

  if (room.status === 'waiting') {
    const members = await listMembers(room.id);
    const [game] = room.gameId
      ? await db.select().from(games).where(eq(games.id, room.gameId)).limit(1)
      : [undefined as (typeof games.$inferSelect) | undefined];
    const min = game?.minPlayers ?? 2;
    if (members.length < min) {
      throw new ApiError(400, `کەمترین ژمارەی یاریزان: ${min}`);
    }
    await db.update(rooms).set({ status: 'playing' }).where(eq(rooms.id, room.id));
  }

  // session — بۆ مێژوو و ڕیپلەی
  const sessions = await db
    .select()
    .from(gameSessions)
    .where(eq(gameSessions.roomId, room.id))
    .orderBy(desc(gameSessions.startedAt))
    .limit(1);
  let sessionId = sessions[0]?.id;
  if (!sessionId) {
    const [session] = await db
      .insert(gameSessions)
      .values({ roomId: room.id, gameId: room.gameId, startedAt: new Date() })
      .returning();
    sessionId = session.id;
  }

  return { room, sessionId };
}

// ── داخستنی ژوور (خاوەنەکە) ───────────────────────────────────
export async function closeRoom(roomCode: string, hostId: string) {
  const room = await getRoomByCode(roomCode);
  if (!room) throw new ApiError(404, 'ژوور نەدۆزرایەوە');
  if (room.hostId !== hostId) {
    throw new ApiError(403, 'تەنها خاوەن ژوور دەتوانێت ژوور ببەستەوە');
  }
  await db.update(rooms).set({ status: 'finished' }).where(eq(rooms.id, room.id));
}

// ═══════════════════════════════════════════════════════════════
//  خاڵەکان لە Redis — score:{roomCode} → hash(userId → points)
// ═══════════════════════════════════════════════════════════════
export const redisScore = {
  incr: (roomCode: string, userId: string, points: number) =>
    redis.hincrby(`score:${roomCode}`, userId, points),
  all: (roomCode: string) => redis.hgetall(`score:${roomCode}`),
  del: (roomCode: string) => redis.del(`score:${roomCode}`),
};
