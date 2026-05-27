'use client';

import React, { useEffect, useRef, useState } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────

export interface VideoTile {
  uid: string;
  name: string;
  stream: MediaStream | null;
  isCamOn: boolean;
  isMicOn: boolean;
  isLocal?: boolean;
  photoURL?: string;
}

interface VideoGridProps {
  tiles: VideoTile[];
  className?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Deterministic color from a uid string — hashed to HSL (s=70%, l=50%).
 */
function colorFromUid(uid: string): string {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = uid.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0; // Convert to 32-bit integer
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 50%)`;
}

// ── Inline SVG: Camera-off icon ─────────────────────────────────────────────

function CameraOffIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-red-400"
    >
      {/* camera body */}
      <path d="M1 1l22 22" />
      <path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3l2-3h6" />
      <path d="M21 13V8a2 2 0 0 0-2-2h-1.5" />
      {/* slashed circle (lens area) */}
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}

// ── Sub-component: single bubble ────────────────────────────────────────────

function VideoTileBubble({ tile }: { tile: VideoTile }) {
  const { uid, name, stream, isCamOn, isMicOn, isLocal = false } = tile;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [showVideo, setShowVideo] = useState(false);

  // Determine if video should actually be visible
  const hasActiveVideoTrack =
    isCamOn &&
    !!stream &&
    stream.getVideoTracks().some((t) => t.readyState === 'live' && !t.muted);

  // Attach stream to video element
  const setVideoRef = (el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && hasActiveVideoTrack) {
      if (el.srcObject !== stream) {
        el.srcObject = stream;
      }
    } else if (el) {
      el.srcObject = null;
    }
  };

  // Attach stream to audio element (remote peers only)
  const setAudioRef = (el: HTMLAudioElement | null) => {
    audioRef.current = el;
    if (el && el.srcObject !== stream) {
      el.srcObject = stream;
    }
  };

  // ── CRITICAL: Clear srcObject when camera turns off ──
  useEffect(() => {
    if (!isCamOn || !stream) {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setShowVideo(false);
      return;
    }

    // Camera is on and stream exists — attach it
    if (videoRef.current && videoRef.current.srcObject !== stream) {
      videoRef.current.srcObject = stream;
    }

    // Check for active video tracks
    const videoTracks = stream.getVideoTracks();
    const hasLiveTrack = videoTracks.some(
      (t) => t.readyState === 'live' && !t.muted
    );
    setShowVideo(hasLiveTrack);

    // Listen for track events
    const handleTrackEnded = () => {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setShowVideo(false);
    };

    const handleTrackMuted = () => {
      setShowVideo(false);
    };

    const handleTrackUnmuted = () => {
      if (videoRef.current && stream) {
        videoRef.current.srcObject = stream;
      }
      setShowVideo(true);
    };

    videoTracks.forEach((track) => {
      track.addEventListener('ended', handleTrackEnded);
      track.addEventListener('mute', handleTrackMuted);
      track.addEventListener('unmute', handleTrackUnmuted);
    });

    return () => {
      videoTracks.forEach((track) => {
        track.removeEventListener('ended', handleTrackEnded);
        track.removeEventListener('mute', handleTrackMuted);
        track.removeEventListener('unmute', handleTrackUnmuted);
      });
    };
  }, [isCamOn, stream]);

  // Keep audio srcObject in sync
  useEffect(() => {
    if (audioRef.current && audioRef.current.srcObject !== stream) {
      audioRef.current.srcObject = stream;
    }
  }, [stream]);

  const borderColor = isLocal ? 'border-cyan-400' : 'border-purple-500';
  const initials = name.charAt(0).toUpperCase();

  return (
    <div
      className={[
        'relative w-28 h-28 rounded-full overflow-hidden border-[3px] shrink-0',
        'shadow-lg transition-transform duration-200 hover:scale-105',
        borderColor,
      ].join(' ')}
    >
      {/* Video layer — always rendered, controlled via opacity for smooth transition */}
      <video
        ref={setVideoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className="absolute inset-0 w-full h-full object-cover rounded-full transition-opacity duration-300"
        style={{
          opacity: showVideo ? 1 : 0,
          ...(isLocal ? { transform: 'scaleX(-1)' } : {}),
        }}
      />

      {/* Avatar fallback — visible when video is not active */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center w-full h-full transition-opacity duration-300"
        style={{
          opacity: showVideo ? 0 : 1,
          background: 'rgba(0,0,0,0.6)',
        }}
      >
        {tile.photoURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={tile.photoURL}
            alt={name}
            className="w-full h-full object-cover rounded-full"
          />
        ) : (
          <>
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold text-white select-none"
              style={{ background: colorFromUid(uid) }}
            >
              {initials}
            </div>
            {/* Camera-off icon below avatar */}
            <div className="mt-1">
              <CameraOffIcon size={14} />
            </div>
          </>
        )}
      </div>

      {/* Remote audio — always present for remote peers */}
      {!isLocal && stream && (
        <audio ref={setAudioRef} autoPlay className="hidden" />
      )}

      {/* Name label */}
      <span className="absolute bottom-1 left-0 right-0 text-center text-[9px] font-bold text-white bg-black/50 truncate px-1 leading-4 z-10">
        {isLocal ? 'You' : name}
      </span>

      {/* Mic indicators */}
      {isMicOn ? (
        <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_6px_rgba(74,222,128,0.8)] z-10" />
      ) : (
        <div className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5 z-10">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400">
            <line x1="1" y1="1" x2="23" y2="23"></line>
            <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
            <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path>
            <line x1="12" y1="19" x2="12" y2="23"></line>
            <line x1="8" y1="23" x2="16" y2="23"></line>
          </svg>
        </div>
      )}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

/**
 * VideoGrid renders a column of draggable circular video bubbles.
 * The parent is responsible for positioning this component absolutely
 * (e.g. bottom-right of the video area).
 *
 * Renders nothing when there are no tiles.
 */
export default function VideoGrid({ tiles, className = '' }: VideoGridProps) {
  if (tiles.length === 0) return null;

  return (
    <div
      className={[
        'flex flex-col-reverse gap-3 items-end',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {tiles.map((tile) => (
        <VideoTileBubble key={tile.uid} tile={tile} />
      ))}
    </div>
  );
}
