import { defineConfig, type Plugin } from 'vite';
import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';

/**
 * Generates dist/sw.js after the build with a precache list of every emitted file.
 * The cache name is a hash of the file list + contents, so every deploy invalidates old caches.
 * Paths are relative so the build works at any URL (root, sub-folder, Cloudflare preview URLs).
 */
function serviceWorkerPlugin(): Plugin {
  let outDir = 'dist';
  return {
    name: 'lanternfall-sw',
    apply: 'build',
    configResolved(cfg) {
      outDir = cfg.build.outDir;
    },
    closeBundle() {
      const files: string[] = [];
      const walk = (dir: string) => {
        for (const f of readdirSync(dir)) {
          const p = join(dir, f);
          if (statSync(p).isDirectory()) walk(p);
          else files.push(relative(outDir, p).split('\\').join('/'));
        }
      };
      walk(outDir);
      const precache = files.filter(
        (f) => f !== 'sw.js' && !f.startsWith('_') && !f.endsWith('.map') && f !== 'wrangler.jsonc',
      );
      const template = readFileSync('src/platform/sw-template.js', 'utf8');
      const hash = createHash('sha1');
      hash.update(template);
      for (const f of precache.sort()) {
        hash.update(f);
        hash.update(readFileSync(join(outDir, f)));
      }
      const version = hash.digest('hex').slice(0, 12);
      const sw = template
        .replace('__VERSION__', version)
        .replace('__PRECACHE__', JSON.stringify(['./', ...precache.map((f) => './' + f)]));
      writeFileSync(join(outDir, 'sw.js'), sw);
    },
  };
}

export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    chunkSizeWarningLimit: 2000,
  },
  server: { host: true },
  plugins: [serviceWorkerPlugin()],
});
