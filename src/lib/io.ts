import type { Server } from 'socket.io';

/**
 * Access to the live Socket.io server from inside Next route handlers.
 * Present because both run in the same process (see server.js). Returns null
 * when the app is started with `next start` instead of the custom server, so
 * callers must treat real-time delivery as best-effort.
 */
export function getIo(): Server | null {
  return (globalThis as unknown as { __luminaIo?: Server }).__luminaIo ?? null;
}

export function emitToChat(chatId: string, event: string, payload: unknown) {
  getIo()?.to(`chat:${chatId}`).emit(event, payload);
}

export function emitToUser(userId: string, event: string, payload: unknown) {
  getIo()?.to(`user:${userId}`).emit(event, payload);
}
