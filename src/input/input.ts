import { TUNING } from '../config/tuning';
import type { Button, InputFrame } from '../game/player';

interface Btn {
  id: Button;
  el: HTMLElement;
  cx: number;
  cy: number;
  r: number;
  pointer: number | null;
}

const KEYMAP: Record<string, Button> = {
  KeyJ: 'attack',
  KeyK: 'special',
  KeyL: 'dash',
  Space: 'dash',
  ShiftLeft: 'dash',
  ShiftRight: 'dash',
  KeyE: 'cast',
  KeyQ: 'cast',
  KeyI: 'cast',
  Enter: 'attack',
};

/**
 * Unified input: floating virtual joystick (left thumb), big action buttons (right thumb) where a
 * touch goes to the NEAREST button so you never need to look, plus keyboard + mouse for PC.
 */
export class InputManager {
  private keys = new Set<string>();
  private stick = { id: -1, bx: 0, by: 0, x: 0, y: 0, active: false };
  private btns: Btn[] = [];
  private mouseHeld: Record<Button, boolean> = { attack: false, special: false, dash: false, cast: false };
  mouse = { x: 0, y: 0, last: -99, valid: false };
  usingTouch = false;
  enabled = true;
  stickBase: HTMLElement;
  stickKnob: HTMLElement;
  onAnyInput: (() => void) | null = null;
  onPause: (() => void) | null = null;
  onFullscreen: (() => void) | null = null;
  /** world position of the player (gamepad right-stick aim) */
  playerPos: (() => { x: number; y: number }) | null = null;
  private padPrev: boolean[] = [];
  private padAim = { x: 0, y: 0, t: -99 };
  private padNavT = 0;
  usingPad = false;

