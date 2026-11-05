import { blob, body, circle, eye, fill, glow, linear, noGlow, OUT, poly, radial, rrect, star, stroke, TAU, type Ctx } from './kit';

/* ═══════════════ BOSSES & GUARDIANS ═══════════════ */

export function drawStag(c: Ctx, w: number, h: number) {
  const cx = w / 2 - 6;
  const cy = h / 2 + 14;
  // legs
  for (const lx of [-26, -12, 14, 28]) {
    rrect(c, cx + lx - 4, cy + 14, 8, 26, 3);
    body(c, '#2a1a12', OUT, 1.8);
  }
  // body
  blob(c, cx, cy, 44, 24, 0.04, 26, 9);
  body(c, radial(c, cx - 8, cy - 10, 4, 48, [
    [0, '#7a4a2a'],
    [0.6, '#3a2216'],
    [1, '#1a0e0a'],
  ]));
  // ember cracks along the flank
  glow(c, '#ff7a2a', 8);
  c.beginPath();
  for (let i = 0; i < 5; i++) {
    c.moveTo(cx - 30 + i * 14, cy - 10);
    c.lineTo(cx - 24 + i * 14, cy + 2);
    c.lineTo(cx - 28 + i * 14, cy + 12);
  }
  stroke(c, '#ff9a4a', 2.2);
  noGlow(c);
  // neck + head (facing right)
  c.beginPath();
  c.moveTo(cx + 26, cy - 12);
  c.quadraticCurveTo(cx + 40, cy - 30, cx + 50, cy - 26);
  c.lineTo(cx + 48, cy - 8);
  c.closePath();
  body(c, '#4a2c1a', OUT, 2.2);
  c.beginPath();
  c.ellipse(cx + 54, cy - 22, 13, 9, 0.3, 0, TAU);
  body(c, linear(c, 0, cy - 30, 0, cy - 12, [
    [0, '#6a3e24'],
    [1, '#2a160c'],
  ]), OUT, 2);
  // burning antlers
  for (const s of [-1, 1]) {
    c.beginPath();
    const bx = cx + 50 + s * 4;
    const by = cy - 30;
    c.moveTo(bx, by);
    c.lineTo(bx - 8 + s * 4, by - 26);
    c.lineTo(bx - 20 + s * 6, by - 40);
    c.moveTo(bx - 8 + s * 4, by - 26);
    c.lineTo(bx + 6 + s * 8, by - 38);
    c.moveTo(bx - 4 + s * 2, by - 14);
    c.lineTo(bx - 18 + s * 2, by - 20);
    glow(c, '#ff5a1a', 10);
    stroke(c, '#ffd27a', 3.2);
    noGlow(c);
  }
  for (const [x, y] of [
    [cx + 30, cy - 70],
    [cx + 64, cy - 68],
    [cx + 40, cy - 52],
  ]) {
    glow(c, '#ff7a2a', 10);
    c.beginPath();
    c.moveTo(x, y - 8);
    c.quadraticCurveTo(x + 6, y, x, y + 4);
    c.quadraticCurveTo(x - 6, y, x, y - 8);
    fill(c, '#fff1a6');
    noGlow(c);
  }
  eye(c, cx + 58, cy - 24, 3, '#ffe066', 8);
}

