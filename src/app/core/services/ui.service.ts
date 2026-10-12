import { Injectable, signal } from '@angular/core';

export type Screen = 'home' | 'game';

export interface Toast {
  message: string;
  action?: { label: string; run: () => void };
}

@Injectable({
  providedIn: 'root'
})
export class UiService {
  readonly screen = signal<Screen>('home');
  /** Open sheets and dialogs. The solve timer pauses while this is above 0. */
  readonly overlayCount = signal(0);
  readonly toast = signal<Toast | null>(null);

  readonly showHowToPlay = signal(false);
  readonly showStats = signal(false);
  readonly showCalendar = signal(false);
  readonly showDemo = signal(false);

  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  openOverlay(): void {
    this.overlayCount.update((n) => n + 1);
  }

  closeOverlay(): void {
    this.overlayCount.update((n) => Math.max(0, n - 1));
  }

  /** Shows the game screen; a history entry lets the system back gesture return home. */
  enterGame(): void {
    if (this.screen() === 'game') return;
    if (typeof history !== 'undefined') history.pushState({ screen: 'game' }, '');
    this.screen.set('game');
  }

  goHome(): void {
    if (this.screen() === 'home') return;
    if (typeof history !== 'undefined' && history.state?.screen === 'game') {
      history.back();
    } else {
      this.screen.set('home');
    }
  }

  showToast(message: string, action?: Toast['action'], durationMs = 4000): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toast.set({ message, action });
    this.toastTimer = setTimeout(() => this.toast.set(null), durationMs);
  }

  dismissToast(): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = null;
    this.toast.set(null);
  }
}
