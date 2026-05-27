'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic, MicOff, Video, VideoOff, LogOut, Link2, Copy,
  Check, Users, Gamepad2, Music2, Share2, X, Tv2,
  Maximize2, Send, Wifi, WifiOff, ChevronDown, ChevronUp,
} from 'lucide-react';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signInAnonymously } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import VideoPlayer, { VideoPlayerRef } from '@/components/VideoPlayer';
import ChatPanel from '@/components/ChatPanel';
import MembersList from '@/components/MembersList';
import SelectVideoModal from '@/components/SelectVideoModal';
import VideoGrid from '@/components/VideoGrid';
import SyncService from '@/lib/syncService';
import { useChat } from '@/hooks/useChat';
import { WebRTCStreamService } from '@/lib/webrtcStreamService';
import { WebcamMeshService } from '@/lib/webcamMeshService';


// --- Types ---
interface Reaction { id: string; emoji: string; x: number; }
type SidebarTab = 'chat' | 'members' | 'room';

function generateId() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

// --- RoomCodePill ---
function RoomCodePill({ code, isCopied, onCopy }: { code: string; isCopied: boolean; onCopy: () => void }) {
  return (
    <button onClick={onCopy} className="flex items-center gap-2 px-3 py-1.5 rounded-xl glass border border-white/10 hover:border-cyan-400/40 transition-all group" title="Copy room code">
      <span className="text-xs text-white/40 font-medium hidden sm:block">ROOM</span>
      <span className="font-mono font-bold text-sm tracking-widest text-cyan-300">{code}</span>
      <span className="text-white/40 group-hover:text-cyan-400 transition-colors">
        {isCopied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
      </span>
    </button>
  );
}

// --- ControlBtn ---
function ControlBtn({ active, onIcon, offIcon, label, onToggle, danger = true }: { active: boolean; onIcon: React.ReactNode; offIcon: React.ReactNode; label: string; onToggle: () => void; danger?: boolean; }) {
  return (
    <button onClick={onToggle} title={label} className={`flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all text-xs font-medium ${!active && danger ? 'bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30' : 'glass border border-white/10 text-white/70 hover:border-white/20 hover:text-white'}`}>
      {active ? onIcon : offIcon}
      <span className="hidden sm:block">{label}</span>
    </button>
  );
}

// --- NamePromptModal ---
function NamePromptModal({ onSubmit, onGoogleSignIn }: { onSubmit: (name: string) => void; onGoogleSignIn: () => void; }) {
  const [name, setName] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass rounded-3xl p-8 max-w-sm w-full border border-white/10 shadow-2xl">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center shadow-lg">
            <Tv2 size={28} className="text-white" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-center text-white mb-1">Join the Watch Party</h2>
        <p className="text-center text-white/40 text-sm mb-6">Choose how you want to appear</p>
        <button onClick={onGoogleSignIn} className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-white text-gray-900 font-semibold text-sm hover:bg-gray-100 transition-colors mb-4">
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
        <input className="input-glass mb-3" placeholder="Your display name" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && name.trim() && onSubmit(name.trim())} maxLength={30} autoFocus />
        <button onClick={() => name.trim() && onSubmit(name.trim())} disabled={!name.trim()} className="btn-primary w-full justify-center disabled:opacity-40 disabled:cursor-not-allowed">
          Join Room 🚀
        </button>
      </motion.div>
    </div>
  );
}

