import { Component, computed, inject, output, signal } from '@angular/core';
import { GameEngineService } from '../../core/services/game-engine.service';
import { AudioHapticsService } from '../../core/services/audio-haptics.service';
import { StorageService } from '../../core/services/storage.service';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [IconComponent],
  template: `
    <header class="topbar">
      <div class="brand">
        <span class="brand-mark"><app-icon name="crown" /></span>
        <div class="brand-text">
          <h1 class="game-title">Queens</h1>
          <span class="puzzle-tag" [class.is-daily]="isDaily()">
            {{ isDaily() ? 'Daily challenge' : size() + '×' + size() + ' · ' + puzzleId() }}
          </span>
        </div>
      </div>

      <div class="hud">
        <button
          type="button"
          class="hud-timer"
          [class.is-running]="game.isTimerRunning()"
          [class.is-solved]="game.isReviewMode()"
          (click)="openStats.emit()"
          [title]="game.isReviewMode() ? 'Daily challenge solved. View stats' : 'View stats'"
          [attr.aria-label]="(game.isReviewMode() ? 'Solved in ' : 'Time ') + formattedTime() + '. View statistics'"
        >
          <app-icon [name]="game.isReviewMode() ? 'trophy' : 'clock'" />
          <span class="hud-time">{{ formattedTime() }}</span>
          @if (game.isReviewMode()) {
            <span class="hud-solved">Solved</span>
          }
        </button>

        <div
          class="hud-progress"
          [class.is-complete]="isComplete()"
          [class.has-conflict]="game.hasConflicts()"
          role="img"
          [attr.aria-label]="game.queenCount() + ' of ' + size() + ' queens placed'"
        >
          <span class="pips" aria-hidden="true">
            @for (i of pips(); track i) {
              <span class="pip" [class.on]="i < game.queenCount()"></span>
            }
          </span>
          <span class="hud-count">{{ game.queenCount() }}<span class="hud-total">/{{ size() }}</span></span>
        </div>
      </div>

      <nav class="actions" aria-label="Game menu">
        <button
          type="button"
          class="streak-chip"
          [class.is-daily]="isDaily()"
          (click)="openStats.emit()"
          [title]="isDaily() ? 'Daily streak: ' + dailyStreak() + ' days' : 'Total streak: ' + totalStreak() + ' games'"
          [attr.aria-label]="(isDaily() ? 'Daily streak ' + dailyStreak() : 'Streak ' + totalStreak()) + '. View statistics'"
        >
          <app-icon [name]="isDaily() ? 'calendar' : 'flame'" />
          <span class="streak-num">{{ isDaily() ? dailyStreak() : totalStreak() }}</span>
        </button>

        <button
          type="button"
          class="icon-btn hide-compact"
          [class.is-on]="audio.musicEnabled()"
          [attr.aria-pressed]="audio.musicEnabled()"
          (click)="audio.toggleMusic()"
          [title]="audio.musicEnabled() ? 'Mute ambient music' : 'Play ambient music'"
          aria-label="Ambient music"
        >
          <app-icon [name]="audio.musicEnabled() ? 'music' : 'musicOff'" />
        </button>

        <button
          type="button"
          class="icon-btn hide-compact"
          [attr.aria-pressed]="audio.soundEnabled()"
          (click)="audio.toggleSound()"
          [title]="audio.soundEnabled() ? 'Mute sound effects' : 'Enable sound effects'"
          aria-label="Sound effects"
        >
          <app-icon [name]="audio.soundEnabled() ? 'volume' : 'volumeOff'" />
        </button>

        <button
          type="button"
          class="icon-btn hide-compact"
          (click)="toggleTheme()"
          [title]="isDark() ? 'Switch to light mode' : 'Switch to dark mode'"
          [attr.aria-label]="isDark() ? 'Switch to light mode' : 'Switch to dark mode'"
        >
          <app-icon [name]="isDark() ? 'sun' : 'moon'" />
        </button>

        <button type="button" class="icon-btn" (click)="openHowToPlay.emit()" title="How to play" aria-label="How to play">
          <app-icon name="help" />
        </button>

        <button
          type="button"
          class="icon-btn hide-wide"
          (click)="showMobileOptions.set(true)"
          title="Settings"
          aria-label="Settings"
        >
          <app-icon name="sliders" />
          @if (audio.musicEnabled()) {
            <span class="music-dot" aria-hidden="true"></span>
          }
        </button>
      </nav>
    </header>

    @if (showMobileOptions()) {
      <div class="sheet-backdrop" (click)="showMobileOptions.set(false)">
        <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="settings-title" (click)="$event.stopPropagation()">
          <div class="sheet-grabber" aria-hidden="true"></div>
          <div class="sheet-head">
            <h2 id="settings-title" class="sheet-title">Settings</h2>
            <button type="button" class="sheet-close" (click)="showMobileOptions.set(false)" aria-label="Close settings">
              <app-icon name="close" />
            </button>
          </div>

          <div class="group">
            <button type="button" class="row" role="switch" [attr.aria-checked]="audio.musicEnabled()" (click)="audio.toggleMusic()">
              <span class="row-icon" [class.is-on]="audio.musicEnabled()"><app-icon name="music" /></span>
              <span class="row-text">
                <span class="row-name">Ambient music</span>
                <span class="row-desc">Relaxing lo-fi soundtrack</span>
              </span>
              <span class="switch" [class.on]="audio.musicEnabled()"><span class="thumb"></span></span>
            </button>

            <button type="button" class="row" role="switch" [attr.aria-checked]="audio.soundEnabled()" (click)="audio.toggleSound()">
              <span class="row-icon" [class.is-on]="audio.soundEnabled()">
                <app-icon [name]="audio.soundEnabled() ? 'volume' : 'volumeOff'" />
              </span>
              <span class="row-text">
                <span class="row-name">Sound effects</span>
                <span class="row-desc">Clicks, chimes and alerts</span>
              </span>
              <span class="switch" [class.on]="audio.soundEnabled()"><span class="thumb"></span></span>
            </button>

            <button type="button" class="row" role="switch" [attr.aria-checked]="audio.hapticsEnabled()" (click)="audio.toggleHaptics()">
              <span class="row-icon" [class.is-on]="audio.hapticsEnabled()"><app-icon name="vibrate" /></span>
              <span class="row-text">
                <span class="row-name">Haptics</span>
                <span class="row-desc">Vibrate on queens and marks</span>
              </span>
              <span class="switch" [class.on]="audio.hapticsEnabled()"><span class="thumb"></span></span>
            </button>

            <button
              type="button"
              class="row"
              (click)="toggleTheme()"
              [attr.aria-label]="'Appearance: ' + (isDark() ? 'dark' : 'light') + '. Tap to switch'"
            >
              <span class="row-icon"><app-icon [name]="isDark() ? 'moon' : 'sun'" /></span>
              <span class="row-text">
                <span class="row-name">Appearance</span>
                <span class="row-desc">{{ isDark() ? 'Dark' : 'Light' }}</span>
              </span>
              <span class="segmented" aria-hidden="true">
                <span [class.active]="!isDark()">Light</span>
                <span [class.active]="isDark()">Dark</span>
              </span>
            </button>
          </div>

          <div class="group">
            <button type="button" class="row" (click)="showMobileOptions.set(false); openStats.emit()">
              <span class="row-icon"><app-icon name="chart" /></span>
              <span class="row-text">
                <span class="row-name">Statistics and streaks</span>
                <span class="row-desc">View or reset</span>
              </span>
              <app-icon class="chevron" name="chevron" />
            </button>
            <button type="button" class="row" (click)="showMobileOptions.set(false); openHowToPlay.emit()">
              <span class="row-icon"><app-icon name="help" /></span>
              <span class="row-text"><span class="row-name">How to play</span></span>
              <app-icon class="chevron" name="chevron" />
            </button>
          </div>

          <p class="sheet-note">
            <app-icon name="offline" />
            Works offline. A new daily puzzle unlocks at midnight.
          </p>

          <button type="button" class="btn btn-primary btn-block" (click)="showMobileOptions.set(false)">Done</button>
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display: block; width: 100%; }

    .topbar {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      grid-template-areas: "brand actions" "hud hud";
      align-items: center;
      gap: 10px 12px;
      max-width: 560px;
      margin: 0 auto;
      padding: 10px 16px 10px;
    }

    .brand { grid-area: brand; display: flex; align-items: center; gap: 10px; min-width: 0; }

    .brand-mark {
      width: 38px;
      height: 38px;
      flex-shrink: 0;
      display: grid;
      place-items: center;
      border-radius: var(--r-sm);
      background: var(--accent-soft);
      color: var(--accent-strong);
      --icon-size: 20px;
      --icon-fill: color-mix(in srgb, var(--accent) 35%, transparent);
    }

    .brand-text { display: flex; flex-direction: column; min-width: 0; }

    .game-title { font-size: 19px; font-weight: 700; letter-spacing: -0.035em; line-height: 1.1; }

    .puzzle-tag {
      font-size: 12.5px;
      font-weight: 500;
      color: var(--muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .puzzle-tag.is-daily { color: var(--accent-strong); }

    .hud {
      grid-area: hud;
      justify-self: center;
      display: flex;
      align-items: center;
      gap: 2px;
      padding: 4px;
      border-radius: 999px;
      background: var(--surface);
      box-shadow: inset 0 0 0 1px var(--line), var(--shadow-1);
    }

    .hud-timer {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      height: 36px;
      padding: 0 14px 0 12px;
      border-radius: 999px;
      color: var(--muted);
      --icon-size: 17px;
      transition: background-color 160ms var(--ease-out), transform 160ms var(--ease-out);
    }

    .hud-timer:active { transform: scale(0.96); background: var(--sunken); }
    .hud-timer.is-running { color: var(--text-2); }
    .hud-timer.is-solved { color: var(--accent-strong); background: var(--accent-soft); }

    .hud-time, .hud-count {
      font-family: var(--font-mono);
      font-size: 15px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      color: var(--text);
    }

    .hud-solved { font-size: 13px; font-weight: 600; }

    .hud-progress {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      height: 36px;
      padding: 0 14px 0 12px;
      border-left: 1px solid var(--line);
    }

    .pips { display: inline-flex; gap: 4px; }

    .pip {
      width: 6px;
      height: 6px;
      border-radius: 999px;
      background: var(--line-strong);
      transition: background-color 200ms var(--ease-out), transform 200ms var(--ease-spring);
    }

    .pip.on { background: var(--accent); transform: scale(1.15); }
    .is-complete .pip.on { background: var(--success); }
    .has-conflict .pip.on { background: var(--danger); }
    .is-complete .hud-count { color: var(--success); }
    .has-conflict .hud-count { color: var(--danger); }
    .hud-total { color: var(--faint); font-weight: 500; }

    .actions { grid-area: actions; display: flex; align-items: center; gap: 6px; }

    .icon-btn, .streak-chip {
      position: relative;
      height: 44px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--r-sm);
      background: var(--surface);
      box-shadow: inset 0 0 0 1px var(--line), var(--shadow-1);
      color: var(--text-2);
      transition: transform 160ms var(--ease-out), background-color 160ms var(--ease-out), color 160ms var(--ease-out);
    }

    .icon-btn { width: 44px; }
    .icon-btn.is-on { color: var(--accent-strong); background: var(--accent-soft); }
    .icon-btn:active, .streak-chip:active { transform: scale(0.94); background: var(--sunken); }

    .streak-chip { gap: 6px; padding: 0 12px 0 10px; border-radius: 999px; color: var(--accent-strong); --icon-size: 18px; }
    .streak-num { font-family: var(--font-mono); font-size: 15px; font-weight: 600; color: var(--text); }

    .music-dot {
      position: absolute;
      top: 8px;
      right: 8px;
      width: 7px;
      height: 7px;
      border-radius: 999px;
      background: var(--accent);
      box-shadow: 0 0 0 2px var(--surface);
    }

    @media (hover: hover) {
      .icon-btn:hover, .streak-chip:hover, .hud-timer:hover { background: var(--sunken); color: var(--text); }
      .icon-btn.is-on:hover { background: var(--accent-soft); color: var(--accent-strong); }
    }

    @media (max-height: 700px) and (max-width: 767px) {
      .topbar { padding-top: 6px; padding-bottom: 6px; gap: 6px 12px; }
    }

    @media (min-width: 768px) {
      .topbar {
        max-width: 1180px;
        grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
        grid-template-areas: "brand hud actions";
        padding: 16px 24px;
      }

      .actions { justify-self: end; }
    }

    @media (min-width: 1100px) {
      .topbar { padding: 20px 40px; }
    }

    /* Settings sheet */
    .group {
      display: flex;
      flex-direction: column;
      border-radius: var(--r-md);
      background: var(--sunken);
      overflow: hidden;
    }

    .row {
      display: flex;
      align-items: center;
      gap: 12px;
      min-height: 60px;
      padding: 8px 14px;
      text-align: left;
      transition: background-color 120ms var(--ease-out);
    }

    .row + .row { box-shadow: inset 0 1px 0 var(--line); }
    .row:active { background: color-mix(in srgb, var(--sunken) 85%, var(--text)); }

    .row-icon {
      width: 36px;
      height: 36px;
      flex-shrink: 0;
      display: grid;
      place-items: center;
      border-radius: 10px;
      background: var(--surface);
      color: var(--text-2);
      --icon-size: 19px;
    }

    .row-icon.is-on { background: var(--accent-soft); color: var(--accent-strong); }

    .row-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
    .row-name { font-size: 15px; font-weight: 600; letter-spacing: -0.01em; }
    .row-desc { font-size: 13px; color: var(--muted); }
    .chevron { color: var(--faint); --icon-size: 18px; }

    .switch {
      width: 51px;
      height: 31px;
      flex-shrink: 0;
      position: relative;
      border-radius: 999px;
      background: var(--line-strong);
      transition: background-color 240ms var(--ease-out);
    }

    .switch.on { background: var(--success); }

    .thumb {
      position: absolute;
      top: 2px;
      left: 2px;
      width: 27px;
      height: 27px;
      border-radius: 999px;
      background: #fff;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
      transition: transform 280ms var(--ease-spring);
    }

    .switch.on .thumb { transform: translateX(20px); }

    .segmented { display: flex; padding: 3px; gap: 2px; border-radius: 10px; background: var(--surface); }

    .segmented span {
      padding: 6px 10px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      color: var(--muted);
      transition: background-color 160ms var(--ease-out), color 160ms var(--ease-out);
    }

    .segmented span.active { background: var(--ink); color: var(--on-ink); }

    .sheet-note {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: var(--muted);
      --icon-size: 16px;
    }
  `]
})
export class HeaderComponent {
  readonly game = inject(GameEngineService);
  readonly audio = inject(AudioHapticsService);
  private readonly storage = inject(StorageService);

