import { Container, Sprite, type Texture } from 'pixi.js';
import { TUNING } from '../config/tuning';
import type { Atlas } from './atlas';
import { clamp, easeOutBack, easeOutCubic, springStep, vrand, vrange } from '../game/math';
const SP = [0, 0];

/* ════════════════════ PARTICLES ════════════════════ */

export class Particle {
  s!: Sprite;
  alive = false;
  vx = 0;
  vy = 0;
  life = 0;
  max = 1;
  drag = 0;
  grav = 0;
  s0 = 1;
  s1 = 0;
  a0 = 1;
  rot = 0;
  vr = 0;
  /** stretch along velocity */
  stretch = 0;
  /** height above floor (for gravity bounce look) */
  z = 0;
  vz = 0;
  fadeIn = 0;
}

export class ParticleSystem {
  private parts: Particle[] = [];
  private cursor = 0;
  active = 0;
  constructor(private atlas: Atlas, private normal: Container, private add: Container, cap: number) {
    for (let i = 0; i < cap; i++) {
      const p = new Particle();
      p.s = new Sprite(atlas.get('dot'));
      p.s.anchor.set(0.5);
      p.s.visible = false;
      (i % 2 ? add : normal).addChild(p.s);
      this.parts.push(p);
    }
    // re-home: first half normal, second half additive — we pick by blend need
  }

  /** obtain a particle; recycles the oldest when full */
  spawn(tex: Texture, x: number, y: number, additive: boolean): Particle {
    const n = this.parts.length;
    let p: Particle | null = null;
    for (let k = 0; k < 24; k++) {
      const i = (this.cursor + k) % n;
      const c = this.parts[i];
      if (!c.alive && (c.s.parent === (additive ? this.add : this.normal))) {
        p = c;
        this.cursor = (i + 1) % n;
        break;
      }
    }
    if (!p) {
      // steal the next particle of the right layer
      for (let k = 0; k < n; k++) {
        const i = (this.cursor + k) % n;
        const c = this.parts[i];
        if (c.s.parent === (additive ? this.add : this.normal)) {
          p = c;
          this.cursor = (i + 1) % n;
          break;
        }
      }
    }
    p = p!;
    if (!p.alive) this.active++;
    p.alive = true;
    p.s.texture = tex;
    p.s.visible = true;
    p.s.x = x;
    p.s.y = y;
    p.s.rotation = 0;
    p.s.tint = 0xffffff;
    p.s.alpha = 1;
    p.vx = p.vy = 0;
    p.drag = 2;
    p.grav = 0;
    p.s0 = 1;
    p.s1 = 0;
    p.a0 = 1;
    p.rot = 0;
    p.vr = 0;
    p.stretch = 0;
    p.z = 0;
    p.vz = 0;
    p.fadeIn = 0;
    p.life = 0;
    p.max = 0.5;
    return p;
  }

  update(dt: number) {
    if (dt <= 0) return;
    const parts = this.parts;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (!p.alive) continue;
      p.life += dt;
      if (p.life >= p.max) {
        p.alive = false;
        p.s.visible = false;
        this.active--;
        continue;
      }
      const k = p.life / p.max;
      const fr = Math.exp(-p.drag * dt);
      p.vx *= fr;
      p.vy *= fr;
      p.vy += p.grav * dt;
      if (p.vz !== 0 || p.z !== 0) {
        p.vz -= 900 * dt;
        p.z += p.vz * dt;
        if (p.z < 0) {
          p.z = 0;
          p.vz = -p.vz * 0.35;
          p.vx *= 0.6;
          p.vy *= 0.6;
        }
      }
      p.s.x += p.vx * dt;
      p.s.y += p.vy * dt - (p.vz !== 0 ? 0 : 0);
      const sc = p.s0 + (p.s1 - p.s0) * k;
      if (p.stretch > 0) {
        const sp = Math.hypot(p.vx, p.vy);
        p.s.rotation = Math.atan2(p.vy, p.vx);
        p.s.scale.set(sc * (1 + sp * p.stretch), sc);
      } else {
        p.rot += p.vr * dt;
        p.s.rotation = p.rot;
        p.s.scale.set(sc);
      }
      const fade = p.fadeIn > 0 && k < p.fadeIn ? k / p.fadeIn : 1 - Math.max(0, (k - 0.35) / 0.65);
      p.s.alpha = p.a0 * fade;
    }
  }

  clear() {
    for (const p of this.parts) {
      p.alive = false;
      p.s.visible = false;
    }
    this.active = 0;
  }
}

/* ════════════════════ DECALS (fading floor marks) ════════════════════ */

class Decal {
  s!: Sprite;
  t = 0;
  alive = false;
  a0 = 1;
}

