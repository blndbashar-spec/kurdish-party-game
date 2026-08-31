import http from 'node:http';
import express from 'express';
import cookieParser from 'cookie-parser';
import { env, isProd } from './config/env';
import { client } from './config/db';
import { redis } from './config/redis';
import { helmetCsp, corsMiddleware, sanitizeBody } from './middleware/security';
import { generalLimiter } from './middleware/ratelimit';
import { errorHandler, notFound } from './middleware/error';
import { authRoutes } from './routes/auth.routes';
import { gamesRoutes } from './routes/games.routes';
import { categoriesRoutes } from './routes/categories.routes';
import { questionsRoutes } from './routes/questions.routes';
import { roomsRoutes } from './routes/rooms.routes';
import { attachSocket } from './socket';

// ═══════════════════════════════════════════════════════════════
//  Arena API — Express + Socket.io
// ═══════════════════════════════════════════════════════════════

const app = express();
app.disable('x-powered-by');
if (isProd || env.TRUST_PROXY) app.set('trust proxy', 1);

// ── ناونیشان و بەتۆمارکردنەوە (ناردەو) ───────────────────────
app.use(helmetCsp);
app.use(corsMiddleware);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── ڕێژەدان (rate limiting) — پێش هەموو ڕێچکەیەکی /api ─────────
app.use('/api', generalLimiter);

// ── پاککردنەوەی XSS لە body ───────────────────────────────────
app.use(sanitizeBody);

// ── ڕووداوی تەندروستی (bۆ docker/nginx) ──────────────────────
app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'arena-api', ts: new Date().toISOString() });
});

// ── ڕێچکەکان ─────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/games', gamesRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/questions', questionsRoutes);
app.use('/api/rooms', roomsRoutes);

// ── ٤٠ + هەڵەی کۆتایی ─────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Server + Socket.io ─────────────────────────────────────────
const server = http.createServer(app);
attachSocket(server);

server.listen(env.PORT, '0.0.0.0', () => {
  console.log(`🚀 Arena API: http://0.0.0.0:${env.PORT}`);
  console.log(`   Socket.io: /socket.io (namespace: /game)`);
});

// ── دادپەروەری و داکردن ────────────────────────────────────────
function shutdown(signal: string) {
  console.log(`\n${signal} وەگیرا — داکردن...`);
  // هەڵەیەکی بێگە — ئەگەر graceful shutdown درێژای، بە زۆرڕاستی دەمردێت
  const hardExit = setTimeout(() => process.exit(0), 4000);
  hardExit.unref?.();
  server.close();
  client
    .end()
    .catch(() => {})
    .finally(() => {
      redis.quit().catch(() => {});
      process.exit(0);
    });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
