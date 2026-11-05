import type { EnemyDef } from './enemies/types';

export type Slot = 'attack' | 'special' | 'dash' | 'cast' | 'other';
export type Element = 'ember' | 'rime' | 'storm' | 'tide' | 'dawn' | 'umbra' | 'gale' | 'thorn';

let NEXT_ID = 1;
export const nextId = () => NEXT_ID++;

/** Generic object pool with an active list. Inactive objects are reused; nothing is freed mid-run. */
export class Pool<T extends { active: boolean }> {
  readonly items: T[] = [];
  readonly live: T[] = [];
  constructor(private make: () => T, prewarm = 0) {
    for (let i = 0; i < prewarm; i++) this.items.push(make());
  }
  obtain(): T {
    let o: T | undefined;
    for (let i = 0; i < this.items.length; i++) {
      if (!this.items[i].active) {
        o = this.items[i];
        break;
      }
    }
    if (!o) {
      o = this.make();
      this.items.push(o);
    }
    o.active = true;
    this.live.push(o);
    return o;
  }
  /** Remove inactive objects from the live list (swap-remove, no allocation). */
  compact() {
    const l = this.live;
    let w = 0;
    for (let i = 0; i < l.length; i++) if (l[i].active) l[w++] = l[i];
    l.length = w;
  }
  clear() {
    for (const o of this.live) o.active = false;
    this.live.length = 0;
  }
}

export class Enemy {
  active = false;
  id = 0;
  def!: EnemyDef;
  x = 0;
  y = 0;
  /** previous position (render interpolation / sweep tests) */
  px = 0;
  py = 0;
  /** AI-driven velocity */
  vx = 0;
  vy = 0;
  /** knockback velocity (decays) */
  kx = 0;
  ky = 0;
  r = 16;
  mass = 1;
  hp = 1;
  maxHp = 1;
  armor = 0;
  maxArmor = 0;
  shield = 0;
  maxShield = 0;
  dmgMul = 1;
  speedMul = 1;
  facing = 0;
  /** AI state machine */
  st = 0;
  t = 0;
  a = 0;
  b = 0;
  c = 0;
  d = 0;
  n = 0;
  tx = 0;
  ty = 0;
  cd = 0;
  cd2 = 0;
  cd3 = 0;
  tg: import('./entities').Telegraph | null = null;
  tg2: import('./entities').Telegraph | null = null;
  tg3: import('./entities').Telegraph | null = null;
  link: Enemy | null = null;
  parent: Enemy | null = null;
  children = 0;
  spawnT = 0;
  stun = 0;
  root = 0;
  hitstun = 0;
  invuln = false;
  untargetable = false;
  superArmor = false;
  flying = false;
  /** blocks damage from the front (shielders). Arc in radians, 0 = none */
  frontShield = 0;
  /** reflects/parries (mirror knight stance) */
  parry = false;
  /** visual hint for the renderer: 0 normal, 1 burrowed, 2 phased, 3 spinning */
  visual = 0;
  // statuses
  burn = 0;
  burnTick = 0;
  chill = 0;
  chillDecay = 0;
  freeze = 0;
  jolt = 0;
  hex = 0;
  bleed = 0;
  mark = 0;
  slow = 0;
  slowT = 0;
  // buffs from support enemies
  haste = 0;
  bubble = 0;
  // elite modifiers bitmask
  elite = 0;
  eliteT = 0;
  eliteT2 = 0;
  lastHitT = -99;
  lastHitBy = 0;
  lastDmgNumT = -99;
  lastDmgNum: unknown = null;
  isBoss = false;
  isMini = false;
  phase = 0;
  blocksClear = true;
  summoned = false;
  wave = 0;
  killedBy: Slot = 'other';
  deathPower = 0;
  deathDx = 0;
  deathDy = 0;
  deathCrit = false;
  /** latched-on mites, pulled player, etc. */
  latched = false;
  contactT = 0;
  /** owned by the renderer */
  view: unknown = null;
  /** generic extra data for complex enemies (bosses) */
  data: Record<string, number> = {};

