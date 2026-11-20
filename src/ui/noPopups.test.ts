import { describe, expect, it } from 'vitest';

/** Source text of every app file, loaded by Vite. */
const files = import.meta.glob<string>(['../**/*.ts', '!../**/*.test.ts'], { query: '?raw', import: 'default', eager: true });

/** Anything that opens a window over the page instead of showing it in the page. */
const POPUP = /showModal\(|<dialog\b|createElement\('dialog'\)|window\.(alert|confirm|prompt|open)\(|\b(alert|confirm|prompt)\(['"`]/;

describe('pages instead of pop-ups', () => {
  it('no screen opens a modal, a pop-up window or a browser dialog', () => {
    const found = Object.entries(files)
      .filter(([, text]) => POPUP.test(text))
      .map(([file, text]) => `${file}: ${text.match(POPUP)![0]}`);
    expect(Object.keys(files).length).toBeGreaterThan(20);
    expect(found).toEqual([]);
  });
});
