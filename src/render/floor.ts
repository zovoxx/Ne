import { Texture, CanvasSource } from 'pixi.js';
import { prand, TAU } from './art/kit';

export interface BiomeLook {
  name: string;
  base: string;
  tile: string;
  tileLine: string;
  accent: string;
  accent2: string;
  wall: number;
  wallEdge: number;
  wallGlow: number;
  ambient: number;
  pillar: number;
  pillarTop: number;
  vignette: number;
}

export const BIOME_LOOKS: BiomeLook[] = [
  {
    name: 'The Ashen Gardens',
    base: '#1a1311',
    tile: '#221915',
    tileLine: 'rgba(0,0,0,0.45)',
    accent: 'rgba(255,128,48,0.55)',
    accent2: 'rgba(92,200,170,0.22)',
    wall: 0x0d0807,
    wallEdge: 0x3a2a22,
    wallGlow: 0xff7a2a,
    ambient: 0xff9a5a,
    pillar: 0x2a1d18,
    pillarTop: 0x4a362c,
    vignette: 0x120604,
  },
  {
    name: 'The Drowned Archive',
    base: '#0b1422',
    tile: '#0f1b2d',
    tileLine: 'rgba(0,0,0,0.5)',
    accent: 'rgba(80,220,255,0.45)',
    accent2: 'rgba(230,210,160,0.16)',
    wall: 0x050a12,
    wallEdge: 0x1c3048,
    wallGlow: 0x47d6ff,
    ambient: 0x6fd8ff,
    pillar: 0x13233a,
    pillarTop: 0x2b4466,
    vignette: 0x020610,
  },
  {
    name: 'The Clockwork Foundry',
    base: '#16130f',
    tile: '#1e1a15',
    tileLine: 'rgba(0,0,0,0.55)',
    accent: 'rgba(255,70,40,0.5)',
    accent2: 'rgba(220,170,80,0.25)',
    wall: 0x0a0806,
    wallEdge: 0x3e3326,
    wallGlow: 0xff4a2a,
    ambient: 0xffb46a,
    pillar: 0x2c261e,
    pillarTop: 0x5a4a36,
    vignette: 0x0c0603,
  },
  {
    name: 'The Starless Crown',
    base: '#0e0a19',
    tile: '#151026',
    tileLine: 'rgba(0,0,0,0.5)',
    accent: 'rgba(255,80,200,0.42)',
    accent2: 'rgba(200,190,255,0.22)',
    wall: 0x05030b,
    wallEdge: 0x2a1f45,
    wallGlow: 0xd45cff,
    ambient: 0xc89cff,
    pillar: 0x1d1633,
    pillarTop: 0x3c2f66,
    vignette: 0x06020e,
  },
];

const TILE_UNITS = 512;
const RES = 2;

