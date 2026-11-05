import { TUNING } from '../config/tuning';
import { Corpse, Enemy, Hazard, Hitbox, HZ, Pickup, Pool, Projectile, Telegraph, TEAM_PLAYER, type Slot } from './entities';
import { EV, EventQueue } from './events';
import { clamp, lerp, RNG } from './math';
import { InputFrame, Player, recordInput, updatePlayer } from './player';
import { Stats } from './stats';
import type { EnemyDef } from './enemies/types';
import type { ActionSpec, Weapon } from './weapons/types';
import { updateHitboxes, tickEnemyStatus, killEnemy, updateCorpses } from './combat';
import { updateProjectiles } from './projectiles';
import { updateHazards } from './hazards';
import { Effects } from './effects';

export interface Pillar {
  x: number;
  y: number;
  r: number;
}
export interface Arena {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  pillars: Pillar[];
  /** hazard pits (circles) that damage on touch — optional */
  pits: Pillar[];
  style: number;
}

/** Room behaviour plug-in (waves, doors, rewards) — implemented in room.ts */
export interface RoomLogic {
  update(g: Game, dt: number): void;
  onEnemyKilled(g: Game, e: Enemy): void;
}

export type Mode = 'play' | 'choice' | 'transition' | 'dying' | 'dead' | 'victory' | 'menu';

export class Game {
  rng = new RNG(Date.now() & 0xffffffff);
  events = new EventQueue(1024);
  player = new Player();
  stats = new Stats();
  effects = new Effects();
  enemies = new Pool(() => new Enemy(), 64);
  projectiles = new Pool(() => new Projectile(), 128);
  hazards = new Pool(() => new Hazard(), 48);
  telegraphs = new Pool(() => new Telegraph(), 48);
  hitboxes = new Pool(() => new Hitbox(), 16);
  corpses = new Pool(() => new Corpse(), 16);
  pickups = new Pool(() => new Pickup(), 32);
  arena: Arena = { x0: -650, y0: -400, x1: 650, y1: 400, pillars: [], pits: [], style: 0 };
  room: RoomLogic | null = null;
  input = new InputFrame();
  mode: Mode = 'menu';
  biome = 0;
  /** simulation time (frozen during hit stop) */
  time = 0;
  /** real elapsed time */
  realTime = 0;
  /** last frame's simulation delta (0 during hit stop) */
  simDt = 0;
  /** FX should advance at this multiple of real time */
  fxScale = 1;
  hitstopT = 0;
  private hsUsed = 0;
  private lastHitstopEnd = -99;
  private slowScale = 1;
  private slowT = 0;
  private slowDur = 0;
  // streak
  streak = 0;
  streakT = 0;
  streakTier = 0;
  bestStreak = 0;
  // camera hints (presentation reads these)
  zoomPunch = 0;
  lastKillX = 0;
  lastKillY = 0;
  // bookkeeping
  kills = 0;
  gold = 0;
  /** headless mode: the bot runs without presentation */
  headless = false;
  castAction: ActionSpec;
  weapon!: Weapon;
  /** called by the room/run layer */
  hooks: {
    onPlayerDeath?: (g: Game) => void;
    onStreakEnd?: (g: Game, count: number, tier: number) => void;
  } = {};

  constructor() {
    const g = this;
    this.castAction = {
      id: 'cast',
      kind: 'cast',
      windup: 0.05,
      active: 0.02,
      recovery: 0.1,
      moveMul: 0.7,
      chainAt: 0.2,
      active_(game, p) {
        g.throwSigil();
      },
    };
  }

  // ───────────────────────── main loop ─────────────────────────

  /** set by debug tools: report the first system that produces a non-finite player position */
  nanCheck = false;

