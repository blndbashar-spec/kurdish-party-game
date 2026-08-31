import { z } from 'zod';

export const createGameSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'slug تەنها پیتی ئینگلیزیی هێڵی خوار و ژمارە'),
  nameKu: z.string().min(1, 'ناوی کوردی پێویستە').max(100),
  nameEn: z.string().max(100).optional(),
  icon: z.string().max(10).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'ڕەنگ بنەڕەت #RRGGBB').optional(),
  minPlayers: z.number().int().min(1).max(50).default(2),
  maxPlayers: z.number().int().min(2).max(100).default(20),
  config: z.record(z.unknown()).default({}),
  isActive: z.boolean().optional(),
});

export const updateGameSchema = createGameSchema.partial().omit({ slug: true });

export type CreateGameInput = z.infer<typeof createGameSchema>;
export type UpdateGameInput = z.infer<typeof updateGameSchema>;
