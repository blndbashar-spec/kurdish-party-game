import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth } from '../middleware/auth';
import { authLimiter } from '../middleware/ratelimit';
import { zodBody } from '../middleware/validate';
import { loginSchema, registerSchema } from '../schemas/auth';
import * as ctrl from '../controllers/auth.controller';

const router = Router();

router.post('/register', authLimiter, zodBody(registerSchema), asyncHandler(ctrl.register));
router.post('/login', authLimiter, zodBody(loginSchema), asyncHandler(ctrl.login));
router.post('/refresh', authLimiter, asyncHandler(ctrl.refresh));
router.post('/logout', asyncHandler(ctrl.logout));
router.get('/me', requireAuth, asyncHandler(ctrl.me));

export { router as authRoutes };
