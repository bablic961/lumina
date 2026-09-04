'use client';

import { useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { encryptFor } from '@/lib/e2e';
import { useChatStore } from '@/store/chat';
import { toast } from '@/store/toast';
import { useSocketContext } from '@/components/providers/SocketProvider';
import type { AttachmentDTO, ContentType, MessageDTO, PublicUser } from '@/types';

export interface SendInput {
  content?: string;
  contentType?: ContentType;
  codeLanguage?: string | null;
  files?: File[];
  voice?: { blob: Blob; duration: number; waveform: number[] };
  stickerId?: string;
  lat?: number;
  lng?: number;
  locationName?: string;
  selfDestructSec?: number | null;
}

/** What `/api/upload` returns per file: everything except the database-side fields. */
type UploadedFile = Omit<AttachmentDTO, 'id' | 'duration' | 'waveform' | 'ocrText'>;

const ERRORS: Record<string, string> = {
  rate_limited: 'Слишком много сообщений — подождите пару секунд',
  not_a_member: 'Вы не участник этого чата',
  read_only: 'Писать могут только администраторы',
  slow_mode: 'Включён медленный режим',
  blocked: 'Отправка невозможна: пользователь заблокирован',
  empty: 'Пустое сообщение',
  server_error: 'Не удалось отправить сообщение',
};

/** Optimistic send: the bubble appears instantly, the ack confirms or marks it failed. */
export function useSend(chatId: string | null, me: PublicUser | null) {
  const { socket } = useSocketContext();
  const { upsertMessage, replaceMessage, markFailed, replyTo, setReplyTo, forwarding, setForwarding, chats } =
    useChatStore();
  const typingSentAt = useRef(0);

  const uploadFiles = useCallback(async (files: File[]): Promise<AttachmentDTO[]> => {
    const form = new FormData();
    files.forEach((f) => form.append('files', f));
    // The route answers with StoredFile rows under `files`; real ids appear only
    // when the message — and with it the Attachment row — is written.
    const { files: stored } = await api.post<{ files: UploadedFile[] }>('/api/upload', form);
    return stored.map((file, index) => ({
      ...file,
      id: `up_${Date.now()}_${index}`,
      duration: null,
      waveform: null,
      ocrText: null,
    }));
  }, []);

  const send = useCallback(
    async (input: SendInput) => {
      if (!chatId || !socket || !me) return;
      const chat = chats.find((c) => c.id === chatId);
      const clientId = `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const contentType = input.contentType ?? (input.voice ? 'VOICE' : input.files?.length ? 'FILE' : 'TEXT');

      const optimistic: MessageDTO = {
        id: clientId,
        chatId,
        senderId: me.id,
        content: input.content ?? '',
        contentType,
        codeLanguage: input.codeLanguage ?? null,
        lat: input.lat ?? null,
        lng: input.lng ?? null,
        locationName: input.locationName ?? null,
        replyToId: replyTo?.id ?? null,
        forwardedFromId: forwarding?.id ?? null,
        editedAt: null,
        deletedAt: null,
        deletedForAll: false,
        isPinned: false,
        selfDestructSec: input.selfDestructSec ?? null,
        expiresAt: null,
        createdAt: new Date().toISOString(),
        sender: me,
        attachments: [],
        reactionSummary: [],
        replyTo: replyTo
          ? { id: replyTo.id, content: replyTo.content, contentType: replyTo.contentType, sender: replyTo.sender }
          : null,
        forwardedFrom: forwarding
          ? { id: forwarding.id, content: forwarding.content, sender: forwarding.sender }
          : null,
        clientId,
        pending: true,
      };
      upsertMessage(optimistic);
      setReplyTo(null);
      setForwarding(null);

      try {
        let attachments: AttachmentDTO[] = [];
        if (input.voice) {
          const file = new File([input.voice.blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
          const uploaded = await uploadFiles([file]);
          attachments = uploaded.map((a) => ({
            ...a,
            kind: 'VOICE',
            duration: input.voice!.duration,
            waveform: JSON.stringify(input.voice!.waveform),
          }));
        } else if (input.files?.length) {
          attachments = await uploadFiles(input.files);
        }

        // Optional end-to-end layer for direct messages that opted in.
        let content = input.content ?? '';
        if (content && chat?.e2eEnabled && chat.type === 'DM' && chat.peer?.id) {
          const peerKey = await api
            .get<{ publicKey: string | null }>(`/api/users/${chat.peer.id}/key`)
            .then((r) => r.publicKey)
            .catch(() => null);
          if (peerKey) content = await encryptFor(peerKey, content);
        }

        socket.emit(
          'message:send',
          {
            chatId,
            content,
            contentType,
            codeLanguage: input.codeLanguage,
            replyToId: optimistic.replyToId,
            forwardedFromId: optimistic.forwardedFromId,
            stickerId: input.stickerId,
            attachments: attachments.map((a) => ({
              ...a,
              waveform: a.waveform ? JSON.parse(a.waveform as string) : null,
            })),
            selfDestructSec: input.selfDestructSec,
            lat: input.lat,
            lng: input.lng,
            locationName: input.locationName,
            clientId,
          },
          (res: { ok?: boolean; message?: MessageDTO; error?: string; reason?: string }) => {
            if (res?.ok && res.message) replaceMessage(chatId, clientId, res.message);
            else {
              markFailed(chatId, clientId);
              // `reason` carries the server's exact wording (how long the limit lasts).
              toast.error(res?.reason ?? ERRORS[res?.error ?? 'server_error'] ?? 'Не удалось отправить');
            }
          },
        );
      } catch (err) {
        markFailed(chatId, clientId);
        toast.error(err instanceof Error ? err.message : 'Не удалось отправить');
      }
    },
    [chatId, socket, me, chats, replyTo, forwarding, upsertMessage, setReplyTo, setForwarding, uploadFiles, replaceMessage, markFailed],
  );

  const emitTyping = useCallback(
    (isTyping: boolean) => {
      if (!chatId || !socket) return;
      const now = Date.now();
      if (isTyping && now - typingSentAt.current < 2500) return;
      typingSentAt.current = now;
      socket.emit('typing', { chatId, isTyping });
    },
    [chatId, socket],
  );

  const saveDraft = useCallback(
    (text: string) => {
      if (!chatId || !socket) return;
      socket.emit('draft:save', { chatId, draft: text });
    },
    [chatId, socket],
  );

  return { send, emitTyping, saveDraft, uploadFiles };
}
