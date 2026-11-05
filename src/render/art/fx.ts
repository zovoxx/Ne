import { ART, circle, ellipse, fill, glow, linear, noGlow, poly, prand, radial, stroke, TAU, type Ctx } from './kit';

/* ─────────────── generic FX textures (white — tinted at runtime) ─────────────── */

export function drawGlow(c: Ctx, w: number, h: number) {
  const r = w / 2;
  c.fillStyle = radial(c, r, r, 0, r, [
    [0, 'rgba(255,255,255,1)'],
    [0.25, 'rgba(255,255,255,0.55)'],
    [0.6, 'rgba(255,255,255,0.14)'],
    [1, 'rgba(255,255,255,0)'],
  ]);
  c.fillRect(0, 0, w, h);
}

export function drawSoftDot(c: Ctx, w: number, h: number) {
  const r = w / 2;
  c.fillStyle = radial(c, r, r, 0, r, [
    [0, 'rgba(255,255,255,1)'],
    [0.5, 'rgba(255,255,255,0.9)'],
    [1, 'rgba(255,255,255,0)'],
  ]);
  c.fillRect(0, 0, w, h);
}

export function drawSpark(c: Ctx, w: number, h: number) {
  // elongated streak, bright core, pointed ends
  const g = linear(c, 0, 0, w, 0, [
    [0, 'rgba(255,255,255,0)'],
    [0.35, 'rgba(255,255,255,0.7)'],
    [0.75, 'rgba(255,255,255,1)'],
    [1, 'rgba(255,255,255,0)'],
  ]);
  poly(c, [0, h / 2, w * 0.7, 0, w, h / 2, w * 0.7, h]);
  fill(c, g);
}

export function drawShard(c: Ctx, w: number, h: number) {
  poly(c, [w * 0.1, h * 0.2, w * 0.95, h * 0.5, w * 0.2, h * 0.9, w * 0.35, h * 0.5]);
  fill(c, 'rgba(255,255,255,1)');
}

export function drawRing(c: Ctx, w: number, h: number) {
  const r = w / 2;
  circle(c, r, r, r * 0.86);
  stroke(c, 'rgba(255,255,255,1)', r * 0.1);
  circle(c, r, r, r * 0.86);
  glow(c, 'white', 4);
  stroke(c, 'rgba(255,255,255,0.4)', r * 0.04);
  noGlow(c);
}

export function drawSmoke(c: Ctx, w: number, h: number) {
  const r = w / 2;
  const rnd = prand(77);
  for (let i = 0; i < 7; i++) {
    const x = r + (rnd() - 0.5) * r * 0.6;
    const y = r + (rnd() - 0.5) * r * 0.6;
    const rr = r * (0.35 + rnd() * 0.25);
    c.fillStyle = radial(c, x, y, 0, rr, [
      [0, 'rgba(255,255,255,0.5)'],
      [1, 'rgba(255,255,255,0)'],
    ]);
    c.fillRect(0, 0, w, h);
  }
}

/** crescent slash spanning -90°..+90° around (0, h/2), facing +x */
export function drawSlash(c: Ctx, w: number, h: number) {
  const cx = 0;
  const cy = h / 2;
  const R = w * 0.96;
  const n = 48;
  c.beginPath();
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = -Math.PI / 2 + t * Math.PI;
    c.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
  }
  for (let i = n; i >= 0; i--) {
    const t = i / n;
    const a = -Math.PI / 2 + t * Math.PI;
    const thick = Math.sin(t * Math.PI) * 0.36 + 0.02;
    const r = R * (1 - thick);
    c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  c.closePath();
  const g = radial(c, cx, cy, R * 0.5, R, [
    [0, 'rgba(255,255,255,0)'],
    [0.55, 'rgba(255,255,255,0.35)'],
    [0.9, 'rgba(255,255,255,0.95)'],
    [1, 'rgba(255,255,255,1)'],
  ]);
  c.fillStyle = g;
  c.fill();
}

