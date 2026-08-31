import { Request, Response } from 'express';
import { listQuestionsQuery } from '../schemas/questions';
import type { CreateQuestionInput, UpdateQuestionInput } from '../schemas/questions';
import { ApiError } from '../middleware/error';
import {
  createQuestion,
  deleteQuestion,
  listQuestions,
  updateQuestion,
} from '../services/game.service';

// ── GET /api/questions?gameId=&category=&limit= ────────────────
export const listQuestionsHandler = async (req: Request, res: Response) => {
  const parsed = listQuestionsQuery.safeParse(req.query);
  if (!parsed.success) {
    throw new ApiError(422, 'پارامەتەر هەڵەیە', parsed.error.flatten().fieldErrors);
  }
  const { gameId, category, limit } = parsed.data;
  res.json(await listQuestions(gameId, category, limit));
};

// ── POST /api/questions (admin) ────────────────────────────────
export const createQuestionHandler = async (req: Request, res: Response) => {
  res.status(201).json(await createQuestion(req.body as CreateQuestionInput));
};

// ── PATCH /api/questions/:id (admin) ───────────────────────────
export const updateQuestionHandler = async (req: Request, res: Response) => {
  res.json(await updateQuestion(req.params.id, req.body as UpdateQuestionInput));
};

// ── DELETE /api/questions/:id (admin) ──────────────────────────
export const deleteQuestionHandler = async (req: Request, res: Response) => {
  await deleteQuestion(req.params.id);
  res.json({ ok: true });
};
