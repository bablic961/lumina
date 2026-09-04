'use client';

import { create } from 'zustand';
import type { ChatListItemDTO, MessageDTO, Presence, ReactionSummary } from '@/types';

interface TypingEntry {
  name: string;
  at: number;
}

interface ChatState {
  chats: ChatListItemDTO[];
  messages: Record<string, MessageDTO[]>;
  hasMore: Record<string, boolean>;
  typing: Record<string, Record<string, TypingEntry>>;
  presence: Record<string, Presence>;
  activeChatId: string | null;
  replyTo: MessageDTO | null;
  editing: MessageDTO | null;
  forwarding: MessageDTO | null;
  burst: { messageId: string; emoji: string; key: number } | null;

  setChats: (chats: ChatListItemDTO[]) => void;
  patchChat: (chatId: string, patch: Partial<ChatListItemDTO>) => void;
  setActive: (chatId: string | null) => void;
  setMessages: (chatId: string, messages: MessageDTO[], hasMore: boolean) => void;
  prependMessages: (chatId: string, messages: MessageDTO[], hasMore: boolean) => void;
  upsertMessage: (message: MessageDTO) => void;
  replaceMessage: (chatId: string, clientId: string, message: MessageDTO) => void;
  markFailed: (chatId: string, clientId: string) => void;
  removeMessage: (chatId: string, messageId: string, forAll: boolean) => void;
  setReactions: (chatId: string, messageId: string, summary: ReactionSummary[]) => void;
  setPinned: (chatId: string, messageId: string, pinned: boolean) => void;
  markRead: (chatId: string, messageId: string, userId: string) => void;
  setTyping: (chatId: string, userId: string, name: string, isTyping: boolean) => void;
  setPresence: (userId: string, presence: Presence) => void;
  setReplyTo: (message: MessageDTO | null) => void;
  setEditing: (message: MessageDTO | null) => void;
  setForwarding: (message: MessageDTO | null) => void;
  fireBurst: (messageId: string, emoji: string) => void;
}

const byTime = (a: MessageDTO, b: MessageDTO) =>
  new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();

export const useChatStore = create<ChatState>((set, get) => ({
  chats: [],
  messages: {},
  hasMore: {},
  typing: {},
  presence: {},
  activeChatId: null,
  replyTo: null,
  editing: null,
  forwarding: null,
  burst: null,

  setChats: (chats) => set({ chats }),
  patchChat: (chatId, patch) =>
    set({ chats: get().chats.map((c) => (c.id === chatId ? { ...c, ...patch } : c)) }),
  setActive: (chatId) => set({ activeChatId: chatId, replyTo: null, editing: null }),

  setMessages: (chatId, messages, hasMore) =>
    set({
      messages: { ...get().messages, [chatId]: [...messages].sort(byTime) },
      hasMore: { ...get().hasMore, [chatId]: hasMore },
    }),

  prependMessages: (chatId, older, hasMore) => {
    const current = get().messages[chatId] ?? [];
    const seen = new Set(current.map((m) => m.id));
    const merged = [...older.filter((m) => !seen.has(m.id)), ...current].sort(byTime);
    set({
      messages: { ...get().messages, [chatId]: merged },
      hasMore: { ...get().hasMore, [chatId]: hasMore },
    });
  },

  upsertMessage: (message) => {
    const list = get().messages[message.chatId] ?? [];
    const idx = list.findIndex(
      (m) => m.id === message.id || (message.clientId && m.clientId === message.clientId),
    );
    const next = idx >= 0 ? list.map((m, i) => (i === idx ? { ...m, ...message, pending: false } : m)) : [...list, message];
    set({ messages: { ...get().messages, [message.chatId]: next.sort(byTime) } });

    const chat = get().chats.find((c) => c.id === message.chatId);
    if (chat) {
      get().patchChat(message.chatId, {
        lastMessageAt: message.createdAt,
        lastMessage: {
          id: message.id,
          content: message.content,
          contentType: message.contentType,
          createdAt: message.createdAt,
          senderId: message.senderId,
          senderName: message.sender?.name ?? null,
          deletedForAll: false,
        },
      });
    }
  },

  replaceMessage: (chatId, clientId, message) =>
    set({
      messages: {
        ...get().messages,
        [chatId]: (get().messages[chatId] ?? [])
          .map((m) => (m.clientId === clientId ? { ...message, pending: false } : m))
          .sort(byTime),
      },
    }),

  markFailed: (chatId, clientId) =>
    set({
      messages: {
        ...get().messages,
        [chatId]: (get().messages[chatId] ?? []).map((m) =>
          m.clientId === clientId ? { ...m, pending: false, failed: true } : m,
        ),
      },
    }),

  removeMessage: (chatId, messageId, forAll) =>
    set({
      messages: {
        ...get().messages,
        [chatId]: (get().messages[chatId] ?? []).flatMap((m) => {
          if (m.id !== messageId) return [m];
          return forAll
            ? [{ ...m, deletedAt: new Date().toISOString(), deletedForAll: true, content: '', attachments: [] }]
            : [];
        }),
      },
    }),

  setReactions: (chatId, messageId, summary) =>
    set({
      messages: {
        ...get().messages,
        [chatId]: (get().messages[chatId] ?? []).map((m) =>
          m.id === messageId ? { ...m, reactionSummary: summary } : m,
        ),
      },
    }),

  setPinned: (chatId, messageId, pinned) =>
    set({
      messages: {
        ...get().messages,
        [chatId]: (get().messages[chatId] ?? []).map((m) => (m.id === messageId ? { ...m, isPinned: pinned } : m)),
      },
    }),

  markRead: (chatId, messageId, userId) =>
    set({
      messages: {
        ...get().messages,
        [chatId]: (get().messages[chatId] ?? []).map((m) => {
          if (m.id !== messageId) return m;
          const reads = m.reads ?? [];
          if (reads.some((r) => r.userId === userId)) return m;
          return { ...m, reads: [...reads, { userId, readAt: new Date().toISOString() }] };
        }),
      },
    }),

  setTyping: (chatId, userId, name, isTyping) => {
    const chatTyping = { ...(get().typing[chatId] ?? {}) };
    if (isTyping) chatTyping[userId] = { name, at: Date.now() };
    else delete chatTyping[userId];
    set({ typing: { ...get().typing, [chatId]: chatTyping } });
  },

  setPresence: (userId, presence) => set({ presence: { ...get().presence, [userId]: presence } }),
  setReplyTo: (message) => set({ replyTo: message, editing: null }),
  setEditing: (message) => set({ editing: message, replyTo: null }),
  setForwarding: (message) => set({ forwarding: message }),
  fireBurst: (messageId, emoji) => set({ burst: { messageId, emoji, key: Date.now() } }),
}));
