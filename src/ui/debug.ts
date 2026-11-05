import type { App } from '../app';
import { ENEMIES, ENEMY_LIST } from '../game/enemies';
import { BOONS, PATRONS, PATRON_ORDER } from '../game/boons/patrons';
import { recomputeStats, GENERIC_FORGES, type RoomType } from '../game/run';
import { ELITE_INFO } from '../game/enemies/elites';
import { weaponById, WEAPON_ORDER } from '../game/weapons';
import { BIOME_NAMES } from '../game/rooms';
import { UNLOCKS } from '../game/meta';
import { saveMeta } from '../game/save';
import { TUNING } from '../config/tuning';
import type { WeaponId } from '../game/weapons/types';

/** Developer tools. Available in dev builds, or in production with ?debug=1 in the URL. */
export class DebugMenu {
  private el: HTMLElement | null = null;
  private btn: HTMLElement;
  private eliteMask = 0;
  private fps: HTMLElement;

  constructor(private app: App) {
    this.btn = document.createElement('button');
    this.btn.className = 'debug-btn';
    this.btn.textContent = 'DBG';
    this.btn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.toggle();
    });
    document.getElementById('ui')!.appendChild(this.btn);
    this.fps = document.createElement('div');
    this.fps.className = 'fps';
    document.getElementById('ui')!.appendChild(this.fps);
  }

  tick() {
    const a = this.app;
    if (a.meta.settings.showFps || this.el) this.fps.textContent = `${Math.round(a.fps)} fps · ${a.frameMs.toFixed(1)}ms · q${a.renderer.quality.toFixed(2)} · e${a.game.aliveEnemies(false)} · p${a.renderer.particles.active}`;
    else this.fps.textContent = '';
  }

  toggle() {
    if (this.el) {
      this.el.remove();
      this.el = null;
      if (this.app.game.mode === 'menu') this.app.game.mode = 'play';
      return;
    }
    const a = this.app;
    const g = a.game;
    const el = document.createElement('div');
    el.className = 'debug';
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    const enemyOpts = Object.values(ENEMIES)
      .map((d) => `<option value="${d.id}">${d.biome} · ${d.name}</option>`)
      .join('');
    const boonOpts = PATRON_ORDER.map((p) => `<optgroup label="${PATRONS[p].name}">${BOONS.filter((b) => b.patron === p).map((b) => `<option value="${b.id}">${b.name} (${b.slot})</option>`).join('')}</optgroup>`).join('') + `<optgroup label="Duos">${BOONS.filter((b) => b.duo).map((b) => `<option value="${b.id}">${b.name}</option>`).join('')}</optgroup>`;
    const forgeOpts = [...weaponById(g.weapon.id).forges, ...GENERIC_FORGES].map((f) => `<option value="${f.id}">${f.name}</option>`).join('');
    el.innerHTML = `
      <div class="dbg-row"><b>DEBUG</b><button data-a="close">×</button></div>
      <div class="dbg-sec">Spawn</div>
      <div class="dbg-row"><select data-k="enemy">${enemyOpts}</select><input data-k="count" type="number" value="1" min="1" max="40" style="width:44px"><button data-a="spawn">Spawn</button></div>
      <div class="dbg-row dbg-elites">${ELITE_INFO.map((i) => `<label><input type="checkbox" data-elite="${i.bit}">${i.name}</label>`).join('')}</div>
      <div class="dbg-row"><button data-a="stress">Stress: 45 enemies</button><button data-a="killall">Kill all</button></div>
      <div class="dbg-sec">Build</div>
      <div class="dbg-row"><select data-k="boon">${boonOpts}</select><select data-k="rarity"><option value="0">Common</option><option value="1">Rare</option><option value="2">Epic</option><option value="3">Heroic</option></select><button data-a="boon">Give</button></div>
      <div class="dbg-row"><select data-k="forge">${forgeOpts}</select><button data-a="forge">Forge</button><button data-a="clearboons">Clear boons</button></div>
      <div class="dbg-row"><select data-k="weapon">${WEAPON_ORDER.map((w) => `<option value="${w}">${weaponById(w).name}</option>`).join('')}</select><button data-a="weapon">Equip</button></div>
      <div class="dbg-sec">Rooms</div>
      <div class="dbg-row"><select data-k="biome">${BIOME_NAMES.map((n, i) => `<option value="${i}">${n}</option>`).join('')}</select><select data-k="step">${[0, 1, 2, 3, 4, 5].map((s) => `<option value="${s}">step ${s + 1}</option>`).join('')}</select><select data-k="rtype">${['combat', 'elite', 'mini', 'boss', 'shop', 'spring', 'ordeal'].map((t) => `<option>${t}</option>`).join('')}</select><button data-a="room">Go</button></div>
      <div class="dbg-sec">Cheats</div>
      <div class="dbg-row"><button data-a="god">God mode</button><button data-a="heal">Heal</button><button data-a="gold">+500 gold</button><button data-a="embers">+200 embers</button><button data-a="unlock">Unlock all</button></div>
      <div class="dbg-row"><button data-a="slow">Time ×0.25</button><button data-a="fast">Time ×1</button><button data-a="fps">Toggle FPS</button><button data-a="die">Die</button></div>`;
    document.getElementById('ui')!.appendChild(el);
    this.el = el;
    const val = (k: string) => (el.querySelector(`[data-k="${k}"]`) as HTMLSelectElement | HTMLInputElement).value;
    el.querySelectorAll<HTMLInputElement>('[data-elite]').forEach((c) =>
      c.addEventListener('change', () => {
        const b = Number(c.dataset.elite);
        this.eliteMask = c.checked ? this.eliteMask | b : this.eliteMask & ~b;
      }),
    );
    const run = () => a.run;
    const actions: Record<string, () => void> = {
      close: () => this.toggle(),
      spawn: () => {
        const d = ENEMIES[val('enemy')];
        const n = Math.max(1, Math.min(40, Number(val('count')) || 1));
        for (let i = 0; i < n; i++) {
          const pt = g.freePointNear(g.player.x, g.player.y, 160, 320, d.radius);
          g.spawnEnemy(d, pt.x, pt.y, { elite: this.eliteMask });
        }
      },
      stress: () => {
        const pool = ENEMY_LIST.filter((d) => d.biome === g.biome + 1);
        for (let i = 0; i < 45; i++) {
          const d = pool[i % pool.length];
          const pt = g.freePointNear(g.player.x, g.player.y, 140, 520, d.radius);
          g.spawnEnemy(d, pt.x, pt.y, { elite: i % 7 === 0 ? 1 : 0 });
        }
      },
      killall: () => {
        for (const e of g.enemies.live) if (e.active) g.kill(e);
      },
      boon: () => {
        const r = run();
        if (!r) return;
        const def = BOONS.find((b) => b.id === val('boon'))!;
        if (def.slot !== 'passive' && def.slot !== 'legendary' && def.slot !== 'duo') r.boons = r.boons.filter((b) => BOONS.find((x) => x.id === b.id)?.slot !== def.slot);
        r.boons = r.boons.filter((b) => b.id !== def.id);
        r.boons.push({ id: def.id, rarity: Number(val('rarity')), level: 1 });
        recomputeStats(g, r);
        a.refreshBoons();
      },
      forge: () => {
        const r = run();
        if (!r) return;
        const id = val('forge');
        r.forges[id] = (r.forges[id] ?? 0) + 1;
        recomputeStats(g, r);
      },
      clearboons: () => {
        const r = run();
        if (!r) return;
        r.boons = [];
        r.forges = {};
        recomputeStats(g, r);
        a.refreshBoons();
      },
      weapon: () => {
        a.setWeapon(val('weapon') as WeaponId);
        if (run()) run()!.weapon = val('weapon') as WeaponId;
        g.weapon.equip?.(g, g.player);
        if (run()) recomputeStats(g, run()!);
      },
      room: () => {
        const r = run();
        if (!r || !a.rc) return;
        this.toggle();
        a.rc.goTo(g, { type: val('rtype') as RoomType, biome: Number(val('biome')), step: Number(val('step')), reward: 'boon', patron: 'ember', seed: (Math.random() * 1e9) | 0 });
      },
      god: () => {
        g.player.god = !g.player.god;
        a.hud.toast(g.player.god ? 'GOD MODE' : 'MORTAL', '#ffffff');
      },
      heal: () => g.healPlayer(999),
      gold: () => (g.gold += 500),
      embers: () => {
        a.meta.embers += 200;
        saveMeta(a.meta);
      },
      unlock: () => {
        for (const u of UNLOCKS) if (!a.meta.unlocks.includes(u.id)) a.meta.unlocks.push(u.id);
        saveMeta(a.meta);
        a.hud.toast('EVERYTHING UNLOCKED', '#ffd27a');
      },
      slow: () => (a.timeScale = 0.25),
      fast: () => (a.timeScale = 1),
      fps: () => {
        a.meta.settings.showFps = !a.meta.settings.showFps;
        saveMeta(a.meta);
      },
      die: () => {
        g.player.god = false;
        g.player.deathDefiance = 0;
        g.player.hurtT = g.player.iframeT = 0;
        g.hurtPlayer(9999, g.player.x + 1, g.player.y, null);
        this.toggle();
      },
    };
    el.querySelectorAll<HTMLElement>('[data-a]').forEach((b) => b.addEventListener('click', () => actions[b.dataset.a!]?.()));
    void TUNING;
  }
}
