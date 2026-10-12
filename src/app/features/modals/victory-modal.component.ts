import { Component, OnInit, computed, inject, output } from '@angular/core';
import { GameEngineService } from '../../core/services/game-engine.service';
import { StorageService } from '../../core/services/storage.service';
import { ConfettiService } from '../../core/services/confetti.service';
import { ShareService } from '../../core/services/share.service';
import { UiService } from '../../core/services/ui.service';
import { formatClock } from '../../core/logic/format';
import { IconComponent } from '../../shared/icon.component';
import { SheetComponent } from '../../shared/sheet.component';

@Component({
  selector: 'app-victory-modal',
  standalone: true,
  imports: [IconComponent, SheetComponent],
  template: `
    <app-sheet labelledBy="victory-title" (closed)="close.emit()">
      <div class="sheet-body victory">
        <p class="sheet-hint">Swipe down to see your board</p>

        <div class="mark" aria-hidden="true"><app-icon name="crown" /></div>
        <div>
          <h2 id="victory-title" class="title">Puzzle solved</h2>
          <p class="subtitle">{{ game.puzzleLabel() }}</p>
        </div>

        @if (game.newBestTime(); as best) {
          <div class="record" role="status">
            <app-icon name="trophy" />
            <span>New best time</span>
            <span class="record-times"><s>{{ clock(best.previous) }}</s> {{ clock(best.current) }}</span>
          </div>
        }

        <dl class="stat-grid">
          <div class="stat-tile" [class.is-record]="!!game.newBestTime()"><dt>Your time</dt><dd class="is-accent">{{ clock(game.elapsedSeconds()) }}</dd></div>
          <div class="stat-tile"><dt>Best time</dt><dd>{{ bestTime() }}</dd></div>
          <div class="stat-tile"><dt>Average</dt><dd>{{ averageTime() }}</dd></div>
          <div class="stat-tile"><dt>{{ isDaily() ? 'Daily streak' : 'Streak' }}</dt><dd>{{ streak() }}</dd></div>
        </dl>

        <div class="actions">
          <button type="button" class="btn btn-primary btn-block" (click)="onPlayNext()">
            <app-icon name="shuffle" />
            {{ game.hasUnfinishedRandom() ? 'Resume random game' : 'Play next game' }}
          </button>
          <button type="button" class="btn btn-tonal btn-block" (click)="shareScore()">
            <app-icon name="share" />
            Share result
          </button>
          <button type="button" class="btn btn-ghost btn-block review-btn" (click)="close.emit()">Review board</button>
        </div>
      </div>
    </app-sheet>
  `,
  styles: [`
    .victory { text-align: center; align-items: center; }
    .victory .stat-grid, .actions { width: 100%; }
    .victory .stat-tile { background: var(--sunken); box-shadow: none; text-align: left; }
    .victory .stat-tile.is-record { box-shadow: inset 0 0 0 1.5px var(--accent); }

    .mark {
      width: 76px;
      height: 76px;
      margin-top: 8px;
      display: grid;
      place-items: center;
      border-radius: 24px;
      background: var(--accent-soft);
      color: var(--accent-strong);
      --icon-size: 40px;
      --icon-fill: color-mix(in srgb, var(--accent) 45%, transparent);
      animation: popIn 520ms var(--ease-spring);
    }

    .title { font-size: 26px; font-weight: 700; letter-spacing: -0.035em; }
    .subtitle { font-size: 14px; color: var(--muted); margin-top: 2px; }

    .record {
      position: relative;
      overflow: hidden;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 14px;
      border-radius: 999px;
      background: var(--accent-soft);
      color: var(--accent-strong);
      font-size: 14px;
      font-weight: 650;
      --icon-size: 17px;
      animation: popIn 480ms var(--ease-spring) 120ms both;
    }

    .record::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(100deg, transparent 30%, color-mix(in srgb, var(--accent) 45%, transparent) 50%, transparent 70%);
      transform: translateX(-100%);
      animation: shimmer 1.2s var(--ease-out) 500ms 1 forwards;
    }

    .record-times { font-family: var(--font-mono); font-variant-numeric: tabular-nums; color: var(--text); }
    .record-times s { color: var(--muted); margin-right: 4px; }

    @keyframes shimmer {
      to { transform: translateX(100%); }
    }

    .actions { display: flex; flex-direction: column; gap: 8px; }

    @media (max-width: 639px) {
      .review-btn { display: none; }
    }
  `]
})
export class VictoryModalComponent implements OnInit {
  readonly game = inject(GameEngineService);
  private readonly storage = inject(StorageService);
  private readonly confetti = inject(ConfettiService);
  private readonly sharer = inject(ShareService);
  private readonly ui = inject(UiService);

  readonly close = output<void>();

  private shareFile: File | null = null;

  readonly stats = computed(() => this.storage.getStats());
  readonly isDaily = computed(() => !!this.game.puzzle()?.isDaily);
  readonly streak = computed(() => (this.isDaily() ? this.stats().dailyStats.currentStreak : this.stats().currentStreak));
  readonly bestTime = computed(() => {
    const s = this.isDaily() ? this.stats().dailyStats.bestTime : this.stats().bestTime;
    return s === null ? '--' : formatClock(s);
  });
  readonly averageTime = computed(() => {
    const s = this.isDaily() ? this.stats().dailyStats.averageTime : this.stats().averageTime;
    return s === null ? '--' : formatClock(s);
  });

  readonly clock = formatClock;

  ngOnInit(): void {
    if (this.game.newBestTime()) {
      this.confetti.launchRecord();
    } else {
      this.confetti.launch();
    }
    this.buildCard().catch(() => {
      this.shareFile = null;
    });
  }

  onPlayNext(): void {
    this.confetti.clear();
    if (this.game.hasUnfinishedRandom()) {
      this.game.openRandom();
    } else {
      this.game.startNewGame();
    }
    this.close.emit();
  }

  async shareScore(): Promise<void> {
    const outcome = await this.sharer.share(this.shareText(), this.shareFile);
    if (outcome === 'copied') this.ui.showToast('Result copied to clipboard');
    if (outcome === 'failed') this.ui.showToast('Sharing is not available here');
  }

  private headline(): string {
    const p = this.game.puzzle();
    return p?.isDaily ? "Today's daily" : `A ${p?.size ?? 8}×${p?.size ?? 8} puzzle`;
  }

  private detail(): string {
    if (this.game.newBestTime()) return 'New best time';
    const streak = this.streak();
    return this.isDaily() ? `${streak} day streak` : `${streak} wins in a row`;
  }

  private shareText(): string {
    const time = formatClock(this.game.elapsedSeconds());
    const what = this.isDaily() ? "today's Queens puzzle" : 'a Queens puzzle';
    return `I solved ${what} in ${time}. ${this.detail()}. Can you beat it?`;
  }

  private async buildCard(): Promise<void> {
    await document.fonts?.ready;
    const canvas = this.sharer.renderCard({
      headline: this.headline(),
      time: formatClock(this.game.elapsedSeconds()),
      detail: this.detail()
    });
    if (canvas) this.shareFile = await this.sharer.toFile(canvas);
  }
}
