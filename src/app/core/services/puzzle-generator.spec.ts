import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { PuzzleGeneratorService } from './puzzle-generator.service';
import { PuzzleSolverService } from './puzzle-solver.service';
import { BOARD_SIZES, PuzzleData } from '../models/queens.model';

/** Same layout up to rotation, reflection and recoloring gets the same key. */
function canonicalKey(regions: number[][]): string {
  const n = regions.length;
  const transforms: ((r: number, c: number) => [number, number])[] = [
    (r, c) => [r, c],
    (r, c) => [c, n - 1 - r],
    (r, c) => [n - 1 - r, n - 1 - c],
    (r, c) => [n - 1 - c, r],
    (r, c) => [r, n - 1 - c],
    (r, c) => [n - 1 - r, c],
    (r, c) => [c, r],
    (r, c) => [n - 1 - c, n - 1 - r]
  ];
  const keys = transforms.map((t) => {
    const grid = Array.from({ length: n }, () => new Array<number>(n));
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const [nr, nc] = t(r, c);
        grid[nr][nc] = regions[r][c];
      }
    }
    const relabel = new Map<number, number>();
    return grid
      .flat()
      .map((g) => {
        if (!relabel.has(g)) relabel.set(g, relabel.size);
        return relabel.get(g);
      })
      .join(',');
  });
  return keys.sort((a, b) => a.localeCompare(b))[0];
}

describe('PuzzleGenerator & PuzzleSolver', () => {
  let generator: PuzzleGeneratorService;
  let solver: PuzzleSolverService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PuzzleGeneratorService, PuzzleSolverService]
    });
    generator = TestBed.inject(PuzzleGeneratorService);
    solver = TestBed.inject(PuzzleSolverService);
  });

  function expectValidPuzzle(puzzle: PuzzleData, size: number): void {
    expect(puzzle.size).toBe(size);
    expect(puzzle.regions.length).toBe(size);
    expect(puzzle.regions.every((row) => row.length === size)).toBe(true);
    expect(new Set(puzzle.regions.flat()).size).toBe(size);
    expect(generator.areAllRegionsConnected(puzzle.regions)).toBe(true);
    expect(solver.countSolutions(puzzle.regions, 2).count).toBe(1);
    expect(solver.isValidPlacement(puzzle.solution, puzzle.regions, size).valid).toBe(true);
  }

  it('should generate a valid 8x8 puzzle with exactly 1 unique solution', () => {
    expectValidPuzzle(generator.generatePuzzle(12345), 8);
  });

  it('keeps legacy and daily seeds on 8x8', () => {
    expect(generator.sizeForSeed(637438)).toBe(8);
    expect(generator.sizeForSeed(20261004)).toBe(8);
    expect(generator.generateDailyPuzzle(new Date(2026, 9, 4)).size).toBe(8);
  });

  for (const size of BOARD_SIZES) {
    it(`generates valid ${size}x${size} puzzles with ${size} connected colors and one solution`, () => {
      for (let i = 0; i < 6; i++) {
        const seed = generator.createSeed(size);
        expect(generator.sizeForSeed(seed)).toBe(size);
        expectValidPuzzle(generator.generatePuzzle(seed), size);
      }
    });
  }

  it('is reproducible: the same seed gives the same puzzle', () => {
    const seed = generator.createSeed(9);
    expect(generator.generatePuzzle(seed).regions).toEqual(generator.generatePuzzle(seed).regions);
  });

  it('never repeats a layout, even rotated, mirrored or recolored', () => {
    const keys = new Set<string>();
    const total = 80;
    for (let i = 0; i < total; i++) {
      keys.add(canonicalKey(generator.generatePuzzle(generator.createSeed(8)).regions));
    }
    expect(keys.size).toBe(total);
  });

  it('generates each size fast enough to feel instant', () => {
    for (const size of BOARD_SIZES) {
      const start = performance.now();
      const runs = 5;
      for (let i = 0; i < runs; i++) generator.generatePuzzle(generator.createSeed(size));
      const avg = (performance.now() - start) / runs;
      console.log(`${size}x${size}: ${avg.toFixed(1)} ms average`);
      expect(avg).toBeLessThan(400);
    }
  });
});
