import { blob, body, circle, eye, fill, glow, linear, noGlow, OUT, poly, radial, star, stroke, TAU, type Ctx } from './kit';

/* ═══════════════ BIOME 4 — STARLESS CROWN (black violet, magenta, starlight) ═══════════════ */

const VOID = (c: Ctx, y0: number, y1: number) =>
  linear(c, 0, y0, 0, y1, [
    [0, '#4a2a7a'],
    [1, '#120826'],
  ]);

export function drawVoidcaller(c: Ctx, w: number, h: number) {
  const cx = w / 2 - 3;
  const cy = h / 2 + 4;
  c.beginPath();
  c.moveTo(cx, cy - 20);
  c.quadraticCurveTo(cx + 14, cy - 6, cx + 13, cy + 20);
  c.lineTo(cx - 13, cy + 20);
  c.quadraticCurveTo(cx - 14, cy - 6, cx, cy - 20);
  body(c, VOID(c, cy - 20, cy + 20));
  c.beginPath();
  c.moveTo(cx - 12, cy + 14);
  c.lineTo(cx + 12, cy + 14);
  stroke(c, '#d45cff', 1.4);
  circle(c, cx, cy - 10, 7);
  fill(c, '#05020c');
  eye(c, cx - 2.5, cy - 10, 1.4, '#ff7ae0', 5);
  eye(c, cx + 2.5, cy - 10, 1.4, '#ff7ae0', 5);
  // void orb in hand
  glow(c, '#d45cff', 10);
  circle(c, cx + 17, cy - 2, 6);
  fill(c, radial(c, cx + 17, cy - 2, 0.5, 7, [
    [0, '#ffffff'],
    [0.4, '#d45cff'],
    [1, '#2a0a4a'],
  ]));
  noGlow(c);
}

export function drawVoidportal(c: Ctx, w: number, h: number) {
  const r = w / 2;
  circle(c, r, r, r * 0.78);
  fill(c, radial(c, r, r, 0, r * 0.8, [
    [0, '#000000'],
    [0.6, '#12052a'],
    [1, '#5a1a8a'],
  ]));
  for (let i = 0; i < 3; i++) {
    c.beginPath();
    c.arc(r, r, r * (0.55 + i * 0.13), i * 2.1, i * 2.1 + 3.6);
    glow(c, '#d45cff', 5);
    stroke(c, i === 1 ? '#ffb3ff' : '#d45cff', 2 - i * 0.4);
  }
  noGlow(c);
}

export function drawVoidimp(c: Ctx, w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2 + 2;
  star(c, cx, cy, 8, 13, 7, 0.3);
  body(c, VOID(c, cy - 12, cy + 12), OUT, 1.6);
  circle(c, cx, cy, 7);
  fill(c, '#2a0e4a');
  eye(c, cx - 3, cy - 1, 1.8, '#ff7ae0', 5);
  eye(c, cx + 3, cy - 1, 1.8, '#ff7ae0', 5);
}

export function drawMirrorknight(c: Ctx, w: number, h: number) {
  const cx = w / 2 - 3;
  const cy = h / 2 + 4;
  c.fillStyle = '#1a1230';
  c.fillRect(cx - 8, cy + 12, 6, 12);
  c.fillRect(cx + 2, cy + 12, 6, 12);
  c.beginPath();
  c.roundRect(cx - 13, cy - 12, 26, 26, 8);
  body(c, linear(c, 0, cy - 12, 0, cy + 14, [
    [0, '#c8b8ee'],
    [1, '#4a3a7a'],
  ]));
  // diamond helm
  poly(c, [cx, cy - 30, cx + 9, cy - 18, cx, cy - 8, cx - 9, cy - 18]);
  body(c, linear(c, 0, cy - 30, 0, cy - 8, [
    [0, '#ffffff'],
    [1, '#8a7ac9'],
  ]), OUT, 1.8);
  c.fillStyle = '#0a0614';
  c.fillRect(cx - 5, cy - 19, 10, 2.6);
  // mirror shield
  c.beginPath();
  c.ellipse(cx + 17, cy - 2, 8, 15, 0, 0, TAU);
  glow(c, '#e8d8ff', 8);
  body(c, linear(c, cx + 9, cy - 17, cx + 25, cy + 13, [
    [0, '#ffffff'],
    [0.5, '#c9e0ff'],
    [1, '#7a8ac9'],
  ]), OUT, 1.8);
  noGlow(c);
  c.beginPath();
  c.moveTo(cx + 13, cy - 10);
  c.lineTo(cx + 19, cy + 4);
  stroke(c, '#ffffff', 1.4);
}

export function drawGravewell(c: Ctx, w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2;
  for (let i = 0; i < 2; i++) {
    c.beginPath();
    c.ellipse(cx, cy, 20 - i * 3, 7 - i, 0.4 + i * 0.9, 0, TAU);
    glow(c, '#9a6cff', 5);
    stroke(c, i ? '#c9a8ff' : '#9a6cff', 1.6);
  }
  noGlow(c);
  circle(c, cx, cy, 11);
  body(c, radial(c, cx - 3, cy - 3, 1, 12, [
    [0, '#6a4aaa'],
    [1, '#12082a'],
  ]));
  // eye
  c.beginPath();
  c.ellipse(cx, cy, 7, 4, 0, 0, TAU);
  fill(c, '#e8d8ff');
  circle(c, cx, cy, 2.6);
  fill(c, '#12082a');
}

