/**
 * Game → presentation event queue.
 * The simulation pushes events (hits, kills, swings…) and the renderer / audio / haptics drain them.
 * Events live in a fixed ring of reusable objects so combat never allocates.
 */
export const EV = {
  Hit: 1,
  Kill: 2,
  PlayerHurt: 3,
  Swing: 4,
  Dash: 5,
  CastThrow: 6,
  CastBoom: 7,
  Shoot: 8,
  Explosion: 9,
  SpawnPortal: 10,
  Spawned: 11,
  Block: 12,
  LastKill: 13,
  Pickup: 14,
  StreakTier: 15,
  StreakEnd: 16,
  Heal: 17,
  StatusProc: 18,
  PlayerDeath: 19,
  DoorsOpen: 20,
  RoomEnter: 21,
  EnemyShoot: 22,
  Telegraph: 23,
  Chain: 24,
  Shatter: 25,
  Slam: 26,
  Reward: 27,
  Ui: 28,
  BossPhase: 29,
  BossKill: 30,
  Beam: 31,
  Freeze: 32,
  Revive: 33,
  Gold: 34,
  ChargeReady: 35,
  Burrow: 36,
  Teleport: 37,
  Deflect: 38,
  ArmorBreak: 39,
  ShieldBreak: 40,
  Text: 41,
  Footstep: 42,
  Recall: 43,
  Catch: 44,
  DeathDefy: 45,
  Lightning: 46,
} as const;
export type EvType = (typeof EV)[keyof typeof EV];

export class GameEvent {
  type: number = 0;
  x = 0;
  y = 0;
  dx = 0;
  dy = 0;
  power = 0;
  amount = 0;
  crit = false;
  flag = 0;
  color = 0xffffff;
  ref: unknown = null;
  ref2: unknown = null;
  key = '';
  n = 0;
}

export class EventQueue {
  private ring: GameEvent[] = [];
  private head = 0;
  count = 0;
  readonly cap: number;
  constructor(cap = 1024) {
    this.cap = cap;
    for (let i = 0; i < cap; i++) this.ring.push(new GameEvent());
  }
  push(type: number, x = 0, y = 0): GameEvent {
    if (this.count >= this.cap) {
      // drop the oldest event rather than allocate
      this.head = (this.head + 1) % this.cap;
      this.count--;
    }
    const e = this.ring[(this.head + this.count) % this.cap];
    this.count++;
    e.type = type;
    e.x = x;
    e.y = y;
    e.dx = 0;
    e.dy = 0;
    e.power = 0;
    e.amount = 0;
    e.crit = false;
    e.flag = 0;
    e.color = 0xffffff;
    e.ref = null;
    e.ref2 = null;
    e.key = '';
    e.n = 0;
    return e;
  }
  /** Iterate and clear. */
  drain(fn: (e: GameEvent) => void) {
    while (this.count > 0) {
      const e = this.ring[this.head];
      this.head = (this.head + 1) % this.cap;
      this.count--;
      fn(e);
    }
  }
  clear() {
    this.head = 0;
    this.count = 0;
  }
}
