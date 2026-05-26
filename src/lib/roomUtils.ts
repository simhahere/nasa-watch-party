/**
 * roomUtils.ts
 * Utility functions for NASA Watch Party room management.
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Generates a random 6-digit room code string (e.g. "047382").
 */
export function generateRoomCode(): string {
  const code = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, '0');
  return code;
}

/**
 * Generates a new UUID v4 to use as a unique user/session ID.
 */
export function generateUserId(): string {
  return uuidv4();
}

/**
 * Formats a duration in milliseconds into a 'MM:SS' string.
 * @param ms - Duration in milliseconds (non-negative).
 * @returns Formatted string like '04:32'.
 */
export function formatTime(ms: number): string {
  if (ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return `${mm}:${ss}`;
}

/**
 * Validates whether a room code is exactly 6 numeric digits.
 * @param code - The room code string to validate.
 * @returns true if valid, false otherwise.
 */
export function isValidRoomCode(code: string): boolean {
  return /^\d{6}$/.test(code);
}
