import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RoomMember {
  name: string;
  photoURL: string;
  online: boolean;
}

export interface StreamQueueItem {
  key: string;
  uid: string;
  name: string;
  photoURL: string;
}

export interface ChatMessage {
  id: string;
  text: string;
  sender: string;
  senderPhoto: string;
  timestamp: number;
}

export type WatchMode = 'synced' | 'free';
export type VideoMode = 'url' | 'embed' | 'local';

// ─── State Interface ──────────────────────────────────────────────────────────

interface RoomState {
  // Room identity
  roomCode: string | null;
  userId: string | null;
  displayName: string | null;
  photoURL: string | null;
  isOwner: boolean;

  // Members presence
  members: Record<string, RoomMember>;

  // Playback
  watchMode: WatchMode;
  streamQueue: StreamQueueItem[];
  streamUrl: string | null;
  embedUrl: string | null;
  videoMode: VideoMode;

  // Chat
  messages: ChatMessage[];
}

// ─── Actions Interface ────────────────────────────────────────────────────────

interface RoomActions {
  setRoom: (roomCode: string, isOwner?: boolean) => void;
  setUser: (params: {
    userId: string;
    displayName: string;
    photoURL: string;
  }) => void;
  setMembers: (members: Record<string, RoomMember>) => void;
  setWatchMode: (mode: WatchMode) => void;
  setStreamQueue: (queue: StreamQueueItem[]) => void;
  setStreamUrl: (url: string | null) => void;
  setEmbedUrl: (url: string | null) => void;
  setVideoMode: (mode: VideoMode) => void;
  addMessage: (message: ChatMessage) => void;
  leaveRoom: () => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

const initialState: RoomState = {
  roomCode: null,
  userId: null,
  displayName: null,
  photoURL: null,
  isOwner: false,
  members: {},
  watchMode: 'synced',
  streamQueue: [],
  streamUrl: null,
  embedUrl: null,
  videoMode: 'url',
  messages: [],
};

export const useRoomStore = create<RoomState & RoomActions>()(
  devtools(
    (set) => ({
      ...initialState,

      setRoom: (roomCode, isOwner = false) =>
        set({ roomCode, isOwner }, false, 'setRoom'),

      setUser: ({ userId, displayName, photoURL }) =>
        set({ userId, displayName, photoURL }, false, 'setUser'),

      setMembers: (members) =>
        set({ members }, false, 'setMembers'),

      setWatchMode: (watchMode) =>
        set({ watchMode }, false, 'setWatchMode'),

      setStreamQueue: (streamQueue) =>
        set({ streamQueue }, false, 'setStreamQueue'),

      setStreamUrl: (streamUrl) =>
        set({ streamUrl }, false, 'setStreamUrl'),

      setEmbedUrl: (embedUrl) =>
        set({ embedUrl }, false, 'setEmbedUrl'),

      setVideoMode: (videoMode) =>
        set({ videoMode }, false, 'setVideoMode'),

      addMessage: (message) =>
        set(
          (state) => ({ messages: [...state.messages, message] }),
          false,
          'addMessage'
        ),

      leaveRoom: () =>
        set({ ...initialState }, false, 'leaveRoom'),
    }),
    { name: 'RoomStore' }
  )
);
