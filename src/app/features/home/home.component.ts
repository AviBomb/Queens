import { Component, OnDestroy, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GameEngineService } from '../../core/services/game-engine.service';
import { StorageService } from '../../core/services/storage.service';
import { UiService } from '../../core/services/ui.service';
import {
  BoardSizeOption,
  DAILIES_PER_FREEZE,
  MAX_STREAK_FREEZES,
  SEED_UNLOCK_SECONDS
} from '../../core/models/queens.model';
import { formatClock, formatCountdown, formatDuration, msUntilNextMidnight } from '../../core/logic/format';
import { IconComponent } from '../../shared/icon.component';
import { SizeSheetComponent, sizeLabel } from '../size-sheet/size-sheet.component';

/** Decorative stand-in for the mosaic before today's board has been opened. */
const FALLBACK_MOSAIC = [
  [0, 0, 1, 1, 2, 2],
  [0, 3, 3, 1, 2, 4],
  [5, 3, 6, 6, 4, 4],
  [5, 5, 6, 7, 7, 4],
  [8, 5, 6, 7, 9, 9],
  [8, 8, 8, 7, 9, 9]
];

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [FormsModule, IconComponent, SizeSheetComponent],
  template: `
    <div class="home">
      <section class="card daily" [class.is-solved]="dailyState() === 'solved'" aria-labelledby="daily-title">
        <div class="mosaic" aria-hidden="true" [style.--m]="mosaic().length">
          @for (row of mosaic(); track $index) {
            @for (region of row; track $index) {
              <span [style.background]="'var(--region-' + region + ')'"></span>
            }
          }
        </div>

        <div class="daily-copy">
          <span class="kicker"><app-icon name="calendar" /> Daily puzzle</span>
          <h2 id="daily-title" class="daily-title">{{ todayLabel() }}</h2>
          <p class="daily-status">
            @if (dailyState() === 'solved') {
              <app-icon name="check" />
            }
            {{ dailyStatus() }}
          </p>
        </div>

        <div class="daily-foot">
          <p class="countdown">
            <span>Next puzzle in</span>
            <span class="countdown-time">{{ countdown() }}</span>
          </p>
          <button type="button" class="btn btn-primary daily-cta" (click)="playDaily()">
            {{ dailyCta() }}
            <span class="cta-icon"><app-icon name="arrowRight" /></span>
          </button>
        </div>
      </section>

      <section class="card random" aria-labelledby="random-title">
        <div class="card-row">
          <span class="card-icon"><app-icon name="shuffle" /></span>
          <div class="card-text">
            <h3 id="random-title" class="card-title">Random puzzle</h3>
            <p class="card-sub">{{ randomStatus() }}</p>
          </div>
        </div>
        <div class="random-actions">
          @if (!game.hasUnfinishedRandom()) {
            <button
              type="button"
              class="size-chip"
              (click)="showSizes.set(true)"
              [attr.aria-label]="'Board size: ' + sizeName() + '. Change size'"
            >
              {{ sizeName() }}
              <app-icon name="chevronDown" />
            </button>
          }
          <button type="button" class="btn btn-tonal random-cta" (click)="playRandom()">
            {{ game.hasUnfinishedRandom() ? 'Continue' : 'New game' }}
          </button>
        </div>
      </section>

      <button type="button" class="card streak" (click)="ui.showCalendar.set(true)" aria-label="Open your daily streak calendar">
        <span class="streak-flame"><app-icon name="flame" /></span>
        <span class="card-text">
          <span class="card-title"><span class="streak-num">{{ daily().currentStreak }}</span> day streak</span>
          <span class="card-sub">{{ freezeText() }}</span>
        </span>
        <span class="freezes" [attr.aria-label]="daily().freezes + ' of ' + maxFreezes + ' streak freezes'">
          @for (on of freezeSlots(); track $index) {
            <span class="freeze" [class.on]="on"><app-icon name="snowflake" /></span>
          }
        </span>
        <app-icon class="chev" name="chevron" />
      </button>

      <button type="button" class="card learn" (click)="ui.showDemo.set(true)">
        <span class="card-icon is-accent"><app-icon name="bulb" /></span>
        <span class="card-text">
          <span class="card-title">Learn how to play</span>
          <span class="card-sub">A short guided game on a 5×5 board</span>
        </span>
        <app-icon class="chev" name="chevron" />
      </button>

      @if (seedUnlocked()) {
        <section class="card seed" aria-labelledby="seed-title">
          <div class="card-row">
            <span class="card-icon is-accent"><app-icon name="hash" /></span>
            <div class="card-text">
              <h3 id="seed-title" class="card-title">Custom seed</h3>
              <p class="card-sub">
                {{ game.hasUnfinishedRandom() ? 'Finish your random puzzle first' : 'Bonus: replay any puzzle by its number' }}
              </p>
            </div>
          </div>
          <div class="seed-row">
            <label class="sr-only" for="seed-input">Puzzle seed</label>
            <input
              id="seed-input"
              type="number"
              inputmode="numeric"
              class="seed-input"
              placeholder="Seed, e.g. 1042"
              [disabled]="game.hasUnfinishedRandom()"
              [(ngModel)]="customSeed"
              (keydown.enter)="playSeed()"
            />
            <button
              type="button"
              class="btn btn-primary"
              [disabled]="game.hasUnfinishedRandom() || customSeed === null"
              (click)="playSeed()"
            >
              Play
            </button>
          </div>
        </section>
      }
    </div>

    @if (showSizes()) {
      <app-size-sheet (chosen)="chooseSize($event)" (closed)="showSizes.set(false)" />
    }
  `,
  styles: [`
    :host { display: block; width: 100%; }

    .home {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .card {
      position: relative;
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding: 16px;
      border-radius: var(--r-lg);
      background: var(--surface);
      box-shadow: inset 0 0 0 1px var(--line), var(--shadow-1);
      text-align: left;
      animation: riseIn 420ms var(--ease-out) both;
    }

    .card:nth-child(2) { animation-delay: 60ms; }
    .card:nth-child(3) { animation-delay: 120ms; }
    .card:nth-child(4) { animation-delay: 180ms; }
    .card:nth-child(5) { animation-delay: 240ms; }

    button.card { flex-direction: row; align-items: center; transition: transform 160ms var(--ease-out), background-color 160ms var(--ease-out); }
    button.card:active { transform: scale(0.985); }

    /* Daily */
    .daily {
      overflow: hidden;
      gap: 22px;
      padding: 20px;
      box-shadow: inset 0 0 0 1px var(--line), var(--shadow-2);
    }

    .mosaic {
      position: absolute;
      top: -14px;
      right: -14px;
      width: 58%;
      max-width: 230px;
      aspect-ratio: 1;
      display: grid;
      grid-template-columns: repeat(var(--m, 6), 1fr);
      gap: 3px;
      opacity: 0.5;
      transform: rotate(-8deg);
      -webkit-mask-image: radial-gradient(circle at 75% 25%, #000 25%, transparent 72%);
      mask-image: radial-gradient(circle at 75% 25%, #000 25%, transparent 72%);
      pointer-events: none;
    }

    .mosaic span { border-radius: 3px; }

    .daily-copy { position: relative; display: flex; flex-direction: column; gap: 6px; max-width: 70%; }

    .kicker {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 600;
      color: var(--accent-strong);
      --icon-size: 15px;
    }

    .daily-title {
      font-size: 26px;
      font-weight: 700;
      letter-spacing: -0.035em;
      line-height: 1.1;
      text-wrap: balance;
    }

    .daily-status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 15px;
      color: var(--text-2);
      --icon-size: 16px;
    }

    .daily.is-solved .daily-status { color: var(--success); font-weight: 600; }

    .daily-foot {
      position: relative;
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }

    .countdown { display: flex; flex-direction: column; gap: 2px; font-size: 12.5px; color: var(--muted); }
    .countdown-time { font-family: var(--font-mono); font-size: 15px; font-weight: 600; color: var(--text); font-variant-numeric: tabular-nums; }

    .daily-cta { gap: 10px; padding: 0 8px 0 20px; border-radius: 999px; }

    .cta-icon {
      width: 32px;
      height: 32px;
      display: grid;
      place-items: center;
      border-radius: 999px;
      background: color-mix(in srgb, var(--on-ink) 16%, transparent);
      --icon-size: 16px;
      transition: transform 220ms var(--ease-spring);
    }

    /* Shared rows */
    .card-row { display: flex; align-items: center; gap: 12px; }
    .card-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .card-title { font-size: 16px; font-weight: 650; letter-spacing: -0.015em; }
    .card-sub { font-size: 13.5px; color: var(--muted); }

    .card-icon {
      width: 40px;
      height: 40px;
      flex-shrink: 0;
      display: grid;
      place-items: center;
      border-radius: var(--r-sm);
      background: var(--sunken);
      color: var(--text-2);
      --icon-size: 20px;
    }

    .card-icon.is-accent { background: var(--accent-soft); color: var(--accent-strong); }
    .chev { color: var(--faint); --icon-size: 18px; }

    /* Random */
    .random-actions { display: flex; gap: 8px; }
    .random-cta { flex: 1; min-height: 48px; }

    .size-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      min-height: 48px;
      padding: 0 12px 0 14px;
      border-radius: var(--r-md);
      background: var(--sunken);
      font-family: var(--font-mono);
      font-size: 14px;
      font-weight: 600;
      --icon-size: 15px;
    }

    /* Streak */
    .streak-flame {
      width: 40px;
      height: 40px;
      flex-shrink: 0;
      display: grid;
      place-items: center;
      border-radius: var(--r-sm);
      background: var(--accent-soft);
      color: var(--accent-strong);
      --icon-size: 21px;
      --icon-fill: color-mix(in srgb, var(--accent) 35%, transparent);
    }

    .streak-num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }

    .freezes { display: inline-flex; gap: 4px; }

    .freeze {
      width: 28px;
      height: 28px;
      display: grid;
      place-items: center;
      border-radius: 9px;
      background: var(--sunken);
      color: var(--faint);
      --icon-size: 15px;
    }

    .freeze.on {
      background: color-mix(in srgb, var(--region-2) 45%, var(--surface));
      color: var(--text);
    }

    /* Seed */
    .seed-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; }

    .seed-input {
      min-width: 0;
      height: 48px;
      padding: 0 14px;
      border-radius: var(--r-md);
      border: 1.5px solid var(--line-strong);
      background: var(--surface);
      font-family: var(--font-mono);
      font-size: 16px;
      font-weight: 500;
      outline: none;
      user-select: text;
      -webkit-user-select: text;
    }

    .seed-input::placeholder { color: var(--muted); font-family: var(--font-sans); }
    .seed-input:focus { border-color: var(--text); }
    .seed-input:disabled { opacity: 0.55; }

    @media (hover: hover) {
      button.card:hover { background: color-mix(in srgb, var(--surface) 92%, var(--text)); }
      .daily-cta:hover .cta-icon { transform: translateX(2px); }
      .size-chip:hover { background: color-mix(in srgb, var(--sunken) 85%, var(--text)); }
    }

    @media (min-width: 768px) {
      .home {
        display: grid;
        grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
        grid-template-areas:
          "daily random"
          "daily streak"
          "daily learn"
          "seed seed";
        gap: 14px;
      }

      .daily { grid-area: daily; padding: 28px; justify-content: space-between; }
      .random { grid-area: random; }
      .streak { grid-area: streak; }
      .learn { grid-area: learn; }
      .seed { grid-area: seed; }

      .daily-title { font-size: 34px; }
      .mosaic { max-width: 300px; }
    }
  `]
})
export class HomeComponent implements OnDestroy {
  readonly game = inject(GameEngineService);
  readonly ui = inject(UiService);
  private readonly storage = inject(StorageService);

