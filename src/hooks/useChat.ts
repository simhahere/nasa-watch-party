import { useEffect, useState, useCallback, useRef } from 'react';
import { database } from '@/lib/firebase';
import {
  ref,
  push,
  onValue,
  off,
  serverTimestamp,
  query,
  orderByChild,
  limitToLast,
} from 'firebase/database';

// ─── Types ────────────────────────────────────────────────────────────────────

export type MessageType = 'text' | 'reaction';

export type ChatMessage = {
  id: string;
  text: string;
  sender: string;       // display name
  senderPhoto: string;  // photo URL
  senderId: string;     // uid
  timestamp: number;
  type: MessageType;
};

type RawMessage = Omit<ChatMessage, 'id'>;

// ─── Hook ────────────────────────────────────────────────────────────────────

interface UseChatOptions {
  /** Maximum number of messages to load from the tail. Default: 200 */
  limit?: number;
}

interface UseChatReturn {
  messages: ChatMessage[];
  sendMessage: (
    text: string,
    options?: { type?: MessageType }
  ) => Promise<void>;
  loading: boolean;
}

/**
 * useChat
 *
 * Subscribes to `rooms/{roomCode}/messages` in Firebase Realtime Database.
 * Messages are ordered by timestamp (ascending). The `sendMessage` function
 * pushes a new message with the current user's info.
 *
 * @param roomCode  - The 6-char room code (or null to skip)
 * @param userId    - Current user's UID
 * @param userName  - Current user's display name
 * @param userPhoto - Current user's photo URL
 * @param options   - Optional configuration (limit, etc.)
 */
export function useChat(
  roomCode: string | null,
  userId: string | null,
  userName: string | null,
  userPhoto: string | null,
  options: UseChatOptions = {}
): UseChatReturn {
  const { limit = 200 } = options;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);

  // Keep a stable ref to avoid re-running the effect when non-reactive values change
  const userIdRef = useRef(userId);
  const userNameRef = useRef(userName);
  const userPhotoRef = useRef(userPhoto);

  useEffect(() => {
    userIdRef.current = userId;
    userNameRef.current = userName;
    userPhotoRef.current = userPhoto;
  });

  // ── Listener ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!roomCode) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const messagesRef = query(
      ref(database, `rooms/${roomCode}/messages`),
      orderByChild('timestamp'),
      limitToLast(limit)
    );

    const handler = onValue(
      messagesRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setMessages([]);
          setLoading(false);
          return;
        }

        const raw = snapshot.val() as Record<string, RawMessage>;

        const parsed: ChatMessage[] = Object.entries(raw)
          .map(([id, msg]) => ({ id, ...msg }))
          // Sort ascending by timestamp (Firebase orderByChild is ascending,
          // but limitToLast gives the last N in ascending order already —
          // this ensures correctness even if timestamps are slightly out of order)
          .sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));

        setMessages(parsed);
        setLoading(false);
      },
      (error) => {
        console.error('[useChat] Firebase listener error:', error);
        setLoading(false);
      }
    );

    return () => {
      off(messagesRef, 'value', handler);
    };
  }, [roomCode, limit]);

  // ── Send ──────────────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (text: string, options: { type?: MessageType } = {}) => {
      if (!roomCode || !userIdRef.current || !text.trim()) return;

      const messagesRef = ref(database, `rooms/${roomCode}/messages`);

      const newMessage: RawMessage = {
        text: text.trim(),
        sender: userNameRef.current ?? 'Anonymous',
        senderPhoto: userPhotoRef.current ?? '',
        senderId: userIdRef.current,
        timestamp: Date.now(),
        type: options.type ?? 'text',
      };

      await push(messagesRef, newMessage);
    },
    [roomCode]
  );

  return { messages, sendMessage, loading };
}

export default useChat;