  reset() {
    this.id = nextId();
    this.vx = this.vy = this.kx = this.ky = 0;
    this.armor = this.maxArmor = this.shield = this.maxShield = 0;
    this.dmgMul = this.speedMul = 1;
    this.facing = Math.PI / 2;
    this.st = 0;
    this.t = this.a = this.b = this.c = this.d = this.n = 0;
    this.tx = this.ty = 0;
    this.cd = this.cd2 = this.cd3 = 0;
    this.tg = this.tg2 = this.tg3 = null;
    this.link = this.parent = null;
    this.children = 0;
    this.spawnT = 0;
    this.stun = this.root = this.hitstun = 0;
    this.invuln = this.untargetable = this.superArmor = this.flying = this.parry = false;
    this.frontShield = 0;
    this.visual = 0;
    this.burn = this.burnTick = this.chill = this.chillDecay = this.freeze = this.jolt = this.hex = this.bleed = this.mark = 0;
    this.slow = this.slowT = 0;
    this.haste = this.bubble = 0;
    this.elite = 0;
    this.eliteT = this.eliteT2 = 0;
    this.lastHitT = -99;
    this.lastHitBy = 0;
    this.lastDmgNumT = -99;
    this.lastDmgNum = null;
    this.isBoss = this.isMini = false;
    this.phase = 0;
    this.blocksClear = true;
    this.summoned = false;
    this.wave = 0;
    this.killedBy = 'other';
    this.deathPower = this.deathDx = this.deathDy = 0;
    this.deathCrit = false;
    this.latched = false;
    this.contactT = 0;
    this.data = {};
  }

  get targetable() {
    return this.active && this.spawnT <= 0 && !this.untargetable && this.hp > 0;
  }
  get stunned() {
    return this.stun > 0 || this.freeze > 0 || this.hitstun > 0;
  }
}

export const TEAM_PLAYER = 0;
export const TEAM_ENEMY = 1;

export class Projectile {
  active = false;
  id = 0;
  team = TEAM_ENEMY;
  kind = 0;
  art = 'bullet';
  x = 0;
  y = 0;
  px = 0;
  py = 0;
  vx = 0;
  vy = 0;
  r = 6;
  life = 1;
  maxLife = 1;
  dmg = 5;
  power = 0.2;
  knock = 0.5;
  pierce = 0;
  hits: number[] = [];
  owner: Enemy | null = null;
  slot: Slot = 'attack';
  // lobbed projectile
  lob = false;
  sx = 0;
  sy = 0;
  tx = 0;
  ty = 0;
  lt = 0;
  ldur = 1;
  height = 0;
  z = 0;
  homing = 0;
  speed = 0;
  bounces = 0;
  rot = 0;
  spin = 0;
  color = 0xffffff;
  scale = 1;
  crit = false;
  reflectable = true;
  reflected = false;
  /** generic scratch */
  a = 0;
  b = 0;
  c = 0;
  st = 0;
  ref: unknown = null;
  view: unknown = null;

  reset() {
    this.id = nextId();
    this.vx = this.vy = 0;
    this.hits.length = 0;
    this.owner = null;
    this.lob = false;
    this.lt = 0;
    this.z = 0;
    this.height = 0;
    this.homing = 0;
    this.bounces = 0;
    this.rot = 0;
    this.spin = 0;
    this.pierce = 0;
    this.color = 0xffffff;
    this.scale = 1;
    this.crit = false;
    this.reflectable = true;
    this.reflected = false;
    this.a = this.b = this.c = 0;
    this.st = 0;
    this.ref = null;
    this.knock = 0.5;
    this.power = 0.2;
    this.slot = 'attack';
  }
}

export const HZ = {
  Fire: 1,
  Slag: 2,
  Ink: 3,
  Fence: 4,
  Well: 5,
  Mine: 6,
  Sigil: 7,
  Beam: 8,
  Tether: 9,
  Cloud: 10,
  Wind: 11,
  Bramble: 12,
  Pulse: 13,
  Void: 14,
  Ring: 15,
  Frost: 16,
  Storm: 17,
  Radiance: 18,
  Hex: 19,
  Vortex: 20,
} as const;