/** full ring slash for spin attacks */
export function drawSlashRing(c: Ctx, w: number, h: number) {
  const r = w / 2;
  const g = radial(c, r, r, r * 0.55, r, [
    [0, 'rgba(255,255,255,0)'],
    [0.5, 'rgba(255,255,255,0.3)'],
    [0.88, 'rgba(255,255,255,0.95)'],
    [1, 'rgba(255,255,255,0)'],
  ]);
  circle(c, r, r, r);
  c.fillStyle = g;
  c.fill();
}

/** straight thrust streak, facing +x */
export function drawThrust(c: Ctx, w: number, h: number) {
  const g = linear(c, 0, 0, w, 0, [
    [0, 'rgba(255,255,255,0)'],
    [0.6, 'rgba(255,255,255,0.6)'],
    [0.94, 'rgba(255,255,255,1)'],
    [1, 'rgba(255,255,255,0)'],
  ]);
  poly(c, [0, h * 0.35, w * 0.85, 0, w, h / 2, w * 0.85, h, 0, h * 0.65]);
  fill(c, g);
}

export function drawShadow(c: Ctx, w: number, h: number) {
  ellipse(c, w / 2, h / 2, w / 2, h / 2);
  c.fillStyle = radial(c, w / 2, h / 2, 0, w / 2, [
    [0, 'rgba(0,0,0,0.55)'],
    [0.7, 'rgba(0,0,0,0.35)'],
    [1, 'rgba(0,0,0,0)'],
  ]);
  c.save();
  c.translate(w / 2, h / 2);
  c.scale(1, h / w);
  circle(c, 0, 0, w / 2);
  c.fill();
  c.restore();
}

export function drawPortal(c: Ctx, w: number, h: number) {
  const r = w / 2;
  for (let i = 0; i < 3; i++) {
    c.beginPath();
    c.arc(r, r, r * (0.55 + i * 0.15), i * 2, i * 2 + Math.PI * 1.3);
    stroke(c, `rgba(255,255,255,${0.9 - i * 0.25})`, 3 - i * 0.6);
  }
  c.fillStyle = radial(c, r, r, 0, r * 0.6, [
    [0, 'rgba(255,255,255,0.7)'],
    [1, 'rgba(255,255,255,0)'],
  ]);
  c.fillRect(0, 0, w, h);
}

/* ─────────────── telegraphs ─────────────── */

export function drawTgDisc(c: Ctx, w: number, h: number) {
  const r = w / 2;
  circle(c, r, r, r - 1);
  c.fillStyle = radial(c, r, r, 0, r, [
    [0, 'rgba(255,255,255,0.18)'],
    [0.8, 'rgba(255,255,255,0.3)'],
    [0.96, 'rgba(255,255,255,0.65)'],
    [1, 'rgba(255,255,255,0)'],
  ]);
  c.fill();
}
export function drawTgEdge(c: Ctx, w: number, h: number) {
  const r = w / 2;
  circle(c, r, r, r - 2.5);
  stroke(c, 'rgba(255,255,255,1)', 2.2);
}
export function drawTgBar(c: Ctx, w: number, h: number) {
  // horizontal bar facing +x with chevrons
  c.fillStyle = 'rgba(255,255,255,0.22)';
  c.fillRect(0, 2, w, h - 4);
  c.fillStyle = 'rgba(255,255,255,0.9)';
  c.fillRect(0, 1, w, 2);
  c.fillRect(0, h - 3, w, 2);
}
export function drawTgBarFill(c: Ctx, w: number, h: number) {
  c.fillStyle = linear(c, 0, 0, w, 0, [
    [0, 'rgba(255,255,255,0.15)'],
    [1, 'rgba(255,255,255,0.55)'],
  ]);
  c.fillRect(0, 2, w, h - 4);
}

/* ─────────────── decals (floor) ─────────────── */

