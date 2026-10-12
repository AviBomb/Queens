import { Injectable, signal } from '@angular/core';
import {
  BOARD_SIZES,
  BoardSizeOption,
  GameStats,
  CellMark,
  DailyChallengeStats,
  CompletedDailyRecord,
  DAILIES_PER_FREEZE,
  MAX_STREAK_FREEZES
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

export type GameSlot = 'daily' | 'random';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private readonly STATS_KEY = 'queens_stats_v2';
  private readonly LEGACY_GAME_KEY = 'queens_current_game_v2';
  private readonly SLOT_KEYS: Record<GameSlot, string> = {
    daily: 'queens_game_daily_v3',
    random: 'queens_game_random_v3'
  };
  private readonly LAST_COMPLETED_KEY = 'queens_last_completed_v1';
  private readonly SEED_UNLOCK_SEEN_KEY = 'queens_seed_unlock_seen';
  private readonly THEME_KEY = 'queens_theme';
  private readonly SIZE_KEY = 'queens_size_pref';
  private readonly DAILY_PREFIX = 'queens_daily_completed_';
  /** Bumped on every stats write so computed() readers of getStats() refresh. */
  private readonly statsVersion = signal(0);

  constructor() {
    this.migrateLegacyGame();
  }

  getLocalDateString(date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /** The 'YYYY-MM-DD' that is `days` away from `dateStr`, in local time. */
  shiftDate(dateStr: string, days: number): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    return this.getLocalDateString(new Date(y, m - 1, d + days));
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
      lastCompletedDate: '',
      lastStreakDate: '',
      freezes: 0,
      frozenDates: []
    };

    try {
      const data = localStorage.getItem(this.STATS_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        const rawBest = parsed.bestTime;
        const validBest = typeof rawBest === 'number' && rawBest > 0 ? rawBest : null;

        const rawDailyBest = parsed.dailyStats?.bestTime;
        const validDailyBest = typeof rawDailyBest === 'number' && rawDailyBest > 0 ? rawDailyBest : null;

        const lastCompletedDate = parsed.dailyStats?.lastCompletedDate ?? parsed.lastPlayedDate ?? '';
        const rawFreezes = parsed.dailyStats?.freezes;
        const dailyStats: DailyChallengeStats = {
          completedCount: parsed.dailyStats?.completedCount ?? (parsed.gamesWon > 0 && parsed.lastPlayedDate ? 1 : 0),
          currentStreak: parsed.dailyStats?.currentStreak ?? parsed.currentStreak ?? 0,
          maxStreak: parsed.dailyStats?.maxStreak ?? parsed.maxStreak ?? 0,
          bestTime: validDailyBest,
          totalTime: parsed.dailyStats?.totalTime ?? 0,
          averageTime: parsed.dailyStats?.averageTime ?? null,
          lastCompletedDate,
          lastStreakDate: parsed.dailyStats?.lastStreakDate ?? lastCompletedDate,
          freezes: typeof rawFreezes === 'number' ? Math.min(MAX_STREAK_FREEZES, Math.max(0, rawFreezes)) : 0,
          frozenDates: Array.isArray(parsed.dailyStats?.frozenDates) ? parsed.dailyStats.frozenDates : []
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
          totalPlaySeconds: typeof parsed.totalPlaySeconds === 'number' ? parsed.totalPlaySeconds : 0,
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
      totalPlaySeconds: 0,
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

  addPlayTime(seconds: number): void {
    if (seconds <= 0) return;
    const stats = this.getStats();
    stats.totalPlaySeconds += seconds;
    this.saveStats(stats);
  }

  /**
   * Covers each missed day since the last streak day with a freeze, one freeze per day.
   * A frozen day still adds 1 to the streak. With no freeze left, the streak resets.
   */
  reconcileDailyStreak(today: string = this.getLocalDateString()): void {
    const stats = this.getStats();
    if (this.applyMissedDays(stats.dailyStats, today)) this.saveStats(stats);
  }

  private applyMissedDays(daily: DailyChallengeStats, today: string): boolean {
    if (daily.currentStreak === 0 || !daily.lastStreakDate) return false;
    let changed = false;
    let day = this.shiftDate(daily.lastStreakDate, 1);
    while (day < today) {
      changed = true;
      if (daily.freezes === 0) {
        daily.currentStreak = 0;
        break;
      }
      daily.freezes--;
      daily.currentStreak++;
      daily.frozenDates.push(day);
      daily.lastStreakDate = day;
      daily.maxStreak = Math.max(daily.maxStreak, daily.currentStreak);
      day = this.shiftDate(day, 1);
    }
    return changed;
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
      const daily = stats.dailyStats;
      daily.completedCount++;
      if (elapsedSeconds > 0) {
        daily.totalTime += elapsedSeconds;
        if (daily.bestTime === null || daily.bestTime <= 0 || elapsedSeconds < daily.bestTime) {
          daily.bestTime = elapsedSeconds;
        }
        daily.averageTime = Math.round(daily.totalTime / daily.completedCount);
      }

      this.applyMissedDays(daily, dateStr);
      if (daily.lastStreakDate === this.shiftDate(dateStr, -1)) {
        daily.currentStreak++;
      } else if (daily.lastStreakDate !== dateStr) {
        daily.currentStreak = 1;
      }
      daily.lastStreakDate = dateStr;
      daily.lastCompletedDate = dateStr;
      daily.maxStreak = Math.max(daily.maxStreak, daily.currentStreak);

      if (daily.completedCount % DAILIES_PER_FREEZE === 0 && daily.freezes < MAX_STREAK_FREEZES) {
        daily.freezes++;
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

  /** Every 'YYYY-MM-DD' with a solved daily on this device. */
  getCompletedDailyDates(): string[] {
    this.statsVersion();
    try {
      return Object.keys(localStorage)
        .filter((key) => key.startsWith(this.DAILY_PREFIX))
        .map((key) => key.slice(this.DAILY_PREFIX.length));
    } catch {
      return [];
    }
  }

  isDailyCompletedToday(): boolean {
    const todayStr = this.getLocalDateString();
    return !!this.getCompletedDaily(todayStr);
  }

  getTodayCompletedDaily(): CompletedDailyRecord | null {
    const todayStr = this.getLocalDateString();
    return this.getCompletedDaily(todayStr);
  }

  saveGame(slot: GameSlot, state: SavedGameState | null): void {
    this.writeJson(this.SLOT_KEYS[slot], state);
  }

  /** An unfinished daily only survives until midnight; yesterday's is dropped. */
  loadGame(slot: GameSlot): SavedGameState | null {
    const state = this.readJson<SavedGameState>(this.SLOT_KEYS[slot]);
    if (!state?.marks || !state.regions) return null;
    if (slot === 'daily' && state.dateStr !== this.getLocalDateString()) {
      this.saveGame('daily', null);
      return null;
    }
    return state;
  }

  saveLastCompleted(state: SavedGameState): void {
    this.writeJson(this.LAST_COMPLETED_KEY, state);
  }

  loadLastCompleted(): SavedGameState | null {
    const state = this.readJson<SavedGameState>(this.LAST_COMPLETED_KEY);
    return state?.marks && state.regions ? state : null;
  }

  isSeedUnlockAnnounced(): boolean {
    try {
      return localStorage.getItem(this.SEED_UNLOCK_SEEN_KEY) === 'true';
    } catch {
      return true;
    }
  }

  markSeedUnlockAnnounced(): void {
    try {
      localStorage.setItem(this.SEED_UNLOCK_SEEN_KEY, 'true');
    } catch {
      // Ignore
    }
  }

  /** Moves the single pre-v3 saved game into the daily or random slot. */
  private migrateLegacyGame(): void {
    const legacy = this.readJson<SavedGameState>(this.LEGACY_GAME_KEY);
    if (!legacy) return;
    const slot: GameSlot = legacy.isDaily ? 'daily' : 'random';
    if (!this.readJson(this.SLOT_KEYS[slot])) this.saveGame(slot, legacy);
    this.writeJson(this.LEGACY_GAME_KEY, null);
  }

  private readJson<T>(key: string): T | null {
    try {
      const data = localStorage.getItem(key);
      return data ? (JSON.parse(data) as T) : null;
    } catch {
      return null;
    }
  }

  private writeJson(key: string, value: unknown): void {
    try {
      if (value === null) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, JSON.stringify(value));
      }
    } catch {
      // Ignore storage errors
    }
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
