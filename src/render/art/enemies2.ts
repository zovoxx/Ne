import { blob, body, circle, eye, fill, glow, linear, noGlow, OUT, poly, radial, rrect, stroke, TAU, type Ctx } from './kit';

/* ═══════════════ BIOME 2 — DROWNED ARCHIVE (deep navy, cyan glow, parchment) ═══════════════ */

export function drawInkshade(c: Ctx, w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2 - 2;
  // trailing ink tail
  c.beginPath();
  c.moveTo(cx - 12, cy);
  c.quadraticCurveTo(cx - 14, cy + 18, cx - 4, cy + 22);
  c.quadraticCurveTo(cx - 2, cy + 14, cx + 4, cy + 24);
  c.quadraticCurveTo(cx + 8, cy + 14, cx + 13, cy + 18);
  c.quadraticCurveTo(cx + 14, cy + 6, cx + 12, cy);
  body(c, linear(c, 0, cy, 0, cy + 24, [
    [0, '#16284a'],
    [1, 'rgba(10,20,40,0.2)'],
  ]), OUT, 1.6);
  // hood
  c.beginPath();
  c.moveTo(cx, cy - 16);
  c.quadraticCurveTo(cx + 16, cy - 12, cx + 13, cy + 4);
  c.lineTo(cx - 13, cy + 4);
  c.quadraticCurveTo(cx - 16, cy - 12, cx, cy - 16);
  body(c, radial(c, cx - 3, cy - 8, 2, 18, [
    [0, '#2e4a7a'],
    [1, '#0c1630'],
  ]));
  c.beginPath();
  c.ellipse(cx + 2, cy - 4, 8, 6, 0, 0, TAU);
  fill(c, '#05080f');
  eye(c, cx - 1, cy - 4, 1.8, '#9ff4ff', 6);
  eye(c, cx + 5, cy - 4, 1.8, '#9ff4ff', 6);
}

export function drawLanternist(c: Ctx, w: number, h: number) {
  const cx = w / 2 - 4;
  const cy = h / 2 + 4;
  // pole + lantern (held forward / right)
  c.beginPath();
  c.moveTo(cx + 4, cy + 12);
  c.lineTo(cx + 18, cy - 24);
  stroke(c, '#3a2e22', 2.4);
  c.beginPath();
  c.moveTo(cx + 18, cy - 24);
  c.lineTo(cx + 24, cy - 22);
  stroke(c, '#3a2e22', 2);
  glow(c, '#7fe3ff', 10);
  rrect(c, cx + 20, cy - 22, 9, 11, 2);
  fill(c, '#d6fbff');
  noGlow(c);
  rrect(c, cx + 20, cy - 22, 9, 11, 2);
  stroke(c, '#c9a35a', 1.2);
  // tall robe
  c.beginPath();
  c.moveTo(cx, cy - 22);
  c.quadraticCurveTo(cx + 12, cy - 6, cx + 11, cy + 20);
  c.lineTo(cx - 11, cy + 20);
  c.quadraticCurveTo(cx - 12, cy - 6, cx, cy - 22);
  body(c, linear(c, 0, cy - 22, 0, cy + 20, [
    [0, '#2b3f6a'],
    [1, '#101a33'],
  ]));
  c.beginPath();
  c.moveTo(cx - 10, cy + 12);
  c.lineTo(cx + 10, cy + 12);
  stroke(c, '#c9a35a', 1.4);
  // face
  circle(c, cx, cy - 12, 6);
  fill(c, '#05080f');
  eye(c, cx + 2, cy - 12, 1.6, '#7fe3ff', 5);
}

