import { computed, inject, Injectable, signal } from '@angular/core';
import {
  BOARD_SIZES,
  BoardSize,
  BoardSizeOption,
  Cell,
  CellCoord,
  CellMark,
  CompletedDailyRecord,
  HintResult,
  Move,
  PuzzleData
} from '../models/queens.model';
import { PuzzleGeneratorService } from './puzzle-generator.service';
import { AudioHapticsService } from './audio-haptics.service';
import { StorageService } from './storage.service';
import { LogicBoard, REGION_NAMES, cellName, explainDeadEnd, findDeduction } from '../logic/queens-logic';

@Injectable({
  providedIn: 'root'
})
export class GameEngineService {
  readonly generator = inject(PuzzleGeneratorService);
  private readonly audio = inject(AudioHapticsService);
  private readonly storage = inject(StorageService);

  // Core Game Signals
  readonly puzzle = signal<PuzzleData | null>(null);
  readonly board = signal<Cell[][]>([]);
  readonly isSolved = signal<boolean>(false);
  readonly isTimerRunning = signal<boolean>(false);
  readonly elapsedSeconds = signal<number>(0);
  readonly autoX = signal<boolean>(true);
  readonly moveHistory = signal<Move[]>([]);
  readonly redoStack = signal<Move[]>([]);
  readonly activeHint = signal<HintResult | null>(null);
  readonly hintCooldown = signal<number>(0);

  // Daily Challenge & Review Mode Signals
  readonly isReviewMode = signal<boolean>(false);
  readonly reviewCompletedTime = signal<number | null>(null);
  readonly isDailyCompletedToday = signal<boolean>(false);
  readonly sizePreference = signal<BoardSizeOption>(this.storage.getSizePreference());

  // Map from 'row,col' of a queen to the list of cells auto-filled with 'X' by that queen
  private queenAutoXMap = new Map<string, CellCoord[]>();

  // Derived signals
  readonly queenCount = computed(() => {
    let count = 0;
    const b = this.board();
    for (const row of b) {
      for (const cell of row) {
        if (cell.mark === 'queen') count++;
      }
    }
    return count;
  });

  readonly hasConflicts = computed(() => {
    const b = this.board();
    for (const row of b) {
      for (const cell of row) {
        if (cell.mark === 'queen' && (cell.isConflict || cell.isConflictAdjacent)) {
          return true;
        }
      }
    }
    return false;
  });

  readonly conflictDetail = computed<{
    type: 'touching' | 'row' | 'col' | 'region' | 'too_many';
    message: string;
    coords: CellCoord[];
  } | null>(() => {
    const b = this.board();
    const size = b.length;
    const queens: CellCoord[] = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (b[r][c].mark === 'queen') {
          queens.push({ row: r, col: c });
        }
      }
    }

    for (let i = 0; i < queens.length; i++) {
      const q1 = queens[i];
      for (let j = i + 1; j < queens.length; j++) {
        const q2 = queens[j];
        const isTouching = Math.abs(q1.row - q2.row) <= 1 && Math.abs(q1.col - q2.col) <= 1;
        if (isTouching) {
          const isDiagonal = q1.row !== q2.row && q1.col !== q2.col;
          const touchType = isDiagonal ? 'touch diagonally' : 'touch directly';
          return {
            type: 'touching',
            message: `The queens at ${cellName(q1)} and ${cellName(q2)} ${touchType}. Queens can't touch, not even diagonally.`,
            coords: [q1, q2]
          };
        }
        if (q1.row === q2.row) {
          return {
            type: 'row',
            message: `Two queens share row ${q1.row + 1}. Each row gets exactly one queen.`,
            coords: [q1, q2]
          };
        }
        if (q1.col === q2.col) {
          return {
            type: 'col',
            message: `Two queens share column ${q1.col + 1}. Each column gets exactly one queen.`,
            coords: [q1, q2]
          };
        }
        const regionId = b[q1.row][q1.col].regionId;
        if (regionId === b[q2.row][q2.col].regionId) {
          return {
            type: 'region',
            message: `Two queens are in the ${REGION_NAMES[regionId]} region. Each color gets exactly one queen.`,
            coords: [q1, q2]
          };
        }
      }
    }

