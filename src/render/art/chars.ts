import { body, circle, ellipse, eye, fill, glow, linear, noGlow, OUT, poly, radial, stroke, type Ctx } from './kit';

/* ─────────────── WREN, the last Kindler ─────────────── */
export function drawPlayer(c: Ctx, w: number, h: number) {
  const cx = w / 2;
  // cloak
  c.beginPath();
  c.moveTo(cx - 8, 17);
  c.bezierCurveTo(cx - 15, 28, cx - 19, 40, cx - 17, 47);
  c.quadraticCurveTo(cx, 51, cx + 17, 47);
  c.bezierCurveTo(cx + 19, 40, cx + 15, 28, cx + 8, 17);
  c.closePath();
  body(c, linear(c, 0, 16, 0, 50, [
    [0, '#4b3f8c'],
    [1, '#231c48'],
  ]));
  // cloak fold highlights
  c.beginPath();
  c.moveTo(cx - 3, 22);
  c.quadraticCurveTo(cx - 6, 36, cx - 9, 47);
  stroke(c, 'rgba(160,150,255,0.35)', 1.4);
  c.beginPath();
  c.moveTo(cx + 4, 22);
  c.quadraticCurveTo(cx + 7, 36, cx + 8, 47);
  stroke(c, 'rgba(160,150,255,0.25)', 1.2);
  // gold hem
  c.beginPath();
  c.moveTo(cx - 17, 46);
  c.quadraticCurveTo(cx, 50.5, cx + 17, 46);
  glow(c, '#ffcf6a', 4);
  stroke(c, '#ffd27a', 2);
  noGlow(c);
  // scarf
  c.beginPath();
  c.moveTo(cx - 9, 22);
  c.quadraticCurveTo(cx, 26, cx + 9, 22);
  c.lineTo(cx + 10, 25);
  c.quadraticCurveTo(cx + 15, 31, cx + 19, 30);
  c.quadraticCurveTo(cx + 14, 34, cx + 9, 29);
  c.quadraticCurveTo(cx, 30, cx - 9, 26);
  c.closePath();
  body(c, linear(c, cx - 9, 22, cx + 19, 32, [
    [0, '#ff4f73'],
    [1, '#ff8a5c'],
  ]), OUT, 1.6);
  // hood
  circle(c, cx, 15, 11.5);
  body(c, radial(c, cx - 3, 11, 2, 13, [
    [0, '#6b5fb8'],
    [1, '#2d2560'],
  ]));
  // face
  ellipse(c, cx, 17, 6.8, 6);
  fill(c, linear(c, 0, 11, 0, 23, [
    [0, '#fbf3e4'],
    [1, '#d9cbb3'],
  ]));
  eye(c, cx - 2.7, 17, 1.6, '#7ff6ff', 5);
  eye(c, cx + 2.7, 17, 1.6, '#7ff6ff', 5);
  // lantern on hip
  c.beginPath();
  c.moveTo(cx - 13, 33);
  c.lineTo(cx - 13, 36);
  stroke(c, '#c9a35a', 1.2);
  glow(c, '#ffd36b', 9);
  circle(c, cx - 13, 39, 3.6);
  fill(c, '#fff0b0');
  noGlow(c);
  circle(c, cx - 13, 39, 3.6);
  stroke(c, '#c9a35a', 1.1);
}

/* ─────────────── weapons (pointing +x, anchor near handle) ─────────────── */

