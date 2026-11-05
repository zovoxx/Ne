import { TUNING } from './config/tuning';
import { Game } from './game/game';
import { EV } from './game/events';
import { Renderer } from './render/renderer';
import { InputManager } from './input/input';
import { Hud } from './ui/hud';
import { Screens } from './ui/screens';
import { Sfx } from './audio/sfx';
import { Haptics } from './platform/haptics';
import { Presenter } from './presenter';
import { ICONS } from './ui/icons';
import { WEAPON_ORDER, weaponById } from './game/weapons';
import { RoomController, type RoomHooks } from './game/room';
import { firstRoom, BIOME_NAMES } from './game/rooms';
import { newRun, recomputeStats, type RunState } from './game/run';
import { loadMeta, loadRun, saveMeta, saveRun, resetAll, type MetaSave } from './game/save';
import { Doors } from './render/doors';
import { installMechanics } from './game/boons/mechanics';
import { BOON_BY_ID, PATRONS } from './game/boons/patrons';
import type { PatronId } from './game/boons/types';
import type { WeaponId } from './game/weapons/types';
import { BotBrain } from './game/bot';
import { ENCOUNTER_CTX } from './game/encounters';

export class App {
  renderer = new Renderer();
  game = new Game();
  sfx = new Sfx();
  haptics = new Haptics();
  input!: InputManager;
  hud!: Hud;
  screens!: Screens;
  presenter!: Presenter;
  meta: MetaSave = loadMeta();
  run: RunState | null = null;
  rc: RoomController | null = null;
  paused = false;
  private last = 0;
  private fpsT = 0;
  private frames = 0;
  fps = 60;
  private deathT = -1;
  weapon: WeaponId = 'fangs';
  /** bot / tests can set this to skip menus */
  autoplay = false;
  bot: BotBrain | null = null;
  private botT = 0;

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
    installMechanics(g.effects);
    g.nanCheck = import.meta.env.DEV;
    this.weapon = (WEAPON_ORDER.includes(this.meta.lastWeapon as WeaponId) ? this.meta.lastWeapon : 'fangs') as WeaponId;
    this.setWeapon(this.weapon);
    g.player.reset(TUNING.player.maxHp);

    this.input = new InputManager(layer, controls, g.input);
    this.hud = new Hud(ui, controls);
    this.screens = new Screens(ui);
    this.screens.onClick = () => this.sfx.uiClick();
    this.screens.onConfirm = () => this.sfx.uiConfirm();
    this.presenter = new Presenter(this.renderer, this.sfx, this.haptics);
    this.renderer.doors = new Doors(this.renderer.atlas, this.renderer.entityLayer, this.renderer.particles, () => this.rc);
    this.applySettings();

    const unlock = () => this.sfx.unlock();
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
    this.hud.onPause = () => this.togglePause();
    this.input.onPause = () => this.togglePause();
    this.presenter.listeners.push((game, ev) => {
      if (ev.type === EV.StreakTier) this.hud.toast(ev.key, '#' + ev.color.toString(16).padStart(6, '0'));
      if (ev.type === EV.Text) this.hud.toast(ev.key, '#ffffff', 0.7);
      if (ev.type === EV.DeathDefy) this.hud.toast('DEATH DEFIED', '#ffd27a', 1.4);
    });
    g.hooks.onPlayerDeath = () => this.onDeath();
    // novelty memory: encounters favour enemy pairings you haven't fought together yet
    ENCOUNTER_CTX.seenPairs = new Set(this.meta.seenPairs);
    ENCOUNTER_CTX.onPairs = (pairs) => {
      for (const p of pairs) if (!this.meta.seenPairs.includes(p)) this.meta.seenPairs.push(p);
    };

