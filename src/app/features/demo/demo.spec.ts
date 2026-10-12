import { describe, it, expect } from 'vitest';
import { PuzzleSolverService } from '../../core/services/puzzle-solver.service';
import { DEMO_REGIONS } from './demo.component';

describe('Demo board', () => {
  it('has exactly one solution, the one the guided steps teach', () => {
    const { count, solution } = new PuzzleSolverService().countSolutions(DEMO_REGIONS);
    expect(count).toBe(1);
    expect(solution).toEqual([
      { row: 0, col: 1 },
      { row: 1, col: 3 },
      { row: 2, col: 0 },
      { row: 3, col: 2 },
      { row: 4, col: 4 }
    ]);
  });
});
