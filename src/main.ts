import './ui/styles.css';
import { App } from './app';

const app = new App();
app.boot().catch((e) => {
  console.error(e);
  const boot = document.getElementById('boot');
  if (boot) boot.innerHTML = `<div class="boot-title">LANTERNFALL</div><div class="boot-sub">failed to start: ${String(e?.message ?? e)}</div>`;
});
(window as unknown as { __app: App }).__app = app;
