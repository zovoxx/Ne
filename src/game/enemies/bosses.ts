import type { EnemyDef } from './types';
import { TUNING } from '../../config/tuning';
import type { Enemy } from '../entities';
import { HZ, TEAM_ENEMY } from '../entities';
import type { Game } from '../game';
import { bossInit, bossUpdate, blastAt, fan, ring, summon, type BossSpec } from './boss';
import { kite, moveTo, playerInArc, playerNear, rayToWall, tgCone, tgLine, tgRing, toPlayer } from './ai';
import { addHazard, addPulse } from '../hazards';
import { fireEnemy, lob, PJ } from '../projectiles';
import { explode } from '../combat';
import { EV } from '../events';
import { clamp, DEG, TAU } from '../math';
import { cinderling, kindlepod } from './biome1';
import { inkshade, lanternist } from './biome2';
import { gyrosaw, rivethound } from './biome3';
import { mirrorknight, voidimp } from './biome4';

const D = (e: Enemy, k: number) => e.def.dmg * e.dmgMul * k * TUNING.scaling.bossDmg;

/* ═══════════════════════ BOSS 1 — ASHENHART, THE CINDER STAG ═══════════════════════ */
const stagSpec: BossSpec = {
  phases: [0.5],
  idle: 0.7,
  move(e, g, dt) {
    const t = toPlayer(e, g);
    if (t.d > 260) moveTo(e, g, g.player.x, g.player.y, 150);
    else kite(e, g, 180, 300, 120);
    e.facing = t.a;
    void dt;
  },
  attacks: [
    {
      id: 'charge',
      weight: 3,
      cd: 2.5,
      start(e, g) {
        const t = toPlayer(e, g);
        e.a = t.a;
        e.b = rayToWall(g, e.x, e.y, e.a, 900, e.r);
        e.tg = tgLine(g, e, e.a, e.b + e.r, e.r * 2 + 10, 0.8);
        e.c = 0;
        e.d = 0;
      },
      tick(e, g, dt, t) {
        if (t < 0.8) {
          if (t < 0.45) {
            e.a = toPlayer(e, g).a;
            e.b = rayToWall(g, e.x, e.y, e.a, 900, e.r);
          } else if (e.tg) e.tg.locked = true;
          if (e.tg) {
            e.tg.x = e.x;
            e.tg.y = e.y;
            e.tg.angle = e.a;
            e.tg.len = e.b + e.r;
          }
          e.facing = e.a;
          return false;
        }
        if (e.tg) {
          e.tg.active = false;
          e.tg = null;
        }
        e.vx = Math.cos(e.a) * 880;
        e.vy = Math.sin(e.a) * 880;
        if (!e.c && playerNear(e, g, e.r)) if (g.hurtPlayer(D(e, 1.2), e.x, e.y, e)) e.c = 1;
        // phase 2: blazing trail
        e.d -= dt;
        if (e.phase >= 1 && e.d <= 0) {
          e.d = 0.06;
          addHazard(g, HZ.Fire, TEAM_ENEMY, e.x, e.y, 30, 3, D(e, 0.4), 0xff6a2a, e).armT = 0.3;
        }
        const travelled = (t - 0.8) * 880;
        if (travelled >= e.b - 6 || t > 2) {
          e.vx = e.vy = 0;
          const ev = g.events.push(EV.Slam, e.x + Math.cos(e.a) * e.r, e.y + Math.sin(e.a) * e.r);
          ev.power = 1;
          ev.color = 0xff8a3d;
          ring(g, e, 10, 220, D(e, 0.5), e.a, -1, 0, 'bullet', 0xff8a3d);
          e.data.vulnT = g.time + 1;
          e.data.vuln = 0.3;
          return true;
        }
        return false;
      },
    },
    {
      id: 'sweep',
      weight: 2.5,
      cd: 2.2,
      range: [0, 260],
      start(e, g) {
        e.a = toPlayer(e, g).a;
        e.tg = tgCone(g, e, e.a, 190, 200 * DEG, 0.7, 0xff6a2a);
      },
      tick(e, g, dt, t) {
        if (e.tg) {
          e.tg.x = e.x;
          e.tg.y = e.y;
        }
        if (t >= 0.7) {
          if (playerInArc(e, g, 190, 200 * DEG, e.a)) g.hurtPlayer(D(e, 1), e.x, e.y, e);
          const ev = g.events.push(EV.Swing, e.x, e.y);
          ev.dx = Math.cos(e.a);
          ev.dy = Math.sin(e.a);
          ev.amount = 190;
          ev.power = 200 * DEG;
          ev.key = 'boss';
          if (e.phase >= 1) fan(g, e, e.a, 9, 200 * DEG, 260, D(e, 0.5), 'bullet', 0xff8a3d, PJ.Orb);
          return true;
        }
        return false;
      },
    },
    {
      id: 'firefall',
      weight: 2,
      cd: 4,
      start(e) {
        e.c = 0;
        e.d = 0;
      },
      tick(e, g, dt, t) {
        e.c -= dt;
        const total = e.phase >= 1 ? 11 : 7;
        if (e.c <= 0 && e.d < total) {
          e.c = 0.13;
          const p = g.player;
          const near = e.d % 3 === 0;
          const x = near ? p.x + p.vx * 0.4 : p.x + g.rng.range(-260, 260);
          const y = near ? p.y + p.vy * 0.4 : p.y + g.rng.range(-200, 200);
          blastAt(g, e, x, y, 58, 1.0, D(e, 0.9), 0xff6a2a);
          e.d++;
        }
        return e.d >= total && t > 1.2;
      },
    },
    {
      id: 'flameRing',
      weight: 1.6,
      cd: 5,
      start(e, g) {
        e.tg = tgRing(g, e, e.x, e.y, 120, 0, 0.6, 0xff6a2a);
        e.c = 0;
      },
      tick(e, g, dt, t) {
        if (t >= 0.6 && e.c === 0) {
          e.c = 1;
          addPulse(g, e.x, e.y, 620, 1.3, D(e, 0.9), 0xff6a2a, e, 34);
          const ev = g.events.push(EV.Slam, e.x, e.y);
          ev.power = 1;
          ev.color = 0xff8a3d;
        }
        if (e.phase >= 1 && t >= 1.2 && e.c === 1) {
          e.c = 2;
          addPulse(g, e.x, e.y, 620, 1.3, D(e, 0.9), 0xff6a2a, e, 34);
        }
        return t > (e.phase >= 1 ? 1.6 : 1.0);
      },
    },
    {
      id: 'brood',
      weight: 1.2,
      cd: 9,
      start(e, g) {
        e.data.windup = 1;
        void g;
      },
      tick(e, g, dt, t) {
        if (t > 0.6) {
          e.data.windup = 0;
          let alive = 0;
          for (const o of g.enemies.live) if (o.active && o.parent === e) alive++;
          if (alive < 6) summon(g, e, e.phase >= 1 ? kindlepod : cinderling, e.phase >= 1 ? 3 : 4, 130);
          return true;
        }
        return false;
      },
    },
    {
      id: 'spiral',
      weight: 2,
      cd: 6,
      minPhase: 1,
      start(e) {
        e.c = 0;
        e.d = 0;
      },
      tick(e, g, dt, t) {
        e.c -= dt;
        if (t > 0.4 && e.c <= 0) {
          e.c = 0.09;
          e.d += 0.32;
          for (let k = 0; k < 3; k++) fireEnemy(g, e, PJ.Orb, e.x, e.y, e.d + (k * TAU) / 3, 230, D(e, 0.5), 9, 'bullet', 0xffb347);
        }
        return t > 2.8;
      },
    },
  ],
};

