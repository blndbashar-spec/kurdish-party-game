import { NextFunction, Request, Response } from 'express';

// هەڵەیەکی بۆزنراو — لە هەر شوێنێک throw دەکرێت
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const notFound = (_req: Request, res: Response) => {
  res.status(404).json({ error: 'ئەم ڕێچکەیە نەدۆزرایەوە' });
};

// هەڵەیەکی گشتی کۆتایی — هەموو هەڵەکان لێرە کۆدەکرێنەوە
export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  if (err instanceof Error) {
    if (err.message.includes('CORS')) {
      return res.status(403).json({ error: 'ڕەچاوکردنی CORS: ئەم origin یە ڕێگەپێدراو نییە' });
    }
    console.error('💥', err);
  }
  res.status(500).json({ error: 'هەڵەیەکی ناوەکی ڕوویدا' });
};
