import { useEffect, useState, useMemo } from 'react';
import { database } from '@/lib/firebase';
import {
  ref,
  onValue,
  off,
  set,
  update,
  onDisconnect,
  serverTimestamp,
} from 'firebase/database';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PresenceMember = {
  uid: string;
  name: string;
  photoURL: string;
  online: boolean;
  lastSeen: number | null;
};

interface UsePresenceReturn {
  /** Number of currently online members */
  onlineCount: number;
  /** All members keyed by uid (online and offline) */
  members: Record<string, PresenceMember>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * usePresence
 *
 * Manages this user's presence in `rooms/{roomCode}/members/{uid}`.
 *
 * On mount:
 *   - Writes `{ online: true, lastSeen: serverTimestamp() }` to Firebase.
 *   - Registers `onDisconnect().update({ online: false, lastSeen: serverTimestamp() })`
 *     so Firebase handles abrupt disconnects automatically.
 *
 * On unmount:
 *   - Cancels the onDisconnect handler.
 *   - Explicitly writes `{ online: false }` to Firebase.
 *   - Detaches the members listener.
 *
 * @param roomCode  - 6-char room code (null to skip)
 * @param userId    - Current user's UID (null to skip)
 * @param name      - Display name to publish
 * @param photoURL  - Photo URL to publish
 */
export function usePresence(
  roomCode: string | null,
  userId: string | null,
  name: string | null,
  photoURL: string | null
): UsePresenceReturn {
  const [members, setMembers] = useState<Record<string, PresenceMember>>({});

  useEffect(() => {
    if (!roomCode || !userId || !name) return;

    const memberRef = ref(database, `rooms/${roomCode}/members/${userId}`);
    const membersRef = ref(database, `rooms/${roomCode}/members`);

    // ── Write online presence ──────────────────────────────────────────────

    const presenceData = {
      uid: userId,
      name: name ?? 'Anonymous',
      photoURL: photoURL ?? '',
      online: true,
      lastSeen: serverTimestamp(),
    };

    const disconnectData = {
      online: false,
      lastSeen: serverTimestamp(),
    };

    // Mark user as online
    set(memberRef, presenceData).catch(console.error);

    // Register the disconnect handler so Firebase sets online:false on drop
    onDisconnect(memberRef)
      .update(disconnectData)
      .catch(console.error);

    // ── Subscribe to members list ──────────────────────────────────────────

    const handler = onValue(
      membersRef,
      (snapshot) => {
        setMembers(snapshot.exists() ? (snapshot.val() as Record<string, PresenceMember>) : {});
      },
      (error) => {
        console.error('[usePresence] members listener error:', error);
      }
    );

    // ── Cleanup ────────────────────────────────────────────────────────────

    return () => {
      // Cancel the automatic disconnect handler
      onDisconnect(memberRef).cancel().catch(console.error);

      // Explicitly mark offline when the component unmounts (graceful leave)
      update(memberRef, disconnectData).catch(console.error);

      // Detach the members listener
      off(membersRef, 'value', handler);
    };
  }, [roomCode, userId, name, photoURL]);

  // ── Derived state ──────────────────────────────────────────────────────────

  const onlineCount = useMemo(
    () => Object.values(members).filter((m) => m.online).length,
    [members]
  );

  return { onlineCount, members };
}

export default usePresence;
