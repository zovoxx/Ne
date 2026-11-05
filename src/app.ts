import { TUNING } from './config/tuning';
import { Game, type RoomLogic } from './game/game';
import { EV } from './game/events';
import { Renderer } from './render/renderer';
import { InputManager } from './input/input';
import { Hud } from './ui/hud';
import { Sfx } from './audio/sfx';
import { Haptics } from './platform/haptics';
import { Presenter } from './presenter';
import { ICONS } from './ui/icons';
import { weaponById } from './game/weapons';
import { enemyDef } from './game/enemies';
import type { Enemy } from './game/entities';

/** Phase-1 sandbox: endless waves in a single arena (replaced by the room system in phase 2). */
class Sandbox implements RoomLogic {
  t = 0.3;
  wave = 0;
  update(g: Game, dt: number) {
    if (g.mode !== 'play') return;
    if (g.aliveEnemies() > 0) return;
    this.t -= dt;
    if (this.t > 0) return;
    this.wave++;
    const n = 4 + Math.min(10, this.wave * 2);
    for (let i = 0; i < n; i++) {
      const pt = g.freePointNear(g.player.x, g.player.y, TUNING.pacing.spawnMinDist, TUNING.pacing.spawnMaxDist, 16);
      g.spawnEnemy(enemyDef('cinderling'), pt.x, pt.y);
    }
  }
  onEnemyKilled(g: Game, e: Enemy) {
    if (g.aliveEnemies() === 0) {
      g.slowmo(TUNING.slowmo.lastKillScale, TUNING.slowmo.lastKillDuration);
      g.zoomPunch = TUNING.view.zoomPunchLastKill;
      const ev = g.events.push(EV.LastKill, e.x, e.y);
      ev.color = e.def.blood;
      this.t = 1.0;
    }
  }
}

export class App {
  renderer = new Renderer();
  game = new Game();
  sfx = new Sfx();
  haptics = new Haptics();
  input!: InputManager;
  hud!: Hud;
  presenter!: Presenter;
  paused = false;
  private last = 0;
  private fpsT = 0;
  private frames = 0;
  fps = 60;

  async boot() {
    const ui = document.getElementById('ui')!;
    const layer = document.createElement('div');
    layer.id = 'touch-layer';
    document.body.appendChild(layer);
    const controls = document.createElement('div');
    controls.id = 'controls';
    controls.innerHTML = `
      <div class="stick-hint"></div>
      <div class="stick-base"></div><div class="stick-knob"></div>
      <div class="btn" data-btn="attack">${ICONS.attack}</div>
      <div class="btn" data-btn="special">${ICONS.special}</div>
      <div class="btn" data-btn="dash">${ICONS.dash}<div class="charges"></div></div>
      <div class="btn" data-btn="cast">${ICONS.cast}<div class="charges"></div></div>`;
    document.body.appendChild(controls);
    const rotate = document.createElement('div');
    rotate.id = 'rotate';
    rotate.innerHTML = `<div class="phone"></div><div>Rotate your device to landscape</div>`;
    document.body.appendChild(rotate);

    await this.renderer.init(document.getElementById('game')!);
    const g = this.game;
    const w = weaponById('fangs');
    g.weapon = w;
    g.player.weapon = w;
    g.player.reset(TUNING.player.maxHp);
    g.arena = { x0: -620, y0: -380, x1: 620, y1: 380, pillars: [{ x: -300, y: -120, r: 38 }, { x: 320, y: 140, r: 38 }], pits: [], style: 0 };
    g.room = new Sandbox();
    g.nanCheck = import.meta.env.DEV;
    g.mode = 'play';
    g.player.x = 0;
    g.player.y = 200;
    this.renderer.setRoom(g);
    this.renderer.snapCamera(g);

    this.input = new InputManager(layer, controls, g.input);
    this.hud = new Hud(ui, controls);
    this.presenter = new Presenter(this.renderer, this.sfx, this.haptics);
    const unlock = () => this.sfx.unlock();
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
    this.hud.onPause = () => (this.paused = !this.paused);
    this.input.onPause = () => (this.paused = !this.paused);
    this.presenter.listeners.push((game, ev) => {
      if (ev.type === EV.StreakTier) this.hud.toast(ev.key, '#' + ev.color.toString(16).padStart(6, '0'));
    });

    window.addEventListener('resize', () => {
      this.renderer.resize();
      this.input.layout();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.paused = true;
        this.sfx.suspend();
        this.input.releaseAll();
      } else this.sfx.resume();
    });
    window.addEventListener('blur', () => {
      this.paused = true;
      this.input.releaseAll();
    });

    const boot = document.getElementById('boot');
    if (boot) {
      boot.style.opacity = '0';
      setTimeout(() => boot.remove(), 400);
    }
    this.last = performance.now();
    requestAnimationFrame(this.loop);
  }

  screenToWorld = (sx: number, sy: number) => {
    const r = this.renderer;
    const z = r.cam.zoom;
    return { x: (sx - r.world.x) / z, y: (sy - r.world.y) / z };
  };

  loop = (now: number) => {
    requestAnimationFrame(this.loop);
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (!(dt > 0)) dt = 0;
    if (dt > 0.1) dt = 0.1;
    this.frames++;
    this.fpsT += dt;
    if (this.fpsT >= 0.5) {
      this.fps = this.frames / this.fpsT;
      this.frames = 0;
      this.fpsT = 0;
    }
    const g = this.game;
    this.input.update(this.screenToWorld);
    if (!this.paused) g.update(dt);
    this.presenter.drain(g, dt);
    this.renderer.render(g, this.paused ? 0 : dt);
    this.hud.update(g, dt);
  };
}
