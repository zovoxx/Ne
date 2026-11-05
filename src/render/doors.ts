import { Container, Sprite, Text } from 'pixi.js';
import type { Game } from '../game/game';
import type { RoomController } from '../game/room';
import type { Atlas } from './atlas';
import { PATRONS } from '../game/boons/patrons';
import { vrand, vrange } from '../game/math';
import type { ParticleSystem } from './fx';

export interface DoorView {
  update(g: Game, dt: number): void;
}

const ROOM_BADGE: Record<string, { icon: string; color: number; label: string }> = {
  combat: { icon: 'ic_sword', color: 0xffffff, label: '' },
  elite: { icon: 'ic_crown', color: 0xffd166, label: 'ELITE' },
  mini: { icon: 'ic_horns', color: 0xff8a3d, label: 'GUARDIAN' },
  boss: { icon: 'ic_skull', color: 0xff3d6e, label: 'BOSS' },
  shop: { icon: 'ic_bag', color: 0xffd166, label: 'MOTH-MARKET' },
  spring: { icon: 'ic_drop', color: 0x5dff9a, label: 'SPRING' },
  ordeal: { icon: 'ic_eye', color: 0xff7aa8, label: 'ORDEAL' },
};
const REWARD_ICON: Record<string, { icon: string; color: number; label: string }> = {
  forge: { icon: 'ic_forge', color: 0xffb347, label: 'Forge' },
  kindle: { icon: 'ic_kindle', color: 0xffd27a, label: 'Kindle' },
  heart: { icon: 'ic_heart', color: 0xff5d7a, label: 'Heart' },
  gold: { icon: 'ic_gold', color: 0xffd166, label: 'Gold' },
};
export const PATRON_ICON: Record<string, string> = {
  ember: 'ic_ember',
  rime: 'ic_rime',
  storm: 'ic_storm',
  tide: 'ic_tide',
  dawn: 'ic_dawn',
  umbra: 'ic_umbra',
  gale: 'ic_gale',
  thorn: 'ic_thorn',
};

class DoorSprite {
  root = new Container();
  ring!: Sprite;
  ring2!: Sprite;
  glow!: Sprite;
  icon!: Sprite;
  badge!: Sprite;
  label!: Text;
  key = '';
}

class ShopSprite {
  root = new Container();
  ped!: Sprite;
  icon!: Sprite;
  glow!: Sprite;
  price!: Text;
}

/** Renders doors (with their rewards) and shop pedestals for the current room. */
export class Doors implements DoorView {
  private items: DoorSprite[] = [];
  private shops: ShopSprite[] = [];
  private t = 0;
  constructor(private atlas: Atlas, private layer: Container, private parts: ParticleSystem, private room: () => RoomController | null) {}

  private makeDoor(): DoorSprite {
    const A = this.atlas;
    const d = new DoorSprite();
    d.glow = new Sprite(A.get('glow'));
    d.glow.blendMode = 'add';
    d.ring = new Sprite(A.get('portalRing'));
    d.ring.blendMode = 'add';
    d.ring2 = new Sprite(A.get('portalRing'));
    d.ring2.blendMode = 'add';
    d.icon = new Sprite(A.get('ic_sword'));
    d.badge = new Sprite(A.get('ic_sword'));
    d.label = new Text({
      text: '',
      style: { fontFamily: 'system-ui, -apple-system, Segoe UI, Arial', fontSize: 12, fontWeight: '900', fill: 0xffffff, stroke: { color: 0x0b0711, width: 4 }, letterSpacing: 1.2, align: 'center', lineHeight: 14 },
      resolution: 2,
    });
    d.label.anchor.set(0.5, 0);
    d.root.addChild(d.glow, d.ring, d.ring2, d.icon, d.badge, d.label);
    this.layer.addChild(d.root);
    return d;
  }

  private makeShop(): ShopSprite {
    const A = this.atlas;
    const s = new ShopSprite();
    s.ped = new Sprite(A.get('pedestal'));
    s.glow = new Sprite(A.get('glow'));
    s.glow.blendMode = 'add';
    s.icon = new Sprite(A.get('ic_gold'));
    s.price = new Text({
      text: '',
      style: { fontFamily: 'system-ui, -apple-system, Segoe UI, Arial', fontSize: 14, fontWeight: '900', fill: 0xffd166, stroke: { color: 0x0b0711, width: 4 } },
      resolution: 2,
    });
    s.price.anchor.set(0.5, 0);
    s.root.addChild(s.ped, s.glow, s.icon, s.price);
    this.layer.addChild(s.root);
    return s;
  }

