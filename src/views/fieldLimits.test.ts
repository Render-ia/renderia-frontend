import { describe, expect, it } from 'vitest';

/** Source text of every view and UI file, loaded by Vite. */
const files = import.meta.glob<string>(['../**/*.ts', '!../**/*.test.ts'], { query: '?raw', import: 'default', eager: true });

const NOT_TEXT = /type="(file|checkbox|radio|hidden|range|color|number)"/;

describe('text fields', () => {
  it('every field a person can type in has a character limit', () => {
    const missing: string[] = [];
    for (const [file, text] of Object.entries(files)) {
      for (const match of text.matchAll(/<(input|textarea)\b[^>]*>/gs)) {
        if (NOT_TEXT.test(match[0]) || /maxlength="/.test(match[0])) continue;
        missing.push(`${file}: ${match[0].replace(/\s+/g, ' ').slice(0, 80)}`);
      }
    }
    expect(Object.keys(files).length).toBeGreaterThan(20);
    expect(missing).toEqual([]);
  });
});
