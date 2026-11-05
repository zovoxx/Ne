import type { Game } from './game/game';
import { EV, type GameEvent } from './game/events';
import type { Renderer } from './render/renderer';
import type { Sfx } from './audio/sfx';
import type { Haptics } from './platform/haptics';
import { TUNING } from './config/tuning';
import type { Enemy } from './game/entities';

/** Drains simulation events once per frame and fans them out to visuals, audio and haptics. */
export class Presenter {
  combo = 0;
  private comboT = 0;
  listeners: ((g: Game, e: GameEvent) => void)[] = [];
  constructor(private r: Renderer, private sfx: Sfx, private haptics: Haptics) {}

  drain(g: Game, dt: number) {
    this.comboT -= dt;
    if (this.comboT <= 0) this.combo = 0;
    g.events.drain((ev) => {
      this.r.onEvent(g, ev);
      this.audio(g, ev);
      for (const l of this.listeners) l(g, ev);
    });
  }

  private audio(g: Game, ev: GameEvent) {
    const s = this.sfx;
    const H = TUNING.haptics;
    switch (ev.type) {
      case EV.Hit:
        if (ev.flag === 1) {
          s.dotTick();
          break;
        }
        this.combo++;
        this.comboT = 0.6;
        s.hit(ev.power, ev.crit, this.combo, ev.flag === 2 || ((ev.ref as Enemy)?.armor ?? 0) > 0);
        this.haptics.pulse(ev.crit ? H.crit : ev.power > 0.7 ? H.heavy : H.hit);
        break;
      case EV.Kill:
        s.kill(ev.n, ev.flag, ev.amount);
        this.haptics.pulse(H.kill);
        break;
      case EV.LastKill:
        s.lastKill();
        this.haptics.pulse(H.lastKill, true);
        break;
      case EV.Swing:
        s.swing(ev.key, ev.n, ev.crit);
        break;
      case EV.Dash:
        s.dash();
        break;
      case EV.Shoot:
        s.shoot(ev.key);
        break;
      case EV.CastThrow:
        s.cast();
        break;
      case EV.CastBoom:
        s.castBoom();
        break;
      case EV.PlayerHurt:
        if (ev.flag === 1) break;
        s.hurt();
        this.haptics.pulse(H.hurt, true);
        break;
      case EV.Explosion:
        s.explosion(ev.amount);
        break;
      case EV.EnemyShoot:
        s.enemyShoot(ev.n);
        break;
      case EV.Telegraph:
        s.telegraph(ev.amount || 0.4);
        break;
      case EV.SpawnPortal:
        s.spawn();
        break;
      case EV.Block:
        s.block();
        break;
      case EV.Deflect:
        s.deflect();
        break;
      case EV.Freeze:
        s.freeze();
        break;
      case EV.Lightning:
        s.lightning();
        break;
      case EV.ArmorBreak:
      case EV.ShieldBreak:
        s.armorBreak();
        break;
      case EV.Pickup:
        s.pickup();
        break;
      case EV.Gold:
        s.gold();
        break;
      case EV.Heal:
        s.heal();
        break;
      case EV.StreakTier:
        s.streakTier(ev.n);
        break;
      case EV.StreakEnd:
        s.streakEnd(ev.n);
        break;
      case EV.DeathDefy:
        s.deathDefy();
        break;
      case EV.PlayerDeath:
        s.death();
        this.haptics.pulse([60, 40, 120], true);
        break;
      case EV.DoorsOpen:
        s.door();
        break;
      case EV.RoomEnter:
        s.roomEnter();
        break;
      case EV.BossPhase:
        s.bossRoar();
        break;
      case EV.BossKill:
        s.lastKill();
        this.haptics.pulse(H.bossKill, true);
        break;
      case EV.Slam:
      case EV.Chain:
        s.slam();
        break;
      case EV.Reward:
        s.reward();
        break;
      case EV.Burrow:
        s.burrow();
        break;
      case EV.Teleport:
        s.teleport();
        break;
      case EV.ChargeReady:
        s.chargeReady();
        this.haptics.pulse(12);
        break;
      case EV.Catch:
        s.pickup();
        break;
      case EV.Recall:
        s.deflect();
        break;
      default:
        break;
    }
  }
}
