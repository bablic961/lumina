'use client';

import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;

/**
 * One shared connection per tab. The session cookie authenticates the
 * handshake, so there is no token to pass in.
 */
export function getSocket(): Socket {
  if (!socket) {
    socket = io({
      path: '/api/socket',
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnectionDelay: 500,
      reconnectionDelayMax: 4000,
    });
  }
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
