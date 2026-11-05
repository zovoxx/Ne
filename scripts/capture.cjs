/**
 * Captures screenshots at interesting moments while the bot plays:
 * upgrade choice, open doors, shop, death screen.
 *   node scripts/capture.cjs [url] --device="iPhone 14 landscape" --out=dir --seconds=60
 */
const path = require('path');
const fs = require('fs');
let pw;
try { pw = require('playwright'); } catch { pw = require('/opt/node-tools/node_modules/playwright'); }
const args = process.argv.slice(2);
const get = (k, d) => { const a = args.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const url = args.find((a) => a.startsWith('http')) || 'http://localhost:5173/';
const device = get('device', 'iPhone 14 landscape');
const out = get('out', 'playtest-output');
const seconds = Number(get('seconds', '60'));
const query = get('query', '');
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const dev = pw.devices[device] || { viewport: { width: 1280, height: 720 } };
  const ctx = await browser.newContext({ ...dev, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message + '\n' + e.stack));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url + '?bot=1' + (query ? '&' + query : ''));
  await page.waitForFunction(() => !document.getElementById('boot'), null, { timeout: 30000 });
  const seen = {};
  const t0 = Date.now();
  const tag = device.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  while (Date.now() - t0 < seconds * 1000) {
    const s = await page.evaluate(() => {
      const a = window.__app; const g = a.game; const rc = a.rc;
      return { mode: g.mode, state: rc && rc.state, type: rc && rc.plan && rc.plan.type, doors: rc ? rc.doors.length : 0, overlay: !!document.querySelector('.overlay'), biome: g.biome, enemies: g.aliveEnemies() };
    });
    let key = null;
    if (s.overlay && s.mode === 'choice') key = 'choice';
    else if (s.doors > 0 && s.state === 'doors') key = 'doors';
    else if (s.type === 'shop') key = 'shop';
    else if (s.mode === 'dead' || s.mode === 'victory') key = 'death';
    else if (s.enemies > 3) key = "fight";
    if (key && (seen[key] || 0) < 2) {
      seen[key] = (seen[key] || 0) + 1;
      await page.waitForTimeout(key === 'choice' ? 150 : 250);
      await page.screenshot({ path: path.join(out, `${tag}-${key}-${seen[key]}.png`) });
    }
    await page.waitForTimeout(120);
  }
  console.log('captured', JSON.stringify(seen), 'errors', errors.length);
  for (const e of errors.slice(0, 5)) console.log('  ', e.slice(0, 300));
  await browser.close();
})();
