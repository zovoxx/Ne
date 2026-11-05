import type { Offer, OfferOption } from '../game/run';
import type { ShopItem } from '../game/room';
import type { Settings } from '../game/save';
import { ICONS } from './icons';
import { RARITY_COLORS } from '../game/boons/types';

const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');

const SLOT_ICON: Record<string, string> = {
  attack: ICONS.attack,
  special: ICONS.special,
  dash: ICONS.dash,
  cast: ICONS.cast,
  revenge: `<svg viewBox="0 0 32 32" width="60%" height="60%"><path d="M16 3 L27 8 L25 20 L16 29 L7 20 L5 8 Z" fill="currentColor"/></svg>`,
  passive: `<svg viewBox="0 0 32 32" width="56%" height="56%"><circle cx="16" cy="16" r="10" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="16" cy="16" r="3.5" fill="currentColor"/></svg>`,
  legendary: `<svg viewBox="0 0 32 32" width="62%" height="62%"><path d="M4 24 L6 9 L12 16 L16 6 L20 16 L26 9 L28 24 Z" fill="currentColor"/></svg>`,
  duo: `<svg viewBox="0 0 32 32" width="62%" height="62%"><circle cx="11" cy="16" r="8" fill="none" stroke="currentColor" stroke-width="3.5"/><circle cx="21" cy="16" r="8" fill="none" stroke="currentColor" stroke-width="3.5"/></svg>`,
  forge: `<svg viewBox="0 0 32 32" width="60%" height="60%"><path d="M5 12 H25 L22 18 H14 L12 24 H20 V27 H8 V24 L10 18 L5 16 Z" fill="currentColor"/></svg>`,
  heart: `<svg viewBox="0 0 32 32" width="60%" height="60%"><path d="M16 28 C4 19 3 11 8 7 C12 4 15 7 16 9 C17 7 20 4 24 7 C29 11 28 19 16 28 Z" fill="currentColor"/></svg>`,
  heal: `<svg viewBox="0 0 32 32" width="56%" height="56%"><path d="M12 4 H20 V12 H28 V20 H20 V28 H12 V20 H4 V12 H12 Z" fill="currentColor"/></svg>`,
  gold: `<svg viewBox="0 0 32 32" width="56%" height="56%"><circle cx="16" cy="16" r="11" fill="currentColor"/><circle cx="16" cy="16" r="6" fill="none" stroke="#000" stroke-opacity="0.35" stroke-width="2.5"/></svg>`,
};

export class Screens {
  private el: HTMLElement | null = null;
  onClick: (() => void) | null = null;
  onConfirm: (() => void) | null = null;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(private ui: HTMLElement) {}

  get open() {
    return !!this.el;
  }

