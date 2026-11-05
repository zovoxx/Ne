import type { RunState } from './run';

const META_KEY = 'lanternfall.meta.v1';
const RUN_KEY = 'lanternfall.run.v1';

export interface Settings {
  master: number;
  sfx: number;
  music: number;
  haptics: boolean;
  shake: number;
  showFps: boolean;
  quality: 'auto' | 'high' | 'low';
}

export interface MetaSave {
  version: 1;
  embers: number;
  totalEmbers: number;
  runs: number;
  wins: number;
  deaths: number;
  bestTime: number;
  deepest: number;
  bossKills: number[];
  unlocks: string[];
  lastWeapon: string;
  keepsake: string | null;
  story: string[];
  storyQueue: string[];
  seenPairs: string[];
  seenEnemies: string[];
  settings: Settings;
}

export function defaultMeta(): MetaSave {
  return {
    version: 1,
    embers: 0,
    totalEmbers: 0,
    runs: 0,
    wins: 0,
    deaths: 0,
    bestTime: 0,
    deepest: 0,
    bossKills: [0, 0, 0, 0],
    unlocks: [],
    lastWeapon: 'fangs',
    keepsake: null,
    story: [],
    storyQueue: [],
    seenPairs: [],
    seenEnemies: [],
    settings: { master: 0.8, sfx: 0.9, music: 0.5, haptics: true, shake: 1, showFps: false, quality: 'auto' },
  };
}

function storage(): Storage | null {
  try {
    const s = window.localStorage;
    const k = '__lf_test';
    s.setItem(k, '1');
    s.removeItem(k);
    return s;
  } catch {
    return null;
  }
}

export function loadMeta(): MetaSave {
  const d = defaultMeta();
  const s = storage();
  if (!s) return d;
  try {
    const raw = s.getItem(META_KEY);
    if (!raw) return d;
    const m = JSON.parse(raw) as Partial<MetaSave>;
    return { ...d, ...m, settings: { ...d.settings, ...(m.settings ?? {}) } } as MetaSave;
  } catch {
    return d;
  }
}

export function saveMeta(m: MetaSave) {
  const s = storage();
  if (!s) return;
  try {
    if (m.seenPairs.length > 600) m.seenPairs = m.seenPairs.slice(-600);
    s.setItem(META_KEY, JSON.stringify(m));
  } catch {
    /* quota or private mode: ignore */
  }
}

export function saveRun(r: RunState | null) {
  const s = storage();
  if (!s) return;
  try {
    if (!r) s.removeItem(RUN_KEY);
    else s.setItem(RUN_KEY, JSON.stringify(r));
  } catch {
    /* ignore */
  }
}

export function loadRun(): RunState | null {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(RUN_KEY);
    if (!raw) return null;
    const r = JSON.parse(raw) as RunState;
    if (!r || !r.current || typeof r.biome !== 'number') return null;
    return r;
  } catch {
    return null;
  }
}

export function resetAll() {
  const s = storage();
  if (!s) return;
  try {
    s.removeItem(META_KEY);
    s.removeItem(RUN_KEY);
  } catch {
    /* ignore */
  }
}
