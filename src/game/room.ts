import { TUNING } from '../config/tuning';
import { Enemy, PK } from './entities';
import { EV } from './events';
import type { Game, RoomLogic } from './game';
import { clamp, RNG, TAU } from './math';
import { enemyDef } from './enemies';
import { makeArena, nextDoors, type Door } from './rooms';
import { planEncounter, type SpawnGroup, type Wave } from './encounters';
import { boonOffer, forgeOffer, goldOffer, heartOffer, kindleOffer, type Offer, type RoomPlan, type RunState } from './run';
import { PATRON_POOL } from './rooms';

export interface RoomHooks {
  offer(o: Offer, done: () => void): void;
  enter(plan: RoomPlan): void;
  cleared(plan: RoomPlan): void;
  runWon(): void;
  shopPrompt(item: ShopItem, buy: () => void): void;
  ordealPrompt(plan: RoomPlan, accept: () => void, decline: () => void): void;
  spawnBoss?(g: Game, plan: RoomPlan): Enemy | null;
  spawnMini?(g: Game, plan: RoomPlan): Enemy | null;
}

export interface ShopItem {
  kind: 'boon' | 'heal' | 'kindle' | 'forge' | 'heart' | 'reroll';
  name: string;
  desc: string;
  price: number;
  sold: boolean;
  x: number;
  y: number;
  patron?: string;
}

interface Pending {
  def: string;
  x: number;
  y: number;
  t: number;
  elite: number;
}

type State = 'intro' | 'fight' | 'cleared' | 'reward' | 'choosing' | 'doors' | 'leaving' | 'shop' | 'idle';

/** Drives one room: waves → clear → reward → doors → instant transition. */
export class RoomController implements RoomLogic {
  plan!: RoomPlan;
  state: State = 'idle';
  waves: Wave[] = [];
  waveIdx = -1;
  waveT = 0;
  waveSize = 0;
  pending: Pending[] = [];
  doors: Door[] = [];
  shop: ShopItem[] = [];
  stateT = 0;
  roomT = 0;
  clearTime = 0;
  /** transition: 0 none, 1 fading out, 2 fading in */
  trans = 0;
  transT = 0;
  nextPlan: RoomPlan | null = null;
  fade = 0;
  gauntletT = 0;
  boss: Enemy | null = null;
  rng = new RNG(1);
  shopCooldown = 0;
  private rewardPickup = false;

  constructor(public run: RunState, public hooks: RoomHooks) {}

  /* ─────────────── entering ─────────────── */

  enter(g: Game, plan: RoomPlan) {
    this.plan = plan;
    this.rng = new RNG(plan.seed);
    const run = this.run;
    if (plan.biome !== run.biome) run.shopsThisBiome = 0;
    run.biome = plan.biome;
    run.step = plan.step;
    run.current = plan;
    run.rooms++;
    run.history.push(plan.type);
    g.biome = plan.biome;
    g.clearWorld();
    g.arena = makeArena(this.rng, plan);
    const p = g.player;
    p.x = p.px = 0;
    p.y = p.py = g.arena.y1 - 110;
    p.vx = p.vy = 0;
    p.facing = -Math.PI / 2;
    p.act = null;
    p.dashing = false;
    p.pullT = 0;
    p.latchSlow = 0;
    this.doors = [];
    this.shop = [];
    this.pending = [];
    this.waves = [];
    this.waveIdx = -1;
    this.roomT = 0;
    this.boss = null;
    this.rewardPickup = false;
    this.shopCooldown = 0;
    g.effects.onRoomStart(g);
    const ev = g.events.push(EV.RoomEnter, p.x, p.y);
    ev.ref = plan;
    this.hooks.enter(plan);
    switch (plan.type) {
      case 'combat':
      case 'elite':
      case 'mini':
      case 'boss':
        this.waves = planEncounter(g, run, plan);
        this.setState('intro');
        break;
      case 'shop':
        run.shopsThisBiome++;
        this.buildShop(g);
        this.setState('shop');
        this.openDoors(g);
        break;
      case 'spring':
        g.healPlayer(p.maxHp * 0.35);
        this.setState('idle');
        this.stateT = -0.35;
        break;
      case 'ordeal':
        this.setState('idle');
        this.stateT = -0.3;
        break;
    }
  }

