import { Injectable, signal } from '@angular/core';
import {
  BOARD_SIZES,
  BoardSizeOption,
  GameStats,
  CellMark,
  DailyChallengeStats,
  CompletedDailyRecord
} from '../models/queens.model';

export interface SavedGameState {
  puzzleId: string;
  seed: number;
  isDaily: boolean;
  dateStr: string;
  regions: number[][];
  marks: CellMark[][];
  elapsedSeconds: number;
  solution?: { row: number; col: number }[];
}

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private readonly STATS_KEY = 'queens_stats_v2';
  private readonly GAME_STATE_KEY = 'queens_current_game_v2';
  private readonly THEME_KEY = 'queens_theme';
  private readonly SIZE_KEY = 'queens_size_pref';
  private readonly DAILY_PREFIX = 'queens_daily_completed_';
  /** Bumped on every stats write so computed() readers of getStats() refresh. */
  private readonly statsVersion = signal(0);

  getLocalDateString(date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  getStats(): GameStats {
    this.statsVersion();
    const defaultDaily: DailyChallengeStats = {
      completedCount: 0,
      currentStreak: 0,
      maxStreak: 0,
      bestTime: null,
      totalTime: 0,
      averageTime: null,
      lastCompletedDate: ''
    };

    try {
      const data = localStorage.getItem(this.STATS_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        const rawBest = parsed.bestTime;
        const validBest = typeof rawBest === 'number' && rawBest > 0 ? rawBest : null;

        const rawDailyBest = parsed.dailyStats?.bestTime;
        const validDailyBest = typeof rawDailyBest === 'number' && rawDailyBest > 0 ? rawDailyBest : null;

        const dailyStats: DailyChallengeStats = {
          completedCount: parsed.dailyStats?.completedCount ?? (parsed.gamesWon > 0 && parsed.lastPlayedDate ? 1 : 0),
          currentStreak: parsed.dailyStats?.currentStreak ?? parsed.currentStreak ?? 0,
          maxStreak: parsed.dailyStats?.maxStreak ?? parsed.maxStreak ?? 0,
          bestTime: validDailyBest,
          totalTime: parsed.dailyStats?.totalTime ?? 0,
          averageTime: parsed.dailyStats?.averageTime ?? null,
          lastCompletedDate: parsed.dailyStats?.lastCompletedDate ?? parsed.lastPlayedDate ?? ''
        };

        return {
          gamesPlayed: parsed.gamesPlayed || 0,
          gamesWon: parsed.gamesWon || 0,
          currentStreak: parsed.currentStreak || 0,
          maxStreak: parsed.maxStreak || 0,
          bestTime: validBest,
          totalWinTime: parsed.totalWinTime || 0,
          averageTime:
            parsed.averageTime !== undefined && parsed.averageTime > 0
              ? parsed.averageTime
              : parsed.gamesWon > 0 && parsed.totalWinTime
              ? Math.round(parsed.totalWinTime / parsed.gamesWon)
              : null,
          recentTimes: parsed.recentTimes ? parsed.recentTimes.filter((t: number) => t > 0) : [],
          lastPlayedDate: parsed.lastPlayedDate || '',
          dailyStats
        };
      }
    } catch {
      // Fallback
    }

    return {
      gamesPlayed: 0,
      gamesWon: 0,
      currentStreak: 0,
      maxStreak: 0,
      bestTime: null,
      totalWinTime: 0,
      averageTime: null,
      recentTimes: [],
      lastPlayedDate: '',
      dailyStats: defaultDaily
    };
  }

  saveStats(stats: GameStats): void {
    try {
      localStorage.setItem(this.STATS_KEY, JSON.stringify(stats));
    } catch {
      // Ignore storage errors
    }
    this.statsVersion.update((v) => v + 1);
  }

  /** Clears all stats and the record of solved daily challenges on this device. */
  resetStats(): void {
    try {
      localStorage.removeItem(this.STATS_KEY);
      Object.keys(localStorage)
        .filter((key) => key.startsWith(this.DAILY_PREFIX))
        .forEach((key) => localStorage.removeItem(key));
    } catch {
      // Ignore storage errors
    }
    this.statsVersion.update((v) => v + 1);
  }

  recordGameStarted(): void {
    const stats = this.getStats();
    stats.gamesPlayed++;
    this.saveStats(stats);
  }

  recordWin(
    elapsedSeconds: number,
    isDaily: boolean = false,
    dateStr: string = this.getLocalDateString(),
    dailyRecord?: CompletedDailyRecord
  ): GameStats {
    const stats = this.getStats();
    stats.gamesWon++;
    if (stats.gamesPlayed < stats.gamesWon) {
      stats.gamesPlayed = stats.gamesWon;
    }

    // Best Time (strictly positive)
    if (elapsedSeconds > 0) {
      if (stats.bestTime === null || stats.bestTime <= 0 || elapsedSeconds < stats.bestTime) {
        stats.bestTime = elapsedSeconds;
      }
      stats.totalWinTime += elapsedSeconds;
      stats.averageTime = Math.round(stats.totalWinTime / stats.gamesWon);

      stats.recentTimes.unshift(elapsedSeconds);
      if (stats.recentTimes.length > 10) {
        stats.recentTimes.pop();
      }
    }

    // General overall streak
    stats.currentStreak++;
    if (stats.currentStreak > stats.maxStreak) {
      stats.maxStreak = stats.currentStreak;
    }

    // Daily Challenge Tracking (Separately managed!)
    if (isDaily) {
      stats.dailyStats.completedCount++;
      if (elapsedSeconds > 0) {
        stats.dailyStats.totalTime += elapsedSeconds;
        if (
          stats.dailyStats.bestTime === null ||
          stats.dailyStats.bestTime <= 0 ||
          elapsedSeconds < stats.dailyStats.bestTime
        ) {
          stats.dailyStats.bestTime = elapsedSeconds;
        }
        stats.dailyStats.averageTime = Math.round(
          stats.dailyStats.totalTime / stats.dailyStats.completedCount
        );
      }

      // Check consecutive days for Daily Streak
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = this.getLocalDateString(yesterday);

      if (stats.dailyStats.lastCompletedDate === yesterdayStr) {
        stats.dailyStats.currentStreak++;
      } else if (stats.dailyStats.lastCompletedDate !== dateStr) {
        stats.dailyStats.currentStreak = 1;
      }
      stats.dailyStats.lastCompletedDate = dateStr;

      if (stats.dailyStats.currentStreak > stats.dailyStats.maxStreak) {
        stats.dailyStats.maxStreak = stats.dailyStats.currentStreak;
      }

      stats.lastPlayedDate = dateStr;

      if (dailyRecord) {
        this.saveCompletedDaily(dateStr, dailyRecord);
      }
    }

    this.saveStats(stats);
    return stats;
  }

  saveCompletedDaily(dateStr: string, record: CompletedDailyRecord): void {
    try {
      localStorage.setItem(`${this.DAILY_PREFIX}${dateStr}`, JSON.stringify(record));
    } catch {
      // Ignore
    }
    this.statsVersion.update((v) => v + 1);
  }

  getCompletedDaily(dateStr: string): CompletedDailyRecord | null {
    this.statsVersion();
    try {
      const data = localStorage.getItem(`${this.DAILY_PREFIX}${dateStr}`);
      if (data) return JSON.parse(data);
    } catch {
      // Ignore
    }
    return null;
  }

  isDailyCompletedToday(): boolean {
    const todayStr = this.getLocalDateString();
    return !!this.getCompletedDaily(todayStr);
  }

  getTodayCompletedDaily(): CompletedDailyRecord | null {
    const todayStr = this.getLocalDateString();
    return this.getCompletedDaily(todayStr);
  }

  saveCurrentGame(state: SavedGameState | null): void {
    try {
      if (state) {
        localStorage.setItem(this.GAME_STATE_KEY, JSON.stringify(state));
      } else {
        localStorage.removeItem(this.GAME_STATE_KEY);
      }
    } catch {
      // Ignore
    }
  }

  loadCurrentGame(): SavedGameState | null {
    try {
      const data = localStorage.getItem(this.GAME_STATE_KEY);
      if (data) return JSON.parse(data);
    } catch {
      // Ignore
    }
    return null;
  }

  getTheme(): 'dark' | 'light' {
    const saved = localStorage.getItem(this.THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }

  saveTheme(theme: 'dark' | 'light'): void {
    localStorage.setItem(this.THEME_KEY, theme);
  }

  getSizePreference(): BoardSizeOption {
    const saved = localStorage.getItem(this.SIZE_KEY);
    return BOARD_SIZES.find((s) => String(s) === saved) ?? 'mix';
  }

  saveSizePreference(option: BoardSizeOption): void {
    localStorage.setItem(this.SIZE_KEY, String(option));
  }
}
