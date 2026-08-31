import type { Config } from 'drizzle-kit';

export default {
  schema: './src/models/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      'postgresql://arena:arena_secret_2026@localhost:5432/arena_db',
  },
} satisfies Config;