export class DecalSystem {
  private decals: Decal[] = [];
  private cursor = 0;
  constructor(atlas: Atlas, private layer: Container) {
    for (let i = 0; i < TUNING.decals.max; i++) {
      const d = new Decal();
      d.s = new Sprite(atlas.get('splat0'));
      d.s.anchor.set(0.5);
      d.s.visible = false;
      layer.addChild(d.s);
      this.decals.push(d);
    }
  }
  add(tex: Texture, x: number, y: number, scale: number, rot: number, tint: number, alpha: number) {
    const d = this.decals[this.cursor];
    this.cursor = (this.cursor + 1) % this.decals.length;
    d.alive = true;
    d.t = 0;
    d.a0 = alpha;
    d.s.texture = tex;
    d.s.visible = true;
    d.s.x = x;
    d.s.y = y;
    d.s.rotation = rot;
    d.s.scale.set(scale);
    d.s.tint = tint;
    d.s.alpha = alpha;
  }
  update(dt: number) {
    const H = TUNING.decals.hold;
    const F = TUNING.decals.fade;
    for (const d of this.decals) {
      if (!d.alive) continue;
      d.t += dt;
      if (d.t > H) {
        const k = (d.t - H) / F;
        if (k >= 1) {
          d.alive = false;
          d.s.visible = false;
          continue;
        }
        d.s.alpha = d.a0 * (1 - k);
      }
    }
  }
  clear() {
    for (const d of this.decals) {
      d.alive = false;
      d.s.visible = false;
    }
  }
}

/* ════════════════════ DAMAGE NUMBERS ════════════════════ */

export class DmgNumber {
  c = new Container();
  digits: Sprite[] = [];
  alive = false;
  t = 0;
  value = 0;
  crit = false;
  x = 0;
  y = 0;
  vx = 0;
  color = 0xffffff;
  scale = 1;
  pop = 0;
  owner: unknown = null;
}

export class DamageNumbers {
  private nums: DmgNumber[] = [];
  constructor(private atlas: Atlas, private layer: Container) {
    for (let i = 0; i < 48; i++) {
      const n = new DmgNumber();
      for (let k = 0; k < 6; k++) {
        const s = new Sprite(atlas.get('d0'));
        s.anchor.set(0.5);
        s.visible = false;
        n.digits.push(s);
        n.c.addChild(s);
      }
      n.c.visible = false;
      layer.addChild(n.c);
      this.nums.push(n);
    }
  }

  private layout(n: DmgNumber) {
    const str = String(Math.round(n.value));
    const prefix = n.crit ? 'c' : 'd';
    const chars = n.crit ? str + '!' : str;
    const cw = n.crit ? 21 : 19;
    const total = chars.length;
    for (let k = 0; k < n.digits.length; k++) {
      const s = n.digits[k];
      if (k < total) {
        const ch = chars[k];
        s.texture = this.atlas.get(ch === '!' ? 'c!' : prefix + ch);
        s.visible = true;
        s.x = (k - (total - 1) / 2) * cw;
        s.y = 0;
        s.tint = n.crit ? 0xffffff : n.color;
      } else s.visible = false;
    }
  }

  /** show a number; merges into the owner's last number if it is still fresh */
  show(owner: unknown, x: number, y: number, value: number, crit: boolean, color: number) {
    const D = TUNING.damageNumbers;
    if (owner) {
      for (const n of this.nums) {
        if (n.alive && n.owner === owner && n.crit === crit && n.t < D.mergeWindow && !crit) {
          n.value += value;
          n.t = Math.min(n.t, 0.05);
          n.pop = 1;
          this.layout(n);
          return;
        }
      }
    }
    let best: DmgNumber | null = null;
    for (const n of this.nums) {
      if (!n.alive) {
        best = n;
        break;
      }
      if (!best || n.t > best.t) best = n;
    }
    const n = best!;
    n.alive = true;
    n.t = 0;
    n.value = value;
    n.crit = crit;
    n.owner = owner;
    n.color = color;
    n.x = x + vrange(-10, 10);
    n.y = y;
    n.vx = vrange(-30, 30);
    n.pop = 1;
    n.scale = crit ? D.critSize : D.size;
    n.c.visible = true;
    this.layout(n);
  }

  update(dt: number) {
    const D = TUNING.damageNumbers;
    for (const n of this.nums) {
      if (!n.alive) continue;
      n.t += dt;
      const life = n.crit ? D.life * 1.3 : D.life;
      if (n.t >= life) {
        n.alive = false;
        n.c.visible = false;
        continue;
      }
      const k = n.t / life;
      n.x += n.vx * dt;
      const rise = easeOutCubic(Math.min(1, n.t / (life * 0.6))) * D.rise * (n.crit ? 1.25 : 1);
      const popK = Math.min(1, n.t / D.popTime);
      const pop = D.popScale - (D.popScale - 1) * easeOutBack(popK);
      const s = n.scale * pop * (k > 0.75 ? 1 - (k - 0.75) * 2 : 1);
      n.c.scale.set(Math.max(0.01, s));
      let jx = 0;
      let jy = 0;
      if (n.crit && n.t < 0.18) {
        jx = vrange(-1, 1) * D.critShake;
        jy = vrange(-1, 1) * D.critShake;
      }
      n.c.x = n.x + jx;
      n.c.y = n.y - rise + jy;
      n.c.alpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
    }
  }