export function drawScribe(c: Ctx, w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2;
  // open book body
  for (const s of [-1, 1]) {
    c.beginPath();
    c.moveTo(cx, cy - 8);
    c.quadraticCurveTo(cx + s * 9, cy - 12, cx + s * 17, cy - 9);
    c.lineTo(cx + s * 17, cy + 10);
    c.quadraticCurveTo(cx + s * 9, cy + 7, cx, cy + 11);
    c.closePath();
    body(c, linear(c, cx, 0, cx + s * 17, 0, [
      [0, '#fff1d0'],
      [1, '#c9b08a'],
    ]), OUT, 1.8);
    for (let i = 0; i < 3; i++) {
      c.beginPath();
      c.moveTo(cx + s * 4, cy - 4 + i * 5);
      c.lineTo(cx + s * 14, cy - 5 + i * 5);
      stroke(c, 'rgba(60,40,20,0.45)', 0.9);
    }
  }
  // spine eye
  glow(c, '#ffd27a', 7);
  circle(c, cx, cy + 1, 4);
  fill(c, '#ffe7a0');
  noGlow(c);
  circle(c, cx, cy + 1, 1.6);
  fill(c, '#2a1a08');
  // ribbon
  c.beginPath();
  c.moveTo(cx, cy + 11);
  c.quadraticCurveTo(cx + 3, cy + 18, cx - 1, cy + 22);
  stroke(c, '#ff5d7a', 2);
}

export function drawTidecleric(c: Ctx, w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2 + 4;
  // shell halo
  c.beginPath();
  c.arc(cx, cy - 12, 14, Math.PI * 1.05, Math.PI * 1.95);
  glow(c, '#5dffc4', 6);
  stroke(c, '#b9ffe6', 2.4);
  noGlow(c);
  for (let i = 0; i < 5; i++) {
    const a = Math.PI * (1.1 + i * 0.2);
    c.beginPath();
    c.moveTo(cx + Math.cos(a) * 9, cy - 12 + Math.sin(a) * 9);
    c.lineTo(cx + Math.cos(a) * 14, cy - 12 + Math.sin(a) * 14);
    stroke(c, '#b9ffe6', 1.2);
  }
  // robe
  c.beginPath();
  c.moveTo(cx, cy - 16);
  c.quadraticCurveTo(cx + 15, cy, cx + 13, cy + 18);
  c.quadraticCurveTo(cx, cy + 22, cx - 13, cy + 18);
  c.quadraticCurveTo(cx - 15, cy, cx, cy - 16);
  body(c, linear(c, 0, cy - 16, 0, cy + 20, [
    [0, '#2a7a8a'],
    [1, '#0e2a3a'],
  ]));
  c.beginPath();
  c.moveTo(cx, cy - 4);
  c.lineTo(cx, cy + 18);
  stroke(c, '#5dffc4', 1.4);
  circle(c, cx, cy - 8, 6);
  fill(c, '#e8fff6');
  eye(c, cx - 2, cy - 8, 1.2, '#1a6a5a', 0);
  eye(c, cx + 2, cy - 8, 1.2, '#1a6a5a', 0);
}

export function drawHookjaw(c: Ctx, w: number, h: number) {
  const cx = w / 2 - 2;
  const cy = h / 2 + 3;
  // lure
  c.beginPath();
  c.moveTo(cx + 8, cy - 12);
  c.quadraticCurveTo(cx + 14, cy - 26, cx + 22, cy - 20);
  stroke(c, '#2a3a4a', 1.6);
  glow(c, '#9fe7ff', 9);
  circle(c, cx + 22, cy - 19, 3);
  fill(c, '#e0fbff');
  noGlow(c);
  // tail fin
  poly(c, [cx - 18, cy, cx - 28, cy - 9, cx - 26, cy + 10]);
  body(c, '#1c3a5a', OUT, 1.6);
  // body
  c.beginPath();
  c.ellipse(cx, cy, 19, 14, 0, 0, TAU);
  body(c, radial(c, cx - 4, cy - 5, 2, 20, [
    [0, '#3a6a9a'],
    [1, '#0e2038'],
  ]));
  // jaw
  c.beginPath();
  c.moveTo(cx + 4, cy + 2);
  c.lineTo(cx + 19, cy - 2);
  c.lineTo(cx + 17, cy + 9);
  c.closePath();
  fill(c, '#05080f');
  for (let i = 0; i < 4; i++) {
    poly(c, [cx + 7 + i * 3, cy + 2 - i * 0.4, cx + 8.5 + i * 3, cy + 6, cx + 10 + i * 3, cy + 1.6 - i * 0.4]);
    fill(c, '#f4f0ff');
  }
  eye(c, cx + 6, cy - 5, 2.6, '#ffe066', 4);
}

