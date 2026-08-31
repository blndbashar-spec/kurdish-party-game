import { z } from 'zod';

export const createQuestionSchema = z.object({
  gameId: z.string().uuid('gameId ڕاست نییە'),
  categoryId: z.string().uuid('categoryId ڕاست نییە').optional(),
  content: z.string().min(1, 'ناوەڕۆکی پرسیار پێویستە').max(2000),
  options: z
    .array(z.string().min(1).max(200))
    .min(2)
    .max(6)
    .optional(),
  correctIndex: z.number().int().min(0).max(5).optional(),
  difficulty: z.number().int().min(1).max(5).default(1),
  tags: z.array(z.string().max(50)).max(10).default([]),
});

export const updateQuestionSchema = createQuestionSchema
  .omit({ gameId: true })
  .partial();

export const listQuestionsQuery = z.object({
  gameId: z.string().uuid().optional(),
  category: z.string().max(50).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;
export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>;
export type ListQuestionsQuery = z.infer<typeof listQuestionsQuery>;
