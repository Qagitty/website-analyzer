import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
});

const LIMITS: Record<string, number> = {
  free: 10,      // 10 req/day
  pro: 100,      // 100 req/day
  agency: 1000,  // 1000 req/day
};

export async function checkRateLimit(
  keyId: string,
  plan: string
): Promise<{ allowed: boolean; remaining: number; limit: number }> {
  const limit = LIMITS[plan] ?? 10;
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const redisKey = `api_rate:${keyId}:${today}`;

  const count = await redis.incr(redisKey);
  if (count === 1) {
    // Set TTL to 25 hours (buffer for timezone edge cases)
    await redis.expire(redisKey, 90000);
  }

  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    limit,
  };
}
