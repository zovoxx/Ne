import { body, circle, eye, fill, glow, linear, noGlow, OUT, poly, radial, rrect, star, stroke, TAU, type Ctx } from './kit';

/* ═══════════════ BIOME 3 — CLOCKWORK FOUNDRY (dark iron, brass, red-hot) ═══════════════ */

const IRON = (c: Ctx, y0: number, y1: number) =>
  linear(c, 0, y0, 0, y1, [
    [0, '#8a8f9e'],
    [0.5, '#4a4e5c'],
    [1, '#262833'],
  ]);

export function drawRivethound(c: Ctx, w: number, h: number) {
  const cx = w / 2 - 2;
  const cy = h / 2 + 3;
  for (const lx of [-11, -4, 5, 11]) {
    c.beginPath();
    c.moveTo(cx + lx, cy + 4);
    c.lineTo(cx + lx - 2, cy + 13);
    stroke(c, '#2a2a33', 3);
  }
  poly(c, [cx - 16, cy - 2, cx - 24, cy - 8, cx - 18, cy + 2]);
  body(c, '#5a5e6c', OUT, 1.2);
  rrect(c, cx - 16, cy - 8, 28, 14, 6);
  body(c, IRON(c, cy - 8, cy + 6));
  // rivets
  for (const x of [-11, -4, 3]) {
    circle(c, cx + x, cy - 4, 1.2);
    fill(c, '#d9c08a');
  }
  // head
  rrect(c, cx + 8, cy - 11, 14, 12, 4);
  body(c, IRON(c, cy - 11, cy + 1), OUT, 1.8);
  poly(c, [cx + 10, cy - 11, cx + 12, cy - 18, cx + 15, cy - 11]);
  body(c, '#4a4e5c', OUT, 1.2);
  glow(c, '#ff3b2a', 6);
  c.fillStyle = '#ff6a4a';
  c.fillRect(cx + 13, cy - 7, 8, 3);
  noGlow(c);
}

export function drawCoilsentry(c: Ctx, w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2 + 6;
  rrect(c, cx - 12, cy - 6, 24, 16, 6);
  body(c, IRON(c, cy - 6, cy + 10));
  for (const s of [-1, 1]) {
    circle(c, cx + s * 10, cy + 10, 4);
    body(c, '#2a2a33', OUT, 1.2);
  }
  // coil
  c.beginPath();
  c.moveTo(cx, cy - 6);
  c.lineTo(cx, cy - 20);
  stroke(c, '#c9a35a', 3);
  for (let i = 0; i < 4; i++) {
    c.beginPath();
    c.ellipse(cx, cy - 9 - i * 3.5, 5, 1.6, 0, 0, TAU);
    stroke(c, '#e8c070', 1.2);
  }
  glow(c, '#7fe3ff', 10);
  circle(c, cx, cy - 23, 4);
  fill(c, '#e0fbff');
  noGlow(c);
  eye(c, cx, cy + 1, 2.4, '#7fe3ff', 4);
}

export function drawPylon(c: Ctx, w: number, h: number) {
  const cx = w / 2;
  c.beginPath();
  c.ellipse(cx, h * 0.82, 9, 4, 0, 0, TAU);
  body(c, '#2a2a33', OUT, 1.2);
  rrect(c, cx - 3.5, h * 0.2, 7, h * 0.62, 2);
  body(c, IRON(c, h * 0.2, h * 0.8), OUT, 1.4);
  glow(c, '#7fe3ff', 9);
  circle(c, cx, h * 0.18, 4.5);
  fill(c, '#d6fbff');
  noGlow(c);
}

export function drawIronclad(c: Ctx, w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2 + 4;
  // legs
  rrect(c, cx - 15, cy + 12, 11, 14, 3);
  body(c, '#2a2a33', OUT, 1.4);
  rrect(c, cx + 4, cy + 12, 11, 14, 3);
  body(c, '#2a2a33', OUT, 1.4);
  // fists
  for (const s of [-1, 1]) {
    rrect(c, cx + s * 22 - 7, cy - 4, 14, 16, 5);
    body(c, IRON(c, cy - 4, cy + 12), OUT, 1.8);
  }
  // torso
  rrect(c, cx - 18, cy - 20, 36, 34, 8);
  body(c, IRON(c, cy - 20, cy + 14));
  // plating seams + rivets
  c.beginPath();
  c.moveTo(cx - 16, cy - 4);
  c.lineTo(cx + 16, cy - 4);
  stroke(c, 'rgba(0,0,0,0.4)', 1.4);
  for (const [x, y] of [
    [-13, -16],
    [13, -16],
    [-13, 9],
    [13, 9],
  ]) {
    circle(c, cx + x, cy + y, 1.6);
    fill(c, '#d9c08a');
  }
  // furnace grill
  glow(c, '#ff5a2a', 8);
  rrect(c, cx - 8, cy - 1, 16, 9, 2);
  fill(c, '#ff8a3d');
  noGlow(c);
  for (let i = 0; i < 3; i++) {
    c.fillStyle = '#3a1a10';
    c.fillRect(cx - 7 + i * 5.5, cy, 2, 7);
  }
  // visor
  c.fillStyle = '#0a0a0e';
  c.fillRect(cx - 10, cy - 14, 20, 5);
  glow(c, '#ffb347', 5);
  c.fillStyle = '#ffd27a';
  c.fillRect(cx - 7, cy - 13, 14, 2.4);
  noGlow(c);
}