  update(g: Game, dt: number) {
    this.t += dt;
    const rc = this.room();
    const doors = rc && !rc.trans ? rc.doors : [];
    while (this.items.length < doors.length) this.items.push(this.makeDoor());
    for (let i = 0; i < this.items.length; i++) {
      const v = this.items[i];
      const d = doors[i];
      v.root.visible = !!d;
      if (!d) continue;
      const plan = d.plan;
      const key = `${plan.type}|${plan.reward}|${plan.patron}|${plan.seed}`;
      const badge = ROOM_BADGE[plan.type] ?? ROOM_BADGE.combat;
      let color = badge.color;
      let iconKey = badge.icon;
      let label = badge.label;
      if (plan.type !== 'shop' && plan.type !== 'spring' && plan.type !== 'boss') {
        if (plan.reward === 'boon' && plan.patron) {
          const P = PATRONS[plan.patron];
          color = P.color;
          iconKey = PATRON_ICON[plan.patron];
          label = (label ? label + '\n' : '') + P.name.toUpperCase();
        } else if (REWARD_ICON[plan.reward]) {
          const R = REWARD_ICON[plan.reward];
          color = R.color;
          iconKey = R.icon;
          label = (label ? label + '\n' : '') + R.label.toUpperCase();
        }
      }
      if (v.key !== key) {
        v.key = key;
        v.icon.texture = this.atlas.get(iconKey);
        v.badge.texture = this.atlas.get(badge.icon);
        v.badge.visible = plan.type !== 'combat' && iconKey !== badge.icon;
        v.label.text = label;
      }
      const appear = Math.min(1, d.t / 0.2);
      v.root.x = d.x;
      v.root.y = d.y;
      v.root.zIndex = d.y - 1;
      const pulse = 1 + Math.sin(this.t * 5 + i) * 0.04;
      const s = ((d.r * 2.4) / 96) * appear * pulse;
      v.ring.scale.set(s);
      v.ring.rotation = this.t * 1.4;
      v.ring.tint = color;
      v.ring2.scale.set(s * 0.78);
      v.ring2.rotation = -this.t * 2.2;
      v.ring2.tint = 0xffffff;
      v.ring2.alpha = 0.6;
      v.glow.scale.set(((d.r * 3.2) / 64) * appear);
      v.glow.tint = color;
      v.glow.alpha = 0.45 + Math.sin(this.t * 4 + i) * 0.1;
      v.icon.tint = color;
      v.icon.scale.set(appear * 1.05);
      v.icon.y = -d.r - 26 + Math.sin(this.t * 3 + i) * 3;
      v.badge.tint = badge.color;
      v.badge.scale.set(0.6 * appear);
      v.badge.x = 20;
      v.badge.y = v.icon.y - 16;
      v.label.y = d.r + 8;
      v.label.alpha = appear;
      v.label.style.fill = color;
      if (vrand() < 0.35) {
        const a = vrand() * Math.PI * 2;
        const p = this.parts.spawn(this.atlas.get('dot'), d.x + Math.cos(a) * d.r, d.y + Math.sin(a) * d.r, true);
        p.vx = -Math.cos(a) * 40;
        p.vy = -Math.sin(a) * 40 - 20;
        p.max = vrange(0.4, 0.8);
        p.s0 = 0.7;
        p.s1 = 0;
        p.s.tint = color;
      }
    }
    // shop pedestals
    const shop = rc && !rc.trans ? rc.shop : [];
    while (this.shops.length < shop.length) this.shops.push(this.makeShop());
    for (let i = 0; i < this.shops.length; i++) {
      const v = this.shops[i];
      const it = shop[i];
      v.root.visible = !!it && !it.sold;
      if (!it || it.sold) continue;
      v.root.x = it.x;
      v.root.y = it.y;
      v.root.zIndex = it.y;
      v.ped.y = 10;
      const ic = it.kind === 'boon' ? PATRON_ICON[it.patron ?? 'ember'] : it.kind === 'heal' ? 'ic_drop' : it.kind === 'kindle' ? 'ic_kindle' : it.kind === 'forge' ? 'ic_forge' : it.kind === 'heart' ? 'ic_heart' : 'ic_die';
      v.icon.texture = this.atlas.get(ic);
      const col = it.kind === 'boon' ? PATRONS[(it.patron ?? 'ember') as keyof typeof PATRONS].color : it.kind === 'heal' ? 0x5dff9a : it.kind === 'heart' ? 0xff5d7a : 0xffd27a;
      v.icon.tint = col;
      v.icon.y = -16 + Math.sin(this.t * 3 + i) * 3;
      v.glow.tint = col;
      v.glow.y = v.icon.y;
      v.glow.alpha = 0.4;
      v.glow.scale.set(1.1);
      const affordable = g.gold >= it.price;
      v.price.text = `${it.price}`;
      v.price.y = 30;
      v.price.style.fill = affordable ? 0xffd166 : 0x8a7a6a;
    }
  }

  clear() {
    for (const v of this.items) v.root.visible = false;
    for (const s of this.shops) s.root.visible = false;
  }
}
