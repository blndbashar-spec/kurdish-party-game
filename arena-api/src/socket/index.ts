import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { env } from '../config/env';
import { registerGameNamespace } from './game.server';

// تاقیکردنەوەی socket.io — namespace-ی /game بۆ یارییەکان
export function attachSocket(httpServer: HttpServer) {
  const origins = env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);

  const io = new Server(httpServer, {
    cors: { origin: origins, credentials: true },
    pingTimeout: 20000,
    pingInterval: 10000,
  });

  // instrumentation — بۆ دووبارەسازی هەڵە
  io.engine.on('connection', (eng) => {
    console.log(`[engine] یەکتەوە: ${eng.id} (${eng.transport.name})`);
  });
  io.engine.on('connection_error', (err: Error) => {
    console.log(`[engine] هەڵە: ${err.message}`);
  });

  const gameNsp = io.of('/game');
  registerGameNamespace(gameNsp);

  return { io, gameNsp };
}
