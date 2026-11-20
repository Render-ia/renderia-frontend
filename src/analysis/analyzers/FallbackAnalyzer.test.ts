import { describe, expect, it, vi } from 'vitest';
import type { AnalysisInput, AnalysisOutput, PlanAnalyzer } from '../PlanAnalyzer.ts';
import { FallbackAnalyzer } from './FallbackAnalyzer.ts';

const input = { floorPlanId: 1, imageUrl: 'x', scale: '1:100', aiModel: { id: 2, name: 'm', provider: 'local-vision' } } as unknown as AnalysisInput;
const output = (analyzer: string): AnalysisOutput => ({ elements: [], summary: { analyzer } });
const analyzer = (name: string, run: () => Promise<AnalysisOutput>): PlanAnalyzer & { analyze: ReturnType<typeof vi.fn> } =>
  ({ name, analyze: vi.fn(run) }) as never;

describe('FallbackAnalyzer', () => {
  it('uses the server while the AI service answers', async () => {
    const server = analyzer('server', async () => output('server'));
    const browser = analyzer('browser', async () => output('browser'));
    const result = await new FallbackAnalyzer(server, browser, async () => true, true).analyze(input);
    expect(result.summary.analyzer).toBe('server');
    expect(browser.analyze).not.toHaveBeenCalled();
  });

  it('skips the server wait when the service is down and the detector is the same', async () => {
    const server = analyzer('server', async () => output('server'));
    const browser = analyzer('browser', async () => output('browser'));
    const result = await new FallbackAnalyzer(server, browser, async () => false, true).analyze(input);
    expect(server.analyze).not.toHaveBeenCalled();
    expect(result.summary.fallback).toBeTruthy();
  });

  it('falls back when the server says the AI service is down', async () => {
    const server = analyzer('server', async () => {
      throw new Error('El servicio de IA no está disponible (código 429).');
    });
    const browser = analyzer('browser', async () => output('browser'));
    const result = await new FallbackAnalyzer(server, browser, async () => false, false).analyze(input);
    expect(result.summary.analyzer).toBe('browser (en el navegador)');
  });

  it('does not hide errors about the plan itself', async () => {
    const server = analyzer('server', async () => {
      throw new Error('No se encontraron muros. Prueba con un plano más nítido.');
    });
    const browser = analyzer('browser', async () => output('browser'));
    await expect(new FallbackAnalyzer(server, browser, async () => true, true).analyze(input)).rejects.toThrow('muros');
    expect(browser.analyze).not.toHaveBeenCalled();
  });
});
