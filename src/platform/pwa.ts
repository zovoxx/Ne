/**
 * Platform glue: service worker (offline + installable), install prompt, Android fullscreen and
 * orientation lock, screen wake lock, iOS standalone detection, safe-area insets.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

export class Platform {
  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private wakeLock: { release(): Promise<void> } | null = null;
  onInstallable: (() => void) | null = null;

  readonly isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  get standalone() {
    return window.matchMedia('(display-mode: fullscreen)').matches || window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  }
  get canInstall() {
    return !!this.deferredPrompt;
  }

  init() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e as BeforeInstallPromptEvent;
      this.onInstallable?.();
    });
    // service worker only in production builds (dev server would fight the cache)
    if ('serviceWorker' in navigator && import.meta.env.PROD) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js', { scope: './' }).catch((err) => console.warn('SW registration failed', err));
      });
    }
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.wantWake) void this.requestWakeLock();
    });
    // stop iOS double-tap zoom and long-press menus
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('dblclick', (e) => e.preventDefault());
  }

  async install() {
    if (!this.deferredPrompt) return false;
    await this.deferredPrompt.prompt();
    const res = await this.deferredPrompt.userChoice;
    this.deferredPrompt = null;
    return res.outcome === 'accepted';
  }

  /** On Android/desktop browsers: go fullscreen + lock landscape (must be called from a tap). */
  async enterFullscreen() {
    if (this.standalone || this.isIOS) return;
    const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
    try {
      if (!document.fullscreenElement) {
        if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
        else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
      }
      const so = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
      if (so && so.lock) await so.lock('landscape').catch(() => {});
    } catch {
      /* not allowed — fine */
    }
  }

  /** desktop: F key / button toggles fullscreen */
  async toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    } catch {
      /* not allowed */
    }
  }

  private wantWake = false;
  async requestWakeLock() {
    this.wantWake = true;
    const nav = navigator as unknown as { wakeLock?: { request(t: string): Promise<{ release(): Promise<void> }> } };
    if (!nav.wakeLock || this.wakeLock) return;
    try {
      this.wakeLock = await nav.wakeLock.request('screen');
      (this.wakeLock as unknown as EventTarget).addEventListener?.('release', () => (this.wakeLock = null));
    } catch {
      /* ignore */
    }
  }
  releaseWakeLock() {
    this.wantWake = false;
    this.wakeLock?.release().catch(() => {});
    this.wakeLock = null;
  }

  /** safe-area insets in CSS px (read from a probe element using env()) */
  safeArea() {
    const p = document.getElementById('safe-probe');
    if (!p) return { top: 0, right: 0, bottom: 0, left: 0 };
    const r = p.getBoundingClientRect();
    return { top: r.top, left: r.left, right: window.innerWidth - r.right, bottom: window.innerHeight - r.bottom };
  }
}
