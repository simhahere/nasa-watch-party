'use client';

import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react';
import Hls from 'hls.js';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  SkipBack,
  SkipForward,
  Settings,
  Wifi,
  WifiOff,
  MonitorPlay,
  Film,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PlaybackState {
  status: 'playing' | 'paused';
  position: number;
  speed: number;
}

export interface ExternalState extends PlaybackState {
  updatedAt: number;
}

export interface VideoPlayerRef {
  /** Capture the playing video as a MediaStream (for P2P broadcast) */
  captureStream: () => MediaStream | null;
  getVideoElement: () => HTMLVideoElement | null;
}

export interface VideoPlayerProps {
  streamUrl: string | null;
  embedUrl: string | null;
  localFile: File | null;
  isOwner: boolean;
  watchMode: 'synced' | 'free';
  onPlaybackChange?: (state: PlaybackState) => void;
  externalState?: ExternalState | null;
  /** P2P stream received from host via WebRTC — shown to viewers */
  p2pStream?: MediaStream | null;
  /** Direct screen stream shared by host — shown to host */
  screenStream?: MediaStream | null;
  /** Called when video element is ready (for external stream capture) */
  onVideoReady?: (el: HTMLVideoElement) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function isHlsUrl(url: string): boolean {
  return url.endsWith('.m3u8') || url.toLowerCase().includes('hls');
}

const SPEEDS = [0.5, 1, 1.25, 1.5, 2] as const;
type Speed = (typeof SPEEDS)[number];

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

/* ── Seek Bar ── */
interface SeekBarProps {
  currentTime: number;
  duration: number;
  buffered: number;
  onSeek: (time: number) => void;
}

function SeekBar({ currentTime, duration, buffered, onSeek }: SeekBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState(0);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const pct = x / rect.width;
    setHoverTime(pct * duration);
    setHoverX(x);
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect || duration === 0) return;
    const pct = Math.max(0, Math.min((e.clientX - rect.left) / rect.width, 1));
    onSeek(pct * duration);
  };

  return (
    <div
      ref={barRef}
      className="relative w-full cursor-pointer group/seek"
      style={{ height: hovered ? '16px' : '6px', transition: 'height 0.15s ease' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setHoverTime(null); }}
      onMouseMove={handleMouseMove}
      onClick={handleClick}
    >
      {/* Track */}
      <div className="absolute bottom-0 left-0 right-0 rounded-full overflow-hidden"
        style={{ height: hovered ? '8px' : '4px', transition: 'height 0.15s ease', background: 'rgba(255,255,255,0.15)' }}>
        {/* Buffered */}
        <div
          className="absolute top-0 left-0 h-full rounded-full"
          style={{ width: `${bufferedPct}%`, background: 'rgba(255,255,255,0.25)' }}
        />
        {/* Progress */}
        <div
          className="absolute top-0 left-0 h-full rounded-full"
          style={{
            width: `${progress}%`,
            background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #a855f7)',
            boxShadow: '0 0 8px rgba(139,92,246,0.6)',
          }}
        />
      </div>
      {/* Thumb */}
      <div
        className="absolute bottom-0 w-3 h-3 rounded-full -translate-x-1/2 translate-y-1/2 pointer-events-none"
        style={{
          left: `${progress}%`,
          bottom: hovered ? '0px' : '-1px',
          background: '#a855f7',
          boxShadow: '0 0 6px rgba(168,85,247,0.8)',
          opacity: hovered ? 1 : 0,
          transition: 'opacity 0.15s ease',
        }}
      />
      {/* Hover tooltip */}
      {hovered && hoverTime !== null && (
        <div
          className="absolute bottom-full mb-2 -translate-x-1/2 bg-black/80 border border-white/10 backdrop-blur-sm text-white text-xs px-2 py-1 rounded pointer-events-none whitespace-nowrap"
          style={{ left: hoverX }}
        >
          {formatTime(hoverTime)}
        </div>
      )}
    </div>
  );
}

/* ── Volume Control ── */
interface VolumeControlProps {
  volume: number;
  muted: boolean;
  onVolumeChange: (v: number) => void;
  onMuteToggle: () => void;
}

