'use client';

/**
 * Notification tones are synthesised with WebAudio instead of shipping audio
 * files — three distinct timbres, no network cost, no autoplay warm-up.
 */
type Tone = 'chime' | 'drop' | 'pulse';

let ctx: AudioContext | null = null;

function audioContext() {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = Ctor ? new Ctor() : null;
  }
  if (ctx?.state === 'suspended') void ctx.resume();
  return ctx;
}

const RECIPES: Record<Tone, { freq: number; to: number; dur: number; type: OscillatorType }[]> = {
  chime: [
    { freq: 880, to: 1320, dur: 0.16, type: 'sine' },
    { freq: 1320, to: 1760, dur: 0.22, type: 'sine' },
  ],
  drop: [{ freq: 640, to: 220, dur: 0.22, type: 'triangle' }],
  pulse: [
    { freq: 520, to: 520, dur: 0.09, type: 'square' },
    { freq: 700, to: 700, dur: 0.09, type: 'square' },
  ],
};

export function playTone(tone: Tone = 'chime', volume = 0.14) {
  const audio = audioContext();
  if (!audio) return;
  let offset = 0;
  for (const step of RECIPES[tone]) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = step.type;
    osc.frequency.setValueAtTime(step.freq, audio.currentTime + offset);
    osc.frequency.exponentialRampToValueAtTime(step.to, audio.currentTime + offset + step.dur);
    gain.gain.setValueAtTime(0, audio.currentTime + offset);
    gain.gain.linearRampToValueAtTime(volume, audio.currentTime + offset + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + offset + step.dur);
    osc.connect(gain).connect(audio.destination);
    osc.start(audio.currentTime + offset);
    osc.stop(audio.currentTime + offset + step.dur + 0.02);
    offset += step.dur * 0.7;
  }
}

/** Ringtone loop for incoming calls. Returns a stop function. */
export function startRingtone() {
  const audio = audioContext();
  if (!audio) return () => {};
  let stopped = false;
  const beat = () => {
    if (stopped) return;
    playTone('chime', 0.1);
    setTimeout(beat, 1600);
  };
  beat();
  return () => {
    stopped = true;
  };
}