export const bossStag: EnemyDef = {
  id: 'boss_stag',
  name: 'Ashenhart, the Cinder Stag',
  blurb: 'Boss of the Ashen Gardens.',
  biome: 1,
  roles: ['elite'],
  hp: 1500,
  speed: 150,
  radius: 42,
  mass: 20,
  contact: 0,
  dmg: 12,
  art: 'boss_stag',
  blood: 0xff8a3d,
  cost: 0,
  noKnock: true,
  staggerImmune: true,
  noElite: true,
  orient: 'flip',
  init(e, g) {
    bossInit(e, g, false);
  },
  update(e, g, dt) {
    bossUpdate(e, g, dt, stagSpec);
  },
};

/* ═══════════════════════ BOSS 2 — VELLORAN, THE DROWNED ARCHIVIST ═══════════════════════ */
const archivistSpec: BossSpec = {
  phases: [0.5],
  idle: 0.7,
  move(e, g) {
    kite(e, g, 260, 420, 150);
    e.facing = toPlayer(e, g).a;
  },
  attacks: [
    {
      id: 'quills',
      weight: 3,
      cd: 2,
      start(e) {
        e.c = 0;
        e.d = 0;
      },
      tick(e, g, dt, t) {
        e.c -= dt;
        const n = e.phase >= 1 ? 4 : 3;
        if (e.c <= 0 && e.d < n) {
          e.c = 0.34;
          e.d++;
          fan(g, e, toPlayer(e, g).a + (e.d % 2 ? 0.12 : -0.12), 7, 70 * DEG, 400, D(e, 0.5), 'needle', 0xbff6ff, PJ.Needle, 6);
        }
        return e.d >= n && t > n * 0.34 + 0.2;
      },
    },
    {
      id: 'pages',
      weight: 2,
      cd: 5,
      start(e, g) {
        const n = e.phase >= 1 ? 10 : 7;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU;
          const pr = fireEnemy(g, e, PJ.Homing, e.x, e.y, a, 200, D(e, 0.45), 10, 'page', 0xffe0a0);
          pr.homing = 1.7;
          pr.life = pr.maxLife = 4.5;
        }
      },
      tick(e, g, dt, t) {
        return t > 0.6;
      },
    },
    {
      id: 'tide',
      weight: 1.8,
      cd: 5,
      start(e, g) {
        // a wall of ink orbs sweeps the room with one gap
        const A = g.arena;
        const horizontal = g.rng.chance(0.5);
        e.a = horizontal ? 1 : 0;
        e.b = g.rng.chance(0.5) ? 1 : -1;
        e.c = horizontal ? clamp(g.player.y, A.y0 + 80, A.y1 - 80) + g.rng.range(-60, 60) : clamp(g.player.x, A.x0 + 80, A.x1 - 80) + g.rng.range(-60, 60);
        e.d = 0;
        const t = g.telegraph(1, horizontal ? (e.b > 0 ? A.x0 : A.x1) : e.c, horizontal ? e.c : e.b > 0 ? A.y0 : A.y1, 0.7, e);
        t.angle = horizontal ? (e.b > 0 ? 0 : Math.PI) : e.b > 0 ? Math.PI / 2 : -Math.PI / 2;
        t.len = 220;
        t.width = 110;
        t.color = 0x47d6ff;
      },
      tick(e, g, dt, t) {
        if (t >= 0.7 && !e.d) {
          e.d = 1;
          const A = g.arena;
          const horizontal = e.a === 1;
          const span = horizontal ? A.y1 - A.y0 : A.x1 - A.x0;
          const n = Math.floor(span / 38);
          for (let i = 0; i <= n; i++) {
            const pos = (horizontal ? A.y0 : A.x0) + (i / n) * span;
            if (Math.abs(pos - e.c) < 70) continue; // the gap
            const x = horizontal ? (e.b > 0 ? A.x0 + 5 : A.x1 - 5) : pos;
            const y = horizontal ? pos : e.b > 0 ? A.y0 + 5 : A.y1 - 5;
            const ang = horizontal ? (e.b > 0 ? 0 : Math.PI) : e.b > 0 ? Math.PI / 2 : -Math.PI / 2;
            const pr = fireEnemy(g, null, PJ.Orb, x, y, ang, 300, D(e, 0.8), 15, 'bullet', 0x47d6ff);
            pr.owner = e;
            pr.life = pr.maxLife = 6;
          }
        }
        return t > 1;
      },
    },
    {
      id: 'snipe',
      weight: 2,
      cd: 4,
      start(e, g) {
        const t = toPlayer(e, g);
        for (let k = -1; k <= 1; k++) {
          const tl = tgLine(g, e, t.a + k * 0.32, 1100, 8, 1.1, 0xff3b4a);
          tl.linger = 0.02;
        }
        e.a = t.a;
      },
      tick(e, g, dt, t) {
        const tt = toPlayer(e, g);
        if (t < 0.8) {
          e.a = tt.a;
          let k = -1;
          for (const tl of g.telegraphs.live)
            if (tl.owner === e && tl.active && tl.shape === 1) {
              tl.angle = e.a + k * 0.32;
              tl.x = e.x;
              tl.y = e.y;
              k++;
            }
        } else for (const tl of g.telegraphs.live) if (tl.owner === e) tl.locked = true;
        if (t >= 1.1) {
          for (let k = -1; k <= 1; k++) {
            const pr = fireEnemy(g, e, PJ.Bolt, e.x, e.y, e.a + k * 0.32, 1200, D(e, 1), 8, 'bolt', 0x7fe3ff);
            pr.pierce = 99;
            pr.reflectable = false;
          }
          return true;
        }
        return false;
      },
    },
    {
      id: 'blink',
      weight: 1.5,
      cd: 4,
      start(e, g) {
        e.visual = 2;
        e.untargetable = true;
        for (let i = 0; i < 3; i++) {
          const h = addHazard(g, HZ.Ink, TEAM_ENEMY, e.x + g.rng.range(-80, 80), e.y + g.rng.range(-60, 60), 55, 6, 0, 0x47d6ff, e);
          h.armT = 0.2;
        }
        const ev = g.events.push(EV.Teleport, e.x, e.y);
        ev.color = 0x47d6ff;
      },
      tick(e, g, dt, t) {
        if (t > 0.45) {
          const pt = g.freePointNear(g.player.x, g.player.y, 300, 420, e.r);
          e.x = e.px = pt.x;
          e.y = e.py = pt.y;
          e.visual = 0;
          e.untargetable = false;
          const ev = g.events.push(EV.Teleport, e.x, e.y);
          ev.color = 0x47d6ff;
          ring(g, e, 12, 200, D(e, 0.5), g.rng.range(0, 1), -1, 0, 'bullet', 0x47d6ff);
          return true;
        }
        return false;
      },
    },
    {
      id: 'copies',
      weight: 1.2,
      cd: 10,
      minPhase: 1,
      start(e) {
        e.data.windup = 1;
      },
      tick(e, g, dt, t) {
        if (t > 0.6) {
          e.data.windup = 0;
          let alive = 0;
          for (const o of g.enemies.live) if (o.active && o.parent === e) alive++;
          if (alive < 4) {
            summon(g, e, inkshade, 2, 140);
            summon(g, e, lanternist, 1, 180);
          }
          return true;
        }
        return false;
      },
    },
  ],
};