/** procedural floor tile per biome, used as a TilingSprite texture */
export function makeFloorTexture(biome: number): Texture {
  const L = BIOME_LOOKS[biome];
  const cv = document.createElement('canvas');
  cv.width = cv.height = TILE_UNITS * RES;
  const c = cv.getContext('2d')!;
  c.scale(RES, RES);
  const S = TILE_UNITS;
  const rnd = prand(1000 + biome * 77);
  c.fillStyle = L.base;
  c.fillRect(0, 0, S, S);
  if (biome === 0) {
    // ashen flagstones with ember seams and ash moss
    const n = 4;
    const cell = S / n;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const x = i * cell + (j % 2) * cell * 0.5;
        const k = 0.9 + rnd() * 0.25;
        c.fillStyle = shadeCss(L.tile, k);
        roundRect(c, (x % S) + 3, j * cell + 3, cell - 6, cell - 6, 10);
        c.fill();
        if (x + cell > S) {
          roundRect(c, x - S + 3, j * cell + 3, cell - 6, cell - 6, 10);
          c.fill();
        }
      }
    // ash drifts: soft irregular smudges rather than dots
    for (let i = 0; i < 14; i++) {
      const x = rnd() * S;
      const y = rnd() * S;
      const r = 10 + rnd() * 26;
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(92,200,170,0.10)');
      g.addColorStop(1, 'rgba(92,200,170,0)');
      c.fillStyle = g;
      c.beginPath();
      c.ellipse(x, y, r, r * (0.5 + rnd() * 0.4), rnd() * TAU, 0, TAU);
      c.fill();
    }
    for (let i = 0; i < 40; i++) {
      c.fillStyle = 'rgba(255,150,80,0.35)';
      c.fillRect(rnd() * S, rnd() * S, 1.5, 1.5);
    }
    c.strokeStyle = L.accent;
    c.lineWidth = 1.2;
    for (let i = 0; i < 7; i++) {
      let x = rnd() * S;
      let y = rnd() * S;
      c.beginPath();
      c.moveTo(x, y);
      for (let k = 0; k < 5; k++) {
        x += (rnd() - 0.5) * 50;
        y += (rnd() - 0.5) * 50;
        c.lineTo(x, y);
      }
      c.stroke();
    }
  } else if (biome === 1) {
    // archive: wet tiles, rune inlays, puddles
    const n = 8;
    const cell = S / n;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        c.fillStyle = shadeCss(L.tile, 0.85 + rnd() * 0.3);
        c.fillRect(i * cell + 1.5, j * cell + 1.5, cell - 3, cell - 3);
      }
    for (let i = 0; i < 6; i++) {
      c.fillStyle = 'rgba(90,200,255,0.06)';
      c.beginPath();
      c.ellipse(rnd() * S, rnd() * S, 30 + rnd() * 50, 14 + rnd() * 20, rnd() * TAU, 0, TAU);
      c.fill();
    }
    c.strokeStyle = L.accent;
    c.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const x = Math.floor(rnd() * n) * cell + cell / 2;
      const y = Math.floor(rnd() * n) * cell + cell / 2;
      c.beginPath();
      c.arc(x, y, cell * 0.3, 0, TAU);
      c.moveTo(x - cell * 0.2, y);
      c.lineTo(x + cell * 0.2, y);
      c.moveTo(x, y - cell * 0.2);
      c.lineTo(x, y + cell * 0.2);
      c.stroke();
    }
    for (let i = 0; i < 30; i++) {
      c.fillStyle = L.accent2;
      c.fillRect(rnd() * S, rnd() * S, 6 + rnd() * 10, 2);
    }
  } else if (biome === 2) {
    // foundry: riveted plates and hot seams
    const n = 4;
    const cell = S / n;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const x = i * cell;
        const y = j * cell;
        c.fillStyle = shadeCss(L.tile, 0.85 + rnd() * 0.3);
        c.fillRect(x + 2, y + 2, cell - 4, cell - 4);
        c.fillStyle = 'rgba(255,255,255,0.05)';
        c.fillRect(x + 2, y + 2, cell - 4, 3);
        c.fillStyle = 'rgba(220,170,80,0.35)';
        for (const [rx, ry] of [
          [8, 8],
          [cell - 8, 8],
          [8, cell - 8],
          [cell - 8, cell - 8],
        ]) {
          c.beginPath();
          c.arc(x + rx, y + ry, 2.4, 0, TAU);
          c.fill();
        }
      }
    c.strokeStyle = L.accent;
    c.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const y = Math.floor(rnd() * 4) * cell + 2;
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(S, y);
      c.stroke();
    }
    for (let i = 0; i < 4; i++) {
      c.fillStyle = 'rgba(0,0,0,0.25)';
      c.beginPath();
      c.arc(rnd() * S, rnd() * S, 20 + rnd() * 30, 0, TAU);
      c.fill();
    }
  } else {
    // crown: dark marble with luminous veins and stars
    const n = 4;
    const cell = S / n;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        c.fillStyle = shadeCss(L.tile, 0.85 + rnd() * 0.3);
        c.beginPath();
        const x = i * cell + cell / 2;
        const y = j * cell + cell / 2;
        c.moveTo(x, y - cell / 2 + 3);
        c.lineTo(x + cell / 2 - 3, y);
        c.lineTo(x, y + cell / 2 - 3);
        c.lineTo(x - cell / 2 + 3, y);
        c.closePath();
        c.fill();
      }
    c.strokeStyle = L.accent;
    c.lineWidth = 0.9;
    for (let i = 0; i < 6; i++) {
      let x = rnd() * S;
      let y = rnd() * S;
      c.beginPath();
      c.moveTo(x, y);
      for (let k = 0; k < 8; k++) {
        x += (rnd() - 0.5) * 60;
        y += (rnd() - 0.5) * 60;
        c.lineTo(x, y);
      }
      c.stroke();
    }
    for (let i = 0; i < 60; i++) {
      c.fillStyle = L.accent2;
      c.fillRect(rnd() * S, rnd() * S, 1.6, 1.6);
    }
  }
  // subtle noise
  for (let i = 0; i < 900; i++) {
    c.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.08)';
    c.fillRect(rnd() * S, rnd() * S, 2, 2);
  }
  const src = new CanvasSource({ resource: cv, resolution: RES, autoGenerateMipmaps: true });
  src.addressMode = 'repeat';
  return new Texture({ source: src });
}

/** screen vignette (radial) */
export function makeVignette(): Texture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const c = cv.getContext('2d')!;
  const g = c.createRadialGradient(128, 128, 40, 128, 128, 182);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.12)');
  g.addColorStop(1, 'rgba(255,255,255,1)');
  c.fillStyle = g;
  c.fillRect(0, 0, 256, 256);
  return new Texture({ source: new CanvasSource({ resource: cv }) });
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
}

function shadeCss(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * k));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * k));
  const b = Math.min(255, Math.round((n & 255) * k));
  return `rgb(${r},${g},${b})`;
}