export function drawArchivist(c: Ctx, w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2 + 6;
  // orbiting tomes
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + 0.4;
    const x = cx + Math.cos(a) * 42;
    const y = cy - 6 + Math.sin(a) * 26;
    rrect(c, x - 8, y - 6, 16, 12, 2);
    body(c, i % 2 ? '#c9b08a' : '#5a3a7a', OUT, 1.4);
    c.fillStyle = '#ffe7a0';
    c.fillRect(x - 1, y - 6, 2, 12);
  }
  // robe
  c.beginPath();
  c.moveTo(cx, cy - 34);
  c.quadraticCurveTo(cx + 26, cy - 10, cx + 24, cy + 34);
  c.quadraticCurveTo(cx, cy + 26, cx - 24, cy + 34);
  c.quadraticCurveTo(cx - 26, cy - 10, cx, cy - 34);
  body(c, linear(c, 0, cy - 34, 0, cy + 34, [
    [0, '#2b4a7a'],
    [1, '#060c1a'],
  ]));
  // ink drips
  for (const x of [-14, -4, 8, 18]) {
    c.beginPath();
    c.ellipse(cx + x, cy + 32, 3, 6, 0, 0, TAU);
    fill(c, '#0a1430');
  }
  // gold trim
  c.beginPath();
  c.moveTo(cx - 18, cy + 16);
  c.quadraticCurveTo(cx, cy + 22, cx + 18, cy + 16);
  stroke(c, '#c9a35a', 2);
  // hooded face with glowing spectacles
  circle(c, cx, cy - 22, 13);
  body(c, '#1a2a4a', OUT, 2);
  c.beginPath();
  c.ellipse(cx, cy - 20, 9, 8, 0, 0, TAU);
  fill(c, '#03060c');
  for (const s of [-1, 1]) {
    glow(c, '#7fe3ff', 8);
    circle(c, cx + s * 4.5, cy - 21, 3.4);
    stroke(c, '#d6fbff', 1.6);
    noGlow(c);
    eye(c, cx + s * 4.5, cy - 21, 1.4, '#9ff4ff', 4);
  }
  // quill
  c.beginPath();
  c.moveTo(cx + 22, cy - 4);
  c.quadraticCurveTo(cx + 40, cy - 30, cx + 46, cy - 44);
  glow(c, '#ffe7a0', 5);
  stroke(c, '#fff8dc', 2.4);
  noGlow(c);
}

export function drawEngine(c: Ctx, w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2 + 4;
  // treads
  for (const s of [-1, 1]) {
    rrect(c, cx + s * 40 - 12, cy - 26, 24, 66, 8);
    body(c, '#1a1a22', OUT, 2);
    for (let i = 0; i < 6; i++) {
      c.fillStyle = '#3a3a44';
      c.fillRect(cx + s * 40 - 10, cy - 22 + i * 11, 20, 4);
    }
  }
  // hull
  rrect(c, cx - 34, cy - 36, 68, 70, 14);
  body(c, linear(c, 0, cy - 36, 0, cy + 34, [
    [0, '#9aa0b0'],
    [0.5, '#4a4e5c'],
    [1, '#1e2028'],
  ]));
  // furnace mouth
  glow(c, '#ff4a2a', 14);
  rrect(c, cx - 20, cy - 4, 40, 22, 6);
  fill(c, radial(c, cx, cy + 7, 2, 24, [
    [0, '#fff1a6'],
    [0.5, '#ff8a3d'],
    [1, '#a8200a'],
  ]));
  noGlow(c);
  for (let i = 0; i < 5; i++) {
    c.fillStyle = '#2a0e06';
    c.fillRect(cx - 18 + i * 8, cy - 4, 3, 22);
  }
  // smokestacks
  for (const s of [-1, 1]) {
    rrect(c, cx + s * 18 - 6, cy - 56, 12, 24, 3);
    body(c, '#3a3a44', OUT, 1.8);
    glow(c, '#ff7a2a', 8);
    c.beginPath();
    c.ellipse(cx + s * 18, cy - 56, 6, 2.4, 0, 0, TAU);
    fill(c, '#ffb347');
    noGlow(c);
  }
  // crown-like visor
  c.fillStyle = '#0a0a0e';
  c.fillRect(cx - 24, cy - 26, 48, 10);
  glow(c, '#ff3b2a', 8);
  c.fillStyle = '#ff6a4a';
  c.fillRect(cx - 20, cy - 23, 40, 4);
  noGlow(c);
  for (const [x, y] of [
    [-28, -30],
    [28, -30],
    [-28, 26],
    [28, 26],
  ]) {
    circle(c, cx + x, cy + y, 2.4);
    fill(c, '#d9c08a');
  }
}

