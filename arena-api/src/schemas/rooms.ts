import { z } from 'zod';

export const createRoomSchema = z.object({
  gameId: z.string().uuid('gameId ڕاست نییە'),
  maxPlayers: z.number().int().min(2).max(32).optional(),
  config: z.record(z.unknown()).optional(),
});

export const readySchema = z.object({
  ready: z.boolean(),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
