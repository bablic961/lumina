/**
 * Small portability shims for the two databases this app runs on.
 *
 * SQLite is the local default; PostgreSQL is what a deployment uses. Prisma
 * differs in one place that matters here: `contains` is already
 * case-insensitive for ASCII on SQLite and rejects `mode`, while PostgreSQL
 * needs the flag spelled out — and needs it for Cyrillic to match at all.
 */
export const isPostgres = /^postgres(ql)?:/.test(process.env.DATABASE_URL || '');

/** Spread into any `contains` / `startsWith` filter that should ignore case. */
export const INSENSITIVE = isPostgres ? ({ mode: 'insensitive' } as const) : {};