export function drawRegent(c: Ctx, w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2 + 8;
  // void cape
  c.beginPath();
  c.moveTo(cx, cy - 30);
  c.quadraticCurveTo(cx + 40, cy - 6, cx + 34, cy + 38);
  c.quadraticCurveTo(cx + 12, cy + 26, cx, cy + 40);
  c.quadraticCurveTo(cx - 12, cy + 26, cx - 34, cy + 38);
  c.quadraticCurveTo(cx - 40, cy - 6, cx, cy - 30);
  body(c, linear(c, 0, cy - 30, 0, cy + 40, [
    [0, '#3a1a6a'],
    [1, '#05020c'],
  ]));
  // stars in the cape
  for (let i = 0; i < 9; i++) {
    const x = cx + Math.sin(i * 2.3) * 22;
    const y = cy + 4 + Math.cos(i * 1.7) * 18 + 10;
    glow(c, '#ffffff', 4);
    circle(c, x, y, 0.9 + (i % 3) * 0.4);
    fill(c, '#fff');
    noGlow(c);
  }
  // pale body
  c.beginPath();
  c.moveTo(cx, cy - 22);
  c.quadraticCurveTo(cx + 12, cy - 4, cx + 9, cy + 18);
  c.lineTo(cx - 9, cy + 18);
  c.quadraticCurveTo(cx - 12, cy - 4, cx, cy - 22);
  body(c, linear(c, 0, cy - 22, 0, cy + 18, [
    [0, '#fbf6ff'],
    [1, '#a89ac9'],
  ]), OUT, 2);
  // mask face
  c.beginPath();
  c.ellipse(cx, cy - 30, 10, 12, 0, 0, TAU);
  body(c, linear(c, 0, cy - 42, 0, cy - 18, [
    [0, '#ffffff'],
    [1, '#cfc4ea'],
  ]), OUT, 2);
  c.beginPath();
  c.moveTo(cx - 6, cy - 32);
  c.quadraticCurveTo(cx - 3, cy - 29, cx - 1, cy - 32);
  c.moveTo(cx + 6, cy - 32);
  c.quadraticCurveTo(cx + 3, cy - 29, cx + 1, cy - 32);
  stroke(c, '#3a1a6a', 1.6);
  // dark sun crown
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i - 3) * 0.32;
    poly(c, [cx + Math.cos(a) * 11, cy - 32 + Math.sin(a) * 13, cx + Math.cos(a) * 26, cy - 32 + Math.sin(a) * 28, cx + Math.cos(a + 0.12) * 12, cy - 32 + Math.sin(a + 0.12) * 14]);
    glow(c, '#d45cff', 8);
    fill(c, '#1a0a2a');
    noGlow(c);
    poly(c, [cx + Math.cos(a) * 11, cy - 32 + Math.sin(a) * 13, cx + Math.cos(a) * 26, cy - 32 + Math.sin(a) * 28, cx + Math.cos(a + 0.12) * 12, cy - 32 + Math.sin(a + 0.12) * 14]);
    stroke(c, '#ffb3ff', 1);
  }
  // stolen sun at the chest
  glow(c, '#ffd27a', 14);
  circle(c, cx, cy - 4, 5);
  fill(c, '#fff6c2');
  noGlow(c);
}

/* ───────────── guardians ───────────── */

