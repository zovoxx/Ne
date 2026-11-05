import { TUNING } from '../config/tuning';
import type { Game } from '../game/game';

const $ = <T extends HTMLElement = HTMLElement>(root: ParentNode, sel: string) => root.querySelector(sel) as T;

/** Minimal HUD: top edge only, never under the thumbs. DOM is only touched when values change. */
export class Hud {
  root: HTMLElement;
  private hpFill: HTMLElement;
  private hpLag: HTMLElement;
  private hpTxt: HTMLElement;
  private pips: HTMLElement;
  private gold: HTMLElement;
  private roomLabel: HTMLElement;
  private streak: HTMLElement;
  private streakN: HTMLElement;
  private streakLbl: HTMLElement;
  private streakBar: HTMLElement;
  private boss: HTMLElement;
  private bossName: HTMLElement;
  private bossFill: HTMLElement;
  private bossMarks: HTMLElement;
  boons: HTMLElement;
  private toastEl: HTMLElement;
  private toastT = 0;
  private btnCd: Record<string, HTMLElement> = {};
  private charges: Record<string, HTMLElement> = {};
  private cache: Record<string, string | number> = {};
  onPause: (() => void) | null = null;

  constructor(ui: HTMLElement, controls: HTMLElement) {
    this.root = document.createElement('div');
    this.root.id = 'hud';
    this.root.innerHTML = `
      <div class="hud-left">
        <div class="hpbar"><div class="lag"></div><div class="fill"></div><div class="txt"></div></div>
        <div class="hud-row"><span class="pips" style="display:flex;gap:4px"></span></div>
        <div class="boons"></div>
      </div>
      <div class="hud-center">
        <div class="room-label"></div>
        <div class="bossbar"><div class="name"></div><div class="track"><i></i><span class="marks"></span></div></div>
        <div class="streak"><div class="n">0</div><div class="lbl"></div><div class="bar"><i></i></div></div>
      </div>
      <div class="hud-right">
        <div class="gold">0</div>
        <button class="icon-btn" data-act="pause" aria-label="Pause"><span class="pause-icon"><i></i><i></i></span></button>
      </div>`;
    ui.appendChild(this.root);
    this.hpFill = $(this.root, '.hpbar .fill');
    this.hpLag = $(this.root, '.hpbar .lag');
    this.hpTxt = $(this.root, '.hpbar .txt');
    this.pips = $(this.root, '.pips');
    this.gold = $(this.root, '.gold');
    this.roomLabel = $(this.root, '.room-label');
    this.streak = $(this.root, '.streak');
    this.streakN = $(this.root, '.streak .n');
    this.streakLbl = $(this.root, '.streak .lbl');
    this.streakBar = $(this.root, '.streak .bar i');
    this.boss = $(this.root, '.bossbar');
    this.bossName = $(this.root, '.bossbar .name');
    this.bossFill = $(this.root, '.bossbar .track i');
    this.bossMarks = $(this.root, '.bossbar .marks');
    this.boons = $(this.root, '.boons');
    const pause = $(this.root, '[data-act="pause"]');
    pause.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.onPause?.();
    });
    this.toastEl = document.createElement('div');
    this.toastEl.className = 'toast';
    ui.appendChild(this.toastEl);
    for (const id of ['attack', 'special', 'dash', 'cast']) {
      const el = controls.querySelector(`[data-btn="${id}"]`) as HTMLElement;
      this.btnCd[id] = el;
      const ch = el.querySelector('.charges') as HTMLElement | null;
      if (ch) this.charges[id] = ch;
    }
  }

  private set(key: string, v: string | number, fn: () => void) {
    if (this.cache[key] === v) return;
    this.cache[key] = v;
    fn();
  }

  toast(text: string, color = '#fff', dur = 1.1) {
    this.toastEl.textContent = text;
    this.toastEl.style.color = color;
    this.toastEl.classList.add('on');
    this.toastT = dur;
  }

  setRoomLabel(text: string) {
    this.set('room', text, () => (this.roomLabel.textContent = text));
  }

  show(on: boolean) {
    this.root.classList.toggle('hidden', !on);
  }

  update(g: Game, dt: number) {
    const p = g.player;
    const hpK = Math.max(0, p.hp / p.maxHp);
    this.set('hp', Math.round(hpK * 1000), () => {
      this.hpFill.style.transform = `scaleX(${hpK})`;
      this.hpLag.style.transform = `scaleX(${hpK})`;
    });
    this.set('hptxt', `${Math.ceil(p.hp)}/${p.maxHp}`, () => (this.hpTxt.textContent = `${Math.max(0, Math.ceil(p.hp))} / ${p.maxHp}`));
    this.set('pips', p.deathDefiance, () => {
      this.pips.innerHTML = '';
      for (let i = 0; i < p.deathDefiance; i++) {
        const d = document.createElement('i');
        d.className = 'pip';
        this.pips.appendChild(d);
      }
    });
    this.set('gold', g.gold, () => (this.gold.textContent = String(g.gold)));
    // streak
    const on = g.streak >= 3;
    this.set('streakOn', on ? 1 : 0, () => this.streak.classList.toggle('on', on));
    if (on) {
      const col = '#' + (TUNING.streak.colors[g.streakTier] ?? 0xffffff).toString(16).padStart(6, '0');
      this.set('streakN', g.streak, () => {
        this.streakN.textContent = String(g.streak);
        this.streak.classList.remove('pop');
        void this.streak.offsetWidth;
        this.streak.classList.add('pop');
      });
      this.set('streakTier', g.streakTier, () => {
        this.streak.style.color = col;
        this.streakLbl.textContent = TUNING.streak.names[g.streakTier] || 'STREAK';
      });
      const k = Math.max(0, g.streakT / g.streakWindow);
      this.set('streakBar', Math.round(k * 50), () => (this.streakBar.style.transform = `scaleX(${k})`));
    }
    // boss bar
    let boss = null;
    for (const e of g.enemies.live) if (e.active && (e.isBoss || e.isMini) && (!boss || e.isBoss)) boss = e;
    this.set('bossOn', boss ? 1 : 0, () => this.boss.classList.toggle('on', !!boss));
    if (boss) {
      this.set('bossName', boss.def.name, () => (this.bossName.textContent = boss!.def.name.toUpperCase()));
      const k = Math.max(0, boss.hp / boss.maxHp);
      this.set('bossHp', Math.round(k * 400), () => (this.bossFill.style.transform = `scaleX(${k})`));
      const marks = (boss.data.marks as unknown as number) || 0;
      this.set('bossMarks', marks, () => {
        this.bossMarks.innerHTML = '';
        const list = marks === 2 ? [0.66, 0.33] : marks === 1 ? [0.5] : [];
        for (const m of list) {
          const b = document.createElement('b');
          b.style.left = m * 100 + '%';
          this.bossMarks.appendChild(b);
        }
      });
    }
    // button cooldowns
    const special = p.weapon.specialReady ? p.weapon.specialReady(g, p) : 1;
    this.set('cdS', Math.round(special * 20), () => this.btnCd.special.style.setProperty('--cd', String(special)));
    const md = TUNING.dash.charges + g.stats.dashCharges;
    const dashK = p.dashCharges > 0 ? 1 : 1 - p.dashCd / (TUNING.dash.cooldown * (1 + g.stats.dashCooldown));
    this.set('cdD', Math.round(dashK * 20), () => this.btnCd.dash.style.setProperty('--cd', String(Math.max(0, dashK))));
    this.set('chD', md * 10 + p.dashCharges, () => this.pipRow(this.charges.dash, p.dashCharges, md > 1 ? md : 0));
    const mc = TUNING.cast.charges + g.stats.castCharges;
    const castK = p.castCharges > 0 ? 1 : 1 - p.castT / (TUNING.cast.recharge * (1 + g.stats.castRecharge));
    this.set('cdC', Math.round(castK * 20), () => this.btnCd.cast.style.setProperty('--cd', String(Math.max(0, castK))));
    this.set('chC', mc * 10 + p.castCharges, () => this.pipRow(this.charges.cast, p.castCharges, mc));
    if (this.toastT > 0) {
      this.toastT -= dt;
      if (this.toastT <= 0) this.toastEl.classList.remove('on');
    }
  }

  private pipRow(el: HTMLElement | undefined, n: number, max: number) {
    if (!el) return;
    el.innerHTML = '';
    for (let i = 0; i < max; i++) {
      const d = document.createElement('i');
      if (i >= n) d.className = 'off';
      el.appendChild(d);
    }
  }
}
