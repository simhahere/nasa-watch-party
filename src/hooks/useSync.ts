import { useEffect, useRef, useState, useCallback } from 'react';
import SyncService, {
  PlaybackState,
  WatchMode,
  StreamQueueEntry,
  RoomMember,
} from '@/lib/syncService';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UseSyncReturn {
  /** The underlying SyncService instance (stable reference while roomCode/userId unchanged) */
  syncService: SyncService | null;
  /** Current playback state broadcast by the room owner */
  playbackState: PlaybackState | null;
  /** Direct stream URL (HLS / mp4) shared with all members */
  streamUrl: string | null;
  /** Embed URL for iframe-based players (e.g. NetMirror) */
  embedUrl: string | null;
  /** Whether the room is in 'synced' or 'free' watch mode */
  watchMode: WatchMode;
  /** All room members keyed by uid */
  members: Record<string, RoomMember>;
  /** DJ queue, sorted by requestedAt ascending */
  streamQueue: StreamQueueEntry[];
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useSync
 *
 * Creates a SyncService instance for the given room and user, subscribes to
 * all real-time Firebase channels, and returns the live state. Automatically
 * cleans up all listeners and the service on unmount or when roomCode / userId
 * changes.
 *
 * @param roomCode - 6-char room code (null to skip)
 * @param userId   - Current user's UID (null to skip)
 */
export function useSync(
  roomCode: string | null,
  userId: string | null
): UseSyncReturn {
  const [playbackState, setPlaybackState] = useState<PlaybackState | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [watchMode, setWatchMode] = useState<WatchMode>('synced');
  const [members, setMembers] = useState<Record<string, RoomMember>>({});
  const [streamQueue, setStreamQueue] = useState<StreamQueueEntry[]>([]);

  // Stable ref so callbacks always see the latest service without re-running effects
  const serviceRef = useRef<SyncService | null>(null);
  const [serviceInstance, setServiceInstance] = useState<SyncService | null>(null);

  useEffect(() => {
    if (!roomCode || !userId) {
      // Nothing to subscribe to — reset state
      if (serviceRef.current) {
        serviceRef.current.cleanup();
        serviceRef.current = null;
      }
      setServiceInstance(null);
      setPlaybackState(null);
      setStreamUrl(null);
      setEmbedUrl(null);
      setWatchMode('synced');
      setMembers({});
      setStreamQueue([]);
      return;
    }

    // Create a new SyncService for this room/user combination
    const service = new SyncService(roomCode, userId);
    serviceRef.current = service;
    setServiceInstance(service);

    // ── Subscribe to all channels ────────────────────────────────────────────

    const unsubPlayback = service.onPlayback((state) => setPlaybackState(state));
    const unsubStreamUrl = service.onStreamUrl((url) => setStreamUrl(url));
    const unsubEmbedUrl = service.onEmbedUrl((url) => setEmbedUrl(url));
    const unsubWatchMode = service.onWatchMode((mode) => setWatchMode(mode));
    const unsubMembers = service.onMembers((m) => setMembers(m));
    const unsubQueue = service.onStreamQueue((q) => setStreamQueue(q));

    // ── Cleanup ──────────────────────────────────────────────────────────────

    return () => {
      unsubPlayback();
      unsubStreamUrl();
      unsubEmbedUrl();
      unsubWatchMode();
      unsubMembers();
      unsubQueue();
      service.cleanup();
      serviceRef.current = null;
    };
  }, [roomCode, userId]);

  return {
    syncService: serviceInstance,
    playbackState,
    streamUrl,
    embedUrl,
    watchMode,
    members,
    streamQueue,
  };
}

export default useSync;