export function drawSlurry(c: Ctx, w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2 + 3;
  blob(c, cx, cy, 25, 21, 0.06, 26, 4);
  body(c, radial(c, cx - 8, cy - 8, 2, 28, [
    [0, '#6a9aff'],
    [0.5, '#2a50c9'],
    [1, '#0e1a5a'],
  ]));
  // shine
  c.beginPath();
  c.ellipse(cx - 9, cy - 10, 6, 3.5, -0.5, 0, TAU);
  fill(c, 'rgba(255,255,255,0.55)');
  // drips
  for (const x of [-12, 4, 14]) {
    c.beginPath();
    c.ellipse(cx + x, cy + 19, 2.5, 4, 0, 0, TAU);
    fill(c, '#2a50c9');
  }
  eye(c, cx - 6, cy - 1, 3.2, '#fff6c2', 4);
  eye(c, cx + 7, cy - 1, 3.2, '#fff6c2', 4);
}

export function drawEcho(c: Ctx, w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2;
  // wispy cloak
  c.beginPath();
  c.moveTo(cx, cy - 6);
  c.quadraticCurveTo(cx + 14, cy + 4, cx + 9, cy + 20);
  c.quadraticCurveTo(cx, cy + 14, cx - 9, cy + 20);
  c.quadraticCurveTo(cx - 14, cy + 4, cx, cy - 6);
  body(c, linear(c, 0, cy - 6, 0, cy + 20, [
    [0, '#5a7aa8'],
    [1, 'rgba(40,60,100,0.3)'],
  ]), OUT, 1.4);
  // mirror diamond face
  poly(c, [cx, cy - 20, cx + 10, cy - 7, cx, cy + 6, cx - 10, cy - 7]);
  glow(c, '#d6f4ff', 8);
  fill(c, linear(c, cx - 10, cy - 20, cx + 10, cy + 6, [
    [0, '#ffffff'],
    [0.5, '#b9d8ff'],
    [1, '#6a8ac9'],
  ]));
  noGlow(c);
  poly(c, [cx, cy - 20, cx + 10, cy - 7, cx, cy + 6, cx - 10, cy - 7]);
  stroke(c, OUT, 1.6);
  c.beginPath();
  c.moveTo(cx - 5, cy - 13);
  c.lineTo(cx + 3, cy - 2);
  stroke(c, 'rgba(255,255,255,0.9)', 1.2);
}

export function drawGlimmerjelly(c: Ctx, w: number, h: number) {
  const cx = w / 2;
  const cy = h * 0.4;
  // tentacles
  for (let i = 0; i < 6; i++) {
    const x = cx - 12 + i * 4.8;
    c.beginPath();
    c.moveTo(x, cy + 6);
    c.quadraticCurveTo(x + (i % 2 ? 4 : -4), cy + 16, x, cy + 26);
    glow(c, '#ff7ae0', 3);
    stroke(c, 'rgba(255,150,230,0.85)', 1.4);
  }
  noGlow(c);
  // bell
  c.beginPath();
  c.moveTo(cx - 17, cy + 6);
  c.quadraticCurveTo(cx - 18, cy - 16, cx, cy - 16);
  c.quadraticCurveTo(cx + 18, cy - 16, cx + 17, cy + 6);
  c.quadraticCurveTo(cx, cy + 2, cx - 17, cy + 6);
  glow(c, '#ff7ae0', 8);
  fill(c, radial(c, cx, cy - 6, 2, 20, [
    [0, 'rgba(255,230,250,0.95)'],
    [0.5, 'rgba(255,122,224,0.85)'],
    [1, 'rgba(140,40,140,0.8)'],
  ]));
  noGlow(c);
  c.beginPath();
  c.moveTo(cx - 17, cy + 6);
  c.quadraticCurveTo(cx - 18, cy - 16, cx, cy - 16);
  c.quadraticCurveTo(cx + 18, cy - 16, cx + 17, cy + 6);
  stroke(c, OUT, 1.6);
  for (let i = 0; i < 4; i++) {
    circle(c, cx - 8 + i * 5.3, cy - 4 + (i % 2) * 3, 1.6);
    fill(c, '#fff');
  }
}

