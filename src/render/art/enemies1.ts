import { blob, body, circle, eye, fill, glow, linear, noGlow, OUT, poly, radial, stroke, TAU, type Ctx } from './kit';

/* ═══════════════ BIOME 1 — ASHEN GARDENS (charcoal, ember orange, ash teal) ═══════════════ */

export function drawCinderling(c: Ctx, w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2 + 2;
  // horns
  poly(c, [cx - 8, cy - 9, cx - 14, cy - 19, cx - 4, cy - 12]);
  body(c, '#2a1a16', OUT, 1.6);
  poly(c, [cx + 8, cy - 9, cx + 14, cy - 19, cx + 4, cy - 12]);
  body(c, '#2a1a16', OUT, 1.6);
  // claws / feet
  for (const s of [-1, 1]) {
    poly(c, [cx + s * 9, cy + 7, cx + s * 15, cy + 12, cx + s * 8, cy + 12]);
    body(c, '#3a221b', OUT, 1.4);
  }
  // body
  blob(c, cx, cy, 12.5, 11.5, 0.05, 20, 3);
  body(c, radial(c, cx - 3, cy - 4, 2, 14, [
    [0, '#5a3426'],
    [1, '#221412'],
  ]));
  // ember cracks
  glow(c, '#ff7a2a', 5);
  c.beginPath();
  c.moveTo(cx - 9, cy + 1);
  c.lineTo(cx - 4, cy + 4);
  c.lineTo(cx - 1, cy + 9);
  c.moveTo(cx + 8, cy - 3);
  c.lineTo(cx + 4, cy + 2);
  c.lineTo(cx + 6, cy + 7);
  stroke(c, '#ff8a3d', 1.5);
  noGlow(c);
  // mouth
  c.beginPath();
  c.moveTo(cx - 5, cy + 3);
  c.quadraticCurveTo(cx, cy + 6.5, cx + 5, cy + 3);
  stroke(c, '#ffb35c', 1.3);
  eye(c, cx - 4.6, cy - 3, 2.6, '#ffe066', 6);
  eye(c, cx + 4.6, cy - 3, 2.6, '#ffe066', 6);
}

export function drawGrub(c: Ctx, w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2;
  for (let i = 2; i >= 0; i--) {
    circle(c, cx - 5 + i * 5, cy + (i % 2) * 1.5, 5.5 - i * 0.6);
    body(c, i === 2 ? '#c96b3a' : '#a4532d', OUT, 1.4);
  }
  eye(c, cx + 7, cy - 1.5, 1.5, '#ffe066', 4);
}

export const _k = { linear };

export function drawBramblehorn(c: Ctx, w: number, h: number) {
  const cx = w / 2 - 2;
  const cy = h / 2 + 4;
  // bramble spikes on the back
  for (let i = 0; i < 6; i++) {
    const a = Math.PI + 0.5 + i * 0.32;
    poly(c, [cx + Math.cos(a) * 14, cy + Math.sin(a) * 12, cx + Math.cos(a) * 27, cy + Math.sin(a) * 22 - 4, cx + Math.cos(a + 0.18) * 14, cy + Math.sin(a + 0.18) * 12]);
    body(c, '#3d5a2a', OUT, 1.4);
  }
  // legs
  for (const lx of [-12, -2, 8, 16]) {
    c.fillStyle = '#2a1a12';
    c.fillRect(cx + lx, cy + 8, 4, 8);
  }
  // body
  blob(c, cx, cy, 22, 14, 0.04, 22, 7);
  body(c, radial(c, cx - 4, cy - 6, 2, 24, [
    [0, '#8a5a36'],
    [1, '#3a2316'],
  ]));
  // head + horns (facing right)
  circle(c, cx + 18, cy + 1, 10);
  body(c, '#5a3a24', OUT, 2);
  c.beginPath();
  c.moveTo(cx + 22, cy - 6);
  c.quadraticCurveTo(cx + 34, cy - 18, cx + 30, cy - 26);
  c.quadraticCurveTo(cx + 26, cy - 14, cx + 18, cy - 8);
  body(c, '#f1e3c4', OUT, 1.6);
  c.beginPath();
  c.moveTo(cx + 24, cy + 4);
  c.quadraticCurveTo(cx + 38, cy + 2, cx + 40, cy - 8);
  c.quadraticCurveTo(cx + 32, cy + 0, cx + 24, cy - 1);
  body(c, '#f1e3c4', OUT, 1.6);
  eye(c, cx + 21, cy - 1, 2.4, '#ff6a2a', 5);
}

