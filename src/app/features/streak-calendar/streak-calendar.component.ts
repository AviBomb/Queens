import { Component, computed, inject, input, signal } from '@angular/core';
import { StorageService } from '../../core/services/storage.service';
import { DAILIES_PER_FREEZE, MAX_STREAK_FREEZES } from '../../core/models/queens.model';
import { IconComponent } from '../../shared/icon.component';

type DayState = 'solved' | 'frozen' | 'past' | 'future';

interface CalendarCell {
  day: number;
  date: string;
  state: DayState;
  isToday: boolean;
  joinLeft: boolean;
  joinRight: boolean;
}

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Month grid of solved daily puzzles and days kept alive by a streak freeze. */
@Component({
  selector: 'app-streak-calendar',
  standalone: true,
  imports: [IconComponent],
  template: `
    <div class="cal">
      @if (showSummary()) {
      <div class="summary">
        <div class="sum">
          <span class="sum-value"><app-icon name="flame" />{{ daily().currentStreak }}</span>
          <span class="sum-label">Current streak</span>
        </div>
        <div class="sum">
          <span class="sum-value">{{ daily().maxStreak }}</span>
          <span class="sum-label">Best streak</span>
        </div>
        <div class="sum">
          <span class="sum-value freezes" [attr.aria-label]="daily().freezes + ' of ' + maxFreezes + ' freezes'">
            @for (on of freezeSlots(); track $index) {
              <span class="freeze" [class.on]="on"><app-icon name="snowflake" /></span>
            }
          </span>
          <span class="sum-label">Freezes</span>
        </div>
      </div>
      }

      <div class="month-head">
        <button type="button" class="nav-btn" (click)="shiftMonth(-1)" aria-label="Previous month">
          <app-icon name="chevronLeft" />
        </button>
        <h3 class="month-title" aria-live="polite">{{ monthLabel() }}</h3>
        <button type="button" class="nav-btn" (click)="shiftMonth(1)" [disabled]="!canGoNext()" aria-label="Next month">
          <app-icon name="chevron" />
        </button>
      </div>

      <div class="grid">
        @for (label of weekdays; track $index) {
          <span class="weekday" aria-hidden="true">{{ label }}</span>
        }
        @for (blank of leadingBlanks(); track $index) {
          <span class="blank" aria-hidden="true"></span>
        }
        @for (cell of cells(); track cell.date) {
          <span
            class="day is-{{ cell.state }}"
            [class.is-today]="cell.isToday"
            [class.join-left]="cell.joinLeft"
            [class.join-right]="cell.joinRight"
            [attr.aria-label]="ariaFor(cell)"
          >
            @if (cell.state === 'frozen') {
              <app-icon name="snowflake" />
            } @else {
              {{ cell.day }}
            }
          </span>
        }
      </div>

      <div class="legend">
        <span class="key"><span class="swatch is-solved"></span>Solved</span>
        <span class="key"><span class="swatch is-frozen"></span>Freeze used</span>
        <span class="solved-count">{{ solvedThisMonth() }} solved this month</span>
      </div>

      <p class="note">{{ freezeNote() }}</p>
    </div>
  `,
  styles: [`
    .cal { display: flex; flex-direction: column; gap: 14px; }

    .summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }

    .sum {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 12px;
      border-radius: var(--r-sm);
      background: var(--sunken);
    }

    .sum-value {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      min-height: 28px;
      font-family: var(--font-mono);
      font-size: 22px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      --icon-size: 18px;
    }

    .sum-value app-icon { color: var(--accent-strong); }
    .sum-label { font-size: 12.5px; font-weight: 500; color: var(--muted); }

    .freeze {
      width: 26px;
      height: 26px;
      display: grid;
      place-items: center;
      border-radius: 8px;
      background: var(--surface);
      color: var(--faint);
      --icon-size: 14px;
    }

    .freeze.on { background: color-mix(in srgb, var(--region-2) 45%, var(--surface)); color: var(--text); }
    .freeze app-icon { color: inherit; }

    .month-head { display: flex; align-items: center; justify-content: space-between; }
    .month-title { font-size: 16px; font-weight: 650; letter-spacing: -0.015em; }

    .nav-btn {
      width: 40px;
      height: 40px;
      display: grid;
      place-items: center;
      border-radius: 999px;
      background: var(--sunken);
      color: var(--text-2);
      --icon-size: 18px;
      transition: transform 160ms var(--ease-out);
    }

    .nav-btn:active:not(:disabled) { transform: scale(0.92); }
    .nav-btn:disabled { color: var(--faint); background: transparent; }

    .grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); row-gap: 6px; }

    .weekday { text-align: center; font-size: 12px; font-weight: 600; color: var(--muted); padding-bottom: 2px; }

    .day {
      aspect-ratio: 1;
      margin: 0 2px;
      display: grid;
      place-items: center;
      border-radius: 10px;
      font-family: var(--font-mono);
      font-size: 13.5px;
      font-weight: 500;
      font-variant-numeric: tabular-nums;
      color: var(--text-2);
      --icon-size: 15px;
    }

    .day.is-future { color: var(--faint); }

    .day.is-solved { background: var(--accent); color: #18181b; font-weight: 700; }
    .day.is-frozen { background: color-mix(in srgb, var(--region-2) 45%, var(--surface)); color: var(--text); }

    .day.join-left { margin-left: 0; border-top-left-radius: 0; border-bottom-left-radius: 0; }
    .day.join-right { margin-right: 0; border-top-right-radius: 0; border-bottom-right-radius: 0; }

    .day.is-today { box-shadow: inset 0 0 0 2px var(--text); }

    .legend { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 14px; font-size: 12.5px; color: var(--muted); }
    .key { display: inline-flex; align-items: center; gap: 6px; }
    .swatch { width: 12px; height: 12px; border-radius: 4px; }
    .swatch.is-solved { background: var(--accent); }
    .swatch.is-frozen { background: color-mix(in srgb, var(--region-2) 45%, var(--surface)); }
    .solved-count { margin-left: auto; font-weight: 500; }

    .note { font-size: 13px; color: var(--muted); line-height: 1.4; text-wrap: pretty; }
  `]
})
export class StreakCalendarComponent {
  private readonly storage = inject(StorageService);

