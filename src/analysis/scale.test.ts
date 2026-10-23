import { describe, expect, it } from 'vitest';
import { adjustScale, metersPerPixel, scaleDenominator } from './scale.ts';

describe('plan scale', () => {
  it('reads scales written in different ways', () => {
    expect(scaleDenominator('1:100')).toBe(100);
    expect(scaleDenominator(' 1 : 50 ')).toBe(50);
    expect(scaleDenominator('1:12,5')).toBe(12.5);
  });

  it('rejects scales that are not 1:N', () => {
    expect(() => scaleDenominator('100')).toThrow('no es válida');
    expect(() => scaleDenominator('1:0')).toThrow();
    expect(() => scaleDenominator('2:100')).toThrow();
  });

  it('converts pixels to meters for a plan scanned at 150 dpi', () => {
    // 1:100 at 150 dpi: one pixel is 16.93 mm in reality.
    expect(metersPerPixel('1:100')).toBeCloseTo(0.01693, 5);
  });

  it('adjusts the scale when the image is reduced', () => {
    expect(adjustScale('1:100', 1)).toBe('1:100');
    expect(adjustScale('1:100', 0.5)).toBe('1:200');
  });
});
