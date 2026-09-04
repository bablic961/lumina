'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import type { Socket } from 'socket.io-client';
import { getSocket, disconnectSocket } from '@/lib/socket-client';
import { useChatStore } from '@/store/chat';
import { useCallStore } from '@/store/call';
import { useUi } from '@/store/ui';
import { playTone } from '@/lib/sound';
import { toast } from '@/store/toast';
import type { CallKind, MessageDTO, Presence, PublicUser } from '@/types';

interface SocketContextValue {
  socket: Socket | null;
  connected: boolean;
}

const SocketContext = createContext<SocketContextValue>({ socket: null, connected: false });
export const useSocketContext = () => useContext(SocketContext);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { status, data: session } = useSession();
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const store = useChatStore;
  const baseTitle = useRef('Lumina');

  useEffect(() => {
    if (status !== 'authenticated') return;
    const socket = getSocket();
    socketRef.current = socket;

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    const onReady = ({ online }: { online: string[] }) => {
      for (const id of online) store.getState().setPresence(id, 'ONLINE');
    };

    const onMessage = (message: MessageDTO & { clientId?: string }) => {
      const state = store.getState();
      state.upsertMessage(message);
      const mine = message.senderId === session?.user?.id;
      if (!mine) {
        if (useUi.getState().soundEnabled) playTone(useUi.getState().soundTone);
        if (message.chatId !== state.activeChatId) {
          const chat = state.chats.find((c) => c.id === message.chatId);
          state.patchChat(message.chatId, { unreadCount: (chat?.unreadCount ?? 0) + 1 });
        }
      }
    };

    const onEdited = (message: MessageDTO) => store.getState().upsertMessage(message);
    const onDeleted = ({ messageId, chatId, forAll }: { messageId: string; chatId: string; forAll: boolean }) =>
      store.getState().removeMessage(chatId, messageId, forAll);

    const onReaction = ({ messageId, summary }: { messageId: string; summary: never }) => {
      const state = store.getState();
      const chatId = Object.keys(state.messages).find((id) =>
        state.messages[id].some((m) => m.id === messageId),
      );
      if (chatId) state.setReactions(chatId, messageId, summary);
    };

    const onBurst = ({ messageId, emoji }: { messageId: string; emoji: string }) =>
      store.getState().fireBurst(messageId, emoji);

    const onTyping = ({ chatId, userId, name, isTyping }: { chatId: string; userId: string; name: string; isTyping: boolean }) => {
      if (userId === session?.user?.id) return;
      store.getState().setTyping(chatId, userId, name, isTyping);
    };

    const onPresence = ({ userId, presence }: { userId: string; presence: Presence }) =>
      store.getState().setPresence(userId, presence);

    const onRead = ({ chatId, messageId, userId }: { chatId: string; messageId: string; userId: string }) =>
      store.getState().markRead(chatId, messageId, userId);

    const onPinned = ({ messageId, pinned }: { messageId: string; pinned: boolean }) => {
      const state = store.getState();
      const chatId = Object.keys(state.messages).find((id) =>
        state.messages[id].some((m) => m.id === messageId),
      );
      if (chatId) state.setPinned(chatId, messageId, pinned);
    };

    const onIncomingCall = ({
      callId,
      chatId,
      kind,
      from,
    }: {
      callId: string;
      chatId: string;
      kind: CallKind;
      from: PublicUser;
    }) => {
      // Ignore a second invite while already busy — the ringing UI is single-slot.
      if (useCallStore.getState().status !== 'idle') return;
      useCallStore.getState().incoming({ callId, chatId, kind, title: from.name, peer: from });
      if (useUi.getState().soundEnabled) playTone('pulse');
    };

    const onNotification = (notification: { title: string; body?: string; importance: string }) => {
      if (document.visibilityState === 'visible') return;
      if (Notification.permission === 'granted') {
        new Notification(notification.title, {
          body: notification.body,
          icon: '/icons/icon-192.png',
          silent: notification.importance === 'LOW',
        });
      }
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('ready', onReady);
    socket.on('message:new', onMessage);
    socket.on('message:edited', onEdited);
    socket.on('message:deleted', onDeleted);
    socket.on('message:read', onRead);
    socket.on('message:pinned', onPinned);
    socket.on('reaction:updated', onReaction);
    socket.on('light:burst', onBurst);
    socket.on('typing:update', onTyping);
    socket.on('presence:update', onPresence);
    socket.on('presence:global', onPresence);
    socket.on('call:incoming', onIncomingCall);
    socket.on('notification:new', onNotification);
    socket.on('connect_error', (err) => {
      if (err.message === 'unauthorized') toast.error('Сессия истекла', 'Войдите заново');
    });

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('ready', onReady);
      socket.off('message:new', onMessage);
      socket.off('message:edited', onEdited);
      socket.off('message:deleted', onDeleted);
      socket.off('message:read', onRead);
      socket.off('message:pinned', onPinned);
      socket.off('reaction:updated', onReaction);
      socket.off('light:burst', onBurst);
      socket.off('typing:update', onTyping);
      socket.off('presence:update', onPresence);
      socket.off('presence:global', onPresence);
      socket.off('call:incoming', onIncomingCall);
      socket.off('notification:new', onNotification);
    };
  }, [status, session?.user?.id, store]);

  useEffect(() => {
    if (status === 'unauthenticated') disconnectSocket();
  }, [status]);

  // unread counter in the tab title
  const chats = useChatStore((s) => s.chats);
  useEffect(() => {
    const total = chats.reduce((sum, chat) => sum + (chat.unreadCount || 0), 0);
    document.title = total > 0 ? `(${total}) ${baseTitle.current}` : baseTitle.current;
  }, [chats]);

  const value = useMemo(() => ({ socket: socketRef.current, connected }), [connected]);
  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}
