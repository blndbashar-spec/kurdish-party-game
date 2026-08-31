import { z } from 'zod';

export const createCategorySchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'slug تەنها پیتی ئینگلیزیی هێڵی خوار و ژمارە'),
  nameKu: z.string().min(1).max(100),
  nameEn: z.string().max(100).optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
