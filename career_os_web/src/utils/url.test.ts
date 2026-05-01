import { describe, expect, it } from 'vitest';
import { toSafeExternalUrl } from './url';

describe('toSafeExternalUrl', () => {
  it('returns https URLs unchanged', () => {
    expect(toSafeExternalUrl('https://example.com/path')).toBe(
      'https://example.com/path',
    );
  });

  it('returns http URLs unchanged', () => {
    expect(toSafeExternalUrl('http://example.com')).toBe('http://example.com');
  });

  it('returns null for javascript: protocol', () => {
    expect(toSafeExternalUrl('javascript:alert(1)')).toBeNull();
  });

  it('returns null for ftp: protocol', () => {
    expect(toSafeExternalUrl('ftp://files.example.com')).toBeNull();
  });

  it('returns null for a string that is not a valid URL', () => {
    expect(toSafeExternalUrl('not-a-url')).toBeNull();
    expect(toSafeExternalUrl('just text')).toBeNull();
  });

  it('returns null for null', () => {
    expect(toSafeExternalUrl(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(toSafeExternalUrl(undefined)).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(toSafeExternalUrl('')).toBeNull();
  });
});
