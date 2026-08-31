import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface JwtPayload {
  sub: string;
  username: string;
  role: string;
}

// توکنی access — کورت‌مەودا (١٥ خولەک بە بنەڕەت)
export function signAccessToken(user: JwtPayload): string {
  return jwt.sign(
    { username: user.username, role: user.role },
    env.JWT_SECRET,
    {
      subject: user.sub,
      expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    },
  );
}

export function verifyAccessToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload & {
    username: string;
    role: string;
  };
  if (!decoded.sub) throw new Error('invalid token payload');
  return { sub: decoded.sub, username: decoded.username, role: decoded.role };
}