export function drawPrism(c: Ctx, w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2 + 4;
  c.beginPath();
  c.ellipse(cx, cy + 12, 16, 6, 0, 0, TAU);
  fill(c, 'rgba(20,10,40,0.8)');
  const shards = [
    [0, -24, 7],
    [-9, -12, 5],
    [9, -14, 5.5],
  ];
  for (const [x, y, s] of shards) {
    poly(c, [cx + x, cy + y, cx + x + s, cy + y + s * 2, cx + x, cy + 12, cx + x - s, cy + y + s * 2]);
    glow(c, '#ff5ad8', 6);
    body(c, linear(c, cx + x - s, 0, cx + x + s, 0, [
      [0, '#ff9aee'],
      [0.5, '#ffffff'],
      [1, '#b44ad8'],
    ]), OUT, 1.6);
    noGlow(c);
  }
}

export function drawWraithlancer(c: Ctx, w: number, h: number) {
  const cx = w / 2 - 4;
  const cy = h / 2;
  // lance
  c.beginPath();
  c.moveTo(cx - 8, cy + 6);
  c.lineTo(cx + 26, cy - 6);
  stroke(c, '#3a2a5a', 2.6);
  poly(c, [cx + 22, cy - 10, cx + 32, cy - 8, cx + 24, cy - 1]);
  glow(c, '#c89cff', 6);
  fill(c, '#f4eaff');
  noGlow(c);
  // body wisps
  c.beginPath();
  c.moveTo(cx, cy - 14);
  c.quadraticCurveTo(cx + 13, cy - 4, cx + 6, cy + 18);
  c.quadraticCurveTo(cx, cy + 10, cx - 6, cy + 20);
  c.quadraticCurveTo(cx - 13, cy - 2, cx, cy - 14);
  body(c, linear(c, 0, cy - 14, 0, cy + 20, [
    [0, '#7a5aaa'],
    [1, 'rgba(60,30,100,0.25)'],
  ]), OUT, 1.6);
  // horned helm
  circle(c, cx, cy - 12, 7);
  body(c, '#2a1a4a', OUT, 1.6);
  poly(c, [cx - 5, cy - 16, cx - 10, cy - 26, cx - 2, cy - 18]);
  fill(c, '#c89cff');
  eye(c, cx + 2, cy - 12, 1.6, '#ffffff', 6);
}

export function drawAegisherald(c: Ctx, w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2 + 4;
  // wings
  for (const s of [-1, 1]) {
    c.beginPath();
    c.moveTo(cx + s * 6, cy - 6);
    c.quadraticCurveTo(cx + s * 24, cy - 22, cx + s * 26, cy - 2);
    c.quadraticCurveTo(cx + s * 18, cy - 4, cx + s * 8, cy + 6);
    body(c, linear(c, cx, 0, cx + s * 26, 0, [
      [0, '#fff8dc'],
      [1, '#c9b07a'],
    ]), OUT, 1.4);
  }
  c.beginPath();
  c.moveTo(cx, cy - 12);
  c.quadraticCurveTo(cx + 10, cy, cx + 8, cy + 18);
  c.lineTo(cx - 8, cy + 18);
  c.quadraticCurveTo(cx - 10, cy, cx, cy - 12);
  body(c, VOID(c, cy - 12, cy + 18));
  // halo
  c.beginPath();
  c.arc(cx, cy - 15, 9, 0, TAU);
  glow(c, '#fff1a6', 8);
  stroke(c, '#fff1a6', 2);
  noGlow(c);
  circle(c, cx, cy - 15, 5);
  fill(c, '#fbf3e4');
}

export function drawHexer(c: Ctx, w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2 + 4;
  c.beginPath();
  c.moveTo(cx, cy - 18);
  c.quadraticCurveTo(cx + 14, cy - 2, cx + 12, cy + 20);
  c.lineTo(cx - 12, cy + 20);
  c.quadraticCurveTo(cx - 14, cy - 2, cx, cy - 18);
  body(c, linear(c, 0, cy - 18, 0, cy + 20, [
    [0, '#5a2a6a'],
    [1, '#1a0a22'],
  ]));
  // mask
  c.beginPath();
  c.ellipse(cx, cy - 8, 7, 8, 0, 0, TAU);
  body(c, '#f4eaff', OUT, 1.4);
  c.beginPath();
  c.moveTo(cx - 4, cy - 10);
  c.lineTo(cx - 1, cy - 8);
  c.moveTo(cx + 4, cy - 10);
  c.lineTo(cx + 1, cy - 8);
  stroke(c, '#5a0a6a', 1.4);
  // floating runes
  for (let i = 0; i < 3; i++) {
    const a = -Math.PI / 2 + (i - 1) * 0.9;
    glow(c, '#b45cff', 6);
    star(c, cx + Math.cos(a) * 18, cy - 4 + Math.sin(a) * 16, 1.4, 3.6, 4);
    fill(c, '#e0b8ff');
  }
  noGlow(c);
}

export function drawNullshard(c: Ctx, w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2;
  poly(c, [cx, cy - 18, cx + 15, cy + 10, cx - 15, cy + 10]);
  body(c, VOID(c, cy - 18, cy + 10));
  poly(c, [cx, cy - 18, cx + 15, cy + 10, cx - 15, cy + 10]);
  glow(c, '#ffb3ff', 6);
  stroke(c, '#ffb3ff', 1.2);
  noGlow(c);
  glow(c, '#ff7ae0', 10);
  circle(c, cx, cy + 1, 4.5);
  fill(c, '#ffffff');
  noGlow(c);
  blob(c, cx, cy + 1, 0.1, 0.1, 0, 3, 1);
}
