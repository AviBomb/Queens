import { Component, computed, output, signal } from '@angular/core';
import { CellCoord, CellMark } from '../../core/models/queens.model';
import { REGION_NAMES } from '../../core/logic/queens-logic';
import { IconComponent } from '../../shared/icon.component';
import { SheetComponent } from '../../shared/sheet.component';

/** 5x5 teaching board. Its only solution is (0,1) (1,3) (2,0) (3,2) (4,4). */
export const DEMO_REGIONS: number[][] = [
  [0, 0, 0, 1, 1],
  [0, 2, 1, 1, 4],
  [2, 2, 3, 1, 4],
  [2, 3, 3, 3, 4],
  [2, 3, 4, 4, 4]
];

interface DemoStep {
  title: string;
  text: string;
  targets: CellCoord[];
  mark: 'x' | 'queen';
  /** Cells crossed automatically once the step is done. */
  autoCross?: CellCoord[];
}

const STEPS: DemoStep[] = [
  {
    title: 'Tap twice for a queen',
    text: 'Every row, column and colour needs exactly one queen. Tap the glowing square twice to place your first queen.',
    targets: [{ row: 2, col: 0 }],
    mark: 'queen'
  },
  {
    title: 'One per row and column',
    text: 'That queen claims row 3 and column 1. Tap each glowing square once to cross out the rest of its row. We will cross its column for you.',
    targets: [1, 2, 3, 4].map((col) => ({ row: 2, col })),
    mark: 'x',
    autoCross: [0, 1, 3, 4].map((row) => ({ row, col: 0 }))
  },
  {
    title: 'Queens never touch',
    text: 'No two queens can be neighbours, not even diagonally. Cross out the two glowing squares that touch your queen.',
    targets: [
      { row: 1, col: 1 },
      { row: 3, col: 1 }
    ],
    mark: 'x'
  },
  {
    title: 'One per colour',
    text: `Each colour region holds exactly one queen. Place the queen for the ${REGION_NAMES[3]} region on the glowing square.`,
    targets: [{ row: 3, col: 2 }],
    mark: 'queen'
  },
  {
    title: 'Finish the board',
    text: 'Use the same three rules to place the last three queens.',
    targets: [
      { row: 0, col: 1 },
      { row: 1, col: 3 },
      { row: 4, col: 4 }
    ],
    mark: 'queen'
  }
];

const N = DEMO_REGIONS.length;

@Component({
  selector: 'app-demo',
  standalone: true,
  imports: [IconComponent, SheetComponent],
  template: `
    <app-sheet labelledBy="demo-title" panelClass="demo-sheet" (closed)="closed.emit()">
      <div class="sheet-body">
        <div class="sheet-head">
          <div class="progress" role="progressbar" [attr.aria-valuenow]="stepIndex()" aria-valuemin="0" [attr.aria-valuemax]="steps.length">
            @for (s of steps; track $index) {
              <span class="dot" [class.done]="$index < stepIndex()" [class.current]="$index === stepIndex()"></span>
            }
          </div>
          <button type="button" class="sheet-close" (click)="closed.emit()" aria-label="Close demo">
            <app-icon name="close" />
          </button>
        </div>

        @if (step(); as s) {
          <div class="copy" aria-live="polite">
            <h2 id="demo-title" class="sheet-title">{{ s.title }}</h2>
            <p class="text">{{ s.text }}</p>
          </div>
        } @else {
          <div class="copy" aria-live="polite">
            <h2 id="demo-title" class="sheet-title">You're ready</h2>
            <p class="text">That's the whole game. Every board has exactly one answer you can reach by logic alone.</p>
          </div>
        }

        <div class="board-frame">
          <div class="board" [class.is-done]="!step()" role="grid" aria-label="Demo board, 5 by 5">
            @for (row of marks(); track r; let r = $index) {
              @for (mark of row; track c; let c = $index) {
                <button
                  type="button"
                  class="cell"
                  role="gridcell"
                  [style.background]="'var(--region-' + regions[r][c] + ')'"
                  [class.is-target]="isTarget(r, c)"
                  [class.is-wrong]="wrong() === r * size + c"
                  [attr.aria-label]="'Row ' + (r + 1) + ', column ' + (c + 1) + ', ' + markName(mark)"
                  (click)="tap(r, c)"
                >
                  @if (mark === 'queen') {
                    <app-icon class="crown" name="crown" />
                  } @else if (mark === 'x') {
                    <svg class="x" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
                  }
                </button>
              }
            }
            <svg class="lines" [attr.viewBox]="'0 0 ' + size + ' ' + size" preserveAspectRatio="none" aria-hidden="true">
              <path [attr.d]="dividers" />
            </svg>
          </div>
        </div>

        @if (step()) {
          <button type="button" class="btn btn-ghost skip" (click)="closed.emit()">Skip the demo</button>
        } @else {
          <div class="done-actions">
            <button type="button" class="btn btn-primary btn-block" (click)="playDaily.emit()">Play today's daily</button>
            <button type="button" class="btn btn-tonal btn-block" (click)="restart()">Try the demo again</button>
          </div>
        }
      </div>
    </app-sheet>
  `,
  styles: [`
    .progress { display: flex; gap: 6px; }
    .dot { width: 22px; height: 6px; border-radius: 999px; background: var(--line-strong); transition: background-color 240ms var(--ease-out), width 240ms var(--ease-out); }
    .dot.done { background: var(--accent); }
    .dot.current { background: var(--text); }

    .copy { display: flex; flex-direction: column; gap: 6px; min-height: 104px; }
    .text { font-size: 15px; line-height: 1.45; color: var(--text-2); max-width: 46ch; text-wrap: pretty; }

    .board-frame {
      align-self: center;
      width: min(100%, 320px);
      padding: 5px;
      border-radius: 20px;
      background: var(--surface);
      box-shadow: inset 0 0 0 1px var(--line), var(--shadow-2);
    }

    .board {
      position: relative;
      aspect-ratio: 1;
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      grid-template-rows: repeat(5, 1fr);
      border: 3px solid var(--board-divider);
      border-radius: 15px;
      overflow: hidden;
      clip-path: inset(0 round 15px);
      background: var(--board-divider);
    }

    .cell {
      position: relative;
      display: grid;
      place-items: center;
      border: 0.5px solid var(--cell-line);
      border-radius: 0;
    }

    .cell.is-target::after {
      content: '';
      position: absolute;
      inset: 4px;
      border: 2.5px dashed var(--accent-strong);
      border-radius: 8px;
      background: var(--accent-soft);
      animation: hintGlow 1.5s infinite ease-in-out;
      pointer-events: none;
    }

    .cell.is-wrong { animation: shake 0.35s ease-in-out; }

    .crown {
      position: relative;
      z-index: 1;
      --icon-size: 62%;
      width: 62%;
      height: 62%;
      color: #78350f;
      --icon-fill: #f59e0b;
      animation: popIn 240ms var(--ease-spring);
    }

    .x {
      position: relative;
      z-index: 1;
      width: 38%;
      height: 38%;
      fill: none;
      stroke: var(--x-color);
      stroke-width: 3;
      stroke-linecap: round;
      animation: popIn 140ms var(--ease-out);
    }

    .lines { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 4; pointer-events: none; }
    .lines path { fill: none; stroke: var(--board-divider); stroke-width: 3px; stroke-linecap: square; vector-effect: non-scaling-stroke; }

    .board.is-done .cell { animation: popIn 360ms var(--ease-spring); }

    .skip { align-self: center; min-height: 44px; font-size: 14px; font-weight: 500; }
    .done-actions { display: flex; flex-direction: column; gap: 8px; }
  `]
})
export class DemoComponent {
  readonly closed = output<void>();
  readonly playDaily = output<void>();

