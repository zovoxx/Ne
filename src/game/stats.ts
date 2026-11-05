import type { Element, Slot } from './entities';

/**
 * Derived build stats. Recomputed from scratch whenever the player's boons change:
 * every boon's apply() writes into a fresh Stats object. Gameplay code only ever reads this.
 */
export class Stats {
  // damage multipliers (additive bonuses, 0 = +0%)
  attackDmg = 0;
  specialDmg = 0;
  dashDmg = 0;
  castDmg = 0;
  allDmg = 0;
  /** extra damage vs. enemies with any status */
  vsStatusDmg = 0;
  /** extra damage vs. elites/bosses */
  vsEliteDmg = 0;
  /** extra damage to enemies at full health / first hit */
  firstHitDmg = 0;
  critChance = 0;
  critMul = 0;
  attackSpeed = 0;
  specialSpeed = 0;
  moveSpeed = 0;
  dashCharges = 0;
  dashCooldown = 0;
  dashDistance = 0;
  maxHp = 0;
  castCharges = 0;
  castRecharge = 0;
  castRadius = 0;
  castDamage = 0;
  castRoot = 0;
  damageTaken = 0;
  /** chance to dodge enemy damage */
  dodge = 0;
  goldGain = 0;
  healOnRoomClear = 0;
  lifeSteal = 0;
  knockback = 0;
  /** slot infusions: element applied by each slot and its power (rarity/level scaled) */
  infuse: Record<Slot, Element | null> = { attack: null, special: null, dash: null, cast: null, other: null };
  infusePow: Record<Slot, number> = { attack: 0, special: 0, dash: 0, cast: 0, other: 0 };
  /** element-specific parameters (base values, boons add to these) */
  burnDps = 2.2; // per stack per second
  burnMax = 20;
  burnDecay = 0; // extra decay
  chillPerStack = 0.06; // slow per stack
  chillMax = 10;
  freezeTime = 1.4;
  freezeVuln = 0.4;
  shatterDmg = 0; // frozen enemy death explosion damage
  joltChains = 2;
  joltDmg = 10;
  joltRange = 170;
  tideKnock = 0.6;
  tideSlamDmg = 18;
  dawnMarkCrit = 0.25;
  dawnCritDmg = 0;
  hexDmgTaken = 0.25;
  hexSpread = 2;
  hexBurst = 22;
  galeSpeed = 0;
  galeBlade = 0;
  bleedBurst = 6; // per stack on burst
  bleedMax = 12;
  /** free-form flags & numbers for unique boon mechanics, keyed by boon/duo id */
  f: Record<string, number> = {};

  has(flag: string) {
    return (this.f[flag] ?? 0) > 0;
  }
  val(flag: string) {
    return this.f[flag] ?? 0;
  }
  add(flag: string, v: number) {
    this.f[flag] = (this.f[flag] ?? 0) + v;
  }
  slotDmg(slot: Slot) {
    switch (slot) {
      case 'attack':
        return this.attackDmg;
      case 'special':
        return this.specialDmg;
      case 'dash':
        return this.dashDmg;
      case 'cast':
        return this.castDmg;
      default:
        return 0;
    }
  }
}
