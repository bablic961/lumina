import { checkRateLimit } from '../../server/rate-limit.js';
import { HttpError } from '@/lib/guards';
import { prisma } from '@/lib/prisma';

export { RATE_LIMIT_DEFAULTS, invalidateRateLimitRule } from '../../server/rate-limit.js';
export type { RateLimitKey } from '../../server/rate-limit.js';

import type { RateLimitKey } from '../../server/rate-limit.js';

/**
 * Route-side wrapper around the shared limiter: a spent budget becomes a 429
 * carrying Retry-After, so a client can back off instead of hammering.
 */
export async function consumeRateLimit(key: RateLimitKey, userId: string) {
  const verdict = await checkRateLimit(key, userId, prisma);
  if (!verdict.ok) throw new HttpError(429, verdict.message, verdict.retryAfterSec);
}
