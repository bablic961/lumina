'use client';

/**
 * Camera post-processing for calls.
 *
 * Real portrait segmentation needs an ML model (MediaPipe Selfie Segmentation),
 * which is a heavy extra dependency. Instead this draws every frame twice on a
 * canvas — a blurred full frame, then the sharp frame clipped to a centred
 * ellipse — which reads as background blur for the usual head-and-shoulders
 * framing while staying pure Canvas2D. Callers get a MediaStream they can send
 * in place of the raw camera track.
 */
export interface BlurHandle {
  stream: MediaStream;
  stop: () => void;
}

export function createBlurredStream(source: MediaStream, radius = 14): BlurHandle | null {
  const track = source.getVideoTracks()[0];
  if (!track || typeof document === 'undefined') return null;

  const settings = track.getSettings();
  const width = settings.width ?? 640;
  const height = settings.height ?? 480;

  const video = document.createElement('video');
  video.srcObject = new MediaStream([track]);
  video.muted = true;
  video.playsInline = true;
  void video.play().catch(() => {});

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  let raf = 0;
  const draw = () => {
    if (video.readyState >= 2) {
      ctx.save();
      ctx.filter = `blur(${radius}px)`;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      ctx.restore();

      ctx.save();
      ctx.beginPath();
      ctx.ellipse(canvas.width / 2, canvas.height * 0.52, canvas.width * 0.3, canvas.height * 0.46, 0, 0, Math.PI * 2);
      ctx.clip();
      ctx.filter = 'none';
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
    raf = requestAnimationFrame(draw);
  };
  raf = requestAnimationFrame(draw);

  const stream = canvas.captureStream(24);
  return {
    stream,
    stop: () => {
      cancelAnimationFrame(raf);
      video.srcObject = null;
      stream.getTracks().forEach((t) => t.stop());
    },
  };
}

/** Mixes every audio track of the call into one track so recordings hear both sides. */
export function mixAudio(streams: MediaStream[]): { track: MediaStreamTrack; close: () => void } | null {
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  const ctx = new AudioCtx();
  const destination = ctx.createMediaStreamDestination();
  let connected = 0;
  for (const stream of streams) {
    if (stream.getAudioTracks().length === 0) continue;
    ctx.createMediaStreamSource(stream).connect(destination);
    connected += 1;
  }
  if (connected === 0) {
    void ctx.close();
    return null;
  }
  return { track: destination.stream.getAudioTracks()[0], close: () => void ctx.close() };
}
