import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { GameEngineService } from '../../core/services/game-engine.service';
import { BoardSizeOption } from '../../core/models/queens.model';
import { IconComponent } from '../../shared/icon.component';
import { SheetComponent } from '../../shared/sheet.component';
import { SizeSheetComponent, sizeLabel } from '../size-sheet/size-sheet.component';

@Component({
  selector: 'app-toolbar',
  standalone: true,
  imports: [IconComponent, SheetComponent, SizeSheetComponent],
  template: `
    <div class="dock">
      <div class="tools" role="toolbar" aria-label="Game controls">
        <button
          type="button"
          class="tool"
          [disabled]="game.isReviewMode() || !game.canUndo()"
          (click)="game.undo()"
          title="Undo (Ctrl+Z)"
        >
          <app-icon name="undo" />
          <span class="tool-label">Undo</span>
          <kbd class="tool-kbd">Ctrl Z</kbd>
        </button>

        <button
          type="button"
          class="tool"
          [disabled]="game.isReviewMode() || !game.canRedo()"
          (click)="game.redo()"
          title="Redo (Ctrl+Y)"
        >
          <app-icon name="redo" />
          <span class="tool-label">Redo</span>
          <kbd class="tool-kbd">Ctrl Y</kbd>
        </button>

        <button
          type="button"
          class="tool"
          [disabled]="game.isSolved()"
          (click)="askRestart()"
          [title]="game.isSolved() ? 'Restart is unavailable on a finished puzzle' : 'Restart puzzle (R)'"
        >
          <app-icon name="restart" />
          <span class="tool-label">Restart</span>
          <kbd class="tool-kbd">R</kbd>
        </button>

        <button
          type="button"
          class="tool tool-hint"
          [class.is-nudge]="game.hintNudge()"
          [disabled]="game.isSolved() || game.hintCooldown() > 0"
          (click)="game.requestHint()"
          [title]="hintTitle()"
          [attr.aria-label]="game.hintCooldown() > 0 ? 'Hint available in ' + game.hintCooldown() + ' seconds' : 'Hint'"
        >
          <app-icon name="bulb" />
          <span class="tool-label">
            @if (game.hintCooldown() > 0) {
              {{ game.hintCooldown() }}s
            } @else {
              Hint
            }
          </span>
          <kbd class="tool-kbd">H</kbd>
        </button>

        <button
          type="button"
          class="tool"
          [class.is-on]="game.autoX()"
          [attr.aria-pressed]="game.autoX()"
          [disabled]="game.isSolved()"
          (click)="game.toggleAutoX()"
          [title]="game.isSolved() ? 'Auto-X is unavailable on a finished puzzle' : 'Auto-X: mark blocked squares automatically when you place a queen'"
        >
          <app-icon name="bolt" />
          <span class="tool-label">Auto-X</span>
          <span class="tool-kbd tool-state">{{ game.autoX() ? 'On' : 'Off' }}</span>
        </button>
      </div>

      <div class="modes">
        <button
          type="button"
          class="btn mode-daily"
          [class.is-active]="isDailySelected()"
          [class.is-done]="game.isDailyCompletedToday()"
          (click)="onDailyClick()"
          [title]="dailyButtonTitle()"
        >
          <app-icon [name]="game.isDailyCompletedToday() ? 'check' : 'calendar'" />
          {{ game.isDailyCompletedToday() ? 'Daily solved' : 'Daily' }}
        </button>

        <div class="split" [class.is-locked]="randomLocked()" role="group" aria-label="Random game">
          <button
            type="button"
            class="split-main"
            [disabled]="randomLocked()"
            (click)="playRandom()"
            [title]="randomTitle()"
          >
            <app-icon name="shuffle" />
            {{ randomLabel() }}
          </button>
          <button
            type="button"
            class="split-size"
            [disabled]="randomLocked() || game.hasUnfinishedRandom()"
            (click)="showSizes.set(true)"
            title="Choose board size"
            [attr.aria-label]="'Board size: ' + sizeName() + '. Change size'"
          >
            {{ sizeName() }}
            <app-icon name="chevronDown" />
          </button>
        </div>
      </div>

      @if (randomLocked()) {
        <p class="dock-note">Finish this puzzle to start a new one</p>
      }
    </div>

    @if (showSizes()) {
      <app-size-sheet (chosen)="chooseSize($event)" (closed)="showSizes.set(false)" />
    }

    @if (confirmRestart()) {
      <app-sheet labelledBy="restart-title" (closed)="confirmRestart.set(false)">
        <div class="sheet-body">
          <div class="sheet-head">
            <h2 id="restart-title" class="sheet-title">Restart puzzle?</h2>
            <button type="button" class="sheet-close" (click)="confirmRestart.set(false)" aria-label="Cancel restart">
              <app-icon name="close" />
            </button>
          </div>
          <p class="restart-copy">Your marks will be cleared. The timer keeps running.</p>
          <div class="restart-actions">
            <button type="button" class="btn btn-tonal" (click)="confirmRestart.set(false)">Cancel</button>
            <button type="button" class="btn btn-primary" (click)="confirmRestartNow()">Restart</button>
          </div>
        </div>
      </app-sheet>
    }
  `,
  styles: [`
    :host { display: block; width: 100%; flex: 0 0 auto; }

    .dock {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 6px;
      border-radius: 26px;
      background: var(--surface);
      box-shadow: inset 0 0 0 1px var(--line), var(--shadow-2);
    }

    .tools { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 2px; }

    .tool {
      min-height: 60px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 5px;
      border-radius: var(--r-lg);
      color: var(--text-2);
      --icon-size: 22px;
      transition: transform 160ms var(--ease-out), background-color 160ms var(--ease-out), color 160ms var(--ease-out);
    }

    .tool-label { font-size: 12px; font-weight: 600; letter-spacing: -0.005em; font-variant-numeric: tabular-nums; }
    .tool-kbd { display: none; }

    .tool:active:not(:disabled) { transform: scale(0.93); background: var(--sunken); }
    .tool:disabled { color: var(--faint); }
    .tool-hint:not(:disabled) app-icon { color: var(--accent-strong); }
    .tool.is-on { background: var(--accent-soft); color: var(--accent-strong); }
    .tool.is-on .tool-label { color: var(--text); }
    .tool.is-on:disabled { background: none; color: var(--faint); }
    .tool.is-on:disabled .tool-label { color: inherit; }

    .tool-hint.is-nudge { background: var(--accent-soft); animation: nudge 1.6s var(--ease-out) infinite; }
    .tool-hint.is-nudge .tool-label { color: var(--text); }

    @keyframes nudge {
      0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 45%, transparent); }
      50% { box-shadow: 0 0 0 6px color-mix(in srgb, var(--accent) 0%, transparent); }
    }

    .modes {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1.35fr);
      gap: 6px;
    }

    .modes .btn { min-height: 52px; border-radius: var(--r-lg); padding: 0 12px; --icon-size: 19px; }

    .mode-daily { background: var(--sunken); color: var(--text); }
    .mode-daily.is-active { box-shadow: inset 0 0 0 1.5px var(--text); }
    .mode-daily.is-done { background: var(--success-soft); color: var(--success); box-shadow: none; }

    .dock-note { padding: 0 8px 2px; font-size: 12px; font-weight: 500; color: var(--muted); text-align: center; }

    .split { display: flex; min-width: 0; min-height: 52px; border-radius: var(--r-lg); background: var(--ink); color: var(--on-ink); overflow: hidden; transition: background-color 160ms var(--ease-out), color 160ms var(--ease-out); }
    .split.is-locked { background: var(--sunken); color: var(--faint); }
    .split-main:disabled, .split-size:disabled { cursor: not-allowed; }
    .split-main, .split-size { display: flex; align-items: center; justify-content: center; transition: background-color 160ms var(--ease-out); }
    .split-main { flex: 1; min-width: 0; gap: 8px; font-size: 15px; font-weight: 600; --icon-size: 19px; }
    .split-size {
      gap: 2px;
      padding: 0 10px 0 12px;
      border-left: 1px solid color-mix(in srgb, var(--on-ink) 22%, transparent);
      font-family: var(--font-mono);
      font-size: 13px;
      font-weight: 600;
      --icon-size: 15px;
    }
    .split-main:active:not(:disabled), .split-size:active:not(:disabled) { background: color-mix(in srgb, var(--on-ink) 14%, transparent); }

    @media (hover: hover) {
      .split-main:hover:not(:disabled), .split-size:hover:not(:disabled) { background: color-mix(in srgb, var(--on-ink) 10%, transparent); }
      .tool:hover:not(:disabled) { background: var(--sunken); color: var(--text); }
      .tool.is-on:hover:not(:disabled) { background: var(--accent-soft); }
      .mode-daily:hover { background: color-mix(in srgb, var(--sunken) 85%, var(--text)); }
      .mode-daily.is-done:hover { background: var(--success-soft); }
    }

    @media (max-width: 767px) and (max-height: 700px) {
      .tool { min-height: 52px; gap: 3px; --icon-size: 20px; }
      .tool-label { font-size: 11px; }
      .modes .btn, .split { min-height: 46px; height: 46px; }
    }

    /* Laptop rail */
    @media (min-width: 1100px) and (min-height: 640px) {
      .dock { gap: 10px; padding: 10px; border-radius: var(--r-xl); }
      .tools { gap: 4px; }
      .tool { min-height: 84px; border-radius: 18px; gap: 6px; }
      .tool-kbd { display: inline-block; font-size: 10px; }
      .tool-state { font-family: var(--font-mono); font-weight: 500; color: inherit; background: none; border: none; padding: 1px 0; }
      .modes .btn, .split { border-radius: 18px; }
    }

    .restart-copy { font-size: 15px; line-height: 1.4; color: var(--text-2); }
    .restart-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  `]
})
export class ToolbarComponent {
  readonly game = inject(GameEngineService);

