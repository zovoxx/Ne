import type { EnemyDef } from './types';
import { BIOME1, SUMMONS1 } from './biome1';
import { BIOME2 } from './biome2';
import { BIOME3, SUMMONS3 } from './biome3';
import { BIOME4, SUMMONS4 } from './biome4';

/** Every regular enemy (used for encounters). */
export const ENEMY_LIST: EnemyDef[] = [...BIOME1, ...BIOME2, ...BIOME3, ...BIOME4];
/** Summons, minibosses and bosses are registered here too so enemyDef() finds them. */
export const ENEMIES: Record<string, EnemyDef> = {};
export function registerEnemies(list: EnemyDef[]) {
  for (const d of list) ENEMIES[d.id] = d;
}
registerEnemies(ENEMY_LIST);
registerEnemies([...SUMMONS1, ...SUMMONS3, ...SUMMONS4]);

export function enemyDef(id: string): EnemyDef {
  const d = ENEMIES[id];
  if (!d) throw new Error('Unknown enemy ' + id);
  return d;
}
