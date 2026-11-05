import { circle, fill, glow, linear, noGlow, poly, radial, star, stroke, TAU, type Ctx } from './kit';

/* Icons are drawn white so they can be tinted (patron colours etc.). */

const W = 'rgba(255,255,255,1)';

export function icFlame(c: Ctx, w: number, h: number) {
  const cx = w / 2;
  c.beginPath();
  c.moveTo(cx, h * 0.08);
  c.bezierCurveTo(cx + w * 0.42, h * 0.38, cx + w * 0.34, h * 0.92, cx, h * 0.92);
  c.bezierCurveTo(cx - w * 0.34, h * 0.92, cx - w * 0.42, h * 0.5, cx - w * 0.12, h * 0.3);
  c.quadraticCurveTo(cx - w * 0.05, h * 0.5, cx + w * 0.04, h * 0.48);
  c.quadraticCurveTo(cx + w * 0.02, h * 0.3, cx, h * 0.08);
  fill(c, W);
  c.beginPath();
  c.moveTo(cx, h * 0.5);
  c.quadraticCurveTo(cx + w * 0.18, h * 0.7, cx, h * 0.84);
  c.quadraticCurveTo(cx - w * 0.16, h * 0.7, cx, h * 0.5);
  fill(c, 'rgba(0,0,0,0.35)');
}
export function icFlake(c: Ctx, w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2;
  const r = w * 0.42;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    c.beginPath();
    c.moveTo(cx, cy);
    c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    const bx = cx + Math.cos(a) * r * 0.6;
    const by = cy + Math.sin(a) * r * 0.6;
    c.moveTo(bx, by);
    c.lineTo(bx + Math.cos(a + 0.7) * r * 0.3, by + Math.sin(a + 0.7) * r * 0.3);
    c.moveTo(bx, by);
    c.lineTo(bx + Math.cos(a - 0.7) * r * 0.3, by + Math.sin(a - 0.7) * r * 0.3);
    stroke(c, W, w * 0.09);
  }
}
export function icBolt(c: Ctx, w: number, h: number) {
  poly(c, [w * 0.58, h * 0.05, w * 0.18, h * 0.55, w * 0.46, h * 0.55, w * 0.36, h * 0.95, w * 0.82, h * 0.4, w * 0.54, h * 0.4]);
  fill(c, W);
}
export function icWave(c: Ctx, w: number, h: number) {
  for (let k = 0; k < 2; k++) {
    c.beginPath();
    const y = h * (0.42 + k * 0.26);
    c.moveTo(w * 0.08, y);
    for (let i = 0; i <= 3; i++) c.quadraticCurveTo(w * (0.08 + i * 0.28 + 0.07), y - h * 0.18, w * (0.08 + i * 0.28 + 0.14), y);
    stroke(c, W, w * 0.1);
  }
}
export function icSun(c: Ctx, w: number, h: number) {
  circle(c, w / 2, h / 2, w * 0.2);
  fill(c, W);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    c.beginPath();
    c.moveTo(w / 2 + Math.cos(a) * w * 0.29, h / 2 + Math.sin(a) * h * 0.29);
    c.lineTo(w / 2 + Math.cos(a) * w * 0.45, h / 2 + Math.sin(a) * h * 0.45);
    stroke(c, W, w * 0.08);
  }
}
export function icEye(c: Ctx, w: number, h: number) {
  c.beginPath();
  c.moveTo(w * 0.05, h / 2);
  c.quadraticCurveTo(w / 2, h * 0.05, w * 0.95, h / 2);
  c.quadraticCurveTo(w / 2, h * 0.95, w * 0.05, h / 2);
  fill(c, W);
  circle(c, w / 2, h / 2, w * 0.16);
  fill(c, 'rgba(0,0,0,0.75)');
  circle(c, w / 2, h / 2, w * 0.06);
  fill(c, W);
}
export function icSwirl(c: Ctx, w: number, h: number) {
  c.beginPath();
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const a = t * TAU * 1.6;
    const r = w * 0.42 * t;
    const x = w / 2 + Math.cos(a) * r;
    const y = h / 2 + Math.sin(a) * r;
    if (i === 0) c.moveTo(x, y);
    else c.lineTo(x, y);
  }
  stroke(c, W, w * 0.1);
}
export function icThorn(c: Ctx, w: number, h: number) {
  c.beginPath();
  c.moveTo(w * 0.2, h * 0.9);
  c.quadraticCurveTo(w * 0.4, h * 0.4, w * 0.82, h * 0.1);
  stroke(c, W, w * 0.1);
  for (const [x, y, a] of [
    [0.32, 0.62, -2.4],
    [0.48, 0.42, 0.6],
    [0.62, 0.28, -2.2],
  ]) {
    poly(c, [w * x, h * y, w * x + Math.cos(a) * w * 0.22, h * y + Math.sin(a) * h * 0.22, w * x + Math.cos(a + 0.4) * w * 0.06, h * y + Math.sin(a + 0.4) * h * 0.06]);
    fill(c, W);
  }
}
export function icAnvil(c: Ctx, w: number, h: number) {
  poly(c, [w * 0.08, h * 0.35, w * 0.92, h * 0.35, w * 0.78, h * 0.55, w * 0.62, h * 0.55, w * 0.66, h * 0.78, w * 0.8, h * 0.88, w * 0.2, h * 0.88, w * 0.34, h * 0.78, w * 0.38, h * 0.55, w * 0.2, h * 0.5]);
  fill(c, W);
  star(c, w * 0.78, h * 0.18, w * 0.05, w * 0.13, 4);
  fill(c, W);
}
export function icKindle(c: Ctx, w: number, h: number) {
  icFlame(c, w, h);
  c.fillStyle = 'rgba(0,0,0,0.6)';
  c.fillRect(w * 0.44, h * 0.52, w * 0.12, h * 0.3);
  c.fillRect(w * 0.35, h * 0.61, w * 0.3, h * 0.12);
}
export function icHeart(c: Ctx, w: number, h: number) {
  c.beginPath();
  c.moveTo(w / 2, h * 0.88);
  c.bezierCurveTo(w * 0.05, h * 0.55, w * 0.08, h * 0.12, w * 0.32, h * 0.14);
  c.bezierCurveTo(w * 0.42, h * 0.15, w * 0.48, h * 0.24, w / 2, h * 0.3);
  c.bezierCurveTo(w * 0.52, h * 0.24, w * 0.58, h * 0.15, w * 0.68, h * 0.14);
  c.bezierCurveTo(w * 0.92, h * 0.12, w * 0.95, h * 0.55, w / 2, h * 0.88);
  fill(c, W);
}
export function icCoin(c: Ctx, w: number, h: number) {
  circle(c, w / 2, h / 2, w * 0.4);
  fill(c, W);
  circle(c, w / 2, h / 2, w * 0.26);
  stroke(c, 'rgba(0,0,0,0.35)', w * 0.06);
}
export function icBag(c: Ctx, w: number, h: number) {
  c.beginPath();
  c.moveTo(w * 0.35, h * 0.2);
  c.lineTo(w * 0.65, h * 0.2);
  c.lineTo(w * 0.58, h * 0.34);
  c.quadraticCurveTo(w * 0.95, h * 0.5, w * 0.82, h * 0.86);
  c.lineTo(w * 0.18, h * 0.86);
  c.quadraticCurveTo(w * 0.05, h * 0.5, w * 0.42, h * 0.34);
  c.closePath();
  fill(c, W);
  circle(c, w / 2, h * 0.62, w * 0.1);
  fill(c, 'rgba(0,0,0,0.4)');
}
export function icDrop(c: Ctx, w: number, h: number) {
  c.beginPath();
  c.moveTo(w / 2, h * 0.08);
  c.bezierCurveTo(w * 0.85, h * 0.5, w * 0.85, h * 0.9, w / 2, h * 0.9);
  c.bezierCurveTo(w * 0.15, h * 0.9, w * 0.15, h * 0.5, w / 2, h * 0.08);
  fill(c, W);
}
export function icDie(c: Ctx, w: number, h: number) {
  c.beginPath();
  c.roundRect(w * 0.15, h * 0.15, w * 0.7, h * 0.7, w * 0.12);
  fill(c, W);
  for (const [x, y] of [
    [0.35, 0.35],
    [0.65, 0.65],
    [0.5, 0.5],
    [0.65, 0.35],
    [0.35, 0.65],
  ]) {
    circle(c, w * x, h * y, w * 0.06);
    fill(c, 'rgba(0,0,0,0.6)');
  }
}
export function icSkull(c: Ctx, w: number, h: number) {
  c.beginPath();
  c.arc(w / 2, h * 0.42, w * 0.34, Math.PI * 0.9, Math.PI * 2.1);
  c.lineTo(w * 0.7, h * 0.8);
  c.lineTo(w * 0.3, h * 0.8);
  c.closePath();
  fill(c, W);
  circle(c, w * 0.37, h * 0.45, w * 0.09);
  circle(c, w * 0.63, h * 0.45, w * 0.09);
  fill(c, 'rgba(0,0,0,0.75)');
}
export function icCrown(c: Ctx, w: number, h: number) {
  poly(c, [w * 0.1, h * 0.78, w * 0.14, h * 0.3, w * 0.34, h * 0.52, w * 0.5, h * 0.2, w * 0.66, h * 0.52, w * 0.86, h * 0.3, w * 0.9, h * 0.78]);
  fill(c, W);
}
export function icHorns(c: Ctx, w: number, h: number) {
  for (const s of [-1, 1]) {
    c.beginPath();
    c.moveTo(w / 2 + s * w * 0.1, h * 0.7);
    c.quadraticCurveTo(w / 2 + s * w * 0.45, h * 0.6, w / 2 + s * w * 0.4, h * 0.12);
    c.quadraticCurveTo(w / 2 + s * w * 0.3, h * 0.45, w / 2 + s * w * 0.02, h * 0.5);
    fill(c, W);
  }
  circle(c, w / 2, h * 0.66, w * 0.14);
  fill(c, W);
}
export function icSword(c: Ctx, w: number, h: number) {
  poly(c, [w * 0.2, h * 0.85, w * 0.72, h * 0.18, w * 0.84, h * 0.16, w * 0.82, h * 0.28, w * 0.3, h * 0.92]);
  fill(c, W);
  c.beginPath();
  c.moveTo(w * 0.12, h * 0.68);
  c.lineTo(w * 0.36, h * 0.92);
  stroke(c, W, w * 0.08);
}

