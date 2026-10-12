import { Injectable, signal } from '@angular/core';

/** Production bundles are content-hashed, e.g. main-FMIVEJV5.js. */
const MAIN_SCRIPT = /(^|\/)main-[A-Z0-9]+\.js$/i;
const CHECK_INTERVAL_MS = 60_000;

/**
 * Notices a new deploy while the app stays open or is resumed from the background,
 * which is how home screen apps on iPhone usually come back.
 */
@Injectable({
  providedIn: 'root'
})
export class UpdateService {
  readonly updateReady = signal(false);
  private readonly running = typeof document === 'undefined' ? null : mainScriptOf(document);
  private lastCheck = 0;

  start(): void {
    if (!this.running) return;
    this.check();
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this.check();
    });
  }

  check(): void {
    if (!this.running || this.updateReady() || Date.now() - this.lastCheck < CHECK_INTERVAL_MS) return;
    this.lastCheck = Date.now();
    navigator.serviceWorker
      ?.getRegistration()
      .then((registration) => registration?.update())
      .catch(() => undefined);
    fetch('./index.html', { cache: 'no-store' })
      .then((response) => (response.ok ? response.text() : ''))
      .then((html) => {
        const latest = html ? mainScriptOf(new DOMParser().parseFromString(html, 'text/html')) : null;
        if (latest && latest !== this.running) this.updateReady.set(true);
      })
      .catch(() => undefined);
  }
}

export function mainScriptOf(doc: Document): string | null {
  for (const script of Array.from(doc.querySelectorAll('script[src]'))) {
    const src = script.getAttribute('src') ?? '';
    if (MAIN_SCRIPT.test(src)) return src.split('/').pop() ?? null;
  }
  return null;
}
