import { PrismaClient } from '@prisma/client';

/**
 * The custom server (server.js) creates the client first and publishes it on
 * globalThis; route handlers reuse it so SQLite only ever sees one writer.
 */
const globalForPrisma = globalThis as unknown as { __luminaPrisma?: PrismaClient };

export const prisma =
  globalForPrisma.__luminaPrisma ??
  new PrismaClient({ log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'] });

if (!globalForPrisma.__luminaPrisma) globalForPrisma.__luminaPrisma = prisma;
