import { describe, expect, it } from 'vitest';
import { assessPlan, dominantTilt, edgeSharpness, type GrayImage } from './planQuality.ts';

const W = 400;
const H = 300;

/** White sheet with a rectangle of thick black walls, optionally rotated. */
function plan(rotateDeg = 0): GrayImage {
  const data = new Uint8Array(W * H).fill(255);
  const a = (rotateDeg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // Rotate the sample point back around the center.
      const dx = x - W / 2;
      const dy = y - H / 2;
      const u = cos * dx + sin * dy + W / 2;
      const v = -sin * dx + cos * dy + H / 2;
      const inOuter = u > 60 && u < 340 && v > 50 && v < 250;
      const inInner = u > 70 && u < 330 && v > 60 && v < 240;
      const wall = inOuter && !inInner;
      const partition = u > 195 && u < 203 && v > 50 && v < 250;
      if (wall || partition) data[y * W + x] = 20;
    }
  }
  return { width: W, height: H, data };
}

/** Box blur with the given radius, like an out-of-focus photo. */
function blur(image: GrayImage, radius: number): GrayImage {
  const out = new Uint8Array(image.data.length);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let sum = 0;
      let n = 0;
      for (let j = -radius; j <= radius; j++) {
        for (let i = -radius; i <= radius; i++) {
          const xx = x + i;
          const yy = y + j;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          sum += image.data[yy * W + xx];
          n++;
        }
      }
      out[y * W + x] = Math.round(sum / n);
    }
  }
  return { width: W, height: H, data: out };
}

describe('plan quality', () => {
  it('accepts a clean, straight drawing', () => {
    const report = assessPlan(plan(), { width: 2000, height: 1500 });
    expect(report.level).toBe('ok');
    expect(report.checks.every((c) => c.ok)).toBe(true);
  });

  it('notices a blurred photo', () => {
    expect(edgeSharpness(plan())).toBeGreaterThan(0.8);
    const blurred = blur(plan(), 3);
    expect(edgeSharpness(blurred)).toBeLessThan(0.3);
    const report = assessPlan(blurred, { width: 2000, height: 1500 });
    expect(report.checks.find((c) => c.id === 'sharpness')!.ok).toBe(false);
    expect(report.level).toBe('warning');
  });

  it('measures the tilt of a rotated plan', () => {
    expect(dominantTilt(plan())).toBe(0);
    expect(dominantTilt(plan(4))).toBeCloseTo(4, 0);
    expect(dominantTilt(plan(-6))).toBeCloseTo(-6, 0);
    const report = assessPlan(plan(4), { width: 2000, height: 1500 });
    expect(report.checks.find((c) => c.id === 'tilt')!.detail).toMatch(/girado 4/);
  });

  it('rejects a blank page and warns about tiny images', () => {
    const blank = { width: W, height: H, data: new Uint8Array(W * H).fill(250) };
    expect(assessPlan(blank).level).toBe('bad');
    expect(assessPlan(plan(), { width: 320, height: 240 }).checks.find((c) => c.id === 'size')!.ok).toBe(false);
  });
});
