'use client';

import { useEffect, useRef, useState } from 'react';
import { Send, Square, Trash2 } from 'lucide-react';
import { cn, formatDuration } from '@/lib/utils';
import { toast } from '@/store/toast';

/**
 * MediaRecorder capture with live peak sampling — the peaks travel with the
 * attachment so the receiver can draw the waveform without decoding audio.
 */
export function VoiceRecorder({
  onSend,
  onCancel,
}: {
  onSend: (payload: { blob: Blob; duration: number; waveform: number[] }) => void;
  onCancel: () => void;
}) {
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const peaks = useRef<number[]>([]);
  const raf = useRef<number | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const media = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          media.getTracks().forEach((t) => t.stop());
          return;
        }
        stream.current = media;

        const ctx = new AudioContext();
        audioCtx.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        ctx.createMediaStreamSource(media).connect(analyser);
        const buffer = new Uint8Array(analyser.frequencyBinCount);

        const sample = () => {
          analyser.getByteTimeDomainData(buffer);
          let peak = 0;
          for (const value of buffer) peak = Math.max(peak, Math.abs(value - 128) / 128);
          setLevel(peak);
          peaks.current.push(Number(peak.toFixed(3)));
          raf.current = requestAnimationFrame(sample);
        };
        sample();

        const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : '';
        const rec = new MediaRecorder(media, mime ? { mimeType: mime } : undefined);
        rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
        rec.start(250);
        recorder.current = rec;
      } catch {
        toast.error('Нет доступа к микрофону');
        onCancel();
      }
    }

    void start();
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);

    return () => {
      cancelled = true;
      clearInterval(timer);
      if (raf.current) cancelAnimationFrame(raf.current);
      recorder.current?.state === 'recording' && recorder.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
      void audioCtx.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function finish() {
    const rec = recorder.current;
    if (!rec) return onCancel();
    rec.onstop = () => {
      const blob = new Blob(chunks.current, { type: rec.mimeType || 'audio/webm' });
      // Down-sample the captured peaks to 48 bars for the bubble waveform.
      const raw = peaks.current;
      const step = Math.max(1, Math.floor(raw.length / 48));
      const waveform = Array.from({ length: Math.min(48, Math.ceil(raw.length / step)) }, (_, i) =>
        Math.max(...raw.slice(i * step, (i + 1) * step), 0.05),
      );
      if (blob.size < 800) {
        toast.error('Слишком коротко');
        onCancel();
        return;
      }
      onSend({ blob, duration: seconds, waveform });
    };
    rec.stop();
  }

  return (
    <div className="glass flex flex-1 items-center gap-3 rounded-2xl px-3 py-2">
      <span className="relative flex h-3 w-3 shrink-0" aria-hidden>
        <span className="absolute inset-0 animate-ping rounded-full bg-rose-500/70" />
        <span className="relative h-3 w-3 rounded-full bg-rose-500" />
      </span>
      <span className="font-mono text-sm font-semibold text-ink">{formatDuration(seconds)}</span>

      <div className="flex h-8 flex-1 items-center gap-[2px] overflow-hidden" aria-hidden>
        {Array.from({ length: 40 }).map((_, i) => (
          <span
            key={i}
            className={cn('w-full rounded-full bg-accent-gradient transition-[height] duration-100')}
            style={{ height: `${Math.max(8, Math.min(100, level * 120 * (0.55 + Math.abs(Math.sin(i + seconds)) * 0.7)))}%` }}
          />
        ))}
      </div>

      <button onClick={onCancel} className="press flex h-9 w-9 items-center justify-center rounded-xl text-ink-soft hover:bg-glass/70" aria-label="Отменить">
        <Trash2 className="h-4 w-4" aria-hidden />
      </button>
      <button onClick={finish} className="press flex h-9 w-9 items-center justify-center rounded-xl bg-accent-gradient text-white shadow-glow" aria-label="Отправить голосовое">
        {seconds > 0 ? <Send className="h-4 w-4" aria-hidden /> : <Square className="h-4 w-4" aria-hidden />}
      </button>
    </div>
  );
}