export function drawThornback(c: Ctx, w: number, h: number) {
  const cx = w / 2 - 4;
  const cy = h / 2 + 8;
  for (let i = 0; i < 9; i++) {
    const a = Math.PI + 0.35 + i * 0.3;
    poly(c, [cx + Math.cos(a) * 20, cy + Math.sin(a) * 16, cx + Math.cos(a) * 44, cy + Math.sin(a) * 34 - 6, cx + Math.cos(a + 0.16) * 20, cy + Math.sin(a + 0.16) * 16]);
    body(c, i % 2 ? '#5a8a3a' : '#3d5a2a', OUT, 1.6);
  }
  for (const lx of [-20, -6, 10, 22]) {
    rrect(c, cx + lx - 3, cy + 12, 7, 14, 2);
    body(c, '#2a1a12', OUT, 1.4);
  }
  blob(c, cx, cy, 32, 20, 0.05, 24, 5);
  body(c, radial(c, cx - 6, cy - 8, 3, 34, [
    [0, '#9a6a40'],
    [1, '#3a2316'],
  ]));
  circle(c, cx + 28, cy + 2, 14);
  body(c, '#5a3a24', OUT, 2.2);
  for (const s of [-1, 1]) {
    c.beginPath();
    c.moveTo(cx + 32, cy + s * 6);
    c.quadraticCurveTo(cx + 52, cy + s * 14 - 10, cx + 54, cy + s * 4 - 14);
    c.quadraticCurveTo(cx + 46, cy + s * 4, cx + 30, cy + s * 2);
    body(c, '#f1e3c4', OUT, 1.8);
  }
  eye(c, cx + 32, cy - 2, 3, '#ff6a2a', 7);
}

export function drawBloomMother(c: Ctx, w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2 + 4;
  for (let i = 0; i < 5; i++) {
    const a = Math.PI * 0.5 + (i - 2) * 0.7;
    c.beginPath();
    c.ellipse(cx + Math.cos(a) * 30, cy + Math.sin(a) * 22, 20, 8, a, 0, TAU);
    body(c, '#2f8a6a', OUT, 1.6);
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    c.beginPath();
    c.ellipse(cx + Math.cos(a) * 20, cy - 6 + Math.sin(a) * 17, 16, 10, a, 0, TAU);
    body(c, linear(c, 0, cy - 30, 0, cy + 14, [
      [0, '#ffb38a'],
      [1, '#c9402a'],
    ]), OUT, 1.8);
  }
  circle(c, cx, cy - 6, 15);
  body(c, '#1a0e0c', OUT, 2);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU;
    poly(c, [cx + Math.cos(a) * 14.5, cy - 6 + Math.sin(a) * 14.5, cx + Math.cos(a + 0.15) * 8, cy - 6 + Math.sin(a + 0.15) * 8, cx + Math.cos(a + 0.3) * 14.5, cy - 6 + Math.sin(a + 0.3) * 14.5]);
    fill(c, '#f4e6d0');
  }
  glow(c, '#7ad9a8', 10);
  circle(c, cx, cy - 6, 5);
  fill(c, '#b9ffd9');
  noGlow(c);
}

export function drawLibrarian(c: Ctx, w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2 + 4;
  c.beginPath();
  c.moveTo(cx, cy - 26);
  c.quadraticCurveTo(cx + 20, cy - 6, cx + 18, cy + 26);
  c.lineTo(cx - 18, cy + 26);
  c.quadraticCurveTo(cx - 20, cy - 6, cx, cy - 26);
  body(c, linear(c, 0, cy - 26, 0, cy + 26, [
    [0, '#5a3a7a'],
    [1, '#120826'],
  ]));
  // giant open book held in front
  for (const s of [-1, 1]) {
    c.beginPath();
    c.moveTo(cx, cy + 2);
    c.quadraticCurveTo(cx + s * 10, cy - 4, cx + s * 22, cy);
    c.lineTo(cx + s * 22, cy + 16);
    c.quadraticCurveTo(cx + s * 10, cy + 12, cx, cy + 18);
    body(c, '#fff1d0', OUT, 1.6);
  }
  glow(c, '#ffd27a', 8);
  star(c, cx, cy + 9, 2, 5, 4);
  fill(c, '#ffe7a0');
  noGlow(c);
  circle(c, cx, cy - 18, 10);
  body(c, '#2a1a4a', OUT, 1.8);
  eye(c, cx - 3, cy - 18, 1.8, '#9ff4ff', 6);
  eye(c, cx + 3, cy - 18, 1.8, '#9ff4ff', 6);
}

