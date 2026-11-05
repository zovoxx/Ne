import type { EnemyDef } from './types';
import { faceTo, moveTo, playerNear, setState, stop, tgLine, toPlayer } from './ai';
import { TUNING } from '../../config/tuning';

/* ═══════════════════════ BIOME 1 — THE ASHEN GARDENS ═══════════════════════ */

/** RUSHER: sprints at you, telegraphs a short bite-lunge. Teaches spacing + dash timing. */
export const cinderling: EnemyDef = {
  id: 'cinderling',
  name: 'Cinderling',
  blurb: 'Rusher. Sprints in and lunges — dash through the lunge.',
  biome: 1,
  roles: ['front', 'swarm'],
  hp: 26,
  speed: 215,
  radius: 15,
  mass: 1,
  contact: 0,
  dmg: 7,
  art: 'cinderling',
  blood: 0xff8a3d,
  cost: 1,
  orient: 'flip',
  update(e, g, dt) {
    const t = toPlayer(e, g);
    switch (e.st) {
      case 0: // chase
        e.cd -= dt;
        moveTo(e, g, g.player.x, g.player.y, e.def.speed * (t.d > 260 ? 1.25 : 1));
        faceTo(e, t.a, 12, dt);
        if (t.d < 92 && e.cd <= 0) {
          setState(e, 1);
          stop(e);
          e.a = t.a;
          e.tg = tgLine(g, e, e.a, 110, 30, 0.32);
        }
        if (e.t > TUNING.pacing.maxIdle * 6) e.t = 0;
        break;
      case 1: // windup: tracks slightly, then locks
        stop(e);
        if (e.t < 0.18) {
          e.a = t.a;
          e.facing = t.a;
        } else if (e.tg) e.tg.locked = true;
        if (e.tg) {
          e.tg.x = e.x;
          e.tg.y = e.y;
          e.tg.angle = e.a;
        }
        if (e.t >= 0.32) {
          if (e.tg) e.tg.active = false;
          e.tg = null;
          setState(e, 2);
          e.superArmor = true;
          e.b = 0;
        }
        break;
      case 2: // lunge
        e.vx = Math.cos(e.a) * 560;
        e.vy = Math.sin(e.a) * 560;
        if (!e.b && playerNear(e, g, e.r + 4)) {
          if (g.hurtPlayer(e.def.dmg * e.dmgMul, e.x, e.y, e)) e.b = 1;
        }
        if (e.t >= 0.17) {
          e.superArmor = false;
          setState(e, 3);
        }
        break;
      case 3: // recover (punish window)
        e.vx *= 0.82;
        e.vy *= 0.82;
        if (e.t >= 0.42) {
          setState(e, 0);
          e.cd = 0.5;
        }
        break;
      default:
        setState(e, 0);
    }
  },
};

export const BIOME1: EnemyDef[] = [cinderling];
