import type { Game } from './game';
import type { InputFrame } from './player';
import { Enemy, TEAM_ENEMY, TG } from './entities';
import type { RoomController } from './room';
import type { Offer, OfferOption } from './run';
import { angleDiff, clamp, distToSegment } from './math';

/**
 * A simple autonomous player used to soak-test full runs (headless or in the browser).
 * It is deliberately not perfect: it dodges telegraphs and bullets, fights, picks rewards
 * and walks through doors, which is enough to find crashes, soft-locks and balance spikes.
 */
export class BotBrain {
  private dashCd = 0;
  private castCd = 0;
  private specialCd = 0;
  private strafe = 1;
  private strafeT = 0;
  private stuckT = 0;
  private lastX = 0;
  private lastY = 0;
  private blockedT = 0;
  private bowT = 0;
  skill = 1;

  think(g: Game, rc: RoomController | null, f: InputFrame, dt: number) {
    f.clearPressed();
    f.held.attack = f.held.special = f.held.dash = f.held.cast = false;
    f.mx = f.my = 0;
    f.aimActive = false;
    if (g.mode !== 'play') return;
    const p = g.player;
    this.dashCd -= dt;
    this.castCd -= dt;
    this.specialCd -= dt;
    this.strafeT -= dt;
    if (this.strafeT <= 0) {
      this.strafe = Math.random() < 0.5 ? -1 : 1;
      this.strafeT = 0.8 + Math.random() * 1.2;
    }
    // stuck detection
    if (Math.hypot(p.x - this.lastX, p.y - this.lastY) < 1) this.stuckT += dt;
    else this.stuckT = 0;
    this.lastX = p.x;
    this.lastY = p.y;

    // doors: walk into the best one
    if (rc && rc.doors.length && (rc.state === 'doors' || rc.state === 'shop')) {
      let best = rc.doors[0];
      let bs = -1e9;
      for (const d of rc.doors) {
        let s = Math.random() * 0.5;
        const low = p.hp < p.maxHp * 0.5;
        if (d.plan.type === 'spring') s += low ? 5 : 0;
        if (d.plan.type === 'shop') s += g.gold > 120 ? 2 : -1;
        if (d.plan.type === 'elite') s += low ? -3 : 1;
        if (d.plan.reward === 'boon') s += 1.5;
        if (s > bs) {
          bs = s;
          best = d;
        }
      }
      this.moveTo(f, p.x, p.y, best.x, best.y);
      this.avoidPillars(g, f);
      return;
    }

    // danger: telegraphs and bullets
    let dodgeX = 0;
    let dodgeY = 0;
    let danger = 0;
    for (const t of g.telegraphs.live) {
      if (!t.active) continue;
      const k = t.progress;
      let inside = false;
      let ax = 0;
      let ay = 0;
      if (t.shape === TG.Circle) {
        const d = Math.hypot(p.x - t.x, p.y - t.y);
        inside = d < t.radius + p.r + 8;
        ax = (p.x - t.x) / (d || 1);
        ay = (p.y - t.y) / (d || 1);
      } else if (t.shape === TG.Line) {
        const ex = t.x + Math.cos(t.angle) * t.len;
        const ey = t.y + Math.sin(t.angle) * t.len;
        inside = distToSegment(p.x, p.y, t.x, t.y, ex, ey) < t.width / 2 + p.r + 10;
        ax = -Math.sin(t.angle);
        ay = Math.cos(t.angle);
        if ((p.x - t.x) * ax + (p.y - t.y) * ay < 0) {
          ax = -ax;
          ay = -ay;
        }
      } else if (t.shape === TG.Cone) {
        const d = Math.hypot(p.x - t.x, p.y - t.y);
        inside = d < t.radius + p.r && Math.abs(angleDiff(t.angle, Math.atan2(p.y - t.y, p.x - t.x))) < t.arc / 2 + 0.2;
        ax = (p.x - t.x) / (d || 1);
        ay = (p.y - t.y) / (d || 1);
      } else if (t.shape === TG.Ring) {
        const d = Math.hypot(p.x - t.x, p.y - t.y);
        inside = d > t.inner - p.r && d < t.radius + p.r;
        const out = d > (t.inner + t.radius) / 2 ? 1 : -1;
        ax = ((p.x - t.x) / (d || 1)) * out;
        ay = ((p.y - t.y) / (d || 1)) * out;
      }
      if (inside) {
        dodgeX += ax;
        dodgeY += ay;
        danger = Math.max(danger, k);
      }
    }
    for (const pr of g.projectiles.live) {
      if (!pr.active || pr.team !== TEAM_ENEMY) continue;
      if (pr.lob) {
        const d = Math.hypot(p.x - pr.tx, p.y - pr.ty);
        if (d < pr.r + p.r + 10) {
          dodgeX += (p.x - pr.tx) / (d || 1);
          dodgeY += (p.y - pr.ty) / (d || 1);
          danger = Math.max(danger, pr.lt / pr.ldur);
        }
        continue;
      }
      const dx = p.x - pr.x;
      const dy = p.y - pr.y;
      const d = Math.hypot(dx, dy);
      if (d > 220) continue;
      const sp = Math.hypot(pr.vx, pr.vy) || 1;
      const approach = (dx * pr.vx + dy * pr.vy) / (d * sp);
      if (approach < 0.6) continue;
      // perpendicular escape
      let ax = -pr.vy / sp;
      let ay = pr.vx / sp;
      if (ax * dx + ay * dy < 0) {
        ax = -ax;
        ay = -ay;
      }
      dodgeX += ax * 1.5;
      dodgeY += ay * 1.5;
      danger = Math.max(danger, 1 - d / 220);
    }
    for (const h of g.hazards.live) {
      if (!h.active || h.team !== TEAM_ENEMY || h.armT > 0) continue;
      const d = Math.hypot(p.x - h.x, p.y - h.y);
      if (d < h.r + p.r + 6) {
        dodgeX += (p.x - h.x) / (d || 1);
        dodgeY += (p.y - h.y) / (d || 1);
        danger = Math.max(danger, 0.5);
      }
    }

    const aggressive = !!rc && rc.roomT > 60;
    // pick a target
    let target: Enemy | null = null;
    let td = Infinity;
    let near = 0;
    for (const e of g.enemies.live) {
      if (!e.targetable) continue;
      let d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < 160) near++;
      if (e.def.roles.includes('support') || e.def.roles.includes('back')) d *= 0.8;
      if (e.isBoss) d *= 0.9;
      if (d < td) {
        td = d;
        target = e;
      }
    }

