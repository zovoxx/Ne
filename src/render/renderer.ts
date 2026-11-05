import { Application, Container, Graphics, Sprite, TilingSprite, type Texture } from 'pixi.js';
import { TUNING } from '../config/tuning';
import { Atlas } from './atlas';
import { DamageNumbers, DecalSystem, ParticleSystem, Shake, TrailSystem, type Particle } from './fx';
import { BIOME_LOOKS, makeFloorTexture, makeVignette } from './floor';
import type { Game } from '../game/game';
import { Corpse, Enemy, Hazard, HZ, Pickup, PK, Projectile, TEAM_ENEMY, Telegraph, TG } from '../game/entities';
import { EV, type GameEvent } from '../game/events';
import { clamp, damp, lerp, springStep, vrand, vrange } from '../game/math';
const SP = [0, 0];
import { PH } from '../game/player';
import { PJ } from '../game/projectiles';
import { ELEMENT_COLOR } from '../game/effects';
import { shade } from './art/kit';
import type { DoorView } from './doors';

const TAU = Math.PI * 2;

/* ─────────────── view classes ─────────────── */

class EnemyView {
  entId = 0;
  ent: Enemy | null = null;
  seen = false;
  root = new Container();
  shadow!: Sprite;
  aura!: Sprite;
  body!: Sprite;
  flash!: Sprite;
  hpBg!: Sprite;
  hpFill!: Sprite;
  hpArmor!: Sprite;
  shield!: Sprite;
  bubble!: Sprite;
  crown!: Sprite;
  sq = 0;
  sqv = 0;
  sqAxisX = true;
  flashT = 0;
  flashDur = 0.09;
  flashColor = 0xffffff;
  hpShow = 0;
  wob = 0;
  baseScale = 1;
  spawnPop = 0;
}

class ProjView {
  entId = 0;
  ent: Projectile | null = null;
  seen = false;
  root = new Container();
  glow!: Sprite;
  body!: Sprite;
  shadow!: Sprite;
  mark!: Sprite;
  markFill!: Sprite;
}

class HzView {
  entId = 0;
  ent: Hazard | null = null;
  seen = false;
  root = new Container();
  a!: Sprite;
  b!: Sprite;
  c!: Sprite;
  t = 0;
  emitT = 0;
}

class TgView {
  entId = 0;
  ent: Telegraph | null = null;
  seen = false;
  root = new Container();
  disc!: Sprite;
  edge!: Sprite;
  bar!: Sprite;
  fill!: Sprite;
  gfx = new Graphics();
}

class SimpleView {
  entId = 0;
  ent: Corpse | Pickup | null = null;
  seen = false;
  root = new Container();
  a!: Sprite;
  b!: Sprite;
  glow!: Sprite;
}

type AnyView = { entId: number; seen: boolean; root: Container; ent: unknown };

class ViewPool<V extends AnyView> {
  active: V[] = [];
  free: V[] = [];
  constructor(private make: () => V, private layer: Container) {}
  sync<E extends { active: boolean; id: number; view: unknown }>(list: E[], assign: (v: V, e: E) => void, update: (v: V, e: E) => void) {
    for (const v of this.active) v.seen = false;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.active) continue;
      let v = e.view as V | null;
      if (!v || v.entId !== e.id || v.ent !== e) {
        v = this.free.pop() ?? this.make();
        if (!v.root.parent) this.layer.addChild(v.root);
        v.root.visible = true;
        v.entId = e.id;
        v.ent = e;
        e.view = v;
        assign(v, e);
        this.active.push(v);
      }
      v.seen = true;
      update(v, e);
    }
    let w = 0;
    for (let i = 0; i < this.active.length; i++) {
      const v = this.active[i];
      if (v.seen) this.active[w++] = v;
      else {
        v.root.visible = false;
        v.entId = -1;
        v.ent = null;
        this.free.push(v);
      }
    }
    this.active.length = w;
  }
  clear() {
    for (const v of this.active) {
      v.root.visible = false;
      v.entId = -1;
      v.ent = null;
      this.free.push(v);
    }
    this.active.length = 0;
  }
}

/* ─────────────── renderer ─────────────── */

export class Renderer {
  app = new Application();
  atlas = new Atlas();
  world = new Container();
  floorLayer = new Container();
  decalLayer = new Container();
  groundLayer = new Container();
  entityLayer = new Container();
  projLayer = new Container();
  fxNormal = new Container();
  fxAdd = new Container();
  trailLayer = new Container();
  numberLayer = new Container();
  overlay = new Container();
  particles!: ParticleSystem;
  decals!: DecalSystem;
  numbers!: DamageNumbers;
  trails!: TrailSystem;
  shake = new Shake();
  floor: TilingSprite | null = null;
  walls = new Graphics();
  floorTex: Texture[] = [];
  vignette!: Sprite;
  hurtFlash!: Sprite;
  whiteFlash!: Sprite;
  streakEdge!: Sprite;
  lowHp!: Sprite;
  enemyViews!: ViewPool<EnemyView>;
  projViews!: ViewPool<ProjView>;
  hzViews!: ViewPool<HzView>;
  tgViews!: ViewPool<TgView>;
  corpseViews!: ViewPool<SimpleView>;
  pickupViews!: ViewPool<SimpleView>;
  player = {
    root: new Container(),
    shadow: null as unknown as Sprite,
    light: null as unknown as Sprite,
    body: null as unknown as Sprite,
    flash: null as unknown as Sprite,
    weapon: null as unknown as Sprite,
    weapon2: null as unknown as Sprite,
    target: null as unknown as Sprite,
    sq: 0,
    sqv: 0,
    flashT: 0,
    weaponKey: '',
    ghostT: 0,
  };
  doors: DoorView | null = null;
  cam = { x: 0, y: 0, zoom: 1 };
  screenW = 800;
  screenH = 400;
  baseScale = 1;
  biome = -1;
  time = 0;
  hurtT = 0;
  whiteT = 0;
  streakGlow = 0;
  streakColor = 0xffffff;
  /** quality governor 0..1 (1 = full effects) */
  quality = 1;
  private arenaKey = '';

