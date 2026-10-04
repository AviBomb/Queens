import { inject, Injectable } from '@angular/core';
import { BOARD_SIZES, BoardSize, CellCoord, PuzzleData } from '../models/queens.model';
import { PuzzleSolverService } from './puzzle-solver.service';
import { solveWithLogic } from '../logic/queens-logic';

/**
 * Fast Mulberry32 pseudo-random number generator
 */
export class PRNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
    if (this.state === 0) {
      this.state = 1337;
    }
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  shuffle<T>(array: T[]): T[] {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
}

/**
 * Seeds encode the board size: size * SEED_SPAN + n (e.g. 912345678 is a 9x9).
 * Anything outside 7..10 * SEED_SPAN (old seeds, daily YYYYMMDD seeds) is 8x8.
 */
const SEED_SPAN = 100_000_000;
const ORTHOGONAL = [
  [0, 1],
  [0, -1],
  [1, 0],
  [-1, 0]
];
/** Attempts that must also pass the no-guessing logic check before we accept any unique board. */
const LOGIC_ATTEMPTS = 60;

@Injectable({
  providedIn: 'root'
})
export class PuzzleGeneratorService {
  private readonly solver = inject(PuzzleSolverService);

  sizeForSeed(seed: number): BoardSize {
    const size = Math.floor(seed / SEED_SPAN);
    return BOARD_SIZES.find((s) => s === size) ?? 8;
  }

  createSeed(size: BoardSize): number {
    return size * SEED_SPAN + Math.floor(Math.random() * SEED_SPAN);
  }

  /**
   * Generates a fresh NxN Queens puzzle with N connected color regions and
   * exactly one solution. The same seed always yields the same puzzle.
   */
  generatePuzzle(seed?: number, isDaily = false): PuzzleData {
    const puzzleSeed = seed ?? this.createSeed(8);
    const size = this.sizeForSeed(puzzleSeed);
    const { regions, solution } = this.buildBoard(size, new PRNG(puzzleSeed));

    return {
      id: isDaily ? `Daily ${this.getLocalDateString()}` : `#${puzzleSeed}`,
      seed: puzzleSeed,
      size,
      regions,
      solution,
      isDaily,
      dateStr: this.getLocalDateString()
    };
  }

  /**
   * Generates the puzzle for today's daily challenge using local midnight clock date.
   */
  generateDailyPuzzle(date: Date = new Date()): PuzzleData {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    const seed = Number.parseInt(`${year}${month}${day}`, 10);
    const puzzle = this.generatePuzzle(seed, true);
    puzzle.dateStr = dateStr;
    puzzle.id = `Daily ${dateStr}`;
    return puzzle;
  }

