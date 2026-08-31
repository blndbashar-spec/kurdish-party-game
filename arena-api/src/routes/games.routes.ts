import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAdmin, requireAuth } from '../middleware/auth';
import { zodBody } from '../middleware/validate';
import { createGameSchema, updateGameSchema } from '../schemas/games';
import * as ctrl from '../controllers/games.controller';

const router = Router();

router.get('/', asyncHandler(ctrl.listGamesHandler));
// leaderboard پێش :slug دابنێین بۆ ئەوەی "leaderboard" وەک slug نەگۆڕدرێت
router.get('/leaderboard', asyncHandler(ctrl.leaderboardHandler));
router.get('/:slug', asyncHandler(ctrl.getGameHandler));
router.post(
  '/',
  requireAuth,
  requireAdmin,
  zodBody(createGameSchema),
  asyncHandler(ctrl.createGameHandler),
);
router.patch(
  '/:slug',
  requireAuth,
  requireAdmin,
  zodBody(updateGameSchema),
  asyncHandler(ctrl.updateGameHandler),
);
router.delete('/:slug', requireAuth, requireAdmin, asyncHandler(ctrl.deleteGameHandler));

export { router as gamesRoutes };