/* pickups / props (coloured) */
export function drawCoin(c: Ctx, w: number, h: number) {
  glow(c, '#ffb12a', 4);
  circle(c, w / 2, h / 2, w * 0.4);
  fill(c, radial(c, w * 0.4, h * 0.38, 1, w * 0.45, [
    [0, '#fff6c2'],
    [0.6, '#ffb12a'],
    [1, '#a86200'],
  ]));
  noGlow(c);
}
export function drawHeartPick(c: Ctx, w: number, h: number) {
  glow(c, '#ff4a6a', 5);
  icHeart(c, w, h);
  c.globalCompositeOperation = 'source-atop';
  c.fillStyle = linear(c, 0, 0, 0, h, [
    [0, '#ff9aac'],
    [1, '#d01a3a'],
  ]);
  c.fillRect(0, 0, w, h);
  c.globalCompositeOperation = 'source-over';
  noGlow(c);
}
export function drawRewardOrb(c: Ctx, w: number, h: number) {
  const r = w / 2;
  glow(c, '#fff1a6', 10);
  circle(c, r, r, r * 0.55);
  fill(c, radial(c, r * 0.85, r * 0.8, 1, r * 0.6, [
    [0, '#ffffff'],
    [0.5, '#fff1a6'],
    [1, '#ffb347'],
  ]));
  noGlow(c);
  star(c, r, r, r * 0.12, r * 0.42, 4, Math.PI / 4);
  fill(c, 'rgba(255,255,255,0.9)');
}
export function drawPortalRing(c: Ctx, w: number, h: number) {
  const r = w / 2;
  for (let i = 0; i < 4; i++) {
    c.beginPath();
    c.arc(r, r, r * (0.68 + i * 0.07), i * 1.6, i * 1.6 + Math.PI * (1.1 + i * 0.1));
    stroke(c, `rgba(255,255,255,${0.95 - i * 0.18})`, 3.2 - i * 0.5);
  }
  circle(c, r, r, r * 0.62);
  fill(c, radial(c, r, r, 0, r * 0.62, [
    [0, 'rgba(255,255,255,0.0)'],
    [0.7, 'rgba(255,255,255,0.12)'],
    [1, 'rgba(255,255,255,0.45)'],
  ]));
}
export function drawPedestal(c: Ctx, w: number, h: number) {
  c.beginPath();
  c.ellipse(w / 2, h * 0.7, w * 0.44, h * 0.22, 0, 0, TAU);
  fill(c, '#2a2238');
  c.beginPath();
  c.ellipse(w / 2, h * 0.62, w * 0.4, h * 0.18, 0, 0, TAU);
  fill(c, linear(c, 0, h * 0.45, 0, h * 0.8, [
    [0, '#6a5a8a'],
    [1, '#3a2f52'],
  ]));
  c.beginPath();
  c.ellipse(w / 2, h * 0.62, w * 0.4, h * 0.18, 0, 0, TAU);
  stroke(c, 'rgba(255,210,122,0.6)', 1.4);
}