function VolumeControl({ volume, muted, onVolumeChange, onMuteToggle }: VolumeControlProps) {
  const [showSlider, setShowSlider] = useState(false);
  const displayVol = muted ? 0 : volume;

  return (
    <div
      className="relative flex items-center gap-2"
      onMouseEnter={() => setShowSlider(true)}
      onMouseLeave={() => setShowSlider(false)}
    >
      <button
        onClick={onMuteToggle}
        className="text-white/80 hover:text-white transition-colors p-1 rounded-md hover:bg-white/10"
      >
        {displayVol === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>

      <div
        className="overflow-hidden transition-all duration-200"
        style={{ width: showSlider ? '80px' : '0px', opacity: showSlider ? 1 : 0 }}
      >
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={displayVol}
          onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
          className="w-20 h-1 accent-purple-500 cursor-pointer"
          style={{
            background: `linear-gradient(90deg, #a855f7 ${displayVol * 100}%, rgba(255,255,255,0.2) ${displayVol * 100}%)`,
          }}
        />
      </div>
    </div>
  );
}

/* ── Speed Selector ── */
interface SpeedSelectorProps {
  speed: Speed;
  onChange: (s: Speed) => void;
}

function SpeedSelector({ speed, onChange }: SpeedSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-white/80 hover:text-white transition-colors px-2 py-1 rounded-md hover:bg-white/10 text-sm font-medium"
      >
        <Settings size={14} />
        <span>{speed}x</span>
      </button>

      {open && (
        <div className="absolute bottom-full mb-2 right-0 bg-black/90 border border-white/10 backdrop-blur-xl rounded-xl overflow-hidden shadow-xl z-50">
          <div className="py-1 px-1 text-xs text-white/40 px-3 pt-2 pb-1">Playback Speed</div>
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => { onChange(s); setOpen(false); }}
              className={`block w-full text-left px-4 py-2 text-sm transition-colors hover:bg-white/10 ${
                s === speed ? 'text-purple-400 font-semibold' : 'text-white/80'
              }`}
            >
              {s === 1 ? '1x (Normal)' : `${s}x`}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Sync Badge ── */
interface SyncBadgeProps {
  synced: boolean;
  syncing: boolean;
  watchMode: 'synced' | 'free';
  isOwner: boolean;
}

function SyncBadge({ synced, syncing, watchMode, isOwner }: SyncBadgeProps) {
  if (watchMode === 'free') return null;

  if (isOwner) {
    return (
      <div className="flex items-center gap-1.5 bg-purple-500/20 border border-purple-500/30 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-semibold text-purple-300">
        <Wifi size={12} />
        <span>Host · Synced</span>
      </div>
    );
  }

  if (syncing) {
    return (
      <div className="flex items-center gap-1.5 bg-yellow-500/20 border border-yellow-500/30 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-semibold text-yellow-300 animate-pulse">
        <Wifi size={12} className="animate-spin" style={{ animationDuration: '2s' }} />
        <span>Syncing…</span>
      </div>
    );
  }

  if (synced) {
    return (
      <div className="flex items-center gap-1.5 bg-green-500/20 border border-green-500/30 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-semibold text-green-300">
        <Wifi size={12} />
        <span>Synced</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 bg-red-500/20 border border-red-500/30 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-semibold text-red-300">
      <WifiOff size={12} />
      <span>Out of Sync</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main VideoPlayer
// ─────────────────────────────────────────────────────────────────────────────

const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(function VideoPlayer({
  streamUrl,
  embedUrl,
  localFile,
  isOwner,
  watchMode,
  onPlaybackChange,
  externalState,
  p2pStream,
  screenStream,
  onVideoReady,
}, ref) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const hideControlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastExternalStateRef = useRef<ExternalState | null>(null);
  const isSyncingRef = useRef(false);
  const driftCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Player state ──
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isSynced, setIsSynced] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeVideoSrc, setActiveVideoSrc] = useState<string | null>(null);

  // ── Expose captureStream & video element to parent via ref ──
  useImperativeHandle(ref, () => ({
    captureStream: () => {
      const video = videoRef.current as any;
      if (!video) return null;
      if (typeof video.captureStream === 'function') return video.captureStream() as MediaStream;
      if (typeof video.mozCaptureStream === 'function') return video.mozCaptureStream() as MediaStream;
      return null;
    },
    getVideoElement: () => videoRef.current,
  }));

  // ── Notify parent when video element mounts ──
  useEffect(() => {
    if (videoRef.current && onVideoReady) onVideoReady(videoRef.current);
  }, [onVideoReady]);

  // ── Attach Host's Screen Stream / Viewers' P2P Stream to video element ──
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const activeStream = screenStream || p2pStream;
    if (!activeStream) return;

    video.srcObject = activeStream;
    video.play().catch(() => {});
    return () => {
      video.srcObject = null;
    };
  }, [p2pStream, screenStream]);

  // ── Determine which mode we're in ──
  const mode: 'video' | 'embed' | 'empty' = localFile || streamUrl || p2pStream || screenStream
    ? 'video'
    : embedUrl
    ? 'embed'
    : 'empty';

  // ─────────────────────────────────────────────────────────────────────────
  // Source management
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    // Cleanup previous object URL
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    // Cleanup HLS
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    let src: string | null = null;

    if (localFile) {
      src = URL.createObjectURL(localFile);
      objectUrlRef.current = src;
    } else if (streamUrl) {
      src = streamUrl;
    }

    setActiveVideoSrc(src);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);

    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [streamUrl, localFile]);

  // ── Attach HLS or native src to video element ──
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeVideoSrc) return;

    if (isHlsUrl(activeVideoSrc)) {
      if (Hls.isSupported()) {
        const hls = new Hls({ enableWorker: false });
        hlsRef.current = hls;
        hls.loadSource(activeVideoSrc);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          // Ready
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari native HLS
        video.src = activeVideoSrc;
      }
    } else {
      video.src = activeVideoSrc;
      video.load();
    }
  }, [activeVideoSrc]);

  // ─────────────────────────────────────────────────────────────────────────
  // Video event listeners
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => {
      setIsPlaying(true);
      if (isOwner && onPlaybackChange) {
        onPlaybackChange({ status: 'playing', position: video.currentTime, speed: video.playbackRate });
      }
    };

    const onPause = () => {
      setIsPlaying(false);
      if (isOwner && onPlaybackChange) {
        onPlaybackChange({ status: 'paused', position: video.currentTime, speed: video.playbackRate });
      }
    };

    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      // Update buffered
      if (video.buffered.length > 0) {
        setBuffered(video.buffered.end(video.buffered.length - 1));
      }
      // Owner: fire playback change on timeupdate (throttled by browser)
      if (isOwner && onPlaybackChange && !video.paused) {
        onPlaybackChange({ status: 'playing', position: video.currentTime, speed: video.playbackRate });
      }
    };

    const onDurationChange = () => setDuration(video.duration);
    const onVolumeChange = () => { setVolume(video.volume); setMuted(video.muted); };
    const onRateChange = () => setSpeed(video.playbackRate as Speed);
    const onSeeked = () => {
      if (isOwner && onPlaybackChange) {
        onPlaybackChange({
          status: video.paused ? 'paused' : 'playing',
          position: video.currentTime,
          speed: video.playbackRate,
        });
      }
    };

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('durationchange', onDurationChange);
    video.addEventListener('volumechange', onVolumeChange);
    video.addEventListener('ratechange', onRateChange);
    video.addEventListener('seeked', onSeeked);

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('durationchange', onDurationChange);
      video.removeEventListener('volumechange', onVolumeChange);
      video.removeEventListener('ratechange', onRateChange);
      video.removeEventListener('seeked', onSeeked);
    };
  }, [isOwner, onPlaybackChange]);

  // ─────────────────────────────────────────────────────────────────────────
  // Sync logic (non-owner, synced mode)
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (isOwner || watchMode !== 'synced' || !externalState) return;
    if (p2pStream || screenStream) return; // Bypass sync for live streams

    const video = videoRef.current;
    if (!video || mode !== 'video') return;

    const prev = lastExternalStateRef.current;
    const isNew = !prev || prev.updatedAt !== externalState.updatedAt;
    if (!isNew) return;

    lastExternalStateRef.current = externalState;

    const applySync = async () => {
      isSyncingRef.current = true;
      setIsSyncing(true);

      try {
        // Seek if position differs by more than 2 seconds
        if (Math.abs(video.currentTime - externalState.position) > 2) {
          video.currentTime = externalState.position;
        }

        // Sync playback rate
        if (video.playbackRate !== externalState.speed) {
          video.playbackRate = externalState.speed;
        }

        // Sync play/pause
        if (externalState.status === 'playing') {
          if (video.paused) {
            await video.play().catch(() => {});
          }
        } else {
          if (!video.paused) {
            video.pause();
          }
        }

        setIsSynced(true);
      } catch {
        setIsSynced(false);
      } finally {
        isSyncingRef.current = false;
        setIsSyncing(false);
      }
    };

    applySync();

    // Start drift correction interval
    if (driftCheckRef.current) clearInterval(driftCheckRef.current);
    driftCheckRef.current = setInterval(() => {
      const v = videoRef.current;
      if (!v || !externalState) return;
      const drift = Math.abs(v.currentTime - externalState.position);
      if (drift > 3) {
        v.currentTime = externalState.position;
      }
    }, 5000);

    return () => {
      if (driftCheckRef.current) {
        clearInterval(driftCheckRef.current);
        driftCheckRef.current = null;
      }
    };
  }, [externalState, isOwner, watchMode, mode]);

  // ─────────────────────────────────────────────────────────────────────────
  // Controls visibility (auto-hide after 3s)
  // ─────────────────────────────────────────────────────────────────────────

  const resetHideTimer = useCallback(() => {
    if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current);
    setShowControls(true);
    hideControlsTimerRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  }, [isPlaying]);

  useEffect(() => {
    if (!isPlaying) setShowControls(true);
    return () => {
      if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current);
    };
  }, [isPlaying]);

  // ─────────────────────────────────────────────────────────────────────────
  // Fullscreen
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Control handlers
  // ─────────────────────────────────────────────────────────────────────────

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, []);

  const handleSeek = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = time;
  }, []);

  const skipSeconds = useCallback((secs: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.currentTime + secs, video.duration));
  }, []);

  const handleVolumeChange = useCallback((v: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = v;
    if (v > 0) video.muted = false;
  }, []);

  const handleMuteToggle = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
  }, []);

  const handleSpeedChange = useCallback((s: Speed) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = s;
    setSpeed(s);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    if (mode !== 'video') return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowRight':
          e.preventDefault();
          skipSeconds(5);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          skipSeconds(-5);
          break;
        case 'f':
          toggleFullscreen();
          break;
        case 'm':
          handleMuteToggle();
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, togglePlay, skipSeconds, toggleFullscreen, handleMuteToggle]);

  // ─────────────────────────────────────────────────────────────────────────
  // iFrame postMessage sync
  // ─────────────────────────────────────────────────────────────────────────

  const iframeRef = useRef<HTMLIFrameElement>(null);

  const sendIframeSync = useCallback(
    (action: 'play' | 'pause', time?: number) => {
      if (!iframeRef.current?.contentWindow) return;
      iframeRef.current.contentWindow.postMessage(
        { type: 'NASA_SYNC', action, time },
        '*'
      );
    },
    []
  );

  useEffect(() => {
    if (mode !== 'embed' || !externalState) return;
    if (externalState.status === 'playing') {
      sendIframeSync('play', externalState.position);
    } else {
      sendIframeSync('pause', externalState.position);
    }
  }, [externalState, mode, sendIframeSync]);

  // ─────────────────────────────────────────────────────────────────────────
  // Render helpers
  // ─────────────────────────────────────────────────────────────────────────

  // Controls should be disabled for non-owner in synced mode
  const controlsDisabled = watchMode === 'synced' && !isOwner;

  // ─────────────────────────────────────────────────────────────────────────
  // Empty State
  // ─────────────────────────────────────────────────────────────────────────

  if (mode === 'empty') {
    return (
      <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden flex flex-col items-center justify-center"
        style={{ background: 'radial-gradient(ellipse at center, #0f0f1a 0%, #000000 100%)' }}>
        {/* Stars background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 60 }).map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-white"
              style={{
                width: Math.random() < 0.3 ? '2px' : '1px',
                height: Math.random() < 0.3 ? '2px' : '1px',
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                opacity: Math.random() * 0.7 + 0.1,
                animation: `pulse ${2 + Math.random() * 3}s ease-in-out infinite`,
                animationDelay: `${Math.random() * 3}s`,
              }}
            />
          ))}
        </div>

        {/* Center content */}
        <div className="relative z-10 flex flex-col items-center gap-5 text-center px-6">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-purple-500/20 blur-2xl scale-150" />
            <div className="relative w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center backdrop-blur-sm">
              <MonitorPlay size={36} className="text-purple-400" />
            </div>
          </div>
          <div>
            <h3 className="text-white text-xl font-semibold mb-2">No video loaded</h3>
            <p className="text-white/40 text-sm max-w-xs leading-relaxed">
              The host can select a video to watch together. Paste a stream URL or share a local file.
            </p>
          </div>
        </div>

        {/* Subtle grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // iFrame Embed Mode
  // ─────────────────────────────────────────────────────────────────────────

  if (mode === 'embed') {
    return (
      <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden">
        {/* Sync reminder strip */}
        {watchMode === 'synced' && !isOwner && (
          <div className="absolute top-0 left-0 right-0 z-20 bg-yellow-500/10 border-b border-yellow-500/20 backdrop-blur-sm px-4 py-2 flex items-center justify-between">
            <span className="text-yellow-300/80 text-xs">
              ⚡ Embedded player — Sync relies on host&apos;s playback commands
            </span>
            <span className="text-yellow-300/60 text-xs">Manual sync may be needed</span>
          </div>
        )}

        {/* iFrame */}
        <iframe
          ref={iframeRef}
          src={embedUrl!}
          className="absolute inset-0 w-full h-full border-0"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
        />

        {/* Overlay badges */}
        <div className="absolute top-3 right-3 z-20 flex flex-col items-end gap-2 pointer-events-none">
          {watchMode === 'synced' && (
            <SyncBadge synced={isSynced} syncing={isSyncing} watchMode={watchMode} isOwner={isOwner} />
          )}
          <div className="flex items-center gap-1.5 bg-black/60 border border-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs text-white/60">
            <Film size={12} />
            <span>Embedded Player</span>
          </div>
        </div>

        {/* Non-owner message */}
        {!isOwner && (
          <div className="absolute bottom-3 left-3 z-20 flex items-center gap-2 bg-black/60 border border-white/10 backdrop-blur-sm px-3 py-2 rounded-xl pointer-events-none">
            <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
            <span className="text-white/70 text-xs">Host controls playback</span>
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Video Mode (streamUrl or localFile)
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden group select-none"
      onMouseMove={resetHideTimer}
      onMouseLeave={() => { if (isPlaying) setShowControls(false); }}
      style={{ cursor: showControls ? 'default' : 'none' }}
    >
      {/* ── Video Element ── */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-contain"
        playsInline
        preload="metadata"
        onClick={controlsDisabled ? undefined : togglePlay}
        onDoubleClick={toggleFullscreen}
      />

      {/* ── Local file badge ── */}
      {localFile && (
        <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-500/30 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs text-emerald-300 pointer-events-none animate-pulse">
          <Film size={12} />
          <span>Local File — Broadcasting Live 🚀</span>
        </div>
      )}

      {/* ── Sync badge ── */}
      {watchMode === 'synced' && (
        <div className="absolute top-3 right-3 z-20 pointer-events-none flex flex-col items-end gap-2">
          <SyncBadge synced={isSynced} syncing={isSyncing} watchMode={watchMode} isOwner={isOwner} />
          {/* Quality badge for stream URLs */}
          {streamUrl && (
            <div className="flex items-center gap-1 bg-black/60 border border-white/10 backdrop-blur-sm px-2 py-1 rounded-full text-[10px] font-bold text-white/70">
              {(videoRef.current?.videoHeight ?? 0) >= 720 ? '🔵 HD' : '⚪ SD'}
            </div>
          )}
        </div>
      )}

      {/* ── Quality badge (non-synced, stream URL) ── */}
      {watchMode !== 'synced' && streamUrl && (
        <div className="absolute top-3 right-3 z-20 pointer-events-none">
          <div className="flex items-center gap-1 bg-black/60 border border-white/10 backdrop-blur-sm px-2 py-1 rounded-full text-[10px] font-bold text-white/70">
            {(videoRef.current?.videoHeight ?? 0) >= 720 ? '🔵 HD' : '⚪ SD'}
          </div>
        </div>
      )}

      {/* ── Center Play Button (big) ── */}
      {!controlsDisabled && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"
          tabIndex={-1}
          aria-hidden
        >
          <div
            className="w-16 h-16 rounded-full bg-black/50 border border-white/20 flex items-center justify-center backdrop-blur-sm transition-all duration-200"
            style={{ opacity: showControls && !isPlaying ? 0.85 : 0, transform: showControls && !isPlaying ? 'scale(1)' : 'scale(0.8)' }}
          >
            <Play size={28} className="text-white ml-1" fill="white" />
          </div>
        </button>
      )}

      {/* ── Controls Overlay ── */}
      <div
        className="absolute inset-0 z-20 flex flex-col justify-end pointer-events-none"
        style={{ opacity: showControls ? 1 : 0, transition: 'opacity 0.3s ease' }}
      >
        {/* Gradient scrim */}
        <div
          className="absolute bottom-0 left-0 right-0 h-40 pointer-events-none"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)' }}
        />

        {/* Controls bar */}
        <div className="relative z-10 px-4 pb-3 pt-2 pointer-events-auto">
          {/* Seek bar */}
          <div className="mb-2">
            <SeekBar
              currentTime={currentTime}
              duration={duration}
              buffered={buffered}
              onSeek={controlsDisabled ? () => {} : handleSeek}
            />
          </div>

          {/* Button row */}
          <div className="flex items-center gap-1">
            {/* Skip back */}
            {!controlsDisabled && (
              <button
                onClick={() => skipSeconds(-10)}
                className="text-white/80 hover:text-white transition-colors p-1.5 rounded-md hover:bg-white/10"
                title="Back 10s"
              >
                <SkipBack size={18} />
              </button>
            )}

            {/* Play/Pause */}
            {!controlsDisabled && (
              <button
                onClick={togglePlay}
                className="text-white hover:text-white transition-colors p-1.5 rounded-md hover:bg-white/10"
                title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
              >
                {isPlaying
                  ? <Pause size={20} fill="white" />
                  : <Play size={20} fill="white" className="ml-0.5" />}
              </button>
            )}

            {/* Skip forward */}
            {!controlsDisabled && (
              <button
                onClick={() => skipSeconds(10)}
                className="text-white/80 hover:text-white transition-colors p-1.5 rounded-md hover:bg-white/10"
                title="Forward 10s"
              >
                <SkipForward size={18} />
              </button>
            )}

            {/* Volume (always individual) */}
            <VolumeControl
              volume={volume}
              muted={muted}
              onVolumeChange={handleVolumeChange}
              onMuteToggle={handleMuteToggle}
            />

            {/* Time display */}
            <div className="flex-1 flex items-center px-2">
              <span className="text-white/70 text-xs font-mono tabular-nums">
                {formatTime(currentTime)}
                <span className="text-white/30 mx-1">/</span>
                {formatTime(duration)}
              </span>
            </div>

            {/* Speed selector */}
            {!controlsDisabled && (
              <SpeedSelector speed={speed} onChange={handleSpeedChange} />
            )}

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="text-white/80 hover:text-white transition-colors p-1.5 rounded-md hover:bg-white/10"
              title="Fullscreen (F)"
            >
              {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Non-owner synced mode overlay message ── */}
      {controlsDisabled && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
          <div className="bg-black/60 border border-white/10 backdrop-blur-sm px-4 py-2 rounded-full text-white/50 text-xs text-center whitespace-nowrap">
            Playback controlled by host
          </div>
        </div>
      )}
    </div>
  );
});

VideoPlayer.displayName = 'VideoPlayer';
export default VideoPlayer;
