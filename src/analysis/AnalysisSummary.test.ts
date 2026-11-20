import { describe, expect, it } from 'vitest';
import { confirmAssumption, parseMeters, parseSummary, pendingAssumptions } from './AnalysisSummary.ts';
import { confidenceLevel, countByLevel } from './confidence.ts';

describe('analysis summary', () => {
  it('reads what Gemini + geometry reports', () => {
    const summary = parseSummary(
      JSON.stringify({
        warnings: ['Revisa las puertas', 3],
        assumptions: [{ key: 'wallHeight', label: 'Altura de muros', value: '2.5 m', source: 'assumed' }, { key: 'scale', label: 'Escala', value: '1:100', source: 'detected' }],
        rooms: [{ name: 'Sala', x1: 0, y1: 0, x2: 4, y2: 3, areaM2: 12, confidence: 0.8 }, { name: 'rota' }],
        dimensions: [{ text: '4.50', meters: 4.5 }],
      }),
      '1:100',
    );
    expect(summary.warnings).toEqual(['Revisa las puertas']);
    expect(summary.rooms).toHaveLength(1);
    expect(pendingAssumptions(summary)).toBe(1);
  });

  it('gives older analyses the default assumptions with the plan scale', () => {
    const summary = parseSummary('no es json', '1:75');
    expect(summary.assumptions.find((a) => a.key === 'scale')!.value).toBe('1:75');
    expect(pendingAssumptions(summary)).toBe(5);
  });

  it('confirms an assumption, optionally with a new value', () => {
    const summary = confirmAssumption(parseSummary(null, '1:100'), 'wallHeight', '2.7 m');
    const row = summary.assumptions.find((a) => a.key === 'wallHeight')!;
    expect(row).toEqual({ key: 'wallHeight', label: 'Altura de muros', value: '2.7 m', source: 'confirmed' });
  });

  it('reads analyses saved with the older Spanish labels', () => {
    const summary = parseSummary(JSON.stringify({ assumptions: [{ field: 'Altura de muros', value: '2.5 m', source: 'supuesto' }] }), '1:100');
    expect(summary.assumptions[0]).toMatchObject({ key: 'wallHeight', source: 'assumed' });
  });

  it('parses meters the way people type them', () => {
    expect(parseMeters('2,7')).toBe(2.7);
    expect(parseMeters('2.45 m')).toBe(2.45);
    expect(parseMeters('0')).toBeNull();
    expect(parseMeters('cien')).toBeNull();
  });
});

describe('confidence levels', () => {
  it('splits confidence in high, medium and low', () => {
    expect(confidenceLevel(0.92)).toBe('high');
    expect(confidenceLevel(0.85)).toBe('high');
    expect(confidenceLevel(0.7)).toBe('medium');
    expect(confidenceLevel(0.59)).toBe('low');
    expect(countByLevel([0.9, 0.7, 0.2, 0.3])).toEqual({ high: 1, medium: 1, low: 2 });
  });
});