  /** The stats sheet already shows streak numbers, so it hides this row. */
  readonly showSummary = input(true);
  readonly weekdays = WEEKDAYS;
  readonly maxFreezes = MAX_STREAK_FREEZES;
  private readonly today = this.storage.getLocalDateString();
  private readonly viewMonth = signal(this.monthStart(new Date()));

  readonly daily = computed(() => this.storage.getStats().dailyStats);
  private readonly solved = computed(() => new Set(this.storage.getCompletedDailyDates()));
  private readonly frozen = computed(() => new Set(this.daily().frozenDates));

  readonly freezeSlots = computed(() =>
    Array.from({ length: MAX_STREAK_FREEZES }, (_, i) => i < this.daily().freezes)
  );

  readonly monthLabel = computed(() =>
    this.viewMonth().toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  );

  readonly canGoNext = computed(() => this.viewMonth() < this.monthStart(new Date()));

  readonly leadingBlanks = computed(() => Array.from({ length: (this.viewMonth().getDay() + 6) % 7 }));

  readonly cells = computed<CalendarCell[]>(() => {
    const start = this.viewMonth();
    const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    const offset = (start.getDay() + 6) % 7;
    const states = Array.from({ length: daysInMonth }, (_, i) => {
      const date = this.storage.getLocalDateString(new Date(start.getFullYear(), start.getMonth(), i + 1));
      return { date, state: this.stateFor(date) };
    });
    const inStreak = (i: number) => states[i]?.state === 'solved' || states[i]?.state === 'frozen';

    return states.map(({ date, state }, i) => {
      const column = (offset + i) % 7;
      return {
        day: i + 1,
        date,
        state,
        isToday: date === this.today,
        joinLeft: inStreak(i) && column > 0 && inStreak(i - 1),
        joinRight: inStreak(i) && column < 6 && inStreak(i + 1)
      };
    });
  });

  readonly solvedThisMonth = computed(() => this.cells().filter((c) => c.state === 'solved').length);

  readonly freezeNote = computed(() => {
    const d = this.daily();
    const base = `Every ${DAILIES_PER_FREEZE} daily solves earn a freeze, up to ${MAX_STREAK_FREEZES}. A freeze covers a missed day and still adds it to your streak.`;
    if (d.freezes >= MAX_STREAK_FREEZES) return `${base} Your freezes are full.`;
    const left = DAILIES_PER_FREEZE - (d.completedCount % DAILIES_PER_FREEZE);
    return `${base} ${left} more to your next one.`;
  });

  shiftMonth(delta: number): void {
    const m = this.viewMonth();
    const next = new Date(m.getFullYear(), m.getMonth() + delta, 1);
    if (delta > 0 && next > this.monthStart(new Date())) return;
    this.viewMonth.set(next);
  }

  ariaFor(cell: CalendarCell): string {
    const label = new Date(`${cell.date}T00:00:00`).toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
    const states: Record<DayState, string> = {
      solved: 'solved',
      frozen: 'kept by a streak freeze',
      past: 'not played',
      future: 'upcoming'
    };
    return `${label}, ${states[cell.state]}`;
  }

  private stateFor(date: string): DayState {
    if (this.solved().has(date)) return 'solved';
    if (this.frozen().has(date)) return 'frozen';
    return date > this.today ? 'future' : 'past';
  }

  private monthStart(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }
}
