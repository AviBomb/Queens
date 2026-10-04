import { Component, HostListener, computed, inject } from '@angular/core';
import { GameEngineService } from '../../core/services/game-engine.service';
import { CellMark } from '../../core/models/queens.model';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-board',
  standalone: true,
  imports: [IconComponent],
  template: `
    <div
      class="board-wrapper"
      [class.has-hint]="!!game.activeHint()"
      (pointermove)="onBoardPointerMove($event)"
      (pointerup)="onPointerUp()"
      (pointercancel)="onPointerUp()"
      (pointerleave)="onPointerUp()"
    >
      <div class="board-stage">
        <div class="board-shell">
          <div
            class="queens-grid"
            [class.solved]="game.isSolved()"
            [class.review-mode]="game.isReviewMode()"
            [class.has-focus]="focusCells().size > 0"
            [style.--n]="size()"
            role="grid"
            [attr.aria-label]="'Queens ' + size() + ' by ' + size() + ' board'"
          >
            @for (row of game.board(); track rowIdx; let rowIdx = $index) {
              @for (cell of row; track cell.col; let colIdx = $index) {
                <div
                  class="grid-cell"
                  [attr.data-row]="rowIdx"
                  [attr.data-col]="colIdx"
                  [style.background-color]="getRegionColor(cell.regionId)"
                  [class.border-top-thick]="isTopBorderThick(rowIdx, colIdx)"
                  [class.border-bottom-thick]="isBottomBorderThick(rowIdx, colIdx)"
                  [class.border-left-thick]="isLeftBorderThick(rowIdx, colIdx)"
                  [class.border-right-thick]="isRightBorderThick(rowIdx, colIdx)"
                  [class.has-queen]="cell.mark === 'queen'"
                  [class.has-x]="cell.mark === 'x'"
                  [class.is-conflict]="cell.isConflict || cell.isConflictAdjacent"
                  [class.is-hint]="isCellHinted(rowIdx, colIdx)"
                  [class.is-focus]="focusCells().has(rowIdx * size() + colIdx)"
                  [class.last-placed]="cell.isLastPlaced"
                  (pointerdown)="onCellPointerDown($event, rowIdx, colIdx)"
                  (pointerenter)="onCellPointerEnter(rowIdx, colIdx)"
                  (click)="onCellClick(rowIdx, colIdx)"
                  (contextmenu)="onRightClick($event, rowIdx, colIdx)"
                  role="gridcell"
                  [attr.aria-label]="getCellAriaLabel(rowIdx, colIdx, cell.mark, cell.regionId)"
                  tabindex="0"
                >
                  @if (cell.mark === 'queen') {
                    <div class="queen-marker" [class.conflict-shake]="cell.isConflict || cell.isConflictAdjacent">
                      <svg viewBox="0 0 40 40" class="queen-crown-svg" aria-hidden="true">
                        <defs>
                          <linearGradient id="goldCrownGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stop-color="#fffbeb" />
                            <stop offset="25%" stop-color="#fde047" />
                            <stop offset="55%" stop-color="#f59e0b" />
                            <stop offset="85%" stop-color="#d97706" />
                            <stop offset="100%" stop-color="#92400e" />
                          </linearGradient>
                          <linearGradient id="goldCrownRim" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stop-color="#fde68a" />
                            <stop offset="100%" stop-color="#78350f" />
                          </linearGradient>
                        </defs>
                        <path
                          d="M 5,30 L 7,13.5 L 14,21 L 20,8.5 L 26,21 L 33,13.5 L 35,30 Z"
                          fill="url(#goldCrownGrad)"
                          stroke="#78350f"
                          stroke-width="1.2"
                          stroke-linejoin="round"
                        />
                        <rect x="5" y="29" width="30" height="4.5" rx="2.2" fill="url(#goldCrownRim)" stroke="#78350f" stroke-width="1" />
                        <circle cx="7" cy="13.2" r="2.2" fill="#ef4444" stroke="#78350f" stroke-width="0.8" />
                        <circle cx="20" cy="8" r="2.8" fill="#3b82f6" stroke="#78350f" stroke-width="0.8" />
                        <circle cx="33" cy="13.2" r="2.2" fill="#ef4444" stroke="#78350f" stroke-width="0.8" />
                        <circle cx="11" cy="31.2" r="1.3" fill="#10b981" />
                        <circle cx="20" cy="31.2" r="1.5" fill="#ef4444" />
                        <circle cx="29" cy="31.2" r="1.3" fill="#3b82f6" />
                      </svg>
                    </div>
                  } @else if (cell.mark === 'x') {
                    <div class="x-marker" aria-hidden="true">
                      <svg viewBox="0 0 24 24" class="x-svg">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </div>
                  }

                  @if (isCellHinted(rowIdx, colIdx)) {
                    <div class="hint-beacon" [class.hint-for-x]="getHintType() === 'x'" aria-hidden="true">
                      @if (getHintType() === 'x') {
                        <span class="hint-ghost-x">✕</span>
                      }
                    </div>
                  }
                </div>
              }
            }
          </div>
        </div>
      </div>

      <div class="board-message" role="status" aria-live="polite">
        @if (game.activeHint(); as hint) {
          <div class="message is-hint" [class.is-danger]="hint.type === 'conflict'">
            <app-icon [name]="hint.type === 'conflict' ? 'alert' : 'bulb'" />
            <span class="message-text"><strong class="message-title">{{ hint.title }}.</strong> {{ hint.message }}</span>
            <button type="button" class="message-dismiss" (click)="dismissHint()" aria-label="Dismiss hint">
              <app-icon name="close" />
            </button>
          </div>
        } @else if (game.isReviewMode()) {
          <div class="message is-accent">
            <app-icon name="trophy" />
            <span class="message-text">Solved in {{ formatTime(game.reviewCompletedTime()) }}. Next daily puzzle at midnight.</span>
          </div>
        } @else if (game.conflictDetail(); as conflict) {
          <div class="message is-danger is-shake">
            <app-icon name="alert" />
            <span class="message-text">{{ conflict.message }}</span>
          </div>
        } @else if (game.isSolved()) {
          <div class="message is-success">
            <app-icon name="check" />
            <span class="message-text">Solved. Nice work.</span>
          </div>
        } @else if (game.queenCount() === size()) {
          <div class="message is-success">
            <app-icon name="crown" />
            <span class="message-text">All {{ size() }} queens placed with no conflicts.</span>
          </div>
        } @else if (game.queenCount() > 0) {
          <div class="message">
            <app-icon name="crown" />
            <span class="message-text">{{ game.queenCount() }} of {{ size() }} queens placed. No conflicts so far.</span>
          </div>
        } @else {
          <p class="helper">Tap once for X, twice for a queen. Drag to mark many squares.</p>
        }
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1 1 auto;
      min-height: 0;
      width: 100%;
    }

    .board-wrapper {
      flex: 1 1 auto;
      min-height: 280px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
      touch-action: none;
      container-type: size;
    }

    .board-stage {
      display: grid;
      place-items: center;
      width: 100%;
    }

    /* Height reserve below the board = message min-height + gap; more while a hint explains itself */
    .board-shell {
      width: min(92vw, 520px);
      width: min(100cqi, 100cqb - 58px, 600px);
      aspect-ratio: 1;
      transition: width 260ms var(--ease-out);
      padding: 5px;
      border-radius: 22px;
      background: var(--surface);
      box-shadow: inset 0 0 0 1px var(--line), var(--shadow-2);
    }

    .has-hint .board-shell { width: min(100cqi, 100cqb - 120px, 600px); }

    .queens-grid {
      width: 100%;
      height: 100%;
      display: grid;
      grid-template-columns: repeat(var(--n, 8), 1fr);
      grid-template-rows: repeat(var(--n, 8), 1fr);
      border: 2.5px solid var(--board-divider);
      border-radius: 17px;
      overflow: hidden;
      background: var(--board-divider);
      touch-action: none;
      -webkit-touch-callout: none;
    }

    .queens-grid.review-mode .grid-cell { cursor: default; }

    .grid-cell {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      border: 0.5px solid var(--cell-line);
      transition: filter 120ms var(--ease-out);
    }

    .grid-cell.border-top-thick { border-top: 3px solid var(--board-divider); }
    .grid-cell.border-bottom-thick { border-bottom: 3px solid var(--board-divider); }
    .grid-cell.border-left-thick { border-left: 3px solid var(--board-divider); }
    .grid-cell.border-right-thick { border-right: 3px solid var(--board-divider); }

    .grid-cell:focus-visible { outline: 3px solid var(--focus); outline-offset: -3px; z-index: 3; }

    /* Hint spotlight: dim everything except the reasoning cells and targets */
    .has-focus .grid-cell:not(.is-focus):not(.is-hint) { filter: saturate(0.55) brightness(1.04) opacity(0.78); }
    :host-context([data-theme='dark']) .has-focus .grid-cell:not(.is-focus):not(.is-hint) { filter: saturate(0.6) brightness(0.7); }

    @media (hover: hover) {
      .grid-cell:hover { filter: brightness(0.94); }
      :host-context([data-theme='dark']) .grid-cell:hover { filter: brightness(1.18); }
    }

    .queen-marker {
      width: 76%;
      height: 76%;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: popIn 240ms var(--ease-spring);
    }

    .queen-crown-svg {
      width: 100%;
      height: 100%;
      filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.3));
    }

    .x-marker {
      width: 40%;
      height: 40%;
      display: flex;
      color: var(--x-color);
      animation: popIn 140ms var(--ease-out);
    }

    .x-svg {
      width: 100%;
      height: 100%;
      stroke: currentColor;
      stroke-width: 3.2;
      stroke-linecap: round;
    }

    .grid-cell.is-conflict {
      background-image: linear-gradient(rgba(220, 38, 38, 0.38), rgba(220, 38, 38, 0.38));
      outline: 2.5px solid var(--danger);
      outline-offset: -2.5px;
      z-index: 2;
    }

    .conflict-shake { animation: shake 0.4s ease-in-out, pulseRed 1.5s infinite ease-in-out; }

    .hint-beacon {
      position: absolute;
      inset: 2px;
      border: 2.5px dashed var(--accent);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      background: var(--accent-soft);
      animation: hintGlow 1.5s infinite ease-in-out;
    }

    .hint-beacon.hint-for-x { border-color: var(--danger); background: var(--danger-soft); }

    .hint-ghost-x { font-size: 1.1rem; font-weight: 800; color: var(--danger); line-height: 1; }

    /* Message line under the board */
    .board-message {
      flex: 0 0 auto;
      width: 100%;
      min-height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .message {
      max-width: 100%;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      border-radius: var(--r-md);
      background: var(--surface);
      box-shadow: inset 0 0 0 1px var(--line), var(--shadow-1);
      color: var(--text-2);
      font-size: 14px;
      font-weight: 500;
      line-height: 1.35;
      --icon-size: 18px;
      animation: riseIn 220ms var(--ease-out);
    }

    .message app-icon { color: var(--muted); }
    .message-text { text-wrap: pretty; }
    .message-title { font-weight: 650; }

    .message.is-hint { background: var(--accent-soft); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 40%, transparent); color: var(--text); }
    .message.is-hint app-icon { color: var(--accent-strong); }
    .message.is-accent { background: var(--accent-soft); box-shadow: none; color: var(--text); }
    .message.is-accent app-icon { color: var(--accent-strong); }
    .message.is-danger { background: var(--danger-soft); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--danger) 35%, transparent); color: var(--danger); }
    .message.is-danger app-icon { color: var(--danger); }
    .message.is-shake { animation: shake 0.35s ease-in-out; }
    .message.is-success { background: var(--success-soft); box-shadow: none; color: var(--success); }
    .message.is-success app-icon { color: var(--success); }

    .message-dismiss {
      width: 36px;
      height: 36px;
      margin: -8px -8px -8px 0;
      flex-shrink: 0;
      display: grid;
      place-items: center;
      border-radius: 999px;
      color: var(--muted);
      --icon-size: 16px;
    }

    .message-dismiss:active { background: var(--line); }

    .helper {
      max-width: 34ch;
      text-align: center;
      font-size: 13.5px;
      color: var(--muted);
      text-wrap: balance;
    }

    @media (max-width: 767px) and (max-height: 700px) {
      .board-wrapper { gap: 6px; }
      .board-shell { width: min(100cqi, 100cqb - 46px, 600px); }
      .board-message { min-height: 40px; }
      .message { padding: 8px 12px; font-size: 13px; }
    }
  `]
})
export class BoardComponent {
  readonly game = inject(GameEngineService);

