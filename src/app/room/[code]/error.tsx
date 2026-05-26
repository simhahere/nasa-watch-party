'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RoomError({ error, reset }: ErrorProps) {
  const router = useRouter();

  useEffect(() => {
    // Log the error to client console as well
    console.error('[Room Boundary Error]:', error);
  }, [error]);

  return (
    <div className="bg-animated min-h-screen flex items-center justify-center p-4">
      <div className="relative z-10 w-full max-w-xl">
        {/* Glow accent */}
        <div className="absolute inset-0 bg-red-500/10 blur-3xl scale-110 pointer-events-none rounded-3xl" />

        {/* Error Card */}
        <div className="relative glass border border-red-500/20 rounded-3xl p-6 md:p-8 flex flex-col gap-6 shadow-2xl">
          {/* Header */}
          <div className="flex items-center gap-4 border-b border-white/10 pb-4">
            <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-wide">Room Connection Error</h2>
              <p className="text-white/40 text-xs mt-0.5">A client-side exception was successfully intercepted.</p>
            </div>
          </div>

          {/* Details */}
          <div className="flex flex-col gap-2">
            <span className="text-red-400 font-semibold text-xs tracking-wider uppercase">Error Message</span>
            <div className="bg-red-950/20 border border-red-500/15 rounded-2xl p-4 text-sm font-medium text-white/90 break-words leading-relaxed">
              {error?.message || 'An unknown runtime exception occurred.'}
            </div>
          </div>

          {/* Stack Trace (only if available) */}
          {error?.stack && (
            <div className="flex flex-col gap-2">
              <span className="text-white/40 font-semibold text-xs tracking-wider uppercase">Diagnostics / Stack Trace</span>
              <div className="bg-black/40 border border-white/10 rounded-2xl p-4 text-xs font-mono text-white/60 overflow-auto max-h-52 leading-relaxed whitespace-pre scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                {error.stack}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 mt-2">
            <button
              onClick={() => reset()}
              className="flex-1 btn-primary justify-center hover:shadow-red-500/20"
              style={{ background: 'linear-gradient(135deg, #ef4444 0%, #ec4899 100%)', color: '#fff' }}
            >
              <RefreshCw size={15} />
              Try Again
            </button>
            <button
              onClick={() => router.push('/')}
              className="flex-1 btn-secondary justify-center"
            >
              <Home size={15} />
              Return Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
