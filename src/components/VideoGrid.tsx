'use client';

import React, { useEffect, useRef } from 'react';

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

// ── Sub-component: single bubble ────────────────────────────────────────────

function VideoTileBubble({ tile }: { tile: VideoTile }) {
  const { uid, name, stream, isCamOn, isMicOn, isLocal = false } = tile;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Attach stream to video element
  const setVideoRef = (el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && el.srcObject !== stream) {
      el.srcObject = stream;
    }
  };

  // Attach stream to audio element (remote peers only)
  const setAudioRef = (el: HTMLAudioElement | null) => {
    audioRef.current = el;
    if (el && el.srcObject !== stream) {
      el.srcObject = stream;
    }
  };

  // Keep srcObject in sync when stream changes
  useEffect(() => {
    if (videoRef.current && videoRef.current.srcObject !== stream) {
      videoRef.current.srcObject = stream;
    }
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
      {/* Video / avatar */}
      {isCamOn && stream ? (
        <video
          ref={setVideoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-full object-cover rounded-full"
          style={isLocal ? { transform: 'scaleX(-1)' } : undefined}
        />
      ) : (
        /* Avatar fallback */
        <div
          className="flex flex-col items-center justify-center h-full w-full"
          style={{ background: 'rgba(0,0,0,0.6)' }}
        >
          {tile.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tile.photoURL}
              alt={name}
              className="w-full h-full object-cover rounded-full"
            />
          ) : (
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold text-white select-none"
              style={{ background: colorFromUid(uid) }}
            >
              {initials}
            </div>
          )}
        </div>
      )}

      {/* Remote audio — always present for remote peers */}
      {!isLocal && stream && (
        <audio ref={setAudioRef} autoPlay className="hidden" />
      )}

      {/* Name label */}
      <span className="absolute bottom-1 left-0 right-0 text-center text-[9px] font-bold text-white bg-black/50 truncate px-1 leading-4">
        {isLocal ? 'You' : name}
      </span>

      {/* Mic active indicator */}
      {isMicOn && (
        <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_6px_rgba(74,222,128,0.8)]" />
      )}

      {/* Cam-off overlay icon when no stream */}
      {(!isCamOn || !stream) && !tile.photoURL && (
        <div className="absolute inset-0 flex items-end justify-center pb-6 pointer-events-none">
          {/* intentionally left empty — initials are the fallback */}
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
