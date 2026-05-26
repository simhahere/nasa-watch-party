'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic, MicOff, Video, VideoOff, LogOut, Link2, Copy,
  Check, Users, Settings, ChevronRight, Radio, Gamepad2,
  Music2, Share2, ChevronLeft, X, Tv2, Disc3,
} from 'lucide-react';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import VideoPlayer, { VideoPlayerRef } from '@/components/VideoPlayer';
import ChatPanel from '@/components/ChatPanel';
import MembersList from '@/components/MembersList';
import SelectVideoModal from '@/components/SelectVideoModal';
import SyncService from '@/lib/syncService';
import { useChat } from '@/hooks/useChat';
import { WebRTCStreamService } from '@/lib/webrtcStreamService';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Reaction {
  id: string;
  emoji: string;
  x: number;
  y: number;
}

type SidebarTab = 'chat' | 'members' | 'room';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Floating emoji reaction bubble */
function ReactionBubble({ reaction }: { reaction: Reaction }) {
  return (
    <div
      className="reaction-float select-none"
      style={{ left: `${reaction.x}%`, bottom: '80px' }}
    >
      {reaction.emoji}
    </div>
  );
}

/** Room code pill — click to copy */
function RoomCodePill({ code, isCopied, onCopy }: { code: string; isCopied: boolean; onCopy: () => void }) {
  return (
    <button
      onClick={onCopy}
      className="flex items-center gap-2 px-3 py-1.5 rounded-xl glass border border-white/10
                 hover:border-cyan-400/40 transition-all group"
      title="Copy room code"
    >
      <span className="text-xs text-white/40 font-medium hidden sm:block">ROOM</span>
      <span className="font-mono font-bold text-sm tracking-widest text-cyan-300">{code}</span>
      <span className="text-white/40 group-hover:text-cyan-400 transition-colors">
        {isCopied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
      </span>
    </button>
  );
}

/** Watch-mode toggle button */
function WatchModeToggle({ mode, onToggle }: { mode: 'synced' | 'free'; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border
        ${mode === 'synced'
          ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/25'
          : 'bg-purple-500/15 border-purple-500/30 text-purple-300 hover:bg-purple-500/25'
        }`}
      title={mode === 'synced' ? 'Synced mode — click to switch to Free' : 'Free mode — click to switch to Synced'}
    >
      {mode === 'synced' ? (
        <><Link2 size={12} className="syncing" />Synced</>
      ) : (
        <><Gamepad2 size={12} />Free</>
      )}
    </button>
  );
}

/** Mic / Camera control button */
function ControlBtn({
  active, onIcon, offIcon, label, onToggle, danger = true,
}: {
  active: boolean;
  onIcon: React.ReactNode;
  offIcon: React.ReactNode;
  label: string;
  onToggle: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onToggle}
      title={label}
      className={`flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all text-xs font-medium
        ${!active && danger
          ? 'bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30'
          : 'glass border border-white/10 text-white/70 hover:border-white/20 hover:text-white'
        }`}
    >
      {active ? onIcon : offIcon}
      <span className="hidden sm:block">{label}</span>
    </button>
  );
}

// ─── Name Prompt Modal ─────────────────────────────────────────────────────────

function NamePromptModal({
  onSubmit,
  onGoogleSignIn,
}: {
  onSubmit: (name: string) => void;
  onGoogleSignIn: () => void;
}) {
  const [name, setName] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass rounded-3xl p-8 max-w-sm w-full border border-white/10 shadow-2xl"
      >
        {/* NASA Logo */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center shadow-lg">
            <Tv2 size={28} className="text-white" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-center text-white mb-1">Join the Watch Party</h2>
        <p className="text-center text-white/40 text-sm mb-6">Choose how you want to appear</p>

        {/* Google Sign-in */}
        <button
          onClick={onGoogleSignIn}
          className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl
                     bg-white text-gray-900 font-semibold text-sm hover:bg-gray-100 transition-colors mb-4"
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Continue with Google
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-white/30 text-xs">or join as guest</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        <input
          className="input-glass mb-3"
          placeholder="Your display name"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && name.trim() && onSubmit(name.trim())}
          maxLength={30}
          autoFocus
        />
        <button
          onClick={() => name.trim() && onSubmit(name.trim())}
          disabled={!name.trim()}
          className="btn-primary w-full justify-center disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Join Room 🚀
        </button>
      </motion.div>
    </div>
  );
}

// ─── Select Video Modal wrapper (uses local state) ─────────────────────────────

// ─── Main Room Page ────────────────────────────────────────────────────────────

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const code = (params?.code as string) ?? '';

  // ── Auth & identity ──
  const [user, setUser] = useState<any>(null);
  const [displayName, setDisplayName] = useState('');
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  // ── Video state ──
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [p2pStream, setP2pStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [externalPlayback, setExternalPlayback] = useState<any>(null);

  // ── Room state ──
  const [isOwner, setIsOwner] = useState(false);
  const [watchMode, setWatchMode] = useState<'synced' | 'free'>('synced');
  const [members, setMembers] = useState<Record<string, any>>({});
  const [streamQueue, setStreamQueue] = useState<any[]>([]);

  // ── Chat (Firebase real-time) ──
  const { messages, sendMessage } = useChat(
    code || null,
    user?.uid ?? null,
    displayName || 'Guest',
    user?.photoURL ?? ''
  );

  // ── UI state ──
  const [isMicOn, setIsMicOn] = useState(false);
  const [isCamOn, setIsCamOn] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('chat');
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [isCopied, setIsCopied] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [localFileNotice, setLocalFileNotice] = useState(false);

  const syncRef = useRef<SyncService | null>(null);
  const videoAreaRef = useRef<HTMLDivElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  // ── Derived ──
  const memberCount = Object.keys(members).length;
  const shareMessage = `🎬 Join my NASA Watch Party!\n\nOpen nasa-25483.web.app and enter code: ${code}\n\nEveryone watches together in sync!`;

  const videoMode = localFile
    ? 'local'
    : screenStream
    ? 'local'
    : p2pStream
    ? 'url'
    : streamUrl
    ? 'url'
    : embedUrl
    ? 'embed'
    : null;

  // ─── Auth listener ────────────────────────────────────────────────────────

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        setDisplayName(firebaseUser.displayName ?? '');
        setAuthReady(true);
      } else {
        setUser(null);
        setShowNamePrompt(true);
        setAuthReady(true);
      }
    });
    return () => unsub();
  }, []);

  // ─── Firebase sync setup ──────────────────────────────────────────────────

  useEffect(() => {
    if (!user || !code || !displayName) return;

    const svc = new SyncService(code, user.uid);
    syncRef.current = svc;

    const unsubPlayback = svc.onPlayback(setExternalPlayback);
    const unsubStreamUrl = svc.onStreamUrl((url: string | null) => {
      setStreamUrl(url);
    });
    const unsubEmbedUrl = svc.onEmbedUrl((url: string | null) => {
      setEmbedUrl(url);
    });
    const unsubWatchMode = svc.onWatchMode(setWatchMode);
    const unsubMembers = svc.onMembers((m: Record<string, any>) => {
      setMembers(m);
      // Determine ownership
      const myEntry = m[user.uid];
      if (myEntry?.role === 'owner') {
        setIsOwner(true);
      } else {
        const entries = Object.values(m) as any[];
        const ownerExists = entries.some((e: any) => e.role === 'owner');
        if (!ownerExists) setIsOwner(true);
      }
    });
    const unsubQueue = svc.onStreamQueue(setStreamQueue);

    svc.joinRoom(displayName, user.photoURL ?? '');

    return () => {
      unsubPlayback();
      unsubStreamUrl();
      unsubEmbedUrl();
      unsubWatchMode();
      unsubMembers();
      unsubQueue();
      svc.cleanup();
    };
  }, [user, code, displayName]);

  // ─── WebRTC P2P Stream setup (for both host and viewers) ───────────────────
  const rtcRef = useRef<WebRTCStreamService | null>(null);
  const videoPlayerRef = useRef<VideoPlayerRef | null>(null);

  useEffect(() => {
    if (!user || !code) return;
    const rtc = new WebRTCStreamService(code, user.uid);
    rtcRef.current = rtc;

    // Listen to live stream notifications (for viewers)
    const unsubLive = rtc.onLiveStream(async (info) => {
      if (info && info.active && info.hostUid !== user.uid) {
        console.log('Detected active live stream from host:', info.hostUid, '- connecting...');
        try {
          const stream = await rtc.watchStream(info.hostUid);
          console.log('P2P video stream connected successfully!');
          setP2pStream(stream);
        } catch (err) {
          console.error('Failed to watch P2P stream:', err);
        }
      } else if (!info || !info.active) {
        setP2pStream(null);
      }
    });

    return () => {
      unsubLive();
      rtc.cleanup();
    };
  }, [user, code]);

  // ─── Host local file & screen broadcast ────────────────────────────────────
  useEffect(() => {
    if (!isOwner || !rtcRef.current) return;
    
    // We are broadcasting if videoMode is 'local' (which is active when localFile OR screenStream is present)
    const isLocalBroadcasting = videoMode === 'local' && (localFile || screenStream);
    if (!isLocalBroadcasting) {
      if (isOwner && rtcRef.current) {
        rtcRef.current.stopBroadcast();
      }
      return;
    }

    let active = true;

    // Delay slightly to ensure video player ref is populated / ready to capture
    const timer = setTimeout(async () => {
      if (!active) return;

      const stream = screenStream || videoPlayerRef.current?.captureStream();
      if (stream) {
        console.log('Successfully captured stream for P2P broadcast...');
        try {
          await rtcRef.current?.startBroadcast(stream);
        } catch (err) {
          console.error('Failed to start WebRTC broadcast:', err);
        }
      } else {
        console.warn('Could not capture stream for broadcast. Retrying in 2 seconds...');
        const retryTimer = setTimeout(async () => {
          if (!active) return;
          const retryStream = screenStream || videoPlayerRef.current?.captureStream();
          if (retryStream) {
            try {
              await rtcRef.current?.startBroadcast(retryStream);
            } catch (err) {
              console.error('Failed to start WebRTC broadcast on retry:', err);
            }
          }
        }, 2000);
        return () => clearTimeout(retryTimer);
      }
    }, 1000);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [isOwner, videoMode, localFile, screenStream]);

  // ─── Local Webcam Capture ──────────────────────────────────────────────────
  useEffect(() => {
    let activeStream: MediaStream | null = null;

    const startCamera = async () => {
      if (isCamOn) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 300, height: 300, facingMode: 'user' },
            audio: false,
          });
          setCameraStream(stream);
          activeStream = stream;
        } catch (err) {
          console.error('Failed to access camera:', err);
          setIsCamOn(false);
        }
      } else {
        if (cameraStream) {
          cameraStream.getTracks().forEach((t) => t.stop());
          setCameraStream(null);
        }
      }
    };

    startCamera();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [isCamOn]);

  // ─── Screen share handlers ────────────────────────────────────────────────
  const handleStartScreenShare = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
        },
        audio: true, // Captures tab/system audio!
      });
      
      setScreenStream(stream);
      setLocalFile(null);
      setStreamUrl(null);
      setEmbedUrl(null);
      
      // Stop broadcast if the user clicks browser's native "Stop Sharing" bubble
      stream.getVideoTracks()[0].onended = () => {
        setScreenStream(null);
        if (rtcRef.current) rtcRef.current.stopBroadcast();
      };
    } catch (err) {
      console.error('Failed to capture screen sharing:', err);
    }
  }, []);

  // ─── Video selection handlers ─────────────────────────────────────────────

  const handleSelectUrl = useCallback((url: string) => {
    setStreamUrl(url);
    setEmbedUrl(null);
    setLocalFile(null);
    setLocalFileNotice(false);
    syncRef.current?.setStreamUrl(url);
    setShowVideoModal(false);
  }, []);

  const handleSelectEmbed = useCallback((url: string) => {
    setEmbedUrl(url);
    setStreamUrl(null);
    setLocalFile(null);
    setLocalFileNotice(false);
    syncRef.current?.setEmbedUrl(url);
    setShowVideoModal(false);
  }, []);

  const handleSelectFile = useCallback((file: File) => {
    setLocalFile(file);
    setStreamUrl(null);
    setEmbedUrl(null);
    setLocalFileNotice(true);
    setShowVideoModal(false);
    setTimeout(() => setLocalFileNotice(false), 5000);
  }, []);

  // ─── Playback sync ────────────────────────────────────────────────────────

  const handlePlaybackChange = useCallback((state: any) => {
    if (isOwner && watchMode === 'synced') {
      syncRef.current?.publishPlayback({ ...state, ownerId: user?.uid });
    }
  }, [isOwner, watchMode, user]);

  // ─── Floating reactions ───────────────────────────────────────────────────

  const fireReaction = useCallback((emoji: string) => {
    const id = generateId();
    const x = Math.floor(Math.random() * 61) + 20; // 20–80%
    const y = Math.random() * 20 + 60; // bottom area
    const r: Reaction = { id, emoji, x, y };
    setReactions(prev => [...prev, r]);
    setTimeout(() => {
      setReactions(prev => prev.filter(rx => rx.id !== id));
    }, 2100);
  }, []);

  // ─── Copy room code ───────────────────────────────────────────────────────

  const handleCopyCode = useCallback(() => {
    navigator.clipboard.writeText(code).catch(() => {});
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  }, [code]);

  const handleCopyShare = useCallback(() => {
    navigator.clipboard.writeText(shareMessage).catch(() => {});
  }, [shareMessage]);

  // ─── Watch mode toggle ────────────────────────────────────────────────────

  const toggleWatchMode = useCallback(() => {
    const next = watchMode === 'synced' ? 'free' : 'synced';
    setWatchMode(next);
    syncRef.current?.setWatchMode?.(next);
  }, [watchMode]);

  // ─── Google Sign-in ───────────────────────────────────────────────────────

  const handleGoogleSignIn = useCallback(async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      if (result.user) {
        setUser(result.user);
        setDisplayName(result.user.displayName ?? 'Guest');
        setShowNamePrompt(false);
      }
    } catch (e) {
      console.error('Google sign-in error:', e);
    }
  }, []);

  // ─── Name submit ──────────────────────────────────────────────────────────

  const handleNameSubmit = useCallback((name: string) => {
    setDisplayName(name);
    setShowNamePrompt(false);
    // Create an anonymous-ish user object
    setUser({ uid: `guest_${generateId()}`, displayName: name, photoURL: '' });
  }, []);

  // ─── Leave room ───────────────────────────────────────────────────────────

  const handleLeave = useCallback(() => {
    syncRef.current?.cleanup();
    router.push('/');
  }, [router]);

  // ─── Render guards ────────────────────────────────────────────────────────

  if (!authReady) {
    return (
      <div className="bg-animated min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-cyan-400/50 border-t-cyan-400 animate-spin" />
          <p className="text-white/40 text-sm">Loading watch party…</p>
        </div>
      </div>
    );
  }

  if (showNamePrompt) {
    return (
      <div className="bg-animated min-h-screen">
        <NamePromptModal onSubmit={handleNameSubmit} onGoogleSignIn={handleGoogleSignIn} />
      </div>
    );
  }

  // ─── Full-screen room layout ──────────────────────────────────────────────

  return (
    <div className="bg-animated flex flex-col h-screen w-screen overflow-hidden">

      {/* ── Floating reactions ── */}
      <AnimatePresence>
        {reactions.map(r => (
          <motion.div
            key={r.id}
            initial={{ y: 0, opacity: 1, scale: 1 }}
            animate={{ y: -140, opacity: 0, scale: 1.6 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2, ease: 'easeOut' }}
            className="fixed pointer-events-none z-[9999] text-3xl select-none"
            style={{ left: `${r.x}%`, bottom: '90px' }}
          >
            {r.emoji}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* ── Local file notice ── */}
      <AnimatePresence>
        {localFileNotice && (
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-50 glass border border-yellow-400/30
                       text-yellow-300 text-sm px-4 py-2 rounded-xl flex items-center gap-2"
          >
            <span>⚠️</span>
            <span>Local file loaded — sync not available for local files.</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════════════════════════════════════════════════════════════
          TOP BAR
      ════════════════════════════════════════════════════════════ */}
      <header className="flex items-center justify-between px-3 md:px-4 h-13 shrink-0
                          glass border-b border-white/[0.06] z-30" style={{ height: 52 }}>

        {/* Left: NASA logo + room code */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* Mobile sidebar toggle */}
          <button
            className="md:hidden glass border border-white/10 p-1.5 rounded-xl hover:border-white/20 transition-all"
            onClick={() => setShowSidebar(s => !s)}
          >
            {showSidebar ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>

          {/* NASA icon */}
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-purple-600
                          flex items-center justify-center shrink-0 shadow-md">
            <Tv2 size={14} className="text-white" />
          </div>

          {/* Room code */}
          <RoomCodePill code={code} isCopied={isCopied} onCopy={handleCopyCode} />

          {/* Streaming badges */}
          {isOwner && videoMode === 'local' && (
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-xl
                             bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-semibold">
              <span className="relative flex items-center">
                <span className="w-2 h-2 rounded-full bg-red-500 relative pulse-dot" />
              </span>
              <span>You are Live</span>
              <button
                type="button"
                onClick={() => {
                  if (screenStream) {
                    screenStream.getTracks().forEach((t) => t.stop());
                    setScreenStream(null);
                  }
                  setLocalFile(null);
                  setP2pStream(null);
                  if (rtcRef.current) rtcRef.current.stopBroadcast();
                }}
                className="ml-1 px-1.5 py-0.5 rounded bg-red-500/20 hover:bg-red-500/40 text-red-200 text-[10px] uppercase font-bold border border-red-500/30 transition-all active:scale-95 cursor-pointer"
                title="Stop broadcasting this file for everyone"
              >
                Stop Live
              </button>
            </div>
          )}
          {isOwner && videoMode !== 'local' && videoMode !== null && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg
                             bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-semibold">
              <span className="relative flex items-center">
                <span className="w-2 h-2 rounded-full bg-red-400 relative pulse-dot" />
              </span>
              <span>You are Streaming</span>
              <button
                type="button"
                onClick={() => {
                  setStreamUrl(null);
                  setEmbedUrl(null);
                  syncRef.current?.clearVideo();
                }}
                className="ml-1 px-1.5 py-0.5 rounded bg-red-500/20 hover:bg-red-500/40 text-red-200 text-[10px] uppercase font-bold border border-red-500/30 transition-all active:scale-95 cursor-pointer"
                title="Stop streaming this video for everyone"
              >
                Stop
              </button>
            </div>
          )}
          {!isOwner && p2pStream && (
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-xl
                             bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs font-semibold">
              <span className="relative flex items-center">
                <span className="w-2 h-2 rounded-full bg-cyan-400 relative pulse-dot" />
              </span>
              <span>Host Live Stream</span>
              <button
                type="button"
                onClick={() => {
                  setP2pStream(null);
                }}
                className="ml-1 px-1.5 py-0.5 rounded bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-100 text-[10px] uppercase font-bold border border-cyan-500/30 transition-all active:scale-95 cursor-pointer"
                title="Disconnect from P2P stream"
              >
                Disconnect
              </button>
            </div>
          )}
        </div>

        {/* Right: Watch mode toggle + members + settings + leave */}
        <div className="flex items-center gap-1.5 md:gap-2">
          <WatchModeToggle mode={watchMode} onToggle={toggleWatchMode} />

          {/* Members count */}
          <button
            onClick={() => { setSidebarTab('members'); setShowSidebar(true); }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 glass border border-white/10
                       rounded-xl hover:border-white/20 transition-all text-xs text-white/60 font-medium"
          >
            <Users size={13} />
            <span>{memberCount}</span>
          </button>

          {/* Settings */}
          <button
            className="w-8 h-8 glass border border-white/10 rounded-xl flex items-center justify-center
                       hover:border-white/20 hover:text-white text-white/50 transition-all"
            title="Settings"
          >
            <Settings size={14} />
          </button>

          {/* Leave */}
          <button
            onClick={handleLeave}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold
                       bg-red-500/15 border border-red-500/30 text-red-400
                       hover:bg-red-500/25 hover:border-red-500/50 transition-all"
          >
            <LogOut size={12} />
            <span className="hidden sm:block">Leave</span>
          </button>
        </div>
      </header>

      {/* ════════════════════════════════════════════════════════════
          MIDDLE: VIDEO + SIDEBAR
      ════════════════════════════════════════════════════════════ */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* ── Video area ── */}
        <div ref={videoAreaRef} className="flex-1 min-w-0 flex flex-col items-center justify-center p-3 md:p-4 bg-black/30 relative">
          {videoMode ? (
            <div className="w-full h-full max-h-full relative rounded-2xl overflow-hidden">
              <VideoPlayer
                ref={videoPlayerRef}
                streamUrl={streamUrl}
                embedUrl={embedUrl}
                localFile={localFile}
                externalState={externalPlayback}
                onPlaybackChange={handlePlaybackChange}
                isOwner={isOwner}
                watchMode={watchMode}
                p2pStream={p2pStream}
                screenStream={screenStream}
              />
            </div>
          ) : (
            /* Empty state */
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center gap-5 text-center p-8 max-w-sm"
            >
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-cyan-500/20 to-purple-600/20
                              border border-white/10 flex items-center justify-center">
                <Tv2 size={42} className="text-white/20" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white/80 mb-1">No Video Selected</h3>
                <p className="text-sm text-white/30 leading-relaxed">
                  {isOwner
                    ? 'Select a video to start the watch party for everyone.'
                    : 'Waiting for the host to start the video…'}
                </p>
              </div>
              {isOwner && (
                <button
                  onClick={() => setShowVideoModal(true)}
                  className="btn-primary"
                >
                  <Tv2 size={16} /> Select Video
                </button>
              )}
            </motion.div>
          )}

          {/* Draggable Spherical Webcam Preview */}
          {isCamOn && cameraStream && (
            <motion.div
              drag
              dragConstraints={videoAreaRef}
              dragElastic={0.1}
              dragMomentum={false}
              initial={{ right: 32, top: 32 }}
              className="absolute z-40 w-28 h-28 md:w-32 md:h-32 rounded-full overflow-hidden border-[3px] border-cyan-400 shadow-2xl cursor-grab active:cursor-grabbing flex items-center justify-center bg-black/20"
              style={{
                boxShadow: '0 0 20px rgba(0, 212, 255, 0.45), inset 0 0 15px rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(4px)'
              }}
            >
              <video
                ref={(el) => {
                  if (el) el.srcObject = cameraStream;
                }}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover rounded-full transform -scale-x-100"
              />
            </motion.div>
          )}
        </div>

        {/* ── Sidebar (desktop: always visible, mobile: overlay) ── */}
        <AnimatePresence>
          {showSidebar && (
            <motion.aside
              key="sidebar"
              initial={{ x: 320, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 320, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="w-[320px] shrink-0 flex flex-col glass border-l border-white/[0.07]
                         absolute md:relative right-0 top-0 bottom-0 z-20 md:z-auto"
            >
              {/* Sidebar tab bar */}
              <div className="flex border-b border-white/[0.07] shrink-0">
                {(['chat', 'members', 'room'] as SidebarTab[]).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setSidebarTab(tab)}
                    className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider transition-all
                      ${sidebarTab === tab
                        ? 'text-cyan-300 border-b-2 border-cyan-400'
                        : 'text-white/30 hover:text-white/60'
                      }`}
                  >
                    {tab === 'chat' && '💬 Chat'}
                    {tab === 'members' && '👥 Members'}
                    {tab === 'room' && '🏠 Room'}
                  </button>
                ))}
              </div>

              {/* Sidebar content */}
              <div className="flex-1 overflow-hidden flex flex-col">
                <AnimatePresence mode="wait">
                  {sidebarTab === 'chat' && (
                    <motion.div
                      key="chat"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.15 }}
                      className="flex-1 overflow-hidden flex flex-col"
                    >
                      <ChatPanel
                        messages={messages}
                        onSend={sendMessage}
                        currentUserId={user?.uid ?? ''}
                        currentUserName={displayName || 'Guest'}
                      />
                    </motion.div>
                  )}

                  {sidebarTab === 'members' && (
                    <motion.div
                      key="members"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.15 }}
                      className="flex-1 overflow-y-auto p-3"
                    >
                      <MembersList
                        members={members}
                        currentUserId={user?.uid ?? ''}
                        ownerId={isOwner ? (user?.uid ?? '') : ''}
                        streamQueue={streamQueue}
                      />
                    </motion.div>
                  )}

                  {sidebarTab === 'room' && (
                    <motion.div
                      key="room"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.15 }}
                      className="flex-1 overflow-y-auto p-4"
                    >
                      <RoomInfoCard
                        code={code}
                        shareMessage={shareMessage}
                        onCopyShare={handleCopyShare}
                        memberCount={memberCount}
                        isOwner={isOwner}
                      />

                      {/* Stream Queue */}
                      {streamQueue.length > 0 && (
                        <div className="mt-4">
                          <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2 flex items-center gap-1">
                            <Disc3 size={11} /> Queue ({streamQueue.length})
                          </h4>
                          <div className="flex flex-col gap-2">
                            {streamQueue.map((item: any, i: number) => (
                              <div key={i} className="glass border border-white/10 rounded-xl p-2.5 text-xs text-white/60 truncate">
                                {i + 1}. {item.title ?? item.url ?? 'Untitled'}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Mobile close button */}
              <button
                className="md:hidden absolute top-2 right-2 w-7 h-7 rounded-lg glass border border-white/10
                           flex items-center justify-center hover:border-white/20 transition-all text-white/50"
                onClick={() => setShowSidebar(false)}
              >
                <X size={13} />
              </button>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {/* ════════════════════════════════════════════════════════════
          BOTTOM BAR
      ════════════════════════════════════════════════════════════ */}
      <footer className="shrink-0 glass border-t border-white/[0.06] px-3 md:px-5 z-30"
              style={{ height: 64 }}>
        <div className="flex items-center justify-between h-full gap-2">

          {/* Left: Mic + Cam */}
          <div className="flex items-center gap-1.5">
            <ControlBtn
              active={isMicOn}
              onIcon={<Mic size={16} />}
              offIcon={<MicOff size={16} />}
              label={isMicOn ? 'Mic On' : 'Muted'}
              onToggle={() => setIsMicOn(v => !v)}
            />
            <ControlBtn
              active={isCamOn}
              onIcon={<Video size={16} />}
              offIcon={<VideoOff size={16} />}
              label={isCamOn ? 'Cam On' : 'Cam Off'}
              onToggle={() => setIsCamOn(v => !v)}
            />
          </div>

          {/* Center: Select Video + DJ Queue */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowVideoModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-2xl glass border border-cyan-500/30
                         text-cyan-300 text-xs font-semibold hover:bg-cyan-500/10 hover:border-cyan-500/50 transition-all"
            >
              <Tv2 size={14} />
              <span className="hidden sm:block">Select Video</span>
            </button>

            <button
              onClick={() => setShowQueue(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-semibold transition-all border
                ${showQueue
                  ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                  : 'glass border-white/10 text-white/50 hover:border-white/20'
                }`}
            >
              <Music2 size={14} />
              <span className="hidden sm:block">Queue</span>
              {streamQueue.length > 0 && (
                <span className="bg-purple-500 text-white rounded-full text-[10px] px-1 min-w-[16px] text-center">
                  {streamQueue.length}
                </span>
              )}
            </button>
          </div>

          {/* Right: Reactions */}
          <div className="flex items-center gap-1">
            {['😂', '❤️', '🔥', '👏', '😮'].map(emoji => (
              <button
                key={emoji}
                onClick={() => fireReaction(emoji)}
                className="w-9 h-9 flex items-center justify-center rounded-2xl glass border border-white/10
                           text-lg hover:bg-white/10 hover:border-white/20 hover:scale-110
                           active:scale-95 transition-all duration-150"
                title={`React ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </footer>

      {/* ── Select Video Modal ── */}
      <AnimatePresence>
        {showVideoModal && (
          <SelectVideoModal
            isOpen={showVideoModal}
            onClose={() => setShowVideoModal(false)}
            onSelectUrl={handleSelectUrl}
            onSelectEmbed={handleSelectEmbed}
            onSelectFile={handleSelectFile}
            onStartScreenShare={handleStartScreenShare}
            isOwner={isOwner}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Room Info Card ────────────────────────────────────────────────────────────

function RoomInfoCard({
  code,
  shareMessage,
  onCopyShare,
  memberCount,
  isOwner,
}: {
  code: string;
  shareMessage: string;
  onCopyShare: () => void;
  memberCount: number;
  isOwner: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [sharedMsg, setSharedMsg] = useState(false);

  const copyCode = () => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyShare = () => {
    onCopyShare();
    setSharedMsg(true);
    setTimeout(() => setSharedMsg(false), 2000);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Room code card */}
      <div className="glass rounded-2xl p-5 border border-white/10 text-center">
        <p className="text-xs text-white/30 uppercase tracking-widest mb-2 font-medium">Room Code</p>
        <div className="room-code mb-4">{code}</div>
        <button
          onClick={copyCode}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl
                     bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-sm font-semibold
                     hover:bg-cyan-500/20 transition-all"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copied!' : 'Copy Code'}
        </button>
      </div>

      {/* Share card */}
      <div className="glass rounded-2xl p-4 border border-purple-500/20">
        <div className="flex items-center gap-2 mb-3">
          <Share2 size={14} className="text-purple-400" />
          <span className="text-xs font-semibold text-purple-300 uppercase tracking-wider">Invite Friends</span>
        </div>
        <p className="text-xs text-white/40 leading-relaxed bg-white/[0.03] rounded-xl p-3 mb-3 font-mono">
          {shareMessage}
        </p>
        <button
          onClick={copyShare}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl
                     bg-purple-500/10 border border-purple-500/30 text-purple-300 text-sm font-semibold
                     hover:bg-purple-500/20 transition-all"
        >
          {sharedMsg ? <Check size={14} /> : <Share2 size={14} />}
          {sharedMsg ? 'Message Copied!' : 'Copy Invite'}
        </button>
      </div>

      {/* Stats */}
      <div className="glass rounded-2xl p-4 border border-white/10">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-white/50">
            <Users size={14} />
            <span>Members</span>
          </div>
          <span className="font-bold text-cyan-300">{memberCount}</span>
        </div>
        {isOwner && (
          <div className="mt-2 flex items-center gap-2 text-xs text-red-400">
            <span className="w-2 h-2 rounded-full bg-red-400 relative pulse-dot" />
            You are the host
          </div>
        )}
      </div>
    </div>
  );
}
