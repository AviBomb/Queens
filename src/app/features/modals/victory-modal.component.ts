import { Component, computed, inject, output, signal } from '@angular/core';
import { GameEngineService } from '../../core/services/game-engine.service';
import { StorageService } from '../../core/services/storage.service';
import { ConfettiService } from '../../core/services/confetti.service';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-victory-modal',
  standalone: true,
  imports: [IconComponent],
  template: `
    <div class="sheet-backdrop" (click)="close.emit()">
      <div class="sheet victory" role="dialog" aria-modal="true" aria-labelledby="victory-title" (click)="$event.stopPropagation()">
        <div class="sheet-grabber" aria-hidden="true"></div>

        <div class="mark" aria-hidden="true"><app-icon name="crown" /></div>
        <div>
          <h2 id="victory-title" class="title">Puzzle solved</h2>
          <p class="subtitle">{{ puzzleName() }}</p>
        </div>

        <dl class="stat-grid">
          <div class="stat-tile"><dt>Your time</dt><dd class="is-accent">{{ formattedTime() }}</dd></div>
          <div class="stat-tile"><dt>Best time</dt><dd>{{ formattedBestTime() }}</dd></div>
          <div class="stat-tile"><dt>Average</dt><dd>{{ formattedAvgTime() }}</dd></div>
          <div class="stat-tile"><dt>Streak</dt><dd>{{ stats().currentStreak }}</dd></div>
        </dl>

        <div class="actions">
          <button type="button" class="btn btn-primary btn-block" (click)="onPlayNext()">
            <app-icon name="shuffle" />
            Play next game
          </button>
          <button type="button" class="btn btn-tonal btn-block" [class.is-copied]="copied()" (click)="shareScore()">
            <app-icon [name]="copied() ? 'check' : 'share'" />
            {{ copied() ? 'Copied to clipboard' : 'Share result' }}
          </button>
          <button type="button" class="btn btn-ghost btn-block" (click)="close.emit()">Review board</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .victory { text-align: center; align-items: center; }
    .victory .stat-grid, .actions { width: 100%; }
    .victory .stat-tile { background: var(--sunken); box-shadow: none; text-align: left; }

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
    .subtitle { font-family: var(--font-mono); font-size: 13px; color: var(--muted); margin-top: 2px; }

    .actions { display: flex; flex-direction: column; gap: 8px; }
    .btn-tonal.is-copied { background: var(--success-soft); color: var(--success); }
  `]
})
export class VictoryModalComponent {
  readonly game = inject(GameEngineService);
  private readonly storage = inject(StorageService);
  private readonly confetti = inject(ConfettiService);

  readonly close = output<void>();

  readonly copied = signal<boolean>(false);

  readonly stats = computed(() => this.storage.getStats());
  readonly puzzleName = computed(() => this.game.puzzle()?.id ?? 'Queens Game');

  readonly formattedTime = computed(() => {
    const s = this.game.elapsedSeconds();
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
  });

  readonly formattedBestTime = computed(() => {
    const s = this.stats().bestTime;
    if (s === null) return '--';
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
  });

  readonly formattedAvgTime = computed(() => {
    const s = this.stats().averageTime;
    if (s === null) return '--';
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
  });

  constructor() {
    this.confetti.launch();
  }

  onPlayNext(): void {
    this.confetti.clear();
    this.game.startNewGame();
    this.close.emit();
  }

  shareScore(): void {
    const time = this.formattedTime();
    const id = this.puzzleName();
    const streak = this.stats().currentStreak;
    const avg = this.formattedAvgTime();
    const text = `👑 Queens Puzzle ${id}\n⏱️ Time: ${time} (Avg: ${avg})\n🔥 Streak: ${streak}\nPlay offline on GitHub Pages: ${window.location.href}`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        this.copied.set(true);
        setTimeout(() => this.copied.set(false), 2500);
      });
    }
  }
}
