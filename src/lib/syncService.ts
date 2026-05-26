import { database } from './firebase';
import {
  ref,
  set,
  get,
  push,
  remove,
  update,
  onValue,
  off,
  serverTimestamp,
  onDisconnect,
} from 'firebase/database';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PlaybackState = {
  status: 'playing' | 'paused' | 'idle';
  position: number; // ms
  speed: number;
  ownerId: string;
  updatedAt: number;
};

export type WatchMode = 'synced' | 'free';

export type StreamQueueEntry = {
  key: string;
  uid: string;
  name: string;
  photoURL: string;
  requestedAt: number;
};

export type RoomMember = {
  uid: string;
  name: string;
  photoURL: string;
  online: boolean;
  lastSeen: number | object;
  isCamOn?: boolean;
  isMicOn?: boolean;
};

// ─── SyncService ──────────────────────────────────────────────────────────────

export class SyncService {
  private roomCode: string;
  private userId: string;
  /** Map of listenerKey → unsubscribe function */
  private listeners: Map<string, () => void> = new Map();

  constructor(roomCode: string, userId: string) {
    this.roomCode = roomCode;
    this.userId = userId;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private roomRef(path: string) {
    return ref(database, `rooms/${this.roomCode}/${path}`);
  }

  /**
   * Register a realtime listener and store its unsubscribe fn.
   * Returns an unsubscribe function that also removes it from the map.
   */
  private addListener(key: string, unsubscribe: () => void): () => void {
    // Remove any previous listener with the same key
    const prev = this.listeners.get(key);
    if (prev) prev();

    this.listeners.set(key, unsubscribe);

    return () => {
      unsubscribe();
      this.listeners.delete(key);
    };
  }

  // ── Playback ─────────────────────────────────────────────────────────────────

  /**
   * Publish playback state to Firebase (only the room owner should call this).
   */
  async publishPlayback(state: Omit<PlaybackState, 'updatedAt'>): Promise<void> {
    const playbackRef = this.roomRef('playback');
    await set(playbackRef, {
      ...state,
      updatedAt: Date.now(),
    });
  }

  /**
   * Subscribe to playback state changes.
   * Returns an unsubscribe function.
   */
  onPlayback(callback: (state: PlaybackState) => void): () => void {
    const playbackRef = this.roomRef('playback');

    const handler = onValue(playbackRef, (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.val() as PlaybackState);
      }
    });

