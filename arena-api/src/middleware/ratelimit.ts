import rateLimit from 'express-rate-limit';

// ── ڕێژەی گشتی: ١٠٠ داواکاری / ١٥ خولەک / IP ──────────────────
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'زۆر داواکاری — چاوەڕێ بکە و دووبارە هەوڵبدەرەوە' },
});

// ── ڕێژەی auth: ١٠ داواکاری / خولەک / IP (دژایەتی brute-force) ─
export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.AUTH_RATE_LIMIT ?? 10),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'زۆر هەوڵ — دوای خولەکێک هەوڵبدەرەوە' },
});