  private setState(s: State) {
    this.state = s;
    this.stateT = 0;
  }

  /* ─────────────── per-frame ─────────────── */

  update(g: Game, dt: number) {
    // transition runs in real time while the sim is paused
    if (this.trans) {
      this.transT += dt;
      if (this.trans === 1) {
        this.fade = clamp(this.transT / TUNING.pacing.transitionOut, 0, 1);
        if (this.transT >= TUNING.pacing.transitionOut && this.nextPlan) {
          const plan = this.nextPlan;
          this.nextPlan = null;
          this.enter(g, plan);
          this.trans = 2;
          this.transT = 0;
        }
      } else {
        this.fade = 1 - clamp(this.transT / TUNING.pacing.transitionIn, 0, 1);
        if (this.transT >= TUNING.pacing.transitionIn) {
          this.trans = 0;
          this.fade = 0;
          g.mode = 'play';
        }
      }
      return;
    }
    if (g.mode !== 'play') return;
    this.stateT += dt;
    this.roomT += dt;
    this.run.time += dt;
    // staggered spawns
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const s = this.pending[i];
      s.t -= dt;
      if (s.t <= 0) {
        this.pending.splice(i, 1);
        const d = enemyDef(s.def);
        // cap how many of one type can be alive at once (healers/summoners stacking is degenerate)
        if (d.max) {
          let alive = 0;
          for (const e of g.enemies.live) if (e.active && e.def === d) alive++;
          if (alive >= d.max + 1) continue;
        }
        g.spawnEnemy(d, s.x, s.y, { elite: s.elite, hpMul: 1 + this.plan.step * TUNING.scaling.hpPerStep });
      }
    }
    switch (this.state) {
      case 'intro':
        if (this.stateT >= TUNING.pacing.firstWaveDelay) {
          this.setState('fight');
          this.startPrimary(g);
          this.nextWave(g);
        }
        break;
      case 'fight': {
        this.waveT += dt;
        if (this.plan.ordeal === 'gauntlet') {
          this.gauntletT -= dt;
          if (this.gauntletT > 0) {
            // endless pressure until the timer runs out
            if (this.waveIdx >= this.waves.length - 1) this.waves.push(...planEncounter(g, this.run, { ...this.plan, type: 'elite' }));
            if (this.pending.length === 0 && (g.aliveEnemies() < 4 || this.waveT > 6)) this.nextWave(g);
          } else {
            // time's up: everything left dies and the room clears
            this.pending.length = 0;
            let lx = g.player.x;
            let ly = g.player.y - 60;
            for (const e of g.enemies.live) {
              if (!e.active) continue;
              lx = e.x;
              ly = e.y;
              g.kill(e);
            }
            this.roomClearedAt(g, lx, ly, 0xffd166);
          }
          break;
        }
        const alive = g.aliveEnemies();
        const more = this.waveIdx < this.waves.length - 1;
        if (more && this.pending.length === 0 && (alive <= Math.floor(this.waveSize * TUNING.pacing.nextWaveAt) || this.waveT > TUNING.pacing.waveMaxTime)) this.nextWave(g);
        break;
      }
      case 'cleared':
        if (this.stateT >= 0.12 && !this.rewardPickup) {
          this.rewardPickup = true;
          if (this.plan.reward === 'none' && this.plan.type !== 'boss') {
            this.afterReward(g);
          } else {
            const k = g.pickups.obtain();
            k.reset();
            k.kind = PK.Reward;
            k.x = clamp(g.lastKillX, g.arena.x0 + 40, g.arena.x1 - 40);
            k.y = clamp(g.lastKillY, g.arena.y0 + 40, g.arena.y1 - 40);
            k.vx = 0;
            k.vy = -120;
            k.magnet = false;
            k.ref = this;
            this.setState('reward');
          }
        }
        break;
      case 'reward':
        // the orb flies to the player on its own after a beat
        for (const k of g.pickups.live) if (k.active && k.kind === PK.Reward && k.t > TUNING.pacing.rewardMagnetDelay) k.magnet = true;
        break;
      case 'idle':
        if (this.stateT >= 0) {
          if (this.plan.type === 'spring') {
            this.setState('choosing');
            this.giveReward(g, 'heart');
          } else if (this.plan.type === 'ordeal') {
            this.setState('choosing');
            this.ordeal(g);
          }
        }
        break;
      case 'doors':
      case 'shop':
        this.checkDoors(g, dt);
        if (this.state === 'shop') this.checkShop(g, dt);
        break;
      default:
        break;
    }
  }

  /* ─────────────── waves ─────────────── */

  private startPrimary(g: Game) {
    if (this.plan.type === 'boss' && this.hooks.spawnBoss) this.boss = this.hooks.spawnBoss(g, this.plan);
    if (this.plan.type === 'mini' && this.hooks.spawnMini) this.boss = this.hooks.spawnMini(g, this.plan);
  }

  private nextWave(g: Game) {
    this.waveIdx++;
    this.waveT = 0;
    const w = this.waves[this.waveIdx];
    if (!w) return;
    let size = 0;
    let delay = 0;
    for (const grp of w.groups) {
      const pts = this.place(g, grp);
      for (const pt of pts) {
        this.pending.push({ def: grp.def, x: pt.x, y: pt.y, t: delay, elite: grp.elite ?? 0 });
        delay += this.rng.range(0.03, 0.09);
        size++;
      }
    }
    this.waveSize = size + g.aliveEnemies();
  }

  private place(g: Game, grp: SpawnGroup): { x: number; y: number }[] {
    const p = g.player;
    const P = TUNING.pacing;
    const out: { x: number; y: number }[] = [];
    const def = enemyDef(grp.def);
    const r = def.radius;
    const n = grp.count;
    const A = g.arena;
    const base = this.rng.range(0, TAU);
    for (let i = 0; i < n; i++) {
      let pt: { x: number; y: number };
      switch (grp.place) {
        case 'far': {
          const a = base + (i / Math.max(1, n)) * 1.6 - 0.8;
          pt = this.tryPoint(g, p.x + Math.cos(a) * 470, p.y + Math.sin(a) * 340, r, 200, 520);
          break;
        }
        case 'flank': {
          const a = base + (i % 2 ? Math.PI : 0) + this.rng.range(-0.4, 0.4);
          pt = this.tryPoint(g, p.x + Math.cos(a) * 260, p.y + Math.sin(a) * 220, r, 180, 320);
          break;
        }
        case 'ring': {
          const a = base + (i / n) * TAU;
          pt = this.tryPoint(g, p.x + Math.cos(a) * 240, p.y + Math.sin(a) * 200, r, 170, 300);
          break;
        }
        case 'behind': {
          const a = p.facing + Math.PI + this.rng.range(-0.6, 0.6);
          pt = this.tryPoint(g, p.x + Math.cos(a) * 230, p.y + Math.sin(a) * 230, r, 170, 300);
          break;
        }
        case 'center':
          pt = this.tryPoint(g, (A.x0 + A.x1) / 2 + this.rng.range(-80, 80), (A.y0 + A.y1) / 2 - 60 + this.rng.range(-60, 60), r, 0, 200);
          break;
        default: {
          // cluster near the player, biased away from walls
          const a = base + this.rng.range(-0.9, 0.9);
          const d = this.rng.range(P.spawnMinDist, P.spawnMaxDist);
          pt = this.tryPoint(g, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, r, P.spawnMinDist, P.spawnMaxDist);
        }
      }
      out.push(pt);
    }
    return out;
  }

  private tryPoint(g: Game, x: number, y: number, r: number, minD: number, maxD: number) {
    const A = g.arena;
    // jitter so points clamped to the same wall never stack exactly
    const cx = clamp(x, A.x0 + r + 30, A.x1 - r - 30) + this.rng.range(-18, 18);
    const cy = clamp(y, A.y0 + r + 30, A.y1 - r - 30) + this.rng.range(-18, 18);
    const p = g.player;
    if (!g.pointBlocked(cx, cy, r + 4) && Math.hypot(cx - p.x, cy - p.y) > Math.min(140, minD)) return { x: cx, y: cy };
    return g.freePointNear(p.x, p.y, Math.max(150, minD), Math.max(220, maxD), r);
  }

  onEnemyKilled(g: Game, e: Enemy) {
    if (this.state !== 'fight') return;
    if (this.waveIdx < this.waves.length - 1 || this.pending.length > 0) {
      // between waves the room keeps flowing: if everything is dead, bring the next wave now
      if (g.aliveEnemies() === 0 && this.pending.length === 0 && this.plan.ordeal !== 'gauntlet') this.nextWave(g);
      return;
    }
    if (this.plan.ordeal === 'gauntlet') return;
    if (g.aliveEnemies() > 0) return;
    this.roomClearedAt(g, e.x, e.y, e.def.blood);
  }

  private roomClearedAt(g: Game, x: number, y: number, color: number) {
    if (this.state !== 'fight') return;
    this.clearTime = this.roomT;
    const boss = this.plan.type === 'boss';
    if (boss) {
      g.slowmo(TUNING.slowmo.bossKillScale, TUNING.slowmo.bossKillDuration);
      g.zoomPunch = TUNING.view.zoomPunchBoss;
      g.events.push(EV.BossKill, x, y);
    } else {
      g.slowmo(TUNING.slowmo.lastKillScale, TUNING.slowmo.lastKillDuration);
      g.zoomPunch = TUNING.view.zoomPunchLastKill;
    }
    g.lastKillX = x;
    g.lastKillY = y;
    const ev = g.events.push(EV.LastKill, x, y);
    ev.color = color;
    // clear lingering enemy projectiles/hazards
    for (const pr of g.projectiles.live) if (pr.team !== 0) pr.active = false;
    for (const h of g.hazards.live) if (h.team !== 0) h.active = false;
    for (const t of g.telegraphs.live) t.active = false;
    const goldGain = Math.round((10 + this.rng.int(0, 6) + (this.plan.type === 'elite' ? 25 : 0) + (this.plan.type === 'mini' ? 40 : 0)) * (1 + this.run.biome * 0.3) * (1 + g.stats.goldGain));
    g.gold += goldGain;
    const gev = g.events.push(EV.Gold, g.player.x, g.player.y - 40);
    gev.amount = goldGain;
    g.effects.onRoomClear(g);
    this.hooks.cleared(this.plan);
    this.setState('cleared');
  }

  /* ─────────────── rewards ─────────────── */

  /** called when the reward orb is collected (via Effects.onPickup) */
  collectReward(g: Game) {
    if (this.state !== 'reward') return;
    this.setState('choosing');
    const kind = this.plan.type === 'boss' ? 'boss' : this.plan.reward;
    this.giveReward(g, kind);
  }

  private giveReward(g: Game, kind: string) {
    const run = this.run;
    const done = () => this.afterReward(g);
    let offer: Offer;
    const rb = this.plan.rarity ?? 0;
    switch (kind) {
      case 'boon':
        offer = boonOffer(g, run, this.plan.patron ?? this.rng.pick(PATRON_POOL.ids), rb, done);
        break;
      case 'forge':
        offer = forgeOffer(g, run, done);
        break;
      case 'kindle':
        offer = kindleOffer(g, run, done);
        break;
      case 'heart':
        offer = heartOffer(g, run, done);
        break;
      case 'gold':
        offer = goldOffer(g, run, done);
        break;
      case 'boss': {
        // boss: heal, then a boon from a random patron with a rarity boost
        g.healPlayer(g.player.maxHp * 0.3);
        run.bossesKilled++;
        offer = boonOffer(g, run, this.rng.pick(PATRON_POOL.ids), 2, done);
        offer.title = 'Victory — ' + offer.title;
        break;
      }
      default:
        done();
        return;
    }
    g.events.push(EV.Reward, g.player.x, g.player.y);
    this.hooks.offer(offer, done);
  }

  private afterReward(g: Game) {
    const run = this.run;
    if (this.plan.type === 'boss' && this.plan.biome >= 3) {
      run.won = true;
      this.hooks.runWon();
      return;
    }
    this.openDoors(g);
    this.setState('doors');
  }

  /* ─────────────── doors ─────────────── */

  private openDoors(g: Game) {
    const plans = nextDoors(this.rng, this.run);
    const p = g.player;
    const A = g.arena;
    const n = plans.length;
    this.doors = [];
    // doors open AROUND THE PLAYER so the next room is one dash away
    const dist = 165;
    let base = -Math.PI / 2;
    if (p.y - A.y0 < dist + 60) base = Math.PI / 2;
    const spread = n === 1 ? 0 : n === 2 ? 1.25 : 1.0;
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * spread;
      let x = p.x + Math.cos(a) * dist;
      let y = p.y + Math.sin(a) * dist;
      x = clamp(x, A.x0 + 60, A.x1 - 60);
      y = clamp(y, A.y0 + 60, A.y1 - 60);
      // keep doors apart if clamping squashed them
      for (const d of this.doors) {
        if (Math.hypot(d.x - x, d.y - y) < 110) x += x < p.x ? -120 : 120;
      }
      x = clamp(x, A.x0 + 60, A.x1 - 60);
      // never inside a pillar
      for (const pl of A.pillars) {
        const dx = x - pl.x;
        const dy = y - pl.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < pl.r + 52) {
          x = pl.x + (dx / d) * (pl.r + 56);
          y = pl.y + (dy / d) * (pl.r + 56);
        }
      }
      x = clamp(x, A.x0 + 60, A.x1 - 60);
      y = clamp(y, A.y0 + 60, A.y1 - 60);
      this.doors.push({ x, y, r: 38, plan: plans[i], t: 0 });
    }
    const ev = g.events.push(EV.DoorsOpen, p.x, p.y);
    ev.n = n;
  }

  private checkDoors(g: Game, dt: number) {
    const p = g.player;
    for (const d of this.doors) {
      d.t += dt;
      if (d.t < 0.25) continue;
      if (Math.hypot(p.x - d.x, p.y - d.y) < d.r + p.r * 0.5) {
        this.goTo(g, d.plan);
        return;
      }
    }
  }

  goTo(g: Game, plan: RoomPlan) {
    this.nextPlan = plan;
    this.trans = 1;
    this.transT = 0;
    this.doors = [];
    this.run.hp = g.player.hp;
    g.mode = 'transition';
  }

  /* ─────────────── shop ─────────────── */

  private buildShop(g: Game) {
    const rng = this.rng;
    const scale = 1 + this.run.biome * 0.25;
    const p1 = rng.pick(PATRON_POOL.ids);
    const items: Omit<ShopItem, 'x' | 'y' | 'sold'>[] = [
      { kind: 'boon', name: 'Bottled Light', desc: 'Choose a boon.', price: Math.round(120 * scale), patron: p1 },
      { kind: 'heal', name: 'Warm Broth', desc: 'Heal 40% health.', price: Math.round(55 * scale) },
      rng.chance(0.5) ? { kind: 'kindle', name: 'Kindling', desc: 'Level up a boon.', price: Math.round(110 * scale) } : { kind: 'forge', name: 'Forge-Spark', desc: 'Upgrade your weapon.', price: Math.round(110 * scale) },
      rng.chance(0.6) ? { kind: 'heart', name: 'Heartwood', desc: '+15 max health.', price: Math.round(90 * scale) } : { kind: 'reroll', name: 'Fate Die', desc: '+1 reroll.', price: Math.round(60 * scale) },
    ];
    const A = g.arena;
    const y = (A.y0 + A.y1) / 2 - 40;
    items.forEach((it, i) => {
      const x = (i - 1.5) * 170;
      this.shop.push({ ...it, x, y, sold: false });
      const k = g.pickups.obtain();
      k.reset();
      k.kind = PK.ShopItem;
      k.x = x;
      k.y = y;
      k.ref = this.shop[i];
    });
  }

  private checkShop(g: Game, dt: number) {
    this.shopCooldown -= dt;
    if (this.shopCooldown > 0) return;
    const p = g.player;
    for (const it of this.shop) {
      if (it.sold) continue;
      if (Math.hypot(p.x - it.x, p.y - it.y) < 42) {
        this.shopCooldown = 1.2;
        this.hooks.shopPrompt(it, () => this.buy(g, it));
        return;
      }
    }
  }

  private buy(g: Game, it: ShopItem) {
    if (g.gold < it.price || it.sold) return;
    g.gold -= it.price;
    it.sold = true;
    for (const k of g.pickups.live) if (k.ref === it) k.active = false;
    const back = () => {
      g.mode = 'play';
    };
    switch (it.kind) {
      case 'boon':
        this.hooks.offer(boonOffer(g, this.run, it.patron as never, 0, back), back);
        break;
      case 'heal':
        g.healPlayer(g.player.maxHp * 0.4);
        break;
      case 'kindle':
        this.hooks.offer(kindleOffer(g, this.run, back), back);
        break;
      case 'forge':
        this.hooks.offer(forgeOffer(g, this.run, back), back);
        break;
      case 'heart':
        this.run.maxHpBase += 15;
        g.player.maxHp += 15;
        g.healPlayer(15);
        break;
      case 'reroll':
        this.run.rerolls++;
        break;
    }
    const ev = g.events.push(EV.Gold, it.x, it.y);
    ev.amount = -it.price;
  }

  /* ─────────────── ordeals (risk / reward) ─────────────── */

  private ordeal(g: Game) {
    const plan = this.plan;
    const run = this.run;
    const decline = () => {
      g.mode = 'play';
      this.openDoors(g);
      this.setState('doors');
    };
    this.hooks.ordealPrompt(
      plan,
      () => {
        g.mode = 'play';
        if (plan.ordeal === 'altar') {
          const cost = Math.round(g.player.maxHp * 0.2);
          run.maxHpBase -= cost;
          g.player.maxHp -= cost;
          g.player.hp = Math.min(g.player.hp, g.player.maxHp);
          this.plan.rarity = 2;
          this.setState('choosing');
          this.giveReward(g, 'boon');
        } else if (plan.ordeal === 'wager') {
          const bet = Math.min(g.gold, 100);
          g.gold -= bet;
          if (this.rng.chance(0.5)) {
            g.gold += bet * 3;
            const ev = g.events.push(EV.Gold, g.player.x, g.player.y - 40);
            ev.amount = bet * 3;
            this.plan.rarity = 1;
            this.setState('choosing');
            this.giveReward(g, 'boon');
          } else {
            const ev = g.events.push(EV.Text, g.player.x, g.player.y - 40);
            ev.key = 'LOST';
            decline();
          }
        } else {
          // gauntlet: 22 seconds of pressure, then a boosted boon
          this.gauntletT = 22;
          this.plan = { ...plan, type: 'elite', rarity: 2 };
          this.waves = planEncounter(g, run, { ...plan, type: 'elite' });
          this.waves.push(...planEncounter(g, run, { ...plan, type: 'combat' }));
          this.plan.ordeal = 'gauntlet';
          this.setState('fight');
          this.nextWave(g);
        }
      },
      decline,
    );
  }
}
