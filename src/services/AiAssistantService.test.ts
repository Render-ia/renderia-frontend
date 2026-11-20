import { describe, expect, it } from 'vitest';
import { checkedRender, type RenderResult } from './AiAssistantService.ts';

const ok: RenderResult = { mimeType: 'image/png', data: 'iVBORw0KGgo=', model: 'm', disclaimer: 'Imagen ilustrativa.' };

describe('AI render result', () => {
  it('accepts a real image in base64', () => {
    expect(checkedRender(ok)).toEqual(ok);
  });

  it('rejects anything that could break out of the image attribute', () => {
    for (const bad of [
      { ...ok, mimeType: 'text/html' },
      { ...ok, mimeType: 'image/png" onerror="alert(1)' },
      { ...ok, mimeType: 'image/svg+xml' },
      { ...ok, data: 'abc" onload="alert(1)' },
      { ...ok, data: '' },
      { ...ok, data: 5 as unknown as string },
    ]) {
      expect(() => checkedRender(bad)).toThrow('imagen no válida');
    }
    expect(() => checkedRender(null as unknown as RenderResult)).toThrow();
  });

  it('never shows a disclaimer that is not text', () => {
    expect(checkedRender({ ...ok, disclaimer: { x: 1 } as unknown as string }).disclaimer).toBe('');
  });
});
