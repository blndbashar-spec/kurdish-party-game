import helmet from 'helmet';
import cors from 'cors';
import xss from 'xss';
import { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';

// ── Helmet + CSP ────────────────────────────────────────────────
// ئەمە API ی JSON-ە؛ CSP بە "هیچ" ڕادەگیرێت (بۆ ئەوەی هیچ content-ێک
// لەلایەن برۆوزەرەوە جێبەجێ نەکدرێت)
export const helmetCsp = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'none'"],
    },
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  referrerPolicy: { policy: 'no-referrer' },
});

// ── CORS — تەنها origin ڕێگادراوەکان (arena.com + dev) ─────────
const origins = env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);

export const corsMiddleware = cors({
  origin(origin, callback) {
    // داواکاری بەبێ origin (curl, app, هەمان domain) ڕێگەپێدراون
    if (!origin || origins.includes(origin)) return callback(null, true);
    return callback(new Error('CORS: origin ڕێگەپێدراو نییە'));
  },
  credentials: true, // بۆ httpOnly cookie ی refresh token
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

// ── XSS — پاککردنەوەی HTML-ی داچوو لە body ────────────────────
function sanitizeDeep(value: unknown): unknown {
  if (typeof value === 'string') return xss(value);
  if (Array.isArray(value)) return value.map(sanitizeDeep);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, sanitizeDeep(v)]));
  }
  return value;
}

export const sanitizeBody = (req: Request, _res: Response, next: NextFunction) => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeDeep(req.body);
  }
  next();
};

// تێبینی: SQL injection بە دروستی بە Drizzle ORM ڕێگرتووە — هەموو query-یەکان
// parameterized-ن و هیچ string-ێک بەبێ هەشکردن لەگەڵ SQL-دا ناکرێت.