  update(realDt: number) {
    if (!(realDt > 0)) return;
    realDt = Math.min(realDt, 1 / 20);
    this.realTime += realDt;
    const p = this.player;
    recordInput(this, p, this.input);
    this.input.clearPressed();
    this.hsUsed = Math.max(0, this.hsUsed - realDt * TUNING.hitstop.budgetPerSecond);
    if (this.mode !== 'play' && this.mode !== 'dying') {
      this.simDt = 0;
      this.fxScale = this.mode === 'transition' ? 1 : 0.0;
      if (this.mode === 'transition') this.room?.update(this, realDt);
      return;
    }
    let scale = 1;
    if (this.slowT > 0) {
      this.slowT -= realDt;
      const k = 1 - Math.max(0, this.slowT) / this.slowDur; // 0 → 1 over the slowmo
      const easeStart = 1 - TUNING.slowmo.easeOut;
      scale = k < easeStart ? this.slowScale : lerp(this.slowScale, 1, (k - easeStart) / TUNING.slowmo.easeOut);
      if (this.slowT <= 0) scale = 1;
    }
    this.zoomPunch = Math.max(0, this.zoomPunch - realDt * TUNING.view.zoomPunchDecay * this.zoomPunch - realDt * 0.01);
    if (this.hitstopT > 0) {
      this.hitstopT -= realDt;
      if (this.hitstopT <= 0) this.lastHitstopEnd = this.realTime;
      this.simDt = 0;
      this.fxScale = TUNING.hitstop.fxSpeedDuringStop;
      return;
    }
    let simDt = realDt * scale;
    this.simDt = simDt;
    this.fxScale = scale;
    const steps = Math.min(3, Math.max(1, Math.ceil(simDt / (1 / 60) - 0.01)));
    const h = simDt / steps;
    for (let i = 0; i < steps; i++) {
      this.step(h);
      if (this.hitstopT > 0) break;
      if (this.mode !== 'play' && this.mode !== 'dying') break;
    }
  }