export function drawDeepmaw(c: Ctx, w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2;
  circle(c, cx, cy + 6, 36);
  fill(c, 'rgba(10,20,40,0.8)');
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    circle(c, cx + Math.cos(a) * 26, cy + Math.sin(a) * 22, 8);
    body(c, i % 2 ? '#2a50c9' : '#1a3a8a', OUT, 1.4);
  }
  circle(c, cx, cy, 19);
  body(c, '#03060f', OUT, 2.2);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU;
    poly(c, [cx + Math.cos(a) * 18.5, cy + Math.sin(a) * 18.5, cx + Math.cos(a + 0.15) * 8, cy + Math.sin(a + 0.15) * 8, cx + Math.cos(a + 0.3) * 18.5, cy + Math.sin(a + 0.3) * 18.5]);
    fill(c, '#d6f4ff');
  }
  for (const s of [-1, 1]) eye(c, cx + s * 22, cy - 14, 3, '#ffe066', 6);
}

export function drawForeman(c: Ctx, w: number, h: number) {
  const cx = w / 2 - 4;
  const cy = h / 2 + 6;
  rrect(c, cx - 18, cy + 16, 14, 18, 3);
  body(c, '#2a2a33', OUT, 1.6);
  rrect(c, cx + 4, cy + 16, 14, 18, 3);
  body(c, '#2a2a33', OUT, 1.6);
  rrect(c, cx - 24, cy - 26, 48, 44, 10);
  body(c, linear(c, 0, cy - 26, 0, cy + 18, [
    [0, '#c9a35a'],
    [0.5, '#6a5430'],
    [1, '#2a2218'],
  ]));
  c.fillStyle = '#0a0a0e';
  c.fillRect(cx - 14, cy - 18, 28, 7);
  glow(c, '#ffd27a', 6);
  c.fillStyle = '#ffe7a0';
  c.fillRect(cx - 11, cy - 16, 22, 3);
  noGlow(c);
  // hammer
  c.beginPath();
  c.moveTo(cx + 18, cy + 4);
  c.lineTo(cx + 40, cy - 26);
  stroke(c, '#3a2a22', 4);
  rrect(c, cx + 30, cy - 38, 24, 16, 3);
  body(c, linear(c, 0, cy - 38, 0, cy - 22, [
    [0, '#c8d2e6'],
    [1, '#5a6070'],
  ]), OUT, 1.8);
  glow(c, '#ff7a2a', 8);
  circle(c, cx, cy + 4, 5);
  fill(c, '#ffb347');
  noGlow(c);
}

export function drawRiveter(c: Ctx, w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2 + 4;
  c.beginPath();
  c.ellipse(cx, cy + 14, 24, 10, 0, 0, TAU);
  body(c, '#2a2a33', OUT, 1.8);
  rrect(c, cx - 18, cy - 12, 36, 26, 8);
  body(c, linear(c, 0, cy - 12, 0, cy + 14, [
    [0, '#9aa0b0'],
    [1, '#2a2c36'],
  ]));
  // twin barrels
  for (const s of [-1, 1]) {
    rrect(c, cx + 10, cy - 6 + s * 6 - 3, 22, 6, 2);
    body(c, '#4a4e5c', OUT, 1.4);
  }
  glow(c, '#ffb347', 9);
  circle(c, cx - 4, cy - 1, 6);
  fill(c, '#ffd27a');
  noGlow(c);
  glow(c, '#ffb347', 6);
  c.beginPath();
  c.moveTo(cx - 6, cy - 12);
  c.lineTo(cx - 6, cy - 26);
  stroke(c, '#c9a35a', 2.4);
  circle(c, cx - 6, cy - 28, 4);
  fill(c, '#fff1a6');
  noGlow(c);
}

