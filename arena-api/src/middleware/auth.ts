import { NextFunction, Request, RequestHandler, Response } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { ApiError } from './error';

export interface AuthUser {
  id: string;
  username: string;
  role: string;
}

// بەراوردکردنی Express.Request — بۆ ئەوەی req.user لە هەموو شوێنێک بەردەست بێت
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// ── داواکردنی توکنی access (Bearer <token>) ───────────────────
export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  const token = header && header.startsWith('Bearer ') ? header.slice(7) : undefined;
  if (!token) return next(new ApiError(401, 'توکن نییە — سەرەتا چوونەژوورەوە بکە'));
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, username: payload.username, role: payload.role };
    next();
  } catch {
    next(new ApiError(401, 'توکن نامۆ یان بێهەتا'));
  }
};

// ── داواکردنی ڕۆڵی admin ──────────────────────────────────────
export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (req.user?.role !== 'admin') {
    return next(new ApiError(403, 'ڕووکاری بەڕێوەبەری پێویستە'));
  }
  next();
};