  private chk(stage: string) {
    const p = this.player;
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.vx)) {
      console.error('[nan] player became non-finite after', stage, { x: p.x, y: p.y, vx: p.vx, vy: p.vy, act: p.act?.id, angle: p.actAngle });
      this.nanCheck = false;
    }
  }

  step(dt: number) {
    this.time += dt;
    const p = this.player;
    const C = this.nanCheck;
    updatePlayer(this, p, dt, this.input);
    if (C) this.chk('player');
    this.weapon.update?.(this, p, dt);
    updateHitboxes(this, dt);
    this.updateEnemies(dt);
    if (C) this.chk('enemies');
    updateProjectiles(this, dt);
    updateHazards(this, dt);
    updateCorpses(this, dt);
    this.updateTelegraphs(dt);
    this.updatePickups(dt);
    this.physics(dt);
    if (C) this.chk('physics');
    this.effects.update(this, dt);
    this.room?.update(this, dt);
    this.updateStreak(dt);
    if (C) this.chk('room');
    // hard safety net: never let a NaN freeze the run
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
      p.x = Number.isFinite(p.px) ? p.px : 0;
      p.y = Number.isFinite(p.py) ? p.py : 0;
      p.vx = p.vy = 0;
    }
    this.enemies.compact();
    this.projectiles.compact();
    this.hazards.compact();
    this.telegraphs.compact();
    this.hitboxes.compact();
    this.corpses.compact();
    this.pickups.compact();
  }

  // ───────────────────────── time control ─────────────────────────

  requestHitstop(power: number, crit: boolean, kill: boolean) {
    if (this.headless) return;
    const H = TUNING.hitstop;
    if (this.hitstopT <= 0 && this.realTime - this.lastHitstopEnd < H.cooldown) return;
    let d = lerp(H.min, H.max, clamp(power, 0, 1)) + (crit ? H.critBonus : 0) + (kill ? H.killBonus : 0);
    const room = H.budgetPerSecond - this.hsUsed;
    if (d > room) d = Math.max(0, room);
    if (d < 0.02) return;
    if (this.hitstopT > 0) {
      if (d > this.hitstopT) {
        this.hsUsed += d - this.hitstopT;
        this.hitstopT = d;
      }
    } else {
      this.hitstopT = d;
      this.hsUsed += d;
    }
  }

  slowmo(scale: number, duration: number) {
    if (this.slowT > 0 && this.slowScale < scale) return;
    this.slowScale = scale;
    this.slowT = duration;
    this.slowDur = duration;
  }

  get timeScale() {
    return this.hitstopT > 0 ? 0 : this.fxScale;
  }

  // ───────────────────────── enemies ─────────────────────────

  spawnEnemy(def: EnemyDef, x: number, y: number, opts?: { portal?: boolean; elite?: number; hpMul?: number; summoned?: boolean; parent?: Enemy | null }) {
    const e = this.enemies.obtain();
    e.reset();
    e.def = def;
    e.x = e.px = x;
    e.y = e.py = y;
    const S = TUNING.scaling;
    const hpMul = (S.hpByBiome[Math.min(3, this.biome)] ?? 1) * (opts?.hpMul ?? 1);
    e.maxHp = e.hp = Math.round(def.hp * hpMul);
    e.dmgMul = S.dmgByBiome[Math.min(3, this.biome)] ?? 1;
    e.r = def.radius;
    e.mass = def.mass;
    e.flying = !!def.flying;
    e.superArmor = !!def.superArmor;
    e.frontShield = def.frontShield ?? 0;
    if (def.armor) e.armor = e.maxArmor = Math.round(def.armor * hpMul);
    e.summoned = !!opts?.summoned;
    e.parent = opts?.parent ?? null;
    e.blocksClear = !def.optional;
    const p = this.player;
    e.facing = Math.atan2(p.y - y, p.x - x);
    e.cd = this.rng.range(0.1, 0.5);
    if (opts?.portal !== false) {
      e.spawnT = TUNING.pacing.spawnTelegraph * (opts?.summoned ? 0.6 : 1);
      const ev = this.events.push(EV.SpawnPortal, x, y);
      ev.amount = e.r;
      ev.ref = e;
      ev.color = def.blood;
    }
    def.init?.(e, this);
    if (opts?.elite) this.effects.applyElite(this, e, opts.elite);
    return e;
  }

  removeEnemy(e: Enemy) {
    if (!e.active) return;
    e.def.onRemove?.(e, this);
    this.clearTelegraphs(e);
    e.active = false;
  }

  clearTelegraphs(e: Enemy) {
    if (e.tg) e.tg.active = false;
    if (e.tg2) e.tg2.active = false;
    if (e.tg3) e.tg3.active = false;
    e.tg = e.tg2 = e.tg3 = null;
    // also any telegraph owned by this enemy
    for (const t of this.telegraphs.live) if (t.owner === e) t.active = false;
  }

  /** stagger: cancel a non-committed attack and restart the AI */
  interrupt(e: Enemy) {
    if (e.superArmor || e.def.staggerImmune) return;
    this.clearTelegraphs(e);
    e.st = 0;
    e.t = 0;
  }

  private updateEnemies(dt: number) {
    const list = this.enemies.live;
    const p = this.player;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.active) continue;
      e.px = e.x;
      e.py = e.y;
      if (e.spawnT > 0) {
        e.spawnT -= dt;
        if (e.spawnT <= 0) {
          const ev = this.events.push(EV.Spawned, e.x, e.y);
          ev.ref = e;
          ev.amount = e.r;
        }
        continue;
      }
      tickEnemyStatus(this, e, dt);
      if (!e.active || e.hp <= 0) continue;
      if (e.hitstun > 0) e.hitstun -= dt;
      if (e.stun > 0) e.stun -= dt;
      if (e.root > 0) e.root -= dt;
      if (e.freeze > 0) e.freeze -= dt;
      if (e.haste > 0) e.haste -= dt;
      if (e.contactT > 0) e.contactT -= dt;
      const disabled = e.stun > 0 || e.freeze > 0 || e.hitstun > 0;
      if (disabled) {
        e.vx *= 0.8;
        e.vy *= 0.8;
      } else {
        const slow = Math.min(0.75, e.chill * this.stats.chillPerStack + (e.slowT > 0 ? e.slow : 0));
        const speed = (1 - slow) * (e.haste > 0 ? 1.4 : 1) * e.speedMul;
        e.t += dt * speed;
        e.def.update(e, this, dt * speed);
        if (!e.active) continue;
        if (e.root > 0) {
          e.vx = 0;
          e.vy = 0;
        }
      }
      if (e.slowT > 0) e.slowT -= dt;
      this.effects.updateElite(this, e, dt);
      // contact damage
      if (e.def.contact > 0 && e.contactT <= 0 && !disabled && !e.untargetable && !p.dashing) {
        const rr = e.r + p.r - 4;
        const dx = p.x - e.x;
        const dy = p.y - e.y;
        if (dx * dx + dy * dy < rr * rr) {
          if (this.hurtPlayer(e.def.contact * e.dmgMul, e.x, e.y, e)) e.contactT = 0.8;
        }
      }
    }
  }

  // ───────────────────────── physics ─────────────────────────

  private physics(dt: number) {
    const list = this.enemies.live;
    const fr = Math.exp(-TUNING.knockback.friction * dt);
    const p = this.player;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.active) continue;
      const mv = e.root > 0 || e.freeze > 0 ? 0 : 1;
      e.x += (e.vx * mv + e.kx) * dt;
      e.y += (e.vy * mv + e.ky) * dt;
      const kspeed = Math.hypot(e.kx, e.ky);
      e.kx *= fr;
      e.ky *= fr;
      const hitWall = this.collideArena(e, e.r, e.flying || e.untargetable);
      if (hitWall && kspeed > TUNING.knockback.slamSpeed && e.spawnT <= 0) this.effects.onWallSlam(this, e, kspeed);
    }
    // enemy separation
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (!a.active || a.untargetable || a.spawnT > 0) continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (!b.active || b.untargetable || b.spawnT > 0 || a.flying !== b.flying) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const rr = a.r + b.r;
        const d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr || d2 < 0.0001) continue;
        const d = Math.sqrt(d2);
        const pen = (rr - d) * 0.5;
        const nx = dx / d;
        const ny = dy / d;
        const ma = a.def.noKnock ? 8 : a.mass;
        const mb = b.def.noKnock ? 8 : b.mass;
        const wa = mb / (ma + mb);
        const wb = ma / (ma + mb);
        a.x -= nx * pen * wa * 2;
        a.y -= ny * pen * wa * 2;
        b.x += nx * pen * wb * 2;
        b.y += ny * pen * wb * 2;
        // knockback transfer: an enemy flung into another shoves it
        const ka = a.kx * nx + a.ky * ny;
        if (ka > 250) {
          b.kx += nx * ka * 0.5;
          b.ky += ny * ka * 0.5;
        }
      }
      // player body: enemies yield to the player (keeps control), heavy ones push back
      if (!p.dashing && !p.dead && !a.flying) {
        const dx = a.x - p.x;
        const dy = a.y - p.y;
        const rr = a.r + p.r - 2;
        const d2 = dx * dx + dy * dy;
        if (d2 < rr * rr && d2 > 0.0001) {
          const d = Math.sqrt(d2);
          const pen = rr - d;
          const nx = dx / d;
          const ny = dy / d;
          const heavy = a.def.noKnock || a.mass >= 3;
          const wp = heavy ? 0.7 : 0.25;
          p.x -= nx * pen * wp;
          p.y -= ny * pen * wp;
          a.x += nx * pen * (1 - wp);
          a.y += ny * pen * (1 - wp);
        }
      }
    }
  }

  /** Keeps a circle inside the arena and out of pillars. Returns true if it touched a wall. */
  collideArena(o: { x: number; y: number }, r: number, ignorePillars: boolean): boolean {
    const A = this.arena;
    let hit = false;
    if (o.x < A.x0 + r) {
      o.x = A.x0 + r;
      hit = true;
    } else if (o.x > A.x1 - r) {
      o.x = A.x1 - r;
      hit = true;
    }
    if (o.y < A.y0 + r) {
      o.y = A.y0 + r;
      hit = true;
    } else if (o.y > A.y1 - r) {
      o.y = A.y1 - r;
      hit = true;
    }
    if (!ignorePillars) {
      for (let i = 0; i < A.pillars.length; i++) {
        const pl = A.pillars[i];
        const dx = o.x - pl.x;
        const dy = o.y - pl.y;
        const rr = pl.r + r;
        const d2 = dx * dx + dy * dy;
        if (d2 < rr * rr) {
          const d = Math.sqrt(d2) || 1;
          o.x = pl.x + (dx / d) * rr;
          o.y = pl.y + (dy / d) * rr;
          hit = true;
        }
      }
    }
    return hit;
  }

  insideArena(x: number, y: number, margin = 0) {
    const A = this.arena;
    return x > A.x0 + margin && x < A.x1 - margin && y > A.y0 + margin && y < A.y1 - margin;
  }

  pointBlocked(x: number, y: number, r: number) {
    if (!this.insideArena(x, y, r)) return true;
    for (const pl of this.arena.pillars) {
      const dx = x - pl.x;
      const dy = y - pl.y;
      if (dx * dx + dy * dy < (pl.r + r) * (pl.r + r)) return true;
    }
    return false;
  }

  /** first pillar hit along a segment (line of sight). */
  segmentBlocked(ax: number, ay: number, bx: number, by: number) {
    for (const pl of this.arena.pillars) {
      const abx = bx - ax;
      const aby = by - ay;
      const l2 = abx * abx + aby * aby || 1;
      let t = ((pl.x - ax) * abx + (pl.y - ay) * aby) / l2;
      t = clamp(t, 0, 1);
      const cx = ax + abx * t - pl.x;
      const cy = ay + aby * t - pl.y;
      if (cx * cx + cy * cy < pl.r * pl.r) return true;
    }
    return false;
  }

  /** a random free point near (x,y) between minD and maxD */
  freePointNear(x: number, y: number, minD: number, maxD: number, r = 20, tries = 14): { x: number; y: number } {
    for (let i = 0; i < tries; i++) {
      const a = this.rng.range(0, Math.PI * 2);
      const d = this.rng.range(minD, maxD);
      const px = x + Math.cos(a) * d;
      const py = y + Math.sin(a) * d;
      if (!this.pointBlocked(px, py, r + 6)) return { x: px, y: py };
    }
    const A = this.arena;
    return { x: clamp(x, A.x0 + r + 10, A.x1 - r - 10), y: clamp(y + minD, A.y0 + r + 10, A.y1 - r - 10) };
  }

  // ───────────────────────── telegraphs ─────────────────────────

  telegraph(shape: number, x: number, y: number, dur: number, owner: Enemy | null): Telegraph {
    const t = this.telegraphs.obtain();
    t.reset();
    t.shape = shape;
    t.x = x;
    t.y = y;
    t.dur = dur;
    t.owner = owner;
    return t;
  }

  private updateTelegraphs(dt: number) {
    for (const t of this.telegraphs.live) {
      if (!t.active) continue;
      t.t += dt;
      if (t.owner && !t.owner.active) t.active = false;
      if (t.linger > 0 && t.t > t.dur + t.linger) t.active = false;
    }
  }

  // ───────────────────────── player damage ─────────────────────────

  /** returns true if damage was applied */
  hurtPlayer(amount: number, sx: number, sy: number, src: Enemy | null): boolean {
    const p = this.player;
    if (this.mode !== 'play' || p.invulnerable || amount <= 0) return false;
    if (this.stats.dodge > 0 && this.rng.chance(this.stats.dodge)) {
      const ev = this.events.push(EV.Text, p.x, p.y - 30);
      ev.key = 'DODGE';
      p.hurtT = 0.25;
      return false;
    }
    const dmg = Math.max(1, Math.round(amount * (1 + this.stats.damageTaken)));
    const absorbed = this.effects.beforePlayerHurt(this, dmg, src);
    const final = dmg - absorbed;
    if (final <= 0) return false;
    p.hp -= final;
    p.damageTaken += final;
    p.hurtT = TUNING.player.hurtIframes;
    p.hurtLock = TUNING.player.hurtLock;
    p.lastHurtT = this.time;
    let dx = p.x - sx;
    let dy = p.y - sy;
    const d = Math.hypot(dx, dy) || 1;
    dx /= d;
    dy /= d;
    if (p.pullT <= 0) {
      p.vx = dx * TUNING.player.hurtKnock;
      p.vy = dy * TUNING.player.hurtKnock;
    }
    const ev = this.events.push(EV.PlayerHurt, p.x, p.y);
    ev.dx = dx;
    ev.dy = dy;
    ev.amount = final;
    ev.ref = src;
    if (!this.headless) {
      this.hitstopT = Math.max(this.hitstopT, TUNING.player.hurtHitstop);
    }
    this.effects.onPlayerHurt(this, final, src);
    if (p.hp <= 0) {
      if (p.deathDefiance > 0) {
        p.deathDefiance--;
        p.hp = Math.round(p.maxHp * 0.4);
        p.hurtT = 2;
        const ev2 = this.events.push(EV.DeathDefy, p.x, p.y);
        ev2.amount = p.deathDefiance;
        // shockwave clears space
        for (const e of this.enemies.live) {
          if (!e.active) continue;
          const ex = e.x - p.x;
          const ey = e.y - p.y;
          const dd = Math.hypot(ex, ey) || 1;
          if (dd < 260 && !e.def.noKnock) {
            e.kx += (ex / dd) * 900;
            e.ky += (ey / dd) * 900;
            e.stun = Math.max(e.stun, 0.8);
          }
        }
        for (const pr of this.projectiles.live) if (pr.team !== TEAM_PLAYER) pr.active = false;
      } else {
        p.hp = 0;
        p.dead = true;
        this.mode = 'dying';
        this.slowmo(TUNING.slowmo.deathScale, TUNING.slowmo.deathDuration);
        this.events.push(EV.PlayerDeath, p.x, p.y);
        this.hooks.onPlayerDeath?.(this);
      }
    }
    return true;
  }

  healPlayer(amount: number) {
    const p = this.player;
    if (p.dead) return 0;
    const before = p.hp;
    p.hp = Math.min(p.maxHp, p.hp + Math.round(amount));
    const healed = p.hp - before;
    if (healed > 0) {
      const ev = this.events.push(EV.Heal, p.x, p.y);
      ev.amount = healed;
    }
    return healed;
  }

  // ───────────────────────── streak ─────────────────────────

  addStreak() {
    const S = TUNING.streak;
    this.streak++;
    this.bestStreak = Math.max(this.bestStreak, this.streak);
    let tier = 0;
    for (let i = 0; i < S.tiers.length; i++) if (this.streak >= S.tiers[i]) tier = i + 1;
    if (tier > this.streakTier) {
      this.streakTier = tier;
      const ev = this.events.push(EV.StreakTier, this.player.x, this.player.y);
      ev.n = tier;
      ev.key = S.names[tier];
      ev.color = S.colors[tier];
    }
    this.streakT = S.window + S.windowPerTier * this.streakTier;
    this.gold += S.goldPerKill[this.streakTier];
  }

  get streakWindow() {
    const S = TUNING.streak;
    return S.window + S.windowPerTier * this.streakTier;
  }

  private updateStreak(dt: number) {
    if (this.streak <= 0) return;
    this.streakT -= dt;
    if (this.streakT <= 0) this.endStreak();
  }

  endStreak() {
    if (this.streak <= 0) return;
    const ev = this.events.push(EV.StreakEnd, this.player.x, this.player.y);
    ev.n = this.streak;
    ev.amount = this.streakTier;
    this.hooks.onStreakEnd?.(this, this.streak, this.streakTier);
    this.streak = 0;
    this.streakTier = 0;
    this.streakT = 0;
  }

  // ───────────────────────── player hooks ─────────────────────────

  onPlayerDash(dx: number, dy: number) {
    const p = this.player;
    const ev = this.events.push(EV.Dash, p.x, p.y);
    ev.dx = dx;
    ev.dy = dy;
    this.effects.onDash(this);
  }

  onPlayerDashEnd() {
    this.effects.onDashEnd(this);
  }

  /** where the cast sigil lands */
  castTarget(): { x: number; y: number } {
    const p = this.player;
    const range = TUNING.cast.range;
    const t = p.target;
    if (t && t.targetable && Math.hypot(t.x - p.x, t.y - p.y) < range + 80) return { x: t.x, y: t.y };
    // nearest enemy within range
    let best: Enemy | null = null;
    let bd = range * range;
    for (const e of this.enemies.live) {
      if (!e.targetable) continue;
      const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    if (best) return { x: best.x, y: best.y };
    const a = p.actAngle;
    const A = this.arena;
    return { x: clamp(p.x + Math.cos(a) * range * 0.6, A.x0 + 30, A.x1 - 30), y: clamp(p.y + Math.sin(a) * range * 0.6, A.y0 + 30, A.y1 - 30) };
  }

  throwSigil() {
    const p = this.player;
    if (p.castCharges <= 0) return;
    const mc = TUNING.cast.charges + this.stats.castCharges;
    if (p.castCharges >= mc) p.castT = TUNING.cast.recharge * (1 + this.stats.castRecharge);
    p.castCharges--;
    const t = this.castTarget();
    const h = this.hazards.obtain();
    h.reset();
    h.kind = HZ.Sigil;
    h.team = TEAM_PLAYER;
    h.x = t.x;
    h.y = t.y;
    h.r = TUNING.cast.radius * (1 + this.stats.castRadius);
    h.armT = TUNING.cast.delay;
    h.life = h.maxLife = TUNING.cast.delay + 0.35;
    h.dmg = TUNING.cast.damage + this.stats.castDamage;
    h.color = this.effects.slotColor(this, 'cast');
    const ev = this.events.push(EV.CastThrow, p.x, p.y);
    ev.dx = t.x;
    ev.dy = t.y;
    ev.amount = h.r;
    ev.color = h.color;
  }

  // ───────────────────────── pickups ─────────────────────────

  private updatePickups(dt: number) {
    const p = this.player;
    for (const k of this.pickups.live) {
      if (!k.active) continue;
      k.t += dt;
      const dx = p.x - k.x;
      const dy = p.y - k.y;
      const d = Math.hypot(dx, dy) || 1;
      if (k.magnet || d < 90) {
        k.magnet = true;
        const sp = 700 + k.t * 900;
        k.vx = (dx / d) * sp;
        k.vy = (dy / d) * sp;
      } else {
        k.vx *= 0.9;
        k.vy *= 0.9;
      }
      k.x += k.vx * dt;
      k.y += k.vy * dt;
      if (d < p.r + 12) {
        k.active = false;
        this.collectPickup(k);
      }
    }
  }

  collectPickup(k: Pickup) {
    const ev = this.events.push(EV.Pickup, k.x, k.y);
    ev.n = k.kind;
    ev.amount = k.value;
    this.effects.onPickup(this, k);
  }

  // ───────────────────────── misc ─────────────────────────

  /** helpers used by enemies */
  get px() {
    return this.player.x;
  }
  get py() {
    return this.player.y;
  }

  kill(e: Enemy, slot: Slot = 'other') {
    killEnemy(this, e, null, slot);
  }

  clearWorld() {
    this.enemies.clear();
    this.projectiles.clear();
    this.hazards.clear();
    this.telegraphs.clear();
    this.hitboxes.clear();
    this.corpses.clear();
    this.pickups.clear();
    this.hitstopT = 0;
    this.slowT = 0;
  }

  aliveEnemies(blockingOnly = true) {
    let n = 0;
    for (const e of this.enemies.live) if (e.active && (!blockingOnly || e.blocksClear)) n++;
    return n;
  }
}