  constructor(private layer: HTMLElement, private controls: HTMLElement, private frame: InputFrame) {
    this.stickBase = controls.querySelector('.stick-base') as HTMLElement;
    this.stickKnob = controls.querySelector('.stick-knob') as HTMLElement;
    for (const id of ['attack', 'special', 'dash', 'cast'] as Button[]) {
      const el = controls.querySelector(`[data-btn="${id}"]`) as HTMLElement;
      this.btns.push({ id, el, cx: 0, cy: 0, r: 40, pointer: null });
    }
    layer.addEventListener('pointerdown', (e) => this.down(e), { passive: false });
    window.addEventListener('pointermove', (e) => this.move(e), { passive: false });
    window.addEventListener('pointerup', (e) => this.up(e), { passive: false });
    window.addEventListener('pointercancel', (e) => this.up(e), { passive: false });
    layer.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => this.key(e, true));
    window.addEventListener('keyup', (e) => this.key(e, false));
    window.addEventListener('blur', () => this.releaseAll());
    window.addEventListener('resize', () => this.layout());
    if (matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window) this.setTouch(true);
    this.layout();
  }

  layout() {
    for (const b of this.btns) {
      const r = b.el.getBoundingClientRect();
      b.cx = r.left + r.width / 2;
      b.cy = r.top + r.height / 2;
      b.r = r.width / 2;
    }
  }

  setTouch(on: boolean) {
    if (this.usingTouch === on) return;
    this.usingTouch = on;
    document.body.classList.toggle('touch', on);
    requestAnimationFrame(() => this.layout());
  }

  private press(b: Button) {
    this.frame.pressed[b] = true;
    this.onAnyInput?.();
  }

  private down(e: PointerEvent) {
    if (!this.enabled) return;
    if (e.pointerType === 'mouse') {
      this.setTouch(false);
      const b: Button | null = e.button === 0 ? 'attack' : e.button === 2 ? 'special' : e.button === 1 ? 'cast' : null;
      if (b) {
        this.mouseHeld[b] = true;
        this.press(b);
      }
      e.preventDefault();
      return;
    }
    this.setTouch(true);
    e.preventDefault();
    const w = window.innerWidth;
    const x = e.clientX;
    const y = e.clientY;
    // right side → nearest action button
    if (x > w * 0.45) {
      let best: Btn | null = null;
      let bd = Infinity;
      for (const b of this.btns) {
        const d = Math.hypot(x - b.cx, y - b.cy) - b.r;
        if (d < bd) {
          bd = d;
          best = b;
        }
      }
      if (best && bd < Math.max(70, best.r * 1.4)) {
        best.pointer = e.pointerId;
        best.el.classList.add('down');
        this.press(best.id);
        return;
      }
      if (x > w * 0.6) return;
    }
    // left side → floating joystick
    if (this.stick.id === -1 && y > 56) {
      this.stick.id = e.pointerId;
      this.stick.bx = x;
      this.stick.by = y;
      this.stick.x = x;
      this.stick.y = y;
      this.stick.active = true;
      this.stickBase.style.transform = `translate(${x}px, ${y}px)`;
      this.stickKnob.style.transform = `translate(${x}px, ${y}px)`;
      this.controls.classList.add('stick-on');
      this.onAnyInput?.();
    }
  }

  private move(e: PointerEvent) {
    if (e.pointerType === 'mouse') {
      if (e.movementX || e.movementY) {
        this.setTouch(false);
        this.usingPad = false;
      }
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
      this.mouse.last = performance.now();
      this.mouse.valid = true;
      return;
    }
    if (e.pointerId === this.stick.id) {
      e.preventDefault();
      const R = TUNING.input.stickRadius;
      let dx = e.clientX - this.stick.bx;
      let dy = e.clientY - this.stick.by;
      const d = Math.hypot(dx, dy);
      if (d > R) {
        // base follows the thumb (floating stick)
        const k = (d - R) / d;
        this.stick.bx += dx * k;
        this.stick.by += dy * k;
        dx = e.clientX - this.stick.bx;
        dy = e.clientY - this.stick.by;
        this.stickBase.style.transform = `translate(${this.stick.bx}px, ${this.stick.by}px)`;
      }
      this.stick.x = e.clientX;
      this.stick.y = e.clientY;
      this.stickKnob.style.transform = `translate(${this.stick.bx + dx}px, ${this.stick.by + dy}px)`;
    }
  }

  private up(e: PointerEvent) {
    if (e.pointerType === 'mouse') {
      const b: Button | null = e.button === 0 ? 'attack' : e.button === 2 ? 'special' : e.button === 1 ? 'cast' : null;
      if (b) this.mouseHeld[b] = false;
      return;
    }
    if (e.pointerId === this.stick.id) {
      this.stick.id = -1;
      this.stick.active = false;
      this.controls.classList.remove('stick-on');
    }
    for (const b of this.btns) {
      if (b.pointer === e.pointerId) {
        b.pointer = null;
        b.el.classList.remove('down');
      }
    }
  }

  private key(e: KeyboardEvent, down: boolean) {
    if (e.repeat) {
      if (KEYMAP[e.code] || e.code.startsWith('Arrow')) e.preventDefault();
      return;
    }
    if (down && (e.code === 'Escape' || e.code === 'KeyP')) {
      this.onPause?.();
      return;
    }
    if (down && e.code === 'KeyF') {
      this.onFullscreen?.();
      return;
    }
    if (down) {
      this.setTouch(false);
      this.keys.add(e.code);
      const b = KEYMAP[e.code];
      if (b) {
        this.press(b);
        e.preventDefault();
      }
      if (e.code.startsWith('Arrow')) e.preventDefault();
      this.onAnyInput?.();
    } else this.keys.delete(e.code);
  }

  releaseAll() {
    this.keys.clear();
    this.stick.id = -1;
    this.stick.active = false;
    this.controls.classList.remove('stick-on');
    for (const b of this.btns) {
      b.pointer = null;
      b.el.classList.remove('down');
    }
    this.mouseHeld.attack = this.mouseHeld.special = this.mouseHeld.dash = this.mouseHeld.cast = false;
  }

  /** writes the current state into the frame (called once per rendered frame) */
  update(screenToWorld: (x: number, y: number) => { x: number; y: number }) {
    const f = this.frame;
    let mx = 0;
    let my = 0;
    if (this.stick.active) {
      const R = TUNING.input.stickRadius;
      mx = (this.stick.x - this.stick.bx) / R;
      my = (this.stick.y - this.stick.by) / R;
      const m = Math.hypot(mx, my);
      if (m > 1) {
        mx /= m;
        my /= m;
      }
    } else {
      const k = this.keys;
      if (k.has('KeyA') || k.has('ArrowLeft')) mx -= 1;
      if (k.has('KeyD') || k.has('ArrowRight')) mx += 1;
      if (k.has('KeyW') || k.has('ArrowUp')) my -= 1;
      if (k.has('KeyS') || k.has('ArrowDown')) my += 1;
      const m = Math.hypot(mx, my);
      if (m > 1) {
        mx /= m;
        my /= m;
      }
    }
    f.mx = mx;
    f.my = my;
    for (const b of this.btns) {
      let held = b.pointer !== null || this.mouseHeld[b.id];
      for (const code in KEYMAP) if (KEYMAP[code] === b.id && this.keys.has(code)) held = true;
      f.held[b.id] = held && this.enabled;
    }
    this.pollPad(f);
    // gamepad right stick aims
    if (this.usingPad && performance.now() - this.padAim.t < 400 && this.playerPos) {
      const pp = this.playerPos();
      f.aimActive = true;
      f.aimX = pp.x + this.padAim.x * 200;
      f.aimY = pp.y + this.padAim.y * 200;
    } else if (!this.usingTouch && !this.usingPad && this.mouse.valid && (performance.now() - this.mouse.last < 6000 || this.mouseHeld.attack || this.mouseHeld.special)) {
      // mouse aim while the mouse is in use
      const w = screenToWorld(this.mouse.x, this.mouse.y);
      f.aimActive = true;
      f.aimX = w.x;
      f.aimY = w.y;
    } else f.aimActive = false;
    if (!this.enabled) {
      f.mx = f.my = 0;
      f.clearPressed();
    }
  }

  /** Standard-mapping gamepad: left stick / d-pad move, right stick aims, A attack, X special,
   *  B / RB dash, Y / LT sigil, RT attack, Start pause. In menus the stick/d-pad moves focus and A clicks. */
  private pollPad(f: InputFrame) {
    const pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
    let pad: Gamepad | null = null;
    for (const p of pads) if (p && p.connected) {
      pad = p;
      break;
    }
    if (!pad) return;
    const b = (i: number) => !!pad!.buttons[i] && (pad!.buttons[i].pressed || pad!.buttons[i].value > 0.5);
    const edge = (i: number) => b(i) && !this.padPrev[i];
    const dz = (v: number) => (Math.abs(v) < 0.18 ? 0 : v);
    let lx = dz(pad.axes[0] ?? 0);
    let ly = dz(pad.axes[1] ?? 0);
    if (b(14)) lx = -1;
    if (b(15)) lx = 1;
    if (b(12)) ly = -1;
    if (b(13)) ly = 1;
    const rx = dz(pad.axes[2] ?? 0);
    const ry = dz(pad.axes[3] ?? 0);
    let any = Math.abs(lx) + Math.abs(ly) + Math.abs(rx) + Math.abs(ry) > 0;
    for (let i = 0; i < 16; i++) if (b(i)) any = true;
    if (any && !this.usingPad) {
      this.usingPad = true;
      this.setTouch(false);
    }
    const overlay = document.querySelector('.overlay');
    if (overlay) {
      // menu navigation
      this.padNavT -= 1 / 60;
      const dir = Math.abs(lx) > 0.5 || Math.abs(ly) > 0.5 ? (lx + ly > 0 ? 1 : -1) : 0;
      const focusables = Array.from(overlay.querySelectorAll<HTMLElement>('button:not([disabled]), input, select'));
      if (dir && this.padNavT <= 0 && focusables.length) {
        this.padNavT = 0.22;
        const i = focusables.indexOf(document.activeElement as HTMLElement);
        focusables[(i + dir + focusables.length) % focusables.length].focus();
      }
      if (!dir) this.padNavT = 0;
      if (edge(0)) {
        const el = document.activeElement as HTMLElement | null;
        if (el && overlay.contains(el)) el.click();
        else focusables[0]?.focus();
      }
      if (edge(9) || edge(1)) this.onPause?.();
    } else if (this.enabled) {
      if (Math.abs(lx) + Math.abs(ly) > 0) {
        f.mx = lx;
        f.my = ly;
      }
      if (Math.hypot(rx, ry) > 0.35) {
        const m = Math.hypot(rx, ry);
        this.padAim.x = rx / m;
        this.padAim.y = ry / m;
        this.padAim.t = performance.now();
      }
      const map: [number, Button][] = [[0, 'attack'], [7, 'attack'], [2, 'special'], [4, 'special'], [1, 'dash'], [5, 'dash'], [3, 'cast'], [6, 'cast']];
      for (const [i, act] of map) {
        if (b(i)) f.held[act] = true;
        if (edge(i)) {
          f.pressed[act] = true;
          this.onAnyInput?.();
        }
      }
      if (edge(9)) this.onPause?.();
    }
    for (let i = 0; i < pad.buttons.length; i++) this.padPrev[i] = b(i);
  }
}
