import { fangs } from './fangs';
import { anvil } from './anvil';
import { pike } from './pike';
import { bow } from './bow';
import { halo } from './halo';
import type { Weapon, WeaponId } from './types';

export const WEAPONS: Record<string, Weapon> = { fangs, anvil, pike, bow, halo };
export const WEAPON_ORDER: WeaponId[] = ['fangs', 'pike', 'anvil', 'bow', 'halo'];

export function weaponById(id: string): Weapon {
  return WEAPONS[id] ?? fangs;
}
