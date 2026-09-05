'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Calculator,
  Flame,
  Image as ImageIcon,
  MapPin,
  Mic,
  Paperclip,
  Send,
  Smile,
  Sparkles,
  Sticker,
  Vote,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn, debounce, tryCalculate } from '@/lib/utils';
import { useChatStore } from '@/store/chat';
import { warmOcr } from '@/lib/ocr';
import { toast } from '@/store/toast';
import { useMe } from '@/components/providers/MeProvider';
import { useSocketContext } from '@/components/providers/SocketProvider';
import { useSend } from '@/hooks/useSend';
import { EmojiPicker } from '@/components/chat/EmojiPicker';
import { VoiceRecorder } from '@/components/chat/VoiceRecorder';
import { PollComposer } from '@/components/chat/PollComposer';
import { StickerPicker } from '@/components/chat/StickerPicker';
import { AttachmentTray } from '@/components/chat/AttachmentTray';
import type { ChatDetailDTO, MemberRole } from '@/types';

const DESTRUCT_OPTIONS = [
  { label: 'выкл', value: null },
  { label: '5 с', value: 5 },
  { label: '30 с', value: 30 },
  { label: '5 мин', value: 300 },
  { label: '1 ч', value: 3600 },
  { label: '1 д', value: 86_400 },
  { label: '1 нед', value: 604_800 },
];

const COMMANDS = [
  { cmd: '/weather', hint: 'погода в городе', usage: '/weather Москва' },
  { cmd: '/poll', hint: 'создать опрос', usage: '/poll Вопрос | Вариант 1 | Вариант 2' },
  { cmd: '/giphy', hint: 'найти GIF', usage: '/giphy котики' },
  { cmd: '/translate', hint: 'перевести текст', usage: '/translate en Привет' },
  { cmd: '/ai', hint: 'спросить ассистента Lumina', usage: '/ai объясни промисы' },
  { cmd: '/code', hint: 'отправить блок кода', usage: '/code ts const a = 1' },
  { cmd: '/shrug', hint: 'вставить ¯\_(ツ)_/¯', usage: '/shrug' },
  { cmd: '/me', hint: 'действие от третьего лица', usage: '/me пьёт кофе' },
];

