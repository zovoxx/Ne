import { TUNING } from '../config/tuning';

/** navigator.vibrate wrapper: optional, rate-limited, never required (iOS Safari has no vibrate). */
export class Haptics {
  enabled = true;
  private last = 0;
  readonly supported = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

  pulse(pattern: number | readonly number[], force = false) {
    if (!this.enabled || !this.supported) return;
    const now = performance.now();
    if (!force && now - this.last < TUNING.haptics.minInterval) return;
    this.last = now;
    try {
      navigator.vibrate(pattern as number | number[]);
    } catch {
      /* ignore */
    }
  }
}
