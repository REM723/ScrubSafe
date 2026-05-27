import { describe, it, expect } from 'vitest';
import { formatBytes, savingsPercent } from '$lib/utils/bytes';

describe('formatBytes', () => {
  it('formats zero bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('formats bytes', () => {
    expect(formatBytes(512)).toBe('512 B');
  });

  it('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1 KB');
  });

  it('formats megabytes', () => {
    expect(formatBytes(1024 * 1024)).toBe('1 MB');
  });

  it('formats with decimals', () => {
    expect(formatBytes(1500, 2)).toBe('1.46 KB');
  });
});

describe('savingsPercent', () => {
  it('calculates savings correctly', () => {
    expect(savingsPercent(1000, 800)).toBe(20);
  });

  it('returns 0 for zero original size', () => {
    expect(savingsPercent(0, 0)).toBe(0);
  });

  it('returns 100 for fully reduced', () => {
    expect(savingsPercent(1000, 0)).toBe(100);
  });
});
