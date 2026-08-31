import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

// ═══════════════════════════════════════════════════════════════
//  شێمەی PostgreSQL بۆ Arena (Drizzle ORM)
// ═══════════════════════════════════════════════════════════════

export const roleEnum = pgEnum('role', ['player', 'admin']);
export const roomStatusEnum = pgEnum('room_status', ['waiting', 'playing', 'finished']);

// ── ١. بەکارهێنەران ───────────────────────────────────────────
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  username: varchar('username', { length: 32 }).notNull().unique(),
  email: varchar('email', { length: 255 }).unique(),
  passwordHash: text('password_hash'),
  avatarUrl: text('avatar_url'),
  role: roleEnum('role').notNull().default('player'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── ٢. پۆلەکان (categories) — بۆ ڕیزکردنی پرسیارەکان ──────────
export const categories = pgTable('categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: varchar('slug', { length: 50 }).notNull().unique(),
  nameKu: varchar('name_ku', { length: 100 }).notNull(),
  nameEn: varchar('name_en', { length: 100 }),
});

// ── ٣. یارییەکان ──────────────────────────────────────────────
export const games = pgTable('games', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: varchar('slug', { length: 50 }).notNull().unique(),
  nameKu: varchar('name_ku', { length: 100 }).notNull(),
  nameEn: varchar('name_en', { length: 100 }),
  icon: varchar('icon', { length: 10 }),
  color: varchar('color', { length: 7 }),
  minPlayers: integer('min_players').notNull().default(2),
  maxPlayers: integer('max_players').notNull().default(20),
  // ڕێکخستنی تایبەتی هەر یارییەک: timeLimit, rounds, pointsPerCorrect, items...
  config: jsonb('config').notNull().default({}),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── ٤. بنکەی پرسیارەکان ───────────────────────────────────────
export const questions = pgTable(
  'questions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
    content: text('content').notNull(),
    // بۆ quiz: ["ئۆپسیۆن١","ئۆپسیۆن٢",...] — بۆ charades/spy: null
    options: jsonb('options'),
    correctIndex: integer('correct_index'),
    difficulty: integer('difficulty').notNull().default(1),
    tags: text('tags').array(),
    usageCount: integer('usage_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idx_questions_game: index('idx_questions_game').on(t.gameId),
  }),
);

// ── ٥. ژووری یاری (Rooms) ────────────────────────────────────
export const rooms = pgTable(
  'rooms',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    // کۆدی داخڵبوون وەک "X7K9P2"
    code: varchar('code', { length: 8 }).notNull().unique(),
    hostId: uuid('host_id').references(() => users.id, { onDelete: 'set null' }),
    gameId: uuid('game_id').references(() => games.id, { onDelete: 'set null' }),
    status: roomStatusEnum('status').notNull().default('waiting'),
    maxPlayers: integer('max_players').notNull().default(8),
    config: jsonb('config').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true })
      .notNull()
      .default(sql`now() + interval '6 hours'`),
  },
  (t) => ({
    idx_rooms_status: index('idx_rooms_status').on(t.status),
  }),
);

// ── ٦. ئەندامانی ژوور ─────────────────────────────────────────
export const roomPlayers = pgTable(
  'room_players',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    seatIndex: integer('seat_index').notNull().default(0),
    score: integer('score').notNull().default(0),
    isReady: boolean('is_ready').notNull().default(false),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uq_room_players_room_user: uniqueIndex('uq_room_players_room_user').on(t.roomId, t.userId),
  }),
);

// ── ٧. مێژووی یاری (بۆ ڕیپلەی و وینەڕ) ─────────────────────────
export const gameSessions = pgTable('game_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  roomId: uuid('room_id').references(() => rooms.id, { onDelete: 'set null' }),
  gameId: uuid('game_id').references(() => games.id, { onDelete: 'set null' }),
  winnerId: uuid('winner_id').references(() => users.id, { onDelete: 'set null' }),
  startedAt: timestamp('started_at', { withTimezone: true }),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  finalState: jsonb('final_state'),
});

// ── ٨. خاڵەکان (Leaderboard) ──────────────────────────────────
export const scores = pgTable(
  'scores',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    gameId: uuid('game_id').references(() => games.id, { onDelete: 'set null' }),
    points: integer('points').notNull().default(0),
    playedAt: timestamp('played_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idx_scores_user_game: index('idx_scores_user_game').on(t.userId, t.gameId),
  }),
);

// ── ٩. توکنەکانی ڕیفریش (refresh tokens) ───────────────────────
export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  // توکنەکە بە SHA-256 هەش کراوە و پاشەکەوت دەکرێت
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
