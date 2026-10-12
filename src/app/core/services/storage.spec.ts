import { describe, it, expect, beforeEach } from 'vitest';
import { StorageService } from './storage.service';

describe('StorageService streaks and saved games', () => {
  let storage: StorageService;
  const day = (n: number) => storage.shiftDate('2026-01-01', n);

  beforeEach(() => {
    localStorage.clear();
    storage = new StorageService();
  });

  it('earns a freeze every 5 daily solves, capped at 2', () => {
    for (let i = 0; i < 5; i++) storage.recordWin(60, true, day(i));
    expect(storage.getStats().dailyStats.freezes).toBe(1);
    expect(storage.getStats().dailyStats.currentStreak).toBe(5);

    for (let i = 5; i < 15; i++) storage.recordWin(60, true, day(i));
    expect(storage.getStats().dailyStats.freezes).toBe(2);
  });

  it('spends a freeze on a missed day and still counts that day', () => {
    for (let i = 0; i < 5; i++) storage.recordWin(60, true, day(i));

    storage.reconcileDailyStreak(day(6));
    const daily = storage.getStats().dailyStats;
    expect(daily.currentStreak).toBe(6);
    expect(daily.freezes).toBe(0);
    expect(daily.frozenDates).toEqual([day(5)]);

    storage.recordWin(60, true, day(6));
    expect(storage.getStats().dailyStats.currentStreak).toBe(7);
  });

  it('resets the streak on a missed day with no freeze left', () => {
    storage.recordWin(60, true, day(0));
    storage.recordWin(60, true, day(1));

    storage.reconcileDailyStreak(day(3));
    expect(storage.getStats().dailyStats.currentStreak).toBe(0);

    storage.recordWin(60, true, day(3));
    expect(storage.getStats().dailyStats.currentStreak).toBe(1);
  });

  it('moves the old single saved game into its own slot', () => {
    const legacy = {
      puzzleId: '#1',
      seed: 1,
      isDaily: false,
      dateStr: '2026-01-01',
      regions: [[0]],
      marks: [['empty']],
      elapsedSeconds: 42
    };
    localStorage.setItem('queens_current_game_v2', JSON.stringify(legacy));

    const migrated = new StorageService();
    expect(migrated.loadGame('random')?.elapsedSeconds).toBe(42);
    expect(localStorage.getItem('queens_current_game_v2')).toBeNull();
  });
});
