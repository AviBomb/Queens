import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GameEngineService } from '../../core/services/game-engine.service';
import { BoardSizeOption } from '../../core/models/queens.model';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-toolbar',
  standalone: true,
  imports: [FormsModule, IconComponent],
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
          (click)="game.restartCurrentGame()"
          [title]="game.isSolved() ? 'Restart is unavailable on a finished puzzle' : 'Restart puzzle (R)'"
        >
          <app-icon name="restart" />
          <span class="tool-label">Restart</span>
          <kbd class="tool-kbd">R</kbd>
        </button>

        <button
          type="button"
          class="tool tool-hint"
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
        @if (showSeedInput()) {
          <label class="sr-only" for="seed-input">Puzzle seed</label>
          <input
            id="seed-input"
            type="number"
            inputmode="numeric"
            class="seed-input"
            placeholder="Seed, e.g. 1042"
            [(ngModel)]="customSeed"
            (keydown.enter)="playCustomSeed()"
          />
          <button type="button" class="btn btn-primary seed-go" (click)="playCustomSeed()">
            Play
            <app-icon name="arrowRight" />
          </button>
          <button type="button" class="square-btn" (click)="showSeedInput.set(false)" aria-label="Cancel custom seed" title="Cancel">
            <app-icon name="close" />
          </button>
        } @else {
          <button
            type="button"
            class="btn mode-daily"
            [class.is-active]="isDailySelected()"
            [class.is-done]="game.isDailyCompletedToday()"
            (click)="playDaily()"
            [title]="dailyButtonTitle()"
          >
            <app-icon [name]="game.isDailyCompletedToday() ? 'check' : 'calendar'" />
            {{ game.isDailyCompletedToday() ? 'Daily solved' : 'Daily' }}
          </button>

          <div class="split" role="group" aria-label="Random game">
            <button type="button" class="split-main" (click)="playRandom()" title="Start a new random puzzle">
              <app-icon name="shuffle" />
              Random
            </button>
            <button
              type="button"
              class="split-size"
              (click)="showSizes.set(true)"
              title="Choose board size"
              [attr.aria-label]="'Board size: ' + sizeLabel() + '. Change size'"
            >
              {{ sizeLabel() }}
              <app-icon name="chevronDown" />
            </button>
          </div>

          <button type="button" class="square-btn seed-toggle" (click)="showSeedInput.set(true)" title="Play custom seed" aria-label="Play custom seed">
            <app-icon name="hash" />
            <span class="seed-toggle-label">Custom seed</span>
          </button>
        }
      </div>
    </div>

    @if (showSizes()) {
      <div class="sheet-backdrop" (click)="showSizes.set(false)">
        <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="size-title" (click)="$event.stopPropagation()">
          <div class="sheet-grabber" aria-hidden="true"></div>
          <div class="sheet-head">
            <h2 id="size-title" class="sheet-title">New random game</h2>
            <button type="button" class="sheet-close" (click)="showSizes.set(false)" aria-label="Close">
              <app-icon name="close" />
            </button>
          </div>
          <div class="size-list" role="radiogroup" aria-labelledby="size-title">
            @for (option of sizeOptions; track option.value) {
              <button
                type="button"
                class="size-row"
                role="radio"
                [attr.aria-checked]="game.sizePreference() === option.value"
                (click)="chooseSize(option.value)"
              >
                <span class="size-badge">{{ option.badge }}</span>
                <span class="size-text">
                  <span class="size-name">{{ option.name }}</span>
                  <span class="size-desc">{{ option.desc }}</span>
                </span>
                @if (game.sizePreference() === option.value) {
                  <app-icon class="size-check" name="check" />
                }
              </button>
            }
          </div>
        </div>
      </div>
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

    .modes {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1.35fr) auto;
      gap: 6px;
    }

    .modes .btn { min-height: 52px; border-radius: var(--r-lg); padding: 0 12px; --icon-size: 19px; }

    .mode-daily { background: var(--sunken); color: var(--text); }
    .mode-daily.is-active { box-shadow: inset 0 0 0 1.5px var(--text); }
    .mode-daily.is-done { background: var(--success-soft); color: var(--success); box-shadow: none; }

    .square-btn {
      width: 52px;
      height: 52px;
      display: grid;
      place-items: center;
      border-radius: var(--r-lg);
      background: var(--sunken);
      color: var(--text-2);
      transition: transform 160ms var(--ease-out), background-color 160ms var(--ease-out);
    }

    .square-btn:active { transform: scale(0.94); }
    .seed-toggle-label { display: none; }

    .split { display: flex; min-width: 0; min-height: 52px; border-radius: var(--r-lg); background: var(--ink); color: var(--on-ink); overflow: hidden; }
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
    .split-main:active, .split-size:active { background: color-mix(in srgb, var(--on-ink) 14%, transparent); }

    .size-list { display: flex; flex-direction: column; gap: 4px; }
    .size-row { display: flex; align-items: center; gap: 14px; min-height: 64px; padding: 10px 14px; border-radius: var(--r-md); text-align: left; }
    .size-row[aria-checked='true'] { background: var(--sunken); }
    .size-row:active { background: var(--sunken); }
    .size-badge {
      width: 54px;
      height: 40px;
      flex-shrink: 0;
      display: grid;
      place-items: center;
      border-radius: 10px;
      background: var(--accent-soft);
      color: var(--accent-strong);
      font-family: var(--font-mono);
      font-size: 14px;
      font-weight: 600;
    }
    .size-text { flex: 1; display: flex; flex-direction: column; gap: 1px; }
    .size-name { font-size: 15px; font-weight: 600; }
    .size-desc { font-size: 13px; color: var(--muted); }
    .size-check { color: var(--text); }

    .seed-input {
      min-width: 0;
      height: 52px;
      padding: 0 16px;
      border-radius: var(--r-lg);
      border: 1.5px solid var(--line-strong);
      background: var(--surface);
      font-family: var(--font-mono);
      font-size: 16px;
      font-weight: 500;
      outline: none;
      user-select: text;
      -webkit-user-select: text;
      animation: riseIn 200ms var(--ease-out);
    }

    .seed-input::placeholder { color: var(--muted); font-family: var(--font-sans); }
    .seed-input:focus { border-color: var(--text); }
    .seed-go { --icon-size: 17px; }

    @media (hover: hover) {
      .split-main:hover, .split-size:hover { background: color-mix(in srgb, var(--on-ink) 10%, transparent); }
      .size-row:hover { background: var(--sunken); }
      .tool:hover:not(:disabled) { background: var(--sunken); color: var(--text); }
      .tool.is-on:hover { background: var(--accent-soft); }
      .mode-daily:hover, .square-btn:hover { background: color-mix(in srgb, var(--sunken) 85%, var(--text)); }
      .mode-daily.is-done:hover { background: var(--success-soft); }
    }

    @media (max-width: 767px) and (max-height: 700px) {
      .tool { min-height: 52px; gap: 3px; --icon-size: 20px; }
      .tool-label { font-size: 11px; }
      .modes .btn, .square-btn, .seed-input, .split { min-height: 46px; height: 46px; }
      .square-btn { width: 46px; }
    }

    /* Laptop rail */
    @media (min-width: 1100px) and (min-height: 640px) {
      .dock { gap: 10px; padding: 10px; border-radius: var(--r-xl); }
      .tools { gap: 4px; }
      .tool { min-height: 84px; border-radius: 18px; gap: 6px; }
      .tool-kbd { display: inline-block; font-size: 10px; }
      .tool-state { font-family: var(--font-mono); font-weight: 500; color: inherit; background: none; border: none; padding: 1px 0; }
      .modes { grid-template-columns: 1fr 1fr; }
      .modes .btn, .square-btn, .seed-input, .split { border-radius: 18px; }
      .square-btn { width: auto; }
      .seed-input { grid-column: span 2; }
      .seed-toggle {
        grid-column: span 2;
        height: 44px;
        display: flex;
        justify-content: center;
        gap: 8px;
        background: none;
        color: var(--muted);
        font-size: 14px;
        font-weight: 500;
        --icon-size: 17px;
      }
      .seed-toggle-label { display: inline; }
    }
  `]
})
export class ToolbarComponent {
  readonly game = inject(GameEngineService);

  readonly showSeedInput = signal<boolean>(false);
  readonly showSizes = signal<boolean>(false);
  customSeed: number | null = null;

  readonly sizeOptions: { value: BoardSizeOption; badge: string; name: string; desc: string }[] = [
    { value: 'mix', badge: '7-10', name: 'Mix it up', desc: 'A different board size every game' },
    { value: 7, badge: '7×7', name: 'Quick', desc: '7 colors, 7 queens' },
    { value: 8, badge: '8×8', name: 'Classic', desc: '8 colors, 8 queens' },
    { value: 9, badge: '9×9', name: 'Tricky', desc: '9 colors, 9 queens' },
    { value: 10, badge: '10×10', name: 'Expert', desc: '10 colors, 10 queens' }
  ];

  readonly sizeLabel = computed(() => {
    const option = this.game.sizePreference();
    return option === 'mix' ? 'Mix' : `${option}×${option}`;
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

  dailyButtonTitle(): string {
    return this.game.isDailyCompletedToday()
      ? 'Daily challenge completed for today. Click to view the solved board.'
      : "Play today's daily challenge";
  }

  playDaily(): void {
    this.showSeedInput.set(false);
    this.game.startNewGame(undefined, true);
  }

  playRandom(): void {
    this.showSeedInput.set(false);
    this.game.startNewGame();
  }

  playCustomSeed(): void {
    if (this.customSeed !== null && !Number.isNaN(this.customSeed)) {
      this.game.startNewGame(Number(this.customSeed), false);
      this.showSeedInput.set(false);
    }
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboard(event: KeyboardEvent): void {
    if (event.target instanceof HTMLInputElement) return;

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
    } else if (event.key.toLowerCase() === 'r') {
      this.game.restartCurrentGame();
    }
  }
}