export function drawFangs(c: Ctx, w: number, h: number) {
  const y = h / 2;
  // handle
  c.fillStyle = '#2a1e2e';
  c.fillRect(1, y - 2, 8, 4);
  c.fillStyle = '#ffd27a';
  c.fillRect(8, y - 4, 2.4, 8);
  // curved blade
  c.beginPath();
  c.moveTo(10, y - 3);
  c.quadraticCurveTo(w * 0.62, y - 7, w - 1, y - 1);
  c.quadraticCurveTo(w * 0.6, y + 2.5, 10, y + 3);
  c.closePath();
  glow(c, '#ff6b8a', 4);
  fill(c, linear(c, 10, y - 6, 10, y + 3, [
    [0, '#ffffff'],
    [0.6, '#e6deff'],
    [1, '#a69ccf'],
  ]));
  noGlow(c);
  c.beginPath();
  c.moveTo(12, y - 1.5);
  c.quadraticCurveTo(w * 0.62, y - 4.6, w - 3, y - 1);
  stroke(c, 'rgba(255,107,138,0.8)', 0.9);
}

export function drawAnvil(c: Ctx, w: number, h: number) {
  const y = h / 2;
  c.fillStyle = '#3a2a22';
  c.fillRect(0, y - 2.2, w * 0.62, 4.4);
  c.fillStyle = '#ffd27a';
  c.fillRect(w * 0.15, y - 2.6, 2, 5.2);
  // head
  poly(c, [w * 0.58, y - 12, w - 2, y - 9, w - 1, y + 9, w * 0.58, y + 12, w * 0.52, y]);
  glow(c, '#ffb347', 5);
  body(c, linear(c, 0, y - 12, 0, y + 12, [
    [0, '#c9cfe0'],
    [0.5, '#7c8399'],
    [1, '#454b5e'],
  ]), OUT, 1.8);
  noGlow(c);
  // molten core
  glow(c, '#ff8a3d', 6);
  circle(c, w * 0.8, y, 3.2);
  fill(c, '#ffcf6a');
  noGlow(c);
}

export function drawPike(c: Ctx, w: number, h: number) {
  const y = h / 2;
  c.fillStyle = '#3a2f4a';
  c.fillRect(0, y - 1.6, w * 0.74, 3.2);
  c.fillStyle = '#9fe7ff';
  for (let i = 0; i < 3; i++) c.fillRect(w * (0.2 + i * 0.16), y - 2, 1.4, 4);
  poly(c, [w * 0.72, y - 4.5, w - 1, y, w * 0.72, y + 4.5, w * 0.76, y]);
  glow(c, '#9fe7ff', 6);
  fill(c, linear(c, w * 0.72, 0, w, 0, [
    [0, '#c7f3ff'],
    [1, '#ffffff'],
  ]));
  noGlow(c);
  // crescent guard
  c.beginPath();
  c.arc(w * 0.72, y, 5.5, -Math.PI * 0.6, Math.PI * 0.6, true);
  stroke(c, '#d9f6ff', 1.4);
}

export function drawBow(c: Ctx, w: number, h: number) {
  const y = h / 2;
  c.beginPath();
  c.moveTo(w * 0.35, 1);
  c.quadraticCurveTo(w * 0.95, y, w * 0.35, h - 1);
  glow(c, '#b48cff', 5);
  stroke(c, '#e2d4ff', 2.6);
  noGlow(c);
  c.beginPath();
  c.moveTo(w * 0.35, 2);
  c.lineTo(w * 0.35, h - 2);
  stroke(c, 'rgba(255,255,255,0.75)', 0.8);
  circle(c, w * 0.7, y, 2.2);
  fill(c, '#fff3b0');
}

export function drawHalo(c: Ctx, w: number, h: number) {
  const r = w / 2;
  glow(c, '#ffd36b', 7);
  circle(c, r, r, r * 0.78);
  stroke(c, '#ffe7a0', r * 0.2);
  noGlow(c);
  circle(c, r, r, r * 0.78);
  stroke(c, '#fff8dc', r * 0.06);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    poly(c, [
      r + Math.cos(a) * r * 0.86,
      r + Math.sin(a) * r * 0.86,
      r + Math.cos(a + 0.35) * r * 0.99,
      r + Math.sin(a + 0.35) * r * 0.99,
      r + Math.cos(a + 0.22) * r * 0.78,
      r + Math.sin(a + 0.22) * r * 0.78,
    ]);
    fill(c, '#fff3c4');
  }
}
