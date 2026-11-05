export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const invLerp = (a: number, b: number, t: number) => clamp((t - a) / (b - a), 0, 1);
export const dist2 = (ax: number, ay: number, bx: number, by: number) => {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
};
export const dist = (ax: number, ay: number, bx: number, by: number) => Math.sqrt(dist2(ax, ay, bx, by));
/** shortest signed difference b - a in radians */
export const angleDiff = (a: number, b: number) => {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
};
export const rotateTowards = (a: number, b: number, maxStep: number) => {
  const d = angleDiff(a, b);
  if (Math.abs(d) <= maxStep) return b;
  return a + Math.sign(d) * maxStep;
};
/** frame-rate independent exponential approach */
export const damp = (a: number, b: number, rate: number, dt: number) => lerp(a, b, 1 - Math.exp(-rate * dt));
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInCubic = (t: number) => t * t * t;
export const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

/** distance from point p to segment ab */
export function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const abx = bx - ax;
  const aby = by - ay;
  const len2 = abx * abx + aby * aby;
  let t = len2 > 0 ? ((px - ax) * abx + (py - ay) * aby) / len2 : 0;
  t = clamp(t, 0, 1);
  const cx = ax + abx * t;
  const cy = ay + aby * t;
  return Math.sqrt(dist2(px, py, cx, cy));
}

/** projection parameter of p onto segment ab (0..1, unclamped) */
export function segmentT(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const abx = bx - ax;
  const aby = by - ay;
  const len2 = abx * abx + aby * aby;
  return len2 > 0 ? ((px - ax) * abx + (py - ay) * aby) / len2 : 0;
}

/** Seeded RNG (mulberry32). Deterministic per run so the bot can reproduce crashes. */
export class RNG {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0 || 1;
  }
  get seed() {
    return this.s;
  }
  next() {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a: number, b: number) {
    return a + (b - a) * this.next();
  }
  int(a: number, b: number) {
    return Math.floor(this.range(a, b + 1));
  }
  chance(p: number) {
    return this.next() < p;
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  sign() {
    return this.next() < 0.5 ? -1 : 1;
  }
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }
  weighted<T>(items: readonly T[], weight: (t: T) => number): T | undefined {
    let total = 0;
    for (const it of items) total += Math.max(0, weight(it));
    if (total <= 0) return undefined;
    let r = this.next() * total;
    for (const it of items) {
      r -= Math.max(0, weight(it));
      if (r <= 0) return it;
    }
    return items[items.length - 1];
  }
}

/** Visual-only randomness (never affects simulation). */
export const vrand = Math.random;
export const vrange = (a: number, b: number) => a + (b - a) * Math.random();

/**
 * Damped spring step, numerically stable for any dt (semi-implicit Euler, substepped at 240Hz).
 * Returns the new [x, v] packed into the provided out array.
 */
export function springStep(x: number, v: number, k: number, c: number, dt: number, out: number[]) {
  const n = Math.max(1, Math.ceil(dt * 240));
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    v += (-k * x - c * v) * h;
    x += v * h;
  }
  out[0] = Number.isFinite(x) ? x : 0;
  out[1] = Number.isFinite(v) ? v : 0;
  return out;
}