    window.addEventListener('resize', () => {
      this.renderer.resize();
      this.input.layout();
    });
    const autoPause = () => {
      if (this.game.mode === 'play' && !this.paused) this.togglePause();
      this.input.releaseAll();
    };
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        autoPause();
        this.sfx.suspend();
        this.saveProgress();
      } else this.sfx.resume();
    });
    window.addEventListener('blur', autoPause);
    window.addEventListener('pagehide', () => this.saveProgress());

    // idle arena behind the title
    g.arena = { x0: -620, y0: -380, x1: 620, y1: 380, pillars: [], pits: [], style: 0 };
    g.player.x = 0;
    g.player.y = 120;
    this.renderer.setRoom(g);
    this.renderer.snapCamera(g);

    const boot = document.getElementById('boot');
    if (boot) {
      boot.style.opacity = '0';
      setTimeout(() => boot.remove(), 400);
    }
    const params = new URLSearchParams(location.search);
    if (params.has('bot')) this.bot = new BotBrain();
    if (params.has('weapon')) this.setWeapon(params.get('weapon') as WeaponId);
    if (params.has('autostart') || params.has('bot')) {
      this.autoplay = true;
      this.startRun(false);
    } else this.showTitle();
    this.last = performance.now();
    requestAnimationFrame(this.loop);
  }

  /* ─────────────── menus ─────────────── */

  showTitle() {
    this.game.mode = 'menu';
    this.hud.show(false);
    const saved = loadRun();
    this.screens.showTitle({
      cont: saved ? () => this.startRun(true) : undefined,
      contInfo: saved ? `${BIOME_NAMES[saved.biome]} · room ${saved.rooms}` : undefined,
      play: () => this.startRun(false),
      wick: () => this.hud.toast('The Wick opens after your first run', '#ffd27a'),
      settings: () => this.showSettings(() => this.showTitle()),
    });
  }

  showSettings(back: () => void) {
    this.screens.showSettings(
      this.meta.settings,
      () => {
        this.applySettings();
        saveMeta(this.meta);
      },
      back,
      () => {
        resetAll();
        location.reload();
      },
    );
  }

  applySettings() {
    const s = this.meta.settings;
    this.sfx.volumes.master = s.master;
    this.sfx.volumes.sfx = s.sfx;
    this.sfx.volumes.music = s.music;
    this.sfx.applyVolumes();
    this.haptics.enabled = s.haptics;
    this.renderer.shake.intensity = s.shake;
  }

  togglePause() {
    const g = this.game;
    if (this.paused) {
      this.paused = false;
      this.screens.close();
      return;
    }
    if (g.mode !== 'play') return;
    this.paused = true;
    this.input.releaseAll();
    const run = this.run;
    const boons = run ? run.boons.map((b) => BOON_BY_ID[b.id]?.name).filter(Boolean).join(' · ') : '';
    this.screens.showPause({
      info: run ? `${BIOME_NAMES[run.biome]} · room ${run.rooms}${boons ? '<br>' + boons : ''}` : '',
      resume: () => this.togglePause(),
      settings: () =>
        this.showSettings(() => {
          this.paused = false;
          this.togglePause();
        }),
      restart: () => {
        this.paused = false;
        this.screens.close();
        this.startRun(false);
      },
      quit: () => {
        this.paused = false;
        this.saveProgress();
        this.showTitle();
      },
    });
  }

  setWeapon(id: WeaponId) {
    this.weapon = id;
    const w = weaponById(id);
    this.game.weapon = w;
    this.game.player.weapon = w;
    this.meta.lastWeapon = id;
  }

  /* ─────────────── runs ─────────────── */

  startRun(resume: boolean) {
    const g = this.game;
    this.screens.close();
    this.paused = false;
    this.deathT = -1;
    let run: RunState | null = resume ? loadRun() : null;
    if (!run) {
      run = newRun((Math.random() * 1e9) | 0, this.weapon, { maxHpBonus: 0, deathDefiance: 1, rerolls: 1, gold: 0, keepsake: this.meta.keepsake });
      this.meta.runs++;
      saveMeta(this.meta);
    }
    this.run = run;
    this.setWeapon(run.weapon);
    g.player.reset(run.maxHpBase);
    g.player.deathDefiance = run.deathDefiance;
    g.gold = run.gold;
    g.kills = run.kills;
    g.streak = 0;
    g.streakTier = 0;
    g.bestStreak = run.bestStreak;
    recomputeStats(g, run);
    g.player.hp = Math.min(run.hp, g.player.maxHp);
    g.weapon.equip?.(g, g.player);
    this.rc = new RoomController(run, this.roomHooks());
    g.room = this.rc;
    let plan = resume && run.current ? run.current : firstRoom(g.rng);
    const qp = new URLSearchParams(location.search);
    if (!resume && qp.has('biome')) {
      // debug / test entry: start in a later biome
      const b = Math.max(0, Math.min(3, Number(qp.get('biome')) || 0));
      plan = { ...plan, biome: b, step: Number(qp.get('step') ?? 0) || 0 };
      run.biome = b;
    }
    if (resume && run.current) {
      run.rooms--;
      run.history.pop();
    }
    g.mode = 'play';
    this.rc.enter(g, plan);
    this.hud.show(true);
    this.refreshBoons();
  }

  private roomHooks(): RoomHooks {
    const g = this.game;
    return {
      offer: (o) => {
        g.mode = 'choice';
        this.input.releaseAll();
        if (this.bot) {
          const bot = this.bot;
          setTimeout(() => {
            this.screens.close();
            bot.choose(o).apply();
            if (g.mode === 'choice') g.mode = 'play';
            this.refreshBoons();
          }, 450);
        }
        this.screens.showChoice(
          o,
          (opt) => {
            opt.apply();
            if (g.mode === 'choice') g.mode = 'play';
            this.refreshBoons();
          },
          this.run?.rerolls ?? 0,
        );
      },
      enter: (plan) => {
        this.renderer.clearRoomFx();
        this.renderer.setRoom(g);
        this.renderer.snapCamera(g);
        this.hud.setRoomLabel(`${BIOME_NAMES[plan.biome]} · ${plan.step + 1}/6`);
        this.saveProgress();
      },
      cleared: () => {
        if (this.run) {
          this.run.kills = g.kills;
          this.run.bestStreak = Math.max(this.run.bestStreak, g.bestStreak);
        }
      },
      runWon: () => this.endRun(true),
      shopPrompt: (item, buy) => {
        g.mode = 'choice';
        this.input.releaseAll();
        if (this.bot) {
          g.mode = 'play';
          if (g.gold >= item.price && (item.kind === 'boon' || item.kind === 'heart')) buy();
          return;
        }
        this.screens.showShopItem(
          item,
          g.gold,
          () => {
            g.mode = 'play';
            buy();
            this.refreshBoons();
          },
          () => (g.mode = 'play'),
        );
      },
      ordealPrompt: (plan, accept, decline) => {
        g.mode = 'choice';
        this.input.releaseAll();
        const P = plan.patron ? PATRONS[plan.patron as PatronId] : null;
        const t =
          plan.ordeal === 'altar'
            ? ['Blood Altar', `Offer 20% of your max health to ${P?.name ?? 'a Light'} for an Epic-or-better boon.`, 'Bleed for it']
            : plan.ordeal === 'wager'
              ? ['The Moth’s Wager', 'Stake up to 100 gold on a coin toss. Win triple and a Rare boon — or lose it all.', 'Toss the coin']
              : ['The Gauntlet', 'Survive 22 seconds against elite waves. Win an Epic-or-better boon.', 'Begin'];
        if (this.bot) {
          setTimeout(() => (Math.random() < 0.6 ? accept() : decline()), 300);
          return;
        }
        this.screens.showOrdeal(t[0], t[1], t[2], accept, decline);
      },
    };
  }

  refreshBoons() {
    const run = this.run;
    const el = this.hud.boons;
    el.innerHTML = '';
    if (!run) return;
    for (const ob of run.boons) {
      const d = BOON_BY_ID[ob.id];
      if (!d) continue;
      const col = d.duo ? PATRONS[d.duo[0]].color : PATRONS[d.patron as PatronId].color;
      const c = document.createElement('div');
      c.className = 'boon-chip';
      c.style.background = '#' + col.toString(16).padStart(6, '0');
      c.textContent = d.slot === 'passive' ? '•' : d.slot[0].toUpperCase();
      c.title = d.name;
      el.appendChild(c);
    }
  }

  saveProgress() {
    const run = this.run;
    const g = this.game;
    if (!run || g.player.dead || run.won) return;
    run.hp = Math.max(1, Math.round(g.player.hp));
    run.gold = g.gold;
    run.kills = g.kills;
    run.deathDefiance = g.player.deathDefiance;
    run.bestStreak = Math.max(run.bestStreak, g.bestStreak);
    saveRun(run);
    saveMeta(this.meta);
  }

  private onDeath() {
    this.deathT = TUNING.pacing.deathScreenDelay;
    saveRun(null);
  }

  private endRun(won: boolean) {
    const g = this.game;
    const run = this.run;
    if (!run) return;
    g.endStreak();
    g.mode = won ? 'victory' : 'dead';
    run.kills = g.kills;
    run.bestStreak = Math.max(run.bestStreak, g.bestStreak);
    const embers = this.computeEmbers(run, won);
    this.meta.embers += embers;
    this.meta.totalEmbers += embers;
    if (won) this.meta.wins++;
    else this.meta.deaths++;
    this.meta.deepest = Math.max(this.meta.deepest, run.biome * 6 + run.step);
    if (won && (this.meta.bestTime === 0 || run.time < this.meta.bestTime)) this.meta.bestTime = run.time;
    saveMeta(this.meta);
    saveRun(null);
    this.hud.show(false);
    const m = Math.floor(run.time / 60);
    const s = Math.floor(run.time % 60);
    this.screens.showDeath({
      won,
      where: won ? 'All four depths' : `${BIOME_NAMES[run.biome]} · room ${run.rooms}`,
      time: `${m}:${String(s).padStart(2, '0')}`,
      kills: run.kills,
      streak: run.bestStreak,
      embers,
      story: null,
      weapons: WEAPON_ORDER.map((id) => ({ id, name: weaponById(id).name, locked: false })),
      weapon: this.weapon,
      again: () => this.startRun(false),
      wick: () => this.hud.toast('Coming soon', '#ffd27a'),
      setWeapon: (id) => this.setWeapon(id as WeaponId),
    });
  }

  computeEmbers(run: RunState, won: boolean) {
    return Math.round(run.rooms * 1.5 + run.bossesKilled * 10 + (won ? 25 : 0) + Math.floor(run.bestStreak / 10));
  }

  /* ─────────────── main loop ─────────────── */

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
    this.input.enabled = !this.screens.open && (g.mode === 'play' || g.mode === 'dying');
    if (this.bot) {
      this.bot.think(g, this.rc, g.input, dt);
      if (g.mode === 'dead' || g.mode === 'victory') {
        this.botT += dt;
        if (this.botT > 2.5) {
          this.botT = 0;
          this.startRun(false);
        }
      }
    } else this.input.update(this.screenToWorld);
    if (!this.paused) g.update(dt);
    if (this.deathT > 0) {
      this.deathT -= dt;
      if (this.deathT <= 0) this.endRun(false);
    }
    this.presenter.drain(g, dt);
    this.renderer.fade = this.rc ? this.rc.fade : 0;
    this.renderer.render(g, this.paused ? 0 : dt);
    this.hud.update(g, dt);
  };
}
