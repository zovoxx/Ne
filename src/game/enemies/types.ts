import type { Enemy } from '../entities';
import type { Game } from '../game';

/** Encounter roles — rooms are composed from roles, not random piles. */
export type Role = 'front' | 'back' | 'tank' | 'swarm' | 'support' | 'zone' | 'disrupt' | 'elite';

export interface HitInfoLike {
  dirX: number;
  dirY: number;
  srcX: number;
  srcY: number;
  power: number;
  slot: string;
  isDot: boolean;
}

export interface EnemyDef {
  id: string;
  name: string;
  /** one-line hint shown in the debug menu / codex */
  blurb: string;
  biome: number;
  roles: Role[];
  hp: number;
  speed: number;
  radius: number;
  mass: number;
  /** contact damage (0 = harmless body) */
  contact: number;
  /** attack damage */
  dmg: number;
  /** asset-map key of the body sprite */
  art: string;
  /** blood / spark colour */
  blood: number;
  /** encounter budget cost */
  cost: number;
  /** how many spawn together as one "unit" (swarms, tether pairs) */
  group?: number;
  /** progression tier needed before it appears (0 = always) */
  unlock?: number;
  flying?: boolean;
  noKnock?: boolean;
  superArmor?: boolean;
  /** never stagger (bosses/heavies) */
  staggerImmune?: boolean;
  frontShield?: number;
  armor?: number;
  /** can't receive elite modifiers */
  noElite?: boolean;
  /** if true the enemy does not need to die for the room to clear */
  optional?: boolean;
  /** max simultaneous in one room */
  max?: number;
  /** rotation style for the renderer */
  orient?: 'flip' | 'rotate' | 'none';
  init?(e: Enemy, g: Game): void;
  update(e: Enemy, g: Game, dt: number): void;
  onDeath?(e: Enemy, g: Game): void;
  /** return true to cancel the hit entirely (dodges, parries) */
  onHit?(e: Enemy, g: Game, info: HitInfoLike): boolean;
  onRemove?(e: Enemy, g: Game): void;
}
