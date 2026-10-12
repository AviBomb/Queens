import { Component, inject, output } from '@angular/core';
import { GameEngineService } from '../../core/services/game-engine.service';
import { BoardSizeOption } from '../../core/models/queens.model';
import { IconComponent } from '../../shared/icon.component';
import { SheetComponent } from '../../shared/sheet.component';

export const SIZE_OPTIONS: { value: BoardSizeOption; badge: string; name: string; desc: string }[] = [
  { value: 'mix', badge: '7-10', name: 'Mix it up', desc: 'A different board size every game' },
  { value: 7, badge: '7×7', name: 'Quick', desc: '7 colors, 7 queens' },
  { value: 8, badge: '8×8', name: 'Classic', desc: '8 colors, 8 queens' },
  { value: 9, badge: '9×9', name: 'Tricky', desc: '9 colors, 9 queens' },
  { value: 10, badge: '10×10', name: 'Expert', desc: '10 colors, 10 queens' }
];

export function sizeLabel(option: BoardSizeOption): string {
  return option === 'mix' ? 'Mix' : `${option}×${option}`;
}

@Component({
  selector: 'app-size-sheet',
  standalone: true,
  imports: [IconComponent, SheetComponent],
  template: `
    <app-sheet labelledBy="size-title" (closed)="closed.emit()">
      <div class="sheet-body">
        <div class="sheet-head">
          <h2 id="size-title" class="sheet-title">Board size</h2>
          <button type="button" class="sheet-close" (click)="closed.emit()" aria-label="Close">
            <app-icon name="close" />
          </button>
        </div>
        <div class="size-list" role="radiogroup" aria-labelledby="size-title">
          @for (option of options; track option.value) {
            <button
              type="button"
              class="size-row"
              role="radio"
              [attr.aria-checked]="game.sizePreference() === option.value"
              (click)="chosen.emit(option.value)"
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
    </app-sheet>
  `,
  styles: [`
    .size-list { display: flex; flex-direction: column; gap: 4px; }
    .size-row { display: flex; align-items: center; gap: 14px; min-height: 64px; padding: 10px 14px; border-radius: var(--r-md); text-align: left; transition: background-color 160ms var(--ease-out); }
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

    @media (hover: hover) {
      .size-row:hover { background: var(--sunken); }
    }
  `]
})
export class SizeSheetComponent {
  readonly game = inject(GameEngineService);
  readonly options = SIZE_OPTIONS;
  readonly chosen = output<BoardSizeOption>();
  readonly closed = output<void>();
}