  close() {
    if (this.el) this.el.remove();
    this.el = null;
    if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler);
    this.keyHandler = null;
  }

  private mount(html: string, cls = 'overlay dim'): HTMLElement {
    this.close();
    const el = document.createElement('div');
    el.className = cls;
    el.innerHTML = html;
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.ui.appendChild(el);
    this.el = el;
    return el;
  }

  private keys(map: Record<string, () => void>) {
    this.keyHandler = (e: KeyboardEvent) => {
      const f = map[e.code];
      if (f) {
        e.preventDefault();
        f();
      }
    };
    window.addEventListener('keydown', this.keyHandler);
  }

  /* ───────── upgrade choice ───────── */

  showChoice(offer: Offer, picked: (o: OfferOption) => void, rerolls: number) {
    const el = this.mount(
      `<div class="choice">
        <div class="choice-head" style="--pc:${hex(offer.color)}">
          <div class="choice-title">${offer.title}</div>
          <div class="choice-sub">“${offer.subtitle}”</div>
        </div>
        <div class="cards">${offer.options.map((o, i) => this.card(o, i)).join('')}</div>
        <div class="choice-foot">${offer.reroll ? `<button class="btn-ui small" data-reroll>Reroll (${rerolls})</button>` : ''}</div>
      </div>`,
    );
    const openedAt = performance.now();
    const choose = (i: number) => {
      // ignore taps in the first moments so combat button-mashing can't pick by accident
      if (performance.now() - openedAt < 380) return;
      const o = offer.options[i];
      if (!o) return;
      this.onConfirm?.();
      this.close();
      picked(o);
    };
    el.querySelectorAll<HTMLElement>('.card').forEach((c) => {
      c.addEventListener('click', () => choose(Number(c.dataset.i)));
    });
    const rr = el.querySelector<HTMLElement>('[data-reroll]');
    if (rr && offer.reroll) {
      rr.addEventListener('click', () => {
        const next = offer.reroll!();
        this.onClick?.();
        if (next) this.showChoice(next, picked, rerolls - 1);
      });
    }
    this.keys({ Digit1: () => choose(0), Digit2: () => choose(1), Digit3: () => choose(2) });
  }

  private card(o: OfferOption, i: number) {
    const rc = hex(RARITY_COLORS[o.rarity] ?? 0xffffff);
    return `<button class="card" data-i="${i}" style="--pc:${hex(o.color)};--rc:${rc};animation-delay:${i * 45}ms">
      <div class="card-icon">${SLOT_ICON[o.icon] ?? SLOT_ICON.passive}</div>
      <div class="card-tag">${o.tag}</div>
      <div class="card-name">${o.name}</div>
      <div class="card-desc">${o.desc}</div>
      ${o.replaces ? `<div class="card-rep">Replaces ${o.replaces}</div>` : ''}
      <div class="card-key">${i + 1}</div>
    </button>`;
  }

  /* ───────── death / victory ───────── */

  showDeath(d: {
    won: boolean;
    where: string;
    time: string;
    kills: number;
    streak: number;
    embers: number;
    story: { who: string; line: string } | null;
    weapons: { id: string; name: string; locked: boolean }[];
    weapon: string;
    again: () => void;
    wick: () => void;
    setWeapon: (id: string) => void;
  }) {
    const el = this.mount(
      `<div class="death ${d.won ? 'won' : ''}">
        <div class="death-title">${d.won ? 'THE SUN REKINDLED' : 'THE LANTERN GUTTERS'}</div>
        <div class="death-where">${d.where} · ${d.time}</div>
        <div class="death-stats">
          <div><b>${d.kills}</b><span>kills</span></div>
          <div><b>${d.streak}</b><span>best streak</span></div>
          <div class="ember"><b>+${d.embers}</b><span>embers</span></div>
        </div>
        ${d.story ? `<div class="story"><span class="who">${d.story.who}</span> ${d.story.line}</div>` : ''}
        <div class="weapon-row">${d.weapons
          .map((w) => `<button class="wchip ${w.id === d.weapon ? 'on' : ''}" data-w="${w.id}" ${w.locked ? 'disabled' : ''}>${w.name}${w.locked ? ' · locked' : ''}</button>`)
          .join('')}</div>
        <div class="death-actions">
          <button class="btn-ui primary big" data-again>AGAIN</button>
          <button class="btn-ui" data-wick>The Wick</button>
        </div>
      </div>`,
    );
    el.querySelector('[data-again]')!.addEventListener('click', () => d.again());
    el.querySelector('[data-wick]')!.addEventListener('click', () => d.wick());
    el.querySelectorAll<HTMLElement>('.wchip').forEach((b) =>
      b.addEventListener('click', () => {
        if (b.hasAttribute('disabled')) return;
        el.querySelectorAll('.wchip').forEach((x) => x.classList.remove('on'));
        b.classList.add('on');
        d.setWeapon(b.dataset.w!);
        this.onClick?.();
      }),
    );
    this.keys({ Enter: d.again, Space: d.again, KeyJ: d.again });
  }

  /* ───────── pause ───────── */

  showPause(a: { resume: () => void; restart: () => void; quit: () => void; settings: () => void; debug?: () => void; info: string }) {
    const el = this.mount(
      `<div class="panel pause">
        <h2>Paused</h2>
        <div class="pause-info">${a.info}</div>
        <div class="col">
          <button class="btn-ui primary" data-a="resume">Resume</button>
          <button class="btn-ui" data-a="settings">Settings</button>
          <button class="btn-ui" data-a="restart">Restart run</button>
          <button class="btn-ui" data-a="quit">Quit to title</button>
          ${a.debug ? '<button class="btn-ui small" data-a="debug">Debug menu</button>' : ''}
        </div>
      </div>`,
    );
    const map: Record<string, () => void> = { resume: a.resume, restart: a.restart, quit: a.quit, settings: a.settings, debug: a.debug ?? (() => {}) };
    el.querySelectorAll<HTMLElement>('[data-a]').forEach((b) => b.addEventListener('click', () => map[b.dataset.a!]()));
    this.keys({ Escape: a.resume, KeyP: a.resume });
  }

  showSettings(s: Settings, change: (s: Settings) => void, back: () => void, reset: () => void) {
    const el = this.mount(
      `<div class="panel settings">
        <h2>Settings</h2>
        <label>Master <input type="range" min="0" max="1" step="0.05" value="${s.master}" data-k="master"></label>
        <label>Effects <input type="range" min="0" max="1" step="0.05" value="${s.sfx}" data-k="sfx"></label>
        <label>Music <input type="range" min="0" max="1" step="0.05" value="${s.music}" data-k="music"></label>
        <label>Screen shake <input type="range" min="0" max="1.5" step="0.1" value="${s.shake}" data-k="shake"></label>
        <label class="row">Haptics <input type="checkbox" ${s.haptics ? 'checked' : ''} data-k="haptics"></label>
        <label class="row">Show FPS <input type="checkbox" ${s.showFps ? 'checked' : ''} data-k="showFps"></label>
        <label class="row">Quality <select data-k="quality"><option value="auto">Auto</option><option value="high">High</option><option value="low">Low</option></select></label>
        <div class="row-btns"><button class="btn-ui primary" data-back>Back</button><button class="btn-ui small" data-reset>Erase save</button></div>
      </div>`,
    );
    (el.querySelector('select') as HTMLSelectElement).value = s.quality;
    el.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-k]').forEach((inp) => {
      inp.addEventListener('input', () => {
        const k = inp.dataset.k as keyof Settings;
        const v = inp instanceof HTMLInputElement && inp.type === 'checkbox' ? inp.checked : inp instanceof HTMLInputElement ? Number(inp.value) : inp.value;
        (s as unknown as Record<string, unknown>)[k] = v;
        change(s);
      });
    });
    el.querySelector('[data-back]')!.addEventListener('click', back);
    let armed = false;
    const rb = el.querySelector('[data-reset]') as HTMLElement;
    rb.addEventListener('click', () => {
      if (!armed) {
        armed = true;
        rb.textContent = 'Tap again to erase';
        return;
      }
      reset();
    });
    this.keys({ Escape: back });
  }

  /* ───────── title ───────── */

  showTitle(a: { cont?: () => void; contInfo?: string; play: () => void; wick: () => void; settings: () => void; install?: () => void; line?: string }) {
    const el = this.mount(
      `<div class="title-screen">
        <div class="logo">LANTERNFALL</div>
        <div class="tag">${a.line ?? 'Descend. Fight. Rekindle the stolen sun.'}</div>
        <div class="col title-btns">
          ${a.cont ? `<button class="btn-ui primary big" data-a="cont">Continue<small>${a.contInfo ?? ''}</small></button>` : ''}
          <button class="btn-ui ${a.cont ? '' : 'primary big'}" data-a="play">${a.cont ? 'New run' : 'Begin'}</button>
          <div class="row-btns">
            <button class="btn-ui" data-a="wick">The Wick</button>
            <button class="btn-ui" data-a="settings">Settings</button>
          </div>
          ${a.install ? `<button class="btn-ui small" data-a="install">Install as app</button>` : ''}
        </div>
      </div>`,
      'overlay title',
    );
    const map: Record<string, () => void> = { cont: a.cont ?? (() => {}), play: a.play, wick: a.wick, settings: a.settings, install: a.install ?? (() => {}) };
    el.querySelectorAll<HTMLElement>('[data-a]').forEach((b) => b.addEventListener('click', () => map[b.dataset.a!]()));
    this.keys({ Enter: a.cont ?? a.play, Space: a.cont ?? a.play });
  }

  /* ───────── shop / ordeal prompts ───────── */

  showShopItem(it: ShopItem, gold: number, buy: () => void, cancel: () => void) {
    const can = gold >= it.price;
    const el = this.mount(
      `<div class="panel prompt">
        <div class="prompt-title">${it.name}</div>
        <div class="prompt-desc">${it.desc}</div>
        <div class="row-btns">
          <button class="btn-ui primary" data-buy ${can ? '' : 'disabled'}>Buy · ${it.price} gold</button>
          <button class="btn-ui" data-cancel>Leave it</button>
        </div>
        ${can ? '' : `<div class="prompt-note">You have ${gold} gold.</div>`}
      </div>`,
      'overlay',
    );
    el.querySelector('[data-buy]')!.addEventListener('click', () => {
      if (!can) return;
      this.close();
      buy();
    });
    el.querySelector('[data-cancel]')!.addEventListener('click', () => {
      this.close();
      cancel();
    });
    this.keys({ Escape: () => (this.close(), cancel()), Enter: () => can && (this.close(), buy()) });
  }

  showOrdeal(title: string, desc: string, acceptLabel: string, accept: () => void, decline: () => void) {
    const el = this.mount(
      `<div class="panel prompt ordeal">
        <div class="prompt-title">${title}</div>
        <div class="prompt-desc">${desc}</div>
        <div class="row-btns">
          <button class="btn-ui primary" data-yes>${acceptLabel}</button>
          <button class="btn-ui" data-no>Walk away</button>
        </div>
      </div>`,
    );
    el.querySelector('[data-yes]')!.addEventListener('click', () => {
      this.close();
      accept();
    });
    el.querySelector('[data-no]')!.addEventListener('click', () => {
      this.close();
      decline();
    });
  }

  /** generic panel (codex, wick…) */
  showPanel(html: string, bind: (el: HTMLElement) => void) {
    const el = this.mount(html);
    bind(el);
    return el;
  }
}