  readonly openHowToPlay = output<void>();
  readonly openStats = output<void>();

  readonly isDark = signal<boolean>(false);
  readonly showMobileOptions = signal<boolean>(false);

  readonly size = computed(() => this.game.board().length || 8);
  readonly pips = computed(() => Array.from({ length: this.size() }, (_, i) => i));

  readonly puzzleId = computed(() => this.game.puzzle()?.id ?? 'Queens');
  readonly isDaily = computed(() => !!this.game.puzzle()?.isDaily);
  readonly isComplete = computed(() => this.game.queenCount() === this.size() && !this.game.hasConflicts());
  readonly totalStreak = computed(() => this.storage.getStats().currentStreak);
  readonly dailyStreak = computed(() => this.storage.getStats().dailyStats?.currentStreak ?? 0);

  readonly formattedTime = computed(() => {
    if (this.game.isReviewMode()) {
      const reviewSecs = this.game.reviewCompletedTime();
      if (reviewSecs !== null && reviewSecs >= 0) {
        const mins = Math.floor(reviewSecs / 60);
        const secs = reviewSecs % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
      }
    }
    const total = this.game.elapsedSeconds();
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  });

  constructor() {
    this.isDark.set(this.storage.getTheme() === 'dark');
    this.applyTheme(this.isDark());
  }

  toggleTheme(): void {
    const next = !this.isDark();
    this.isDark.set(next);
    this.storage.saveTheme(next ? 'dark' : 'light');
    this.applyTheme(next);
  }

  private applyTheme(dark: boolean): void {
    if (typeof document !== 'undefined') {
      if (dark) {
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
    }
  }
}
