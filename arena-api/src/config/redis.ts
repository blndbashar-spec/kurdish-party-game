import Redis from 'ioredis';
import { env } from './env';

// Redis — بۆ خاڵەکان (scores)، دۆخی ژوورەکان و کاش
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  retryStrategy(times) {
    return Math.min(times * 500, 5000);
  },
});

redis.on('error', (err) => {
  console.error('🔴 Redis error:', err.message);
});
redis.on('ready', () => {
  console.log('🟢 Redis ئامادەیە');
});