export function drawForgemortar(c: Ctx, w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2 + 4;
  c.beginPath();
  c.ellipse(cx, cy + 10, 20, 9, 0, 0, TAU);
  body(c, '#2a2a33', OUT, 1.8);
  rrect(c, cx - 15, cy - 4, 30, 16, 5);
  body(c, IRON(c, cy - 4, cy + 12));
  // barrel pointing up
  c.beginPath();
  c.moveTo(cx - 8, cy - 2);
  c.lineTo(cx - 10, cy - 22);
  c.lineTo(cx + 10, cy - 22);
  c.lineTo(cx + 8, cy - 2);
  c.closePath();
  body(c, linear(c, cx - 10, 0, cx + 10, 0, [
    [0, '#3a3a44'],
    [0.5, '#9aa0b0'],
    [1, '#3a3a44'],
  ]), OUT, 1.8);
  c.beginPath();
  c.ellipse(cx, cy - 22, 10, 3.5, 0, 0, TAU);
  glow(c, '#ff7a2a', 8);
  fill(c, '#ff9a4a');
  noGlow(c);
  rrect(c, cx - 11, cy - 12, 22, 3, 1);
  fill(c, '#c9a35a');
}

export function drawBellwether(c: Ctx, w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2 + 6;
  rrect(c, cx - 10, cy - 2, 20, 18, 5);
  body(c, IRON(c, cy - 2, cy + 16));
  for (const s of [-1, 1]) {
    c.beginPath();
    c.moveTo(cx + s * 10, cy + 4);
    c.lineTo(cx + s * 17, cy + 10);
    stroke(c, '#4a4e5c', 3);
  }
  // bell head
  c.beginPath();
  c.moveTo(cx - 13, cy - 2);
  c.quadraticCurveTo(cx - 12, cy - 26, cx, cy - 27);
  c.quadraticCurveTo(cx + 12, cy - 26, cx + 13, cy - 2);
  c.closePath();
  glow(c, '#ffd27a', 7);
  body(c, linear(c, cx - 13, 0, cx + 13, 0, [
    [0, '#8a6a2a'],
    [0.45, '#ffe7a0'],
    [1, '#8a6a2a'],
  ]), OUT, 2);
  noGlow(c);
  circle(c, cx, cy - 2, 3);
  fill(c, '#5a3a10');
  c.beginPath();
  c.moveTo(cx - 9, cy - 10);
  c.lineTo(cx + 9, cy - 10);
  stroke(c, '#8a5a1a', 1.4);
}

export function drawGyrosaw(c: Ctx, w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2;
  star(c, cx, cy, 15, 21, 12);
  body(c, linear(c, 0, cy - 20, 0, cy + 20, [
    [0, '#e6e9f2'],
    [1, '#7a8090'],
  ]), OUT, 1.6);
  circle(c, cx, cy, 11);
  body(c, IRON(c, cy - 11, cy + 11), OUT, 1.4);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + 0.4;
    circle(c, cx + Math.cos(a) * 7, cy + Math.sin(a) * 7, 1.4);
    fill(c, '#d9c08a');
  }
  glow(c, '#ffe14a', 8);
  circle(c, cx, cy, 4.4);
  fill(c, '#fff6c2');
  noGlow(c);
}

export function drawSlagcrawler(c: Ctx, w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2 + 3;
  for (let i = 0; i < 3; i++)
    for (const s of [-1, 1]) {
      c.beginPath();
      c.moveTo(cx - 8 + i * 8, cy + s * 6);
      c.lineTo(cx - 11 + i * 9, cy + s * 16);
      stroke(c, '#2a2a33', 2.4);
    }
  c.beginPath();
  c.ellipse(cx, cy, 19, 13, 0, 0, TAU);
  body(c, '#262833');
  // molten back
  c.beginPath();
  c.ellipse(cx - 2, cy - 2, 14, 9, 0, 0, TAU);
  glow(c, '#ff5a1a', 8);
  fill(c, radial(c, cx - 2, cy - 2, 1, 15, [
    [0, '#fff1a6'],
    [0.4, '#ff8a3d'],
    [1, '#a8300a'],
  ]));
  noGlow(c);
  c.beginPath();
  c.moveTo(cx - 2, cy - 11);
  c.lineTo(cx - 2, cy + 7);
  stroke(c, '#3a1a10', 1.6);
  circle(c, cx + 17, cy, 6);
  body(c, '#3a3a44', OUT, 1.6);
  eye(c, cx + 19, cy - 2, 1.6, '#ffb347', 4);
}

export function drawSparkmite(c: Ctx, w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2;
  for (const s of [-1, 1]) {
    c.beginPath();
    c.moveTo(cx - 2, cy);
    c.lineTo(cx - 5, cy + s * 7);
    c.moveTo(cx + 2, cy);
    c.lineTo(cx + 4, cy + s * 7);
    stroke(c, '#2a2a33', 1.6);
  }
  c.beginPath();
  c.ellipse(cx, cy, 8, 6, 0, 0, TAU);
  body(c, IRON(c, cy - 6, cy + 6), OUT, 1.6);
  glow(c, '#7fe3ff', 7);
  circle(c, cx + 4, cy - 1, 2.6);
  fill(c, '#e0fbff');
  noGlow(c);
}
