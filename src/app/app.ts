import { Component, effect, inject, OnInit, signal } from '@angular/core';
import { GameEngineService } from './core/services/game-engine.service';
import { StorageService } from './core/services/storage.service';
import { HeaderComponent } from './features/header/header.component';
import { BoardComponent } from './features/board/board.component';
import { ToolbarComponent } from './features/toolbar/toolbar.component';
import { VictoryModalComponent } from './features/modals/victory-modal.component';
import { HowToPlayModalComponent } from './features/modals/how-to-play-modal.component';
import { StatsModalComponent } from './features/modals/stats-modal.component';
import { IconComponent } from './shared/icon.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    IconComponent,
    HeaderComponent,
    BoardComponent,
    ToolbarComponent,
    VictoryModalComponent,
    HowToPlayModalComponent,
    StatsModalComponent
  ],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  readonly game = inject(GameEngineService);
  private readonly storage = inject(StorageService);

  readonly showHowToPlay = signal<boolean>(false);
  readonly showVictory = signal<boolean>(false);
  readonly showStats = signal<boolean>(false);

  constructor() {
    effect(() => {
      if (this.game.isSolved()) {
        this.showVictory.set(true);
      }
    });
  }

  ngOnInit(): void {
    const saved = this.storage.loadCurrentGame();
    if (saved && saved.marks && saved.regions) {
      let solution = saved.solution || [];
      if (!solution || solution.length === 0) {
        const fresh = this.game.generator.generatePuzzle(saved.seed, saved.isDaily);
        solution = fresh.solution;
      }

      this.game.puzzle.set({
        id: saved.puzzleId,
        seed: saved.seed,
        size: saved.regions.length,
        regions: saved.regions,
        solution,
        isDaily: saved.isDaily,
        dateStr: saved.dateStr
      });

      const restoredBoard = saved.regions.map((row, r) =>
        row.map((regId, c) => ({
          row: r,
          col: c,
          regionId: regId,
          mark: saved.marks[r][c],
          isConflict: false,
          isConflictAdjacent: false,
          isHint: false,
          isLastPlaced: false
        }))
      );

      this.game.board.set(restoredBoard);
      this.game.elapsedSeconds.set(saved.elapsedSeconds);
      this.game.isTimerRunning.set(true);
    } else {
      this.game.startNewGame(undefined, true);
    }  }
}