export function drawSpitbloom(c: Ctx, w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2;
  // leaves
  for (let i = 0; i < 3; i++) {
    const a = Math.PI * 0.5 + (i - 1) * 0.9;
    c.beginPath();
    c.ellipse(cx + Math.cos(a) * 14, cy + Math.sin(a) * 12, 11, 5, a, 0, TAU);
    body(c, '#2f8a6a', OUT, 1.4);
  }
  // petals
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    c.beginPath();
    c.ellipse(cx + Math.cos(a) * 11, cy - 3 + Math.sin(a) * 10, 9, 6, a, 0, TAU);
    body(c, linear(c, 0, cy - 14, 0, cy + 8, [
      [0, '#ff9a5a'],
      [1, '#c9402a'],
    ]), OUT, 1.6);
  }
  // mouth
  circle(c, cx, cy - 3, 8);
  body(c, '#1a0e0c', OUT, 1.6);
  glow(c, '#7ad9a8', 6);
  circle(c, cx, cy - 3, 3.4);
  fill(c, '#b9ffd9');
  noGlow(c);
}

export function drawAshwisp(c: Ctx, w: number, h: number) {
  const cx = w / 2;
  const cy = h * 0.42;
  glow(c, '#ff8a3d', 8);
  c.beginPath();
  c.moveTo(cx, cy - 11);
  c.bezierCurveTo(cx + 12, cy - 2, cx + 9, cy + 10, cx, cy + 9);
  c.bezierCurveTo(cx - 9, cy + 10, cx - 12, cy - 2, cx, cy - 11);
  fill(c, radial(c, cx, cy + 2, 1, 13, [
    [0, '#fff6c2'],
    [0.5, '#ffb347'],
    [1, '#ff5a1a'],
  ]));
  noGlow(c);
  // tail
  c.beginPath();
  c.moveTo(cx - 4, cy + 8);
  c.quadraticCurveTo(cx - 2, cy + 18, cx + 3, cy + 20);
  c.quadraticCurveTo(cx + 1, cy + 14, cx + 4, cy + 8);
  fill(c, 'rgba(255,140,60,0.7)');
  circle(c, cx - 3, cy, 1.6);
  circle(c, cx + 3, cy, 1.6);
  fill(c, '#2a0e04');
}

export function drawBurrowmaw(c: Ctx, w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2;
  // dirt ring
  circle(c, cx, cy + 4, 24);
  fill(c, 'rgba(60,36,24,0.85)');
  // segmented collar
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU;
    circle(c, cx + Math.cos(a) * 16, cy + Math.sin(a) * 14, 6);
    body(c, i % 2 ? '#c97a62' : '#a85e4a', OUT, 1.2);
  }
  // maw
  circle(c, cx, cy, 13);
  body(c, '#3a0e10', OUT, 2);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU;
    poly(c, [cx + Math.cos(a) * 12.5, cy + Math.sin(a) * 12.5, cx + Math.cos(a + 0.2) * 5, cy + Math.sin(a + 0.2) * 5, cx + Math.cos(a + 0.4) * 12.5, cy + Math.sin(a + 0.4) * 12.5]);
    fill(c, '#f4e6d0');
  }
  glow(c, '#ff6a2a', 6);
  circle(c, cx, cy, 3);
  fill(c, '#ff9a5a');
  noGlow(c);
}

export function drawKindlepod(c: Ctx, w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2 + 4;
  // feet
  for (const s of [-1, 1]) {
    c.beginPath();
    c.ellipse(cx + s * 7, cy + 14, 5, 3, 0, 0, TAU);
    body(c, '#3a2418', OUT, 1.2);
  }
  // pod
  c.beginPath();
  c.ellipse(cx, cy, 14, 15, 0, 0, TAU);
  body(c, radial(c, cx - 4, cy - 5, 2, 18, [
    [0, '#ffd27a'],
    [0.6, '#c96b2a'],
    [1, '#6a2a10'],
  ]));
  // seams
  c.beginPath();
  c.moveTo(cx, cy - 15);
  c.quadraticCurveTo(cx - 6, cy, cx, cy + 15);
  c.moveTo(cx - 12, cy - 6);
  c.quadraticCurveTo(cx, cy - 2, cx + 12, cy - 6);
  glow(c, '#ff7a2a', 4);
  stroke(c, '#ff8a3d', 1.4);
  noGlow(c);
  // fuse
  c.beginPath();
  c.moveTo(cx, cy - 15);
  c.quadraticCurveTo(cx + 6, cy - 22, cx + 3, cy - 26);
  stroke(c, '#2a1a12', 2);
  glow(c, '#fff1a6', 8);
  circle(c, cx + 3, cy - 27, 3);
  fill(c, '#fff6c2');
  noGlow(c);
  eye(c, cx - 5, cy - 2, 2, '#2a0e04', 0);
  eye(c, cx + 5, cy - 2, 2, '#2a0e04', 0);
}

