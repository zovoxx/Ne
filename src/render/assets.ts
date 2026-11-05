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
import * as IC from './art/icons';
import * as E2 from './art/enemies2';
import * as E3 from './art/enemies3';
import * as E4 from './art/enemies4';

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

  // ─── icons (white, tinted at runtime) ───
  ic_ember: { w: 36, h: 36, draw: IC.icFlame },
  ic_rime: { w: 36, h: 36, draw: IC.icFlake },
  ic_storm: { w: 36, h: 36, draw: IC.icBolt },
  ic_tide: { w: 36, h: 36, draw: IC.icWave },
  ic_dawn: { w: 36, h: 36, draw: IC.icSun },
  ic_umbra: { w: 36, h: 36, draw: IC.icEye },
  ic_gale: { w: 36, h: 36, draw: IC.icSwirl },
  ic_thorn: { w: 36, h: 36, draw: IC.icThorn },
  ic_forge: { w: 36, h: 36, draw: IC.icAnvil },
  ic_kindle: { w: 36, h: 36, draw: IC.icKindle },
  ic_heart: { w: 36, h: 36, draw: IC.icHeart },
  ic_gold: { w: 36, h: 36, draw: IC.icCoin },
  ic_bag: { w: 36, h: 36, draw: IC.icBag },
  ic_drop: { w: 36, h: 36, draw: IC.icDrop },
  ic_die: { w: 36, h: 36, draw: IC.icDie },
  ic_skull: { w: 36, h: 36, draw: IC.icSkull },
  ic_crown: { w: 36, h: 36, draw: IC.icCrown },
  ic_horns: { w: 36, h: 36, draw: IC.icHorns },
  ic_eye: { w: 36, h: 36, draw: IC.icEye },
  ic_sword: { w: 36, h: 36, draw: IC.icSword },
  // pickups / props
  coin: { w: 16, h: 16, draw: IC.drawCoin },
  heart: { w: 20, h: 20, draw: IC.drawHeartPick },
  rewardOrb: { w: 44, h: 44, draw: IC.drawRewardOrb },
  portalRing: { w: 96, h: 96, draw: IC.drawPortalRing },
  pedestal: { w: 64, h: 40, draw: IC.drawPedestal },

  // ─── biome 1 enemies ───
  cinderling: { w: 38, h: 42, ay: 0.55, draw: E1.drawCinderling, sil: true },
  grub: { w: 26, h: 18, draw: E1.drawGrub, sil: true },
  bramblehorn: { w: 72, h: 56, ay: 0.58, draw: E1.drawBramblehorn, sil: true },
  spitbloom: { w: 50, h: 50, draw: E1.drawSpitbloom, sil: true },
  ashwisp: { w: 28, h: 40, ay: 0.42, draw: E1.drawAshwisp, sil: true },
  burrowmaw: { w: 56, h: 56, draw: E1.drawBurrowmaw, sil: true },
  kindlepod: { w: 42, h: 56, ay: 0.58, draw: E1.drawKindlepod, sil: true },
  thornwarden: { w: 70, h: 66, ay: 0.55, draw: E1.drawThornwarden, sil: true },
  grubmother: { w: 64, h: 56, ay: 0.55, draw: E1.drawGrubmother, sil: true },

  // ─── biome 2 ───
  inkshade: { w: 40, h: 50, ay: 0.45, draw: E2.drawInkshade, sil: true },
  lanternist: { w: 48, h: 60, ay: 0.6, draw: E2.drawLanternist, sil: true },
  scribe: { w: 40, h: 46, draw: E2.drawScribe, sil: true },
  tidecleric: { w: 40, h: 54, ay: 0.58, draw: E2.drawTidecleric, sil: true },
  hookjaw: { w: 62, h: 54, ay: 0.56, draw: E2.drawHookjaw, sil: true },
  slurry: { w: 60, h: 56, ay: 0.55, draw: E2.drawSlurry, sil: true },
  echo: { w: 36, h: 46, ay: 0.45, draw: E2.drawEcho, sil: true },
  glimmerjelly: { w: 40, h: 50, ay: 0.4, draw: E2.drawGlimmerjelly, sil: true },

  // ─── biome 3 ───
  rivethound: { w: 52, h: 38, ay: 0.55, draw: E3.drawRivethound, sil: true },
  coilsentry: { w: 36, h: 50, ay: 0.62, draw: E3.drawCoilsentry, sil: true },
  pylon: { w: 22, h: 40, ay: 0.7, draw: E3.drawPylon, sil: true },
  ironclad: { w: 66, h: 66, ay: 0.58, draw: E3.drawIronclad, sil: true },
  forgemortar: { w: 48, h: 54, ay: 0.6, draw: E3.drawForgemortar, sil: true },
  bellwether: { w: 40, h: 56, ay: 0.62, draw: E3.drawBellwether, sil: true },
  gyrosaw: { w: 46, h: 46, draw: E3.drawGyrosaw, sil: true },
  slagcrawler: { w: 54, h: 44, ay: 0.55, draw: E3.drawSlagcrawler, sil: true },
  sparkmite: { w: 22, h: 20, draw: E3.drawSparkmite, sil: true },

  // ─── biome 4 ───
  voidcaller: { w: 50, h: 54, ay: 0.58, draw: E4.drawVoidcaller, sil: true },
  voidportal: { w: 52, h: 52, draw: E4.drawVoidportal, sil: true },
  voidimp: { w: 30, h: 30, draw: E4.drawVoidimp, sil: true },
  mirrorknight: { w: 56, h: 66, ay: 0.58, draw: E4.drawMirrorknight, sil: true },
  gravewell: { w: 48, h: 40, draw: E4.drawGravewell, sil: true },
  prism: { w: 40, h: 54, ay: 0.62, draw: E4.drawPrism, sil: true },
  wraithlancer: { w: 64, h: 54, ay: 0.5, draw: E4.drawWraithlancer, sil: true },
  aegisherald: { w: 60, h: 50, ay: 0.55, draw: E4.drawAegisherald, sil: true },
  hexer: { w: 46, h: 54, ay: 0.58, draw: E4.drawHexer, sil: true },
  nullshard: { w: 36, h: 40, draw: E4.drawNullshard, sil: true },

  // enemy projectiles / props
  seed: { w: 18, h: 18, draw: E2.drawSeed },
  shell: { w: 22, h: 22, draw: E2.drawShell },
  hook: { w: 28, h: 18, draw: E2.drawHook },
  needle: { w: 22, h: 8, draw: E2.drawNeedle },
  mine: { w: 26, h: 26, draw: E2.drawMine },
  shardBlade: { w: 16, h: 24, draw: E2.drawShardBlade },
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