  readonly showSizes = signal<boolean>(false);
  readonly confirmRestart = signal(false);

  readonly sizeName = computed(() => sizeLabel(this.game.sizePreference()));

  /** A random puzzle in progress has to be solved before a new one can be dealt. */
  readonly randomLocked = computed(() => this.game.isCurrentUnfinishedRandom());
  readonly canResumeRandom = computed(() => !this.randomLocked() && this.game.hasUnfinishedRandom());
  readonly randomLabel = computed(() => (this.canResumeRandom() ? 'Resume' : 'Random'));
  readonly randomTitle = computed(() => {
    if (this.randomLocked()) return 'Finish this puzzle to start a new one';
    return this.canResumeRandom() ? 'Back to your random puzzle' : 'Start a new random puzzle';
  });

  chooseSize(option: BoardSizeOption): void {
    this.game.setSizePreference(option);
    this.showSizes.set(false);
    this.playRandom();
  }

  hintTitle(): string {
    if (this.game.isSolved()) return 'Hint is unavailable on a finished puzzle';
    if (this.game.hintCooldown() > 0) return `Hint available in ${this.game.hintCooldown()}s`;
    return 'Get a logical hint (H)';
  }

  isDailySelected(): boolean {
    return !!this.game.puzzle()?.isDaily;
  }

