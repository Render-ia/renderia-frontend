import { describe, expect, it } from 'vitest';
import { checkedRender, savedTurns, type RenderResult } from './AiAssistantService.ts';

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

describe('saved copilot conversation', () => {
  it('keeps well-formed turns in order with their proposals', () => {
    const proposal = { title: 'Engrosar muro', reason: 'Mide 8 cm.', operations: [{ op: 'update', elementId: 4, field: 'thickness', value: 0.12 }] };
    const turns = savedTurns([
      { role: 'user', text: '¿Qué muros son delgados?', proposals: [] },
      { role: 'model', text: 'El muro #4.', proposals: [proposal], createdAt: '2026-11-20T18:00:00Z' },
    ]);
    expect(turns.map((t) => t.text)).toEqual(['¿Qué muros son delgados?', 'El muro #4.']);
    expect(turns[1].proposals).toEqual([proposal]);
  });

  it('drops broken turns and proposals', () => {
    const turns = savedTurns([
      { role: 'system', text: 'x' },
      { role: 'model', text: 5 },
      null,
      { role: 'model', text: 'ok', proposals: [{ title: 1 }, 'x', { title: 't', reason: 'r', operations: 'no' }] },
    ]);
    expect(turns).toEqual([{ role: 'model', text: 'ok', proposals: [] }]);
    expect(savedTurns({ not: 'a list' })).toEqual([]);
  });
});
