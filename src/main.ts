import './ui/styles.css';
import { App } from './app';
import { ENEMIES, ENEMY_LIST } from './game/enemies';
import { BOONS } from './game/boons/patrons';
import { TUNING } from './config/tuning';

const app = new App();
app.boot().catch((e) => {
  console.error(e);
  const boot = document.getElementById('boot');
  if (boot) boot.innerHTML = `<div class="boot-title">LANTERNFALL</div><div class="boot-sub">failed to start: ${String(e?.message ?? e)}</div>`;
});
// handles for tests, the bot and the debug menu
(window as unknown as Record<string, unknown>).__app = app;
(window as unknown as Record<string, unknown>).__lf = { ENEMIES, ENEMY_LIST, BOONS, TUNING };
