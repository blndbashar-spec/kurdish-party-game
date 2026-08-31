import { z } from 'zod';

export const registerSchema = z.object({
  username: z
    .string()
    .min(3, 'username کەمترین ٣ پیت')
    .max(32, 'username زۆرترین ٣٢ پیت')
    .regex(/^[a-zA-Z0-9_]+$/, 'username تەنها پیتی ئینگلیزی، ژمارە و _'),
  email: z
    .string()
    .email('email نادرەوست')
    .max(255)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  password: z
    .string()
    .min(6, 'وشەی نهێنی کەمترین ٦ پیت')
    .max(128),
});

export const loginSchema = z.object({
  username: z.string().min(1, 'username پێویستە'),
  password: z.string().min(1, 'وشەی نهێنی پێویستە'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