  readonly size = computed(() => this.game.board().length || 8);
  readonly focusCells = computed(() => {
    const n = this.size();
    return new Set((this.game.activeHint()?.focus ?? []).map((c) => c.row * n + c.col));
  });

  getRegionColor(regionId: number): string {
    return `var(--region-${regionId})`;
  }

  isTopBorderThick(r: number, c: number): boolean {
    const b = this.game.board();
    if (r === 0) return false;
    return b[r][c].regionId !== b[r - 1][c].regionId;
  }

  isBottomBorderThick(r: number, c: number): boolean {
    const b = this.game.board();
    if (r === b.length - 1) return false;
    return b[r][c].regionId !== b[r + 1][c].regionId;
  }

  isLeftBorderThick(r: number, c: number): boolean {
    const b = this.game.board();
    if (c === 0) return false;
    return b[r][c].regionId !== b[r][c - 1].regionId;
  }

  isRightBorderThick(r: number, c: number): boolean {
    const b = this.game.board();
    if (c === b.length - 1) return false;
    return b[r][c].regionId !== b[r][c + 1].regionId;
  }

  isCellHinted(r: number, c: number): boolean {
    const hint = this.game.activeHint();
    if (!hint) return false;
    return hint.coords.some((coord) => coord.row === r && coord.col === c);
  }