    if (queens.length === size && this.hasConflicts()) {
      return {
        type: 'too_many',
        message: `All ${size} queens are placed, but some break the rules.`,
        coords: []
      };
    }

    return null;
  });

  readonly canUndo = computed(() => this.moveHistory().length > 0 && !this.isSolved() && !this.isReviewMode());
  readonly canRedo = computed(() => this.redoStack().length > 0 && !this.isSolved() && !this.isReviewMode());

  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private cooldownInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    const savedAutoX = localStorage.getItem('queens_autox');
    if (savedAutoX !== null) {
      this.autoX.set(savedAutoX === 'true');
    }
    this.isDailyCompletedToday.set(this.storage.isDailyCompletedToday());
  }

  /**
   * Initializes a new game (random seed or specified seed).
   * For daily challenges, if already completed today, opens the completed board in Review Mode!
   */
  startNewGame(seed?: number, isDaily = false): void {
    this.stopTimer();
    this.activeHint.set(null);
    this.moveHistory.set([]);
    this.redoStack.set([]);
    this.queenAutoXMap.clear();

    // Check if daily challenge has already been completed today
    if (isDaily) {
      this.isDailyCompletedToday.set(this.storage.isDailyCompletedToday());
      const completed = this.storage.getTodayCompletedDaily();

      if (completed) {
        // Load in Read-Only Review Mode
        this.puzzle.set({
          id: completed.puzzleId,
          seed: completed.seed,
          size: completed.regions.length,
          regions: completed.regions,
          solution: completed.solution,
          isDaily: true,
          dateStr: completed.dateStr
        });

        const reviewBoard: Cell[][] = completed.regions.map((row: number[], r: number) =>
          row.map((regId: number, c: number) => ({
            row: r,
            col: c,
            regionId: regId,
            mark: completed.marks[r][c],
            isConflict: false,
            isConflictAdjacent: false,
            isHint: false,
            isLastPlaced: false
          }))
        );

        this.board.set(reviewBoard);
        this.elapsedSeconds.set(completed.elapsedSeconds);
        this.reviewCompletedTime.set(completed.elapsedSeconds);
        this.isReviewMode.set(true);
        this.isSolved.set(true);
        return;
      }
    }

    // Normal game initialization (Random or uncompleted Daily)
    this.isReviewMode.set(false);
    this.reviewCompletedTime.set(null);
    this.isSolved.set(false);
    this.elapsedSeconds.set(0);

    const newPuzzle = isDaily
      ? this.generator.generateDailyPuzzle()
      : this.generator.generatePuzzle(seed ?? this.generator.createSeed(this.pickSize()));
    this.puzzle.set(newPuzzle);

    const size = newPuzzle.size;
    const newBoard: Cell[][] = Array.from({ length: size }, (_, r) =>
      Array.from({ length: size }, (_, c) => ({
        row: r,
        col: c,
        regionId: newPuzzle.regions[r][c],
        mark: 'empty',
        isConflict: false,
        isConflictAdjacent: false,
        isHint: false,
        isLastPlaced: false
      }))
    );

    this.board.set(newBoard);
    this.startTimer();
    this.storage.recordGameStarted();
    this.saveProgress();
  }

  setSizePreference(option: BoardSizeOption): void {
    this.sizePreference.set(option);
    this.storage.saveSizePreference(option);
  }

  /** Mix mode never deals the same size twice in a row. */
  private pickSize(): BoardSize {
    const option = this.sizePreference();
    if (option !== 'mix') return option;
    const current = this.puzzle()?.size;
    const choices = BOARD_SIZES.filter((s) => s !== current);
    return choices[Math.floor(Math.random() * choices.length)];
  }

  resetStatistics(): void {
    this.storage.resetStats();
    this.isDailyCompletedToday.set(false);
  }

  /**
   * Restarts the current puzzle from the beginning.
   */
  restartCurrentGame(): void {
    if (this.isSolved() || this.isReviewMode()) return;
    const p = this.puzzle();
    if (!p) return;
    this.stopTimer();
    this.activeHint.set(null);
    this.moveHistory.set([]);
    this.redoStack.set([]);
    this.queenAutoXMap.clear();
    this.isSolved.set(false);
    this.elapsedSeconds.set(0);

    const size = p.size;
    const cleanBoard: Cell[][] = Array.from({ length: size }, (_, r) =>
      Array.from({ length: size }, (_, c) => ({
        row: r,
        col: c,
        regionId: p.regions[r][c],
        mark: 'empty',
        isConflict: false,
        isConflictAdjacent: false,
        isHint: false,
        isLastPlaced: false
      }))
    );

    this.board.set(cleanBoard);
    this.startTimer();
    this.saveProgress();
  }

  /**
   * Primary click/tap handler: cycles Empty -> X -> Queen -> Empty
   */
  cycleCell(row: number, col: number): void {
    if (this.isSolved() || this.isReviewMode()) return;

    const currentCell = this.board()[row][col];
    let nextMark: CellMark;

    if (currentCell.mark === 'empty') {
      nextMark = 'x';
      this.audio.playMarkX();
    } else if (currentCell.mark === 'x') {
      nextMark = 'queen';
      this.audio.playPlaceQueen();
    } else {
      nextMark = 'empty';
      this.audio.playErase();
    }

    this.applyMove(row, col, nextMark);
  }

  /**
   * Direct Queen placement (e.g. on right click)
   */
  toggleQueenDirect(row: number, col: number): void {
    if (this.isSolved() || this.isReviewMode()) return;

    const currentCell = this.board()[row][col];
    const nextMark: CellMark = currentCell.mark === 'queen' ? 'empty' : 'queen';

    if (nextMark === 'queen') {
      this.audio.playPlaceQueen();
    } else {
      this.audio.playErase();
    }

    this.applyMove(row, col, nextMark);
  }

  /**
   * Sets a cell mark directly with history tracking
   */
  setCellMark(row: number, col: number, mark: CellMark): void {
    if (this.isSolved() || this.isReviewMode()) return;
    this.applyMove(row, col, mark);
  }

  private applyMove(row: number, col: number, mark: CellMark): void {
    const curBoard = this.board();
    const prevMark = curBoard[row][col].mark;
    if (prevMark === mark) return;

    let autoXCells: CellCoord[] = [];

    // Clone board
    let newBoard = curBoard.map((r, rIdx) =>
      r.map((c, cIdx) => {
        if (rIdx === row && cIdx === col) {
          return {
            ...c,
            mark,
            isLastPlaced: mark === 'queen'
          };
        }
        return { ...c, isLastPlaced: false };
      })
    );

    // CASE 1: Queen was placed
    if (mark === 'queen') {
      if (this.autoX()) {
        const regId = newBoard[row][col].regionId;
        const placedAutoX: CellCoord[] = [];

        for (let r = 0; r < newBoard.length; r++) {
          for (let c = 0; c < newBoard.length; c++) {
            if (r === row && c === col) continue;
            const isSameRow = r === row;
            const isSameCol = c === col;
            const isSameRegion = newBoard[r][c].regionId === regId;
            const isAdjacent = Math.abs(r - row) <= 1 && Math.abs(c - col) <= 1;

            if (isSameRow || isSameCol || isSameRegion || isAdjacent) {
              if (newBoard[r][c].mark === 'empty') {
                newBoard[r][c] = { ...newBoard[r][c], mark: 'x' };
                placedAutoX.push({ row: r, col: c });
              }
            }
          }
        }

        autoXCells = placedAutoX;
        this.queenAutoXMap.set(`${row},${col}`, placedAutoX);
      }
    }
    // CASE 2: Queen was removed (changed from queen to empty or x)
    else if (prevMark === 'queen') {
      const prevAutoX = this.queenAutoXMap.get(`${row},${col}`) || [];
      this.queenAutoXMap.delete(`${row},${col}`);

      const removedAutoX: CellCoord[] = [];
      for (const coord of prevAutoX) {
        if (newBoard[coord.row][coord.col].mark === 'x') {
          if (!this.isCellCoveredByOtherQueen(newBoard, coord.row, coord.col, row, col)) {
            newBoard[coord.row][coord.col] = {
              ...newBoard[coord.row][coord.col],
              mark: 'empty'
            };
            removedAutoX.push(coord);
          }
        }
      }
      autoXCells = removedAutoX;
    }

    // A queen placed on the X from the previous tap is one move back to empty, not two.
    const entry: Move = { row, col, prevMark, newMark: mark, autoXCells };
    this.moveHistory.update((h) => {
      const last = h.at(-1);
      if (mark === 'queen' && last && last.row === row && last.col === col && last.newMark === 'x') {
        return [...h.slice(0, -1), { ...entry, prevMark: last.prevMark }];
      }
      return [...h, entry];
    });
    this.redoStack.set([]);

    this.board.set(newBoard);
    this.updateConflictsAndCheckWin();
    this.reconcileHint();
    this.saveProgress();
  }

  /**
   * Cross-these-cells hints stay until every hinted cell is an X.
   * Place-a-queen hints stay until that cell is a queen, so marking it with X does not hide the hint.
   * Other hints clear on the next move.
   */
  private reconcileHint(): void {
    const hint = this.activeHint();
    if (!hint) return;
    const b = this.board();
    if (hint.suggestedMark === 'queen') {
      const placed = hint.coords.every((c) => b[c.row][c.col].mark === 'queen');
      if (placed) this.activeHint.set(null);
      return;
    }
    if (hint.type !== 'elimination') {
      this.activeHint.set(null);
      return;
    }
    const pending = hint.coords.some((c) => b[c.row][c.col].mark !== 'x');
    if (!pending) this.activeHint.set(null);
  }

  undo(): void {
    const history = this.moveHistory();
    if (history.length === 0 || this.isSolved() || this.isReviewMode()) return;

    let lastMove = history[history.length - 1];
    let remaining = history.slice(0, -1);
    if (lastMove.newMark === 'queen' && lastMove.prevMark === 'x') {
      const queenRow = lastMove.row;
      const queenCol = lastMove.col;
      lastMove = { ...lastMove, prevMark: 'empty' };
      remaining = remaining.filter((m) => !(m.row === queenRow && m.col === queenCol && m.newMark === 'x'));
    }
    this.moveHistory.set(remaining);
    this.redoStack.update((r) => [...r, lastMove]);

    let updatedBoard = this.board().map((r, rIdx) =>
      r.map((c, cIdx) => {
        if (rIdx === lastMove.row && cIdx === lastMove.col) {
          return { ...c, mark: lastMove.prevMark };
        }
        return c;
      })
    );

    // If undoing queen placement -> remove auto-X cells that were added
    if (lastMove.newMark === 'queen' && lastMove.autoXCells && lastMove.autoXCells.length > 0) {
      this.queenAutoXMap.delete(`${lastMove.row},${lastMove.col}`);
      for (const coord of lastMove.autoXCells) {
        if (updatedBoard[coord.row][coord.col].mark === 'x') {
          if (!this.isCellCoveredByOtherQueen(updatedBoard, coord.row, coord.col, lastMove.row, lastMove.col)) {
            updatedBoard[coord.row][coord.col] = {
              ...updatedBoard[coord.row][coord.col],
              mark: 'empty'
            };
          }
        }
      }
    }
    // If undoing queen removal -> restore auto-X cells
    else if (lastMove.prevMark === 'queen' && lastMove.autoXCells && lastMove.autoXCells.length > 0) {
      this.queenAutoXMap.set(`${lastMove.row},${lastMove.col}`, lastMove.autoXCells);
      for (const coord of lastMove.autoXCells) {
        if (updatedBoard[coord.row][coord.col].mark === 'empty') {
          updatedBoard[coord.row][coord.col] = {
            ...updatedBoard[coord.row][coord.col],
            mark: 'x'
          };
        }
      }
    }

    this.board.set(updatedBoard);
    this.audio.playUndo();
    this.updateConflictsAndCheckWin();
    this.saveProgress();
  }

  redo(): void {
    const redos = this.redoStack();
    if (redos.length === 0 || this.isSolved() || this.isReviewMode()) return;

    const nextMove = redos[redos.length - 1];
    this.redoStack.set(redos.slice(0, -1));
    this.moveHistory.update((h) => [...h, nextMove]);

    let updatedBoard = this.board().map((r, rIdx) =>
      r.map((c, cIdx) => {
        if (rIdx === nextMove.row && cIdx === nextMove.col) {
          return { ...c, mark: nextMove.newMark };
        }
        return c;
      })
    );

    // If redoing queen placement -> restore auto-X
    if (nextMove.newMark === 'queen' && nextMove.autoXCells && nextMove.autoXCells.length > 0) {
      this.queenAutoXMap.set(`${nextMove.row},${nextMove.col}`, nextMove.autoXCells);
      for (const coord of nextMove.autoXCells) {
        if (updatedBoard[coord.row][coord.col].mark === 'empty') {
          updatedBoard[coord.row][coord.col] = {
            ...updatedBoard[coord.row][coord.col],
            mark: 'x'
          };
        }
      }
    }
    // If redoing queen removal -> remove auto-X
    else if (nextMove.prevMark === 'queen' && nextMove.autoXCells && nextMove.autoXCells.length > 0) {
      this.queenAutoXMap.delete(`${nextMove.row},${nextMove.col}`);
      for (const coord of nextMove.autoXCells) {
        if (updatedBoard[coord.row][coord.col].mark === 'x') {
          if (!this.isCellCoveredByOtherQueen(updatedBoard, coord.row, coord.col, nextMove.row, nextMove.col)) {
            updatedBoard[coord.row][coord.col] = {
              ...updatedBoard[coord.row][coord.col],
              mark: 'empty'
            };
          }
        }
      }
    }

    this.board.set(updatedBoard);
    this.audio.playMarkX();
    this.updateConflictsAndCheckWin();
    this.saveProgress();
  }

  toggleAutoX(): boolean {
    if (this.isSolved() || this.isReviewMode()) return this.autoX();
    const next = !this.autoX();
    this.autoX.set(next);
    localStorage.setItem('queens_autox', String(next));
    return next;
  }

  /**
   * Checks if cell (r, c) is covered by any queen on board OTHER than (excludeR, excludeC).
   */
  private isCellCoveredByOtherQueen(
    board: Cell[][],
    r: number,
    c: number,
    excludeR: number,
    excludeC: number
  ): boolean {
    const targetReg = board[r][c].regionId;
    for (let row = 0; row < board.length; row++) {
      for (let col = 0; col < board.length; col++) {
        if (row === excludeR && col === excludeC) continue;
        if (board[row][col].mark === 'queen') {
          const isSameRow = row === r;
          const isSameCol = col === c;
          const isSameRegion = board[row][col].regionId === targetReg;
          const isAdjacent = Math.abs(row - r) <= 1 && Math.abs(col - c) <= 1;
          if (isSameRow || isSameCol || isSameRegion || isAdjacent) {
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * Live conflict evaluation and win detection
   */
  private updateConflictsAndCheckWin(): void {
    const b = this.board();
    const size = b.length;
    let hadConflict = false;

    const queens: CellCoord[] = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (b[r][c].mark === 'queen') {
          queens.push({ row: r, col: c });
        }
      }
    }

    const conflictCells = new Set<string>();
    const adjacentConflictCells = new Set<string>();

    for (let i = 0; i < queens.length; i++) {
      const q1 = queens[i];
      for (let j = i + 1; j < queens.length; j++) {
        const q2 = queens[j];
        const sameRow = q1.row === q2.row;
        const sameCol = q1.col === q2.col;
        const sameRegion = b[q1.row][q1.col].regionId === b[q2.row][q2.col].regionId;
        const isTouching = Math.abs(q1.row - q2.row) <= 1 && Math.abs(q1.col - q2.col) <= 1;

        if (sameRow || sameCol || sameRegion) {
          conflictCells.add(`${q1.row},${q1.col}`);
          conflictCells.add(`${q2.row},${q2.col}`);
          hadConflict = true;
        }

        if (isTouching) {
          adjacentConflictCells.add(`${q1.row},${q1.col}`);
          adjacentConflictCells.add(`${q2.row},${q2.col}`);
          hadConflict = true;
        }
      }
    }

    const updated = b.map((row) =>
      row.map((cell) => ({
        ...cell,
        isConflict: conflictCells.has(`${cell.row},${cell.col}`),
        isConflictAdjacent: adjacentConflictCells.has(`${cell.row},${cell.col}`)
      }))
    );

    this.board.set(updated);

    if (hadConflict) {
      this.audio.playConflict();
    }

    if (queens.length === size && conflictCells.size === 0 && adjacentConflictCells.size === 0) {
      this.triggerWin();
    }
  }

  private triggerWin(): void {
    if (this.isSolved() || this.isReviewMode()) return;
    this.isSolved.set(true);
    this.stopTimer();

    const p = this.puzzle();
    if (p) {
      const elapsed = this.elapsedSeconds();
      const isDaily = !!p.isDaily;
      const dateStr = p.dateStr || this.storage.getLocalDateString();

      let dailyRecord: CompletedDailyRecord | undefined;
      if (isDaily) {
        dailyRecord = {
          dateStr,
          puzzleId: p.id,
          seed: p.seed,
          regions: p.regions,
          marks: this.board().map((row) => row.map((c) => c.mark)),
          elapsedSeconds: elapsed,
          solution: p.solution,
          completedAt: new Date().toISOString()
        };
        this.isDailyCompletedToday.set(true);
        this.reviewCompletedTime.set(elapsed);
      }

      this.storage.recordWin(elapsed, isDaily, dateStr, dailyRecord);
      this.storage.saveCurrentGame(null);
    }

    this.audio.playVictory();
  }

  /**
   * Human-style hint: explains broken rules and dead ends, then the easiest logical next step.
   */
  requestHint(): void {
    if (this.isSolved() || this.isReviewMode()) return;
    if (this.hintCooldown() > 0) return;
    const hint = this.buildHint();
    if (hint) this.setHint(hint);
  }

  private buildHint(): HintResult | null {
    const puzzle = this.puzzle();
    const b = this.board();
    if (!puzzle || b.length === 0) return null;

    const conflict = this.conflictDetail();
    if (conflict && conflict.coords.length > 0) {
      return { type: 'conflict', title: 'A rule is broken', message: conflict.message, suggestedMark: 'x', coords: conflict.coords };
    }

    const key = (c: CellCoord) => `${c.row},${c.col}`;
    const solution = new Set(puzzle.solution.map(key));
    const queens: CellCoord[] = [];
    const crosses: CellCoord[] = [];
    for (const row of b) {
      for (const cell of row) {
        if (cell.mark === 'queen') queens.push({ row: cell.row, col: cell.col });
        if (cell.mark === 'x') crosses.push({ row: cell.row, col: cell.col });
      }
    }

    const wrongQueen = queens.find((q) => !solution.has(key(q)));
    if (wrongQueen) {
      const { message, focus } = explainDeadEnd(puzzle.regions, queens, wrongQueen);
      return { type: 'conflict', title: 'This queen leads to a dead end', message, suggestedMark: 'x', coords: [wrongQueen], focus };
    }

    const wrongCross = crosses.find((x) => solution.has(key(x)));
    if (wrongCross) {
      return {
        type: 'conflict',
        title: 'One X is in the way',
        message: `The X at ${cellName(wrongCross)} rules out a square the solution needs. Clear it, then keep going.`,
        suggestedMark: 'queen',
        coords: [wrongCross]
      };
    }

    for (const q of queens) {
      const blocked = b.flat().filter(
        (cell) =>
          cell.mark === 'empty' &&
          (cell.row === q.row ||
            cell.col === q.col ||
            cell.regionId === b[q.row][q.col].regionId ||
            (Math.abs(cell.row - q.row) <= 1 && Math.abs(cell.col - q.col) <= 1))
      );
      if (blocked.length > 0) {
        return {
          type: 'elimination',
          title: 'Already ruled out',
          message: `Your queen at ${cellName(q)} already rules out the highlighted squares: they share its row, column or color, or touch it. Mark them with X.`,
          suggestedMark: 'x',
          coords: blocked.map((cell) => ({ row: cell.row, col: cell.col })),
          focus: [q]
        };
      }
    }

    const logic = LogicBoard.create(puzzle.regions, queens, crosses);
    const step = findDeduction(logic);
    if (step) {
      return {
        type: step.place ? 'forced_queen' : 'elimination',
        title: step.title,
        message: step.message,
        suggestedMark: step.place ? 'queen' : 'x',
        coords: step.place ? [step.place] : step.eliminate,
        focus: step.focus
      };
    }

    return this.revealHint(logic, puzzle.solution);
  }

  /** Last resort when no deduction applies: point at the queen of the tightest color. */
  private revealHint(logic: LogicBoard, solution: CellCoord[]): HintResult | null {
    const n = logic.n;
    const open = Array.from({ length: n }, (_, g) => 2 * n + g)
      .filter((u) => !logic.isDone(u))
      .sort((a, b) => logic.openCells(a).length - logic.openCells(b).length);
    if (open.length === 0) return null;
    const region = open[0] - 2 * n;
    const target = solution.find((c) => this.board()[c.row][c.col].regionId === region);
    if (!target) return null;
    return {
      type: 'forced_queen',
      title: 'A nudge',
      message: `No quick deduction here. The ${REGION_NAMES[region]} region has ${logic.openCells(open[0]).length} spots left, and its queen belongs at ${cellName(target)}.`,
      suggestedMark: 'queen',
      coords: [target],
      focus: logic.coords(logic.unitCells(open[0]))
    };
  }

  private setHint(hint: HintResult): void {
    this.activeHint.set(hint);
    this.audio.playMarkX();

    // Start 10-second cooldown timer
    this.hintCooldown.set(10);
    if (this.cooldownInterval) clearInterval(this.cooldownInterval);
    this.cooldownInterval = setInterval(() => {
      this.hintCooldown.update((sec) => {
        if (sec <= 1) {
          clearInterval(this.cooldownInterval!);
          this.cooldownInterval = null;
          return 0;
        }
        return sec - 1;
      });
    }, 1000);
  }

  /** Pauses while the player is away; resumes only for a live, unsolved puzzle. */
  setTimerPaused(paused: boolean): void {
    if (paused) {
      if (!this.timerInterval) return;
      this.stopTimer();
      this.saveProgress();
    } else if (!this.timerInterval && this.puzzle() && !this.isSolved() && !this.isReviewMode()) {
      this.startTimer();
    }
  }

  private startTimer(): void {
    this.stopTimer();
    this.isTimerRunning.set(true);
    this.timerInterval = setInterval(() => {
      this.elapsedSeconds.update((s) => s + 1);
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.isTimerRunning.set(false);
  }

  private saveProgress(): void {
    const p = this.puzzle();
    if (!p || this.isSolved()) return;
    this.storage.saveCurrentGame({
      puzzleId: p.id,
      seed: p.seed,
      isDaily: !!p.isDaily,
      dateStr: p.dateStr || '',
      regions: p.regions,
      marks: this.board().map((row) => row.map((c) => c.mark)),
      elapsedSeconds: this.elapsedSeconds(),
      solution: p.solution
    });
  }
}
