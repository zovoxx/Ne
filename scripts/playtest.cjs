/**
 * Playwright playtest: opens the game on phone and tablet viewports, plays with simulated
 * input (or the in-game bot with ?bot=1), records console errors and takes screenshots.
 *
 *   node scripts/playtest.cjs [url] [--bot] [--seconds=20] [--out=playtest-output]
 */
const path = require('path');
const fs = require('fs');
let playwright;
try {
  playwright = require('playwright');
} catch {
  playwright = require('/opt/node-tools/node_modules/playwright');
}
const { chromium, devices } = playwright;

const args = process.argv.slice(2);
const url = args.find((a) => a.startsWith('http')) || 'http://localhost:5173/';
const bot = args.includes('--bot');
const seconds = Number((args.find((a) => a.startsWith('--seconds=')) || '--seconds=12').split('=')[1]);
const outDir = (args.find((a) => a.startsWith('--out=')) || '--out=playtest-output').split('=')[1];
const only = (args.find((a) => a.startsWith('--only=')) || '').split('=')[1];
const extra = (args.find((a) => a.startsWith('--query=')) || '').slice(8);
fs.mkdirSync(outDir, { recursive: true });

const targets = [
  { name: 'iphone14-landscape', ...devices['iPhone 14 landscape'] },
  { name: 'iphone-se-landscape', ...devices['iPhone SE landscape'] },
  { name: 'ipad-landscape', ...devices['iPad (gen 7) landscape'] },
  { name: 'ipad-pro-landscape', ...devices['iPad Pro 11 landscape'] },
  { name: 'desktop', viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 },
].filter((t) => !only || only.split(',').includes(t.name));

(async () => {
  let totalErrors = 0;
  for (const t of targets) {
    // fresh browser per device: headless SwiftShader can't run two WebGL pages in one browser reliably
    const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
    const { name, ...opts } = t;
    const ctx = await browser.newContext({ ...opts, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message + '\n' + (e.stack || '')));
    const q = [bot ? 'bot=1' : '', extra].filter(Boolean).join('&');
    await page.goto(url + (q ? (url.includes('?') ? '&' : '?') + q : ''), { waitUntil: 'load' });
    await page.waitForFunction(() => !document.getElementById('boot'), null, { timeout: 30000 }).catch(() => errors.push('boot timeout'));
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(outDir, `${name}-0-start.png`) });
    const vp = page.viewportSize();
    const steps = Math.max(1, Math.round(seconds / 2));
    for (let i = 0; i < steps; i++) {
      if (!bot) {
        // simulated play: move around, attack, dash, special, cast
        const keys = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];
        const k = keys[i % 4];
        await page.keyboard.down(k);
        for (let j = 0; j < 6; j++) {
          await page.keyboard.press(j % 3 === 2 ? 'KeyK' : 'KeyJ');
          await page.waitForTimeout(90);
        }
        await page.keyboard.press('Space');
        await page.keyboard.press('KeyE');
        await page.keyboard.up(k);
        await page.waitForTimeout(800);
      } else await page.waitForTimeout(2000);
      if (i === 1 || i === steps - 1) await page.screenshot({ path: path.join(outDir, `${name}-${i + 1}.png`) });
    }
    if (opts.hasTouch) {
      // touch: tap attack area and drag the joystick
      await page.touchscreen.tap(vp.width - 70, vp.height - 70);
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(outDir, `${name}-touch.png`) });
    }
    const stats = await page.evaluate(() => {
      const a = window.__app;
      return a ? { fps: Math.round(a.fps), mode: a.game.mode, kills: a.game.kills, hp: a.game.player.hp, enemies: a.game.enemies.live.length, particles: a.renderer.particles.active } : null;
    });
    console.log(`[${name}] errors=${errors.length} stats=${JSON.stringify(stats)}`);
    for (const e of errors.slice(0, 8)) console.log('   ', e.slice(0, 400));
    totalErrors += errors.length;
    await ctx.close();
    await browser.close();
  }
  console.log(totalErrors ? `FAILED with ${totalErrors} console errors` : 'OK — no console errors');
  process.exit(totalErrors ? 1 : 0);
})();
