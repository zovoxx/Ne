import type { EnemyDef } from './types';
import { BIOME1 } from './biome1';

/** Every regular enemy, keyed by id. */
export const ENEMY_LIST: EnemyDef[] = [...BIOME1];
export const ENEMIES: Record<string, EnemyDef> = {};
for (const d of ENEMY_LIST) ENEMIES[d.id] = d;

export function enemyDef(id: string): EnemyDef {
  const d = ENEMIES[id];
  if (!d) throw new Error('Unknown enemy ' + id);
  return d;
}
