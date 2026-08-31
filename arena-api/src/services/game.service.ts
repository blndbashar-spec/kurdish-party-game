import { and, desc, eq, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { db } from '../config/db';
import { categories, games, questions, scores, users } from '../models/schema';
import { ApiError } from '../middleware/error';
import type { CreateGameInput, UpdateGameInput } from '../schemas/games';
import type { CreateQuestionInput, UpdateQuestionInput } from '../schemas/questions';
import type { CreateCategoryInput } from '../schemas/categories';

// ═══════════════════════════════════════════════════════════════
//  خزمەتگوزاری یاری / پرسیار / پۆل
// ═══════════════════════════════════════════════════════════════

// ── یارییەکان ─────────────────────────────────────────────────
export const listGames = () =>
  db.select().from(games).where(eq(games.isActive, true)).orderBy(games.nameKu);

export async function getGameBySlug(slug: string) {
  const [game] = await db.select().from(games).where(eq(games.slug, slug)).limit(1);
  return game ?? null;
}

export async function createGame(data: CreateGameInput) {
  const existing = await getGameBySlug(data.slug);
  if (existing) throw new ApiError(409, 'ئەم slug-ە پێشتر بوونی هەیە');
  const [created] = await db
    .insert(games)
    .values({
      slug: data.slug,
      nameKu: data.nameKu,
      nameEn: data.nameEn ?? null,
      icon: data.icon ?? null,
      color: data.color ?? null,
      minPlayers: data.minPlayers,
      maxPlayers: data.maxPlayers,
      config: data.config,
      isActive: data.isActive ?? true,
    })
    .returning();
  return created;
}

export async function updateGame(slug: string, data: UpdateGameInput) {
  const existing = await getGameBySlug(slug);
  if (!existing) throw new ApiError(404, 'یاری نەدۆزرایەوە');
  const [updated] = await db
    .update(games)
    .set({
      nameKu: data.nameKu ?? existing.nameKu,
      nameEn: data.nameEn ?? existing.nameEn,
      icon: data.icon ?? existing.icon,
      color: data.color ?? existing.color,
      minPlayers: data.minPlayers ?? existing.minPlayers,
      maxPlayers: data.maxPlayers ?? existing.maxPlayers,
      config: data.config ?? existing.config,
      isActive: data.isActive ?? existing.isActive,
    })
    .where(eq(games.id, existing.id))
    .returning();
  return updated;
}

export async function deleteGame(slug: string) {
  const existing = await getGameBySlug(slug);
  if (!existing) throw new ApiError(404, 'یاری نەدۆزرایەوە');
  await db.delete(games).where(eq(games.id, existing.id));
}

// ── پۆلەکان ────────────────────────────────────────────────────
export const listCategories = () => db.select().from(categories);

export async function createCategory(data: CreateCategoryInput) {
  const [existing] = await db.select().from(categories).where(eq(categories.slug, data.slug)).limit(1);
  if (existing) throw new ApiError(409, 'ئەم slug-ە پێشتر بوونی هەیە');
  const [created] = await db
    .insert(categories)
    .values({ slug: data.slug, nameKu: data.nameKu, nameEn: data.nameEn ?? null })
    .returning();
  return created;
}

export async function deleteCategory(slug: string) {
  const [existing] = await db.select().from(categories).where(eq(categories.slug, slug)).limit(1);
  if (!existing) throw new ApiError(404, 'پۆل نەدۆزرایەوە');
  await db.delete(categories).where(eq(categories.id, existing.id));
}

// ── پرسیارەکان ────────────────────────────────────────────────
export async function listQuestions(gameId?: string, categorySlug?: string, limit = 20) {
  const conds: SQL[] = [];
  if (gameId) conds.push(eq(questions.gameId, gameId));
  if (categorySlug) conds.push(eq(categories.slug, categorySlug));
  const where = conds.length === 0 ? undefined : conds.length === 1 ? conds[0] : and(...conds);

  const base = db
    .select({
      id: questions.id,
      gameId: questions.gameId,
      content: questions.content,
      options: questions.options,
      correctIndex: questions.correctIndex,
      difficulty: questions.difficulty,
      tags: questions.tags,
      usageCount: questions.usageCount,
      category: categories.slug,
    })
    .from(questions)
    .leftJoin(categories, eq(questions.categoryId, categories.id));

  return where
    ? base.where(where).orderBy(desc(questions.createdAt)).limit(limit)
    : base.orderBy(desc(questions.createdAt)).limit(limit);
}

export async function createQuestion(data: CreateQuestionInput) {
  const [game] = await db.select().from(games).where(eq(games.id, data.gameId)).limit(1);
  if (!game) throw new ApiError(404, 'یاری نەدۆزرایەوە');
  if (data.options && data.correctIndex !== undefined && data.correctIndex >= data.options.length) {
    throw new ApiError(422, 'correctIndex لە ژمارەی ئۆپسیۆنەکان گەورەیە');
  }
  const [created] = await db
    .insert(questions)
    .values({
      gameId: data.gameId,
      categoryId: data.categoryId ?? null,
      content: data.content,
      options: data.options ?? null,
      correctIndex: data.correctIndex ?? null,
      difficulty: data.difficulty,
      tags: data.tags,
    })
    .returning();
  return created;
}

export async function updateQuestion(id: string, data: UpdateQuestionInput) {
  const [existing] = await db.select().from(questions).where(eq(questions.id, id)).limit(1);
  if (!existing) throw new ApiError(404, 'پرسیار نەدۆزرایەوە');
  const [updated] = await db
    .update(questions)
    .set({
      content: data.content ?? existing.content,
      options: data.options ?? existing.options,
      correctIndex: data.correctIndex ?? existing.correctIndex,
      difficulty: data.difficulty ?? existing.difficulty,
      tags: data.tags ?? existing.tags,
      categoryId: data.categoryId !== undefined ? data.categoryId : existing.categoryId,
    })
    .where(eq(questions.id, id))
    .returning();
  return updated;
}

export async function deleteQuestion(id: string) {
  const [existing] = await db.select().from(questions).where(eq(questions.id, id)).limit(1);
  if (!existing) throw new ApiError(404, 'پرسیار نەدۆزرایەوە');
  await db.delete(questions).where(eq(questions.id, id));
}

// ── Leaderboard ────────────────────────────────────────────────
export async function leaderboard(gameId?: string, limit = 10) {
  const where = gameId ? eq(scores.gameId, gameId) : undefined;
  const totalPoints = sql<number>`coalesce(sum(${scores.points}), 0)`;
  const base = db
    .select({
      userId: users.id,
      username: users.username,
      avatarUrl: users.avatarUrl,
      points: totalPoints,
      played: sql<number>`count(*)::int`,
    })
    .from(scores)
    .innerJoin(users, eq(scores.userId, users.id))
    .groupBy(users.id, users.username, users.avatarUrl);
  return (where ? base.where(where) : base).orderBy(desc(totalPoints)).limit(limit);
}
