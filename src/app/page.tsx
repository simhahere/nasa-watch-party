'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Users, Zap, MessageCircle, Video, Plus, ArrowRight, Star } from 'lucide-react';
import { signInWithGoogle } from '@/lib/firebase';
import { generateRoomCode } from '@/lib/roomUtils';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';

// ─────────────────────────────────────────────
// Animated star field (pure CSS / inline SVG)
// ─────────────────────────────────────────────
function StarField() {
  const stars = useRef<{ x: number; y: number; r: number; delay: number; dur: number }[]>([]);

  if (stars.current.length === 0) {
    for (let i = 0; i < 90; i++) {
      stars.current.push({
        x: Math.random() * 100,
        y: Math.random() * 100,
        r: Math.random() * 0.7 + 0.15,
        delay: Math.random() * 6,
        dur: Math.random() * 5 + 4,
      });
    }
  }

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid slice"
      viewBox="0 0 100 100"
      aria-hidden="true"
    >
      {stars.current.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="white">
          <animate
            attributeName="opacity"
            values="0.1;0.9;0.1"
            dur={`${s.dur}s`}
            begin={`${s.delay}s`}
            repeatCount="indefinite"
          />
        </circle>
      ))}
      {/* Accent space markers */}
      {[
        { cx: 20, cy: 30, fill: '#00d4ff' },
        { cx: 80, cy: 20, fill: '#8b5cf6' },
        { cx: 85, cy: 65, fill: '#00d4ff' },
        { cx: 30, cy: 80, fill: '#ec4899' },
      ].map((s, i) => (
        <circle key={`accent-${i}`} cx={s.cx} cy={s.cy} r={0.7} fill={s.fill}>
          <animate
            attributeName="opacity"
            values="0.2;0.8;0.2"
            dur={`${4 + i}s`}
            repeatCount="indefinite"
          />
        </circle>
      ))}
    </svg>
  );
}

// ─────────────────────────────────────────────
// Google SVG logo
// ─────────────────────────────────────────────
function GoogleLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

