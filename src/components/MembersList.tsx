'use client';

import React from 'react';

interface Member {
  name: string;
  photoURL: string;
  online: boolean;
}

interface StreamQueueEntry {
  key: string;
  uid: string;
  name: string;
  photoURL: string;
}

interface MembersListProps {
  members: Record<string, Member>;
  ownerId: string;
  currentUserId: string;
  streamQueue: StreamQueueEntry[];
}

function getInitials(name: string): string {
  const safeName = typeof name === 'string' ? name : 'Guest';
  return safeName.charAt(0).toUpperCase() || '?';
}

const AVATAR_COLORS = [
  'from-purple-500 to-indigo-600',
  'from-blue-500 to-cyan-600',
  'from-green-500 to-teal-600',
  'from-pink-500 to-rose-600',
  'from-orange-500 to-amber-600',
  'from-violet-500 to-purple-600',
  'from-red-500 to-orange-600',
  'from-teal-500 to-green-600',
];

function getAvatarColor(name: string): string {
  const safeName = typeof name === 'string' ? name : 'Guest';
  const index = (safeName.charCodeAt(0) || 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

function MemberAvatar({ name, photoURL, size = 36 }: { name: string; photoURL: string; size?: number }) {
  const safeName = typeof name === 'string' ? name : 'Guest';
  if (photoURL) {
    return (
      <div
        className="relative rounded-full overflow-hidden ring-1 ring-white/20 flex-shrink-0"
        style={{ width: size, height: size }}
      >
        <img
          src={photoURL}
          alt={safeName}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }
  return (
    <div
      className={`bg-gradient-to-br ${getAvatarColor(safeName)} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {getInitials(safeName)}
    </div>
  );
}

export default function MembersList({
  members,
  ownerId,
  currentUserId,
  streamQueue,
}: MembersListProps) {
  const memberEntries = Object.entries(members);
  const totalCount = memberEntries.length;
  const isCurrentUserOwner = currentUserId === ownerId;

  // Sort: owner first, then online, then offline
  const sorted = [...memberEntries].sort(([aId, a], [bId, b]) => {
    if (aId === ownerId) return -1;
    if (bId === ownerId) return 1;
    if (a.online && !b.online) return -1;
    if (!a.online && b.online) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="flex flex-col h-full bg-black/30 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-white/5">
        <svg
          className="w-4 h-4 text-purple-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
        <span className="text-white font-semibold text-sm tracking-wide">Members</span>
        <span className="ml-auto bg-white/10 text-white/60 text-xs font-medium px-2 py-0.5 rounded-full">
          {totalCount}
        </span>
      </div>

      {/* Members List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        <div className="px-3 py-2 space-y-1">
          {sorted.map(([uid, member]) => {
            const isOwner = uid === ownerId;
            const isCurrentUser = uid === currentUserId;
            return (
              <div
                key={uid}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-colors ${
                  isCurrentUser ? 'bg-white/10' : 'hover:bg-white/5'
                }`}
              >
                {/* Avatar with online dot */}
                <div className="relative flex-shrink-0">
                  <MemberAvatar name={member.name} photoURL={member.photoURL} size={34} />
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-black/60 ${
                      member.online ? 'bg-green-400' : 'bg-white/20'
                    }`}
                  />
                </div>

                {/* Name + badges */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-white text-xs font-medium truncate">
                      {member.name}
                      {isCurrentUser && (
                        <span className="text-white/40 font-normal ml-1">(you)</span>
                      )}
                    </span>
                  </div>
                  {!member.online && (
                    <span className="text-white/30 text-[10px]">Offline</span>
                  )}
                </div>

                {/* Streaming badge */}
                {isOwner && (
                  <span className="flex-shrink-0 flex items-center gap-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full tracking-wider uppercase shadow-lg shadow-purple-900/40">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    LIVE
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Stream Queue */}
        {streamQueue.length > 0 && (
          <div className="mt-2 px-3 pb-3">
            <div className="border-t border-white/10 pt-3">
              <div className="flex items-center gap-1.5 mb-2 px-1">
                <svg
                  className="w-3.5 h-3.5 text-yellow-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
                <span className="text-white/60 text-xs font-semibold uppercase tracking-wider">
                  Queue
                </span>
                <span className="bg-yellow-500/20 text-yellow-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {streamQueue.length}
                </span>
              </div>
              <div className="space-y-1">
                {streamQueue.map((entry, index) => (
                  <div
                    key={entry.key}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-white/5 transition-colors"
                  >
                    <span className="text-white/30 text-[10px] font-mono w-4 text-right flex-shrink-0">
                      {index + 1}
                    </span>
                    <MemberAvatar name={entry.name} photoURL={entry.photoURL} size={26} />
                    <span className="text-white/70 text-xs truncate flex-1">{entry.name}</span>
                    <svg
                      className="w-3 h-3 text-yellow-400/60 flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Request to Stream button (non-owners only) */}
      {!isCurrentUserOwner && (
        <div className="p-3 border-t border-white/10 bg-white/5">
          <button className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600/80 to-indigo-600/80 hover:from-purple-500/90 hover:to-indigo-500/90 border border-white/10 hover:border-white/20 text-white text-xs font-semibold py-2.5 rounded-xl transition-all shadow-lg shadow-purple-900/30 active:scale-95 group">
            <svg
              className="w-3.5 h-3.5 group-hover:scale-110 transition-transform"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.361a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            Request to Stream
          </button>
        </div>
      )}
    </div>
  );
}
