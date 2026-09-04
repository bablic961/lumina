'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useChatStore } from '@/store/chat';
import { useSocketContext } from '@/components/providers/SocketProvider';
import type { ChatListItemDTO } from '@/types';

/** Loads the chat list and keeps it in sync with socket events. */
export function useChats() {
  const setChats = useChatStore((s) => s.setChats);
  const { socket } = useSocketContext();

  const query = useQuery({
    queryKey: ['chats'],
    queryFn: () => api.get<{ chats: ChatListItemDTO[] }>('/api/chats'),
    refetchInterval: 90_000,
  });

  useEffect(() => {
    if (query.data?.chats) setChats(query.data.chats);
  }, [query.data, setChats]);

  useEffect(() => {
    if (!socket) return;
    const refetch = () => query.refetch();
    socket.on('chat:created', refetch);
    socket.on('chat:deleted', refetch);
    socket.on('chat:bump', refetch);
    socket.on('chat:member-left', refetch);
    return () => {
      socket.off('chat:created', refetch);
      socket.off('chat:deleted', refetch);
      socket.off('chat:bump', refetch);
      socket.off('chat:member-left', refetch);
    };
  }, [socket, query]);

  return query;
}
