export type CellMark = 'empty' | 'x' | 'queen';

export interface CellCoord {
  row: number;
  col: number;
}

export const BOARD_SIZES = [7, 8, 9, 10] as const;
export type BoardSize = (typeof BOARD_SIZES)[number];
export type BoardSizeOption = 'mix' | BoardSize;

export interface Cell {
  row: number;
  col: number;
  regionId: number;
  mark: CellMark;
  isConflict: boolean;
  isConflictAdjacent: boolean;
  isHint: boolean;
  isLastPlaced: boolean;
  hintSuggestion?: 'x' | 'queen';
}

export interface Move {
  row: number;
  col: number;
  prevMark: CellMark;
  newMark: CellMark;
  autoXCells?: CellCoord[];
}

export interface PuzzleData {
  id: string;
  seed: number;
  size: number;
  regions: number[][]; // 8x8 array of region numbers 0..7
  solution: CellCoord[]; // 8 unique coordinates
  isDaily?: boolean;
  dateStr?: string;
}

export interface ConflictInfo {
  rowConflicts: Set<number>;
  colConflicts: Set<number>;
  regionConflicts: Set<number>;
  adjacentConflicts: Set<string>; // 'r,c'
}

export interface DailyChallengeStats {
  completedCount: number;
  currentStreak: number;
  maxStreak: number;
  bestTime: number | null; // in seconds
  totalTime: number; // in seconds
  averageTime: number | null; // in seconds
  lastCompletedDate: string; // 'YYYY-MM-DD'
}

export interface CompletedDailyRecord {
  dateStr: string; // 'YYYY-MM-DD'
  puzzleId: string;
  seed: number;
  regions: number[][];
  marks: CellMark[][];
  elapsedSeconds: number;
  solution: CellCoord[];
  completedAt: string;
}

export interface GameStats {
  gamesPlayed: number;
  gamesWon: number;
  currentStreak: number;
  maxStreak: number;
  bestTime: number | null; // in seconds
  totalWinTime: number; // in seconds
  averageTime: number | null; // in seconds
  recentTimes: number[];
  lastPlayedDate: string;
  dailyStats: DailyChallengeStats;
}

export interface GameSettings {
  autoX: boolean;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  darkMode: boolean;
  timerVisible: boolean;
}

export interface HintResult {
  type: 'conflict' | 'elimination' | 'forced_queen';
  title: string;
  message: string;
  suggestedMark: 'x' | 'queen';
  coords: CellCoord[];
  /** Cells that explain the hint (spotlighted on the board). */
  focus?: CellCoord[];
}