export function Composer({
  chatId,
  chat,
  myRole,
  draft,
}: {
  chatId: string;
  chat?: ChatDetailDTO;
  myRole?: MemberRole;
  draft: string | null;
}) {
  const { me } = useMe();
  const { socket } = useSocketContext();
  const { send, emitTyping, saveDraft } = useSend(chatId, me);
  const { replyTo, setReplyTo, editing, setEditing, forwarding, setForwarding, messages } = useChatStore();
  const socketEditing = editing?.chatId === chatId ? editing : null;

  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [stickerOpen, setStickerOpen] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [destruct, setDestruct] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const readOnly =
    (chat?.type === 'CHANNEL' || chat?.onlyAdminsCanPost) &&
    !['OWNER', 'ADMIN', 'MODERATOR'].includes(myRole ?? 'MEMBER');

  // Restore the server-side draft when the chat opens.
  useEffect(() => {
    setText(draft ?? '');
    setFiles([]);
    setDestruct(null);
  }, [chatId, draft]);

  useEffect(() => {
    if (socketEditing) {
      setText(socketEditing.content);
      area.current?.focus();
    }
  }, [socketEditing]);

  // Auto-grow up to ~9 rows.
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 210)}px`;
  }, [text]);

  const persistDraft = useMemo(() => debounce((value: string) => saveDraft(value), 700), [saveDraft]);

  const calculated = useMemo(() => (text.startsWith('=') ? tryCalculate(text.slice(1)) : null), [text]);

  const slashMatch = useMemo(() => {
    if (!/^\/[a-z]*$/i.test(text)) return [];
    return COMMANDS.filter((c) => c.cmd.startsWith(text.toLowerCase()));
  }, [text]);

  /** Suggestions built from the last incoming message — no round trip needed. */
  const smartReplies = useMemo(() => {
    if (text || files.length) return [];
    const list = messages[chatId] ?? [];
    const last = list[list.length - 1];
    if (!last || last.senderId === me.id || last.contentType !== 'TEXT') return [];
    const content = last.content.toLowerCase();
    if (/\?$/.test(content.trim())) return ['Да', 'Нет', 'Сейчас проверю'];
    if (/спасибо|благодар/.test(content)) return ['Пожалуйста! 🙌', 'Обращайся', '✨'];
    if (/привет|здравств|хай/.test(content)) return ['Привет! 👋', 'Здравствуйте', 'Рад видеть'];
    if (/когда|во сколько/.test(content)) return ['Через 5 минут', 'Сегодня', 'Давай завтра'];
    if (/созвон|звонок|call/.test(content)) return ['Давай созвонимся', 'Через 10 минут', 'Не сейчас'];
    return ['Хорошо 👍', 'Понял', 'Спасибо!'];
  }, [text, files.length, messages, chatId, me.id]);

  const runCommand = useCallback(
    async (raw: string): Promise<boolean> => {
      const [command, ...rest] = raw.trim().split(/\s+/);
      const argument = rest.join(' ');

      switch (command.toLowerCase()) {
        case '/shrug':
          await send({ content: `${argument} ¯\_(ツ)_/¯`.trim() });
          return true;
        case '/me':
          await send({ content: `__${me.name} ${argument}__` });
          return true;
        case '/code': {
          const [language, ...code] = rest;
          await send({ content: code.join(' '), contentType: 'CODE', codeLanguage: language || null });
          return true;
        }
        case '/poll': {
          const [question, ...options] = argument.split('|').map((s) => s.trim());
          if (!question || options.length < 2) {
            toast.error('Формат: /poll Вопрос | Вариант 1 | Вариант 2');
            return true;
          }
          await api.post(`/api/chats/${chatId}/poll`, { question, options });
          return true;
        }
        case '/weather': {
          const data = await api
            .get<{ text: string }>(`/api/integrations/weather?q=${encodeURIComponent(argument)}`)
            .catch(() => null);
          if (!data) {
            toast.error('Сервис погоды недоступен');
            return true;
          }
          await send({ content: data.text });
          return true;
        }
        case '/translate': {
          const [target, ...words] = rest;
          const data = await api
            .post<{ text: string }>('/api/integrations/translate', { target, text: words.join(' ') })
            .catch(() => null);
          if (!data) {
            toast.error('Переводчик недоступен');
            return true;
          }
          await send({ content: data.text });
          return true;
        }
        case '/giphy': {
          const data = await api
            .get<{ url: string | null }>(`/api/integrations/giphy?q=${encodeURIComponent(argument)}`)
            .catch(() => null);
          if (!data?.url) {
            toast.error('GIF не найден');
            return true;
          }
          await send({ content: data.url });
          return true;
        }
        case '/ai': {
          await send({ content: argument });
          const data = await api
            .post<{ text: string }>('/api/integrations/ai', { chatId, prompt: argument })
            .catch(() => null);
          if (data?.text) await send({ content: `🤖 ${data.text}` });
          return true;
        }
        default:
          return false;
      }
    },
    [chatId, me.name, send],
  );

  const submit = useCallback(async () => {
    if (readOnly || busy) return;
    const value = text.trim();
    if (!value && files.length === 0) return;

    setBusy(true);
    try {
      if (socketEditing) {
        socket?.emit('message:edit', { messageId: socketEditing.id, content: value });
        setEditing(null);
        setText('');
        return;
      }

      if (value.startsWith('/') && (await runCommand(value))) {
        setText('');
        saveDraft('');
        return;
      }

      const content = calculated ? `${text.slice(1).trim()} = ${calculated}` : value;
      await send({
        content,
        files: files.length ? files : undefined,
        selfDestructSec: destruct,
      });
      setText('');
      setFiles([]);
      saveDraft('');
      emitTyping(false);
    } finally {
      setBusy(false);
    }
  }, [readOnly, busy, text, files, socketEditing, socket, runCommand, calculated, send, destruct, saveDraft, emitTyping, setEditing]);

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void submit();
      return;
    }
    if (e.key === 'Escape') {
      setEditing(null);
      setReplyTo(null);
      setForwarding(null);
    }
    if (e.key === 'ArrowUp' && !text) {
      const mine = (messages[chatId] ?? []).filter((m) => m.senderId === me.id && m.contentType === 'TEXT');
      const last = mine[mine.length - 1];
      if (last) setEditing(last);
    }
  }

  function addFiles(incoming: FileList | File[] | null) {
    if (!incoming) return;
    const list = Array.from(incoming).slice(0, 10 - files.length);
    if (list.length === 0) return;
    setFiles((prev) => [...prev, ...list]);
    // Starts the Tesseract download now, while the user is still typing, so
    // recognition is usually ready by the time they press send.
    warmOcr(list);
  }

  async function shareLocation() {
    if (!navigator.geolocation) return toast.error('Геолокация недоступна');
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        await send({
          contentType: 'LOCATION',
          lat: coords.latitude,
          lng: coords.longitude,
          locationName: `Моё местоположение (±${Math.round(coords.accuracy)} м)`,
        });
      },
      () => toast.error('Не удалось определить местоположение'),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  if (readOnly) {
    return (
      <div className="glass-strong shrink-0 border-t border-hairline px-4 py-3 text-center text-xs font-semibold text-ink-soft">
        В этом {chat?.type === 'CHANNEL' ? 'канале' : 'чате'} писать могут только администраторы
      </div>
    );
  }

  return (
    <div
      className={cn(
        'glass-strong relative shrink-0 border-t border-hairline px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 sm:px-3',
        dragging && 'ring-2 ring-inset ring-accent-from/60',
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        addFiles(e.dataTransfer.files);
      }}
    >
      {dragging ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-t-3xl bg-accent/10 backdrop-blur-sm">
          <span className="glass flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-bold text-accent">
            <ImageIcon className="h-4 w-4" aria-hidden /> Отпустите, чтобы прикрепить
          </span>
        </div>
      ) : null}

      {(replyTo || socketEditing || forwarding) && (
        <div className="mb-1.5 flex items-center gap-2 rounded-2xl border-s-2 border-accent-from bg-accent/10 px-2.5 py-1.5">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold text-accent">
              {socketEditing ? 'Изменение сообщения' : forwarding ? 'Пересылка' : `Ответ ${replyTo?.sender?.name ?? ''}`}
            </p>
            <p className="truncate text-xs text-ink-soft">
              {(socketEditing ?? forwarding ?? replyTo)?.content || '[вложение]'}
            </p>
          </div>
          <button
            onClick={() => {
              setEditing(null);
              setReplyTo(null);
              setForwarding(null);
              if (socketEditing) setText('');
            }}
            className="press flex h-7 w-7 items-center justify-center rounded-lg text-ink-faint hover:bg-glass/70"
            aria-label="Отменить"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}

      {files.length > 0 ? (
        <AttachmentTray files={files} onRemove={(i) => setFiles((prev) => prev.filter((_, idx) => idx !== i))} />
      ) : null}

      {slashMatch.length > 0 ? (
        <div className="glass mb-1.5 overflow-hidden rounded-2xl">
          {slashMatch.map((c) => (
            <button
              key={c.cmd}
              onClick={() => setText(`${c.cmd} `)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-start text-xs hover:bg-accent/10"
            >
              <span className="font-mono font-bold text-accent">{c.cmd}</span>
              <span className="text-ink-soft">{c.hint}</span>
              <span className="ms-auto hidden font-mono text-[10px] text-ink-faint sm:block">{c.usage}</span>
            </button>
          ))}
        </div>
      ) : null}

      {smartReplies.length > 0 ? (
        <div className="scrollbar-none mb-1.5 flex gap-1.5 overflow-x-auto">
          <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-ink-faint">
            <Sparkles className="h-3 w-3 text-accent" aria-hidden />
          </span>
          {smartReplies.map((reply) => (
            <button
              key={reply}
              onClick={() => send({ content: reply })}
              className="press glass shrink-0 rounded-xl px-2.5 py-1 text-xs font-semibold text-ink-soft hover:text-accent"
            >
              {reply}
            </button>
          ))}
        </div>
      ) : null}

      {recording ? (
        <div className="flex items-center gap-2 pb-1">
          <VoiceRecorder
            onCancel={() => setRecording(false)}
            onSend={(payload) => {
              setRecording(false);
              void send({ voice: payload, selfDestructSec: destruct });
            }}
          />
        </div>
      ) : (
        <div className="flex items-end gap-1.5">
          <input
            ref={fileInput}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = '';
            }}
          />

          <div className="flex shrink-0 items-center">
            <button
              onClick={() => fileInput.current?.click()}
              className="press flex h-10 w-10 items-center justify-center rounded-xl text-ink-soft transition hover:bg-glass/70 hover:text-accent"
              aria-label="Прикрепить файл"
            >
              <Paperclip className="h-5 w-5" aria-hidden />
            </button>
            <button
              onClick={() => setPollOpen(true)}
              className="press hidden h-10 w-10 items-center justify-center rounded-xl text-ink-soft transition hover:bg-glass/70 hover:text-accent sm:flex"
              aria-label="Создать опрос"
            >
              <Vote className="h-5 w-5" aria-hidden />
            </button>
            <button
              onClick={shareLocation}
              className="press hidden h-10 w-10 items-center justify-center rounded-xl text-ink-soft transition hover:bg-glass/70 hover:text-accent sm:flex"
              aria-label="Отправить геолокацию"
            >
              <MapPin className="h-5 w-5" aria-hidden />
            </button>
          </div>

          <div className="relative flex min-w-0 flex-1 items-end rounded-3xl bg-glass/70 px-2 py-1 ring-1 ring-inset ring-hairline transition focus-within:ring-accent-from/50">
            <textarea
              ref={area}
              value={text}
              rows={1}
              onChange={(e) => {
                setText(e.target.value);
                emitTyping(e.target.value.length > 0);
                persistDraft(e.target.value);
              }}
              onKeyDown={onKeyDown}
              onBlur={() => emitTyping(false)}
              onPaste={(e) => {
                const pasted = Array.from(e.clipboardData.files);
                if (pasted.length) {
                  e.preventDefault();
                  addFiles(pasted);
                }
              }}
              placeholder={socketEditing ? 'Измените сообщение…' : 'Сообщение… ( / — команды, = — калькулятор )'}
              aria-label="Текст сообщения"
              className="scrollbar-none max-h-52 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-relaxed outline-none placeholder:text-ink-faint"
            />

            {calculated ? (
              <span className="mb-2 flex shrink-0 items-center gap-1 rounded-xl bg-accent/15 px-2 py-0.5 font-mono text-xs font-bold text-accent">
                <Calculator className="h-3 w-3" aria-hidden />= {calculated}
              </span>
            ) : null}

            <div className="flex shrink-0 items-center">
              <button
                onClick={() => setStickerOpen((v) => !v)}
                className="press flex h-9 w-9 items-center justify-center rounded-xl text-ink-soft transition hover:text-accent"
                aria-label="Стикеры"
              >
                <Sticker className="h-5 w-5" aria-hidden />
              </button>
              <button
                onClick={() => setEmojiOpen((v) => !v)}
                className="press flex h-9 w-9 items-center justify-center rounded-xl text-ink-soft transition hover:text-accent"
                aria-label="Эмодзи"
              >
                <Smile className="h-5 w-5" aria-hidden />
              </button>
            </div>

            {emojiOpen ? (
              <EmojiPicker
                onClose={() => setEmojiOpen(false)}
                onPick={(emoji) => {
                  setText((prev) => prev + emoji);
                  area.current?.focus();
                }}
              />
            ) : null}
            {stickerOpen ? (
              <StickerPicker
                onClose={() => setStickerOpen(false)}
                onPick={(stickerId, emoji) => {
                  setStickerOpen(false);
                  void send({ contentType: 'STICKER', stickerId, content: emoji });
                }}
              />
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <DestructPicker value={destruct} onChange={setDestruct} />
            {text.trim() || files.length ? (
              <button
                onClick={submit}
                disabled={busy}
                className="press flex h-10 w-10 items-center justify-center rounded-2xl bg-accent-gradient text-white shadow-glow transition hover:shadow-glow-lg disabled:opacity-60"
                aria-label="Отправить"
              >
                <Send className="h-5 w-5 translate-x-px" aria-hidden />
              </button>
            ) : (
              <button
                onClick={() => setRecording(true)}
                className="press flex h-10 w-10 items-center justify-center rounded-2xl bg-accent-gradient text-white shadow-glow"
                aria-label="Записать голосовое сообщение"
              >
                <Mic className="h-5 w-5" aria-hidden />
              </button>
            )}
          </div>
        </div>
      )}

      <PollComposer chatId={chatId} open={pollOpen} onClose={() => setPollOpen(false)} />
    </div>
  );
}

/** Self-destruct timer: 5 seconds through one week, off by default. */
function DestructPicker({ value, onChange }: { value: number | null; onChange: (value: number | null) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Самоуничтожение"
        aria-label="Таймер самоуничтожения"
        className={cn(
          'press hidden h-10 w-10 items-center justify-center rounded-xl transition sm:flex',
          value ? 'bg-accent/15 text-accent shadow-glow' : 'text-ink-soft hover:bg-glass/70 hover:text-accent',
        )}
      >
        <Flame className="h-5 w-5" aria-hidden />
      </button>
      {open ? (
        <>
          <button className="fixed inset-0 z-30 cursor-default" aria-label="Закрыть" onClick={() => setOpen(false)} />
          <div className="glass-strong absolute bottom-full end-0 z-40 mb-2 w-32 rounded-2xl p-1 shadow-glass-lg">
            {DESTRUCT_OPTIONS.map((option) => (
              <button
                key={option.label}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-xs font-semibold hover:bg-accent/10',
                  value === option.value && 'text-accent',
                )}
              >
                {option.label}
                {value === option.value ? <Flame className="h-3 w-3" aria-hidden /> : null}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
