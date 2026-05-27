'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

interface ChatMessage {
  id: string;
  text: string;
  sender: string;
  senderPhoto: string;
  senderId?: string;
  timestamp: number;
  type?: 'chat' | 'system';
}

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  currentUserId: string;
  currentUserName: string;
  onMinimize?: () => void;
}

const QUICK_EMOJIS = ['😂', '❤️', '😮', '👏', '🔥', '😍', '😡', '💀'];

const REACTION_EMOJIS = new Set(QUICK_EMOJIS);

function isReaction(text: string): boolean {
  return REACTION_EMOJIS.has(text.trim());
}

function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getInitials(name: string): string {
  const safeName = typeof name === 'string' ? name : 'Guest';
  return safeName.charAt(0).toUpperCase() || '?';
}

function AvatarFallback({ name, size = 32 }: { name: string; size?: number }) {
  const safeName = typeof name === 'string' ? name : 'Guest';
  const colors = [
    'from-purple-500 to-indigo-600',
    'from-blue-500 to-cyan-600',
    'from-green-500 to-teal-600',
    'from-pink-500 to-rose-600',
    'from-orange-500 to-amber-600',
    'from-violet-500 to-purple-600',
  ];
  const colorIndex = (safeName.charCodeAt(0) || 0) % colors.length;
  const gradient = colors[colorIndex];

  return (
    <div
      className={`bg-gradient-to-br ${gradient} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {getInitials(safeName)}
    </div>
  );
}

export default function ChatPanel({
  messages,
  onSend,
  currentUserId,
  currentUserName,
  onMinimize,
}: ChatPanelProps) {
  const [inputText, setInputText] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastSeenCount, setLastSeenCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const prevMessageCountRef = useRef(messages.length);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (isAtBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setUnreadCount(0);
      setLastSeenCount(messages.length);
    } else {
      const newMessages = messages.length - prevMessageCountRef.current;
      if (newMessages > 0) {
        setUnreadCount((prev) => prev + newMessages);
      }
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length, isAtBottom]);

  // Ensure scroll to bottom whenever length changes and we are at bottom
  useEffect(() => {
    if (isAtBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const atBottom = scrollHeight - scrollTop - clientHeight < 40;
    setIsAtBottom(atBottom);
    if (atBottom) {
      setUnreadCount(0);
      setLastSeenCount(messages.length);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setIsAtBottom(true);
    setUnreadCount(0);
  };

  const sendMessage = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setInputText('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputText);
    }
  };

  const handleEmojiClick = (emoji: string) => {
    sendMessage(emoji);
  };

  return (
    <div className="flex flex-col h-full bg-black/30 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5">
        <div className="flex items-center gap-2">
          <svg
            className="w-4 h-4 text-blue-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          <span className="text-white font-semibold text-sm tracking-wide">Chat</span>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={scrollToBottom}
              className="flex items-center gap-1 bg-blue-500 hover:bg-blue-400 text-white text-xs font-bold px-2 py-0.5 rounded-full transition-colors"
            >
              <span>{unreadCount}</span>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
          {onMinimize && (
            <button
              onClick={onMinimize}
              className="text-white/50 hover:text-white transition-colors p-1 rounded-md hover:bg-white/10 ml-1"
              title="Minimize to Popup"
            >
              <ChevronDown size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 py-3 space-y-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
      >
        {messages.length === 0 && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center h-full gap-2 text-white/30 select-none">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <p className="text-xs">Be the first to say something!</p>
          </motion.div>
        )}

        <AnimatePresence initial={false}>
        {(() => {
          const renderedIds = new Set<string>();
          return messages.map((msg, index) => {
            if (renderedIds.has(msg.id)) return null;
            renderedIds.add(msg.id);

            const isOwn = msg.senderId ? msg.senderId === currentUserId : msg.sender === currentUserId;
            const isReactionMsg = isReaction(msg.text);
            const isNewMsg = index >= lastSeenCount - 1;

            // System message
            if (msg.type === 'system') {
              return (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                  key={msg.id} 
                  className="flex justify-center items-center py-1"
                >
                  <span className="text-white/35 text-[11px] italic bg-white/5 rounded-full px-3 py-0.5">
                    {msg.text}
                  </span>
                </motion.div>
              );
            }

            if (isReactionMsg) {
            return (
              <motion.div
                initial={{ opacity: 0, scale: 0.5, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                key={msg.id}
                className={`flex justify-center items-center py-1`}
              >
                <div className="group relative flex flex-col items-center">
                  <span className="text-4xl leading-none select-none drop-shadow-lg">
                    {msg.text}
                  </span>
                  <span className="text-white/30 text-[10px] mt-0.5">{msg.sender === currentUserId ? 'You' : msg.sender}</span>
                  <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] text-white/50 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-black/60 px-1.5 py-0.5 rounded-md">
                    {formatTimestamp(msg.timestamp)}
                  </span>
                </div>
              </motion.div>
            );
          }

          if (isOwn) {
            return (
              <motion.div
                initial={{ opacity: 0, x: 20, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                key={msg.id}
                className={`flex justify-end items-end gap-1.5`}
              >
                <div className="group relative flex flex-col items-end max-w-[78%]">
                  <div className="bg-gradient-to-br from-blue-500 to-blue-700 text-white text-sm px-3 py-2 rounded-2xl rounded-br-sm shadow-lg shadow-blue-900/30 break-words">
                    {msg.text}
                  </div>
                  <span className="absolute -top-5 right-0 text-[10px] text-white/40 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-black/60 px-1.5 py-0.5 rounded-md">
                    {formatTimestamp(msg.timestamp)}
                  </span>
                </div>
              </motion.div>
            );
          }

          return (
            <motion.div
              initial={{ opacity: 0, x: -20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
              key={msg.id}
              className={`flex items-end gap-2`}
            >
              {/* Avatar */}
              <div className="flex-shrink-0 mb-0.5">
                {msg.senderPhoto ? (
                  <div className="relative w-7 h-7 rounded-full overflow-hidden ring-1 ring-white/20">
                    <img
                      src={msg.senderPhoto}
                      alt={msg.sender}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <AvatarFallback name={msg.sender} size={28} />
                )}
              </div>

              {/* Bubble */}
              <div className="group relative flex flex-col items-start max-w-[78%]">
                <span className="text-white/40 text-[10px] mb-0.5 ml-1">{msg.sender}</span>
                <div className="bg-white/10 backdrop-blur-md border border-white/10 text-white text-sm px-3 py-2 rounded-2xl rounded-bl-sm shadow-md break-words">
                  {msg.text}
                </div>
                <span className="absolute -top-5 left-0 text-[10px] text-white/40 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-black/60 px-1.5 py-0.5 rounded-md">
                  {formatTimestamp(msg.timestamp)}
                </span>
              </div>
            </motion.div>
          );
          });
        })()}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Emoji Quick Reactions */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-t border-white/5 bg-white/3">
        {QUICK_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => handleEmojiClick(emoji)}
            className="text-lg leading-none hover:scale-125 transition-transform duration-150 active:scale-95 select-none p-0.5 rounded-md hover:bg-white/10"
            title={`React with ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Input Bar */}
      <div className="flex items-center gap-2 px-3 py-3 border-t border-white/10 bg-white/5">
        <div className="flex-1 flex items-center bg-white/10 border border-white/15 rounded-xl px-3 py-2 gap-2 focus-within:border-blue-500/50 focus-within:bg-white/15 transition-all">
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 bg-transparent text-white text-sm placeholder-white/30 outline-none min-w-0"
            maxLength={500}
          />
        </div>
        <button
          onClick={() => sendMessage(inputText)}
          disabled={!inputText.trim()}
          className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 hover:from-blue-400 hover:to-blue-600 disabled:from-white/10 disabled:to-white/10 disabled:cursor-not-allowed text-white flex items-center justify-center transition-all shadow-lg shadow-blue-900/30 active:scale-95"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
