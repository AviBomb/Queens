import { Component, output } from '@angular/core';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-how-to-play-modal',
  standalone: true,
  imports: [IconComponent],
  template: `
    <div class="sheet-backdrop" (click)="close.emit()">
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="rules-title" (click)="$event.stopPropagation()">
        <div class="sheet-grabber" aria-hidden="true"></div>
        <div class="sheet-head">
          <h2 id="rules-title" class="sheet-title">How to play</h2>
          <button type="button" class="sheet-close" (click)="close.emit()" aria-label="Close rules">
            <app-icon name="close" />
          </button>
        </div>

        <p class="lead">Boards run from 7×7 to 10×10. An N×N board has N colors and needs N queens placed so every rule below holds.</p>

        <ol class="rules">
          <li class="rule">
            <span class="rule-num" aria-hidden="true">1</span>
            <div>
              <h3>One per row and column</h3>
              <p>Each row and each column holds exactly one queen.</p>
            </div>
          </li>
          <li class="rule">
            <span class="rule-num" aria-hidden="true">2</span>
            <div>
              <h3>One per color region</h3>
              <p>Each colored region holds exactly one queen.</p>
            </div>
          </li>
          <li class="rule">
            <span class="rule-num" aria-hidden="true">3</span>
            <div>
              <h3>Queens never touch</h3>
              <p>No two queens can be neighbors, including diagonally.</p>
            </div>
          </li>
        </ol>

        <div class="controls">
          <h3 class="controls-title">Controls</h3>
          <ul>
            <li><span class="key">Tap</span> Cycle a square: empty, X, queen</li>
            <li><span class="key">Drag</span> Mark many squares with X at once</li>
            <li class="hide-compact"><span class="key">Right-click</span> Place or remove a queen directly</li>
          </ul>
        </div>

        <button type="button" class="btn btn-primary btn-block" (click)="close.emit()">Start playing</button>
      </div>
    </div>
  `,
  styles: [`
    .lead { font-size: 15px; color: var(--text-2); max-width: 46ch; }

    .rules { list-style: none; display: flex; flex-direction: column; gap: 4px; }

    .rule {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      padding: 12px 14px;
      border-radius: var(--r-md);
      background: var(--sunken);
    }

    .rule-num {
      width: 28px;
      height: 28px;
      flex-shrink: 0;
      display: grid;
      place-items: center;
      border-radius: 9px;
      background: var(--accent-soft);
      color: var(--accent-strong);
      font-family: var(--font-mono);
      font-size: 14px;
      font-weight: 600;
    }

    .rule h3 { font-size: 15px; font-weight: 600; letter-spacing: -0.01em; margin-bottom: 2px; }
    .rule p { font-size: 14px; color: var(--muted); line-height: 1.4; }

    .controls-title { font-size: 13px; font-weight: 600; color: var(--muted); margin-bottom: 8px; }
    .controls ul { list-style: none; display: flex; flex-direction: column; gap: 10px; }
    .controls li { display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--text-2); }

    .key {
      min-width: 86px;
      padding: 4px 8px;
      border-radius: 8px;
      background: var(--sunken);
      box-shadow: inset 0 0 0 1px var(--line);
      font-size: 12.5px;
      font-weight: 600;
      text-align: center;
      color: var(--text);
    }
  `]
})
export class HowToPlayModalComponent {
  readonly close = output<void>();
}
