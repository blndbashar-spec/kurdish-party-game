import { Request, Response } from 'express';
import type { CreateGameInput, UpdateGameInput } from '../schemas/games';
import {
  createGame,
  createCategory,
  deleteCategory,
  deleteGame,
  getGameBySlug,
  leaderboard,
  listCategories,
  listGames,
  updateGame,
} from '../services/game.service';

// ── GET /api/games ─────────────────────────────────────────────
export const listGamesHandler = async (_req: Request, res: Response) => {
  res.json(await listGames());
};

// ── GET /api/games/leaderboard ─────────────────────────────────
export const leaderboardHandler = async (req: Request, res: Response) => {
  const { gameId, limit } = req.query as Record<string, string | undefined>;
  const parsedLimit = Math.min(Math.max(parseInt(limit ?? '10', 10) || 10, 1), 50);
  res.json(await leaderboard(gameId, parsedLimit));
};

// ── GET /api/games/:slug ───────────────────────────────────────
export const getGameHandler = async (req: Request, res: Response) => {
  const game = await getGameBySlug(req.params.slug);
  if (!game) {
    res.status(404).json({ error: 'یاری نەدۆزرایەوە' });
    return;
  }
  res.json(game);
};

// ── POST /api/games (admin) ────────────────────────────────────
export const createGameHandler = async (req: Request, res: Response) => {
  res.status(201).json(await createGame(req.body as CreateGameInput));
};

// ── PATCH /api/games/:slug (admin) ─────────────────────────────
export const updateGameHandler = async (req: Request, res: Response) => {
  res.json(await updateGame(req.params.slug, req.body as UpdateGameInput));
};

// ── DELETE /api/games/:slug (admin) ────────────────────────────
export const deleteGameHandler = async (req: Request, res: Response) => {
  await deleteGame(req.params.slug);
  res.json({ ok: true });
};

// ── GET /api/categories ────────────────────────────────────────
export const listCategoriesHandler = async (_req: Request, res: Response) => {
  res.json(await listCategories());
};

// ── POST /api/categories (admin) ───────────────────────────────
export const createCategoryHandler = async (req: Request, res: Response) => {
  const { nameKu, nameEn, slug } = req.body as {
    nameKu: string;
    nameEn?: string;
    slug: string;
  };
  res.status(201).json(await createCategory({ slug, nameKu, nameEn }));
};

// ── DELETE /api/categories/:slug (admin) ───────────────────────
export const deleteCategoryHandler = async (req: Request, res: Response) => {
  await deleteCategory(req.params.slug);
  res.json({ ok: true });
};
