import { describe, expect, it } from 'vitest';
import {
  formatLocalDateInputValue,
  parseLocalDateInputValue,
} from './local-date';

describe('formatLocalDateInputValue', () => {
  it('formats local calendar fields instead of UTC calendar fields', () => {
    const localEveningBeforeUtcRollover = {
      getFullYear: () => 2026,
      getMonth: () => 0,
      getDate: () => 1,
      toISOString: () => '2026-01-02T04:30:00.000Z',
    } as Date;

    expect(formatLocalDateInputValue(localEveningBeforeUtcRollover)).toBe(
      '2026-01-01',
    );
  });

  it('pads month and day for date input values', () => {
    const singleDigitMonthAndDay = {
      getFullYear: () => 2026,
      getMonth: () => 4,
      getDate: () => 6,
    } as Date;

    expect(formatLocalDateInputValue(singleDigitMonthAndDay)).toBe(
      '2026-05-06',
    );
  });
});

describe('parseLocalDateInputValue', () => {
  it('parses date input values as local calendar dates', () => {
    const date = parseLocalDateInputValue('2026-05-06');

    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(4);
    expect(date.getDate()).toBe(6);
    expect(date.getHours()).toBe(0);
  });
});
