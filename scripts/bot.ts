/**
 * Headless soak test: plays full runs with the BotBrain, no renderer.
 *   npx tsx scripts/bot.ts [--runs=20] [--weapon=fangs|all] [--seed=123] [--verbose] [--skill=1]
 * Reports crashes (with seeds to reproduce), run time, room clear times and who kills the bot.
 */
import { Game } from '../src/game/game';
import { RNG } from '../src/game/math';
import { installMechanics } from '../src/game/boons/mechanics';
import { weaponById, WEAPON_ORDER } from '../src/game/weapons';
import { newRun, recomputeStats, type Offer, type RoomPlan } from '../src/game/run';
import { RoomController, type RoomHooks, type ShopItem } from '../src/game/room';
import { firstRoom } from '../src/game/rooms';
import { BotBrain } from '../src/game/bot';
import { EV } from '../src/game/events';
import type { Enemy } from '../src/game/entities';
import type { WeaponId } from '../src/game/weapons/types';
import { BOON_BY_ID } from '../src/game/boons/patrons';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? 'true'];
  }),
);
const RUNS = Number(args.runs ?? 10);
const VERBOSE = args.verbose === 'true';
const SKILL = Number(args.skill ?? 1);
const weapons: WeaponId[] = args.weapon === 'all' || !args.weapon ? (WEAPON_ORDER as WeaponId[]) : [args.weapon as WeaponId];
const extraHooks: { setup?: (g: Game) => void } = {};
void extraHooks;

interface RoomLog {
  type: string;
  biome: number;
  step: number;
  time: number;
  dmg: number;
}
interface RunResult {
  seed: number;
  weapon: string;
  won: boolean;
  crashed: string | null;
  biome: number;
  step: number;
  rooms: number;
  time: number;
  kills: number;
  killer: string;
  roomLog: RoomLog[];
  boons: string[];
  hurtBy: Record<string, number>;
  bestStreak: number;
}

function playRun(seed: number, weapon: WeaponId): RunResult {
  const g = new Game();
  g.headless = true;
  g.rng = new RNG(seed);
  installMechanics(g.effects);
  const w = weaponById(weapon);
  g.weapon = w;
  g.player.weapon = w;
  const run = newRun(seed, weapon, { maxHpBonus: 0, deathDefiance: 1, rerolls: 1, gold: 0, keepsake: null });
  g.player.reset(run.maxHpBase);
  g.player.deathDefiance = run.deathDefiance;
  recomputeStats(g, run);
  w.equip?.(g, g.player);
  const bot = new BotBrain();
  bot.skill = SKILL;
  let won = false;
  let pendingOffer: Offer | null = null;
  let pendingShop: { item: ShopItem; buy: () => void } | null = null;
  let pendingOrdeal: { accept: () => void; decline: () => void } | null = null;
  const roomLog: RoomLog[] = [];
  let roomStart = 0;
  let roomDmg = 0;
  let curPlan = null as RoomPlan | null;
  const hurtBy: Record<string, number> = {};
  let killer = '';
  const hooks: RoomHooks = {
    offer: (o) => {
      g.mode = 'choice';
      pendingOffer = o;
    },
    enter: (plan) => {
      if (curPlan) roomLog.push({ type: curPlan.type, biome: curPlan.biome, step: curPlan.step, time: run.time - roomStart, dmg: roomDmg });
      curPlan = plan;
      roomStart = run.time;
      roomDmg = 0;
      if (VERBOSE) console.log(`  enter b${plan.biome} s${plan.step} ${plan.type} reward=${plan.reward} hp=${Math.round(g.player.hp)}/${g.player.maxHp} t=${run.time.toFixed(0)}s`);
    },
    cleared: () => {},
    runWon: () => {
      won = true;
    },
    shopPrompt: (item, buy) => {
      g.mode = 'choice';
      pendingShop = { item, buy };
    },
    ordealPrompt: (plan, accept, decline) => {
      g.mode = 'choice';
      pendingOrdeal = { accept, decline };
      void plan;
    },
  };
  const rc = new RoomController(run, hooks);
  g.room = rc;
  g.mode = 'play';
  rc.enter(g, firstRoom(g.rng));
  const dt = 1 / 60;
  const maxFrames = 60 * 60 * 40;
  let crashed: string | null = null;
  let stuck = 0;
  let lastRooms = 0;
  try {
    for (let i = 0; i < maxFrames; i++) {
      bot.think(g, rc, g.input, dt);
      g.update(dt);
      g.events.drain((ev) => {
        if (ev.type === EV.PlayerHurt && ev.amount > 0) {
          const id = (ev.ref as Enemy | null)?.def?.id ?? 'hazard';
          hurtBy[id] = (hurtBy[id] ?? 0) + ev.amount;
          roomDmg += ev.amount;
          killer = id;
        }
      });
      if (pendingOffer) {
        const o = pendingOffer as Offer;
        pendingOffer = null;
        const opt = bot.choose(o);
        opt.apply();
        if ((g.mode as string) === 'choice') g.mode = 'play';
      }
      if (pendingShop) {
        const s = pendingShop as { item: ShopItem; buy: () => void };
        pendingShop = null;
        g.mode = 'play';
        const want = s.item.kind === 'heal' ? g.player.hp < g.player.maxHp * 0.6 : s.item.kind === 'boon' || s.item.kind === 'heart';
        if (want && g.gold >= s.item.price) s.buy();
      }
      if (pendingOrdeal) {
        const o = pendingOrdeal as { accept: () => void; decline: () => void };
        pendingOrdeal = null;
        if (g.rng.chance(0.6)) o.accept();
        else o.decline();
      }
      if (won || g.player.dead) break;
      // soft-lock detector: no room progress for 3 minutes of sim time
      if (run.rooms !== lastRooms) {
        lastRooms = run.rooms;
        stuck = 0;
      } else if (++stuck > 60 * 180) {
        crashed = `SOFTLOCK in b${run.biome} s${run.step} ${curPlan?.type} state=${rc.state} mode=${g.mode} enemies=${g.aliveEnemies()} pending=${rc.pending.length} wave=${rc.waveIdx}/${rc.waves.length} :: ` + g.enemies.live.filter((e) => e.active).map((e) => `${e.def.id}[st${e.st} t${e.t.toFixed(1)} (${e.x.toFixed(0)},${e.y.toFixed(0)}) hp${e.hp.toFixed(0)} ${e.untargetable ? 'UNTARG ' : ''}${e.invuln ? 'INV ' : ''}${e.spawnT > 0 ? 'SPAWN ' : ''}${e.latched ? 'LATCH' : ''}]`).join(' ') + ` player=(${g.player.x.toFixed(0)},${g.player.y.toFixed(0)})`;
        break;
      }
    }
  } catch (e) {
    crashed = (e as Error).stack ?? String(e);
  }
  const last = curPlan as RoomPlan | null;
  if (last) roomLog.push({ type: last.type, biome: last.biome, step: last.step, time: run.time - roomStart, dmg: roomDmg });
  return {
    seed,
    weapon,
    won,
    crashed,
    biome: run.biome,
    step: run.step,
    rooms: run.rooms,
    time: run.time,
    kills: g.kills,
    killer: g.player.dead ? killer : '',
    roomLog,
    boons: run.boons.map((b) => BOON_BY_ID[b.id]?.name ?? b.id),
    hurtBy,
    bestStreak: g.bestStreak,
  };
}