    return this.addListener('playback', () => off(playbackRef, 'value', handler));
  }

  // ── Stream URL ───────────────────────────────────────────────────────────────

  /**
   * Subscribe to stream URL changes (direct video / HLS sources).
   * Returns an unsubscribe function.
   */
  onStreamUrl(callback: (url: string | null) => void): () => void {
    const streamUrlRef = this.roomRef('streamUrl');

    const handler = onValue(streamUrlRef, (snapshot) => {
      callback(snapshot.exists() ? (snapshot.val() as string) : null);
    });

    return this.addListener('streamUrl', () => off(streamUrlRef, 'value', handler));
  }

  /**
   * Set a direct stream URL for all room members.
   */
  async setStreamUrl(url: string): Promise<void> {
    await set(this.roomRef('streamUrl'), url);
  }

  // ── Embed URL ────────────────────────────────────────────────────────────────

  /**
   * Subscribe to embed URL changes (NetMirror / iframe sources).
   * Returns an unsubscribe function.
   */
  onEmbedUrl(callback: (url: string | null) => void): () => void {
    const embedUrlRef = this.roomRef('embedUrl');

    const handler = onValue(embedUrlRef, (snapshot) => {
      callback(snapshot.exists() ? (snapshot.val() as string) : null);
    });

    return this.addListener('embedUrl', () => off(embedUrlRef, 'value', handler));
  }

  /**
   * Set an embed URL for the room's iframe player.
   */
  async setEmbedUrl(url: string): Promise<void> {
    await set(this.roomRef('embedUrl'), url);
  }

  // ── Clear Video ───────────────────────────────────────────────────────────────

  /**
   * Remove all video sources (streamUrl, embedUrl, playback) from the room.
   */
  async clearVideo(): Promise<void> {
    await Promise.all([
      remove(this.roomRef('streamUrl')),
      remove(this.roomRef('embedUrl')),
      set(this.roomRef('playback'), {
        status: 'idle' as const,
        position: 0,
        speed: 1,
        ownerId: this.userId,
        updatedAt: Date.now(),
      }),
    ]);
  }

  // ── Watch Mode ───────────────────────────────────────────────────────────────

  /**
   * Set the room watch mode ('synced' or 'free').
   */
  async setWatchMode(mode: WatchMode): Promise<void> {
    await set(this.roomRef('watchMode'), mode);
  }

  /**
   * Subscribe to watch mode changes.
   * Returns an unsubscribe function.
   */
  onWatchMode(callback: (mode: WatchMode) => void): () => void {
    const watchModeRef = this.roomRef('watchMode');

    const handler = onValue(watchModeRef, (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.val() as WatchMode);
      } else {
        // Default to synced if not set
        callback('synced');
      }
    });

    return this.addListener('watchMode', () => off(watchModeRef, 'value', handler));
  }

  // ── Member Presence ───────────────────────────────────────────────────────────

  /**
   * Mark this user as present in the room.
   * Sets up onDisconnect so Firebase automatically marks them offline.
   */
  async joinRoom(name: string, photoURL: string): Promise<void> {
    const memberRef = this.roomRef(`members/${this.userId}`);

    const memberData = {
      uid: this.userId,
      name,
      photoURL,
      online: true,
      lastSeen: serverTimestamp(),
    };

    // What to write on disconnect
    const disconnectData = {
      uid: this.userId,
      name,
      photoURL,
      online: false,
      lastSeen: serverTimestamp(),
    };

    await set(memberRef, memberData);
    await onDisconnect(memberRef).update(disconnectData);
  }

  /**
   * Mark this user as offline and cancel the onDisconnect handler.
   */
  async leaveRoom(): Promise<void> {
    const memberRef = this.roomRef(`members/${this.userId}`);
    await onDisconnect(memberRef).cancel();
    await update(memberRef, {
      online: false,
      lastSeen: serverTimestamp(),
    });
  }

  /**
   * Subscribe to all member changes.
   * Returns an unsubscribe function.
   */
  onMembers(callback: (members: Record<string, RoomMember>) => void): () => void {
    const membersRef = this.roomRef('members');

    const handler = onValue(membersRef, (snapshot) => {
      callback(snapshot.exists() ? (snapshot.val() as Record<string, RoomMember>) : {});
    });

    return this.addListener('members', () => off(membersRef, 'value', handler));
  }

  // ── Stream Queue (DJ Mode) ────────────────────────────────────────────────────

  /**
   * Add a request to the stream queue.
   * Returns the push key, or null if the user already has a pending request.
   */
  async requestToStream(name: string, photoURL: string): Promise<string | null> {
    const queueRef = this.roomRef('streamQueue');

    // Check if this user already has a pending request
    const snapshot = await get(queueRef);
    if (snapshot.exists()) {
      const queue = snapshot.val() as Record<string, StreamQueueEntry>;
      const alreadyQueued = Object.values(queue).some((entry) => entry.uid === this.userId);
      if (alreadyQueued) return null;
    }

    const newEntryRef = push(queueRef);
    await set(newEntryRef, {
      key: newEntryRef.key,
      uid: this.userId,
      name,
      photoURL,
      requestedAt: Date.now(),
    });

    return newEntryRef.key;
  }

  /**
   * Remove a stream queue entry (cancel own request).
   */
  async cancelStreamRequest(key: string): Promise<void> {
    const entryRef = this.roomRef(`streamQueue/${key}`);
    // Verify ownership before removing
    const snapshot = await get(entryRef);
    if (snapshot.exists()) {
      const entry = snapshot.val() as StreamQueueEntry;
      if (entry.uid === this.userId) {
        await remove(entryRef);
      }
    }
  }

  /**
   * Pass the stream owner role to another member.
   * Clears the target user's queue entry and sets the room's activeStreamer.
   */
  async passStream(nextUid: string): Promise<void> {
    const queueRef = this.roomRef('streamQueue');
    const snapshot = await get(queueRef);

    const removals: Promise<void>[] = [];

    if (snapshot.exists()) {
      const queue = snapshot.val() as Record<string, StreamQueueEntry>;
      // Remove the next user's queue entry
      Object.entries(queue).forEach(([key, entry]) => {
        if (entry.uid === nextUid) {
          removals.push(remove(this.roomRef(`streamQueue/${key}`)));
        }
      });
    }

    await Promise.all([
      set(ref(database, `rooms/${this.roomCode}/activeStreamer`), nextUid),
      ...removals,
    ]);
  }

  /**
   * Subscribe to stream queue changes.
   * Returns an unsubscribe function.
   */
  onStreamQueue(callback: (queue: StreamQueueEntry[]) => void): () => void {
    const queueRef = this.roomRef('streamQueue');

    const handler = onValue(queueRef, (snapshot) => {
      if (!snapshot.exists()) {
        callback([]);
        return;
      }
      const raw = snapshot.val() as Record<string, StreamQueueEntry>;
      const queue = Object.values(raw).sort((a, b) => a.requestedAt - b.requestedAt);
      callback(queue);
    });

    return this.addListener('streamQueue', () => off(queueRef, 'value', handler));
  }

  // ── Member status update ──
  async updateMemberStatus(status: { isCamOn?: boolean; isMicOn?: boolean }): Promise<void> {
    const memberRef = this.roomRef(`members/${this.userId}`);
    await update(memberRef, status);
  }

  // ── Reaction Sync ──
  async sendReaction(emoji: string, senderName: string): Promise<void> {
    const reactionsRef = this.roomRef('reactions');
    await set(reactionsRef, {
      emoji,
      senderName,
      timestamp: Date.now() + Math.random(),
    });
  }

  onReaction(callback: (emoji: string, senderName: string) => void): () => void {
    const reactionsRef = this.roomRef('reactions');
    const handler = onValue(reactionsRef, (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.val();
        callback(val.emoji, val.senderName);
      }
    });
    return this.addListener('reactions', () => off(reactionsRef, 'value', handler));
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────────

  /**
   * Detach all active Firebase listeners. Call this on component unmount.
   */
  cleanup(): void {
    this.listeners.forEach((unsubscribe) => unsubscribe());
    this.listeners.clear();
  }
}

export default SyncService;