/* projectiles & props */
export function drawSeed(c: Ctx, w: number, h: number) {
  c.beginPath();
  c.ellipse(w / 2, h / 2, w * 0.36, h * 0.44, 0.5, 0, TAU);
  glow(c, '#7ad9a8', 5);
  fill(c, radial(c, w * 0.4, h * 0.4, 1, w * 0.5, [
    [0, '#e0ffe8'],
    [1, '#2f8a6a'],
  ]));
  noGlow(c);
}
export function drawShell(c: Ctx, w: number, h: number) {
  circle(c, w / 2, h / 2, w * 0.38);
  body(c, radial(c, w * 0.4, h * 0.38, 1, w * 0.45, [
    [0, '#ffd27a'],
    [0.6, '#5a4a3a'],
    [1, '#2a2018'],
  ]), OUT, 1.4);
  glow(c, '#ff7a2a', 5);
  circle(c, w / 2, h * 0.3, 2);
  fill(c, '#fff1a6');
  noGlow(c);
}
export function drawHook(c: Ctx, w: number, h: number) {
  c.beginPath();
  c.moveTo(w * 0.1, h / 2);
  c.lineTo(w * 0.7, h / 2);
  stroke(c, '#c8d2e6', 2);
  c.beginPath();
  c.moveTo(w * 0.7, h * 0.15);
  c.quadraticCurveTo(w * 1.0, h * 0.5, w * 0.7, h * 0.85);
  c.lineTo(w * 0.62, h * 0.7);
  glow(c, '#9fe7ff', 4);
  stroke(c, '#ffffff', 2.4);
  noGlow(c);
}
export function drawNeedle(c: Ctx, w: number, h: number) {
  glow(c, '#d6f4ff', 4);
  poly(c, [0, h / 2, w * 0.8, h * 0.2, w, h / 2, w * 0.8, h * 0.8]);
  fill(c, '#ffffff');
  noGlow(c);
}
export function drawMine(c: Ctx, w: number, h: number) {
  const r = w / 2;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    c.beginPath();
    c.moveTo(r + Math.cos(a) * r * 0.5, r + Math.sin(a) * r * 0.5);
    c.lineTo(r + Math.cos(a) * r * 0.92, r + Math.sin(a) * r * 0.92);
    stroke(c, '#5a3a5a', 1.6);
  }
  circle(c, r, r, r * 0.55);
  body(c, radial(c, r * 0.8, r * 0.8, 1, r * 0.6, [
    [0, '#8a5a8a'],
    [1, '#2a102a'],
  ]), OUT, 1.4);
  glow(c, '#ff7ae0', 5);
  circle(c, r, r, r * 0.2);
  fill(c, '#ffd0f4');
  noGlow(c);
}
export function drawShardBlade(c: Ctx, w: number, h: number) {
  glow(c, '#fff1a6', 5);
  poly(c, [w * 0.5, 0, w * 0.75, h * 0.5, w * 0.5, h, w * 0.25, h * 0.5]);
  fill(c, '#fffbe6');
  noGlow(c);
  poly(c, [w * 0.5, 0, w * 0.75, h * 0.5, w * 0.5, h, w * 0.25, h * 0.5]);
  stroke(c, OUT, 1.2);
}