const results: RunResult[] = [];
const base = Number(args.seed ?? Date.now() % 100000);
const t0 = Date.now();
for (let i = 0; i < RUNS; i++) {
  const weapon = weapons[i % weapons.length];
  const seed = base + i * 7919;
  const r = playRun(seed, weapon);
  results.push(r);
  const status = r.crashed ? 'CRASH' : r.won ? 'WON ' : 'died';
  console.log(`[${String(i + 1).padStart(2)}] ${status} ${weapon.padEnd(6)} seed=${seed} biome=${r.biome + 1} step=${r.step + 1} rooms=${r.rooms} time=${(r.time / 60).toFixed(1)}m kills=${r.kills} streak=${r.bestStreak} ${r.killer ? 'killed by ' + r.killer : ''}`);
  if (r.crashed) console.log('      ' + r.crashed.split('\n').slice(0, 6).join('\n      '));
  if (VERBOSE) console.log('      boons: ' + r.boons.join(', '));
}

// ── aggregate report ──
const n = results.length;
const crashes = results.filter((r) => r.crashed);
const wins = results.filter((r) => r.won);
console.log('\n══════════ SUMMARY ══════════');
console.log(`runs=${n} wins=${wins.length} crashes=${crashes.length} wall=${((Date.now() - t0) / 1000).toFixed(1)}s`);
const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
console.log(`avg rooms ${avg(results.map((r) => r.rooms)).toFixed(1)} · avg run time ${(avg(results.map((r) => r.time)) / 60).toFixed(1)} min · winning run time ${(avg(wins.map((r) => r.time)) / 60).toFixed(1)} min`);
const byType: Record<string, number[]> = {};
const dmgByType: Record<string, number[]> = {};
for (const r of results)
  for (const l of r.roomLog) {
    const k = `${l.type}@b${l.biome + 1}`;
    (byType[k] ??= []).push(l.time);
    (dmgByType[k] ??= []).push(l.dmg);
  }
console.log('room time (s) / damage taken by type:');
for (const k of Object.keys(byType).sort()) console.log(`  ${k.padEnd(14)} ${avg(byType[k]).toFixed(1).padStart(5)}s  dmg ${avg(dmgByType[k]).toFixed(1).padStart(5)}  (n=${byType[k].length})`);
const deaths: Record<string, number> = {};
const killers: Record<string, number> = {};
for (const r of results)
  if (!r.won && !r.crashed) {
    const k = `b${r.biome + 1}s${r.step + 1}`;
    deaths[k] = (deaths[k] ?? 0) + 1;
    killers[r.killer || '?'] = (killers[r.killer || '?'] ?? 0) + 1;
  }
console.log('deaths by location:', JSON.stringify(deaths));
console.log('final blows:', JSON.stringify(killers));
const hurt: Record<string, number> = {};
for (const r of results) for (const k in r.hurtBy) hurt[k] = (hurt[k] ?? 0) + r.hurtBy[k];
const top = Object.entries(hurt)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 12)
  .map(([k, v]) => `${k}:${Math.round(v / n)}`);
console.log('avg damage dealt to bot per run by source:', top.join(' '));
if (crashes.length) {
  console.log(`\n${crashes.length} CRASH(ES) — reproduce with --seed=<seed> --runs=1 --weapon=<weapon>`);
  process.exitCode = 1;
}
