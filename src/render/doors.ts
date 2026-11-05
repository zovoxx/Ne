import type { Game } from '../game/game';

/** door portals — implemented in phase 2 */
export interface DoorView {
  update(g: Game, dt: number): void;
}