// ─────────────────────────────────────────────
// Feature card data
// ─────────────────────────────────────────────
const FEATURES = [
  {
    icon: <Video className="w-6 h-6" />,
    emoji: '🎬',
    title: 'Stream Any Video',
    desc: 'Local files, direct URLs, or NetMirror links — play anything together.',
    color: 'rgba(0,212,255,0.03)',
    border: 'rgba(255,255,255,0.06)',
    glow: 'rgba(0,212,255,0.06)',
  },
  {
    icon: <Zap className="w-6 h-6" />,
    emoji: '⚡',
    title: 'Perfect Sync',
    desc: 'Millisecond-precision playback sync keeps everyone watching the same frame.',
    color: 'rgba(139,92,246,0.03)',
    border: 'rgba(255,255,255,0.06)',
    glow: 'rgba(139,92,246,0.06)',
  },
  {
    icon: <MessageCircle className="w-6 h-6" />,
    emoji: '💬',
    title: 'Live Chat',
    desc: 'React, reply, and laugh together with real-time emoji reactions and messages.',
    color: 'rgba(236,72,153,0.03)',
    border: 'rgba(255,255,255,0.06)',
    glow: 'rgba(236,72,153,0.06)',
  },
  {
    icon: <Video className="w-6 h-6" />,
    emoji: '📹',
    title: 'Video Calls',
    desc: "See your friends' faces while you watch — movie nights feel real again.",
    color: 'rgba(34,197,94,0.03)',
    border: 'rgba(255,255,255,0.06)',
    glow: 'rgba(34,197,94,0.06)',
  },
];

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────
export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);

  // Join room state
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');

  // Creating room state
  const [creatingRoom, setCreatingRoom] = useState(false);

  // ── Auth observer ──
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  // ── Google sign-in ──
  const handleSignIn = async () => {
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      console.error(e);
    } finally {
      setSigningIn(false);
    }
  };

  // ── Create room ──
  const handleCreateRoom = () => {
    if (!user) return;
    setCreatingRoom(true);
    const code = generateRoomCode();
    localStorage.setItem('nasa_room_code', code);
    localStorage.setItem('nasa_user_id', user.uid);
    localStorage.setItem('nasa_display_name', user.displayName ?? user.email ?? 'Guest');
    router.push(`/room/${code}`);
  };

  // ── Join room ──
  const handleJoinRoom = () => {
    const trimmed = joinCode.trim().toUpperCase();
    if (trimmed.length !== 6) {
      setJoinError('Please enter a valid 6-character room code.');
      return;
    }
    setJoinError('');
    if (user) {
      localStorage.setItem('nasa_user_id', user.uid);
      localStorage.setItem('nasa_display_name', user.displayName ?? user.email ?? 'Guest');
    }
    router.push(`/room/${trimmed}`);
  };

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-animated overflow-x-hidden">
      {/* ══════════════════ HERO ══════════════════ */}
      <section className="relative flex flex-col items-center justify-center min-h-screen px-4 text-center overflow-hidden">
        {/* Star background */}
        <StarField />

        {/* Ambient blobs */}
        <motion.div
          animate={{
            x: [0, 40, -30, 0],
            y: [0, -50, 30, 0],
            scale: [1, 1.15, 0.9, 1],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute top-1/4 left-1/4 w-80 h-80 rounded-full pointer-events-none mix-blend-screen"
          style={{
            background: 'radial-gradient(circle, rgba(0, 212, 255, 0.04) 0%, transparent 80%)',
            filter: 'blur(80px)',
          }}
        />
        <motion.div
          animate={{
            x: [0, -40, 30, 0],
            y: [0, 50, -30, 0],
            scale: [1, 0.9, 1.15, 1],
          }}
          transition={{
            duration: 28,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full pointer-events-none mix-blend-screen"
          style={{
            background: 'radial-gradient(circle, rgba(139, 92, 246, 0.04) 0%, transparent 80%)',
            filter: 'blur(80px)',
          }}
        />

        {/* Hero content */}
        <motion.div
          className="relative z-10 flex flex-col items-center gap-6 max-w-3xl"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15, duration: 0.6 }}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full glass border border-white/[0.04] text-[10px] uppercase font-black text-cyan-400 tracking-[0.2em] shadow-lg bg-black/40 animate-pulse"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            Mission Control for Group Streaming
          </motion.div>

          {/* Title */}
          <motion.h1
            className="text-5xl sm:text-7xl md:text-8xl font-black tracking-tight leading-none uppercase mt-2 mb-2"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="title-shine">
              NASA Watch Party
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            className="text-sm sm:text-base text-white/50 max-w-lg leading-relaxed tracking-wide font-medium"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.7 }}
          >
            Synchronized theatrical cinema streaming for remote crews. Watch high-definition media together in perfect real-time alignment, from anywhere in the cosmos.
          </motion.p>

          {/* Flat scientific telemetry dashboard (no button appearance) */}
          <motion.div
            className="flex items-center justify-center gap-6 mt-6 glass border border-white/5 rounded-2xl p-4 max-w-md w-full backdrop-blur-xl shadow-2xl bg-black/30 pointer-events-none"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 0.7 }}
          >
            {/* Latency Telemetry */}
            <div className="flex-1 flex flex-col items-center gap-0.5 border-r border-white/10 px-4">
              <div className="flex items-center gap-1.5 text-[9px] text-cyan-400 font-bold uppercase tracking-widest">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_6px_rgba(34,211,238,0.8)]" />
                Network Delay
              </div>
              <span className="text-3xl font-black font-mono tracking-tight text-white/90">0ms</span>
              <span className="text-[9px] text-white/30 tracking-widest uppercase font-bold">Latency Telemetry</span>
            </div>

            {/* Sync Telemetry */}
            <div className="flex-1 flex flex-col items-center gap-0.5 px-4">
              <div className="flex items-center gap-1.5 text-[9px] text-purple-400 font-bold uppercase tracking-widest">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse shadow-[0_0_6px_rgba(192,132,252,0.8)]" />
                Lock Status
              </div>
              <span className="text-3xl font-black font-mono tracking-tight text-white/90">HD Sync</span>
              <span className="text-[9px] text-white/30 tracking-widest uppercase font-bold">Playback Alignment</span>
            </div>
          </motion.div>
        </motion.div>

        {/* Scroll chevron */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          <div className="w-6 h-10 rounded-full border-2 border-white/20 flex justify-center pt-2">
            <div className="w-1 h-2 rounded-full bg-white/40" />
          </div>
        </motion.div>
      </section>

      {/* ══════════════════ AUTH / CREATE-JOIN ══════════════════ */}
      <section className="relative px-4 py-20 flex flex-col items-center gap-12">
        <AnimatePresence mode="wait">
          {authLoading ? (
            /* Loading shimmer */
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-sm"
            >
              <div className="shimmer h-14 rounded-2xl" />
            </motion.div>
          ) : !user ? (
            /* ── Sign-in button ── */
            <motion.div
              key="auth"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="flex flex-col items-center gap-4"
            >
              <p className="text-white/50 text-sm">Sign in to create or join a watch party</p>
              <motion.button
                onClick={handleSignIn}
                disabled={signingIn}
                whileHover={{ scale: 1.03, boxShadow: '0 0 30px rgba(0,212,255,0.25)' }}
                whileTap={{ scale: 0.97 }}
                className="flex items-center gap-3 px-8 py-4 rounded-2xl font-semibold text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.14)',
                  backdropFilter: 'blur(16px)',
                  fontSize: 16,
                }}
              >
                <GoogleLogo />
                {signingIn ? 'Signing in…' : 'Continue with Google'}
              </motion.button>
            </motion.div>
          ) : (
            /* ── Create & Join cards ── */
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
              className="w-full max-w-4xl"
            >
              {/* Welcome line */}
              <motion.p
                className="text-center text-white/50 text-sm mb-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                Welcome back,{' '}
                <span className="text-cyan-400 font-semibold">
                  {user.displayName ?? user.email}
                </span>{' '}
                👋
              </motion.p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* ── LEFT: Create Room ── */}
                <motion.div
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15, duration: 0.55 }}
                  whileHover={{
                    y: -6,
                    boxShadow: '0 0 40px rgba(0,212,255,0.18), 0 0 80px rgba(0,212,255,0.06)',
                  }}
                  className="glass rounded-3xl p-8 flex flex-col gap-5 cursor-pointer group"
                  style={{
                    border: '1px solid rgba(0,212,255,0.15)',
                    transition: 'box-shadow 0.3s, transform 0.3s',
                  }}
                >
                  {/* Icon */}
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg,rgba(0,212,255,0.2),rgba(139,92,246,0.2))',
                      border: '1px solid rgba(0,212,255,0.3)',
                    }}
                  >
                    <Play className="w-6 h-6 text-cyan-400 fill-current" />
                  </div>

                  <div className="flex flex-col gap-2">
                    <h2 className="text-2xl font-bold text-white">Create Room</h2>
                    <p className="text-white/50 text-sm leading-relaxed">
                      Start a watch party and invite friends with a unique room code.
                    </p>
                  </div>

                  <motion.button
                    onClick={handleCreateRoom}
                    disabled={creatingRoom}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    className="btn-primary w-full justify-center mt-auto disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{ color: '#000' }}
                  >
                    <Plus className="w-4 h-4" />
                    {creatingRoom ? 'Creating…' : 'Create New Room'}
                  </motion.button>
                </motion.div>

                {/* ── RIGHT: Join Room ── */}
                <motion.div
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25, duration: 0.55 }}
                  whileHover={{
                    y: -6,
                    boxShadow: '0 0 40px rgba(139,92,246,0.18), 0 0 80px rgba(139,92,246,0.06)',
                  }}
                  className="glass rounded-3xl p-8 flex flex-col gap-5 group"
                  style={{
                    border: '1px solid rgba(139,92,246,0.15)',
                    transition: 'box-shadow 0.3s, transform 0.3s',
                  }}
                >
                  {/* Icon */}
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{
                      background:
                        'linear-gradient(135deg,rgba(139,92,246,0.2),rgba(236,72,153,0.2))',
                      border: '1px solid rgba(139,92,246,0.3)',
                    }}
                  >
                    <Users className="w-6 h-6 text-purple-400" />
                  </div>

                  <div className="flex flex-col gap-2">
                    <h2 className="text-2xl font-bold text-white">Join Room</h2>
                    <p className="text-white/50 text-sm leading-relaxed">
                      Enter a 6-character room code to join an existing watch party.
                    </p>
                  </div>

                  {/* Code input */}
                  <div className="flex flex-col gap-2">
                    <input
                      className="input-glass text-center tracking-[0.3em] text-lg uppercase font-bold"
                      placeholder="ABC123"
                      maxLength={6}
                      value={joinCode}
                      onChange={(e) => {
                        setJoinCode(e.target.value.toUpperCase());
                        if (joinError) setJoinError('');
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
                    />
                    <AnimatePresence>
                      {joinError && (
                        <motion.p
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="text-red-400 text-xs text-center"
                        >
                          {joinError}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  <motion.button
                    onClick={handleJoinRoom}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    className="btn-secondary w-full justify-center mt-auto"
                    style={{
                      background: 'linear-gradient(135deg,rgba(139,92,246,0.2),rgba(236,72,153,0.2))',
                      border: '1px solid rgba(139,92,246,0.35)',
                    }}
                  >
                    <ArrowRight className="w-4 h-4" />
                    Join Party
                  </motion.button>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* ══════════════════ FEATURES ══════════════════ */}
      <section className="px-4 py-20 flex flex-col items-center gap-12">
        <motion.div
          className="text-center flex flex-col gap-3"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            Everything you need to{' '}
            <span
              style={{
                background: 'linear-gradient(135deg,#00d4ff,#8b5cf6)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              watch together
            </span>
          </h2>
          <p className="text-white/40 text-sm max-w-md mx-auto">
            A full-featured watch party experience built for the modern web.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 w-full max-w-5xl">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ delay: i * 0.1, duration: 0.55 }}
              whileHover={{
                y: -6,
                boxShadow: `0 0 30px ${f.glow}`,
              }}
              className="rounded-2xl p-6 flex flex-col gap-4"
              style={{
                background: f.color,
                border: `1px solid ${f.border}`,
                backdropFilter: 'blur(12px)',
                transition: 'box-shadow 0.3s, transform 0.3s',
              }}
            >
              <div className="text-3xl">{f.emoji}</div>
              <div className="flex flex-col gap-1.5">
                <h3 className="text-white font-semibold text-base">{f.title}</h3>
                <p className="text-white/45 text-sm leading-relaxed">{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ══════════════════ FOOTER ══════════════════ */}
      <footer className="px-4 py-10 flex items-center justify-center">
        <motion.p
          className="text-white/25 text-sm tracking-widest uppercase font-medium"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          NASA Watch Party — Watch Together
        </motion.p>
      </footer>
    </div>
  );
}
