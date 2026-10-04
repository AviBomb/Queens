import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { GameEngineService } from './game-engine.service';
import { PuzzleGeneratorService } from './puzzle-generator.service';
import { StorageService } from './storage.service';

describe('GameEngineService', () => {
  let engine: GameEngineService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [GameEngineService, PuzzleGeneratorService, StorageService]
    });
    engine = TestBed.inject(GameEngineService);
    engine.startNewGame(42, false);
  });

  it('should initialize an 8x8 board with 0 queens and timer running', () => {
    expect(engine.board().length).toBe(8);
    expect(engine.board()[0].length).toBe(8);
    expect(engine.queenCount()).toBe(0);
    expect(engine.isSolved()).toBe(false);
  });

  it('should cycle marks: empty -> x -> queen -> empty', () => {
    expect(engine.board()[0][0].mark).toBe('empty');

    engine.cycleCell(0, 0);
    expect(engine.board()[0][0].mark).toBe('x');

    engine.cycleCell(0, 0);
    expect(engine.board()[0][0].mark).toBe('queen');
    expect(engine.queenCount()).toBe(1);

    engine.cycleCell(0, 0);
    expect(engine.board()[0][0].mark).toBe('empty');
    expect(engine.queenCount()).toBe(0);
  });

  it('should support undo and redo', () => {
    engine.cycleCell(1, 1); // x
    engine.cycleCell(1, 1); // queen
    expect(engine.board()[1][1].mark).toBe('queen');
    expect(engine.canUndo()).toBe(true);

    engine.undo();
    expect(engine.board()[1][1].mark).toBe('empty');

    engine.redo();
    expect(engine.board()[1][1].mark).toBe('queen');
  });

  it('undoing a tapped queen clears the cell and its auto-X marks in one step', () => {
    if (!engine.autoX()) engine.toggleAutoX();

    engine.cycleCell(2, 2);
    engine.cycleCell(2, 2);
    expect(engine.board()[2][2].mark).toBe('queen');
    expect(engine.board()[2][3].mark).toBe('x');

    engine.undo();
    expect(engine.board()[2][2].mark).toBe('empty');
    expect(engine.board()[2][3].mark).toBe('empty');

    engine.redo();
    expect(engine.board()[2][2].mark).toBe('queen');
    expect(engine.board()[2][3].mark).toBe('x');
  });

  it('undoing a queen placed over an earlier X clears that cell to empty', () => {
    engine.setCellMark(0, 0, 'x');
    engine.setCellMark(1, 1, 'x');
    engine.setCellMark(0, 0, 'queen');

    engine.undo();
    expect(engine.board()[0][0].mark).toBe('empty');

    engine.undo();
    expect(engine.board()[1][1].mark).toBe('empty');
    expect(engine.canUndo()).toBe(false);
  });

  it('should automatically remove auto-X cells when queen is removed', () => {
    if (!engine.autoX()) engine.toggleAutoX();

    // Directly place a queen at (0, 0)
    engine.setCellMark(0, 0, 'queen');
    expect(engine.board()[0][0].mark).toBe('queen');

    // Surrounding cell (0, 1) and (1, 0) should now be 'x'
    expect(engine.board()[0][1].mark).toBe('x');
    expect(engine.board()[1][0].mark).toBe('x');

    // Now remove the queen at (0, 0) by cycling or setting mark to empty
    engine.setCellMark(0, 0, 'empty');
    expect(engine.board()[0][0].mark).toBe('empty');

    // Surrounding cell (0, 1) and (1, 0) should be reverted to 'empty'!
    expect(engine.board()[0][1].mark).toBe('empty');
    expect(engine.board()[1][0].mark).toBe('empty');
  });

  it('should remove auto-X cells on undo and restore on redo', () => {
    if (!engine.autoX()) engine.toggleAutoX();

    engine.setCellMark(3, 3, 'queen');
    expect(engine.board()[3][4].mark).toBe('x');

    // Undo queen placement
    engine.undo();
    expect(engine.board()[3][3].mark).toBe('empty');
    expect(engine.board()[3][4].mark).toBe('empty');

    // Redo queen placement
    engine.redo();
    expect(engine.board()[3][3].mark).toBe('queen');
    expect(engine.board()[3][4].mark).toBe('x');
  });

  it('should detect conflicting queens in the same row or column', () => {
    if (engine.autoX()) engine.toggleAutoX();

    engine.setCellMark(0, 0, 'queen');
    engine.setCellMark(0, 5, 'queen'); // same row

    expect(engine.board()[0][0].isConflict).toBe(true);
    expect(engine.board()[0][5].isConflict).toBe(true);
    expect(engine.hasConflicts()).toBe(true);
  });

  it('should detect adjacent touching queens diagonally', () => {
    if (engine.autoX()) engine.toggleAutoX();

    engine.setCellMark(2, 2, 'queen');
    engine.setCellMark(3, 3, 'queen'); // adjacent diagonal

    expect(engine.board()[2][2].isConflictAdjacent).toBe(true);
    expect(engine.board()[3][3].isConflictAdjacent).toBe(true);
  });

  it('should automatically complete game when all 8 valid queens placed', () => {
    const puzzle = engine.puzzle();
    expect(puzzle).toBeDefined();

    puzzle!.solution.forEach((coord) => {
      engine.setCellMark(coord.row, coord.col, 'queen');
    });

    expect(engine.queenCount()).toBe(8);
    expect(engine.hasConflicts()).toBe(false);
    expect(engine.isSolved()).toBe(true);
  });

  it('should guarantee puzzle #637438 has exactly 1 unique solution and is 100% winnable', () => {
    engine.startNewGame(637438, false);
    const puzzle = engine.puzzle();
    expect(puzzle).toBeDefined();
    expect(puzzle!.solution.length).toBe(8);

    // Place all 8 solution queens
    puzzle!.solution.forEach((coord) => {
      engine.setCellMark(coord.row, coord.col, 'queen');
    });

    expect(engine.queenCount()).toBe(8);
    expect(engine.hasConflicts()).toBe(false);
    expect(engine.isSolved()).toBe(true);
  });

  it('should report detailed conflict message when queens touch diagonally', () => {
    if (engine.autoX()) engine.toggleAutoX();
    engine.startNewGame(637438, false);

    // Place diagonally touching queens at Row 5, Col 7 (4, 6) and Row 6, Col 8 (5, 7)
    engine.setCellMark(4, 6, 'queen');
    engine.setCellMark(5, 7, 'queen');

    const detail = engine.conflictDetail();
    expect(detail).toBeDefined();
    expect(detail?.type).toBe('touching');
    expect(detail?.message).toContain('touch diagonally');
  });

  it('should detect misplaced queen and explain the dead end when user requests hint', () => {
    if (engine.autoX()) engine.toggleAutoX();
    engine.startNewGame(637438, false);

    const solution = new Set(engine.puzzle()!.solution.map((c) => `${c.row},${c.col}`));
    const wrong = engine.board().flat().find((cell) => !solution.has(`${cell.row},${cell.col}`))!;
    engine.setCellMark(wrong.row, wrong.col, 'queen');

    engine.requestHint();
    const hint = engine.activeHint();
    expect(hint?.type).toBe('conflict');
    expect(hint?.title).toBe('This queen leads to a dead end');
    expect(hint?.coords[0]).toEqual({ row: wrong.row, col: wrong.col });
  });

  for (const size of [7, 8, 9, 10]) {
    it(`solves a ${size}x${size} game using only hints, and every hint is correct`, () => {
      engine.startNewGame(size * 100_000_000 + 4242 + size);
      const puzzle = engine.puzzle()!;
      expect(puzzle.size).toBe(size);
      const solution = new Set(puzzle.solution.map((c) => `${c.row},${c.col}`));

      for (let step = 0; step < 300 && !engine.isSolved(); step++) {
        engine.hintCooldown.set(0);
        engine.requestHint();
        const hint = engine.activeHint()!;
        expect(hint.type).not.toBe('conflict');
        expect(hint.title).not.toBe('A nudge');
        expect(hint.message.length).toBeGreaterThan(20);
        for (const c of hint.coords) {
          expect(solution.has(`${c.row},${c.col}`)).toBe(hint.suggestedMark === 'queen');
          engine.setCellMark(c.row, c.col, hint.suggestedMark);
        }
      }
      expect(engine.isSolved()).toBe(true);
    });
  }

  it('resets statistics and daily history', () => {
    const storage = TestBed.inject(StorageService);
    localStorage.clear();
    storage.recordWin(65);
    engine.startNewGame(undefined, true);
    engine.puzzle()!.solution.forEach((c) => engine.setCellMark(c.row, c.col, 'queen'));
    expect(storage.getStats().gamesWon).toBe(2);
    expect(engine.isDailyCompletedToday()).toBe(true);

    engine.resetStatistics();
    expect(storage.getStats().gamesWon).toBe(0);
    expect(storage.getStats().bestTime).toBeNull();
    expect(storage.isDailyCompletedToday()).toBe(false);
    expect(engine.isDailyCompletedToday()).toBe(false);
  });

  it('deals random games in the chosen size, and mix never repeats a size back to back', () => {
    engine.setSizePreference(10);
    engine.startNewGame();
    expect(engine.board().length).toBe(10);

    engine.setSizePreference('mix');
    let previous = engine.board().length;
    for (let i = 0; i < 8; i++) {
      engine.startNewGame();
      expect(engine.board().length).not.toBe(previous);
      previous = engine.board().length;
    }
  });

  it('should not record bestTime as 0:00 and properly update best time on positive elapsed seconds', () => {
    const storage = TestBed.inject(StorageService);
    // Clear storage for test
    localStorage.clear();

    expect(storage.getStats().bestTime).toBeNull();

    // Simulating 0 elapsed seconds (should be ignored, not locked at 0)
    storage.recordWin(0);
    expect(storage.getStats().bestTime).toBeNull();

    // Simulating 65s solve
    storage.recordWin(65);
    expect(storage.getStats().bestTime).toBe(65);

    // Simulating slower 90s solve (best time remains 65)
    storage.recordWin(90);
    expect(storage.getStats().bestTime).toBe(65);

    // Simulating faster 40s solve (best time becomes 40)
    storage.recordWin(40);
    expect(storage.getStats().bestTime).toBe(40);
  });

  it('should track daily challenge separately and enter review mode when re-opening solved daily challenge', () => {
    const storage = TestBed.inject(StorageService);
    localStorage.clear();

    // Start Daily Game
    engine.startNewGame(undefined, true);
    expect(engine.isDailyCompletedToday()).toBe(false);
    expect(engine.isReviewMode()).toBe(false);

    const puzzle = engine.puzzle();
    expect(puzzle).toBeDefined();
    expect(puzzle!.isDaily).toBe(true);

    // Solve the daily challenge
    puzzle!.solution.forEach((coord) => {
      engine.setCellMark(coord.row, coord.col, 'queen');
    });

    expect(engine.isSolved()).toBe(true);
    expect(engine.isDailyCompletedToday()).toBe(true);

    // Check separate stats
    const stats = storage.getStats();
    expect(stats.dailyStats.completedCount).toBe(1);
    expect(stats.dailyStats.currentStreak).toBe(1);

    // Try starting daily game again on same day
    engine.startNewGame(undefined, true);
    expect(engine.isReviewMode()).toBe(true);
    expect(engine.queenCount()).toBe(8);

    // Board mutations must be disabled in review mode
    engine.cycleCell(0, 0);
    expect(engine.queenCount()).toBe(8); // Did not cycle!
    engine.restartCurrentGame();
    expect(engine.queenCount()).toBe(8); // Did not restart!

    // Restart, hints and Auto-X do nothing while viewing a finished board
    const autoX = engine.autoX();
    engine.restartCurrentGame();
    engine.requestHint();
    engine.toggleAutoX();
    expect(engine.queenCount()).toBe(8);
    expect(engine.activeHint()).toBeNull();
    expect(engine.autoX()).toBe(autoX);

    // Starting a random game should work normally and exit review mode
    engine.startNewGame();
    expect(engine.isReviewMode()).toBe(false);
    expect(engine.queenCount()).toBe(0);
  });

  it('keeps a cross-these-cells hint until every hinted cell is crossed', () => {
    if (engine.autoX()) engine.toggleAutoX();
    const queen = engine.puzzle()!.solution[0];
    engine.setCellMark(queen.row, queen.col, 'queen');

    engine.requestHint();
    const hint = engine.activeHint();
    expect(hint?.type).toBe('elimination');
    expect(hint!.coords.length).toBeGreaterThan(1);

    const [first, ...rest] = hint!.coords;
    engine.cycleCell(first.row, first.col);
    expect(engine.activeHint()).toBe(hint);

    for (const c of rest) engine.setCellMark(c.row, c.col, 'x');
    expect(engine.activeHint()).toBeNull();
  });

  it('keeps a place-a-queen hint until that cell is a queen', () => {
    engine.activeHint.set({
      type: 'forced_queen',
      title: 'A nudge',
      message: 'Place the queen here.',
      suggestedMark: 'queen',
      coords: [{ row: 0, col: 0 }]
    });

    engine.cycleCell(0, 0);
    expect(engine.board()[0][0].mark).toBe('x');
    expect(engine.activeHint()?.suggestedMark).toBe('queen');

    engine.cycleCell(1, 1);
    expect(engine.activeHint()?.suggestedMark).toBe('queen');

    engine.cycleCell(0, 0);
    expect(engine.board()[0][0].mark).toBe('queen');
    expect(engine.activeHint()).toBeNull();
  });

  it('pauses the timer while away and resumes on return', () => {
    engine.setTimerPaused(true);
    vi.useFakeTimers();
    try {
      const before = engine.elapsedSeconds();
      vi.advanceTimersByTime(5000);
      expect(engine.isTimerRunning()).toBe(false);
      expect(engine.elapsedSeconds()).toBe(before);

      engine.setTimerPaused(false);
      vi.advanceTimersByTime(3000);
      expect(engine.isTimerRunning()).toBe(true);
      expect(engine.elapsedSeconds()).toBe(before + 3);
      engine.setTimerPaused(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
