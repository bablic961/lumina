'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSocketContext } from '@/components/providers/SocketProvider';
import { useCallStore } from '@/store/call';
import { toast } from '@/store/toast';
import { createBlurredStream, mixAudio, type BlurHandle } from '@/lib/media';
import type { CallKind, PublicUser } from '@/types';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
];

type SignalData =
  | { type: 'offer' | 'answer'; sdp: RTCSessionDescriptionInit }
  | { type: 'candidate'; candidate: RTCIceCandidateInit };

export interface RemotePeer {
  peerId: string;
  stream: MediaStream;
  user?: PublicUser;
  muted?: boolean;
  videoOff?: boolean;
}

/**
 * Mesh WebRTC over the socket relay. Every participant keeps one
 * RTCPeerConnection per peer; the participant already in the room is the one
 * that offers, so joining late never produces a glare (both-offer) collision.
 */
export function useWebRTC() {
  const { socket } = useSocketContext();
  const status = useCallStore((s) => s.status);
  const callId = useCallStore((s) => s.callId);
  const chatId = useCallStore((s) => s.chatId);
  const kind = useCallStore((s) => s.kind);
  const initiator = useCallStore((s) => s.initiator);
  const set = useCallStore((s) => s.set);
  const reset = useCallStore((s) => s.reset);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remotes, setRemotes] = useState<RemotePeer[]>([]);
  const [elapsed, setElapsed] = useState(0);

  const peers = useRef(new Map<string, RTCPeerConnection>());
  const pending = useRef(new Map<string, RTCIceCandidateInit[]>());
  const local = useRef<MediaStream | null>(null);
  const camera = useRef<MediaStream | null>(null);
  const blur = useRef<BlurHandle | null>(null);
  const screen = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  /** One shared getUserMedia; video is only requested for video calls. */
  const ensureLocal = useCallback(
    async (wanted: CallKind) => {
      if (local.current) return local.current;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: wanted === 'VIDEO' ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } : false,
      });
      camera.current = stream;
      local.current = stream;
      setLocalStream(stream);
      return stream;
    },
    [],
  );

  const emitSignal = useCallback(
    (to: string, data: SignalData) => socket?.emit('call:signal', { callId, to, data }),
    [socket, callId],
  );

  const createPeer = useCallback(
    (peerId: string) => {
      const existing = peers.current.get(peerId);
      if (existing) return existing;

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peers.current.set(peerId, pc);

      for (const track of local.current?.getTracks() ?? []) pc.addTrack(track, local.current!);

      pc.onicecandidate = (event) => {
        if (event.candidate) emitSignal(peerId, { type: 'candidate', candidate: event.candidate.toJSON() });
      };

      pc.ontrack = (event) => {
        const [stream] = event.streams;
        if (!stream) return;
        setRemotes((prev) =>
          prev.some((p) => p.peerId === peerId)
            ? prev.map((p) => (p.peerId === peerId ? { ...p, stream } : p))
            : [...prev, { peerId, stream }],
        );
        if (useCallStore.getState().status !== 'active') {
          set({ status: 'active', startedAt: useCallStore.getState().startedAt ?? Date.now() });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          peers.current.delete(peerId);
          setRemotes((prev) => prev.filter((p) => p.peerId !== peerId));
        }
      };

      return pc;
    },
    [emitSignal, set],
  );

  const offerTo = useCallback(
    async (peerId: string) => {
      const pc = createPeer(peerId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      emitSignal(peerId, { type: 'offer', sdp: offer });
    },
    [createPeer, emitSignal],
  );

  /** Candidates can arrive before the offer, so they are buffered per peer. */
  const flushCandidates = useCallback(async (peerId: string, pc: RTCPeerConnection) => {
    const queued = pending.current.get(peerId);
    if (!queued) return;
    pending.current.delete(peerId);
    for (const candidate of queued) await pc.addIceCandidate(candidate).catch(() => {});
  }, []);

  const handleSignal = useCallback(
    async ({ from, data }: { from: string; data: SignalData }) => {
      try {
        if (data.type === 'offer') {
          const pc = createPeer(from);
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          await flushCandidates(from, pc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          emitSignal(from, { type: 'answer', sdp: answer });
        } else if (data.type === 'answer') {
          const pc = peers.current.get(from);
          if (!pc) return;
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          await flushCandidates(from, pc);
        } else if (data.type === 'candidate') {
          const pc = peers.current.get(from);
          if (!pc || !pc.remoteDescription) {
            pending.current.set(from, [...(pending.current.get(from) ?? []), data.candidate]);
            return;
          }
          await pc.addIceCandidate(data.candidate).catch(() => {});
        }
      } catch (err) {
        console.error('[lumina] signal', err);
      }
    },
    [createPeer, emitSignal, flushCandidates],
  );

  /** Tears down media, peers and recorder. Safe to call twice. */
  const teardown = useCallback(() => {
    if (recorder.current?.state === 'recording') recorder.current.stop();
    recorder.current = null;
    blur.current?.stop();
    blur.current = null;
    screen.current?.getTracks().forEach((t) => t.stop());
    screen.current = null;
    camera.current?.getTracks().forEach((t) => t.stop());
    camera.current = null;
    local.current = null;
    peers.current.forEach((pc) => pc.close());
    peers.current.clear();
    pending.current.clear();
    setLocalStream(null);
    setRemotes([]);
    setElapsed(0);
  }, []);

  const hangup = useCallback(() => {
    if (callId) socket?.emit('call:end', { callId });
    teardown();
    reset();
  }, [callId, socket, teardown, reset]);

  const accept = useCallback(async () => {
    if (!callId) return;
    try {
      await ensureLocal(kind);
      set({ status: 'connecting' });
      socket?.emit('call:join', { callId }, (ack: { ok?: boolean; error?: string }) => {
        if (ack?.error) {
          toast.error(ack.error === 'ended' ? 'Звонок уже завершён' : 'Не удалось подключиться');
          teardown();
          reset();
        }
      });
    } catch {
      toast.error('Нет доступа к микрофону', 'Разрешите доступ в настройках браузера');
      hangup();
    }
  }, [callId, kind, ensureLocal, set, socket, teardown, reset, hangup]);

  const decline = useCallback(() => {
    if (callId) socket?.emit('call:reject', { callId });
    teardown();
    reset();
  }, [callId, socket, teardown, reset]);

  /** Swaps the outgoing video track on every peer connection at once. */
  const replaceVideoTrack = useCallback((track: MediaStreamTrack | null) => {
    peers.current.forEach((pc) => {
      const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
      if (sender) void sender.replaceTrack(track);
    });
  }, []);

  const toggleMute = useCallback(() => {
    const next = !useCallStore.getState().muted;
    local.current?.getAudioTracks().forEach((track) => (track.enabled = !next));
    set({ muted: next });
    if (callId) socket?.emit('call:state', { callId, muted: next });
  }, [callId, socket, set]);

  const toggleVideo = useCallback(() => {
    const next = !useCallStore.getState().videoOff;
    local.current?.getVideoTracks().forEach((track) => (track.enabled = !next));
    set({ videoOff: next });
    if (callId) socket?.emit('call:state', { callId, videoOff: next });
  }, [callId, socket, set]);

  const toggleScreen = useCallback(async () => {
    const sharing = useCallStore.getState().screenSharing;
    if (sharing) {
      screen.current?.getTracks().forEach((track) => track.stop());
      screen.current = null;
      replaceVideoTrack(camera.current?.getVideoTracks()[0] ?? null);
      set({ screenSharing: false });
      if (callId) socket?.emit('call:state', { callId, screenSharing: false });
      return;
    }
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      screen.current = display;
      const track = display.getVideoTracks()[0];
      track.onended = () => void toggleScreen();
      replaceVideoTrack(track);
      set({ screenSharing: true });
      if (callId) socket?.emit('call:state', { callId, screenSharing: true });
    } catch {
      // The user dismissed the picker — nothing to report.
    }
  }, [callId, socket, set, replaceVideoTrack]);

  const toggleBlur = useCallback(() => {
    if (useCallStore.getState().blurBackground) {
      blur.current?.stop();
      blur.current = null;
      replaceVideoTrack(camera.current?.getVideoTracks()[0] ?? null);
      set({ blurBackground: false });
      return;
    }
    if (!camera.current) return;
    const handle = createBlurredStream(camera.current);
    if (!handle) {
      toast.error('Размытие недоступно в этом браузере');
      return;
    }
    blur.current = handle;
    replaceVideoTrack(handle.stream.getVideoTracks()[0]);
    set({ blurBackground: true });
  }, [replaceVideoTrack, set]);

  /**
   * Recording is explicit and mutual: everyone in the call is told, and the file
   * is written on this device only (no server-side copy).
   */
  const toggleRecording = useCallback(() => {
    if (recorder.current) {
      recorder.current.stop();
      recorder.current = null;
      set({ recording: false });
      return;
    }
    if (!local.current) return;
    if (!window.confirm('Начать запись? Остальные участники будут уведомлены.')) return;

    const mixed = mixAudio([local.current, ...remotes.map((r) => r.stream)]);
    const tracks: MediaStreamTrack[] = [];
    const video = remotes[0]?.stream.getVideoTracks()[0] ?? local.current.getVideoTracks()[0];
    if (video) tracks.push(video);
    if (mixed) tracks.push(mixed.track);
    else local.current.getAudioTracks().forEach((track) => tracks.push(track));

    try {
      const rec = new MediaRecorder(new MediaStream(tracks), { mimeType: 'video/webm' });
      chunks.current = [];
      rec.ondataavailable = (event) => event.data.size && chunks.current.push(event.data);
      rec.onstop = () => {
        mixed?.close();
        const blob = new Blob(chunks.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `lumina-call-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`;
        link.click();
        URL.revokeObjectURL(url);
        toast.success('Запись сохранена');
      };
      rec.start(1000);
      recorder.current = rec;
      set({ recording: true });
      if (callId) socket?.emit('call:state', { callId, recording: true });
    } catch {
      toast.error('Запись не поддерживается');
    }
  }, [remotes, set, callId, socket]);

  // The caller grabs media and opens the session as soon as the dialog appears.
  useEffect(() => {
    if (status !== 'ringing' || !initiator || callId || !chatId || !socket) return;
    let cancelled = false;
    (async () => {
      try {
        await ensureLocal(kind);
        if (cancelled) return;
        socket.emit('call:start', { chatId, kind }, (ack: { ok?: boolean; callId?: string; error?: string }) => {
          if (ack?.callId) set({ callId: ack.callId });
          else {
            toast.error('Не удалось начать звонок');
            teardown();
            reset();
          }
        });
      } catch {
        toast.error('Нет доступа к камере или микрофону');
        reset();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, initiator, callId, chatId, kind, socket, ensureLocal, set, teardown, reset]);

  useEffect(() => {
    if (!socket || !callId) return;

    const onPeerJoined = ({ peerId, user }: { peerId: string; user?: PublicUser }) => {
      if (user) {
        setRemotes((prev) =>
          prev.some((p) => p.peerId === peerId) ? prev.map((p) => (p.peerId === peerId ? { ...p, user } : p)) : prev,
        );
        set({ participants: [...useCallStore.getState().participants.filter((p) => p.id !== user.id), user] });
      }
      void offerTo(peerId);
    };

    const onState = ({
      userId,
      muted,
      videoOff,
      recording,
    }: {
      userId: string;
      muted?: boolean;
      videoOff?: boolean;
      recording?: boolean;
    }) => {
      setRemotes((prev) => prev.map((p) => (p.peerId === userId ? { ...p, muted, videoOff } : p)));
      if (recording) toast.info('Участник записывает звонок');
    };

    const onEnded = () => {
      teardown();
      reset();
      toast.info('Звонок завершён');
    };

    const onRejected = () => {
      teardown();
      reset();
      toast.info('Вызов отклонён');
    };

    socket.on('call:peer-joined', onPeerJoined);
    socket.on('call:signal', handleSignal);
    socket.on('call:state', onState);
    socket.on('call:ended', onEnded);
    socket.on('call:rejected', onRejected);
    return () => {
      socket.off('call:peer-joined', onPeerJoined);
      socket.off('call:signal', handleSignal);
      socket.off('call:state', onState);
      socket.off('call:ended', onEnded);
      socket.off('call:rejected', onRejected);
    };
  }, [socket, callId, offerTo, handleSignal, set, teardown, reset]);

  // Duration ticker.
  useEffect(() => {
    if (status !== 'active') return;
    const startedAt = useCallStore.getState().startedAt ?? Date.now();
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [status]);

  // Quality indicator from RTCStats: packet loss and round-trip time.
  useEffect(() => {
    if (status !== 'active') return;
    const timer = setInterval(async () => {
      const pc = peers.current.values().next().value as RTCPeerConnection | undefined;
      if (!pc) return;
      const stats = await pc.getStats();
      let loss = 0;
      let rtt = 0;
      stats.forEach((report) => {
        if (report.type === 'inbound-rtp' && !report.isRemote) {
          const total = (report.packetsReceived ?? 0) + (report.packetsLost ?? 0);
          if (total > 0) loss = Math.max(loss, (report.packetsLost ?? 0) / total);
        }
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          rtt = Math.max(rtt, report.currentRoundTripTime ?? 0);
        }
      });
      set({ quality: loss > 0.08 || rtt > 0.4 ? 'poor' : loss > 0.03 || rtt > 0.2 ? 'fair' : 'good' });
    }, 3000);
    return () => clearInterval(timer);
  }, [status, set]);

  // Any exit from a live call releases the devices.
  useEffect(() => {
    if (status === 'idle' || status === 'ended') teardown();
  }, [status, teardown]);

  useEffect(() => () => teardown(), [teardown]);

  return {
    localStream,
    remotes,
    elapsed,
    accept,
    decline,
    hangup,
    toggleMute,
    toggleVideo,
    toggleScreen,
    toggleBlur,
    toggleRecording,
  };
}
