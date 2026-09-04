// Hand-written declarations: the implementation is CommonJS because the socket
// layer requires it directly, while the Next side imports it through webpack.

export type RateLimitKey =
  | 'message.send'
  | 'integrations.ai'
  | 'upload'
  | 'invite.create'
  | 'story.create';

export type RateLimitVerdict = { ok: true } | { ok: false; retryAfterSec: number; message: string };

/** Only the slice of PrismaClient this module touches. */
type RuleReader = {
  rateLimitRule: { findUnique(args: { where: { key: string } }): Promise<{ limit: number; windowSec: number } | null> };
};

export const RATE_LIMIT_DEFAULTS: Record<
  RateLimitKey,
  { limit: number; windowSec: number; label: string; tooMany: string }
>;
export function checkRateLimit(key: RateLimitKey, userId: string, prisma: RuleReader): Promise<RateLimitVerdict>;
export function invalidateRateLimitRule(key: RateLimitKey): void;
export function formatRetry(ms: number): string;
