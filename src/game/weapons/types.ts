import type { Game } from '../game';
import type { Player } from '../player';

export type WeaponId = 'fangs' | 'anvil' | 'pike' | 'bow' | 'halo';
export type ActKind = 'attack' | 'special' | 'dashAttack' | 'cast';

/**
 * A player action: windup → (optional hold) → active → recovery.
 * Dash may cancel windup, hold and recovery. Attacks may chain from recovery.
 */
export interface ActionSpec {
  id: string;
  kind: ActKind;
  windup: number;
  active: number;
  recovery: number;
  /** movement multiplier during the action */
  moveMul: number;
  /** forward speed during the active phase */
  lunge?: number;
  /** if set, after windup the action stays in a hold phase while this button is held */
  hold?: 'attack' | 'special';
  holdMax?: number;
  /** movement multiplier while holding */
  holdMoveMul?: number;
  /** keep re-aiming at the target during windup / hold */
  track?: boolean;
  finisher?: boolean;
  step?: number;
  /** fraction of recovery after which a buffered attack chains */
  chainAt?: number;
  start?(g: Game, p: Player): void;
  active_?(g: Game, p: Player): void;
  tick?(g: Game, p: Player, dt: number): void;
  holdTick?(g: Game, p: Player, dt: number): void;
  /** called when the hold ends (button released or max time) */
  release?(g: Game, p: Player): void;
  end?(g: Game, p: Player): void;
}

export interface WeaponForge {
  id: string;
  name: string;
  desc: string;
  max: number;
}

export interface Weapon {
  id: WeaponId;
  name: string;
  title: string;
  desc: string;
  color: number;
  /** auto-aim search range */
  assistRange: number;
  /** ranged weapons prioritise back-line targets */
  ranged: boolean;
  forges: WeaponForge[];
  attack(g: Game, p: Player): ActionSpec | null;
  special(g: Game, p: Player): ActionSpec | null;
  dashAttack(g: Game, p: Player): ActionSpec | null;
  /** background update every sim step (projectile weapons, cooldowns) */
  update?(g: Game, p: Player, dt: number): void;
  equip?(g: Game, p: Player): void;
  /** 0..1 readiness for HUD special button */
  specialReady?(g: Game, p: Player): number;
}