  getHintType(): 'x' | 'queen' {
    return this.game.activeHint()?.suggestedMark || 'x';
  }

  dismissHint(): void {
    this.game.activeHint.set(null);
  }

  getCellAriaLabel(r: number, c: number, mark: CellMark, regionId: number): string {
    const markDesc = mark === 'queen' ? 'Queen' : mark === 'x' ? 'Marked X' : 'Empty';
    return `Row ${r + 1}, Column ${c + 1}, Color region ${regionId + 1}, ${markDesc}`;
  }

  private pointerDown = false;
  private hasDragged = false;
  private startR = -1;
  private startC = -1;
  private dragTargetMark: CellMark = 'x';

  formatTime(seconds: number | null): string {
    if (seconds === null || seconds === undefined || seconds <= 0) return '--';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  onCellPointerDown(event: PointerEvent, r: number, c: number): void {
    if (event.button !== 0 || this.game.isReviewMode()) return;
    this.pointerDown = true;
    this.hasDragged = false;
    this.startR = r;
    this.startC = c;
    const startCell = this.game.board()[r][c];
    this.dragTargetMark = startCell.mark === 'x' ? 'empty' : 'x';

    if (event.pointerType === 'touch' && event.target instanceof HTMLElement) {
      try {
        event.target.setPointerCapture(event.pointerId);
      } catch {
        // Safe ignore
      }
    }
  }

  onCellPointerEnter(r: number, c: number): void {
    if (this.pointerDown && !this.game.isReviewMode()) {
      if (r !== this.startR || c !== this.startC) {
        if (!this.hasDragged) {
          this.hasDragged = true;
          const startCell = this.game.board()[this.startR][this.startC];
          if (startCell.mark !== 'queen') {
            this.game.setCellMark(this.startR, this.startC, this.dragTargetMark);
          }
        }
        const cell = this.game.board()[r][c];
        if (cell.mark !== 'queen') {
          this.game.setCellMark(r, c, this.dragTargetMark);
        }
      }
    }
  }

  onBoardPointerMove(event: PointerEvent): void {
    if (!this.pointerDown || this.game.isReviewMode()) return;
    if (event.pointerType === 'touch') {
      const el = document.elementFromPoint(event.clientX, event.clientY);
      const cellEl = el?.closest('.grid-cell');
      if (cellEl) {
        const rAttr = cellEl.getAttribute('data-row');
        const cAttr = cellEl.getAttribute('data-col');
        if (rAttr !== null && cAttr !== null) {
          const r = Number.parseInt(rAttr, 10);
          const c = Number.parseInt(cAttr, 10);
          this.onCellPointerEnter(r, c);
        }
      }
    }
  }

  onCellClick(r: number, c: number): void {
    if (this.game.isReviewMode()) return;
    if (this.hasDragged) {
      this.hasDragged = false;
      return;
    }
    this.game.cycleCell(r, c);
  }

  onRightClick(event: MouseEvent, r: number, c: number): void {
    event.preventDefault();
    if (this.game.isReviewMode()) return;
    this.game.toggleQueenDirect(r, c);
  }

  @HostListener('window:pointerup')
  onPointerUp(): void {
    this.pointerDown = false;
  }
}