export class Hazard {
  active = false;
  id = 0;
  kind = 0;
  team = TEAM_ENEMY;
  x = 0;
  y = 0;
  x2 = 0;
  y2 = 0;
  r = 30;
  w = 10;
  angle = 0;
  life = 1;
  maxLife = 1;
  armT = 0;
  tick = 0.5;
  tickT = 0;
  dmg = 4;
  power = 0.2;
  color = 0xff8a3d;
  owner: Enemy | null = null;
  linkA: Enemy | null = null;
  linkB: Enemy | null = null;
  a = 0;
  b = 0;
  c = 0;
  st = 0;
  hits: number[] = [];
  view: unknown = null;
  reset() {
    this.id = nextId();
    this.owner = this.linkA = this.linkB = null;
    this.armT = 0;
    this.tickT = 0;
    this.a = this.b = this.c = 0;
    this.st = 0;
    this.angle = 0;
    this.hits.length = 0;
    this.power = 0.2;
  }
}

export const TG = { Circle: 0, Line: 1, Cone: 2, Ring: 3 } as const;

export class Telegraph {
  active = false;
  id = 0;
  shape = 0;
  x = 0;
  y = 0;
  angle = 0;
  len = 100;
  width = 30;
  radius = 50;
  inner = 0;
  arc = 1;
  t = 0;
  dur = 1;
  color = 0xff3b4a;
  /** if > 0 the telegraph auto-expires after dur + linger */
  linger = 0;
  owner: Enemy | null = null;
  /** "locked" telegraphs flash brighter — the attack is committed */
  locked = false;
  view: unknown = null;
  reset() {
    this.id = nextId();
    this.t = 0;
    this.owner = null;
    this.locked = false;
    this.inner = 0;
    this.linger = 0;
    this.color = 0xff3b4a;
  }
  get progress() {
    return this.dur > 0 ? Math.min(1, this.t / this.dur) : 1;
  }
}

export const HB = { Arc: 0, Rect: 1, Circle: 2 } as const;

/** A player attack volume. */
export class Hitbox {
  active = false;
  id = 0;
  slot: Slot = 'attack';
  shape = 0;
  x = 0;
  y = 0;
  angle = 0;
  range = 60;
  arc = 1;
  len = 100;
  width = 30;
  radius = 50;
  follow = true;
  offset = 0;
  dmg = 10;
  power = 0.3;
  knock = 1;
  critBonus = 0;
  armorMul = 1;
  life = 0.05;
  /** re-hit the same enemy after this interval (0 = once) */
  rehit = 0;
  hits: number[] = [];
  hitTimes: number[] = [];
  tip = 0;
  finisher = false;
  combo = 0;
  /** bitflags: 1 = can backstab, 2 = launches, 4 = no hitstop */
  flags = 0;
  ref: unknown = null;
  reset() {
    this.id = nextId();
    this.hits.length = 0;
    this.hitTimes.length = 0;
    this.critBonus = 0;
    this.armorMul = 1;
    this.rehit = 0;
    this.tip = 0;
    this.finisher = false;
    this.flags = 0;
    this.offset = 0;
    this.follow = true;
    this.ref = null;
  }
}

/** Enemies killed by heavy hits become flying corpses that slam into other enemies. */
export class Corpse {
  active = false;
  id = 0;
  def!: EnemyDef;
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  r = 14;
  rot = 0;
  spin = 0;
  life = 0.45;
  dmg = 10;
  hits: number[] = [];
  elite = 0;
  scale = 1;
  view: unknown = null;
  reset() {
    this.id = nextId();
    this.hits.length = 0;
    this.rot = 0;
    this.elite = 0;
    this.scale = 1;
  }
}

export const PK = { Gold: 1, Heal: 2, Reward: 3, Ember: 4, ShopItem: 5 } as const;

export class Pickup {
  active = false;
  id = 0;
  kind = 1;
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  value = 1;
  t = 0;
  magnet = false;
  ref: unknown = null;
  view: unknown = null;
  reset() {
    this.id = nextId();
    this.t = 0;
    this.magnet = false;
    this.vx = this.vy = 0;
    this.ref = null;
  }
}
