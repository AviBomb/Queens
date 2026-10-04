import { Component, computed, inject, output, signal } from '@angular/core';
import { StorageService } from '../../core/services/storage.service';
import { GameEngineService } from '../../core/services/game-engine.service';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-stats-modal',
  standalone: true,
  imports: [IconComponent],
  template: `
    <div class="sheet-backdrop" (click)="close.emit()">
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="stats-title" (click)="$event.stopPropagation()">
        <div class="sheet-grabber" aria-hidden="true"></div>
        <div class="sheet-head">
          <div>
            <h2 id="stats-title" class="sheet-title">Statistics</h2>
            <p class="sub">Saved on this device</p>
          </div>
          <button type="button" class="sheet-close" (click)="close.emit()" aria-label="Close statistics">
            <app-icon name="close" />
          </button>
        </div>

        <section class="section" aria-labelledby="daily-heading">
          <div class="section-head">
            <h3 id="daily-heading"><app-icon name="calendar" /> Daily challenge</h3>
            <span class="badge" [class.is-done]="isDailyCompletedToday()">
              @if (isDailyCompletedToday()) {
                <app-icon name="check" /> Solved today
              } @else {
                Open today
              }
            </span>
          </div>
          <dl class="stat-grid">
            <div class="stat-tile"><dt>Solved</dt><dd>{{ stats().dailyStats.completedCount }}</dd></div>
            <div class="stat-tile"><dt>Streak</dt><dd>{{ stats().dailyStats.currentStreak }}</dd></div>
            <div class="stat-tile"><dt>Best streak</dt><dd>{{ stats().dailyStats.maxStreak }}</dd></div>
            <div class="stat-tile"><dt>Best time</dt><dd class="is-accent">{{ formatTime(stats().dailyStats.bestTime) }}</dd></div>
          </dl>
        </section>

        <section class="section" aria-labelledby="all-heading">
          <div class="section-head">
            <h3 id="all-heading"><app-icon name="grid" /> All games</h3>
          </div>
          <dl class="stat-grid">
            <div class="stat-tile"><dt>Played</dt><dd>{{ stats().gamesPlayed }}</dd></div>
            <div class="stat-tile"><dt>Win rate</dt><dd>{{ winRate() }}%</dd></div>
            <div class="stat-tile"><dt>Streak</dt><dd>{{ stats().currentStreak }}</dd></div>
            <div class="stat-tile"><dt>Best streak</dt><dd>{{ stats().maxStreak }}</dd></div>
          </dl>
          <dl class="stat-grid">
            <div class="stat-tile"><dt>Best time</dt><dd class="is-accent">{{ formatTime(stats().bestTime) }}</dd></div>
            <div class="stat-tile"><dt>Average time</dt><dd>{{ formatTime(stats().averageTime) }}</dd></div>
          </dl>

          @if (stats().recentTimes.length > 0) {
            <div>
              <h4 class="recent-title">Recent solves</h4>
              <div class="chips">
                @for (time of stats().recentTimes; track $index) {
                  <span class="chip">{{ formatTime(time) }}</span>
                }
              </div>
            </div>
          }
        </section>

        @if (confirmReset()) {
          <div class="reset-confirm" role="alert">
            <p><strong>Reset all statistics?</strong> Streaks, times and daily history on this device will be cleared. This can't be undone.</p>
            <div class="reset-actions">
              <button type="button" class="btn btn-tonal" (click)="confirmReset.set(false)">Cancel</button>
              <button type="button" class="btn btn-danger" (click)="resetStats()">Reset</button>
            </div>
          </div>
        } @else {
          <button type="button" class="btn btn-ghost reset-link" (click)="confirmReset.set(true)">
            <app-icon name="trash" />
            {{ justReset() ? 'Statistics cleared' : 'Reset statistics' }}
          </button>
        }

        <button type="button" class="btn btn-primary btn-block" (click)="close.emit()">Back to game</button>
      </div>
    </div>
  `,
  styles: [`
    .sub { font-size: 13px; color: var(--muted); margin-top: 2px; }

    .section {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 14px;
      border-radius: var(--r-md);
      background: var(--sunken);
    }

    .section-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }

    .section-head h3 {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 15px;
      font-weight: 600;
      letter-spacing: -0.01em;
      --icon-size: 17px;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 12.5px;
      font-weight: 600;
      background: var(--accent-soft);
      color: var(--accent-strong);
      --icon-size: 14px;
    }

    .badge.is-done { background: var(--success-soft); color: var(--success); }

    .reset-link { align-self: center; min-height: 40px; font-size: 14px; font-weight: 500; --icon-size: 16px; }

    .reset-confirm {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 14px;
      border-radius: var(--r-md);
      background: var(--danger-soft);
      font-size: 14px;
      color: var(--text-2);
      animation: riseIn 200ms var(--ease-out);
    }

    .reset-confirm strong { color: var(--text); font-weight: 600; }
    .reset-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .btn-danger { background: var(--danger); color: #fff; }
    :host-context([data-theme='dark']) .btn-danger { color: #18181b; }

    .recent-title { font-size: 13px; font-weight: 600; color: var(--muted); margin-bottom: 8px; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; }

    .chip {
      padding: 4px 10px;
      border-radius: 8px;
      background: var(--surface);
      box-shadow: inset 0 0 0 1px var(--line);
      font-family: var(--font-mono);
      font-size: 13px;
      font-weight: 500;
      font-variant-numeric: tabular-nums;
    }
  `]
})
export class StatsModalComponent {
  private readonly storage = inject(StorageService);
  private readonly game = inject(GameEngineService);

  readonly close = output<void>();
  readonly confirmReset = signal(false);
  readonly justReset = signal(false);

  resetStats(): void {
    this.game.resetStatistics();
    this.confirmReset.set(false);
    this.justReset.set(true);
  }

  readonly stats = computed(() => this.storage.getStats());

  readonly isDailyCompletedToday = computed(() => this.storage.isDailyCompletedToday());

  readonly winRate = computed(() => {
    const s = this.stats();
    if (s.gamesPlayed === 0) return 0;
    return Math.round((s.gamesWon / s.gamesPlayed) * 100);
  });

  formatTime(seconds: number | null | undefined): string {
    if (seconds === null || seconds === undefined || seconds <= 0) return '--';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }
}