  clear() {
    for (const n of this.nums) {
      n.alive = false;
      n.c.visible = false;
    }
  }
}

/* ════════════════════ TRAILS (slashes, ghosts, rings) ════════════════════ */

export class Trail {
  s!: Sprite;
  alive = false;
  t = 0;
  max = 0.15;
  a0 = 1;
  sx0 = 1;
  sy0 = 1;
  sx1 = 1;
  sy1 = 1;
  r0 = 0;
  r1 = 0;
  follow: { x: number; y: number } | null = null;
  ox = 0;
  oy = 0;
}

export class TrailSystem {
  private items: Trail[] = [];
  constructor(atlas: Atlas, private layer: Container, cap: number) {
    for (let i = 0; i < cap; i++) {
      const t = new Trail();
      t.s = new Sprite(atlas.get('slash'));
      t.s.visible = false;
      layer.addChild(t.s);
      this.items.push(t);
    }
  }
  spawn(tex: Texture, x: number, y: number, life: number): Trail {
    let best = this.items[0];
    for (const t of this.items) {
      if (!t.alive) {
        best = t;
        break;
      }
      if (t.t / t.max > best.t / best.max) best = t;
    }
    const t = best;
    t.alive = true;
    t.t = 0;
    t.max = life;
    t.s.texture = tex;
    t.s.anchor.set(tex.defaultAnchor?.x ?? 0.5, tex.defaultAnchor?.y ?? 0.5);
    t.s.visible = true;
    t.s.x = x;
    t.s.y = y;
    t.s.alpha = 1;
    t.s.tint = 0xffffff;
    t.a0 = 1;
    t.follow = null;
    t.ox = t.oy = 0;
    t.r0 = t.r1 = 0;
    return t;
  }
  update(dt: number) {
    for (const t of this.items) {
      if (!t.alive) continue;
      t.t += dt;
      const k = t.t / t.max;
      if (k >= 1) {
        t.alive = false;
        t.s.visible = false;
        continue;
      }
      const e = easeOutCubic(k);
      if (t.follow) {
        t.s.x = t.follow.x + t.ox;
        t.s.y = t.follow.y + t.oy;
      }
      t.s.scale.set(t.sx0 + (t.sx1 - t.sx0) * e, t.sy0 + (t.sy1 - t.sy0) * e);
      t.s.rotation = t.r0 + (t.r1 - t.r0) * e;
      t.s.alpha = t.a0 * (1 - k * k);
    }
  }
  clear() {
    for (const t of this.items) {
      t.alive = false;
      t.s.visible = false;
    }
  }
}

/* ════════════════════ CAMERA SHAKE ════════════════════ */

export class Shake {
  trauma = 0;
  kx = 0;
  ky = 0;
  kvx = 0;
  kvy = 0;
  ox = 0;
  oy = 0;
  angle = 0;
  private t = 0;
  intensity = 1;

  add(trauma: number) {
    this.trauma = clamp(this.trauma + trauma * this.intensity, 0, 1);
  }
  kick(dx: number, dy: number, power: number) {
    const k = TUNING.shake.kickPerPower * power * this.intensity;
    this.kvx += dx * k * 30;
    this.kvy += dy * k * 30;
  }
  update(dt: number) {
    const S = TUNING.shake;
    this.t += dt;
    this.trauma = Math.max(0, this.trauma - S.decay * dt);
    // spring for directional kick
    springStep(this.kx, this.kvx, S.kickSpring, S.kickDamping, dt, SP);
    this.kx = SP[0];
    this.kvx = SP[1];
    springStep(this.ky, this.kvy, S.kickSpring, S.kickDamping, dt, SP);
    this.ky = SP[0];
    this.kvy = SP[1];
    const a = this.trauma * this.trauma;
    const f = S.frequency;
    const nx = Math.sin(this.t * f * 1.13) * 0.6 + Math.sin(this.t * f * 2.37 + 1.3) * 0.4;
    const ny = Math.sin(this.t * f * 1.31 + 2.1) * 0.6 + Math.sin(this.t * f * 2.71 + 0.4) * 0.4;
    const na = Math.sin(this.t * f * 0.91 + 4.2);
    this.ox = nx * S.maxOffset * a + this.kx;
    this.oy = ny * S.maxOffset * a + this.ky;
    this.angle = na * S.maxAngle * a;
  }
}

export const rnd = vrand;
