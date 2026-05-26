'use client';

import React, { useState, useRef, useCallback, DragEvent, ChangeEvent } from 'react';
import { Upload, Film, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { uploadVideoToCloudinary } from '@/lib/cloudinary';

interface CloudinaryUploadProps {
  onSuccess: (url: string, title: string, duration?: number) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
}

type UploadState = 'idle' | 'uploading' | 'success' | 'error';

const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export default function CloudinaryUpload({
  onSuccess,
  onError,
  disabled = false,
}: CloudinaryUploadProps) {
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [progress, setProgress] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [resultUrl, setResultUrl] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const inputRef = useRef<HTMLInputElement>(null);

  const isCloudinaryConfigured =
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME !== 'your_cloud_name' &&
    !!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

  const validateFile = (file: File): string | null => {
    if (!file.type.startsWith('video/')) {
      return 'Only video files are allowed.';
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File size exceeds 2 GB limit (your file: ${formatBytes(file.size)}).`;
    }
    return null;
  };

  const handleUpload = useCallback(
    async (file: File) => {
      const validationError = validateFile(file);
      if (validationError) {
        setErrorMessage(validationError);
        setUploadState('error');
        onError?.(validationError);
        return;
      }

      setSelectedFile(file);
      setUploadState('uploading');
      setProgress(0);
      setErrorMessage('');

      // Animate progress incrementally until we get a real value
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + Math.random() * 8;
        });
      }, 400);

      try {
        const result = await uploadVideoToCloudinary(file, (p: number) => {
          clearInterval(progressInterval);
          setProgress(Math.min(p, 99));
        });

        clearInterval(progressInterval);
        setProgress(100);
        setResultUrl(result.url);
        setUploadState('success');
        onSuccess(result.url, file.name, result.duration);
      } catch (err: unknown) {
        clearInterval(progressInterval);
        const msg = err instanceof Error ? err.message : 'Upload failed. Please try again.';
        setErrorMessage(msg);
        setUploadState('error');
        onError?.(msg);
      }
    },
    [onSuccess, onError],
  );

  // ── Drag handlers ──────────────────────────────────────────────────────────
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (disabled) return;

    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    // Reset so the same file can be re-selected
    e.target.value = '';
  };

  const handleReset = () => {
    setUploadState('idle');
    setProgress(0);
    setSelectedFile(null);
    setResultUrl('');
    setErrorMessage('');
  };

  // ── Drop-zone border class ─────────────────────────────────────────────────
  const borderClass = isDragOver
    ? 'border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.4)]'
    : uploadState === 'success'
      ? 'border-green-400/60'
      : uploadState === 'error'
        ? 'border-red-400/60'
        : 'border-white/20 hover:border-white/40';

  return (
    <div className="w-full space-y-3">
      {/* Cloudinary not configured warning */}
      {!isCloudinaryConfigured && (
        <div className="flex items-center gap-2 rounded-xl border border-yellow-400/40 bg-yellow-400/10 px-4 py-3 text-sm text-yellow-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            Cloudinary not configured — set{' '}
            <code className="rounded bg-yellow-400/20 px-1 font-mono text-xs">
              NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
            </code>{' '}
            in <code className="rounded bg-yellow-400/20 px-1 font-mono text-xs">.env.local</code>
          </span>
        </div>
      )}

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Upload video file"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => {
          if (!disabled && uploadState === 'idle') inputRef.current?.click();
        }}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled && uploadState === 'idle') {
            inputRef.current?.click();
          }
        }}
        className={[
          'relative flex min-h-[200px] w-full cursor-pointer flex-col items-center justify-center gap-4',
          'rounded-2xl border-2 border-dashed bg-black/40 backdrop-blur-md',
          'transition-all duration-300',
          disabled ? 'cursor-not-allowed opacity-50' : '',
          borderClass,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {/* Hidden file input */}
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={handleFileChange}
          disabled={disabled}
        />

        {/* ── IDLE state ── */}
        {uploadState === 'idle' && (
          <>
            <div
              className={[
                'flex h-16 w-16 items-center justify-center rounded-2xl transition-all duration-300',
                isDragOver
                  ? 'bg-cyan-400/20 text-cyan-400'
                  : 'bg-white/10 text-white/60',
              ].join(' ')}
            >
              <Upload className="h-7 w-7" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-white">
                {isDragOver ? 'Drop your video here' : 'Drag & drop a video, or click to browse'}
              </p>
              <p className="mt-1 text-xs text-white/50">Supports all video formats · Max 2 GB</p>
            </div>
          </>
        )}

        {/* ── UPLOADING state ── */}
        {uploadState === 'uploading' && selectedFile && (
          <div className="w-full max-w-sm space-y-4 px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400">
                <Film className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{selectedFile.name}</p>
                <p className="text-xs text-white/50">
                  {formatBytes(selectedFile.size)} · {selectedFile.type}
                </p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-white/60">
                <span>Uploading…</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── SUCCESS state ── */}
        {uploadState === 'success' && (
          <div className="flex w-full max-w-sm flex-col items-center gap-3 px-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500/20 text-green-400">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <div className="w-full text-center">
              <p className="text-sm font-semibold text-green-400">Upload complete!</p>
              {selectedFile && (
                <p className="mt-0.5 truncate text-xs text-white/50">{selectedFile.name}</p>
              )}
            </div>
            {resultUrl && (
              <a
                href={resultUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="w-full truncate rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-center text-xs text-cyan-400 underline-offset-2 hover:underline"
              >
                {resultUrl}
              </a>
            )}
            {/* Reset button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleReset();
              }}
              className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white/70 transition hover:bg-white/20"
            >
              <X className="h-3 w-3" />
              Upload another
            </button>
          </div>
        )}

        {/* ── ERROR state ── */}
        {uploadState === 'error' && (
          <div className="flex w-full max-w-sm flex-col items-center gap-3 px-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/20 text-red-400">
              <AlertCircle className="h-7 w-7" />
            </div>
            <div>
              <p className="text-sm font-semibold text-red-400">Upload failed</p>
              {errorMessage && (
                <p className="mt-1 text-xs text-white/50">{errorMessage}</p>
              )}
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleReset();
              }}
              className="rounded-lg bg-red-500/20 px-4 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-500/30"
            >
              Try again
            </button>
          </div>
        )}

        {/* Drag-over overlay shimmer */}
        {isDragOver && (
          <div className="pointer-events-none absolute inset-0 rounded-2xl bg-cyan-400/5" />
        )}
      </div>
    </div>
  );
}