  readonly maxFreezes = MAX_STREAK_FREEZES;
  readonly showSizes = signal(false);
  customSeed: number | null = null;

  readonly now = signal(Date.now());
  private readonly tick = setInterval(() => this.now.set(Date.now()), 1000);

  readonly todayStr = computed(() => this.storage.getLocalDateString(new Date(this.now())));
  readonly todayLabel = computed(() => {
    this.todayStr();
    return new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  });
  readonly countdown = computed(() => formatCountdown(msUntilNextMidnight(new Date(this.now()))));

  readonly stats = computed(() => this.storage.getStats());
  readonly daily = computed(() => this.stats().dailyStats);

  readonly solvedDaily = computed(() => this.storage.getCompletedDaily(this.todayStr()));
  readonly savedDaily = computed(() => {
    const saved = this.game.savedDaily();
    return saved && saved.dateStr === this.todayStr() ? saved : null;
  });

  readonly dailyState = computed<'solved' | 'progress' | 'new'>(() => {
    if (this.solvedDaily()) return 'solved';
    return this.savedDaily() ? 'progress' : 'new';
  });

  readonly dailyStatus = computed(() => {
    const solved = this.solvedDaily();
    if (solved) return `Solved in ${formatDuration(solved.elapsedSeconds)}`;
    const saved = this.savedDaily();
    if (saved) return `In progress, ${formatClock(saved.elapsedSeconds)} so far`;
    return 'Not started yet';
  });

