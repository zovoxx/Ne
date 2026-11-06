# Lanternfall

A fast, touch-first top-down action roguelike for phones and tablets. You are Wren, the last
Kindler, descending four depths to take back a stolen sun. Built with TypeScript, Vite and
PixiJS (WebGL). No backend: it builds to a static site you can host anywhere.

- 5 weapons, 8 patron "Lights" (88 boons), 18 duo boons, weapon forges
- 32 enemies across 4 biomes, 10 combinable elite modifiers, role-based encounters
- 8 guardians (mini-bosses) and 4 multi-phase bosses
- Permanent progression (The Wick) that unlocks variety, plus a short story told between runs
- Installable PWA: fullscreen, landscape, offline

## Run it locally

```bash
npm install
npm run dev          # http://localhost:5173  (also prints a LAN URL for your phone)
```

Open the LAN URL on a phone on the same Wi-Fi to play with touch. Add `?debug=1` to show the
debug menu (it's always on in dev).

## Build

```bash
npm run build        # outputs the static site to dist/
npm run preview      # serves dist/ on http://localhost:4173
```

`dist/` contains everything: `index.html`, hashed JS/CSS in `assets/`, `sw.js` (service worker,
generated at build time), `manifest.webmanifest`, `icons/` and Cloudflare's `_headers`. All paths
are relative, so it works at any URL.

## Deploy to Cloudflare

The repo is ready for both Cloudflare Workers (static assets, `*.workers.dev`) and Pages
(`*.pages.dev`). Pick one:

**A. Workers, from GitHub (recommended)**
1. Cloudflare dashboard → *Workers & Pages* → *Create* → *Import a repository* → pick this repo.
2. Build command: `npm run build` · Deploy command: `npx wrangler deploy` (the default).
3. `wrangler.jsonc` already points the assets at `./dist`. Your game appears at
   `https://lanternfall.<your-subdomain>.workers.dev`. Every push to the branch redeploys.

**B. Pages, from GitHub**
1. *Workers & Pages* → *Create* → *Pages* → *Connect to Git* → pick this repo.
2. Framework preset: *Vite* (or none) · Build command: `npm run build` · Output directory: `dist`.
3. Node version: the repo has `.node-version` (22). The site appears at `https://<project>.pages.dev`.

**C. Upload by hand (drag and drop, no build needed)**

Cloudflare's drag-and-drop uploader only accepts finished static files. Don't upload the whole
repository (it contains `package.json` and `wrangler.jsonc`, which makes the uploader reject it
with *"does not yet support projects that require a build process"*). Upload one of these instead:

- **`lanternfall-site.zip`** (in the repo root) — on GitHub open the file and tap *Download raw
  file*, then in Cloudflare: *Workers & Pages* → *Create* → *Upload your static files* (or *Pages* →
  *Upload assets*) and pick the zip.
- **the `site/` folder** — the same files unzipped, if you prefer to drag a folder.

Both are pre-built and committed. After changing the code, regenerate them with `npm run package`.
From a terminal you can also deploy with `npm run deploy` (Workers) or `npm run deploy:pages` (Pages).

## Play it on your phone

- **iPhone / iPad (Safari):** open the URL → *Share* → *Add to Home Screen* → launch Lanternfall
  from the home screen. That's the only way to get true fullscreen on iOS (Safari has no
  fullscreen API); the app then runs landscape with no browser bars and respects the notch.
- **Android (Chrome):** open the URL → menu → *Install app* (or tap *Install as app* on the title
  screen). In the browser it also goes fullscreen + landscape on your first tap.
- The game works offline after the first load. Progress is saved in `localStorage`; it pauses and
  saves automatically when you switch apps or lock the phone.

## Controls

| Touch | Keyboard / mouse |
| --- | --- |
| Left thumb anywhere on the left side: floating joystick | WASD / arrow keys |
| Big right button: Attack (hold to keep attacking) | J, Enter, left click |
| Upper button: Special | K, right click |
| Left button: Dash (invulnerable) | Space, Shift, L |
| Small button: Sigil (cast) | E, Q, middle click |
| Pause button (top right) | Esc / P |
| | F: toggle fullscreen |

**Controllers** (any standard gamepad in Chrome/Edge/Firefox/Safari): left stick or d-pad moves,
right stick aims, A / RT attack, X / LB special, B / RB dash, Y / LT sigil, Start pauses. In menus
the stick or d-pad moves between buttons and A selects.

On a computer the game stays in its window (press F for fullscreen), aims at the mouse cursor and
shows the key list on the title and pause screens.

Right-side touches snap to the **nearest** button, so you never have to look. Inputs are buffered
for 150 ms, a dash cancels attack recovery, and auto-aim picks the most sensible target in your
movement direction (with mouse, it aims at the cursor and snaps to nearby enemies).

## Tuning

**Every combat-feel number is in [`src/config/tuning.ts`](src/config/tuning.ts)**: hit stop,
screen shake, flash, knockback, hit-stun, squash & stretch, particles, decals, damage numbers,
slow motion, kill streak tiers, haptics, audio variation, player movement, dash, input buffer,
auto-aim, cast, crits, pacing (spawn distances, wave timing, transitions, death screen delay),
biome scaling, boss damage factors and all weapon frame data. Enemy, boss and boon definitions
live in `src/game/enemies/*` and `src/game/boons/patrons.ts`.

## Swapping in your own art

All sprites come from one map: [`src/render/assets.ts`](src/render/assets.ts). Gameplay code only
refers to keys (e.g. `cinderling`, `w_pike`, `boss_regent`). To replace a procedural sprite, put a
PNG in `public/sprites/` and add `url: 'sprites/your-file.png'` to that entry. It is packed into
the atlas at the entry's `w × h` (world units; keep the aspect), and the white hit-flash
silhouette is generated automatically.

## Testing tools

```bash
npm run bot -- --runs=50 --weapon=all     # headless bot plays full runs: crashes, soft-locks, timings, damage sources
npm run playtest -- --bot                 # Playwright: phone + iPad + desktop viewports, console errors, screenshots
node scripts/capture.cjs --seconds=60     # screenshots of key moments (choice, doors, shop, death) while the bot plays
```

URL parameters: `?bot=1` (watch the bot play), `?autostart=1`, `?weapon=bow`, `?biome=2`, `?debug=1`.

## Project layout

```
src/config/tuning.ts     all feel/balance numbers
src/game/                pure simulation (no Pixi/DOM) — runs headless for the bot
  game.ts player.ts combat.ts projectiles.ts hazards.ts effects.ts
  weapons/  enemies/ (biome1-4, elites, boss framework, bosses, minibosses)
  boons/ (patrons + duo data, mechanics)  room.ts rooms.ts encounters.ts run.ts meta.ts story.ts save.ts bot.ts
src/render/              PixiJS presentation: atlas, central asset map, procedural art, FX, renderer
src/audio/               WebAudio synthesized SFX + procedural music (no audio files)
src/input/ src/ui/       touch/keyboard/mouse input, HUD, menus, debug menu
src/platform/            PWA, service worker template, haptics
scripts/                 bot, Playwright playtest/capture, icon generator
```
