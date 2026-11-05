/**
 * LANTERNFALL — CENTRAL TUNING FILE
 * ---------------------------------
 * Every number that shapes how the game *feels* lives here: hit stop, shake, knockback,
 * squash & stretch, particles, damage numbers, slow motion, streaks, haptics, audio variation,
 * player movement, dash, input buffering, auto-aim, pacing and weapon frame data.
 *
 * Units: distances in world units (the player is ~30 units wide), times in SECONDS,
 * speeds in units/second. "power" is a 0..1 hit-strength value that drives most feedback.
 */
export const TUNING = {
  // ───────────────────────────── VIEW ─────────────────────────────
  view: {
    /** world units visible vertically (phones) — bigger = more zoomed out */
    height: 430,
    /** minimum world units visible horizontally (tablets / 4:3 screens) */
    minWidth: 900,
    /** camera follow sharpness (higher = snappier) */
    follow: 9,
    /** camera leans this far toward the aim / move direction */
    lookahead: 70,
    /** extra zoom applied briefly on big moments (0.06 = 6%) */
    zoomPunchLastKill: 0.09,
    zoomPunchBoss: 0.14,
    zoomPunchDecay: 5,
  },

  // ───────────────────────────── TIME / HIT STOP ─────────────────────────────
  hitstop: {
    /** hit stop for the weakest hit (power 0) */
    min: 0.04,
    /** hit stop for the strongest hit (power 1) */
    max: 0.09,
    /** added on crits */
    critBonus: 0.012,
    /** added when the hit kills */
    killBonus: 0.014,
    /** a new hit stop can't start until this long after the last one ended (keeps fast weapons fluid) */
    cooldown: 0.03,
    /** maximum total hit stop per rolling second, so multi-hits never feel sticky */
    budgetPerSecond: 0.32,
    /** particles/FX keep moving at this fraction of speed during hit stop (keeps it alive) */
    fxSpeedDuringStop: 0.12,
  },
  slowmo: {
    /** last kill of a room */
    lastKillScale: 0.18,
    lastKillDuration: 0.55,
    /** boss kill */
    bossKillScale: 0.1,
    bossKillDuration: 1.3,
    /** player death */
    deathScale: 0.25,
    deathDuration: 0.7,
    /** how quickly time ramps back to 1 at the end (fraction of duration spent easing) */
    easeOut: 0.45,
  },

  // ───────────────────────────── SCREEN SHAKE ─────────────────────────────
  shake: {
    /** trauma added per unit of hit power (trauma is squared for amplitude) */
    traumaPerPower: 0.32,
    traumaCrit: 0.12,
    traumaKill: 0.1,
    traumaHurt: 0.55,
    traumaExplosion: 0.5,
    traumaBossSlam: 0.7,
    /** max random shake offset in screen px at trauma 1 */
    maxOffset: 18,
    maxAngle: 0.028,
    /** trauma lost per second */
    decay: 2.6,
    /** directional kick: camera is shoved along the hit direction (px per power), then springs back */
    kickPerPower: 9,
    kickSpring: 220,
    kickDamping: 18,
    frequency: 32,
  },

  // ───────────────────────────── ENEMY HIT REACTION ─────────────────────────────
  flash: {
    /** white hit flash length */
    duration: 0.085,
    critDuration: 0.12,
  },
  knockback: {
    /** units/s impulse for a power-1, knock-1 hit on a mass-1 enemy */
    base: 520,
    /** exponential decay of knockback velocity per second */
    friction: 11,
    /** knockback above this speed counts as a "slam" when the enemy hits a wall/pillar */
    slamSpeed: 380,
    slamDamageFrac: 0.35,
  },
  hitstun: {
    /** seconds of stagger for power 0 / power 1 hits on staggerable enemies */
    min: 0.1,
    max: 0.32,
  },
  squash: {
    /** squash amount at power 1 (0.35 = 35% stretch) */
    amount: 0.38,
    /** spring frequency and damping of the wobble back to rest */
    freq: 26,
    damp: 11,
    /** player squash on dash / attack */
    playerDash: 0.3,
    playerAttack: 0.16,
  },

  // ───────────────────────────── PARTICLES / DECALS ─────────────────────────────
  particles: {
    /** global cap — oldest particles are recycled past this */
    max: 1400,
    /** sparks/blood on hit: min..max count scaled by power */
    hitMin: 5,
    hitMax: 16,
    hitCritExtra: 8,
    /** directional spray cone (radians) and speed range */
    hitCone: 0.9,
    hitSpeedMin: 160,
    hitSpeedMax: 620,
    /** death shatter shards */
    shardsMin: 10,
    shardsMax: 22,
    /** last-kill burst */
    lastKillBurst: 60,
    /** multiplier applied at each kill-streak tier (index = tier) */
    streakMul: [1, 1.15, 1.35, 1.6, 1.9],
  },
  decals: {
    max: 140,
    /** seconds before an impact decal starts fading, and fade length */
    hold: 5,
    fade: 3,
  },
  trails: {
    /** weapon swing arc lifetime */
    slashLife: 0.13,
    finisherLife: 0.2,
    /** dash afterimages per dash */
    dashGhosts: 4,
    ghostLife: 0.22,
  },

  // ───────────────────────────── DAMAGE NUMBERS ─────────────────────────────
  damageNumbers: {
    life: 0.7,
    rise: 46,
    /** pop-in: starts at popScale and settles to 1 over popTime */
    popScale: 2.1,
    popTime: 0.11,
    size: 0.64,
    critSize: 1.05,
    critShake: 3,
    /** hits on the same enemy within this window stack into one rising number */
    mergeWindow: 0.38,
    colorNormal: 0xffffff,
    colorCrit: 0xffc21a,
    colorStatus: 0xff8a3d,
    colorPlayerHurt: 0xff3b4a,
    colorHeal: 0x5dff9a,
  },

  // ───────────────────────────── KILL STREAK ─────────────────────────────
  streak: {
    /** seconds to land the next kill before the streak breaks (shrinks slightly per tier) */
    window: 2.6,
    windowPerTier: -0.15,
    /** kills needed for each tier */
    tiers: [5, 12, 24, 40],
    names: ['', 'KINDLED', 'BLAZING', 'INFERNO', 'SUPERNOVA'],
    colors: [0xffffff, 0xffd166, 0xff8a3d, 0xff3d6e, 0xb48cff],
    /** damage bonus per tier */
    damageBonus: [0, 0.05, 0.1, 0.16, 0.24],
    /** bonus gold per kill per tier */
    goldPerKill: [0, 0, 1, 1, 2],
    /** the streak timer pauses during room transitions and choices */
  },

  // ───────────────────────────── HAPTICS (navigator.vibrate, ms) ─────────────────────────────
  haptics: {
    hit: 7,
    crit: 14,
    kill: 10,
    heavy: 18,
    hurt: [40, 30, 30],
    lastKill: [20, 40, 50],
    bossKill: [40, 60, 40, 60, 120],
    dash: 0,
    /** minimum ms between pulses so the motor never buzzes continuously */
    minInterval: 45,
  },

  // ───────────────────────────── AUDIO ─────────────────────────────
  audio: {
    master: 0.8,
    sfx: 0.9,
    music: 0.45,
    /** random pitch spread per sound (0.08 = ±8%) */
    pitchVariation: 0.08,
    /** pitch rises this much per combo step */
    comboPitchStep: 0.07,
    /** pitch rises per kill-streak tier on kill sounds */
    streakPitchStep: 0.05,
    maxVoices: 28,
    /** same sound can't retrigger faster than this (seconds) */
    retrigger: 0.028,
  },

  // ───────────────────────────── PLAYER ─────────────────────────────
  player: {
    radius: 15,
    maxHp: 60,
    maxSpeed: 345,
    accel: 3600,
    decel: 5200,
    /** movement multiplier while attacking */
    attackMoveMul: 0.3,
    /** invulnerability after being hit */
    hurtIframes: 0.8,
    hurtKnock: 300,
    hurtHitstop: 0.07,
    /** seconds the player can't act after being hit (very short — keeps control) */
    hurtLock: 0.06,
  },
  dash: {
    distance: 185,
    duration: 0.13,
    /** invulnerability window, starts at dash start */
    iframes: 0.2,
    /** cooldown per charge */
    cooldown: 0.34,
    charges: 1,
    /** after the dash, movement keeps this fraction of dash speed for a moment (slide) */
    exitSpeedFrac: 0.45,
    /** pressing attack within this window after a dash triggers the weapon's dash-attack */
    dashAttackWindow: 0.18,
  },
  input: {
    /** any action pressed this long before it becomes possible will still fire */
    buffer: 0.15,
    /** joystick dead zone (0..1) and radius in CSS px */
    deadzone: 0.14,
    stickRadius: 58,
    /** stick magnitude above this = full speed (makes thumbs lazy-friendly) */
    fullSpeedAt: 0.62,
  },
  aim: {
    /** half-angle of the preferred cone in front of the movement direction */
    coneDeg: 65,
    /** targets beyond the cone are only picked if within this radius */
    closeRadius: 90,
    /** weight of angle vs distance in target score */
    angleWeight: 1.25,
    /** current target keeps this score bonus to avoid flicker */
    stickiness: 0.3,
    /** bonus for dangerous support/ranged targets with ranged weapons */
    priorityBonus: 0.15,
    /** mouse aim: snap to an enemy within this angle of the cursor direction */
    mouseSnapDeg: 14,
  },
  cast: {
    charges: 2,
    recharge: 3.6,
    radius: 78,
    delay: 0.32,
    damage: 18,
    rootTime: 1.5,
    range: 260,
  },
  crit: {
    baseChance: 0.04,
    multiplier: 2.5,
  },

  // ───────────────────────────── PACING ─────────────────────────────
  pacing: {
    /** delay after entering a room before the first wave appears */
    firstWaveDelay: 0.15,
    /** spawn portal telegraph duration (enemies are invulnerable and harmless during it) */
    spawnTelegraph: 0.42,
    /** enemies spawn between these distances from the player */
    spawnMinDist: 170,
    spawnMaxDist: 360,
    /** next wave triggers when the current wave is down to this fraction of its enemies */
    nextWaveAt: 0.34,
    /** or after this many seconds, whichever is first */
    waveMaxTime: 13,
    /** reward orb flies to the player automatically */
    rewardMagnetDelay: 0.25,
    /** room transition: fade out + fade in (seconds each) */
    transitionOut: 0.16,
    transitionIn: 0.18,
    /** death → death screen */
    deathScreenDelay: 0.85,
    /** enemies stay aggressive: they never idle longer than this before acting */
    maxIdle: 0.6,
  },

  // ───────────────────────────── SCALING ─────────────────────────────
  scaling: {
    /** enemy HP multiplier per biome (index 0 = biome 1) */
    hpByBiome: [1, 1.55, 2.25, 3.1],
    /** enemy damage multiplier per biome */
    dmgByBiome: [1, 1.25, 1.5, 1.8],
    /** extra HP per room depth inside a biome */
    hpPerStep: 0.05,
    eliteHp: 1.9,
    eliteDmg: 1.2,
  },

  // ───────────────────────────── WEAPONS ─────────────────────────────
  // Each combo step: windup → active → recovery (seconds). dmg, range/arc (deg) or len/width.
  // power drives hit stop/shake/particles. knock scales knockback. lunge = forward speed during active.
  weapons: {
    fangs: {
      combo: [
        { windup: 0.03, active: 0.07, recovery: 0.12, dmg: 11, range: 80, arc: 150, power: 0.32, knock: 0.7, lunge: 240 },
        { windup: 0.03, active: 0.07, recovery: 0.12, dmg: 11, range: 80, arc: 150, power: 0.34, knock: 0.7, lunge: 240 },
        { windup: 0.035, active: 0.08, recovery: 0.14, dmg: 14, range: 86, arc: 170, power: 0.45, knock: 0.9, lunge: 280 },
        { windup: 0.07, active: 0.14, recovery: 0.22, dmg: 28, range: 100, arc: 360, power: 0.95, knock: 2.4, lunge: 120 },
      ],
      comboResetTime: 0.32,
      backstabCritBonus: 0.5,
      special: { cooldown: 0.5, knives: 3, spreadDeg: 13, dmg: 9, speed: 980, pierce: 2, power: 0.25, range: 520 },
      dashAttack: { windup: 0.02, active: 0.1, recovery: 0.16, dmg: 20, len: 110, width: 46, power: 0.65, knock: 1.2, lunge: 620 },
      assistRange: 240,
    },
    anvil: {
      combo: [
        { windup: 0.16, active: 0.1, recovery: 0.2, dmg: 30, range: 104, arc: 130, power: 0.75, knock: 1.6, lunge: 200 },
        { windup: 0.14, active: 0.11, recovery: 0.22, dmg: 30, range: 108, arc: 210, power: 0.8, knock: 1.7, lunge: 180 },
        { windup: 0.24, active: 0.12, recovery: 0.32, dmg: 64, range: 130, arc: 360, power: 1, knock: 3.2, lunge: 0 },
      ],
      comboResetTime: 0.38,
      armorBreakMul: 2.5,
      special: { cooldown: 0.25, chargeMax: 0.75, dmgMin: 24, dmgMax: 70, rangeMin: 150, rangeMax: 320, width: 70, power: 1 },
      dashAttack: { windup: 0.04, active: 0.14, recovery: 0.2, dmg: 34, len: 120, width: 70, power: 0.85, knock: 2.6, lunge: 560 },
      assistRange: 230,
    },
    pike: {
      combo: [
        { windup: 0.06, active: 0.08, recovery: 0.15, dmg: 15, len: 158, width: 30, power: 0.42, knock: 0.9, lunge: 180 },
        { windup: 0.05, active: 0.08, recovery: 0.15, dmg: 15, len: 158, width: 30, power: 0.44, knock: 0.9, lunge: 180 },
        { windup: 0.1, active: 0.12, recovery: 0.26, dmg: 34, len: 190, width: 38, power: 0.9, knock: 3, lunge: 380 },
      ],
      comboResetTime: 0.34,
      /** outer fraction of the thrust that counts as a "tip" hit */
      tipFraction: 0.3,
      tipCritBonus: 0.6,
      special: { tickEvery: 0.11, dmg: 7, radius: 120, moveMul: 0.55, maxTime: 2.2, power: 0.22, cooldown: 0.2 },
      dashAttack: { windup: 0.02, active: 0.12, recovery: 0.16, dmg: 24, len: 210, width: 34, power: 0.7, knock: 1.5, lunge: 700 },
      assistRange: 300,
    },
    bow: {
      shot: { cooldown: 0.17, dmg: 9, speed: 1250, power: 0.22, range: 760 },
      volleyEvery: 4,
      volley: { arrows: 3, spreadDeg: 10 },
      charge: { time: 0.42, perfectWindow: 0.12, dmg: 34, perfectDmg: 48, speed: 1650, pierce: 99, power: 0.75, moveMul: 0.55 },
      special: { cooldown: 0.9, delay: 0.3, radius: 95, hits: 6, dmg: 7, interval: 0.07, power: 0.3 },
      dashAttack: { arrows: 5, spreadDeg: 36, dmg: 10, speed: 1150, power: 0.3 },
      assistRange: 700,
    },
    halo: {
      throw: { range: 330, outTime: 0.26, dmg: 13, returnSpeed: 1300, power: 0.42, radius: 26, knock: 0.9 },
      finisherEvery: 3,
      finisher: { grindTime: 0.7, grindTick: 0.08, grindDmg: 6, dmgMul: 1.6, radius: 38 },
      special: { duration: 2.4, orbitRadius: 88, angularSpeed: 11, tickDmg: 8, power: 0.3, cooldown: 0.4 },
      dashAttack: { dmg: 18, range: 240, power: 0.5 },
      assistRange: 420,
    },
  },
};

export type Tuning = typeof TUNING;
