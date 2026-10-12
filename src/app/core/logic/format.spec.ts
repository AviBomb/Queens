import { describe, it, expect } from 'vitest';
import { formatClock, formatCountdown, formatDuration, msUntilNextMidnight } from './format';

describe('format', () => {
  it('spells out solve times', () => {
    expect(formatDuration(1)).toBe('1 second');
    expect(formatDuration(39)).toBe('39 seconds');
    expect(formatDuration(120)).toBe('2 minutes');
    expect(formatDuration(134)).toBe('2 minutes 14 seconds');
    expect(formatDuration(3720)).toBe('1 hour 2 minutes');
  });

  it('formats the clock and the next-puzzle countdown', () => {
    expect(formatClock(134)).toBe('2:14');
    expect(formatCountdown(18_723_000)).toBe('5h 12m 03s');
    expect(msUntilNextMidnight(new Date(2026, 0, 1, 23, 0, 0))).toBe(3_600_000);
  });
});
