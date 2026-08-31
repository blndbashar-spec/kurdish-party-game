import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAdmin, requireAuth } from '../middleware/auth';
import { zodBody } from '../middleware/validate';
import { createCategorySchema } from '../schemas/categories';
import * as ctrl from '../controllers/games.controller';

const router = Router();

router.get('/', asyncHandler(ctrl.listCategoriesHandler));
router.post(
  '/',
  requireAuth,
  requireAdmin,
  zodBody(createCategorySchema),
  asyncHandler(ctrl.createCategoryHandler),
);
router.delete('/:slug', requireAuth, requireAdmin, asyncHandler(ctrl.deleteCategoryHandler));

export { router as categoriesRoutes };
