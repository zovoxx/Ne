import { Enemy, HZ, TEAM_ENEMY } from '../entities';
import type { Game } from '../game';
import type { Effects } from '../effects';
import { addHazard } from '../hazards';
import { fireEnemy, PJ } from '../projectiles';
import { EV } from '../events';
import { TUNING } from '../../config/tuning';
import { TAU } from '../math';

/** Elite modifiers — bit flags so any combination works on any enemy. */
export const ELITE = {
  HASTE: 1,
  SHIELDED: 2,
  VOLATILE: 4,
  BLAZING: 8,
  VAMPIRIC: 16,
  SPLITTING: 32,
  HULKING: 64,
  BLINKING: 128,
  ORBITING: 256,
  MENDING: 512,
} as const;

export const ELITE_INFO: { bit: number; name: string; color: number; desc: string }[] = [
  { bit: ELITE.HASTE, name: 'Hasted', color: 0x8dffc8, desc: 'Moves and attacks 45% faster.' },
  { bit: ELITE.SHIELDED, name: 'Shielded', color: 0x7fe3ff, desc: 'Regenerating shield must be broken first.' },
  { bit: ELITE.VOLATILE, name: 'Volatile', color: 0xff7a2a, desc: 'Explodes shortly after death.' },
  { bit: ELITE.BLAZING, name: 'Blazing', color: 0xff4a2a, desc: 'Leaves a trail of fire.' },
  { bit: ELITE.VAMPIRIC, name: 'Vampiric', color: 0xff3d6e, desc: 'Heals greatly when it hurts you.' },
  { bit: ELITE.SPLITTING, name: 'Brood', color: 0xc9ff6a, desc: 'Splits into two lesser copies on death.' },
  { bit: ELITE.HULKING, name: 'Hulking', color: 0xffd166, desc: 'Huge, tough and barely flinches.' },
  { bit: ELITE.BLINKING, name: 'Blinking', color: 0xd45cff, desc: 'Teleports away when struck.' },
  { bit: ELITE.ORBITING, name: 'Orbiting', color: 0xfff1a6, desc: 'Ringed by orbiting blades.' },
  { bit: ELITE.MENDING, name: 'Mending', color: 0x5dff9a, desc: 'Regenerates when left alone.' },
];

export function eliteName(mask: number) {
  return ELITE_INFO.filter((i) => mask & i.bit)
    .map((i) => i.name)
    .join(' ');
}

/** which modifiers can appear (meta "deepening" unlocks more) */
export const ELITE_POOL = { bits: [ELITE.HASTE, ELITE.SHIELDED, ELITE.VOLATILE, ELITE.BLAZING, ELITE.HULKING, ELITE.VAMPIRIC, ELITE.MENDING] as number[] };

export function rollElite(g: Game, count: number): number {
  let mask = 0;
  const pool = ELITE_POOL.bits.slice();
  for (let i = 0; i < count && pool.length; i++) {
    const b = g.rng.pick(pool);
    mask |= b;
    pool.splice(pool.indexOf(b), 1);
  }
  return mask;
}

function applyElite(g: Game, e: Enemy, mask: number) {
  if (e.def.noElite) return;
  e.elite = mask;
  const S = TUNING.scaling;
  e.maxHp = e.hp = Math.round(e.maxHp * S.eliteHp);
  e.dmgMul *= S.eliteDmg;
  const first = ELITE_INFO.find((i) => mask & i.bit);
  e.data.eliteColor = first ? first.color : 0xffd166;
  if (mask & ELITE.HASTE) e.speedMul *= 1.45;
  if (mask & ELITE.SHIELDED) e.shield = e.maxShield = Math.round(e.maxHp * 0.4);
  if (mask & ELITE.HULKING) {
    e.maxHp = e.hp = Math.round(e.maxHp * 1.6);
    e.r *= 1.3;
    e.mass *= 3;
    e.dmgMul *= 1.15;
    e.superArmor = true;
  }
  if (mask & ELITE.ORBITING) {
    for (let i = 0; i < 3; i++) {
      const p = fireEnemy(g, null, PJ.Spark, e.x, e.y, 0, 0, 6 * e.dmgMul, 9, 'shardBlade', 0xfff1a6);
      p.owner = e;
      p.life = p.maxLife = 9999;
      p.pierce = 9999;
      p.reflectable = false;
      p.a = (i / 3) * TAU;
      p.st = 7; // orbiting marker
      p.ref = e;
    }
  }
}

