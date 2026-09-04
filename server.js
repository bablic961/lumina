/**
 * Lumina custom server.
 *
 * Next.js handles HTTP/SSR; Socket.io shares the same port for real-time
 * traffic (messages, presence, typing, WebRTC signalling). A single
 * PrismaClient is created here and published on globalThis so that both the
 * socket layer (CJS, below) and the Next route handlers (src/lib/prisma.ts)
 * talk to the same connection pool — important for SQLite, which does not
 * like two writers.
 */
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const { PrismaClient } = require('@prisma/client');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || 'localhost';
const port = Number(process.env.PORT || 3000);

const prisma = globalThis.__luminaPrisma || new PrismaClient();
globalThis.__luminaPrisma = prisma;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

async function bootstrapDatabase() {
  if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.startsWith('file:')) return;
  try {
    // WAL keeps readers unblocked while the socket layer writes.
    // Both pragmas answer with a row (the resulting mode / timeout), so both go
    // through queryRaw — executeRaw rejects statements that return results.
    await prisma.$queryRawUnsafe('PRAGMA journal_mode=WAL;');
    await prisma.$queryRawUnsafe('PRAGMA busy_timeout=5000;');
  } catch (err) {
    console.warn('[lumina] sqlite pragma setup skipped:', err.message);
  }
}

app.prepare().then(async () => {
  await bootstrapDatabase();

  const httpServer = createServer((req, res) => {
    handle(req, res, parse(req.url, true));
  });

  const io = new Server(httpServer, {
    path: '/api/socket',
    cors: { origin: process.env.NEXTAUTH_URL || true, credentials: true },
    maxHttpBufferSize: 5e6,
    pingTimeout: 25000,
  });

  // Route handlers reach the live socket server through this handle.
  globalThis.__luminaIo = io;

  require('./server/io')(io, prisma);
  require('./server/sweeper')(io, prisma);

  httpServer.listen(port, () => {
    console.log(`\n  ✦ Lumina ready on http://${hostname}:${port}`);
    console.log(`  ✦ websocket path /api/socket  ·  mode ${dev ? 'development' : 'production'}\n`);
  });

  const shutdown = async (signal) => {
    console.log(`\n[lumina] ${signal} — shutting down`);
    io.close();
    httpServer.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
});