export function makeSplat(seed: number) {
  return (c: Ctx, w: number, h: number) => {
    const rnd = prand(seed);
    const cx = w / 2;
    const cy = h / 2;
    c.fillStyle = 'rgba(255,255,255,0.9)';
    c.beginPath();
    const n = 14;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * TAU;
      const rr = w * (0.18 + rnd() * 0.14);
      c.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    c.fill();
    for (let i = 0; i < 9; i++) {
      const a = rnd() * TAU;
      const d = w * (0.25 + rnd() * 0.22);
      circle(c, cx + Math.cos(a) * d, cy + Math.sin(a) * d, w * (0.02 + rnd() * 0.05));
      c.fill();
    }
  };
}
export function makeScorch(seed: number) {
  return (c: Ctx, w: number, h: number) => {
    const rnd = prand(seed);
    const r = w / 2;
    c.fillStyle = radial(c, r, r, 0, r, [
      [0, 'rgba(255,255,255,0.85)'],
      [0.5, 'rgba(255,255,255,0.5)'],
      [1, 'rgba(255,255,255,0)'],
    ]);
    c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(255,255,255,0.7)';
    c.lineWidth = 1.4;
    for (let i = 0; i < 7; i++) {
      const a = rnd() * TAU;
      c.beginPath();
      c.moveTo(r + Math.cos(a) * r * 0.15, r + Math.sin(a) * r * 0.15);
      let x = r;
      let y = r;
      for (let k = 0; k < 4; k++) {
        x += Math.cos(a + (rnd() - 0.5)) * r * 0.2;
        y += Math.sin(a + (rnd() - 0.5)) * r * 0.2;
        c.lineTo(x, y);
      }
      c.stroke();
    }
  };
}

/* ─────────────── projectiles ─────────────── */

export function drawBullet(c: Ctx, w: number, h: number) {
  const r = w / 2;
  c.fillStyle = radial(c, r, r, 0, r, [
    [0, 'rgba(255,255,255,1)'],
    [0.35, 'rgba(255,255,255,1)'],
    [0.55, 'rgba(255,255,255,0.5)'],
    [1, 'rgba(255,255,255,0)'],
  ]);
  c.fillRect(0, 0, w, h);
}

export function drawKnife(c: Ctx, w: number, h: number) {
  glow(c, '#ffffff', 4);
  poly(c, [w * 0.05, h * 0.5, w * 0.3, h * 0.25, w * 0.98, h * 0.5, w * 0.3, h * 0.75]);
  fill(c, '#f4f0ff');
  noGlow(c);
  poly(c, [w * 0.3, h * 0.5, w * 0.98, h * 0.5, w * 0.3, h * 0.64]);
  fill(c, '#b9b2d6');
}

export function drawArrow(c: Ctx, w: number, h: number) {
  glow(c, '#ffffff', 3);
  c.fillStyle = '#fff';
  c.fillRect(w * 0.1, h * 0.44, w * 0.72, h * 0.12);
  poly(c, [w * 0.72, h * 0.2, w, h * 0.5, w * 0.72, h * 0.8]);
  fill(c, '#fff');
  poly(c, [w * 0.02, h * 0.25, w * 0.18, h * 0.5, w * 0.02, h * 0.75, w * 0.12, h * 0.5]);
  fill(c, 'rgba(255,255,255,0.8)');
  noGlow(c);
}

export function drawBolt(c: Ctx, w: number, h: number) {
  const g = linear(c, 0, 0, w, 0, [
    [0, 'rgba(255,255,255,0)'],
    [0.7, 'rgba(255,255,255,0.8)'],
    [1, 'rgba(255,255,255,1)'],
  ]);
  glow(c, 'white', 4);
  poly(c, [0, h * 0.4, w * 0.9, h * 0.2, w, h * 0.5, w * 0.9, h * 0.8, 0, h * 0.6]);
  fill(c, g);
  noGlow(c);
}

export function drawSigil(c: Ctx, w: number, h: number) {
  const r = w / 2;
  glow(c, 'white', 5);
  circle(c, r, r, r * 0.92);
  stroke(c, 'rgba(255,255,255,0.95)', 2.4);
  circle(c, r, r, r * 0.74);
  stroke(c, 'rgba(255,255,255,0.6)', 1.4);
  noGlow(c);
  // runes
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    c.save();
    c.translate(r + Math.cos(a) * r * 0.83, r + Math.sin(a) * r * 0.83);
    c.rotate(a + Math.PI / 2);
    poly(c, [-3, -3, 0, 3, 3, -3]);
    stroke(c, 'rgba(255,255,255,0.9)', 1.2);
    c.restore();
  }
  // inner star
  c.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU * 2 - Math.PI / 2;
    const px = r + Math.cos(a) * r * 0.6;
    const py = r + Math.sin(a) * r * 0.6;
    if (i === 0) c.moveTo(px, py);
    else c.lineTo(px, py);
  }
  c.closePath();
  stroke(c, 'rgba(255,255,255,0.75)', 1.4);
}