  readonly dailyCta = computed(() => {
    const state = this.dailyState();
    if (state === 'solved') return 'View solve';
    return state === 'progress' ? 'Resume' : 'Play';
  });

  readonly mosaic = computed(
    () => this.savedDaily()?.regions ?? this.solvedDaily()?.regions ?? FALLBACK_MOSAIC
  );

  readonly sizeName = computed(() => sizeLabel(this.game.sizePreference()));

  readonly randomStatus = computed(() => {
    const saved = this.game.savedRandom();
    if (!saved) return 'A fresh board, as often as you like';
    const n = saved.regions.length;
    return `${n}×${n} in progress, ${formatClock(saved.elapsedSeconds)} so far`;
  });

  readonly freezeSlots = computed(() =>
    Array.from({ length: MAX_STREAK_FREEZES }, (_, i) => i < this.daily().freezes)
  );

  readonly freezeText = computed(() => {
    const d = this.daily();
    if (d.freezes >= MAX_STREAK_FREEZES) return 'Streak freezes full';
    const progress = d.completedCount % DAILIES_PER_FREEZE;
    return `${progress} of ${DAILIES_PER_FREEZE} dailies to your next freeze`;
  });

  readonly seedUnlocked = computed(() => this.stats().totalPlaySeconds >= SEED_UNLOCK_SECONDS);

  constructor() {
    effect(() => {
      if (!this.seedUnlocked()) return;
      untracked(() => {
        if (this.storage.isSeedUnlockAnnounced()) return;
        this.storage.markSeedUnlockAnnounced();
        this.ui.showToast('Bonus unlocked: play any puzzle by its seed');
      });
    });
  }

  ngOnDestroy(): void {
    clearInterval(this.tick);
  }

  playDaily(): void {
    this.game.openDaily();
    this.ui.enterGame();
  }

  playRandom(): void {
    this.game.openRandom();
    this.ui.enterGame();
  }

  playSeed(): void {
    if (this.customSeed === null || Number.isNaN(this.customSeed) || this.game.hasUnfinishedRandom()) return;
    this.game.startNewGame(Number(this.customSeed), false);
    this.customSeed = null;
    this.ui.enterGame();
  }

  chooseSize(option: BoardSizeOption): void {
    this.game.setSizePreference(option);
    this.showSizes.set(false);
  }
}