export const bossArchivist: EnemyDef = {
  id: 'boss_archivist',
  name: 'Velloran, the Drowned Archivist',
  blurb: 'Boss of the Drowned Archive.',
  biome: 2,
  roles: ['elite'],
  hp: 1300,
  speed: 150,
  radius: 36,
  mass: 20,
  contact: 0,
  dmg: 12,
  art: 'boss_archivist',
  blood: 0x47d6ff,
  cost: 0,
  noKnock: true,
  staggerImmune: true,
  noElite: true,
  flying: true,
  orient: 'flip',
  init(e, g) {
    bossInit(e, g, false);
  },
  update(e, g, dt) {
    bossUpdate(e, g, dt, archivistSpec);
  },
};

/* ═══════════════════════ BOSS 3 — THE ENGINE TYRANT ═══════════════════════ */
const engineSpec: BossSpec = {
  phases: [0.66, 0.33],
  idle: 0.8,
  move(e, g) {
    // patrols the upper half of the arena
    const A = g.arena;
    const tx = clamp(g.player.x, A.x0 + 150, A.x1 - 150);
    const ty = A.y0 + 170;
    moveTo(e, g, tx, ty, 90);
    e.facing = toPlayer(e, g).a;
  },
  onPhase(e, g, phase) {
    // armor plates bolt on at each new phase
    e.armor = e.maxArmor = Math.round(e.maxHp * 0.12);
    void g;
    void phase;
  },
  attacks: [
    {
      id: 'lasers',
      weight: 2.5,
      cd: 4.5,
      start(e, g) {
        const n = e.phase >= 2 ? 3 : 2;
        e.b = g.rng.sign();
        for (let k = 0; k < n; k++) {
          const tl = tgLine(g, e, (k * TAU) / n + e.b * 0.2, 700, 16, 0.9, 0xff4a2a);
          tl.linger = 0.01;
        }
        e.c = 0;
      },
      tick(e, g, dt, t) {
        if (t >= 0.9 && !e.c) {
          e.c = 1;
          const n = e.phase >= 2 ? 3 : 2;
          for (let k = 0; k < n; k++) {
            const h = addHazard(g, HZ.Beam, TEAM_ENEMY, e.x, e.y, 700, 3, D(e, 0.65), 0xff4a2a, e);
            h.angle = (k * TAU) / n + e.b * 0.2;
            h.a = e.b * (e.phase >= 2 ? 1.0 : e.phase >= 1 ? 0.85 : 0.7);
            h.w = 18;
          }
        }
        return t > 3.9;
      },
    },
    {
      id: 'mortars',
      weight: 2.5,
      cd: 3.5,
      start(e) {
        e.c = 0;
        e.d = 0;
      },
      tick(e, g, dt, t) {
        e.c -= dt;
        const n = e.phase >= 1 ? 8 : 6;
        if (e.c <= 0 && e.d < n) {
          e.c = 0.14;
          e.d++;
          const p = g.player;
          const off = e.d === 1 ? 0 : g.rng.range(40, 220);
          const a = g.rng.range(0, TAU);
          lob(g, e, e.x, e.y - 30, p.x + Math.cos(a) * off + p.vx * 0.5, p.y + Math.sin(a) * off + p.vy * 0.5, 1.0, 58, D(e, 0.9), 'shell', 0xff7a2a, 240);
        }
        return e.d >= n && t > 1.4;
      },
    },
    {
      id: 'saws',
      weight: 1.4,
      cd: 9,
      start(e) {
        e.data.windup = 1;
      },
      tick(e, g, dt, t) {
        if (t > 0.6) {
          e.data.windup = 0;
          let alive = 0;
          for (const o of g.enemies.live) if (o.active && o.parent === e && o.def.id === 'gyrosaw') alive++;
          if (alive < 2) summon(g, e, gyrosaw, e.phase >= 2 ? 2 : 1, 110);
          return true;
        }
        return false;
      },
    },
    {
      id: 'pistons',
      weight: 2,
      cd: 4,
      range: [0, 420],
      start(e, g) {
        e.tg = tgRing(g, e, e.x, e.y, 160, 0, 0.7, 0xffb347);
        e.c = 0;
      },
      tick(e, g, dt, t) {
        const n = e.phase >= 1 ? 3 : 2;
        const due = Math.floor((t - 0.7) / 0.42) + 1;
        while (t >= 0.7 && e.c < Math.min(n, due)) {
          e.c++;
          addPulse(g, e.x, e.y, 560, 1.2, D(e, 0.9), 0xffb347, e, 30);
          explode(g, e.x, e.y, 120, D(e, 1), 1, 0.8, 'other', e);
        }
        return e.c >= n && t > 0.7 + n * 0.42;
      },
    },
    {
      id: 'hounds',
      weight: 1.2,
      cd: 10,
      start(e) {
        e.data.windup = 1;
      },
      tick(e, g, dt, t) {
        if (t > 0.5) {
          e.data.windup = 0;
          let alive = 0;
          for (const o of g.enemies.live) if (o.active && o.parent === e && o.def.id === 'rivethound') alive++;
          if (alive < 3) summon(g, e, rivethound, 3, 150);
          return true;
        }
        return false;
      },
    },
    {
      id: 'vents',
      weight: 2,
      cd: 6,
      minPhase: 1,
      start(e, g) {
        const p = g.player;
        e.c = 0;
        for (let i = 0; i < 6; i++) {
          const x = i === 0 ? p.x : p.x + g.rng.range(-320, 320);
          const y = i === 0 ? p.y : p.y + g.rng.range(-220, 220);
          const tl = g.telegraph(0, x, y, 0.9, e);
          tl.radius = 60;
          tl.color = 0xff4a2a;
          e.data['vx' + i] = x;
          e.data['vy' + i] = y;
        }
      },
      tick(e, g, dt, t) {
        if (t >= 0.9 && !e.c) {
          e.c = 1;
          for (let i = 0; i < 6; i++) {
            const h = addHazard(g, HZ.Fire, TEAM_ENEMY, e.data['vx' + i], e.data['vy' + i], 60, 3.2, D(e, 0.5), 0xff4a2a, e);
            h.tick = 0.4;
            explode(g, e.data['vx' + i], e.data['vy' + i], 60, D(e, 0.8), 1, 0.5, 'other', e);
          }
        }
        return t > 1.1;
      },
    },
  ],
};

