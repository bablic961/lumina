'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { cn, formatDuration } from '@/lib/utils';

/**
 * Voice note player. The waveform is drawn from the peaks captured while
 * recording (stored on the attachment), so no audio decoding is needed to paint
 * it — wavesurfer is reserved for the full-size media player.
 */
export function VoicePlayer({
  url,
  duration,
  waveform,
  outgoing,
}: {
  url: string;
  duration: number | null;
  waveform: string | null;
  outgoing: boolean;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(1);

  const peaks = useMemo<number[]>(() => {
    try {
      const parsed = waveform ? JSON.parse(waveform) : null;
      if (Array.isArray(parsed) && parsed.length) return parsed.slice(0, 48).map((n: number) => Math.max(0.08, Math.min(1, n)));
    } catch {
      /* fall through to a synthetic wave */
    }
    return Array.from({ length: 40 }, (_, i) => 0.25 + Math.abs(Math.sin(i * 1.7)) * 0.7);
  }, [waveform]);

  useEffect(() => {
    const el = audio.current;
    if (!el) return;
    const onTime = () => setProgress(el.duration ? el.currentTime / el.duration : 0);
    const onEnd = () => {
      setPlaying(false);
      setProgress(0);
    };
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('ended', onEnd);
    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('ended', onEnd);
    };
  }, []);

  function toggle() {
    const el = audio.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      el.playbackRate = speed;
      void el.play();
      setPlaying(true);
    }
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const el = audio.current;
    if (!el?.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    el.currentTime = ratio * el.duration;
    setProgress(ratio);
  }

  const played = duration ? Math.round(progress * duration) : 0;

  return (
    <div className="flex min-w-[13rem] items-center gap-2.5 py-0.5">
      <audio ref={audio} src={url} preload="metadata" />
      <button
        onClick={toggle}
        className={cn(
          'press flex h-10 w-10 shrink-0 items-center justify-center rounded-full shadow-glass transition',
          outgoing ? 'bg-white/25 text-white' : 'bg-accent-gradient text-white',
        )}
        aria-label={playing ? 'Пауза' : 'Воспроизвести'}
      >
        {playing ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4 translate-x-px" aria-hidden />}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex h-8 cursor-pointer items-center gap-[2px]" onClick={seek} role="slider" aria-label="Позиция" aria-valuenow={played} tabIndex={0}>
          {peaks.map((peak, i) => {
            const active = i / peaks.length <= progress;
            return (
              <span
                key={i}
                className={cn(
                  'w-full rounded-full transition-colors duration-150',
                  outgoing ? (active ? 'bg-white' : 'bg-white/40') : active ? 'bg-accent' : 'bg-ink-faint/40',
                )}
                style={{ height: `${Math.round(peak * 100)}%` }}
                aria-hidden
              />
            );
          })}
        </div>
        <div className={cn('flex items-center justify-between text-[11px]', outgoing ? 'text-white/80' : 'text-ink-faint')}>
          <span className="font-mono">{formatDuration(played)} / {formatDuration(duration ?? 0)}</span>
          <button
            onClick={() => {
              const next = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
              setSpeed(next);
              if (audio.current) audio.current.playbackRate = next;
            }}
            className="press rounded-md px-1 font-semibold"
            aria-label="Скорость воспроизведения"
          >
            {speed}×
          </button>
        </div>
      </div>
    </div>
  );
}
