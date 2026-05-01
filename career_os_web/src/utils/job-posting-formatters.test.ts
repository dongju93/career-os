import { describe, expect, it } from 'vitest';
import { formatRelativeDate, platformVariant } from './job-posting-formatters';

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

describe('formatRelativeDate', () => {
  it('returns "오늘" for a timestamp from today', () => {
    expect(formatRelativeDate(daysAgoIso(0))).toBe('오늘');
  });

  it('returns "어제" for a timestamp from yesterday', () => {
    expect(formatRelativeDate(daysAgoIso(1))).toBe('어제');
  });

  it('returns "N일 전" for 2 to 6 days ago', () => {
    expect(formatRelativeDate(daysAgoIso(3))).toBe('3일 전');
    expect(formatRelativeDate(daysAgoIso(6))).toBe('6일 전');
  });

  it('returns "N주 전" for 7 to 29 days ago', () => {
    expect(formatRelativeDate(daysAgoIso(7))).toBe('1주 전');
    expect(formatRelativeDate(daysAgoIso(14))).toBe('2주 전');
    expect(formatRelativeDate(daysAgoIso(21))).toBe('3주 전');
    expect(formatRelativeDate(daysAgoIso(28))).toBe('4주 전');
  });

  it('returns a formatted date string for 30 or more days ago', () => {
    const result = formatRelativeDate(daysAgoIso(45));
    expect(result).not.toMatch(/전$/);
    expect(result).not.toBe('오늘');
    expect(result).not.toBe('어제');
    // Korean locale date: should contain a digit
    expect(result).toMatch(/\d/);
  });
});

describe('platformVariant', () => {
  it('returns "saramin" for the saramin platform', () => {
    expect(platformVariant('saramin')).toBe('saramin');
  });

  it('returns "wanted" for the wanted platform', () => {
    expect(platformVariant('wanted')).toBe('wanted');
  });
});
