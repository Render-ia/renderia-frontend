import { describe, expect, it } from 'vitest';
import { cameraPose, captureSize, colorFor, disciplineOf, FINISHES, isFinish } from './studio.ts';

describe('3D studio presets', () => {
  it('places each facade camera on its own side, looking at the center', () => {
    expect(cameraPose('front', 12, 8).position[2]).toBeGreaterThan(4);
    expect(cameraPose('back', 12, 8).position[2]).toBeLessThan(-4);
    expect(cameraPose('left', 12, 8).position[0]).toBeLessThan(-6);
    expect(cameraPose('right', 12, 8).position[0]).toBeGreaterThan(6);
    expect(cameraPose('top', 12, 8).position[1]).toBeGreaterThan(15);
  });

  it('moves the camera back on narrow screens', () => {
    expect(cameraPose('iso', 10, 10, 0.5).position[0]).toBeGreaterThan(cameraPose('iso', 10, 10, 1.6).position[0]);
  });

  it('backs away and aims higher for tall buildings', () => {
    const low = cameraPose('iso', 24, 16, 1.6, 3);
    const tower = cameraPose('iso', 24, 16, 1.6, 36);
    expect(tower.position[1]).toBeGreaterThan(low.position[1]);
    expect(tower.target[1]).toBeGreaterThan(low.target[1]);
  });

  it('groups types in disciplines', () => {
    expect(disciplineOf('Muro')).toBe('architecture');
    expect(disciplineOf('Viga')).toBe('structure');
    expect(disciplineOf('Ascensor')).toBe('structure');
    expect(disciplineOf('Rampa')).toBe('other');
  });

  it('colors by finish without depending on geometry', () => {
    expect(isFinish('tropical')).toBe(true);
    expect(isFinish('type')).toBe(false);
    expect(colorFor('tropical', 'Muro', null)).toBe(FINISHES[1].colors.Muro);
    expect(colorFor('material', 'Muro', 'Ladrillo')).toBe('#b0613e');
  });

  it('scales captures to a 4K long side keeping the aspect', () => {
    expect(captureSize(1200, 600)).toEqual({ width: 3840, height: 1920, scale: 3.2 });
  });
});