  async init(parent: HTMLElement) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    await this.app.init({
      resizeTo: parent,
      background: '#050308',
      antialias: false,
      resolution: dpr,
      autoDensity: true,
      powerPreference: 'high-performance',
      autoStart: false,
      sharedTicker: false,
    });
    this.app.ticker?.stop();
    parent.appendChild(this.app.canvas);
    await this.atlas.build();
    const A = this.atlas;
    this.world.addChild(this.floorLayer, this.walls, this.decalLayer, this.groundLayer, this.entityLayer, this.projLayer, this.fxNormal, this.trailLayer, this.fxAdd, this.numberLayer);
    this.entityLayer.sortableChildren = true;
    this.app.stage.addChild(this.world, this.overlay);
    this.fxAdd.blendMode = 'add';
    this.trailLayer.blendMode = 'add';
    this.particles = new ParticleSystem(A, this.fxNormal, this.fxAdd, TUNING.particles.max);
    this.decals = new DecalSystem(A, this.decalLayer);
    this.numbers = new DamageNumbers(A, this.numberLayer);
    this.trails = new TrailSystem(A, this.trailLayer, 48);
    for (let b = 0; b < 4; b++) this.floorTex.push(makeFloorTexture(b));
    // overlays
    const vt = makeVignette();
    this.vignette = new Sprite(vt);
    this.hurtFlash = new Sprite(vt);
    this.hurtFlash.tint = 0xff1a2e;
    this.hurtFlash.alpha = 0;
    this.streakEdge = new Sprite(vt);
    this.streakEdge.alpha = 0;
    this.streakEdge.blendMode = 'add';
    this.lowHp = new Sprite(vt);
    this.lowHp.tint = 0xaa0018;
    this.lowHp.alpha = 0;
    this.whiteFlash = new Sprite(A.get('px'));
    this.whiteFlash.alpha = 0;
    this.whiteFlash.blendMode = 'add';
    this.overlay.addChild(this.vignette, this.lowHp, this.streakEdge, this.hurtFlash, this.whiteFlash);
    this.buildPlayerView();
    this.enemyViews = new ViewPool(() => this.makeEnemyView(), this.entityLayer);
    this.projViews = new ViewPool(() => this.makeProjView(), this.projLayer);
    this.hzViews = new ViewPool(() => this.makeHzView(), this.groundLayer);
    this.tgViews = new ViewPool(() => this.makeTgView(), this.groundLayer);
    this.corpseViews = new ViewPool(() => this.makeSimpleView(), this.entityLayer);
    this.pickupViews = new ViewPool(() => this.makeSimpleView(), this.entityLayer);
    this.resize();
  }

  resize() {
    const r = this.app.renderer;
    this.screenW = r.width / r.resolution;
    this.screenH = r.height / r.resolution;
    const V = TUNING.view;
    this.baseScale = Math.min(this.screenH / V.height, this.screenW / V.minWidth);
    for (const s of [this.vignette, this.hurtFlash, this.streakEdge, this.lowHp]) {
      s.width = this.screenW;
      s.height = this.screenH;
    }
    this.whiteFlash.width = this.screenW;
    this.whiteFlash.height = this.screenH;
  }

  /* ─────────────── room setup ─────────────── */

  setRoom(g: Game) {
    const A = g.arena;
    const key = `${g.biome}|${A.x0}|${A.y0}|${A.x1}|${A.y1}|${A.pillars.map((p) => p.x + ',' + p.y).join(';')}`;
    if (key === this.arenaKey) return;
    this.arenaKey = key;
    const L = BIOME_LOOKS[g.biome] ?? BIOME_LOOKS[0];
    this.biome = g.biome;
    if (this.floor) this.floor.destroy();
    const pad = 40;
    this.floor = new TilingSprite({ texture: this.floorTex[g.biome] ?? this.floorTex[0], width: A.x1 - A.x0 + pad * 2, height: A.y1 - A.y0 + pad * 2 });
    this.floor.x = A.x0 - pad;
    this.floor.y = A.y0 - pad;
    this.floorLayer.addChild(this.floor);
    this.vignette.tint = L.vignette;
    const w = this.walls;
    w.clear();
    const big = 2400;
    const x0 = A.x0;
    const y0 = A.y0;
    const x1 = A.x1;
    const y1 = A.y1;
    // outer darkness
    w.rect(x0 - big, y0 - big, x1 - x0 + big * 2, big).fill({ color: L.wall });
    w.rect(x0 - big, y1, x1 - x0 + big * 2, big).fill({ color: L.wall });
    w.rect(x0 - big, y0, big, y1 - y0).fill({ color: L.wall });
    w.rect(x1, y0, big, y1 - y0).fill({ color: L.wall });
    // wall bands (top band is taller: reads as a wall face in 3/4 view)
    w.rect(x0 - 26, y0 - 70, x1 - x0 + 52, 70).fill({ color: shade(L.wallEdge, 0.7) });
    w.rect(x0 - 26, y0 - 70, x1 - x0 + 52, 10).fill({ color: shade(L.wallEdge, 1.3) });
    w.rect(x0 - 26, y1, x1 - x0 + 52, 26).fill({ color: shade(L.wallEdge, 0.55) });
    w.rect(x0 - 26, y0, 26, y1 - y0).fill({ color: shade(L.wallEdge, 0.6) });
    w.rect(x1, y0, 26, y1 - y0).fill({ color: shade(L.wallEdge, 0.6) });
    // glowing inner edge
    w.rect(x0, y0, x1 - x0, y1 - y0).stroke({ width: 3, color: L.wallGlow, alpha: 0.55 });
    w.rect(x0 + 4, y0 + 4, x1 - x0 - 8, y1 - y0 - 8).stroke({ width: 1, color: L.wallGlow, alpha: 0.18 });
    // inner edge shading
    w.rect(x0, y0, x1 - x0, 26).fill({ color: 0x000000, alpha: 0.25 });
    // wall sconces along the top wall
    for (let x = x0 + 120; x < x1 - 60; x += 240) {
      w.circle(x, y0 - 34, 9).fill({ color: L.wallGlow, alpha: 0.9 });
      w.circle(x, y0 - 34, 20).fill({ color: L.wallGlow, alpha: 0.12 });
    }
    // pillars
    for (const p of A.pillars) {
      w.ellipse(p.x, p.y + p.r * 0.35, p.r * 1.15, p.r * 0.6).fill({ color: 0x000000, alpha: 0.4 });
      w.circle(p.x, p.y, p.r).fill({ color: L.pillar });
      w.circle(p.x, p.y - p.r * 0.25, p.r * 0.82).fill({ color: L.pillarTop });
      w.circle(p.x, p.y - p.r * 0.25, p.r * 0.82).stroke({ width: 2, color: L.wallGlow, alpha: 0.35 });
      w.circle(p.x, p.y - p.r * 0.3, p.r * 0.35).fill({ color: L.wallGlow, alpha: 0.18 });
    }
    for (const p of A.pits) {
      w.circle(p.x, p.y, p.r).fill({ color: 0x000000, alpha: 0.85 });
      w.circle(p.x, p.y, p.r).stroke({ width: 3, color: L.wallGlow, alpha: 0.4 });
    }
  }

  clearRoomFx() {
    this.particles.clear();
    this.decals.clear();
    this.numbers.clear();
    this.trails.clear();
    this.enemyViews.clear();
    this.projViews.clear();
    this.hzViews.clear();
    this.tgViews.clear();
    this.corpseViews.clear();
    this.pickupViews.clear();
  }

  /* ─────────────── view factories ─────────────── */

  private buildPlayerView() {
    const A = this.atlas;
    const P = this.player;
    P.shadow = new Sprite(A.get('shadow'));
    P.shadow.scale.set(0.95);
    P.light = new Sprite(A.get('glow'));
    P.light.blendMode = 'add';
    P.light.tint = 0xffc27a;
    P.light.alpha = 0.22;
    P.light.scale.set(5.5);
    P.body = new Sprite(A.get('player'));
    P.flash = new Sprite(A.silhouette('player'));
    P.flash.alpha = 0;
    P.weapon = new Sprite(A.get('w_fangs'));
    P.weapon2 = new Sprite(A.get('w_fangs'));
    P.target = new Sprite(A.get('tgEdge'));
    P.target.scale.set(0.42);
    P.target.tint = 0xfff1a6;
    P.target.alpha = 0;
    this.groundLayer.addChild(P.target);
    P.root.addChild(P.light, P.shadow, P.weapon2, P.body, P.flash, P.weapon);
    P.shadow.y = 2;
    this.entityLayer.addChild(P.root);
  }

  private makeEnemyView(): EnemyView {
    const A = this.atlas;
    const v = new EnemyView();
    v.shadow = new Sprite(A.get('shadow'));
    v.aura = new Sprite(A.get('glow'));
    v.aura.blendMode = 'add';
    v.aura.visible = false;
    v.body = new Sprite(A.get('dot'));
    v.flash = new Sprite(A.get('dot'));
    v.flash.alpha = 0;
    v.shield = new Sprite(A.get('slash'));
    v.shield.visible = false;
    v.shield.blendMode = 'add';
    v.bubble = new Sprite(A.get('ring'));
    v.bubble.visible = false;
    v.bubble.blendMode = 'add';
    v.crown = new Sprite(A.get('shard'));
    v.crown.visible = false;
    v.hpBg = new Sprite(A.get('px'));
    v.hpBg.tint = 0x000000;
    v.hpBg.alpha = 0.7;
    v.hpFill = new Sprite(A.get('px'));
    v.hpArmor = new Sprite(A.get('px'));
    v.hpArmor.tint = 0xc8d2e6;
    v.root.addChild(v.aura, v.shadow, v.body, v.flash, v.shield, v.bubble, v.crown, v.hpBg, v.hpFill, v.hpArmor);
    return v;
  }

  private makeProjView(): ProjView {
    const A = this.atlas;
    const v = new ProjView();
    v.shadow = new Sprite(A.get('shadow'));
    v.mark = new Sprite(A.get('tgEdge'));
    v.markFill = new Sprite(A.get('tgDisc'));
    v.glow = new Sprite(A.get('glow'));
    v.glow.blendMode = 'add';
    v.body = new Sprite(A.get('bullet'));
    v.root.addChild(v.markFill, v.mark, v.shadow, v.glow, v.body);
    return v;
  }

  private makeHzView(): HzView {
    const A = this.atlas;
    const v = new HzView();
    v.a = new Sprite(A.get('glow'));
    v.b = new Sprite(A.get('glow'));
    v.c = new Sprite(A.get('glow'));
    v.root.addChild(v.a, v.b, v.c);
    return v;
  }

  private makeTgView(): TgView {
    const A = this.atlas;
    const v = new TgView();
    v.disc = new Sprite(A.get('tgDisc'));
    v.edge = new Sprite(A.get('tgEdge'));
    v.bar = new Sprite(A.get('tgBar'));
    v.fill = new Sprite(A.get('tgBarFill'));
    v.root.addChild(v.disc, v.edge, v.bar, v.fill, v.gfx);
    return v;
  }

  private makeSimpleView(): SimpleView {
    const A = this.atlas;
    const v = new SimpleView();
    v.glow = new Sprite(A.get('glow'));
    v.glow.blendMode = 'add';
    v.a = new Sprite(A.get('dot'));
    v.b = new Sprite(A.get('dot'));
    v.root.addChild(v.glow, v.a, v.b);
    return v;
  }

  /* ─────────────── per-frame ─────────────── */

  render(g: Game, realDt: number) {
    if (!(realDt >= 0)) realDt = 0;
    realDt = Math.min(realDt, 1 / 20);
    this.time += realDt;
    const fxDt = realDt * Math.max(g.fxScale, g.mode === 'play' || g.mode === 'dying' ? 0 : 1) || 0;
    const fx = g.hitstopT > 0 ? realDt * TUNING.hitstop.fxSpeedDuringStop : realDt * (g.mode === 'play' || g.mode === 'dying' ? g.fxScale : 0.0);
    this.particles.update(fx);
    this.trails.update(fx || realDt * 0.0);
    this.numbers.update(realDt * (g.hitstopT > 0 ? 0.35 : Math.max(0.35, g.fxScale)));
    this.decals.update(fx);
    void fxDt;
    this.syncPlayer(g, realDt);
    this.enemyViews.sync(g.enemies.live, (v, e) => this.assignEnemy(v, e), (v, e) => this.updateEnemy(g, v, e, realDt));
    this.projViews.sync(g.projectiles.live, (v, e) => this.assignProj(v, e), (v, e) => this.updateProj(g, v, e));
    this.hzViews.sync(g.hazards.live, (v, e) => this.assignHz(g, v, e), (v, e) => this.updateHz(g, v, e, fx));
    this.tgViews.sync(g.telegraphs.live, (v, e) => this.assignTg(v, e), (v, e) => this.updateTg(g, v, e));
    this.corpseViews.sync(g.corpses.live, (v, e) => this.assignCorpse(v, e), (v, e) => this.updateCorpse(v, e, fx));
    this.pickupViews.sync(g.pickups.live, (v, e) => this.assignPickup(v, e), (v, e) => this.updatePickup(v, e));
    this.doors?.update(g, realDt);
    this.updateCamera(g, realDt);
    this.updateOverlay(g, realDt);
    this.app.render();
  }

  private syncPlayer(g: Game, dt: number) {
    const P = this.player;
    const p = g.player;
    const A = this.atlas;
    P.root.x = p.x;
    P.root.y = p.y;
    P.root.zIndex = p.y;
    P.root.visible = !p.dead || g.mode === 'dying';
    const wkey = 'w_' + p.weapon.id;
    if (P.weaponKey !== wkey) {
      P.weaponKey = wkey;
      P.weapon.texture = A.get(wkey);
      P.weapon2.texture = A.get(wkey);
      P.weapon2.visible = p.weapon.id === 'fangs';
    }
    // squash spring
    const S = TUNING.squash;
    springStep(P.sq, P.sqv, S.freq * S.freq, 2 * S.damp, dt, SP);
    P.sq = SP[0];
    P.sqv = SP[1];
    const flip = Math.cos(p.facing) < 0 ? -1 : 1;
    let sx = 1 + P.sq;
    let sy = 1 - P.sq * 0.8;
    // run bob
    const sp = Math.hypot(p.vx, p.vy);
    const bob = sp > 40 ? Math.sin(this.time * 18) * 0.035 : Math.sin(this.time * 3) * 0.015;
    sy += bob;
    P.body.scale.set(sx * flip, sy);
    P.flash.scale.set(sx * flip, sy);
    P.body.rotation = sp > 40 ? Math.sin(this.time * 9) * 0.05 + (p.vx / 345) * 0.08 : 0;
    P.flash.rotation = P.body.rotation;
    // hurt flash + i-frame flicker
    P.flashT = Math.max(0, P.flashT - dt);
    P.flash.alpha = P.flashT > 0 ? P.flashT / 0.18 : 0;
    P.flash.tint = 0xff3344;
    const flicker = p.hurtT > 0 && Math.floor(this.time * 24) % 2 === 0;
    P.body.alpha = flicker ? 0.35 : 1;
    if (p.dashing) {
      P.body.alpha = 0.85;
      P.ghostT -= dt;
      if (P.ghostT <= 0) {
        P.ghostT = TUNING.dash.duration / TUNING.trails.dashGhosts;
        const t = this.trails.spawn(A.silhouette('player'), p.x, p.y, TUNING.trails.ghostLife);
        t.s.anchor.set(0.5, 0.62);
        t.sx0 = t.sx1 = flip * (1 + P.sq);
        t.sy0 = t.sy1 = 1 - P.sq * 0.8;
        t.a0 = 0.5;
        t.s.tint = this.dashTint(g);
      }
    }
    // lantern light
    P.light.alpha = 0.2 + Math.sin(this.time * 7) * 0.02 + g.streakTier * 0.03;
    // weapon pose
    this.poseWeapon(g, flip);
    // target marker
    const t = p.target;
    if (t && t.active && !p.dead) {
      P.target.x = t.x;
      P.target.y = t.y + t.r * 0.5;
      P.target.scale.set(((t.r + 10) * 2) / 128);
      P.target.alpha = damp(P.target.alpha, 0.55, 14, dt);
      P.target.rotation += dt * 2;
    } else P.target.alpha = damp(P.target.alpha, 0, 14, dt);
  }

  private dashTint(g: Game) {
    const el = g.stats.infuse.dash;
    return el ? ELEMENT_COLOR[el] : 0x8fe8ff;
  }

  private poseWeapon(g: Game, flip: number) {
    const P = this.player;
    const p = g.player;
    const w = P.weapon;
    const w2 = P.weapon2;
    let ang = p.facing + 0.75 * flip;
    let off = 14;
    let ang2 = p.facing - 0.9 * flip;
    const a = p.act;
    if (a && (a.kind === 'attack' || a.kind === 'dashAttack' || a.kind === 'special')) {
      const side = (a.step ?? 0) % 2 === 0 ? 1 : -1;
      const base = p.actAngle;
      if (a.finisher && p.weapon.id === 'fangs') {
        const k = p.phase === PH.Windup ? 0 : p.phase === PH.Active ? p.phaseT / Math.max(0.01, a.active) : 1;
        ang = base + k * TAU * 1.2;
        ang2 = ang + Math.PI;
        off = 18;
      } else if (p.weapon.id === 'pike' || a.kind === 'dashAttack') {
        ang = base;
        const k = p.phase === PH.Windup ? -0.3 : p.phase === PH.Active ? 1 : 1 - Math.min(1, p.phaseT / Math.max(0.01, a.recovery));
        off = 10 + k * 22;
        ang2 = base;
      } else {
        const back = base - side * 1.1;
        const fwd = base + side * 1.2;
        if (p.phase === PH.Windup || p.phase === PH.Hold) ang = back;
        else if (p.phase === PH.Active) ang = lerp(back, fwd, Math.min(1, p.phaseT / Math.max(0.01, a.active)));
        else ang = fwd;
        ang2 = base + side * 0.6;
        off = 16;
      }
    }
    w.x = Math.cos(ang) * off;
    w.y = Math.sin(ang) * off * 0.8 - 6;
    w.rotation = ang;
    w2.x = Math.cos(ang2) * 12;
    w2.y = Math.sin(ang2) * 10 - 6;
    w2.rotation = ang2;
    w2.scale.y = -1;
    // draw weapon behind the body when pointing up
    w.zIndex = Math.sin(ang) < -0.2 ? -1 : 1;
  }

  /* ─────────────── enemies ─────────────── */

  private assignEnemy(v: EnemyView, e: Enemy) {
    const A = this.atlas;
    const art = e.def.art;
    v.body.texture = A.get(art);
    v.flash.texture = A.silhouette(art);
    const tex = A.get(art);
    // normalise: sprites are authored so their footprint matches def radius
    v.baseScale = 1;
    v.shadow.scale.set(((e.r * 2.2) / 48) * (e.flying ? 0.7 : 1), ((e.r * 1.1) / 20) * (e.flying ? 0.7 : 1));
    v.shadow.y = e.flying ? e.r * 0.9 : e.r * 0.35;
    v.sq = 0;
    v.sqv = 0;
    v.flashT = 0;
    v.hpShow = 0;
    v.spawnPop = 0;
    v.aura.visible = !!e.elite || e.isMini || e.isBoss;
    v.crown.visible = !!e.elite;
    v.flash.alpha = 0;
    v.root.alpha = 1;
    void tex;
  }

  private updateEnemy(g: Game, v: EnemyView, e: Enemy, dt: number) {
    v.root.x = e.x;
    v.root.y = e.y;
    v.root.zIndex = e.y;
    // spawning in
    if (e.spawnT > 0) {
      v.body.visible = false;
      v.shadow.visible = false;
      v.flash.alpha = 0;
      v.hpBg.visible = v.hpFill.visible = v.hpArmor.visible = false;
      v.aura.visible = false;
      return;
    }
    v.body.visible = true;
    v.shadow.visible = true;
    // squash
    const S = TUNING.squash;
    springStep(v.sq, v.sqv, S.freq * S.freq, 2 * S.damp, dt * (g.hitstopT > 0 ? 0.15 : 1), SP);
    v.sq = clamp(SP[0], -0.6, 0.6);
    v.sqv = SP[1];
    v.spawnPop = Math.min(1, v.spawnPop + dt * 7);
    const pop = v.spawnPop < 1 ? 0.4 + 0.6 * v.spawnPop + Math.sin(v.spawnPop * Math.PI) * 0.25 : 1;
    let sx = v.sqAxisX ? 1 + v.sq : 1 - v.sq * 0.7;
    let sy = v.sqAxisX ? 1 - v.sq * 0.7 : 1 + v.sq;
    // walk wobble
    const sp = Math.hypot(e.vx, e.vy);
    v.wob += dt * (sp > 20 ? 14 : 3);
    const wob = sp > 20 ? Math.sin(v.wob) * 0.06 : Math.sin(v.wob) * 0.02;
    sy *= 1 + wob * 0.5;
    const orient = e.def.orient ?? 'flip';
    let flip = 1;
    let rot = 0;
    if (orient === 'flip') {
      flip = Math.cos(e.facing) < 0 ? -1 : 1;
      rot = sp > 20 ? Math.sin(v.wob * 0.5) * 0.07 : 0;
    } else if (orient === 'rotate') rot = e.facing;
    const bs = v.baseScale * pop;
    v.body.scale.set(sx * flip * bs, sy * bs);
    v.flash.scale.copyFrom(v.body.scale);
    v.body.rotation = rot;
    v.flash.rotation = rot;
    const hover = e.flying ? Math.sin(this.time * 4 + e.id) * 3 - 6 : 0;
    v.body.y = hover;
    v.flash.y = hover;
    v.body.alpha = e.visual === 1 ? 0 : e.visual === 2 ? 0.35 : 1;
    v.shadow.alpha = e.visual === 1 ? 0.25 : 1;
    // flash: hit (white), windup (warm pulse), status tints
    v.flashT = Math.max(0, v.flashT - dt);
    let fa = 0;
    let ft = 0xffffff;
    if (v.flashT > 0) {
      fa = Math.min(1, (v.flashT / v.flashDur) * 1.2);
      ft = v.flashColor;
    } else if (e.freeze > 0) {
      fa = 0.55;
      ft = 0x9ff0ff;
    } else if ((e.tg && e.tg.active) || e.data.windup) {
      fa = 0.22 + Math.sin(this.time * 30) * 0.12;
      ft = 0xff6a3a;
    } else if (e.burn > 0) {
      fa = 0.12 + Math.sin(this.time * 20 + e.id) * 0.08;
      ft = 0xff8a3d;
    } else if (e.hex > 0) {
      fa = 0.2;
      ft = 0xb45cff;
    } else if (e.chill > 0) {
      fa = Math.min(0.4, e.chill * 0.05);
      ft = 0x8fe8ff;
    } else if (e.stun > 0 && e.maxArmor > 0) {
      fa = 0.15 + Math.sin(this.time * 18) * 0.1;
      ft = 0xffffaa;
    }
    v.flash.alpha = e.visual === 1 ? 0 : fa;
    v.flash.tint = ft;
    // elite / boss aura
    if (v.aura.visible) {
      const ec = (e.data.eliteColor as number) || (e.isBoss ? 0xff3d6e : 0xffd166);
      v.aura.tint = ec;
      v.aura.alpha = 0.3 + Math.sin(this.time * 5 + e.id) * 0.1;
      v.aura.scale.set((e.r * 3.4) / 64);
      v.crown.tint = ec;
      v.crown.x = 0;
      v.crown.y = -e.r * 1.6 + hover;
      v.crown.rotation = -Math.PI / 2;
      v.crown.scale.set(0.9);
    }
    // front shield
    if (e.frontShield > 0 && e.visual !== 1) {
      v.shield.visible = true;
      v.shield.texture = this.atlas.get('slash');
      v.shield.anchor.set(0, 0.5);
      v.shield.rotation = e.facing;
      const r = e.r + 8;
      v.shield.scale.set(r / 100, (r * (e.frontShield / Math.PI)) / 100);
      v.shield.x = -Math.cos(e.facing) * 4;
      v.shield.y = -Math.sin(e.facing) * 4 + hover;
      v.shield.tint = e.stun > 0 ? 0x555555 : 0x9fe7ff;
      v.shield.alpha = 0.75;
    } else v.shield.visible = false;
    // bubble shield
    if (e.bubble > 0 || e.shield > 0) {
      v.bubble.visible = true;
      v.bubble.scale.set(((e.r + 10) * 2) / 128);
      v.bubble.tint = e.bubble > 0 ? 0xfff1a6 : 0x7fe3ff;
      v.bubble.alpha = 0.55 + Math.sin(this.time * 8) * 0.15;
      v.bubble.y = hover;
    } else v.bubble.visible = false;
    // hp bar
    const damaged = e.hp < e.maxHp || e.armor < e.maxArmor;
    if (damaged && !e.isBoss) v.hpShow = Math.min(1, v.hpShow + dt * 8);
    const showBar = v.hpShow > 0 && !e.isBoss && e.visual !== 1;
    v.hpBg.visible = v.hpFill.visible = showBar;
    v.hpArmor.visible = showBar && e.maxArmor > 0 && e.armor > 0;
    if (showBar) {
      const bw = Math.max(26, e.r * 2);
      const by = -e.r * 1.25 - 10 + hover;
      v.hpBg.x = -bw / 2 - 1;
      v.hpBg.y = by - 1;
      v.hpBg.width = bw + 2;
      v.hpBg.height = 6;
      v.hpBg.alpha = 0.7 * v.hpShow;
      v.hpFill.x = -bw / 2;
      v.hpFill.y = by;
      v.hpFill.width = Math.max(0.1, bw * clamp(e.hp / e.maxHp, 0, 1));
      v.hpFill.height = 4;
      v.hpFill.tint = e.elite ? 0xffd166 : 0xff4a5a;
      v.hpFill.alpha = v.hpShow;
      if (v.hpArmor.visible) {
        v.hpArmor.x = -bw / 2;
        v.hpArmor.y = by - 5;
        v.hpArmor.width = Math.max(0.1, bw * clamp(e.armor / e.maxArmor, 0, 1));
        v.hpArmor.height = 3;
      }
    }
    // burning embers
    if (e.burn > 0 && vrand() < 0.25 * this.quality) {
      const p = this.particles.spawn(this.atlas.get('dot'), e.x + vrange(-e.r, e.r) * 0.7, e.y - vrange(0, e.r), true);
      p.vy = -vrange(40, 90);
      p.vx = vrange(-20, 20);
      p.max = vrange(0.3, 0.6);
      p.s0 = vrange(0.5, 0.9);
      p.s1 = 0.1;
      p.s.tint = vrand() < 0.5 ? 0xff8a3d : 0xffd166;
      p.drag = 1;
    }
  }

  /* ─────────────── projectiles ─────────────── */

  private assignProj(v: ProjView, e: Projectile) {
    const A = this.atlas;
    v.body.texture = A.get(e.art);
    v.body.anchor.set(0.5);
    const enemy = e.team === TEAM_ENEMY;
    v.glow.visible = true;
    v.glow.tint = e.color;
    v.body.tint = enemy ? shade(e.color, 1.6) | 0x404040 : 0xffffff;
    v.shadow.visible = e.lob;
    v.mark.visible = e.lob;
    v.markFill.visible = e.lob;
    if (e.lob) {
      v.mark.tint = 0xff3b4a;
      v.markFill.tint = 0xff3b4a;
    }
  }

  private updateProj(g: Game, v: ProjView, e: Projectile) {
    const enemy = e.team === TEAM_ENEMY;
    if (e.lob) {
      v.root.x = 0;
      v.root.y = 0;
      v.body.x = e.x;
      v.body.y = e.y - e.z;
      v.glow.x = v.body.x;
      v.glow.y = v.body.y;
      v.shadow.x = e.x;
      v.shadow.y = e.y;
      v.shadow.scale.set((e.r * 0.6) / 48 + 0.2, 0.4);
      const k = clamp(e.lt / e.ldur, 0, 1);
      v.mark.x = v.markFill.x = e.tx;
      v.mark.y = v.markFill.y = e.ty;
      v.mark.scale.set((e.r * 2) / 128);
      v.markFill.scale.set(((e.r * 2) / 128) * k);
      v.mark.alpha = 0.6 + Math.sin(this.time * 25) * 0.2 * k;
      v.markFill.alpha = 0.5;
      v.body.scale.set(1 + e.z / 260);
      v.body.rotation = e.rot;
      v.glow.scale.set((e.r * 0.06 + 0.5) * (1 + e.z / 300));
      v.glow.alpha = 0.6;
      return;
    }
    v.root.x = e.x;
    v.root.y = e.y;
    v.body.x = v.body.y = 0;
    v.glow.x = v.glow.y = 0;
    v.body.rotation = e.rot;
    const sc = e.scale;
    v.body.scale.set(sc);
    if (enemy) {
      v.glow.scale.set(((e.r * 4.2) / 64) * sc);
      v.glow.alpha = 0.75 + Math.sin(this.time * 20 + e.id) * 0.15;
    } else {
      v.glow.scale.set(((e.r * 3) / 64) * sc);
      v.glow.alpha = 0.45;
    }
    // trailing sparks for player projectiles
    if (!enemy && vrand() < 0.5 * this.quality && g.fxScale > 0 && g.hitstopT <= 0) {
      const p = this.particles.spawn(this.atlas.get('spark'), e.x, e.y, true);
      p.s.rotation = e.rot;
      p.s.tint = e.color;
      p.max = 0.12;
      p.s0 = 0.7;
      p.s1 = 0.2;
      p.a0 = 0.7;
    }
  }

  /* ─────────────── hazards ─────────────── */

  private assignHz(g: Game, v: HzView, h: Hazard) {
    const A = this.atlas;
    v.t = 0;
    v.emitT = 0;
    for (const s of [v.a, v.b, v.c]) {
      s.visible = true;
      s.alpha = 1;
      s.rotation = 0;
      s.blendMode = 'normal';
      s.anchor.set(0.5);
      s.tint = 0xffffff;
      s.x = s.y = 0;
    }
    switch (h.kind) {
      case HZ.Sigil:
        v.a.texture = A.get('sigil');
        v.a.tint = h.color;
        v.a.blendMode = 'add';
        v.b.texture = A.get('glow');
        v.b.tint = h.color;
        v.b.blendMode = 'add';
        v.c.visible = false;
        break;
      case HZ.Fire:
      case HZ.Slag:
      case HZ.Cloud:
        v.a.texture = A.get('scorch0');
        v.a.tint = h.kind === HZ.Slag ? 0x401008 : 0x2a0c04;
        v.a.alpha = 0.7;
        v.b.texture = A.get('glow');
        v.b.tint = h.color;
        v.b.blendMode = 'add';
        v.c.texture = A.get('glow');
        v.c.tint = 0xffd166;
        v.c.blendMode = 'add';
        break;
      case HZ.Fence:
      case HZ.Tether:
      case HZ.Beam:
        v.a.texture = A.get('beam');
        v.a.anchor.set(0, 0.5);
        v.a.tint = h.color;
        v.a.blendMode = 'add';
        v.b.texture = A.get('beam');
        v.b.anchor.set(0, 0.5);
        v.b.tint = 0xffffff;
        v.b.blendMode = 'add';
        v.c.texture = A.get('glow');
        v.c.tint = h.color;
        v.c.blendMode = 'add';
        break;
      case HZ.Ink:
        v.a.texture = A.get('splat1');
        v.a.tint = 0x050a18;
        v.a.alpha = 0.85;
        v.b.texture = A.get('ring');
        v.b.tint = 0x47d6ff;
        v.b.alpha = 0.25;
        v.c.visible = false;
        break;
      default:
        v.a.texture = A.get('ring');
        v.a.tint = h.color;
        v.a.blendMode = 'add';
        v.b.texture = A.get('glow');
        v.b.tint = h.color;
        v.b.blendMode = 'add';
        v.c.texture = A.get('tgDisc');
        v.c.tint = h.color;
        v.c.alpha = 0.3;
        break;
    }
    void g;
  }

  private updateHz(g: Game, v: HzView, h: Hazard, dt: number) {
    v.t += dt;
    v.root.x = h.x;
    v.root.y = h.y;
    const lifeK = h.maxLife > 0 ? h.life / h.maxLife : 1;
    const fadeOut = Math.min(1, h.life / 0.25);
    switch (h.kind) {
      case HZ.Sigil: {
        const armed = h.armT <= 0;
        const k = armed ? 1 : 1 - h.armT / Math.max(0.01, TUNING.cast.delay);
        v.a.scale.set(((h.r * 2) / 128) * (armed ? 1 + (1 - fadeOut) * 0.3 : 0.6 + 0.4 * k));
        v.a.rotation = this.time * (armed ? 0.5 : 3);
        v.a.alpha = armed ? fadeOut : 0.5 + k * 0.5;
        v.b.scale.set((h.r * 2.4) / 64);
        v.b.alpha = (armed ? 0.6 : 0.25) * fadeOut;
        break;
      }
      case HZ.Fire:
      case HZ.Slag:
      case HZ.Cloud: {
        const s = (h.r * 2.1) / 96;
        v.a.scale.set(s);
        v.a.alpha = 0.7 * fadeOut;
        v.b.scale.set(((h.r * 2.6) / 64) * (0.9 + Math.sin(this.time * 13 + h.id) * 0.1));
        v.b.alpha = 0.5 * fadeOut;
        v.c.scale.set((h.r * 1.2) / 64);
        v.c.alpha = 0.35 * fadeOut * (0.7 + Math.sin(this.time * 21 + h.id) * 0.3);
        v.emitT -= dt;
        if (v.emitT <= 0 && this.quality > 0.3) {
          v.emitT = 0.06 / this.quality;
          const p = this.particles.spawn(this.atlas.get('dot'), h.x + vrange(-h.r, h.r) * 0.8, h.y + vrange(-h.r, h.r) * 0.6, true);
          p.vy = -vrange(50, 110);
          p.max = vrange(0.3, 0.6);
          p.s0 = vrange(0.7, 1.3);
          p.s1 = 0;
          p.s.tint = vrand() < 0.5 ? h.color : 0xffd166;
          p.drag = 1;
        }
        break;
      }
      case HZ.Fence:
      case HZ.Tether:
      case HZ.Beam: {
        v.root.x = 0;
        v.root.y = 0;
        const dx = h.x2 - h.x;
        const dy = h.y2 - h.y;
        const len = Math.hypot(dx, dy);
        const ang = Math.atan2(dy, dx);
        const armed = h.armT <= 0;
        for (const s of [v.a, v.b]) {
          s.x = h.x;
          s.y = h.y;
          s.rotation = ang;
          s.width = len;
        }
        const flick = 0.75 + Math.sin(this.time * 40 + h.id) * 0.25;
        v.a.height = (armed ? h.w * 2.2 : 4) * flick;
        v.b.height = armed ? h.w * 0.7 : 2;
        v.a.alpha = (armed ? 0.9 : 0.35 + Math.sin(this.time * 30) * 0.2) * fadeOut;
        v.b.alpha = (armed ? 0.9 : 0.3) * fadeOut;
        v.c.x = h.x2;
        v.c.y = h.y2;
        v.c.scale.set(armed ? 0.6 : 0.3);
        v.c.alpha = 0.6 * fadeOut;
        break;
      }
      case HZ.Ink:
        v.a.scale.set((h.r * 2.4) / 64);
        v.a.alpha = 0.85 * fadeOut;
        v.b.scale.set((h.r * 2) / 128);
        v.b.rotation = this.time * 0.3;
        break;
      case HZ.Pulse: {
        const k = 1 - lifeK;
        v.a.scale.set(((h.r * 2 * k) / 128) * 1.05);
        v.a.alpha = 0.9 * (1 - k * 0.5);
        v.b.scale.set((h.r * 2 * k) / 64);
        v.b.alpha = 0.2 * (1 - k);
        v.c.visible = false;
        break;
      }
      case HZ.Well:
      case HZ.Vortex:
      case HZ.Wind:
        v.a.scale.set((h.r * 2.2) / 128);
        v.a.rotation = this.time * (h.kind === HZ.Wind ? -6 : 4);
        v.a.alpha = 0.8 * fadeOut;
        v.b.scale.set((h.r * 3) / 64);
        v.b.alpha = 0.35 * fadeOut;
        v.c.scale.set((h.r * 2) / 128);
        v.c.alpha = 0.25 * fadeOut;
        if (vrand() < 0.4 * this.quality) {
          const a = vrand() * TAU;
          const d = h.r * vrange(1.2, 2.4);
          const p = this.particles.spawn(this.atlas.get('dot'), h.x + Math.cos(a) * d, h.y + Math.sin(a) * d, true);
          p.vx = -Math.cos(a) * d * 2.2 + -Math.sin(a) * 120;
          p.vy = -Math.sin(a) * d * 2.2 + Math.cos(a) * 120;
          p.max = 0.4;
          p.s0 = 0.8;
          p.s1 = 0.1;
          p.s.tint = h.color;
          p.drag = 0;
        }
        break;
      default:
        v.a.scale.set((h.r * 2) / 128);
        v.a.alpha = 0.7 * fadeOut;
        v.a.rotation = this.time;
        v.b.scale.set((h.r * 2.2) / 64);
        v.b.alpha = 0.3 * fadeOut;
        v.c.scale.set((h.r * 2) / 128);
        v.c.alpha = (h.armT > 0 ? 0.15 : 0.3) * fadeOut;
        break;
    }
  }

  /* ─────────────── telegraphs ─────────────── */

  private assignTg(v: TgView, t: Telegraph) {
    v.disc.visible = v.edge.visible = t.shape === TG.Circle;
    v.bar.visible = v.fill.visible = t.shape === TG.Line;
    v.gfx.visible = t.shape === TG.Cone || t.shape === TG.Ring;
    v.gfx.clear();
  }

  private updateTg(g: Game, v: TgView, t: Telegraph) {
    const k = t.progress;
    const pulse = 0.75 + Math.sin(this.time * (12 + k * 30)) * 0.25;
    const col = t.locked || k > 0.82 ? 0xffffff : t.color;
    const col2 = t.color;
    v.root.x = t.x;
    v.root.y = t.y;
    if (t.shape === TG.Circle) {
      const s = (t.radius * 2) / 128;
      v.edge.scale.set(s);
      v.edge.tint = col;
      v.edge.alpha = 0.85 * pulse;
      v.disc.scale.set(s * Math.max(0.05, k));
      v.disc.tint = col2;
      v.disc.alpha = 0.55 + k * 0.35;
    } else if (t.shape === TG.Line) {
      v.bar.rotation = v.fill.rotation = t.angle;
      v.bar.scale.set(t.len / 64, t.width / 16);
      v.bar.tint = col;
      v.bar.alpha = 0.7 * pulse;
      v.fill.scale.set((t.len * Math.max(0.02, k)) / 64, t.width / 16);
      v.fill.tint = col2;
      v.fill.alpha = 0.7 + k * 0.3;
    } else if (t.shape === TG.Cone) {
      const gx = v.gfx;
      gx.clear();
      const a0 = t.angle - t.arc / 2;
      const a1 = t.angle + t.arc / 2;
      gx.moveTo(0, 0).arc(0, 0, t.radius, a0, a1).lineTo(0, 0).fill({ color: col2, alpha: 0.18 });
      gx.moveTo(0, 0).arc(0, 0, t.radius * Math.max(0.05, k), a0, a1).lineTo(0, 0).fill({ color: col2, alpha: 0.35 });
      gx.moveTo(0, 0).arc(0, 0, t.radius, a0, a1).lineTo(0, 0).stroke({ width: 2.5, color: col, alpha: 0.85 * pulse });
    } else if (t.shape === TG.Ring) {
      const gx = v.gfx;
      gx.clear();
      gx.circle(0, 0, t.radius).stroke({ width: 2.5, color: col, alpha: 0.85 * pulse });
      gx.circle(0, 0, t.inner).stroke({ width: 2, color: col, alpha: 0.6 * pulse });
      const mid = lerp(t.inner, t.radius, 0.5);
      gx.circle(0, 0, mid).stroke({ width: (t.radius - t.inner) * Math.max(0.05, k), color: col2, alpha: 0.3 });
    }
    void g;
  }

  /* ─────────────── corpses & pickups ─────────────── */

  private assignCorpse(v: SimpleView, c: Corpse) {
    const A = this.atlas;
    v.a.texture = A.get(c.def.art);
    v.b.texture = A.silhouette(c.def.art);
    v.b.alpha = 0.6;
    v.b.tint = 0xffffff;
    v.glow.tint = c.def.blood;
    v.glow.alpha = 0.6;
    v.glow.visible = true;
    v.glow.scale.set((c.r * 3) / 64);
  }
  private updateCorpse(v: SimpleView, c: Corpse, dt: number) {
    v.root.x = c.x;
    v.root.y = c.y;
    v.root.zIndex = c.y + 1000;
    v.a.rotation = v.b.rotation = c.rot;
    const k = clamp(c.life / 0.42, 0, 1);
    v.a.scale.set(0.9 + (1 - k) * 0.2);
    v.b.scale.copyFrom(v.a.scale);
    v.b.alpha = 0.25 + (1 - k) * 0.6;
    // spark trail
    if (vrand() < 0.8 * this.quality && dt > 0) {
      const p = this.particles.spawn(this.atlas.get('spark'), c.x, c.y, true);
      p.vx = -c.vx * 0.1 + vrange(-40, 40);
      p.vy = -c.vy * 0.1 + vrange(-40, 40);
      p.stretch = 0.01;
      p.max = 0.2;
      p.s0 = 1;
      p.s1 = 0.2;
      p.s.tint = c.def.blood;
    }
  }

  private assignPickup(v: SimpleView, k: Pickup) {
    const A = this.atlas;
    const key = k.kind === PK.Gold ? 'coin' : k.kind === PK.Heal ? 'heart' : k.kind === PK.Reward ? 'rewardOrb' : 'dot';
    v.a.texture = A.get(key);
    v.b.visible = false;
    v.glow.tint = k.kind === PK.Gold ? 0xffd166 : k.kind === PK.Heal ? 0xff4a6a : 0xfff1a6;
    v.glow.scale.set(k.kind === PK.Reward ? 1.6 : 0.7);
    v.glow.alpha = 0.6;
  }
  private updatePickup(v: SimpleView, k: Pickup) {
    v.root.x = k.x;
    v.root.y = k.y;
    v.root.zIndex = k.y;
    v.a.y = Math.sin(this.time * 6 + k.id) * 3 - 6;
    v.glow.y = v.a.y;
  }

  /* ─────────────── camera & overlay ─────────────── */

  private updateCamera(g: Game, dt: number) {
    const p = g.player;
    const V = TUNING.view;
    const zoom = this.baseScale * (1 + g.zoomPunch);
    this.cam.zoom = zoom;
    const viewW = this.screenW / zoom;
    const viewH = this.screenH / zoom;
    let la = 0;
    let lax = 0;
    let lay = 0;
    if (p.moving) {
      lax = p.moveX;
      lay = p.moveY;
      la = V.lookahead;
    } else if (p.target) {
      lax = Math.cos(p.facing);
      lay = Math.sin(p.facing);
      la = V.lookahead * 0.5;
    }
    let tx = p.x + lax * la;
    let ty = p.y + lay * la;
    const A = g.arena;
    const aw = A.x1 - A.x0;
    const ah = A.y1 - A.y0;
    const marginTop = 90;
    const marginOther = 40;
    if (aw + marginOther * 2 <= viewW) tx = (A.x0 + A.x1) / 2;
    else tx = clamp(tx, A.x0 - marginOther + viewW / 2, A.x1 + marginOther - viewW / 2);
    if (ah + marginTop + marginOther <= viewH) ty = (A.y0 + A.y1) / 2 - (marginTop - marginOther) / 2;
    else ty = clamp(ty, A.y0 - marginTop + viewH / 2, A.y1 + marginOther - viewH / 2);
    if (this.cam.x === 0 && this.cam.y === 0) {
      this.cam.x = tx;
      this.cam.y = ty;
    }
    this.cam.x = damp(this.cam.x, tx, V.follow, dt);
    this.cam.y = damp(this.cam.y, ty, V.follow, dt);
    if (!Number.isFinite(this.cam.x) || !Number.isFinite(this.cam.y)) {
      this.cam.x = Number.isFinite(tx) ? tx : 0;
      this.cam.y = Number.isFinite(ty) ? ty : 0;
    }
    this.shake.update(dt);
    this.world.scale.set(zoom);
    this.world.rotation = this.shake.angle;
    this.world.x = this.screenW / 2 - this.cam.x * zoom + this.shake.ox;
    this.world.y = this.screenH / 2 - this.cam.y * zoom + this.shake.oy;
  }

  snapCamera(g: Game) {
    this.cam.x = g.player.x;
    this.cam.y = g.player.y;
    this.updateCamera(g, 1);
  }

  private updateOverlay(g: Game, dt: number) {
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.hurtFlash.alpha = this.hurtT > 0 ? (this.hurtT / 0.45) * 0.45 : 0;
    this.whiteT = Math.max(0, this.whiteT - dt);
    this.whiteFlash.alpha = this.whiteT > 0 ? (this.whiteT / 0.25) * 0.32 : 0;
    const p = g.player;
    const low = p.hp / p.maxHp;
    this.lowHp.alpha = low < 0.3 && !p.dead ? (0.3 - low) * 1.6 * (0.7 + Math.sin(this.time * 6) * 0.3) : 0;
    const tier = g.streakTier;
    const target = [0, 0.1, 0.18, 0.28, 0.38][tier] ?? 0;
    this.streakGlow = damp(this.streakGlow, target, 4, dt);
    this.streakColor = TUNING.streak.colors[tier] ?? 0xffffff;
    this.streakEdge.tint = this.streakColor;
    this.streakEdge.alpha = this.streakGlow * (0.75 + Math.sin(this.time * (4 + tier * 2)) * 0.25);
    this.vignette.alpha = 0.85;
  }

  /* ════════════════════ EVENTS → VISUAL FEEDBACK ════════════════════ */

  onEvent(g: Game, ev: GameEvent) {
    const A = this.atlas;
    const Pt = TUNING.particles;
    const mul = (Pt.streakMul[g.streakTier] ?? 1) * this.quality;
    switch (ev.type) {
      case EV.Hit: {
        const e = ev.ref as Enemy;
        const v = e?.view as EnemyView | null;
        const isDot = ev.flag === 1;
        if (v && v.ent === e) {
          v.flashT = ev.crit ? TUNING.flash.critDuration : TUNING.flash.duration;
          v.flashDur = v.flashT;
          v.flashColor = isDot ? ev.color : 0xffffff;
          if (!isDot) {
            v.sqAxisX = Math.abs(ev.dx) > Math.abs(ev.dy);
            v.sqv += TUNING.squash.amount * (0.35 + ev.power) * 18 * (e.isBoss ? 0.4 : 1);
          }
        }
        // damage number
        const D = TUNING.damageNumbers;
        const col = isDot ? ev.color : D.colorNormal;
        this.numbers.show(e, ev.x, ev.y - (e?.r ?? 16) - 8, ev.amount, ev.crit, col);
        if (isDot) break;
        // sparks along hit direction
        const n = Math.round(lerp(Pt.hitMin, Pt.hitMax, ev.power) * mul + (ev.crit ? Pt.hitCritExtra : 0));
        const base = Math.atan2(ev.dy, ev.dx);
        for (let i = 0; i < n; i++) {
          const a = base + vrange(-Pt.hitCone, Pt.hitCone) * 0.5;
          const sp = vrange(Pt.hitSpeedMin, Pt.hitSpeedMax) * (0.6 + ev.power * 0.6);
          const p = this.particles.spawn(A.get('spark'), ev.x, ev.y, true);
          p.vx = Math.cos(a) * sp;
          p.vy = Math.sin(a) * sp;
          p.stretch = 0.004;
          p.drag = 7;
          p.max = vrange(0.12, 0.28);
          p.s0 = vrange(0.6, 1.1) * (ev.crit ? 1.3 : 1);
          p.s1 = 0.1;
          p.s.tint = i % 3 === 0 ? 0xffffff : ev.color;
        }
        // blood/ichor chunks (normal blend so they read as matter)
        const chunks = Math.round(n * 0.5);
        for (let i = 0; i < chunks; i++) {
          const a = base + vrange(-Pt.hitCone, Pt.hitCone) * 0.7;
          const sp = vrange(80, 340) * (0.5 + ev.power);
          const p = this.particles.spawn(A.get('dot'), ev.x, ev.y, false);
          p.vx = Math.cos(a) * sp;
          p.vy = Math.sin(a) * sp;
          p.drag = 6;
          p.max = vrange(0.25, 0.5);
          p.s0 = vrange(0.5, 1.0);
          p.s1 = 0.3;
          p.s.tint = shade(ev.color, 0.75);
        }
        // impact flash
        const f = this.particles.spawn(A.get('glow'), ev.x + ev.dx * 6, ev.y + ev.dy * 6, true);
        f.max = 0.09 + ev.power * 0.05;
        f.s0 = 0.5 + ev.power * 0.9 + (ev.crit ? 0.6 : 0);
        f.s1 = f.s0 * 1.4;
        f.s.tint = ev.crit ? 0xffd166 : 0xffffff;
        f.a0 = 0.9;
        if (ev.crit) {
          const r = this.particles.spawn(A.get('ring'), ev.x, ev.y, true);
          r.max = 0.18;
          r.s0 = 0.2;
          r.s1 = 0.75;
          r.s.tint = 0xffc21a;
        }
        // shake: trauma + directional kick
        const S = TUNING.shake;
        this.shake.add(S.traumaPerPower * ev.power * ev.power + (ev.crit ? S.traumaCrit : 0));
        this.shake.kick(ev.dx, ev.dy, ev.power);
        // small floor splat
        if (vrand() < 0.35 + ev.power * 0.4) this.decals.add(A.get('splat' + ((vrand() * 3) | 0)), ev.x + ev.dx * vrange(10, 40), ev.y + ev.dy * vrange(10, 40), vrange(0.25, 0.5) * (0.6 + ev.power), vrand() * TAU, shade(ev.color, 0.5), 0.55);
        break;
      }
      case EV.Kill: {
        const r = ev.amount || 16;
        const S = TUNING.shake;
        this.shake.add(S.traumaKill + ev.power * 0.08);
        const bursts = Math.round((ev.flag === 1 ? Pt.shardsMax : Pt.shardsMin) * mul * (r / 16));
        if (ev.flag === 1) {
          // SHATTER: shards fly out in the hit direction cone
          const base = Math.atan2(ev.dy, ev.dx);
          for (let i = 0; i < bursts; i++) {
            const a = base + vrange(-1.3, 1.3);
            const sp = vrange(200, 700);
            const p = this.particles.spawn(A.get('shard'), ev.x + vrange(-r, r) * 0.5, ev.y + vrange(-r, r) * 0.5, false);
            p.vx = Math.cos(a) * sp;
            p.vy = Math.sin(a) * sp;
            p.vr = vrange(-20, 20);
            p.drag = 4.5;
            p.max = vrange(0.35, 0.7);
            p.s0 = vrange(0.6, 1.4) * (r / 16);
            p.s1 = 0.2;
            p.s.tint = i % 3 === 0 ? 0xffffff : i % 3 === 1 ? ev.color : shade(ev.color, 0.6);
          }
        } else {
          for (let i = 0; i < bursts; i++) {
            const a = vrand() * TAU;
            const sp = vrange(100, 420);
            const p = this.particles.spawn(A.get('dot'), ev.x, ev.y, true);
            p.vx = Math.cos(a) * sp + ev.dx * 150;
            p.vy = Math.sin(a) * sp + ev.dy * 150;
            p.drag = 5;
            p.max = vrange(0.25, 0.5);
            p.s0 = vrange(0.8, 1.6);
            p.s1 = 0;
            p.s.tint = i % 2 ? ev.color : 0xffffff;
          }
        }
        const ring = this.particles.spawn(A.get('ring'), ev.x, ev.y, true);
        ring.max = 0.22;
        ring.s0 = (r * 0.8) / 64;
        ring.s1 = (r * 3.2) / 64;
        ring.s.tint = ev.color;
        const fl = this.particles.spawn(A.get('glow'), ev.x, ev.y, true);
        fl.max = 0.14;
        fl.s0 = (r * 3) / 64;
        fl.s1 = (r * 5) / 64;
        fl.s.tint = 0xffffff;
        const sm = this.particles.spawn(A.get('smoke'), ev.x, ev.y, false);
        sm.max = 0.7;
        sm.s0 = (r * 1.5) / 48;
        sm.s1 = (r * 3) / 48;
        sm.a0 = 0.35;
        sm.s.tint = 0x221a22;
        sm.vx = ev.dx * 40;
        sm.vy = ev.dy * 40 - 20;
        this.decals.add(A.get('splat' + ((vrand() * 3) | 0)), ev.x, ev.y, (r / 32) * vrange(0.9, 1.4), vrand() * TAU, shade(ev.color, 0.4), 0.7);
        break;
      }
      case EV.Shatter: {
        const r = ev.amount || 16;
        for (let i = 0; i < 16 * mul; i++) {
          const a = vrand() * TAU;
          const sp = vrange(150, 520);
          const p = this.particles.spawn(A.get('shard'), ev.x, ev.y, false);
          p.vx = Math.cos(a) * sp;
          p.vy = Math.sin(a) * sp;
          p.vr = vrange(-20, 20);
          p.drag = 4.5;
          p.max = vrange(0.3, 0.6);
          p.s0 = vrange(0.6, 1.3) * (r / 16);
          p.s1 = 0.2;
          p.s.tint = i % 2 ? ev.color : 0xffffff;
        }
        const ring = this.particles.spawn(A.get('ring'), ev.x, ev.y, true);
        ring.max = 0.2;
        ring.s0 = 0.2;
        ring.s1 = (r * 3) / 64;
        ring.s.tint = ev.color;
        this.shake.add(0.12);
        this.decals.add(A.get('splat' + ((vrand() * 3) | 0)), ev.x, ev.y, (r / 32) * 1.2, vrand() * TAU, shade(ev.color, 0.4), 0.7);
        break;
      }
      case EV.Chain:
      case EV.Slam: {
        const p = this.particles.spawn(A.get('ring'), ev.x, ev.y, true);
        p.max = 0.2;
        p.s0 = 0.15;
        p.s1 = 0.6;
        p.s.tint = ev.color;
        for (let i = 0; i < 8 * mul; i++) {
          const a = vrand() * TAU;
          const q = this.particles.spawn(A.get('spark'), ev.x, ev.y, true);
          q.vx = Math.cos(a) * vrange(200, 500);
          q.vy = Math.sin(a) * vrange(200, 500);
          q.stretch = 0.004;
          q.drag = 7;
          q.max = 0.2;
          q.s.tint = i % 2 ? ev.color : 0xffffff;
        }
        this.shake.add(ev.type === EV.Slam ? 0.18 : 0.12);
        break;
      }
      case EV.LastKill: {
        this.whiteT = 0.25;
        this.shake.add(0.5);
        for (let i = 0; i < Pt.lastKillBurst * this.quality; i++) {
          const a = vrand() * TAU;
          const sp = vrange(250, 1100);
          const p = this.particles.spawn(A.get(i % 3 === 0 ? 'shard' : 'spark'), ev.x, ev.y, i % 3 !== 0);
          p.vx = Math.cos(a) * sp;
          p.vy = Math.sin(a) * sp;
          p.stretch = i % 3 === 0 ? 0 : 0.003;
          p.vr = vrange(-15, 15);
          p.drag = 3.5;
          p.max = vrange(0.5, 1.1);
          p.s0 = vrange(0.8, 1.8);
          p.s1 = 0.1;
          p.s.tint = i % 2 ? 0xfff1a6 : ev.color;
        }
        for (let k = 0; k < 3; k++) {
          const ring = this.particles.spawn(A.get('ring'), ev.x, ev.y, true);
          ring.max = 0.45 + k * 0.15;
          ring.s0 = 0.3;
          ring.s1 = 4 + k * 2;
          ring.s.tint = k === 1 ? 0xffffff : 0xfff1a6;
        }
        break;
      }
      case EV.PlayerHurt: {
        if (ev.flag === 1) break; // grapple grab (separate)
        this.hurtT = 0.45;
        this.player.flashT = 0.18;
        this.player.sqv += 6;
        this.shake.add(TUNING.shake.traumaHurt);
        this.shake.kick(ev.dx, ev.dy, 1.2);
        this.numbers.show(null, ev.x, ev.y - 34, ev.amount, false, TUNING.damageNumbers.colorPlayerHurt);
        for (let i = 0; i < 14 * this.quality; i++) {
          const a = Math.atan2(ev.dy, ev.dx) + vrange(-1, 1);
          const p = this.particles.spawn(A.get('spark'), ev.x, ev.y, true);
          p.vx = Math.cos(a) * vrange(200, 500);
          p.vy = Math.sin(a) * vrange(200, 500);
          p.stretch = 0.004;
          p.drag = 6;
          p.max = 0.3;
          p.s.tint = i % 2 ? 0xff3b4a : 0xffffff;
        }
        break;
      }
      case EV.Swing:
        this.onSwing(g, ev);
        break;
      case EV.Dash: {
        this.player.sqv += TUNING.squash.playerDash * 22;
        for (let i = 0; i < 8 * this.quality; i++) {
          const p = this.particles.spawn(A.get('smoke'), ev.x + vrange(-8, 8), ev.y + 10 + vrange(-4, 4), false);
          p.vx = -ev.dx * vrange(60, 160) + vrange(-40, 40);
          p.vy = -ev.dy * vrange(60, 160) + vrange(-40, 40);
          p.max = vrange(0.3, 0.5);
          p.s0 = 0.3;
          p.s1 = 0.7;
          p.a0 = 0.3;
          p.s.tint = 0xbfb8d6;
        }
        const t = this.trails.spawn(A.get('thrust'), ev.x, ev.y, 0.16);
        t.r0 = t.r1 = Math.atan2(ev.dy, ev.dx);
        t.sx0 = 0.6;
        t.sx1 = 1.0;
        t.sy0 = 0.9;
        t.sy1 = 0.4;
        t.a0 = 0.55;
        t.s.tint = this.dashTint(g);
        this.player.ghostT = 0;
        break;
      }
      case EV.Shoot: {
        const f = this.particles.spawn(A.get('glow'), ev.x + ev.dx * 18, ev.y + ev.dy * 18 - 6, true);
        f.max = 0.08;
        f.s0 = 0.5;
        f.s1 = 0.9;
        f.s.tint = g.effects.slotColor(g, 'special');
        this.player.sqv -= 3;
        break;
      }
      case EV.CastThrow: {
        this.player.sqv += 4;
        break;
      }
      case EV.CastBoom: {
        const r = ev.amount;
        const ring = this.particles.spawn(A.get('ring'), ev.x, ev.y, true);
        ring.max = 0.3;
        ring.s0 = (r * 1.4) / 128;
        ring.s1 = (r * 2.8) / 128;
        ring.s.tint = ev.color;
        const fl = this.particles.spawn(A.get('glow'), ev.x, ev.y, true);
        fl.max = 0.2;
        fl.s0 = (r * 2) / 64;
        fl.s1 = (r * 3) / 64;
        fl.s.tint = ev.color;
        for (let i = 0; i < 24 * this.quality; i++) {
          const a = vrand() * TAU;
          const p = this.particles.spawn(A.get('spark'), ev.x + Math.cos(a) * r * 0.3, ev.y + Math.sin(a) * r * 0.3, true);
          p.vx = Math.cos(a) * vrange(150, 450);
          p.vy = Math.sin(a) * vrange(150, 450);
          p.stretch = 0.004;
          p.drag = 6;
          p.max = 0.3;
          p.s.tint = i % 2 ? ev.color : 0xffffff;
        }
        this.shake.add(0.22);
        break;
      }
      case EV.Explosion: {
        const r = ev.amount;
        const col = ev.flag === 1 ? 0xff5a3a : 0xffb347;
        const fl = this.particles.spawn(A.get('glow'), ev.x, ev.y, true);
        fl.max = 0.22;
        fl.s0 = (r * 2.2) / 64;
        fl.s1 = (r * 3.2) / 64;
        fl.s.tint = col;
        const ring = this.particles.spawn(A.get('ring'), ev.x, ev.y, true);
        ring.max = 0.28;
        ring.s0 = (r * 0.8) / 64;
        ring.s1 = (r * 2.3) / 64;
        ring.s.tint = 0xfff1a6;
        for (let i = 0; i < 26 * this.quality; i++) {
          const a = vrand() * TAU;
          const p = this.particles.spawn(A.get(i % 2 ? 'spark' : 'dot'), ev.x, ev.y, true);
          const sp = vrange(150, 600) * (r / 60);
          p.vx = Math.cos(a) * sp;
          p.vy = Math.sin(a) * sp;
          p.stretch = i % 2 ? 0.003 : 0;
          p.drag = 5;
          p.max = vrange(0.25, 0.5);
          p.s0 = vrange(0.8, 1.6);
          p.s1 = 0;
          p.s.tint = i % 3 === 0 ? 0xffffff : col;
        }
        for (let i = 0; i < 5 * this.quality; i++) {
          const sm = this.particles.spawn(A.get('smoke'), ev.x + vrange(-r, r) * 0.4, ev.y + vrange(-r, r) * 0.4, false);
          sm.max = vrange(0.6, 1);
          sm.s0 = (r * 1.2) / 48;
          sm.s1 = (r * 2.2) / 48;
          sm.a0 = 0.4;
          sm.vy = -30;
          sm.s.tint = 0x1a1418;
        }
        this.decals.add(A.get('scorch' + ((vrand() * 2) | 0)), ev.x, ev.y, (r * 2) / 96, vrand() * TAU, 0x000000, 0.6);
        this.shake.add(TUNING.shake.traumaExplosion * Math.min(1, r / 90));
        break;
      }
      case EV.SpawnPortal: {
        const t = this.trails.spawn(A.get('portal'), ev.x, ev.y, TUNING.pacing.spawnTelegraph);
        const s = ((ev.amount || 16) * 2.6) / 80;
        t.sx0 = t.sy0 = s * 0.2;
        t.sx1 = t.sy1 = s;
        t.r0 = 0;
        t.r1 = 6;
        t.a0 = 0.9;
        t.s.tint = 0xff4a8a;
        break;
      }
      case EV.Spawned: {
        const r = ev.amount || 16;
        const ring = this.particles.spawn(A.get('ring'), ev.x, ev.y, true);
        ring.max = 0.2;
        ring.s0 = (r * 2.5) / 128;
        ring.s1 = (r * 4) / 128;
        ring.s.tint = 0xff4a8a;
        for (let i = 0; i < 8 * this.quality; i++) {
          const a = vrand() * TAU;
          const p = this.particles.spawn(A.get('dot'), ev.x, ev.y, true);
          p.vx = Math.cos(a) * 200;
          p.vy = Math.sin(a) * 200;
          p.max = 0.25;
          p.s.tint = 0xff7ab0;
        }
        break;
      }
      case EV.Block:
      case EV.Deflect: {
        for (let i = 0; i < 10 * this.quality; i++) {
          const a = Math.atan2(ev.dy, ev.dx) + vrange(-0.9, 0.9);
          const p = this.particles.spawn(A.get('spark'), ev.x, ev.y, true);
          p.vx = Math.cos(a) * vrange(200, 500);
          p.vy = Math.sin(a) * vrange(200, 500);
          p.stretch = 0.004;
          p.drag = 8;
          p.max = 0.18;
          p.s.tint = ev.type === EV.Block ? 0x9fe7ff : ev.color || 0xffffff;
        }
        const f = this.particles.spawn(A.get('glow'), ev.x, ev.y, true);
        f.max = 0.08;
        f.s0 = 0.5;
        f.s1 = 0.8;
        f.s.tint = 0xcff6ff;
        if (ev.type === EV.Block) this.shake.kick(-ev.dx, -ev.dy, 0.4);
        break;
      }
      case EV.Freeze: {
        const e = ev.ref as Enemy;
        for (let i = 0; i < 10 * this.quality; i++) {
          const a = vrand() * TAU;
          const p = this.particles.spawn(A.get('shard'), ev.x + Math.cos(a) * (ev.amount || 16), ev.y + Math.sin(a) * (ev.amount || 16), true);
          p.vx = Math.cos(a) * 80;
          p.vy = Math.sin(a) * 80;
          p.vr = vrange(-5, 5);
          p.max = 0.4;
          p.s.tint = 0xbff6ff;
        }
        void e;
        break;
      }
      case EV.Lightning:
        this.lightning(ev.x, ev.y, ev.dx, ev.dy, ELEMENT_COLOR.storm);
        break;
      case EV.StatusProc: {
        const ring = this.particles.spawn(A.get('ring'), ev.x, ev.y, true);
        ring.max = 0.25;
        ring.s0 = 0.2;
        ring.s1 = 0.9;
        ring.s.tint = ev.color;
        break;
      }
      case EV.ArmorBreak:
      case EV.ShieldBreak: {
        const r = ev.amount || 20;
        for (let i = 0; i < 18 * this.quality; i++) {
          const a = vrand() * TAU;
          const p = this.particles.spawn(A.get('shard'), ev.x, ev.y, false);
          p.vx = Math.cos(a) * vrange(200, 500);
          p.vy = Math.sin(a) * vrange(200, 500);
          p.vr = vrange(-20, 20);
          p.drag = 4;
          p.max = 0.5;
          p.s0 = (r / 18) * vrange(0.7, 1.3);
          p.s.tint = ev.type === EV.ArmorBreak ? 0xc8d2e6 : 0x7fe3ff;
        }
        this.shake.add(0.3);
        break;
      }
      case EV.Heal:
        this.numbers.show(null, ev.x, ev.y - 34, ev.amount, false, TUNING.damageNumbers.colorHeal);
        for (let i = 0; i < 10; i++) {
          const p = this.particles.spawn(A.get('dot'), ev.x + vrange(-14, 14), ev.y + vrange(-6, 10), true);
          p.vy = -vrange(60, 140);
          p.max = 0.6;
          p.s.tint = 0x5dff9a;
        }
        break;
      case EV.DeathDefy: {
        this.whiteT = 0.3;
        for (let k = 0; k < 3; k++) {
          const ring = this.particles.spawn(A.get('ring'), ev.x, ev.y, true);
          ring.max = 0.5 + k * 0.1;
          ring.s0 = 0.3;
          ring.s1 = 4 + k;
          ring.s.tint = 0xffd27a;
        }
        this.shake.add(0.6);
        break;
      }
      case EV.EnemyShoot: {
        const f = this.particles.spawn(A.get('glow'), ev.x, ev.y, true);
        f.max = 0.1;
        f.s0 = 0.4;
        f.s1 = 0.7;
        f.s.tint = ev.color;
        break;
      }
      case EV.StreakTier: {
        this.shake.add(0.15);
        const ring = this.particles.spawn(A.get('ring'), g.player.x, g.player.y, true);
        ring.max = 0.4;
        ring.s0 = 0.3;
        ring.s1 = 3;
        ring.s.tint = ev.color;
        break;
      }
      case EV.Pickup: {
        for (let i = 0; i < 8; i++) {
          const a = vrand() * TAU;
          const p = this.particles.spawn(A.get('dot'), ev.x, ev.y, true);
          p.vx = Math.cos(a) * 160;
          p.vy = Math.sin(a) * 160;
          p.max = 0.3;
          p.s.tint = 0xfff1a6;
        }
        break;
      }
      case EV.Teleport:
      case EV.Burrow: {
        for (let i = 0; i < 12 * this.quality; i++) {
          const a = vrand() * TAU;
          const p = this.particles.spawn(A.get(ev.type === EV.Burrow ? 'dot' : 'smoke'), ev.x, ev.y, ev.type !== EV.Burrow);
          p.vx = Math.cos(a) * vrange(60, 220);
          p.vy = Math.sin(a) * vrange(60, 220);
          p.max = 0.4;
          p.s0 = ev.type === EV.Burrow ? 0.9 : 0.5;
          p.s1 = 0.2;
          p.s.tint = ev.color || 0x8a6a5a;
        }
        break;
      }
      default:
        break;
    }
  }

  private onSwing(g: Game, ev: GameEvent) {
    const A = this.atlas;
    const p = g.player;
    const ang = Math.atan2(ev.dy, ev.dx);
    const range = ev.amount;
    const arc = ev.power;
    const finisher = ev.crit;
    const life = finisher ? TUNING.trails.finisherLife : TUNING.trails.slashLife;
    const col = g.effects.slotColor(g, 'attack');
    this.player.sqv += TUNING.squash.playerAttack * 20;
    if (ev.flag === 1 || ev.flag === 3) {
      // thrust
      const t = this.trails.spawn(A.get('thrust'), p.x, p.y, life);
      t.follow = p;
      t.r0 = t.r1 = ang;
      t.sx0 = (range / 200) * 0.6;
      t.sx1 = range / 200;
      t.sy0 = t.sy1 = ev.power / 34 + 0.4;
      t.s.tint = col;
      return;
    }
    if (arc >= Math.PI * 1.9) {
      const t = this.trails.spawn(A.get('slashRing'), p.x, p.y, life);
      t.follow = p;
      t.sx0 = t.sy0 = (range * 1.6) / 200;
      t.sx1 = t.sy1 = (range * 2.3) / 200;
      t.r0 = 0;
      t.r1 = 3;
      t.s.tint = col;
      const t2 = this.trails.spawn(A.get('slash'), p.x, p.y, life * 1.1);
      t2.follow = p;
      t2.r0 = ang;
      t2.r1 = ang + Math.PI * 2;
      t2.sx0 = t2.sx1 = range / 100;
      t2.sy0 = t2.sy1 = range / 100;
      t2.s.tint = 0xffffff;
      return;
    }
    const side = ev.n % 2 === 0 ? 1 : -1;
    const t = this.trails.spawn(A.get('slash'), p.x, p.y, life);
    t.follow = p;
    t.r0 = ang - side * 0.35;
    t.r1 = ang + side * 0.25;
    const sy = (range / 100) * (arc / Math.PI);
    t.sx0 = (range / 100) * 0.85;
    t.sx1 = (range / 100) * 1.08;
    t.sy0 = sy * 0.9 * side;
    t.sy1 = sy * 1.05 * side;
    t.s.tint = col;
    // inner white core
    const c = this.trails.spawn(A.get('slash'), p.x, p.y, life * 0.6);
    c.follow = p;
    c.r0 = t.r0;
    c.r1 = t.r1;
    c.sx0 = t.sx0 * 0.92;
    c.sx1 = t.sx1 * 0.95;
    c.sy0 = t.sy0 * 0.6;
    c.sy1 = t.sy1 * 0.6;
    c.s.tint = 0xffffff;
    c.a0 = 0.8;
  }

  lightning(x0: number, y0: number, x1: number, y1: number, color: number) {
    const A = this.atlas;
    const segs = 6;
    let px = x0;
    let py = y0;
    for (let i = 1; i <= segs; i++) {
      const k = i / segs;
      const nx = lerp(x0, x1, k) + (i < segs ? vrange(-18, 18) : 0);
      const ny = lerp(y0, y1, k) + (i < segs ? vrange(-18, 18) : 0);
      const t = this.trails.spawn(A.get('beam'), px, py, 0.14);
      const len = Math.hypot(nx - px, ny - py);
      t.r0 = t.r1 = Math.atan2(ny - py, nx - px);
      t.sx0 = t.sx1 = len / 32;
      t.sy0 = 0.8;
      t.sy1 = 0.2;
      t.s.tint = i % 2 ? color : 0xffffff;
      px = nx;
      py = ny;
    }
    const f = this.particles.spawn(A.get('glow'), x1, y1, true);
    f.max = 0.12;
    f.s0 = 0.6;
    f.s1 = 1;
    f.s.tint = color;
  }
}

export type { Particle };
