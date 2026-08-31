import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '../config/db';
import { env } from '../config/env';
import { refreshTokens, users } from '../models/schema';
import { ApiError } from '../middleware/error';
import { signAccessToken } from '../utils/jwt';

// ── وشەی نهێنی ─────────────────────────────────────────────────
export const hashPassword = (plain: string) => bcrypt.hash(plain, 10);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

// توکنەکە هەرگیز بە شێوەی ڕاستەوخۆ پاشەکەوت ناکرێت — تەنها SHA-256-ی
const sha256 = (v: string) => crypto.createHash('sha256').update(v).digest('hex');

export interface PublicUser {
  id: string;
  username: string;
  email: string | null;
  avatarUrl: string | null;
  role: string;
  createdAt: Date;
}

export const toPublicUser = (u: typeof users.$inferSelect): PublicUser => ({
  id: u.id,
  username: u.username,
  email: u.email,
  avatarUrl: u.avatarUrl,
  role: u.role,
  createdAt: u.createdAt,
});

// ── دروستکردنی بەکارهێنەر ─────────────────────────────────────
export async function registerUser(input: {
  username: string;
  email?: string;
  password: string;
}) {
  const where = input.email
    ? and(eq(users.username, input.username), eq(users.email, input.email))
    : eq(users.username, input.username);

  const existing = await db.select({ id: users.id }).from(users).where(where).limit(1);
  if (existing.length) {
    throw new ApiError(409, 'ئەم username یان email-ە پێشتر بەکارهاتووە');
  }

  const [created] = await db
    .insert(users)
    .values({
      username: input.username,
      email: input.email ?? null,
      passwordHash: await hashPassword(input.password),
    })
    .returning();

  return created;
}

// ── چوونەژوورەوە ───────────────────────────────────────────────
export async function findUserByUsername(username: string) {
  const rows = await db.select().from(users).where(eq(users.username, username)).limit(1);
  return rows[0] ?? null;
}

// ── دابەشکردنی توکنەکان (access + refresh) ────────────────────
export async function issueTokens(user: {
  id: string;
  username: string;
  role: string;
}): Promise<{ accessToken: string; refreshToken: string }> {
  const accessToken = signAccessToken({
    sub: user.id,
    username: user.username,
    role: user.role,
  });
  const refreshToken = crypto.randomBytes(48).toString('base64url');

  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash: sha256(refreshToken),
    expiresAt: new Date(Date.now() + env.REFRESH_EXPIRES_DAYS * 24 * 3600 * 1000),
  });

  return { accessToken, refreshToken };
}

// ── گۆڕینی refresh token (rotation) ───────────────────────────
export async function rotateRefreshToken(oldToken: string) {
  const rows = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, sha256(oldToken)))
    .limit(1);
  const record = rows[0];

  if (!record || record.revokedAt || record.expiresAt < new Date()) {
    throw new ApiError(401, 'refresh token نامۆ یان بێهەتا');
  }

  // توکنی کۆن ڕەتدەکەینەوە — ئەگەر دووبارە بەکاربێت، دزراوە
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.id, record.id));

  const userRows = await db.select().from(users).where(eq(users.id, record.userId)).limit(1);
  const user = userRows[0];
  if (!user) throw new ApiError(401, 'بەکارهێنەر نەدۆزرایەوە');

  const tokens = await issueTokens({ id: user.id, username: user.username, role: user.role });
  return {
    user: toPublicUser(user),
    tokens,
  };
}

// ── ڕەتکردنەوەی refresh token (logout) ────────────────────────
export async function revokeRefreshToken(token: string) {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.tokenHash, sha256(token)));
}
