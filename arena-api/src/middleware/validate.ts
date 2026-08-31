import { NextFunction, Request, Response } from 'express';
import { ZodType } from 'zod';
import { ApiError } from './error';

// ── شیکاری body بە Zod ────────────────────────────────────────
export const zodBody =
  (schema: ZodType) => (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(new ApiError(422, 'داتای هەڵەیە', result.error.flatten().fieldErrors));
    }
    req.body = result.data;
    next();
  };

// ── شیکاری query بە Zod (بەبێ گۆڕینی req.query — تەنها لە controller-دا بەکار دێت) ─
export const zodQuery =
  (schema: ZodType) =>
  (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return next(new ApiError(422, 'پارامەتەر هەڵەیە', result.error.flatten().fieldErrors));
    }
    res.locals.query = result.data;
    next();
  };
