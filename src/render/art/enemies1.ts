import { blob, body, circle, eye, fill, glow, linear, noGlow, OUT, poly, radial, stroke, type Ctx } from './kit';

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