export function drawEclipseKnight(c: Ctx, w: number, h: number) {
  const cx = w / 2 - 4;
  const cy = h / 2 + 8;
  c.fillStyle = '#120a22';
  c.fillRect(cx - 12, cy + 14, 9, 18);
  c.fillRect(cx + 3, cy + 14, 9, 18);
  c.beginPath();
  c.roundRect(cx - 18, cy - 16, 36, 32, 10);
  body(c, linear(c, 0, cy - 16, 0, cy + 16, [
    [0, '#2a1a4a'],
    [1, '#0a0614'],
  ]));
  c.beginPath();
  c.moveTo(cx - 16, cy - 4);
  c.lineTo(cx + 16, cy - 4);
  glow(c, '#e8d8ff', 5);
  stroke(c, '#e8d8ff', 1.4);
  noGlow(c);
  // eclipse helm
  circle(c, cx, cy - 26, 13);
  body(c, '#0a0614', OUT, 2.2);
  c.beginPath();
  c.arc(cx, cy - 26, 13, -Math.PI * 0.85, -Math.PI * 0.15);
  glow(c, '#fff1a6', 10);
  stroke(c, '#fff1a6', 2.4);
  noGlow(c);
  eye(c, cx + 3, cy - 25, 2, '#ffffff', 7);
  // great blade
  c.beginPath();
  c.moveTo(cx + 16, cy + 6);
  c.lineTo(cx + 46, cy - 36);
  glow(c, '#e8d8ff', 8);
  stroke(c, '#f4eaff', 5);
  noGlow(c);
  c.beginPath();
  c.moveTo(cx + 14, cy);
  c.lineTo(cx + 24, cy + 8);
  stroke(c, '#c9a35a', 3);
}

export function drawVoidMatron(c: Ctx, w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2 + 6;
  // halo of void rings
  for (let i = 0; i < 2; i++) {
    c.beginPath();
    c.ellipse(cx, cy - 6, 36 - i * 8, 12 - i * 3, 0.2 + i * 0.7, 0, TAU);
    glow(c, '#d45cff', 6);
    stroke(c, i ? '#ffb3ff' : '#d45cff', 2);
  }
  noGlow(c);
  c.beginPath();
  c.moveTo(cx, cy - 28);
  c.quadraticCurveTo(cx + 26, cy - 4, cx + 22, cy + 30);
  c.quadraticCurveTo(cx, cy + 22, cx - 22, cy + 30);
  c.quadraticCurveTo(cx - 26, cy - 4, cx, cy - 28);
  body(c, linear(c, 0, cy - 28, 0, cy + 30, [
    [0, '#5a2a8a'],
    [1, '#0a0418'],
  ]));
  c.beginPath();
  c.ellipse(cx, cy - 18, 9, 11, 0, 0, TAU);
  body(c, '#f4eaff', OUT, 1.8);
  for (const s of [-1, 1]) {
    c.beginPath();
    c.ellipse(cx + s * 3.6, cy - 19, 2, 3, 0, 0, TAU);
    fill(c, '#2a0a4a');
  }
  glow(c, '#ff7ae0', 12);
  circle(c, cx, cy + 4, 6);
  fill(c, radial(c, cx, cy + 4, 0.5, 7, [
    [0, '#ffffff'],
    [1, '#d45cff'],
  ]));
  noGlow(c);
}

/* boss projectiles */
export function drawPage(c: Ctx, w: number, h: number) {
  rrect(c, 2, 3, w - 4, h - 6, 2);
  glow(c, '#ffe0a0', 5);
  fill(c, '#fff8e6');
  noGlow(c);
  for (let i = 0; i < 3; i++) {
    c.fillStyle = 'rgba(90,60,30,0.6)';
    c.fillRect(5, 6 + i * 4, w - 10, 1.2);
  }
}
export function drawRegentWave(c: Ctx, w: number, h: number) {
  c.beginPath();
  c.arc(w * 0.18, h / 2, h * 0.48, -1.25, 1.25);
  c.arc(w * 0.02, h / 2, h * 0.44, 1.1, -1.1, true);
  c.closePath();
  glow(c, '#d45cff', 8);
  fill(c, linear(c, 0, 0, w, 0, [
    [0, 'rgba(212,92,255,0.4)'],
    [1, 'rgba(255,240,255,1)'],
  ]));
  noGlow(c);
}
