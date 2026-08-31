import { NextFunction, Request, Response } from 'express';

// ڕوونی هەڵە لە controller ی async بۆ error middleware ڕادەگوازێت
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
