'use client';

import React, { useCallback, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface SelectVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  isOwner: boolean;
  onSelectUrl: (url: string) => void;
  onSelectEmbed: (url: string) => void;
  onSelectFile: (file: File) => void;
  onStartScreenShare: () => void;
}

type Tab = 'url' | 'file' | 'screen';

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
      id: 'file',
      label: 'Local File',
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
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

                {/* === LOCAL FILE TAB === */}
                {activeTab === 'file' && (
                  <motion.div
                    key="file"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-4"
                  >
                    <div
                      className={`relative overflow-hidden border-2 border-dashed rounded-xl transition-all duration-300 ${
                        isDragging
                          ? 'border-blue-500 bg-blue-500/10 scale-[1.02]'
                          : 'border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/30'
                      }`}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                    >
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="video/mp4,video/webm"
                        className="hidden"
                      />

                      <div className="flex flex-col items-center justify-center py-10 px-4 text-center cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                        {selectedFile ? (
                          <>
                            <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center mb-3 text-blue-400 shadow-inner">
                              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                            <span className="text-white font-medium text-sm truncate max-w-[200px] mb-1">
                              {selectedFile.name}
                            </span>
                            <span className="text-white/40 text-xs">{formatFileSize(selectedFile.size)}</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                              className="mt-3 text-xs text-red-400 hover:text-red-300 transition-colors"
                            >
                              Remove file
                            </button>
                          </>
                        ) : (
                          <>
                            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mb-3 text-white/50 group-hover:scale-110 transition-transform">
                              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                              </svg>
                            </div>
                            <span className="text-white font-medium text-sm mb-1">Click or drag video file</span>
                            <span className="text-white/40 text-xs text-balance">Supports MP4, WebM up to 10GB</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-start gap-2 bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2">
                      <svg className="w-3.5 h-3.5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-blue-300/80 text-xs">
                        This file will be broadcasted P2P to everyone in the room. You must remain on the page to keep the broadcast active.
                      </span>
                    </div>

                    <button
                      onClick={handlePlayFile}
                      disabled={!selectedFile}
                      className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 disabled:from-white/10 disabled:to-white/10 disabled:cursor-not-allowed text-white font-semibold text-sm py-2.5 rounded-xl transition-all shadow-lg shadow-blue-900/30 active:scale-[0.98]"
                    >
                      Broadcast File to Room
                    </button>
                  </motion.div>
                )}

                {/* === SCREEN SHARE TAB === */}
                {activeTab === 'screen' && (
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