  private isViewingSolvedDaily(): boolean {
    return !!this.game.puzzle()?.isDaily && this.game.isReviewMode();
  }

  dailyButtonTitle(): string {
    if (this.isViewingSolvedDaily()) return 'Back to your last game';
    return this.game.isDailyCompletedToday()
      ? 'Daily challenge completed for today. Click to view the solved board.'
      : "Play today's daily challenge";
  }

  /** On the solved daily board this returns to your other game; anywhere else it opens the daily. */
  onDailyClick(): void {
    if (!this.isViewingSolvedDaily()) {
      this.game.openDaily();
    } else if (this.game.hasUnfinishedRandom()) {
      this.game.openRandom();
    } else if (this.game.hasLastCompleted()) {
      this.game.openLastCompleted();
    } else {
      this.game.startNewGame();
    }
  }

  playRandom(): void {
    if (this.randomLocked()) return;
    this.game.openRandom();
  }

  askRestart(): void {
    if (this.game.isSolved() || this.game.isReviewMode()) return;
    this.confirmRestart.set(true);
  }

  confirmRestartNow(): void {
    this.confirmRestart.set(false);
    this.game.restartCurrentGame();
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboard(event: KeyboardEvent): void {
    if (event.target instanceof HTMLInputElement) return;

    if (this.confirmRestart()) {
      if (event.key === 'Enter') {
        this.confirmRestartNow();
        event.preventDefault();
      }
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      if (event.shiftKey) {
        this.game.redo();
      } else {
        this.game.undo();
      }
      event.preventDefault();
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
      this.game.redo();
      event.preventDefault();
    } else if (event.key.toLowerCase() === 'h') {
      this.game.requestHint();
    } else if (event.key.toLowerCase() === 'r' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      this.askRestart();
    }
  }
}