export function drawBeam(c: Ctx, w: number, h: number) {
  c.fillStyle = linear(c, 0, 0, 0, h, [
    [0, 'rgba(255,255,255,0)'],
    [0.3, 'rgba(255,255,255,0.5)'],
    [0.5, 'rgba(255,255,255,1)'],
    [0.7, 'rgba(255,255,255,0.5)'],
    [1, 'rgba(255,255,255,0)'],
  ]);
  c.fillRect(0, 0, w, h);
}

export function drawMoonWave(c: Ctx, w: number, h: number) {
  // crescent facing +x
  c.beginPath();
  c.arc(w * 0.2, h / 2, h * 0.48, -1.2, 1.2);
  c.arc(w * 0.05, h / 2, h * 0.42, 1.05, -1.05, true);
  c.closePath();
  glow(c, '#9fe7ff', 6);
  fill(c, linear(c, 0, 0, w, 0, [
    [0, 'rgba(159,231,255,0.3)'],
    [1, 'rgba(255,255,255,1)'],
  ]));
  noGlow(c);
}

export function drawWindBlade(c: Ctx, w: number, h: number) {
  c.beginPath();
  c.moveTo(0, h * 0.5);
  c.quadraticCurveTo(w * 0.5, h * 0.05, w, h * 0.45);
  c.quadraticCurveTo(w * 0.5, h * 0.35, 0, h * 0.5);
  glow(c, '#8dffc8', 5);
  fill(c, 'rgba(230,255,244,0.95)');
  c.beginPath();
  c.moveTo(w * 0.1, h * 0.62);
  c.quadraticCurveTo(w * 0.55, h * 0.95, w * 0.9, h * 0.62);
  c.quadraticCurveTo(w * 0.5, h * 0.72, w * 0.1, h * 0.62);
  fill(c, 'rgba(141,255,200,0.8)');
  noGlow(c);
}

/* ─────────────── damage digits ─────────────── */

export function makeDigit(ch: string, crit: boolean) {
  return (c: Ctx, w: number, h: number) => {
    const size = h * 0.86;
    c.font = `900 ${size}px "Arial Black", "Arial Rounded MT Bold", "Helvetica Neue", Arial, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineJoin = 'round';
    const x = w / 2;
    const y = h / 2 + h * 0.04;
    if (crit) {
      glow(c, 'rgba(255,120,0,0.9)', 5);
      c.strokeStyle = '#5a1200';
      c.lineWidth = size * 0.26;
      c.strokeText(ch, x, y);
      noGlow(c);
      c.fillStyle = linear(c, 0, y - size / 2, 0, y + size / 2, [
        [0, '#fff7c2'],
        [0.45, '#ffd23a'],
        [1, '#ff7a00'],
      ]);
      c.fillText(ch, x, y);
    } else {
      c.strokeStyle = 'rgba(10,6,16,0.95)';
      c.lineWidth = size * 0.24;
      c.strokeText(ch, x, y);
      c.fillStyle = '#ffffff';
      c.fillText(ch, x, y);
    }
  };
}

/** big text label baked into the atlas (streak tiers, "BLOCK" etc.) */
export function makeLabel(text: string, color: string) {
  return (c: Ctx, w: number, h: number) => {
    const size = h * 0.7;
    c.font = `900 ${size}px "Arial Black", "Helvetica Neue", Arial, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineJoin = 'round';
    c.strokeStyle = 'rgba(10,6,16,0.95)';
    c.lineWidth = size * 0.22;
    c.strokeText(text, w / 2, h / 2);
    glow(c, color, 6);
    c.fillStyle = color;
    c.fillText(text, w / 2, h / 2);
    noGlow(c);
  };
}

export const _art = ART;