// --- RoomInfoCard ---
function RoomInfoCard({ code, shareUrl, onCopyShare, memberCount, isOwner }: { code: string; shareUrl: string; onCopyShare: () => void; memberCount: number; isOwner: boolean; }) {
  const [copied, setCopied] = useState(false);
  const [sharedMsg, setSharedMsg] = useState(false);
  const copyCode = () => { navigator.clipboard.writeText(code).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const copyShare = () => { onCopyShare(); setSharedMsg(true); setTimeout(() => setSharedMsg(false), 2000); };
  return (
    <div className="flex flex-col gap-4">
      <div className="glass rounded-2xl p-5 border border-white/10 text-center">
        <p className="text-xs text-white/30 uppercase tracking-widest mb-2 font-medium">Room Code</p>
        <div className="room-code mb-4">{code}</div>
        <button onClick={copyCode} className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-sm font-semibold hover:bg-cyan-500/20 transition-all">
          {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied!' : 'Copy Code'}
        </button>
      </div>
      <div className="glass rounded-2xl p-4 border border-purple-500/20">
        <div className="flex items-center gap-2 mb-3"><Share2 size={14} className="text-purple-400" /><span className="text-xs font-semibold text-purple-300 uppercase tracking-wider">Invite Link</span></div>
        <p className="text-xs text-white/40 leading-relaxed bg-white/[0.03] rounded-xl p-3 mb-3 font-mono break-all">{shareUrl}</p>
        <button onClick={copyShare} className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 text-sm font-semibold hover:bg-purple-500/20 transition-all">
          {sharedMsg ? <Check size={14} /> : <Share2 size={14} />} {sharedMsg ? 'Link Copied!' : 'Copy Invite Link'}
        </button>
      </div>
      <div className="glass rounded-2xl p-4 border border-white/10">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-white/50"><Users size={14} /><span>Members</span></div>
          <span className="font-bold text-cyan-300">{memberCount}</span>
        </div>
        {isOwner && <div className="mt-2 flex items-center gap-2 text-xs text-red-400"><span className="w-2 h-2 rounded-full bg-red-400 relative pulse-dot" />You are the host</div>}
      </div>
    </div>
  );
}

// ============================================================
// MAIN ROOM PAGE
// ============================================================
export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const code = (params?.code as string) ?? '';

  const [user, setUser] = useState<any>(null);
  const [displayName, setDisplayName] = useState('');
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [p2pStream, setP2pStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [externalPlayback, setExternalPlayback] = useState<any>(null);
  const [currentVideoTitle, setCurrentVideoTitle] = useState('');

  const [isOwner, setIsOwner] = useState(false);
  const [members, setMembers] = useState<Record<string, any>>({});
  const [streamQueue, setStreamQueue] = useState<any[]>([]);

  const { messages, sendMessage } = useChat(code || null, user?.uid ?? null, displayName || 'Guest', user?.photoURL ?? '');

  const [isMicOn, setIsMicOn] = useState(false);
  const [isCamOn, setIsCamOn] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [chatMode, setChatMode] = useState<'sidebar' | 'popup'>('sidebar');
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('chat');
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [isCopied, setIsCopied] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [popupMessages, setPopupMessages] = useState<Array<{ id: string; sender: string; text: string }>>([]);
  const [roomNotifications, setRoomNotifications] = useState<Array<{ id: string; text: string; type: 'join' | 'leave' }>>([]);
  const prevMessagesLenRef = useRef(0);
  const prevMembersRef = useRef<Record<string, any>>({});

  const syncRef = useRef<SyncService | null>(null);
  const videoAreaRef = useRef<HTMLDivElement>(null);
  const videoPlayerRef = useRef<VideoPlayerRef | null>(null);
  const rtcRef = useRef<WebRTCStreamService | null>(null);
  const webcamMeshRef = useRef<WebcamMeshService | null>(null);
  
  const [localMediaStream, setLocalMediaStream] = useState<MediaStream | null>(null);
  const [peerStreams, setPeerStreams] = useState<Record<string, MediaStream>>({});

  const onlineMemberCount = Object.values(members || {}).filter((m: any) => m?.online).length;
  const memberCount = onlineMemberCount;
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/room/${code}` : `https://nasa-25483.web.app/room/${code}`;

  // Online/offline
  useEffect(() => {
    const on = () => setIsOnline(true), off = () => setIsOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // Cleanup on tab close
  useEffect(() => {
    const bye = () => syncRef.current?.leaveRoom();
    window.addEventListener('beforeunload', bye);
    return () => window.removeEventListener('beforeunload', bye);
  }, []);

  // Auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (fu) => {
      if (fu) { setUser(fu); setDisplayName(fu.displayName ?? ''); setShowNamePrompt(false); }
      else { setUser(null); setShowNamePrompt(true); }
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Firebase sync
  useEffect(() => {
    if (!user || !code || !displayName) return;
    const svc = new SyncService(code, user.uid);
    syncRef.current = svc;

    const u1 = svc.onPlayback(setExternalPlayback);
    const u2 = svc.onStreamUrl((url) => setStreamUrl(url));
    const u3 = svc.onEmbedUrl((url) => setEmbedUrl(url));
    const u5 = svc.onMembers((m) => {
      // Detect join/leave and media toggles
      const prevM = prevMembersRef.current;
      Object.entries(m || {}).forEach(([uid, member]: [string, any]) => {
        if (uid === user.uid) return;
        const prev = prevM[uid];
        const name = member?.name || prev?.name || 'Someone';
        
        if (member?.online && (!prev || !prev.online)) {
          // User joined
          const nid = generateId();
          setRoomNotifications(prev => [...prev, { id: nid, text: `${name} joined the room`, type: 'join' as const }]);
          setTimeout(() => setRoomNotifications(prev => prev.filter(n => n.id !== nid)), 4000);
        } else if (!member?.online && prev?.online) {
          // User left
          const nid = generateId();
          setRoomNotifications(prev => [...prev, { id: nid, text: `${name} left the room`, type: 'leave' as const }]);
          setTimeout(() => setRoomNotifications(prev => prev.filter(n => n.id !== nid)), 4000);
        } else if (member?.online && prev?.online) {
          // Media toggles
          if (member.isCamOn && !prev.isCamOn) {
            const nid = generateId();
            setRoomNotifications(p => [...p, { id: nid, text: `${name} turned camera on`, type: 'join' as const }]);
            setTimeout(() => setRoomNotifications(p => p.filter(n => n.id !== nid)), 4000);
          } else if (!member.isCamOn && prev.isCamOn) {
            const nid = generateId();
            setRoomNotifications(p => [...p, { id: nid, text: `${name} turned camera off`, type: 'leave' as const }]);
            setTimeout(() => setRoomNotifications(p => p.filter(n => n.id !== nid)), 4000);
          }

          if (member.isMicOn && !prev.isMicOn) {
            const nid = generateId();
            setRoomNotifications(p => [...p, { id: nid, text: `${name} unmuted`, type: 'join' as const }]);
            setTimeout(() => setRoomNotifications(p => p.filter(n => n.id !== nid)), 4000);
          } else if (!member.isMicOn && prev.isMicOn) {
            const nid = generateId();
            setRoomNotifications(p => [...p, { id: nid, text: `${name} muted`, type: 'leave' as const }]);
            setTimeout(() => setRoomNotifications(p => p.filter(n => n.id !== nid)), 4000);
          }
        }
      });
      prevMembersRef.current = { ...(m || {}) };

      setMembers(m);
      const mine = m[user.uid];
      if (mine?.role === 'owner') {
        setIsOwner(true);
      } else {
        const hasExplicitOwner = Object.values(m || {}).some((e: any) => e.role === 'owner' && e.online);
        if (!hasExplicitOwner) {
          // Fallback: If no explicit owner is online, elect the oldest online member as the host
          const onlineMembers = Object.values(m || {})
            .filter((e: any) => e.online)
            .sort((a: any, b: any) => {
              const aTime = typeof a.lastSeen === 'number' ? a.lastSeen : 0;
              const bTime = typeof b.lastSeen === 'number' ? b.lastSeen : 0;
              return aTime - bTime;
            });
          setIsOwner(onlineMembers[0]?.uid === user.uid);
        } else {
          setIsOwner(false);
        }
      }
    });
    const u6 = svc.onStreamQueue(setStreamQueue);

    // Unified video source (Cloudinary)
    const u7 = (svc as any).onVideoSource?.((source: any) => {
      if (source?.url) {
        source.type === 'embed' ? (setEmbedUrl(source.url), setStreamUrl(null)) : (setStreamUrl(source.url), setEmbedUrl(null));
        setCurrentVideoTitle(source.title || '');
      } else setCurrentVideoTitle('');
    });

    let firstReaction = true;
    const u8 = svc.onReaction((emoji) => { if (firstReaction) { firstReaction = false; return; } fireReaction(emoji); });

    const isCreator = localStorage.getItem('nasa_room_code') === code;
    svc.joinRoom(displayName, user.photoURL ?? '', isCreator ? 'owner' : 'member');
    return () => { u1(); u2(); u3(); u5(); u6(); u8(); if (typeof u7 === 'function') u7(); svc.leaveRoom(); svc.cleanup(); };
  }, [user, code, displayName]);

  // P2P viewer stream
  useEffect(() => {
    if (!user || !code) return;
    const rtc = new WebRTCStreamService(code, user.uid);
    rtcRef.current = rtc;
    const u = rtc.onLiveStream(async (info) => {
      if (info?.active && info.hostUid !== user.uid) {
        try { setP2pStream(await rtc.watchStream(info.hostUid)); } catch {}
      } else if (!info?.active) setP2pStream(null);
    });
    return () => { u(); rtc.cleanup(); };
  }, [user, code]);

  // Host screen broadcast
  useEffect(() => {
    if (!isOwner || !rtcRef.current || !screenStream) { if (isOwner) rtcRef.current?.stopBroadcast(); return; }
    let active = true;
    const iv = setInterval(async () => {
      if (!active) { clearInterval(iv); return; }
      if (screenStream.getTracks().length > 0) { clearInterval(iv); await rtcRef.current?.startBroadcast(screenStream).catch(console.error); }
    }, 1000);
    return () => { active = false; clearInterval(iv); };
  }, [isOwner, screenStream]);

  // WebRTC mesh
  useEffect(() => {
    if (!user || !code) return;
    const mesh = new WebcamMeshService(code, user.uid, (uid, stream) => {
      setPeerStreams(prev => {
        const n = { ...prev };
        if (stream) n[uid] = stream;
        else delete n[uid];
        return n;
      });
    });
    webcamMeshRef.current = mesh;
    return () => {
      mesh.cleanup();
      webcamMeshRef.current = null;
    };
  }, [user, code]);

  useEffect(() => {
    webcamMeshRef.current?.updateMembers(members);
  }, [members]);

  // Local media
  useEffect(() => {
    let active: MediaStream | null = null;
    const go = async () => {
      if (isCamOn || isMicOn) {
        try {
          const s = await navigator.mediaDevices.getUserMedia({ video: isCamOn ? { width: 320, height: 320, facingMode: 'user' } : false, audio: isMicOn });
          setLocalMediaStream(s); active = s;
          syncRef.current?.updateMemberStatus({ isCamOn, isMicOn });
        } catch { if (isCamOn) setIsCamOn(false); if (isMicOn) setIsMicOn(false); }
      } else { localMediaStream?.getTracks().forEach(t => t.stop()); setLocalMediaStream(null); }
    };
    go();
    return () => { active?.getTracks().forEach(t => t.stop()); };
  }, [isCamOn, isMicOn]);
  
  useEffect(() => {
    webcamMeshRef.current?.updateLocalStream(localMediaStream);
  }, [localMediaStream]);

  // Master unmount and back button navigation cleanup
  useEffect(() => {
    return () => {
      console.log('[RoomClient] Component unmounted. Force cleaning room signals and hardware tracks.');
      try {
        syncRef.current?.leaveRoom();
        syncRef.current?.cleanup();
      } catch (e) {
        console.warn('[RoomClient] Error during sync service exit:', e);
      }
      try {
        webcamMeshRef.current?.cleanup();
      } catch (e) {
        console.warn('[RoomClient] Error during webcam mesh exit:', e);
      }
      try {
        rtcRef.current?.cleanup();
      } catch (e) {
        console.warn('[RoomClient] Error during RTC service exit:', e);
      }
    };
  }, []);

  // Vanishing popup chat
  useEffect(() => {
    const curLen = (messages || []).length, prevLen = prevMessagesLenRef.current;
    prevMessagesLenRef.current = curLen;
    const hidden = chatMode === 'popup' || !showSidebar || sidebarTab !== 'chat';
    if (!hidden || curLen <= prevLen) return;
    (messages || []).slice(prevLen).forEach((msg: any) => {
      const pid = generateId();
      const sender = (msg.senderId ?? msg.sender) === user?.uid ? 'You' : String(msg.sender ?? 'Guest');
      setPopupMessages(prev => [...prev, { id: pid, sender, text: String(msg.text ?? '') }].slice(-2));
      setTimeout(() => setPopupMessages(prev => prev.filter(p => p.id !== pid)), 4000);
    });
  }, [messages, chatMode, showSidebar, sidebarTab, user]);

  // Handlers
  const fireReaction = useCallback((emoji: string) => {
    const id = generateId(), x = Math.floor(Math.random() * 61) + 20;
    setReactions(prev => [...prev, { id, emoji, x }]);
    setTimeout(() => setReactions(prev => prev.filter(r => r.id !== id)), 2100);
  }, []);

  const handleStartScreenShare = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: 'always' } as any, audio: true });
      setScreenStream(s); setStreamUrl(null); setEmbedUrl(null);
      s.getVideoTracks()[0].onended = () => { setScreenStream(null); rtcRef.current?.stopBroadcast(); };
    } catch {}
  }, []);

  const handleSelectUrl = useCallback((url: string) => {
    setStreamUrl(url); setEmbedUrl(null); setCurrentVideoTitle(url);
    syncRef.current?.setStreamUrl(url); setShowVideoModal(false);
  }, []);

  const handleSelectEmbed = useCallback((url: string) => {
    setEmbedUrl(url); setStreamUrl(null);
    syncRef.current?.setEmbedUrl(url); setShowVideoModal(false);
  }, []);


  const handleSelectFile = useCallback((file: File) => {
    setLocalFile(file);
    setStreamUrl(null);
    setEmbedUrl(null);
    setScreenStream(null);
    syncRef.current?.setStreamUrl('');
    setShowVideoModal(false);
  }, []);

  const handlePlaybackChange = useCallback((state: any) => {
    if (isOwner || localFile || screenStream) syncRef.current?.publishPlayback({ ...state, ownerId: user?.uid });
  }, [isOwner, user, localFile, screenStream]);

  const handleCopyCode = useCallback(() => {
    navigator.clipboard.writeText(code).catch(() => {}); setIsCopied(true); setTimeout(() => setIsCopied(false), 2000);
  }, [code]);

  const handleCopyShare = useCallback(() => { navigator.clipboard.writeText(shareUrl).catch(() => {}); }, [shareUrl]);

  const handleGoogleSignIn = useCallback(async () => {
    try { const r = await signInWithPopup(auth, new GoogleAuthProvider()); if (r.user) { setUser(r.user); setDisplayName(r.user.displayName ?? 'Guest'); setShowNamePrompt(false); } } catch {}
  }, []);

  const handleNameSubmit = useCallback(async (name: string) => {
    try {
      const res = await signInAnonymously(auth);
      if (res.user) {
        setDisplayName(name);
        setShowNamePrompt(false);
        setUser(res.user);
      }
    } catch (err) {
      console.error('[RoomClient] Anonymous sign in failed, falling back:', err);
      setDisplayName(name);
      setShowNamePrompt(false);
      setUser({ uid: `guest_${generateId()}`, displayName: name, photoURL: '' });
    }
  }, []);

  const handleLeave = useCallback(() => {
    router.push('/');
  }, [router]);

  // VideoGrid tiles
  const videoTiles = [
    ...(user ? [{ uid: user.uid, name: displayName || 'You', stream: localMediaStream, isCamOn, isMicOn, isLocal: true, photoURL: user.photoURL ?? '' }] : []),
    ...Object.entries(members || {}).filter(([uid, m]) => uid !== user?.uid && m?.online).map(([uid, m]) => ({
      uid, name: m?.name || 'Guest', stream: peerStreams[uid] ?? null,
      isCamOn: m?.isCamOn ?? false, isMicOn: m?.isMicOn ?? false, isLocal: false, photoURL: m?.photoURL ?? '',
    })),
  ];

  if (!authReady) return (
    <div className="bg-animated min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full border-2 border-cyan-400/50 border-t-cyan-400 animate-spin" />
        <p className="text-white/40 text-sm">Loading watch party…</p>
      </div>
    </div>
  );

  if (showNamePrompt) return (
    <div className="bg-animated min-h-screen">
      <NamePromptModal onSubmit={handleNameSubmit} onGoogleSignIn={handleGoogleSignIn} />
    </div>
  );

  return (
    <div className="bg-animated flex flex-col h-screen w-screen overflow-hidden">

      {/* Floating reactions */}
      <AnimatePresence>
        {reactions.map(r => {
          const drift = r.x > 50 ? 20 : -20;
          return (
            <motion.div 
              key={r.id} 
              initial={{ y: 0, x: 0, opacity: 0, scale: 0.5, rotate: -30 }} 
              animate={{ y: -180, x: drift, opacity: [0, 1, 1, 0], scale: [0.5, 1.8, 1.8, 1.4], rotate: 30 }} 
              exit={{ opacity: 0, scale: 0 }} 
              transition={{ duration: 2.2, ease: [0.23, 1, 0.32, 1] }} 
              className="fixed pointer-events-none z-[9999] text-5xl select-none filter drop-shadow-2xl" 
              style={{ left: `${r.x}%`, bottom: '90px' }}
            >
              {r.emoji}
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* TOP BAR */}
      <header className="flex items-center justify-between px-3 md:px-4 shrink-0 glass border-b border-white/[0.06] z-30" style={{ height: 52 }}>
        <div className="flex items-center gap-2 md:gap-3 overflow-hidden">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center shrink-0 shadow-md">
            <Tv2 size={14} className="text-white" />
          </div>
          <RoomCodePill code={code} isCopied={isCopied} onCopy={handleCopyCode} />
          <div className={`hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-semibold ${isOnline ? 'text-green-400' : 'text-red-400'}`}>
            {isOnline ? <Wifi size={11} /> : <WifiOff size={11} />}
            <span>{isOnline ? 'Online' : 'Offline'}</span>
          </div>
          {isOwner && screenStream && (
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-red-500 relative pulse-dot" /><span>You are Live</span>
              <button type="button" onClick={() => { screenStream.getTracks().forEach(t => t.stop()); setScreenStream(null); rtcRef.current?.stopBroadcast(); }} className="ml-1 px-1.5 py-0.5 rounded bg-red-500/20 hover:bg-red-500/40 text-red-200 text-[10px] uppercase font-bold border border-red-500/30 transition-all">Stop</button>
            </div>
          )}
          {isOwner && streamUrl && !screenStream && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs font-semibold truncate max-w-[200px]">
              <span className="w-2 h-2 rounded-full bg-cyan-400 relative pulse-dot shrink-0" />
              <span className="truncate">{currentVideoTitle || 'Streaming'}</span>
              <button type="button" onClick={() => { setStreamUrl(null); setEmbedUrl(null); setCurrentVideoTitle(''); syncRef.current?.clearVideo(); }} className="ml-1 px-1.5 py-0.5 rounded bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-100 text-[10px] uppercase font-bold border border-cyan-500/30 transition-all shrink-0">Stop</button>
            </div>
          )}
          {!isOwner && p2pStream && (
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-purple-400 relative pulse-dot" /><span>Host Live</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
          <button onClick={() => { setChatMode('sidebar'); setSidebarTab('members'); setShowSidebar(true); }} className="flex items-center gap-1.5 px-2.5 py-1.5 glass border border-white/10 rounded-xl hover:border-white/20 transition-all text-xs text-white/60 font-medium">
            <Users size={13} /><span>{memberCount}</span>
          </button>
          <button onClick={() => setShowSidebar(s => !s)} className="w-8 h-8 glass border border-white/10 rounded-xl flex items-center justify-center hover:border-white/20 hover:text-white text-white/50 transition-all" title={showSidebar ? 'Hide sidebar' : 'Show sidebar'}>
            {showSidebar ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
          <button 
            onClick={handleLeave} 
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:border-red-500/50 transition-all font-bold text-xs shrink-0" 
            title="Exit Room"
          >
            <LogOut size={13} />
            <span>EXIT</span>
          </button>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Video area */}
        <div ref={videoAreaRef} className="flex-1 relative overflow-hidden bg-black">
          <VideoPlayer
            streamUrl={p2pStream ? null : streamUrl}
            embedUrl={embedUrl}
            localFile={p2pStream ? null : localFile}
            p2pStream={p2pStream || screenStream}
            isOwner={isOwner || !!localFile || !!screenStream}
            hostName={Object.values(members || {}).find((m: any) => m?.role === 'owner' || m?.uid === externalPlayback?.ownerId)?.name || 'Host'}
            onPlaybackChange={handlePlaybackChange}
            externalState={externalPlayback}
            fullscreenContainerRef={videoAreaRef}
            ref={videoPlayerRef}
            onVideoReady={(el) => {
              if (localFile && (el as any).captureStream) {
                const stream = (el as any).captureStream();
                rtcRef.current?.startBroadcast(stream).catch(console.error);
              }
            }}
          />

          {/* VideoGrid: webcam bubbles */}
          {videoTiles.length > 0 && (
            <div className="absolute bottom-4 right-4 z-40">
              <VideoGrid tiles={videoTiles} />
            </div>
          )}

          {/* Vanishing popup toasts */}
          <div className="absolute bottom-28 right-4 z-50 flex flex-col gap-2 items-end pointer-events-none">
            <AnimatePresence>
              {popupMessages.map(pm => (
                <motion.div key={pm.id} initial={{ opacity: 0, x: 40, scale: 0.92 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 40, scale: 0.88 }} transition={{ type: 'spring', damping: 22, stiffness: 240 }}>
                  <div className="bg-black/80 backdrop-blur-xl border border-white/15 text-white text-sm px-4 py-2.5 rounded-2xl shadow-2xl max-w-[260px] break-words">
                    <span className="text-cyan-300 text-[10px] font-semibold block mb-0.5">{pm.sender}</span>
                    {pm.text}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Join/Leave room notifications */}
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center pointer-events-none">
            <AnimatePresence>
              {roomNotifications.map(notif => (
                <motion.div key={notif.id} initial={{ opacity: 0, y: -20, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -20, scale: 0.9 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }}>
                  <div className={`backdrop-blur-xl border text-xs font-semibold px-4 py-2 rounded-full shadow-2xl flex items-center gap-2 ${notif.type === 'join' ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : 'bg-red-500/15 border-red-500/30 text-red-300'}`}>
                    <span className={`w-2 h-2 rounded-full ${notif.type === 'join' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                    {notif.text}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Popup mini-bar */}
          {chatMode === 'popup' && (
            <div className="absolute bottom-4 left-4 z-40 w-72">
              <div className="bg-black/80 backdrop-blur-xl border border-white/20 rounded-xl p-2 shadow-2xl flex items-center gap-2">
                <button onClick={() => { setChatMode('sidebar'); setShowSidebar(true); setSidebarTab('chat'); }} className="p-1.5 rounded-lg text-white/50 hover:bg-white/10 hover:text-white transition-colors" title="Expand to Sidebar">
                  <Maximize2 size={16} />
                </button>
                <input type="text" placeholder="Type a message…" className="flex-1 bg-transparent text-white text-sm outline-none placeholder-white/40 min-w-0"
                  onKeyDown={(e) => { if (e.key === 'Enter' && e.currentTarget.value.trim()) { sendMessage(e.currentTarget.value.trim()); e.currentTarget.value = ''; } }} />
                <Send size={14} className="text-white/30" />
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <AnimatePresence>
          {showSidebar && (
            <motion.aside key="sidebar" initial={{ x: 320, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 320, opacity: 0 }} transition={{ type: 'spring', damping: 28, stiffness: 280 }} className="w-[300px] shrink-0 flex flex-col glass border-l border-white/[0.07] absolute md:relative right-0 top-0 bottom-0 z-20 md:z-auto">
              <div className="flex border-b border-white/[0.07] shrink-0">
                {(['chat', 'members', 'room'] as SidebarTab[]).map(tab => (
                  <button key={tab} onClick={() => setSidebarTab(tab)} className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider transition-all ${sidebarTab === tab ? 'text-cyan-300 border-b-2 border-cyan-400' : 'text-white/30 hover:text-white/60'}`}>
                    {tab === 'chat' && '💬 Chat'}{tab === 'members' && '👥 Members'}{tab === 'room' && '🏠 Room'}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-hidden flex flex-col">
                <AnimatePresence mode="wait">
                  {sidebarTab === 'chat' && (
                    <motion.div key="chat" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.15 }} className="flex-1 overflow-hidden flex flex-col">
                      <ChatPanel messages={messages} onSend={sendMessage} currentUserId={user?.uid ?? ''} currentUserName={displayName || 'Guest'} onMinimize={() => { setChatMode('popup'); setShowSidebar(false); }} />
                    </motion.div>
                  )}
                  {sidebarTab === 'members' && (
                    <motion.div key="members" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.15 }} className="flex-1 overflow-y-auto p-3">
                      <MembersList members={members} currentUserId={user?.uid ?? ''} ownerId={isOwner ? (user?.uid ?? '') : ''} streamQueue={streamQueue} />
                    </motion.div>
                  )}
                  {sidebarTab === 'room' && (
                    <motion.div key="room" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.15 }} className="flex-1 overflow-y-auto p-4">
                      <RoomInfoCard code={code} shareUrl={shareUrl} onCopyShare={handleCopyShare} memberCount={memberCount} isOwner={isOwner} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <button className="md:hidden absolute top-2 right-2 w-7 h-7 rounded-lg glass border border-white/10 flex items-center justify-center hover:border-white/20 transition-all text-white/50" onClick={() => setShowSidebar(false)}>
                <X size={13} />
              </button>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {/* BOTTOM BAR */}
      <footer className="shrink-0 glass border-t border-white/[0.06] px-3 md:px-5 z-30" style={{ height: 64 }}>
        <div className="flex items-center justify-between h-full gap-2">
          <div className="flex items-center gap-1.5">
            <ControlBtn active={isMicOn} onIcon={<Mic size={16} />} offIcon={<MicOff size={16} />} label={isMicOn ? 'Mic On' : 'Muted'} onToggle={() => setIsMicOn(v => !v)} />
            <ControlBtn active={isCamOn} onIcon={<Video size={16} />} offIcon={<VideoOff size={16} />} label={isCamOn ? 'Cam On' : 'Cam Off'} onToggle={() => setIsCamOn(v => !v)} />
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setShowVideoModal(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-2xl glass border border-cyan-500/30 text-cyan-300 text-xs font-semibold hover:bg-cyan-500/10 hover:border-cyan-500/50 transition-all">
              <Tv2 size={14} /><span className="hidden sm:block">Select Video</span>
            </button>
            {streamQueue.length > 0 && (
              <button className="flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-semibold transition-all border glass border-white/10 text-white/50">
                <Music2 size={14} /><span className="bg-purple-500 text-white rounded-full text-[10px] px-1 min-w-[16px] text-center">{streamQueue.length}</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-1">
            {['😂', '❤️', '🔥', '👏', '😮'].map(emoji => (
              <button key={emoji} onClick={() => syncRef.current?.sendReaction(emoji, displayName || 'Guest')} className="w-9 h-9 flex items-center justify-center rounded-2xl glass border border-white/10 text-lg hover:bg-white/10 hover:border-white/20 hover:scale-110 active:scale-95 transition-all duration-150">
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </footer>

      {/* Select Video Modal */}
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
