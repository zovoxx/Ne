import { CanvasSource, Rectangle, Texture } from 'pixi.js';
import { ASSETS, type AssetSpec } from './assets';
import { ART } from './art/kit';

const RES = 2;
const PAGE = 2048;
const PAD = 3;

interface Cell {
  key: string;
  spec: AssetSpec;
  pw: number;
  ph: number;
  sil: boolean;
  img?: HTMLImageElement;
  page: number;
  x: number;
  y: number;
}

/** Builds GPU texture pages from the central asset map. */
export class Atlas {
  readonly tex: Record<string, Texture> = {};
  readonly sil: Record<string, Texture> = {};
  readonly pages: HTMLCanvasElement[] = [];

  async build() {
    ART.res = RES;
    const cells: Cell[] = [];
    const loads: Promise<void>[] = [];
    for (const key in ASSETS) {
      const spec = ASSETS[key];
      const cell: Cell = {
        key,
        spec,
        pw: Math.ceil(spec.w * RES) + PAD * 2,
        ph: Math.ceil(spec.h * RES) + PAD * 2,
        sil: !!spec.sil,
        page: 0,
        x: 0,
        y: 0,
      };
      if (spec.url) {
        loads.push(
          new Promise<void>((res) => {
            const img = new Image();
            img.onload = () => {
              cell.img = img;
              res();
            };
            img.onerror = () => {
              console.warn('[atlas] failed to load', spec.url, '— using procedural art');
              res();
            };
            img.src = spec.url!;
          }),
        );
      }
      cells.push(cell);
      if (cell.sil) cells.push({ ...cell, key: '#sil#' + key });
    }
    await Promise.all(loads);
    // the silhouette copies need the image reference too
    for (const c of cells) if (c.key.startsWith('#sil#')) c.img = cells.find((o) => o.key === c.key.slice(5))?.img;

    // shelf pack, tallest first
    const sorted = [...cells].sort((a, b) => b.ph - a.ph);
    let page = 0;
    let x = 0;
    let y = 0;
    let shelfH = 0;
    for (const c of sorted) {
      if (c.pw > PAGE || c.ph > PAGE) throw new Error('asset too large: ' + c.key);
      if (x + c.pw > PAGE) {
        x = 0;
        y += shelfH;
        shelfH = 0;
      }
      if (y + c.ph > PAGE) {
        page++;
        x = 0;
        y = 0;
        shelfH = 0;
      }
      c.page = page;
      c.x = x;
      c.y = y;
      x += c.pw;
      shelfH = Math.max(shelfH, c.ph);
    }
    const nPages = page + 1;
    const sources: CanvasSource[] = [];
    for (let i = 0; i < nPages; i++) {
      const cv = document.createElement('canvas');
      // shrink the last page to what is used
      cv.width = PAGE;
      cv.height = PAGE;
      this.pages.push(cv);
    }
    for (const c of cells) {
      const ctx = this.pages[c.page].getContext('2d')!;
      ctx.save();
      ctx.translate(c.x + PAD, c.y + PAD);
      if (c.img) {
        ctx.drawImage(c.img, 0, 0, c.pw - PAD * 2, c.ph - PAD * 2);
      } else if (c.spec.draw) {
        ctx.scale(RES, RES);
        c.spec.draw(ctx, c.spec.w, c.spec.h);
      }
      ctx.restore();
      if (c.key.startsWith('#sil#')) {
        ctx.save();
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(c.x, c.y, c.pw, c.ph);
        ctx.restore();
      }
    }
    for (let i = 0; i < nPages; i++) {
      sources.push(new CanvasSource({ resource: this.pages[i], resolution: RES, autoGenerateMipmaps: true, scaleMode: 'linear' }));
    }
    for (const c of cells) {
      const spec = c.spec;
      const frame = new Rectangle((c.x + PAD) / RES, (c.y + PAD) / RES, spec.w, spec.h);
      const t = new Texture({ source: sources[c.page], frame, defaultAnchor: { x: spec.ax ?? 0.5, y: spec.ay ?? 0.5 } });
      if (c.key.startsWith('#sil#')) this.sil[c.key.slice(5)] = t;
      else this.tex[c.key] = t;
    }
  }

  get(key: string): Texture {
    return this.tex[key] ?? this.tex['dot'];
  }
  silhouette(key: string): Texture {
    return this.sil[key] ?? this.get(key);
  }
}