    // long fights: stop being careful and commit
    const ranged = p.weapon.ranged && !aggressive;
    let mx = 0;
    let my = 0;
    if (target) {
      const dx = target.x - p.x;
      const dy = target.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      const want = ranged ? 280 : target.r + 40;
      if (d > want + 20) {
        mx = dx / d;
        my = dy / d;
      } else if (d < want - 30) {
        mx = -dx / d;
        my = -dy / d;
      } else {
        mx = (-dy / d) * this.strafe * 0.6;
        my = (dx / d) * this.strafe * 0.6;
      }
      // shielded enemies: orbit to its back, dash through it when close
      if (target.frontShield > 0 && d < 240) {
        const fromE = Math.atan2(p.y - target.y, p.x - target.x);
        const off = angleDiff(target.facing, fromE);
        if (Math.abs(off) < target.frontShield / 2 + 0.3) {
          this.blockedT += dt;
          if (this.blockedT > 2 && p.castCharges > 0 && this.castCd <= 0) {
            f.pressed.cast = true;
            this.castCd = 1;
          }
          const side = off >= 0 ? 1 : -1;
          const ta = fromE + side * 0.9;
          const tx = target.x + Math.cos(ta) * 85;
          const ty = target.y + Math.sin(ta) * 85;
          const bl = Math.hypot(tx - p.x, ty - p.y) || 1;
          mx = (tx - p.x) / bl;
          my = (ty - p.y) / bl;
          if ((d < 110 || this.blockedT > 2.5) && this.dashCd <= 0) {
            this.blockedT = 0;
            // dash straight through to the far side
            mx = dx / d;
            my = dy / d;
            f.pressed.dash = true;
            this.dashCd = 0.8;
          }
          f.held.attack = false;
        } else this.blockedT = 0;
      }
      const blocked = !aggressive && ((target.frontShield > 0 && Math.abs(angleDiff(target.facing, Math.atan2(p.y - target.y, p.x - target.x))) < target.frontShield / 2) || target.parry || target.invuln);
      if (target.parry && d < 160 && !aggressive) {
        mx = -dx / d;
        my = -dy / d;
      }
      if (blocked && p.weapon.id === 'halo') f.held.attack = true;
      if ((d < want + 70 || ranged) && !blocked) {
        if (p.weapon.id === 'bow') {
          // draw, release, repeat (mix of power shots and quick taps)
          this.bowT += dt;
          f.held.attack = this.bowT % 0.75 < 0.5;
          if (this.bowT % 0.75 < dt) f.pressed.attack = true;
        } else if (p.weapon.id === 'halo') {
          // hold: throws on every catch (a fresh press would recall it early)
          f.held.attack = true;
        } else {
          f.held.attack = true;
          if (Math.random() < 0.3) f.pressed.attack = true;
        }
      }
      if (this.specialCd <= 0 && d < (ranged ? 600 : 200)) {
        f.pressed.special = true;
        this.specialCd = 0.9 + Math.random();
      }
      if (this.castCd <= 0 && (near >= 3 || target.isBoss) && p.castCharges > 0) {
        f.pressed.cast = true;
        this.castCd = 1.5;
      }
      if (near >= 4 && this.dashCd <= 0 && p.hp < p.maxHp * 0.6) {
        // reposition out of crowds
        mx = -dx / d;
        my = -dy / d;
        f.pressed.dash = true;
        this.dashCd = 0.6;
      }
    }
    if (danger > (aggressive ? 0.8 : 0)) {
      const l = Math.hypot(dodgeX, dodgeY) || 1;
      mx = dodgeX / l;
      my = dodgeY / l;
      if (danger > 0.55 && this.dashCd <= 0 && Math.random() < this.skill) {
        f.pressed.dash = true;
        this.dashCd = 0.35;
      }
    }
    // keep away from walls
    const A = g.arena;
    if (p.x < A.x0 + 60) mx += 0.6;
    if (p.x > A.x1 - 60) mx -= 0.6;
    if (p.y < A.y0 + 60) my += 0.6;
    if (p.y > A.y1 - 60) my -= 0.6;
    if (this.stuckT > 0.6) {
      mx = -my || 1;
      my = mx;
      this.stuckT = 0;
    }
    const l = Math.hypot(mx, my);
    if (l > 1) {
      mx /= l;
      my /= l;
    }
    f.mx = clamp(mx, -1, 1);
    f.my = clamp(my, -1, 1);
    if (danger <= 0) this.avoidPillars(g, f);
  }

  /** steer around pillars in the way */
  private avoidPillars(g: Game, f: InputFrame) {
    const p = g.player;
    for (const pl of g.arena.pillars) {
      const px = pl.x - p.x;
      const py = pl.y - p.y;
      const along = px * f.mx + py * f.my;
      if (along < 0 || along > pl.r + 70) continue;
      const perp = -px * f.my + py * f.mx;
      if (Math.abs(perp) < pl.r + p.r + 8) {
        const s = perp > 0 ? -1 : 1;
        const nx = f.mx - f.my * s * 1.5;
        const ny = f.my + f.mx * s * 1.5;
        const l = Math.hypot(nx, ny) || 1;
        f.mx = nx / l;
        f.my = ny / l;
      }
    }
  }

  private moveTo(f: InputFrame, x: number, y: number, tx: number, ty: number) {
    const dx = tx - x;
    const dy = ty - y;
    const d = Math.hypot(dx, dy) || 1;
    f.mx = dx / d;
    f.my = dy / d;
  }

  /** choose an offer option (favours empty slots, then rarity) */
  choose(offer: Offer): OfferOption {
    let best = offer.options[0];
    let bs = -1e9;
    for (const o of offer.options) {
      let s = o.rarity * 1.2 + Math.random();
      if (o.tag.startsWith('DUO') || o.tag.startsWith('LEGENDARY')) s += 3;
      if (o.icon === 'attack' || o.icon === 'special') s += 1.5;
      if (o.replaces) s -= 2;
      if (o.id === 'mend') s += 0.5;
      if (s > bs) {
        bs = s;
        best = o;
      }
    }
    return best;
  }
}
