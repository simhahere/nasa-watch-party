'use client';

import React, { useCallback, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import CloudinaryUpload from './CloudinaryUpload';

interface SelectVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  isOwner: boolean;
  onSelectUrl: (url: string) => void;
  onSelectEmbed: (url: string) => void;
  onSelectFile: (file: File) => void;
  onStartScreenShare: () => void;
}

type Tab = 'url' | 'upload' | 'embed' | 'screen';

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function isValidUrl(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

export default function SelectVideoModal({
  isOpen,
  onClose,
  isOwner,
  onSelectUrl,
  onSelectEmbed,
  onSelectFile,
  onStartScreenShare,
}: SelectVideoModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('url');

  // URL tab state
  const [urlInput, setUrlInput] = useState('');
  const [urlPreview, setUrlPreview] = useState('');

  // Embed tab state
  const [embedInput, setEmbedInput] = useState('');
  const [selectedOtt, setSelectedOtt] = useState<string | null>(null);

  // File tab state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setUrlInput(val);
    if (isValidUrl(val)) {
      setUrlPreview(val);
    } else {
      setUrlPreview('');
    }
  };

  const handleLoadUrl = () => {
    if (!isValidUrl(urlInput)) return;
    onSelectUrl(urlInput);
    onClose();
  };

  const handleLoadEmbed = () => {
    if (!isValidUrl(embedInput)) return;
    onSelectEmbed(embedInput);
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('video/')) {
      setSelectedFile(file);
    }
  }, []);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handlePlayFile = () => {
    if (!selectedFile) return;
    onSelectFile(selectedFile);
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const allTabs: { id: Tab; label: string; icon: React.ReactNode; ownerOnly?: boolean }[] = [
    {
      id: 'url',
      label: 'URL',
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      ),
    },
    {
      id: 'upload',
      label: 'Upload',
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      ),
    },
    {
      id: 'embed',
      label: 'Embed',
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
        </svg>
      ),
    },
    {
      id: 'screen',
      label: 'Screen Share',
      ownerOnly: true,
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
  ];

  const tabs = allTabs.filter((t) => !t.ownerOnly || isOwner);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={handleBackdropClick}
          style={{ backdropFilter: 'blur(12px)', backgroundColor: 'rgba(0,0,0,0.7)' }}
        >
          <motion.div
            initial={{ y: 80, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 60, opacity: 0, scale: 0.97 }}
            transition={{ type: 'spring', damping: 28, stiffness: 340 }}
            className="w-full max-w-lg bg-gradient-to-b from-[#1a1a2e]/95 to-[#12121c]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-white font-semibold text-sm">Select Video Source</h2>
                  <p className="text-white/40 text-xs">Choose how to load video for the party</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg hover:bg-white/10 text-white/50 hover:text-white flex items-center justify-center transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tab Pills */}
            <div className="flex gap-1.5 px-5 pt-4">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-900/40'
                      : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="p-5 pt-4 min-h-[260px]">
              <AnimatePresence mode="wait">
                {/* === DIRECT URL TAB === */}
                {activeTab === 'url' && (
                  <motion.div
                    key="url"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-4"
                  >
                    <div>
                      <label className="block text-white/60 text-xs font-medium mb-2">
                        Video URL (.mp4, .m3u8, YouTube, etc.)
                      </label>
                      <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 focus-within:border-blue-500/50 focus-within:bg-white/8 transition-all">
                        <svg className="w-4 h-4 text-white/30 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                        <input
                          type="url"
                          value={urlInput}
                          onChange={handleUrlChange}
                          placeholder="https://example.com/video.mp4"
                          className="flex-1 bg-transparent text-white text-sm placeholder-white/25 outline-none min-w-0"
                        />
                        {urlInput && (
                          <button
                            onClick={() => { setUrlInput(''); setUrlPreview(''); }}
                            className="text-white/30 hover:text-white/60 transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* URL Preview Badge */}
                    {urlPreview && (
                      <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2">
                        <svg className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-blue-300 text-xs truncate">{urlPreview}</span>
                      </div>
                    )}

                    <p className="text-white/30 text-xs">
                      Supports direct MP4/WebM/HLS streams, YouTube direct links, and most video CDN URLs.
                    </p>

                    <button
                      onClick={handleLoadUrl}
                      disabled={!isValidUrl(urlInput)}
                      className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 disabled:from-white/10 disabled:to-white/10 disabled:cursor-not-allowed text-white font-semibold text-sm py-2.5 rounded-xl transition-all shadow-lg shadow-blue-900/30 active:scale-[0.98]"
                    >
                      Load for Everyone
                    </button>
                  </motion.div>
                )}

                {/* === OTT & EMBED SITE TAB === */}
                {activeTab === 'embed' && (
                  <motion.div
                    key="embed"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-4"
                  >
                    <div>
                      <label className="block text-white/60 text-xs font-medium mb-2">
                        OTT / Movie Site URL
                      </label>
                      <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 focus-within:border-purple-500/50 transition-all">
                        <svg className="w-4 h-4 text-white/30 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                        </svg>
                        <input
                          type="url"
                          value={embedInput}
                          onChange={(e) => {
                            setEmbedInput(e.target.value);
                            setSelectedOtt(null);
                          }}
                          placeholder="https://netmirror.plus/movie/..."
                          className="flex-1 bg-transparent text-white text-sm placeholder-white/25 outline-none min-w-0"
                        />
                      </div>
                    </div>

                    {/* OTT Grid Selection */}
                    <div>
                      <span className="block text-white/40 text-[10px] font-semibold uppercase tracking-wider mb-2">
                        Quick Launch OTT & Movie Sites
                      </span>
                      <div className="grid grid-cols-5 gap-2">
                        {[
                          { name: 'NetMirror', url: 'https://netmirror.plus/', logo: '🎬', isEmbeddable: true, color: 'hover:border-pink-500/50 hover:bg-pink-500/10' },
                          { name: 'Netflix', url: 'https://netflix.com', logo: '🍿', isEmbeddable: false, color: 'hover:border-red-500/50 hover:bg-red-500/10' },
                          { name: 'JioCinema', url: 'https://jiocinema.com', logo: '👁️', isEmbeddable: false, color: 'hover:border-fuchsia-500/50 hover:bg-fuchsia-500/10' },
                          { name: 'Hotstar', url: 'https://hotstar.com', logo: '🌟', isEmbeddable: false, color: 'hover:border-blue-500/50 hover:bg-blue-500/10' },
                          { name: 'Prime', url: 'https://primevideo.com', logo: '💙', isEmbeddable: false, color: 'hover:border-cyan-500/50 hover:bg-cyan-500/10' },
                        ].map((ott) => (
                          <button
                            key={ott.name}
                            type="button"
                            onClick={() => {
                              setSelectedOtt(ott.name);
                              if (ott.isEmbeddable) {
                                setEmbedInput(ott.url);
                              } else {
                                setEmbedInput('');
                              }
                            }}
                            className={`flex flex-col items-center justify-center p-2 rounded-xl border border-white/5 bg-white/[0.02] transition-all duration-200 active:scale-95 group ${
                              selectedOtt === ott.name
                                ? 'border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-900/30'
                                : ott.color
                            }`}
                          >
                            <span className="text-lg group-hover:scale-110 transition-transform">{ott.logo}</span>
                            <span className="text-[9px] text-white/50 group-hover:text-white mt-1 font-semibold truncate w-full text-center">
                              {ott.name}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* OTT Helper Box */}
                    {selectedOtt && selectedOtt !== 'NetMirror' && (
                      <div className="bg-purple-950/20 border border-purple-500/20 rounded-xl p-3.5 space-y-3">
                        <div className="flex items-center gap-2 text-purple-400 text-xs font-semibold">
                          <span>🌐</span>
                          <span>Streaming {selectedOtt} Together</span>
                        </div>
                        <p className="text-white/60 text-[11px] leading-relaxed">
                          Commercial OTT platforms block direct embedding inside browser iframes due to DRM and security policies.
                        </p>
                        
                        {/* Option 1: Direct screen share */}
                        <div className="bg-white/[0.03] border border-white/5 rounded-lg p-2.5 space-y-1.5">
                          <span className="block text-[10px] text-purple-300 font-bold uppercase tracking-wider">
                            Option 1: Stream Streamer's Tab / Screen (Live)
                          </span>
                          <span className="block text-white/50 text-[10px] leading-relaxed">
                            Share your active browser tab, window, or whole screen. Play the show/movie in that tab, and everyone will see and hear your playback instantly!
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              onStartScreenShare();
                              onClose();
                            }}
                            className="w-full mt-1.5 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
                          >
                            🖥️ Start Live Screen Share
                          </button>
                        </div>

                        {/* Option 2: File sync */}
                        <div className="bg-white/[0.02] border border-white/5 rounded-lg p-2.5 space-y-1">
                          <span className="block text-[10px] text-white/40 font-bold uppercase tracking-wider">
                            Option 2: High-Def File Stream
                          </span>
                          <span className="block text-white/50 text-[10px] leading-relaxed">
                            Drag your downloaded movie file into the <strong>Local File</strong> tab. This uses our low-latency P2P WebRTC connection to broadcast it perfectly to everyone!
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            const urls: Record<string, string> = {
                              Netflix: 'https://netflix.com',
                              JioCinema: 'https://jiocinema.com',
                              Hotstar: 'https://hotstar.com',
                              Prime: 'https://primevideo.com',
                            };
                            window.open(urls[selectedOtt], '_blank');
                          }}
                          className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 text-[11px] font-semibold transition-all cursor-pointer"
                        >
                          Open {selectedOtt} Site in New Tab ↗
                        </button>
                      </div>
                    )}

                    {/* NetMirror Info */}
                    {(!selectedOtt || selectedOtt === 'NetMirror') && (
                      <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-3.5 space-y-1">
                        <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
                          <span>✅</span>
                          <span>NetMirror Integration Enabled</span>
                        </div>
                        <p className="text-white/50 text-[11px] leading-relaxed">
                          <strong>NetMirror (netmirror.plus)</strong> is natively supported! Enter any movie link from netmirror.plus, and it will load perfectly for all party members.
                        </p>
                      </div>
                    )}

                    {/* Warning */}
                    <div className="flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
                      <svg className="w-3.5 h-3.5 text-yellow-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span className="text-yellow-300/80 text-xs">
                        Playback sync is manual in embed mode
                      </span>
                    </div>

                    <button
                      onClick={handleLoadEmbed}
                      disabled={!isValidUrl(embedInput)}
                      className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:from-white/10 disabled:to-white/10 disabled:cursor-not-allowed text-white font-semibold text-sm py-2.5 rounded-xl transition-all shadow-lg shadow-purple-900/30 active:scale-[0.98]"
                    >
                      Load Embedded Player
                    </button>
                  </motion.div>
                )}

                {/* === UPLOAD TAB === */}
                {activeTab === 'upload' && (
                  <motion.div
                    key="upload"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-4"
                  >
                    <CloudinaryUpload
                      onSuccess={(url, _title, _duration) => {
                        onSelectUrl(url);
                        onClose();
                      }}
                    />
                  </motion.div>
                )}

                {/* === SCREEN SHARE TAB === */}
                {activeTab === 'screen' && isOwner && (
                  <motion.div
                    key="screen"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-4"
                  >
                    <div className="flex flex-col items-center gap-4 py-4">
                      <div className="w-16 h-16 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
                        <svg className="w-8 h-8 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div className="text-center">
                        <h3 className="text-white font-semibold text-sm mb-1">Share Your Screen</h3>
                        <p className="text-white/50 text-xs leading-relaxed max-w-xs">
                          Broadcast your screen, a browser tab, or any app window live to all party members in real time.
                        </p>
                      </div>
                      <div className="w-full bg-purple-950/20 border border-purple-500/20 rounded-xl p-3 space-y-1">
                        <span className="block text-[10px] text-purple-300 font-bold uppercase tracking-wider">Great for:</span>
                        <ul className="text-white/50 text-[11px] space-y-0.5 list-disc list-inside">
                          <li>Netflix, JioCinema, Hotstar, Prime Video</li>
                          <li>Any site that blocks embedding</li>
                          <li>Presentations or anything on your screen</li>
                        </ul>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onStartScreenShare?.();
                          onClose();
                        }}
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-sm font-bold transition-all shadow-lg shadow-purple-900/30 active:scale-[0.98] cursor-pointer"
                      >
                        🖥️ Start Live Screen Share
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
