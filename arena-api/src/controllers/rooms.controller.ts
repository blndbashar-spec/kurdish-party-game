import { Request, Response } from 'express';
import type { CreateRoomInput } from '../schemas/rooms';
import {
  closeRoom,
  createRoom,
  describeRoom,
  joinRoom,
  leaveRoom,
  markPlaying,
  setReady,
} from '../services/room.service';

// ── POST /api/rooms ────────────────────────────────────────────
export const createRoomHandler = async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: 'توکن نییە' });
    return;
  }
  const { room } = await createRoom(user.id, req.body as CreateRoomInput);
  res.status(201).json(await describeRoom(room.code));
};

// ── GET /api/rooms/:code ───────────────────────────────────────
export const getRoomHandler = async (req: Request, res: Response) => {
  res.json(await describeRoom(req.params.code));
};

// ── POST /api/rooms/:code/join ─────────────────────────────────
export const joinRoomHandler = async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: 'توکن نییە' });
    return;
  }
  await joinRoom(req.params.code, user.id);
  res.json(await describeRoom(req.params.code));
};

// ── POST /api/rooms/:code/leave ────────────────────────────────
export const leaveRoomHandler = async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: 'توکن نییە' });
    return;
  }
  await leaveRoom(req.params.code, user.id);
  res.json({ ok: true });
};

// ── POST /api/rooms/:code/ready ────────────────────────────────
export const setReadyHandler = async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: 'توکن نییە' });
    return;
  }
  const ready = Boolean((req.body as { ready?: boolean })?.ready);
  await setReady(req.params.code, user.id, ready);
  res.json(await describeRoom(req.params.code));
};

// ── POST /api/rooms/:code/start (خاوەنەکە) ────────────────────
export const startRoomHandler = async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: 'توکن نییە' });
    return;
  }
  await markPlaying(req.params.code, user.id);
  res.json({
    ok: true,
    note: 'ژوورەکە ئێستا "playing"-ە — یاریزانەکان لە namespace-ی /game بەردەوام دەبن',
  });
};

// ── DELETE /api/rooms/:code (خاوەنەکە) ────────────────────────
export const closeRoomHandler = async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: 'توکن نییە' });
    return;
  }
  await closeRoom(req.params.code, user.id);
  res.json({ ok: true });
};