export const bossEngine: EnemyDef = {
  id: 'boss_engine',
  name: 'The Engine Tyrant',
  blurb: 'Boss of the Clockwork Foundry.',
  biome: 3,
  roles: ['elite'],
  hp: 1180,
  speed: 90,
  radius: 50,
  mass: 30,
  contact: 0,
  dmg: 12,
  art: 'boss_engine',
  blood: 0xffb347,
  cost: 0,
  noKnock: true,
  staggerImmune: true,
  noElite: true,
  orient: 'none',
  init(e, g) {
    bossInit(e, g, false);
    e.data.marks = 2;
    e.data.vuln = 0.35;
  },
  update(e, g, dt) {
    bossUpdate(e, g, dt, engineSpec);
  },
};

/* ═══════════════════════ BOSS 4 — THE PALE REGENT ═══════════════════════ */
const regentSpec: BossSpec = {
  phases: [0.66, 0.33],
  idle: 0.6,
  move(e, g) {
    kite(e, g, 200, 360, 160);
    e.facing = toPlayer(e, g).a;
  },
  onPhase(e, g, phase) {
    if (phase === 2) {
      // the crown collapses the room: a void ring closes in
      const A = g.arena;
      const h = addHazard(g, HZ.Void, TEAM_ENEMY, (A.x0 + A.x1) / 2, (A.y0 + A.y1) / 2, 560, 9999, D(e, 0.5), 0xd45cff, e);
      h.c = 380;
    }
  },
  attacks: [
    {
      id: 'crescents',
      weight: 3,
      cd: 2,
      start(e) {
        e.c = 0;
        e.d = 0;
      },
      tick(e, g, dt, t) {
        e.c -= dt;
        const waves = e.phase >= 1 ? 3 : 2;
        if (e.c <= 0 && e.d < waves) {
          e.c = 0.45;
          e.d++;
          const a = toPlayer(e, g).a;
          for (let k = -1; k <= 1; k++) {
            const pr = fireEnemy(g, e, PJ.Wave, e.x, e.y, a + k * 0.38, 400, D(e, 1), 26, 'regentWave', 0xe8d8ff);
            pr.reflectable = false;
            pr.pierce = 99;
          }
        }
        return e.d >= waves && t > waves * 0.45 + 0.1;
      },
    },
    {
      id: 'starfall',
      weight: 2.2,
      cd: 4,
      start(e) {
        e.c = 0;
        e.d = 0;
      },
      tick(e, g, dt, t) {
        e.c -= dt;
        const n = e.phase >= 1 ? 13 : 9;
        if (e.c <= 0 && e.d < n) {
          e.c = 0.07;
          const A = g.arena;
          const onPlayer = e.d % 4 === 0;
          const x = onPlayer ? g.player.x : g.rng.range(A.x0 + 40, A.x1 - 40);
          const y = onPlayer ? g.player.y : g.rng.range(A.y0 + 40, A.y1 - 40);
          blastAt(g, e, x, y, 62, 1.05, D(e, 0.9), 0xd45cff);
          e.d++;
        }
        return e.d >= n && t > 1.3;
      },
    },
    {
      id: 'gravity',
      weight: 1.8,
      cd: 5.5,
      start(e, g) {
        const A = g.arena;
        e.tx = (A.x0 + A.x1) / 2 + g.rng.range(-120, 120);
        e.ty = (A.y0 + A.y1) / 2 + g.rng.range(-80, 80);
        const tl = g.telegraph(0, e.tx, e.ty, 0.8, e);
        tl.radius = 60;
        tl.color = 0x9a6cff;
        e.c = 0;
      },
      tick(e, g, dt, t) {
        if (t >= 0.8 && e.c === 0) {
          e.c = 1;
          const h = addHazard(g, HZ.Well, TEAM_ENEMY, e.tx, e.ty, 60, 2.8, D(e, 0.6), 0x9a6cff, e);
          h.b = 240;
        }
        if (t >= 1.4 && e.c === 1) {
          e.c = 2;
          ring(g, e, 16, 200, D(e, 0.6), g.rng.range(0, 1), toPlayer(e, g).a, 0.35, 'bullet', 0xff7ae0);
        }
        return t > 1.6;
      },
    },
    {
      id: 'mirrorDash',
      weight: 2,
      cd: 4.5,
      start(e, g) {
        const A = g.arena;
        let x = e.x;
        let y = e.y;
        const p = g.player;
        for (let i = 0; i < 3; i++) {
          const aim = Math.atan2(p.y - y, p.x - x) + (i ? g.rng.range(-0.8, 0.8) : 0);
          const len = i === 0 ? Math.hypot(p.x - x, p.y - y) + 120 : g.rng.range(240, 340);
          const nx = clamp(x + Math.cos(aim) * len, A.x0 + 40, A.x1 - 40);
          const ny = clamp(y + Math.sin(aim) * len, A.y0 + 40, A.y1 - 40);
          e.data['s' + i * 4] = x;
          e.data['s' + (i * 4 + 1)] = y;
          e.data['s' + (i * 4 + 2)] = nx;
          e.data['s' + (i * 4 + 3)] = ny;
          const tl = g.telegraph(1, x, y, 0.85 + i * 0.2, e);
          tl.angle = Math.atan2(ny - y, nx - x);
          tl.len = Math.hypot(nx - x, ny - y);
          tl.width = e.r * 2;
          tl.color = i === 0 ? 0xff3b4a : i === 1 ? 0xff7a3a : 0xffb347;
          x = nx;
          y = ny;
        }
        e.c = 0;
        e.d = 0;
      },
      tick(e, g, dt, t) {
        if (t < 0.85) return false;
        const i = e.c;
        if (i >= 3) return true;
        const sx = e.data['s' + i * 4];
        const sy = e.data['s' + (i * 4 + 1)];
        const ex = e.data['s' + (i * 4 + 2)];
        const ey = e.data['s' + (i * 4 + 3)];
        e.d += dt;
        const k = Math.min(1, e.d / 0.2);
        e.x = sx + (ex - sx) * k;
        e.y = sy + (ey - sy) * k;
        e.vx = e.vy = 0;
        if (playerNear(e, g, e.r * 0.9)) g.hurtPlayer(D(e, 1.1), e.x, e.y, e);
        if (k >= 1) {
          for (const tl of g.telegraphs.live) if (tl.owner === e && tl.active && Math.abs(tl.x - sx) < 1 && Math.abs(tl.y - sy) < 1) tl.active = false;
          e.c++;
          e.d = 0;
          if (e.phase >= 1) ring(g, e, 10, 180, D(e, 0.5), g.rng.range(0, 1), -1, 0, 'bullet', 0xe8d8ff);
        }
        return false;
      },
    },
    {
      id: 'timeSigil',
      weight: 1.6,
      cd: 6,
      minPhase: 1,
      start(e, g) {
        // a ring of frozen stars around the player that collapses inward
        const p = g.player;
        const n = 18;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU;
          if (i === 0 || i === 1) continue; // escape gap
          const pr = fireEnemy(g, null, PJ.Orb, p.x + Math.cos(a) * 230, p.y + Math.sin(a) * 230, a + Math.PI, 0, D(e, 0.7), 9, 'bullet', 0xfff1a6);
          pr.owner = e;
          pr.a = 0.9; // frozen time
          pr.st = 8;
          pr.c = a + Math.PI;
          pr.life = pr.maxLife = 4;
        }
        const tl = tgRing(g, e, p.x, p.y, 240, 220, 0.9, 0xfff1a6);
        tl.owner = e;
      },
      tick(e, g, dt, t) {
        return t > 1.2;
      },
    },
    {
      id: 'knights',
      weight: 1,
      cd: 12,
      minPhase: 1,
      start(e) {
        e.data.windup = 1;
      },
      tick(e, g, dt, t) {
        if (t > 0.6) {
          e.data.windup = 0;
          let alive = 0;
          for (const o of g.enemies.live) if (o.active && o.parent === e) alive++;
          if (alive < 3) {
            summon(g, e, mirrorknight, 1, 160);
            summon(g, e, voidimp, 3, 120);
          }
          return true;
        }
        return false;
      },
    },
    {
      id: 'spiral',
      weight: 2,
      cd: 5,
      minPhase: 2,
      start(e) {
        e.c = 0;
        e.d = 0;
      },
      tick(e, g, dt, t) {
        e.c -= dt;
        if (t > 0.3 && e.c <= 0) {
          e.c = 0.08;
          e.d += 0.27;
          for (let k = 0; k < 4; k++) fireEnemy(g, e, PJ.Orb, e.x, e.y, e.d + (k * TAU) / 4, 210, D(e, 0.5), 9, 'bullet', 0xd45cff);
        }
        return t > 3;
      },
    },
  ],
};

export const bossRegent: EnemyDef = {
  id: 'boss_regent',
  name: 'The Pale Regent',
  blurb: 'Final boss: the thief of the sun.',
  biome: 4,
  roles: ['elite'],
  hp: 1350,
  speed: 160,
  radius: 34,
  mass: 20,
  contact: 0,
  dmg: 11,
  art: 'boss_regent',
  blood: 0xe8d8ff,
  cost: 0,
  noKnock: true,
  staggerImmune: true,
  noElite: true,
  flying: true,
  orient: 'flip',
  init(e, g) {
    bossInit(e, g, false);
    e.data.marks = 2;
  },
  update(e, g, dt) {
    bossUpdate(e, g, dt, regentSpec);
  },
};

export const BOSSES: EnemyDef[] = [bossStag, bossArchivist, bossEngine, bossRegent];
