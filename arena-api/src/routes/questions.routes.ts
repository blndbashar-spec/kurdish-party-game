import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAdmin, requireAuth } from '../middleware/auth';
import { zodBody } from '../middleware/validate';
import { createQuestionSchema, updateQuestionSchema } from '../schemas/questions';
import * as ctrl from '../controllers/questions.controller';

const router = Router();

router.get('/', asyncHandler(ctrl.listQuestionsHandler));
router.post('/', requireAuth, requireAdmin, zodBody(createQuestionSchema), asyncHandler(ctrl.createQuestionHandler));
router.patch('/:id', requireAuth, requireAdmin, zodBody(updateQuestionSchema), asyncHandler(ctrl.updateQuestionHandler));
router.delete('/:id', requireAuth, requireAdmin, asyncHandler(ctrl.deleteQuestionHandler));

export { router as questionsRoutes };