  private getLocalDateString(date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private buildBoard(size: number, prng: PRNG): { regions: number[][]; solution: CellCoord[] } {
    let fallback: { regions: number[][]; solution: CellCoord[] } | null = null;

    for (let attempt = 0; ; attempt++) {
      const solution = this.randomPlacement(size, prng);
      const regions = this.growRegions(size, solution, prng);
      if (!this.makeUnique(regions, solution, prng)) continue;
      if (this.singleCellRegions(regions) > 1) continue;
      if (solveWithLogic(regions)) return { regions, solution };
      fallback ??= { regions, solution };
      if (attempt >= LOGIC_ATTEMPTS) return fallback;
    }
  }

  /** One queen per row and column, none touching, columns chosen at random. */
  private randomPlacement(size: number, prng: PRNG): CellCoord[] {
    const cols: number[] = [];
    const used = new Array<boolean>(size).fill(false);

    const place = (row: number): boolean => {
      if (row === size) return true;
      for (const col of prng.shuffle(Array.from({ length: size }, (_, i) => i))) {
        if (used[col] || (row > 0 && Math.abs(col - cols[row - 1]) <= 1)) continue;
        used[col] = true;
        cols[row] = col;
        if (place(row + 1)) return true;
        used[col] = false;
      }
      return false;
    };

    place(0);
    return cols.map((col, row) => ({ row, col }));
  }

  /**
   * Grows one region from each queen by repeatedly claiming a random
   * neighboring cell. Per-region weights vary the region sizes.
   */
  private growRegions(size: number, solution: CellCoord[], prng: PRNG): number[][] {
    const grid = Array.from({ length: size }, () => new Array<number>(size).fill(-1));
    const weight = solution.map(() => 0.35 + prng.next() * 2.4);
    solution.forEach((q, i) => (grid[q.row][q.col] = i));

    for (let left = size * size - size; left > 0; left--) {
      const options: { r: number; c: number; region: number; w: number }[] = [];
      let total = 0;
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (grid[r][c] !== -1) continue;
          const seen = new Set<number>();
          for (const [dr, dc] of ORTHOGONAL) {
            const region = grid[r + dr]?.[c + dc];
            if (region === undefined || region === -1 || seen.has(region)) continue;
            seen.add(region);
            total += weight[region];
            options.push({ r, c, region, w: weight[region] });
          }
        }
      }

      let pick = prng.next() * total;
      const chosen = options.find((o) => (pick -= o.w) <= 0) ?? options[options.length - 1];
      grid[chosen.r][chosen.c] = chosen.region;
    }
    return grid;
  }

  /**
   * Repairs the regions until `solution` is the only solution, by moving a
   * cell of each rival solution into a neighboring region (which then holds
   * two of the rival's queens).
   */
  private makeUnique(regions: number[][], solution: CellCoord[], prng: PRNG): boolean {
    const size = regions.length;
    const key = (cells: CellCoord[]) => cells.map((c) => `${c.row},${c.col}`).join('|');
    const target = key(solution);
    const queenCells = new Set(solution.map((c) => `${c.row},${c.col}`));

    for (let i = 0; i < 6 * size; i++) {
      const rival = this.solver.findSolutions(regions, 2).find((s) => key(s) !== target);
      if (!rival) return true;

      const movable = prng.shuffle(rival.filter((c) => !queenCells.has(`${c.row},${c.col}`)));
      if (!movable.some((cell) => this.moveCellToNeighbor(regions, cell, prng))) return false;
    }
    return false;
  }

  private moveCellToNeighbor(regions: number[][], cell: CellCoord, prng: PRNG): boolean {
    const from = regions[cell.row][cell.col];
    for (const [dr, dc] of prng.shuffle(ORTHOGONAL)) {
      const to = regions[cell.row + dr]?.[cell.col + dc];
      if (to === undefined || to === from) continue;
      regions[cell.row][cell.col] = to;
      if (this.isRegionConnected(regions, from)) return true;
      regions[cell.row][cell.col] = from;
    }
    return false;
  }

  private singleCellRegions(regions: number[][]): number {
    const counts = new Array<number>(regions.length).fill(0);
    for (const row of regions) for (const g of row) counts[g]++;
    return counts.filter((c) => c === 1).length;
  }

  /**
   * Checks whether all specified region IDs (default: every region) are orthogonally connected.
   */
  areAllRegionsConnected(grid: number[][], regionIds: number[] = Array.from({ length: grid.length }, (_, i) => i)): boolean {
    return regionIds.every((regId) => this.isRegionConnected(grid, regId));
  }

  private isRegionConnected(grid: number[][], regId: number): boolean {
    const size = grid.length;
    let start = -1;
    let totalCells = 0;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (grid[r][c] !== regId) continue;
        totalCells++;
        if (start === -1) start = r * size + c;
      }
    }
    if (totalCells === 0) return false;

    const visited = new Uint8Array(size * size);
    const queue = [start];
    visited[start] = 1;
    let reached = 0;
    while (queue.length > 0) {
      const idx = queue.pop() as number;
      reached++;
      const r = Math.floor(idx / size);
      const c = idx % size;
      for (const [dr, dc] of ORTHOGONAL) {
        const nr = r + dr;
        const nc = c + dc;
        const next = nr * size + nc;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size && grid[nr][nc] === regId && !visited[next]) {
          visited[next] = 1;
          queue.push(next);
        }
      }
    }
    return reached === totalCells;
  }
}