  readonly steps = STEPS;
  readonly regions = DEMO_REGIONS;
  readonly size = N;
  readonly dividers = buildDividers(DEMO_REGIONS);

  readonly stepIndex = signal(0);
  readonly marks = signal<CellMark[][]>(emptyMarks());
  readonly wrong = signal<number | null>(null);
  readonly step = computed<DemoStep | null>(() => STEPS[this.stepIndex()] ?? null);

  private advancing = false;

  isTarget(r: number, c: number): boolean {
    const s = this.step();
    if (!s || this.advancing) return false;
    return s.targets.some((t) => t.row === r && t.col === c) && this.marks()[r][c] !== s.mark;
  }

  markName(mark: CellMark): string {
    if (mark === 'queen') return 'queen';
    return mark === 'x' ? 'crossed out' : 'empty';
  }

  tap(r: number, c: number): void {
    const s = this.step();
    if (!s || this.advancing) return;
    if (!this.isTarget(r, c)) {
      this.wrong.set(r * N + c);
      setTimeout(() => this.wrong.set(null), 360);
      return;
    }
    const next: CellMark = this.marks()[r][c] === 'empty' ? 'x' : 'queen';
    this.setMark(r, c, next);

    if (s.targets.every((t) => this.marks()[t.row][t.col] === s.mark)) {
      this.advancing = true;
      setTimeout(() => {
        for (const cell of s.autoCross ?? []) this.setMark(cell.row, cell.col, 'x');
        this.stepIndex.update((i) => i + 1);
        this.advancing = false;
      }, 420);
    }
  }

  restart(): void {
    this.marks.set(emptyMarks());
    this.stepIndex.set(0);
  }

  private setMark(r: number, c: number, mark: CellMark): void {
    this.marks.update((rows) => rows.map((row, ri) => (ri === r ? row.map((m, ci) => (ci === c ? mark : m)) : row)));
  }
}

function emptyMarks(): CellMark[][] {
  return Array.from({ length: N }, () => Array.from({ length: N }, (): CellMark => 'empty'));
}

function buildDividers(regions: number[][]): string {
  const n = regions.length;
  let d = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (c < n - 1 && regions[r][c] !== regions[r][c + 1]) d += `M${c + 1} ${r}V${r + 1}`;
      if (r < n - 1 && regions[r][c] !== regions[r + 1][c]) d += `M${c} ${r + 1}H${c + 1}`;
    }
  }
  return d;
}
