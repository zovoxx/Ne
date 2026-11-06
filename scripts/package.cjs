/**
 * Packages the built game for Cloudflare's drag-and-drop uploader (no build step, no wrangler config):
 *   site/                   the static site, ready to upload as a folder
 *   lanternfall-site.zip    the same files zipped (index.html at the top level of the zip)
 * Run with: npm run package   (builds first)
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const site = path.join(root, 'site');
const zipPath = path.join(root, 'lanternfall-site.zip');

if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.error('dist/ is missing — run `npm run build` first');
  process.exit(1);
}

// collect files
const files = [];
(function walk(dir) {
  for (const f of fs.readdirSync(dir).sort()) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else files.push(path.relative(dist, p).split(path.sep).join('/'));
  }
})(dist);

// site/ folder (fresh copy)
fs.rmSync(site, { recursive: true, force: true });
for (const f of files) {
  const to = path.join(site, f);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(path.join(dist, f), to);
}

// minimal ZIP writer (deflate), no dependencies
const CRC = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC[n] = c >>> 0;
}
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const DOS_TIME = (12 << 11) | (0 << 5); // 12:00:00
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1; // 2026-01-01 (fixed: reproducible zips)
const locals = [];
const central = [];
let offset = 0;
for (const f of files) {
  const data = fs.readFileSync(path.join(dist, f));
  const comp = zlib.deflateRawSync(data, { level: 9 });
  const name = Buffer.from(f, 'utf8');
  const crc = crc32(data);
  const lh = Buffer.alloc(30);
  lh.writeUInt32LE(0x04034b50, 0);
  lh.writeUInt16LE(20, 4);
  lh.writeUInt16LE(0x0800, 6); // utf-8 names
  lh.writeUInt16LE(8, 8);
  lh.writeUInt16LE(DOS_TIME, 10);
  lh.writeUInt16LE(DOS_DATE, 12);
  lh.writeUInt32LE(crc, 14);
  lh.writeUInt32LE(comp.length, 18);
  lh.writeUInt32LE(data.length, 22);
  lh.writeUInt16LE(name.length, 26);
  lh.writeUInt16LE(0, 28);
  locals.push(lh, name, comp);
  const ch = Buffer.alloc(46);
  ch.writeUInt32LE(0x02014b50, 0);
  ch.writeUInt16LE(20, 4);
  ch.writeUInt16LE(20, 6);
  ch.writeUInt16LE(0x0800, 8);
  ch.writeUInt16LE(8, 10);
  ch.writeUInt16LE(DOS_TIME, 12);
  ch.writeUInt16LE(DOS_DATE, 14);
  ch.writeUInt32LE(crc, 16);
  ch.writeUInt32LE(comp.length, 20);
  ch.writeUInt32LE(data.length, 24);
  ch.writeUInt16LE(name.length, 28);
  ch.writeUInt32LE(offset, 42);
  central.push(ch, name);
  offset += lh.length + name.length + comp.length;
}
const cd = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(cd.length, 12);
end.writeUInt32LE(offset, 16);
fs.writeFileSync(zipPath, Buffer.concat([...locals, cd, end]));

console.log(`site/ and lanternfall-site.zip ready (${files.length} files, zip ${(fs.statSync(zipPath).size / 1024).toFixed(0)} KB)`);
