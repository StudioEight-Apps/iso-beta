import { isMuted } from './sound'

/** Vibrate where supported. Follows the mute toggle so one switch silences everything. */
export function buzz(pattern: number | number[]): void {
  if (isMuted()) return
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(pattern)
  } catch {
    /* ignore */
  }
}
