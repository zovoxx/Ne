/** Canvas2D drawing kit for procedural art. All coordinates are in world units; the atlas pre-scales. */
export type Ctx = CanvasRenderingContext2D;
export const TAU = Math.PI * 2;
/** pixels per world unit in the atlas (set by the atlas builder) */
export const ART = { res: 2 };
export const OUT = '#0b0711';

export function glow(c: Ctx, color: string, blur: number) {
  c.shadowColor = color;
  c.shadowBlur = blur * ART.res;
  c.shadowOffsetX = 0;
  c.shadowOffsetY = 0;
}
export function noGlow(c: Ctx) {
  c.shadowBlur = 0;
  c.shadowColor = 'rgba(0,0,0,0)';
}
export function circle(c: Ctx, x: number, y: number, r: number) {
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
}
export function ellipse(c: Ctx, x: number, y: number, rx: number, ry: number, rot = 0) {
  c.beginPath();
  c.ellipse(x, y, rx, ry, rot, 0, TAU);
}
export function poly(c: Ctx, pts: number[], close = true) {
  c.beginPath();
  c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  if (close) c.closePath();
}
export function fill(c: Ctx, style: string | CanvasGradient) {
  c.fillStyle = style;
  c.fill();
}
export function stroke(c: Ctx, style: string | CanvasGradient, w: number) {
  c.strokeStyle = style;
  c.lineWidth = w;
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.stroke();
}
/** fill with a dark outline drawn underneath (keeps silhouettes readable on any floor) */
export function body(c: Ctx, style: string | CanvasGradient, outline = OUT, w = 2.6) {
  stroke(c, outline, w * 2);
  fill(c, style);
}
export function radial(c: Ctx, x: number, y: number, r0: number, r1: number, stops: [number, string][]) {
  const g = c.createRadialGradient(x, y, r0, x, y, r1);
  for (const [o, col] of stops) g.addColorStop(o, col);
  return g;
}
export function linear(c: Ctx, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]) {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  for (const [o, col] of stops) g.addColorStop(o, col);
  return g;
}
/** glowing eye */
export function eye(c: Ctx, x: number, y: number, r: number, color: string, blur = 6) {
  glow(c, color, blur);
  circle(c, x, y, r);
  fill(c, color);
  noGlow(c);
  circle(c, x - r * 0.25, y - r * 0.3, r * 0.4);
  fill(c, 'rgba(255,255,255,0.9)');
}
/** soft blob with deterministic wobble */
export function blob(c: Ctx, x: number, y: number, rx: number, ry: number, wobble: number, n: number, seed: number) {
  c.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU;
    const k = 1 + Math.sin(a * 3 + seed) * wobble + Math.sin(a * 5 + seed * 2.3) * wobble * 0.5;
    const px = x + Math.cos(a) * rx * k;
    const py = y + Math.sin(a) * ry * k;
    if (i === 0) c.moveTo(px, py);
    else c.lineTo(px, py);
  }
  c.closePath();
}
export function star(c: Ctx, x: number, y: number, r0: number, r1: number, n: number, rot = 0) {
  c.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i / (n * 2)) * TAU;
    const r = i % 2 ? r0 : r1;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) c.moveTo(px, py);
    else c.lineTo(px, py);
  }
  c.closePath();
}
export function rrect(c: Ctx, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
}
/** deterministic pseudo random for art */
export function prand(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
export function hex(n: number, a = 1) {
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return a >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a})`;
}
export function shade(n: number, k: number) {
  const r = Math.min(255, Math.max(0, Math.round(((n >> 16) & 255) * k)));
  const g = Math.min(255, Math.max(0, Math.round(((n >> 8) & 255) * k)));
  const b = Math.min(255, Math.max(0, Math.round((n & 255) * k)));
  return (r << 16) | (g << 8) | b;
}
