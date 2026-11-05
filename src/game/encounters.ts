import type { Game } from './game';
import type { RoomPlan, RunState } from './run';

export interface SpawnGroup {
  def: string;
  count: number;
  elite?: number;
  /** where the group appears relative to the player */
  place?: 'near' | 'far' | 'flank' | 'ring' | 'behind' | 'center';
}
export interface Wave {
  groups: SpawnGroup[];
  /** template name (debug / novelty tracking) */
  name: string;
}

/** Phase-2 placeholder: rush waves. Replaced by role-based composition. */
export function planEncounter(g: Game, run: RunState, plan: RoomPlan): Wave[] {
  const n = 5 + plan.step + run.biome * 2;
  const waves: Wave[] = [];
  const count = plan.type === 'mini' || plan.type === 'boss' ? 3 : plan.type === 'elite' ? 3 : 2;
  for (let i = 0; i < count; i++) waves.push({ name: 'rush', groups: [{ def: 'cinderling', count: n + i * 2, place: 'near', elite: plan.type === 'elite' && i > 0 ? 1 : 0 }] });
  void g;
  return waves;
}
