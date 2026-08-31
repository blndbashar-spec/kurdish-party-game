import 'dotenv/config';
import { z } from 'zod';

// هەموو گشتی ڕەسەنەکان بە Zod دەپشکنین — ئەگەر یەکێکیان نەبوو، دەستبەجێ دۆڕینەوە
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL پێویستە'),
  REDIS_URL: z.string().min(1, 'REDIS_URL پێویستە'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET دەبێت کەمترین ١٦ پیت بێت'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  REFRESH_EXPIRES_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173,https://arena.com,http://arena.com,https://www.arena.com'),
  TRUST_PROXY: z
    .string()
    .default('false')
    .transform((v) => v === 'true' || v === '1'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('⚙️  هەڵە لە گشتی ڕەسەن (environment):');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
