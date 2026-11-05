/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  CENTRAL ASSET MAP                                                   ║
 * ║  Every sprite in the game is looked up here by key. Gameplay code    ║
 * ║  only ever refers to keys (EnemyDef.art, Projectile.art …).          ║
 * ║                                                                      ║
 * ║  To use your own art: put a PNG in /public/sprites/ and add          ║
 * ║    url: 'sprites/cinderling.png'                                     ║
 * ║  to the entry. It is drawn into the atlas at w×h world units         ║
 * ║  (keep the same aspect), silhouettes for hit-flash are generated     ║
 * ║  automatically, and the procedural draw() is ignored.                ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */
import type { Ctx } from './art/kit';
import * as FX from './art/fx';
import * as CH from './art/chars';
import * as E1 from './art/enemies1';

export interface AssetSpec {
  /** size in world units */
  w: number;
  h: number;
  /** anchor 0..1 (default centre) */
  ax?: number;
  ay?: number;
  draw?: (c: Ctx, w: number, h: number) => void;
  /** optional sprite file (relative to the site root), replaces draw */
  url?: string;
  /** generate a white silhouette for hit flashes */
  sil?: boolean;
}

const A: Record<string, AssetSpec> = {
  // ─── FX (white, tinted at runtime) ───
  px: { w: 4, h: 4, draw: (c, w, h) => { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); } },
  glow: { w: 64, h: 64, draw: FX.drawGlow },
  dot: { w: 12, h: 12, draw: FX.drawSoftDot },
  spark: { w: 28, h: 6, draw: FX.drawSpark },
  shard: { w: 12, h: 12, draw: FX.drawShard },
  ring: { w: 128, h: 128, draw: FX.drawRing },
  smoke: { w: 48, h: 48, draw: FX.drawSmoke },
  slash: { w: 100, h: 200, ax: 0, ay: 0.5, draw: FX.drawSlash },
  slashRing: { w: 200, h: 200, draw: FX.drawSlashRing },
  thrust: { w: 200, h: 34, ax: 0, ay: 0.5, draw: FX.drawThrust },
  shadow: { w: 48, h: 20, draw: FX.drawShadow },
  portal: { w: 80, h: 80, draw: FX.drawPortal },
  beam: { w: 32, h: 16, ax: 0, ay: 0.5, draw: FX.drawBeam },
  // telegraphs
  tgDisc: { w: 128, h: 128, draw: FX.drawTgDisc },
  tgEdge: { w: 128, h: 128, draw: FX.drawTgEdge },
  tgBar: { w: 64, h: 16, ax: 0, ay: 0.5, draw: FX.drawTgBar },
  tgBarFill: { w: 64, h: 16, ax: 0, ay: 0.5, draw: FX.drawTgBarFill },
  // decals
  splat0: { w: 64, h: 64, draw: FX.makeSplat(11) },
  splat1: { w: 64, h: 64, draw: FX.makeSplat(23) },
  splat2: { w: 64, h: 64, draw: FX.makeSplat(37) },
  scorch0: { w: 96, h: 96, draw: FX.makeScorch(5) },
  scorch1: { w: 96, h: 96, draw: FX.makeScorch(19) },
  // projectiles
  bullet: { w: 22, h: 22, draw: FX.drawBullet },
  knife: { w: 26, h: 10, draw: FX.drawKnife },
  arrow: { w: 34, h: 10, draw: FX.drawArrow },
  bolt: { w: 46, h: 12, draw: FX.drawBolt },
  sigil: { w: 128, h: 128, draw: FX.drawSigil },

  // ─── player & weapons ───
  player: { w: 46, h: 52, ay: 0.62, draw: CH.drawPlayer, sil: true },
  w_fangs: { w: 34, h: 14, ax: 0.2, draw: CH.drawFangs },
  w_anvil: { w: 46, h: 28, ax: 0.15, draw: CH.drawAnvil },
  w_pike: { w: 64, h: 12, ax: 0.25, draw: CH.drawPike },
  w_bow: { w: 22, h: 44, ax: 0.35, draw: CH.drawBow },
  w_halo: { w: 36, h: 36, draw: CH.drawHalo, sil: true },

  // ─── biome 1 enemies ───
  cinderling: { w: 38, h: 42, ay: 0.55, draw: E1.drawCinderling, sil: true },
  grub: { w: 26, h: 18, draw: E1.drawGrub, sil: true },
};

// damage digits
for (let i = 0; i <= 9; i++) {
  A['d' + i] = { w: 26, h: 36, draw: FX.makeDigit(String(i), false) };
  A['c' + i] = { w: 26, h: 36, draw: FX.makeDigit(String(i), true) };
}
A['d+'] = { w: 26, h: 36, draw: FX.makeDigit('+', false) };
A['c!'] = { w: 20, h: 36, draw: FX.makeDigit('!', true) };

export const ASSETS = A;

/** register extra assets from other modules (keeps this map the single source of truth) */
export function registerAssets(extra: Record<string, AssetSpec>) {
  for (const k in extra) A[k] = extra[k];
}
