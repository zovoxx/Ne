import { fangs } from './fangs';
import type { Weapon, WeaponId } from './types';

export const WEAPONS: Record<string, Weapon> = { fangs };
export const WEAPON_ORDER: WeaponId[] = ['fangs'];

export function weaponById(id: string): Weapon {
  return WEAPONS[id] ?? fangs;
}
