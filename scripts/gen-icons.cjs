/** Renders the app icons with a canvas in headless Chromium and writes PNGs to public/icons. */
const fs = require('fs');
const path = require('path');
let pw;
try { pw = require('playwright'); } catch { pw = require('/opt/node-tools/node_modules/playwright'); }
(async () => {
  const b = await pw.chromium.launch();
  const p = await b.newPage();
  const out = path.join(__dirname, '..', 'public', 'icons');
  fs.mkdirSync(out, { recursive: true });
  const sizes = [['icon-192.png', 192, false], ['icon-512.png', 512, false], ['maskable-512.png', 512, true], ['apple-touch-icon.png', 180, false]];
  for (const [name, size, maskable] of sizes) {
    const data = await p.evaluate(([size, maskable]) => {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const g = c.getContext('2d');
      const s = size / 512;
      const bg = g.createRadialGradient(256 * s, 230 * s, 20 * s, 256 * s, 256 * s, 360 * s);
      bg.addColorStop(0, '#3a1f52');
      bg.addColorStop(1, '#07050c');
      g.fillStyle = bg;
      if (!maskable) {
        g.beginPath();
        g.roundRect(0, 0, size, size, 110 * s);
        g.fill();
      } else g.fillRect(0, 0, size, size);
      const k = maskable ? 0.72 : 0.9;
      g.translate(256 * s, 270 * s);
      g.scale(s * k, s * k);
      // lantern frame
      g.strokeStyle = '#c9a35a';
      g.lineWidth = 14;
      g.beginPath();
      g.moveTo(-40, -170);
      g.quadraticCurveTo(0, -215, 40, -170);
      g.stroke();
      g.fillStyle = '#c9a35a';
      g.fillRect(-90, -165, 180, 22);
      g.fillRect(-90, 120, 180, 22);
      // glow
      const glow = g.createRadialGradient(0, -10, 10, 0, -10, 170);
      glow.addColorStop(0, 'rgba(255,240,180,1)');
      glow.addColorStop(0.35, 'rgba(255,170,70,0.85)');
      glow.addColorStop(1, 'rgba(255,120,40,0)');
      g.fillStyle = glow;
      g.beginPath();
      g.arc(0, -10, 170, 0, Math.PI * 2);
      g.fill();
      // flame
      g.beginPath();
      g.moveTo(0, -120);
      g.bezierCurveTo(70, -40, 60, 80, 0, 90);
      g.bezierCurveTo(-60, 80, -70, -10, -20, -60);
      g.quadraticCurveTo(-10, -20, 8, -24);
      g.quadraticCurveTo(4, -70, 0, -120);
      const fl = g.createLinearGradient(0, -120, 0, 90);
      fl.addColorStop(0, '#fff8dc');
      fl.addColorStop(0.5, '#ffd27a');
      fl.addColorStop(1, '#ff6a2a');
      g.fillStyle = fl;
      g.fill();
      // side bars
      g.strokeStyle = '#8a6a3a';
      g.lineWidth = 10;
      for (const x of [-80, 80]) {
        g.beginPath();
        g.moveTo(x, -145);
        g.lineTo(x, 122);
        g.stroke();
      }
      return c.toDataURL('image/png');
    }, [size, maskable]);
    fs.writeFileSync(path.join(out, name), Buffer.from(data.split(',')[1], 'base64'));
    console.log('wrote', name);
  }
  await b.close();
})();
