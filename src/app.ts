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
import { applyMeta, buy as buyUnlock, canBuy, has, KEEPSAKE_IDS, UNLOCKS, weaponUnlocked } from './game/meta';
import { lastStoryLine, nextStoryLine } from './game/story';
import type { Enemy } from './game/entities';
import { Music } from './audio/music';
import { Platform } from './platform/pwa';
import { DebugMenu } from './ui/debug';

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
  music = new Music(this.sfx);
  platform = new Platform();
  debug: DebugMenu | null = null;
  /** debug time multiplier */
  timeScale = 1;
  /** CPU time of the last frame (update + render), ms */
  frameMs = 0;
  private frameEma = 16;
  private govT = 0;
  private hintT = 0;
  private controlsShown = true;

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
      <div class="btn" data-btn="attack">${ICONS.attack}<span class="lbl">ATTACK</span></div>
      <div class="btn" data-btn="special">${ICONS.special}<span class="lbl">SPECIAL</span></div>
      <div class="btn" data-btn="dash">${ICONS.dash}<div class="charges"></div><span class="lbl">DASH</span></div>
      <div class="btn" data-btn="cast">${ICONS.cast}<div class="charges"></div><span class="lbl">SIGIL</span></div>`;
    document.body.appendChild(controls);
    this.platform.init();
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

    const unlock = () => {
      this.sfx.unlock();
      this.music.start();
    };
    // iOS Safari only unlocks audio on some gesture types, so listen to all of them
    for (const ev of ['pointerdown', 'touchend', 'click', 'keydown']) window.addEventListener(ev, unlock, { capture: true });
    // Android / desktop: first tap goes fullscreen + landscape (iOS needs the home-screen app)
    window.addEventListener('pointerdown', () => void this.platform.enterFullscreen(), { capture: true, once: true });
    if (import.meta.env.DEV || new URLSearchParams(location.search).has('debug')) this.debug = new DebugMenu(this);
    this.hud.onPause = () => this.togglePause();
    this.input.onPause = () => this.togglePause();
    this.presenter.listeners.push((game, ev) => {
      if (ev.type === EV.StreakTier) this.hud.toast(ev.key, '#' + ev.color.toString(16).padStart(6, '0'));
      if (ev.type === EV.Text) this.hud.toast(ev.key, '#ffffff', 0.7);
      if (ev.type === EV.DeathDefy) this.hud.toast('DEATH DEFIED', '#ffd27a', 1.4);
      if (ev.type === EV.BossPhase) {
        const e = ev.ref as Enemy | null;
        if (e && ev.n === 0) this.hud.toast(e.def.name.toUpperCase(), '#ffd0dc', 2.2);
        else if (e && ev.n > 0) this.hud.toast(ev.n >= 2 ? 'DESPERATE' : 'ENRAGED', '#ff8aa8', 1.2);
      }
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

  /** quality 0..1: particle density and render resolution */
  setQuality(q: number) {
    const r = this.renderer;
    if (Math.abs(r.quality - q) < 0.01) return;
    r.quality = q;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const res = q >= 0.95 ? dpr : q >= 0.65 ? Math.min(dpr, 1.6) : Math.min(dpr, 1.25);
    if (Math.abs(r.app.renderer.resolution - res) > 0.01) {
      r.app.renderer.resolution = res;
      r.app.renderer.resize(window.innerWidth, window.innerHeight);
      r.resize();
    }
  }

  /** auto quality: steps down when frames run long, back up when there's headroom */
  private governor(dt: number) {
    if (this.meta.settings.quality !== 'auto' || this.bot) return;
    this.govT += dt;
    if (this.govT < 2) return;
    this.govT = 0;
    const ms = this.frameEma;
    const q = this.renderer.quality;
    if (this.fps < 50 && q > 0.4) this.setQuality(q > 0.8 ? 0.7 : 0.4);
    else if (this.fps > 58 && ms < 9 && q < 1) this.setQuality(q < 0.6 ? 0.7 : 1);
  }

  showTitle() {
    this.game.mode = 'menu';
    this.hud.show(false);
    const saved = loadRun();
    const iosHint = this.platform.isIOS && !this.platform.standalone;
    this.screens.showTitle({
      install: this.platform.canInstall ? () => void this.platform.install() : undefined,
      iosHint,
      cont: saved ? () => this.startRun(true) : undefined,
      contInfo: saved ? `${BIOME_NAMES[saved.biome]} · room ${saved.rooms}` : undefined,
      play: () => this.startRun(false),
      wick: () => this.showWick(() => this.showTitle()),
      settings: () => this.showSettings(() => this.showTitle()),
      line: lastStoryLine(this.meta) ?? undefined,
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
    if (s.quality === 'high') this.setQuality(1);
    else if (s.quality === 'low') this.setQuality(0.4);
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
    const opts = applyMeta(this.meta);
    if (!weaponUnlocked(this.meta, this.weapon)) this.setWeapon('fangs');
    if (!run) {
      run = newRun((Math.random() * 1e9) | 0, this.weapon, opts);
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
    void this.platform.requestWakeLock();
    // first runs: label the controls
    if (this.meta.runs <= 2 && !this.bot) {
      document.body.classList.add('hints');
      this.hintT = 25;
    }
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
      cleared: (plan) => {
        if (this.hintT > 8) this.hintT = 8;
        if (plan.type === 'boss') {
          const first = (this.meta.bossKills[plan.biome] ?? 0) === 0;
          this.meta.bossKills[plan.biome] = (this.meta.bossKills[plan.biome] ?? 0) + 1;
          if (first && this.run) {
            this.run.embers += 15;
            this.hud.toast('FIRST VICTORY · +15 EMBERS', '#ffd27a', 1.6);
          }
        }
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
    const embers = Math.round(this.computeEmbers(run, won) * applyMeta(this.meta).emberMul) + run.embers;
    this.meta.embers += embers;
    this.meta.totalEmbers += embers;
    if (won) this.meta.wins++;
    else this.meta.deaths++;
    this.meta.deepest = Math.max(this.meta.deepest, run.biome * 6 + run.step);
    if (won && (this.meta.bestTime === 0 || run.time < this.meta.bestTime)) this.meta.bestTime = run.time;
    saveMeta(this.meta);
    saveRun(null);
    this.hud.show(false);
    this.platform.releaseWakeLock();
    const m = Math.floor(run.time / 60);
    const s = Math.floor(run.time % 60);
    const summary = {
      won,
      where: won ? 'All four depths' : `${BIOME_NAMES[run.biome]} · room ${run.rooms}`,
      time: `${m}:${String(s).padStart(2, '0')}`,
      kills: run.kills,
      streak: run.bestStreak,
      embers,
      story: nextStoryLine(this.meta, { won, biome: run.biome, bossKilled: this.meta.bossKills, weapon: run.weapon, boons: run.boons.length }),
      weapons: WEAPON_ORDER.map((id) => ({ id, name: weaponById(id).name, locked: !weaponUnlocked(this.meta, id) })),
      weapon: this.weapon,
      again: () => this.startRun(false),
      wick: () => this.showWick(() => this.endRunScreenAgain()),
      setWeapon: (id: string) => this.setWeapon(id as WeaponId),
    };
    this.lastSummary = () => {
      summary.weapons = WEAPON_ORDER.map((id) => ({ id, name: weaponById(id).name, locked: !weaponUnlocked(this.meta, id) }));
      summary.weapon = this.weapon;
      summary.embers = embers;
      this.screens.showDeath(summary);
    };
    this.screens.showDeath(summary);
  }

  /** re-show the run summary after visiting the Wick */
  private lastSummary: (() => void) | null = null;
  private endRunScreenAgain() {
    if (this.lastSummary) this.lastSummary();
    else this.showTitle();
  }

  showWick(back: () => void) {
    const m = this.meta;
    const groups = ['Weapons', 'Lights', 'The Wick', 'Keepsakes', 'Deepening'].map((name) => ({
      name,
      items: UNLOCKS.filter((u) => u.group === name).map((u) => ({
        id: u.id,
        name: u.name,
        desc: u.desc,
        cost: u.cost,
        owned: has(m, u.id),
        can: canBuy(m, u),
        locked: !(u.requires ?? []).every((r) => has(m, r)),
        equippable: !!KEEPSAKE_IDS[u.id],
        equipped: m.keepsake === u.id,
      })),
    }));
    const mins = Math.floor(m.bestTime / 60);
    const secs = Math.floor(m.bestTime % 60);
    this.screens.showWick({
      embers: m.embers,
      groups,
      stats: `Runs ${m.runs} · Victories ${m.wins} · Bosses felled ${m.bossKills.reduce((a, b) => a + b, 0)}${m.bestTime ? ` · Best ${mins}:${String(secs).padStart(2, '0')}` : ''}`,
      buy: (id) => {
        if (buyUnlock(m, id)) {
          if (id.startsWith('k_') && !m.keepsake) m.keepsake = id;
          saveMeta(m);
          this.sfx.reward();
        }
        this.showWick(back);
      },
      equip: (id) => {
        m.keepsake = m.keepsake === id ? null : id;
        saveMeta(m);
        this.showWick(back);
      },
      back,
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
    const t0 = performance.now();
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
    if (!this.paused) g.update(dt * this.timeScale);
    if (this.deathT > 0) {
      this.deathT -= dt;
      if (this.deathT <= 0) this.endRun(false);
    }
    this.presenter.drain(g, dt);
    this.renderer.fade = this.rc ? this.rc.fade : 0;
    this.renderer.render(g, this.paused ? 0 : dt * this.timeScale);
    this.hud.update(g, dt);
    // music follows the fight
    const m = this.music;
    m.biome = g.biome;
    m.intensity = g.streakTier;
    m.combat = (g.mode === 'play' || g.mode === 'dying') && g.aliveEnemies() > 0;
    let boss = false;
    for (const e of g.enemies.live) if (e.active && e.isBoss) boss = true;
    m.boss = boss;
    if (this.hintT > 0) {
      this.hintT -= dt;
      if (this.hintT <= 0) document.body.classList.remove('hints');
    }
    // touch controls only during gameplay
    const showControls = g.mode === 'play' || g.mode === 'dying' || g.mode === 'transition';
    if (showControls !== this.controlsShown) {
      this.controlsShown = showControls;
      document.body.classList.toggle('in-menu', !showControls);
    }
    this.frameMs = performance.now() - t0;
    this.frameEma += (this.frameMs - this.frameEma) * 0.05;
    this.governor(dt);
    this.debug?.tick();
  };
}
