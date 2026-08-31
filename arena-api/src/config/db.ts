import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../models/schema';
import { env } from './env';

// PostgreSQL — ڕێکخراوی postgres.js (driver ی سووک و خێرا)
export const client = postgres(env.DATABASE_URL, {
  max: 10,
  onnotice: () => {},
});

export const db = drizzle(client, { schema });
