import type { Element } from '../entities';
import type { Stats } from '../stats';

export type PatronId = Element;
export type BoonSlot = 'attack' | 'special' | 'dash' | 'cast' | 'revenge' | 'passive' | 'legendary' | 'duo';

export interface PatronDef {
  id: PatronId;
  name: string;
  title: string;
  color: number;
  /** one-line flavour shown when they offer boons */
  greet: string[];
  /** short description of the patron's mechanic */
  theme: string;
  /** progression tier needed (0 = available from the start) */
  unlock: number;
}

export interface BoonDef {
  id: string;
  patron: PatronId | 'duo';
  name: string;
  slot: BoonSlot;
  /** description template: {0}, {1}… are replaced with formatted values */
  text: string;
  /** base values (rarity/level scale them unless fixed[i]) */
  base: number[];
  /** formatting per value: '%' shows ×100 with a %, 's' seconds, '' plain integer */
  fmt?: string[];
  /** values that do not scale with rarity/level */
  fixed?: boolean[];
  apply(s: Stats, v: number[]): void;
  /** extra requirement beyond the default rules */
  req?(ctx: BoonContext): boolean;
  duo?: [PatronId, PatronId];
  weight?: number;
  /** passive that does not need a core boon from its patron */
  free?: boolean;
}

export interface OwnedBoon {
  id: string;
  rarity: number;
  level: number;
}

export interface BoonContext {
  owned: Map<string, OwnedBoon>;
  patronCount: Map<string, number>;
  slots: Map<BoonSlot, string>;
}

export const RARITY_NAMES = ['Common', 'Rare', 'Epic', 'Heroic'];
export const RARITY_COLORS = [0xd8d2e8, 0x5db7ff, 0xc07bff, 0xffb33d];
export const RARITY_MUL = [1, 1.35, 1.75, 2.2];
export const LEVEL_STEP = 0.3;

export function boonValues(def: BoonDef, rarity: number, level: number): number[] {
  const k = RARITY_MUL[rarity] * (1 + LEVEL_STEP * (level - 1));
  return def.base.map((b, i) => {
    if (def.fixed?.[i]) return b;
    const v = b * k;
    const f = def.fmt?.[i] ?? '';
    return f === '%' ? Math.round(v * 100) / 100 : f === 's' ? Math.round(v * 10) / 10 : Math.round(v);
  });
}

export function boonText(def: BoonDef, v: number[]): string {
  return def.text.replace(/\{(\d)\}/g, (_, i) => {
    const n = v[+i];
    const f = def.fmt?.[+i] ?? '';
    if (f === '%') return Math.round(n * 100) + '%';
    if (f === 's') return n.toFixed(1) + 's';
    return String(n);
  });
}
