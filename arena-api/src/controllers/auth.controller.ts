import { Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../config/db';
import { env } from '../config/env';
import { users } from '../models/schema';
import { ApiError } from '../middleware/error';
import type { LoginInput, RegisterInput } from '../schemas/auth';
import {
  issueTokens,
  registerUser,
  revokeRefreshToken,
  rotateRefreshToken,
  toPublicUser,
  findUserByUsername,
  verifyPassword,
} from '../services/auth.service';
import type { AuthUser } from '../middleware/auth';

// ── cookie ی refresh token (httpOnly — جاواسکر립یت ناکەوێتە دەست) ─
function setRefreshCookie(res: Response, token: string) {
  res.cookie('refresh_token', token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: env.REFRESH_EXPIRES_DAYS * 24 * 3600 * 1000,
    path: '/api/auth',
  });
}

const clearRefreshCookie = (res: Response) =>
  res.clearCookie('refresh_token', { path: '/api/auth' });

// ── POST /api/auth/register ────────────────────────────────────
export async function register(req: { body: RegisterInput }, res: Response) {
  const user = await registerUser(req.body);
  const tokens = await issueTokens({
    id: user.id,
    username: user.username,
    role: user.role,
  });
  setRefreshCookie(res, tokens.refreshToken);
  res.status(201).json({ user: toPublicUser(user), accessToken: tokens.accessToken });
}

// ── POST /api/auth/login ───────────────────────────────────────
export async function login(req: { body: LoginInput }, res: Response) {
  const { username, password } = req.body;
  const user = await findUserByUsername(username);
  if (!user || !user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    throw new ApiError(401, 'username یان وشەی نهێنی هەڵەیە');
  }
  const tokens = await issueTokens({
    id: user.id,
    username: user.username,
    role: user.role,
  });
  setRefreshCookie(res, tokens.refreshToken);
  res.json({ user: toPublicUser(user), accessToken: tokens.accessToken });
}

// ── POST /api/auth/refresh ─────────────────────────────────────
export async function refresh(
  req: { cookies?: Record<string, string> },
  res: Response,
) {
  const token = req.cookies?.refresh_token;
  if (!token) throw new ApiError(401, 'refresh token نییە');
  const { user, tokens } = await rotateRefreshToken(token);
  setRefreshCookie(res, tokens.refreshToken);
  res.json({ user, accessToken: tokens.accessToken });
}

// ── POST /api/auth/logout ──────────────────────────────────────
export async function logout(
  req: { cookies?: Record<string, string> },
  res: Response,
) {
  const token = req.cookies?.refresh_token;
  if (token) await revokeRefreshToken(token);
  clearRefreshCookie(res);
  res.json({ ok: true });
}

// ── GET /api/auth/me ───────────────────────────────────────────
export async function me(req: { user?: AuthUser }, res: Response) {
  if (!req.user) throw new ApiError(401, 'توکن نییە');
  const rows = await db.select().from(users).where(eq(users.id, req.user.id)).limit(1);
  const user = rows[0];
  if (!user) throw new ApiError(404, 'بەکارهێنەر نەدۆزرایەوە');
  res.json({ user: toPublicUser(user) });
}
