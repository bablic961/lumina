'use client';

import { create } from 'zustand';
import type { CallKind, PublicUser } from '@/types';

export type CallStatus = 'idle' | 'ringing' | 'incoming' | 'connecting' | 'active' | 'ended';

interface CallState {
  status: CallStatus;
  callId: string | null;
  chatId: string | null;
  kind: CallKind;
  peer: PublicUser | null;
  title: string | null;
  /** true when this client placed the call — it creates the offer. */
  initiator: boolean;
  participants: PublicUser[];
  muted: boolean;
  videoOff: boolean;
  screenSharing: boolean;
  blurBackground: boolean;
  quality: 'good' | 'fair' | 'poor';
  startedAt: number | null;
  recording: boolean;
  set: (patch: Partial<CallState>) => void;
  start: (input: { chatId: string; kind: CallKind; title: string; peer?: PublicUser | null }) => void;
  incoming: (input: { callId: string; chatId: string; kind: CallKind; title: string; peer?: PublicUser | null }) => void;
  reset: () => void;
}

const initial = {
  status: 'idle' as CallStatus,
  callId: null,
  chatId: null,
  kind: 'AUDIO' as CallKind,
  peer: null,
  title: null,
  initiator: false,
  participants: [] as PublicUser[],
  muted: false,
  videoOff: false,
  screenSharing: false,
  blurBackground: false,
  quality: 'good' as const,
  startedAt: null,
  recording: false,
};

export const useCallStore = create<CallState>((set) => ({
  ...initial,
  set: (patch) => set(patch),
  start: ({ chatId, kind, title, peer }) =>
    set({ ...initial, status: 'ringing', chatId, kind, title, peer: peer ?? null, initiator: true }),
  incoming: ({ callId, chatId, kind, title, peer }) =>
    set({ ...initial, status: 'incoming', callId, chatId, kind, title, peer: peer ?? null, initiator: false }),
  reset: () => set(initial),
}));
