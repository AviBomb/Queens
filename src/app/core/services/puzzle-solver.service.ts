import { Injectable } from '@angular/core';
import { CellCoord } from '../models/queens.model';

@Injectable({
  providedIn: 'root'
})
export class PuzzleSolverService {
  /**
   * Count solutions for an NxN regions grid.
   * If limit is specified (e.g. 2), stops early when solution count reaches limit.
   */
  countSolutions(regions: number[][], limit = 2): { count: number; solution?: CellCoord[] } {
    const solutions = this.findSolutions(regions, limit);
    return { count: solutions.length, solution: solutions[0] };
  }

  /** Returns up to `limit` distinct solutions. */
  findSolutions(regions: number[][], limit = 2): CellCoord[][] {
    const size = regions.length;
    const solutions: CellCoord[][] = [];

    const usedCols = new Array<boolean>(size).fill(false);
    const usedRegions = new Array<boolean>(size).fill(false);
    const queens: number[] = new Array<number>(size).fill(-1); // queens[row] = col

    const solveRow = (row: number) => {
      if (solutions.length >= limit) {
        return;
      }

      if (row === size) {
        solutions.push(queens.map((col, r) => ({ row: r, col })));
        return;
      }

      const prevCol = row > 0 ? queens[row - 1] : -99;

      for (let col = 0; col < size; col++) {
        // Rule 1: One queen per column
        if (usedCols[col]) continue;

        // Rule 2: One queen per color region
        const region = regions[row][col];
        if (usedRegions[region]) continue;

        // Rule 3: No two queens can touch (even diagonally)
        // Since we place row-by-row, only row - 1 can be adjacent to row
        if (Math.abs(col - prevCol) <= 1) continue;

        // Candidate is valid; backtrack
        usedCols[col] = true;
        usedRegions[region] = true;
        queens[row] = col;

        solveRow(row + 1);

        // Reset
        queens[row] = -1;
        usedRegions[region] = false;
        usedCols[col] = false;
      }
    };

    solveRow(0);
    return solutions;
  }

  /**
   * Checks if an entire board state of placed queens is completely valid and complete.
   */
  isValidPlacement(queens: CellCoord[], regions: number[][], size = 8): { valid: boolean; error?: string } {
    if (queens.length !== size) {
      return { valid: false, error: `Must place exactly ${size} queens.` };
    }

    const rows = new Set<number>();
    const cols = new Set<number>();
    const colorRegions = new Set<number>();

    for (let i = 0; i < queens.length; i++) {
      const q1 = queens[i];
      if (rows.has(q1.row)) return { valid: false, error: `Multiple queens in row ${q1.row + 1}.` };
      if (cols.has(q1.col)) return { valid: false, error: `Multiple queens in column ${q1.col + 1}.` };
      const reg = regions[q1.row][q1.col];
      if (colorRegions.has(reg)) return { valid: false, error: `Multiple queens in color region ${reg + 1}.` };

      rows.add(q1.row);
      cols.add(q1.col);
      colorRegions.add(reg);

      // Check adjacency against other queens
      for (let j = i + 1; j < queens.length; j++) {
        const q2 = queens[j];
        if (Math.abs(q1.row - q2.row) <= 1 && Math.abs(q1.col - q2.col) <= 1) {
          return { valid: false, error: `Queens at (${q1.row + 1},${q1.col + 1}) and (${q2.row + 1},${q2.col + 1}) touch!` };
        }
      }
    }

    return { valid: true };
  }
}
