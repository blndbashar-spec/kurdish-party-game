import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth } from '../middleware/auth';
import { zodBody } from '../middleware/validate';
import { createRoomSchema, readySchema } from '../schemas/rooms';
import * as ctrl from '../controllers/rooms.controller';

const router = Router();

router.post('/', requireAuth, zodBody(createRoomSchema), asyncHandler(ctrl.createRoomHandler));
router.get('/:code', asyncHandler(ctrl.getRoomHandler));
router.post('/:code/join', requireAuth, asyncHandler(ctrl.joinRoomHandler));
router.post('/:code/leave', requireAuth, asyncHandler(ctrl.leaveRoomHandler));
router.post('/:code/ready', requireAuth, zodBody(readySchema), asyncHandler(ctrl.setReadyHandler));
router.post('/:code/start', requireAuth, asyncHandler(ctrl.startRoomHandler));
router.delete('/:code', requireAuth, asyncHandler(ctrl.closeRoomHandler));

export { router as roomsRoutes };