function updateElite(g: Game, e: Enemy, dt: number) {
  const m = e.elite;
  if (m & ELITE.SHIELDED && e.shield < e.maxShield) {
    e.eliteT2 -= dt;
    if (e.eliteT2 <= 0) e.shield = Math.min(e.maxShield, e.shield + e.maxShield * dt * 0.35);
  }
  if (m & ELITE.BLAZING) {
    e.eliteT -= dt;
    if (e.eliteT <= 0 && Math.hypot(e.vx, e.vy) > 30) {
      e.eliteT = 0.28;
      const h = addHazard(g, HZ.Fire, TEAM_ENEMY, e.x, e.y + e.r * 0.3, 22, 2.4, 5, 0xff4a2a, e);
      h.armT = 0.3;
    }
  }
  if (m & ELITE.MENDING && g.time - e.lastHitT > 2 && e.hp < e.maxHp) {
    e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.04 * dt);
  }
  if (m & ELITE.BLINKING) e.eliteT2 -= dt;
  if (m & ELITE.BLINKING && e.lastHitT > g.time - dt * 1.5 && e.eliteT2 <= 0 && e.hp > 0 && !e.untargetable) {
    e.eliteT2 = 2.2;
    const pt = g.freePointNear(e.x, e.y, 180, 280, e.r);
    const a = g.events.push(EV.Teleport, e.x, e.y);
    a.color = 0xd45cff;
    e.x = e.px = pt.x;
    e.y = e.py = pt.y;
    const b = g.events.push(EV.Teleport, e.x, e.y);
    b.color = 0xd45cff;
    g.clearTelegraphs(e);
    e.st = 0;
    e.t = 0;
  }
}

/** orbiting blades follow their owner (called from projectile ownership each frame) */
export function updateOrbiters(g: Game, dt: number) {
  for (const p of g.projectiles.live) {
    if (!p.active || p.st !== 7) continue;
    const e = p.ref as Enemy | null;
    if (!e || !e.active) {
      p.active = false;
      continue;
    }
    p.a += dt * 3.2;
    const r = e.r + 34;
    p.x = e.x + Math.cos(p.a) * r;
    p.y = e.y + Math.sin(p.a) * r;
    p.vx = -Math.sin(p.a) * 0.001;
    p.vy = Math.cos(p.a) * 0.001;
    p.rot = p.a * 2;
    p.life = 9999;
  }
}

function eliteDeath(g: Game, e: Enemy) {
  const m = e.elite;
  if (m & ELITE.VOLATILE) {
    const h = addHazard(g, HZ.Mine, TEAM_ENEMY, e.x, e.y, 95, 1, 16 * e.dmgMul, 0xff7a2a, null);
    h.st = 1;
    h.a = 0.7;
    const t = g.telegraph(0, e.x, e.y, 0.7, null);
    t.radius = 95;
    t.color = 0xff7a2a;
    t.linger = 0.01;
  }
  if (m & ELITE.SPLITTING && !e.data.splitChild) {
    for (let i = 0; i < 2; i++) {
      const a = i * Math.PI + g.rng.range(0, 1);
      const c = g.spawnEnemy(e.def, e.x + Math.cos(a) * 20, e.y + Math.sin(a) * 20, { portal: false, summoned: true, hpMul: 0.45 });
      c.data.splitChild = 1;
      c.kx = Math.cos(a) * 320;
      c.ky = Math.sin(a) * 320;
      c.spawnT = 0.15;
    }
  }
}

export function installElites(fx: Effects) {
  fx.eliteApply = applyElite;
  fx.eliteUpdate = updateElite;
  fx.eliteDeath = eliteDeath;
}