export function drawThornwarden(c: Ctx, w: number, h: number) {
  const cx = w / 2 - 3;
  const cy = h / 2 + 2;
  // legs
  c.fillStyle = '#2a2016';
  c.fillRect(cx - 9, cy + 14, 6, 14);
  c.fillRect(cx + 3, cy + 14, 6, 14);
  // body (armored bark)
  c.beginPath();
  c.roundRect(cx - 14, cy - 12, 28, 30, 9);
  body(c, linear(c, 0, cy - 12, 0, cy + 18, [
    [0, '#6a5a3a'],
    [1, '#3a2e1e'],
  ]));
  for (let i = 0; i < 3; i++) {
    c.beginPath();
    c.moveTo(cx - 10, cy - 6 + i * 8);
    c.lineTo(cx + 10, cy - 4 + i * 8);
    stroke(c, 'rgba(0,0,0,0.3)', 1.2);
  }
  // helm
  circle(c, cx, cy - 18, 10);
  body(c, '#4a3e2a', OUT, 2);
  c.fillStyle = '#0e0a06';
  c.fillRect(cx - 6, cy - 20, 12, 4);
  eye(c, cx - 3, cy - 18, 1.6, '#c9ff6a', 5);
  eye(c, cx + 3, cy - 18, 1.6, '#c9ff6a', 5);
  // tower shield (front / right side)
  c.beginPath();
  c.moveTo(cx + 12, cy - 22);
  c.quadraticCurveTo(cx + 30, cy - 18, cx + 30, cy + 4);
  c.quadraticCurveTo(cx + 28, cy + 24, cx + 14, cy + 30);
  c.quadraticCurveTo(cx + 18, cy + 4, cx + 12, cy - 22);
  body(c, linear(c, cx + 12, 0, cx + 30, 0, [
    [0, '#5a7a3a'],
    [1, '#9ccf6a'],
  ]), OUT, 2);
  c.beginPath();
  c.moveTo(cx + 20, cy - 14);
  c.lineTo(cx + 22, cy + 20);
  stroke(c, '#d9ffb0', 1.4);
  for (let i = 0; i < 4; i++) {
    poly(c, [cx + 28, cy - 12 + i * 10, cx + 35, cy - 9 + i * 10, cx + 28, cy - 7 + i * 10]);
    fill(c, '#d9ffb0');
  }
}

export function drawGrubmother(c: Ctx, w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2 + 3;
  for (let i = 0; i < 6; i++) {
    const x = cx - 18 + i * 7;
    c.beginPath();
    c.moveTo(x, cy + 10);
    c.lineTo(x - 3, cy + 20);
    stroke(c, '#3a2418', 2.2);
  }
  blob(c, cx, cy, 24, 17, 0.07, 22, 11);
  body(c, radial(c, cx - 6, cy - 6, 2, 26, [
    [0, '#ffb38a'],
    [0.6, '#c96b3a'],
    [1, '#6a2a14'],
  ]));
  // egg bulges
  const pts = [
    [-10, -4],
    [2, -9],
    [12, -2],
    [-2, 4],
    [10, 7],
  ];
  for (const [x, y] of pts) {
    circle(c, cx + x, cy + y, 4.5);
    fill(c, radial(c, cx + x - 1, cy + y - 1, 0.5, 5, [
      [0, '#fff1d0'],
      [1, '#e8a070'],
    ]));
    glow(c, '#ffb347', 4);
    circle(c, cx + x, cy + y, 1.4);
    fill(c, '#ffd27a');
    noGlow(c);
  }
  // head
  circle(c, cx + 22, cy - 2, 8);
  body(c, '#a4532d', OUT, 1.6);
  eye(c, cx + 24, cy - 4, 1.8, '#ffe066', 4);
}
