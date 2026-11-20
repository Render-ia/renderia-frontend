import type { CopilotAnswer } from '../analysis/copilot/proposals.ts';
import { AppConfig } from '../core/config/AppConfig.ts';
import { ApiClient } from '../core/http/ApiClient.ts';

export interface AiCapabilities {
  gemini: { configured: boolean; model: string | null; proModel: string | null };
  renders: { enabled: boolean; model: string | null };
  remaining: { copilot: number; render: number };
}

export interface ChatTurn {
  role: 'user' | 'model';
  text: string;
}

export type RenderStyle = 'modern' | 'tropical' | 'rustic' | 'contemporary' | 'minimalist' | 'traditional';

export interface RenderResult {
  mimeType: string;
  data: string;
  model: string;
  disclaimer: string;
}

/**
 * Engineering copilot and AI renders, served by the backend (which checks
 * access and daily limits and calls the AI service). Not available in the
 * in-browser demo data.
 */
export class AiAssistantService {
  private readonly api = ApiClient.getInstance();

  get available(): boolean {
    return AppConfig.getInstance().dataSource !== 'mock';
  }

  capabilities(): Promise<AiCapabilities> {
    return this.api.get<AiCapabilities>('/ai/capabilities');
  }

  ask(analysisId: number, question: string, history: ChatTurn[], deep: boolean): Promise<CopilotAnswer> {
    return this.api.post<CopilotAnswer>(`/analyses/${analysisId}/copilot`, {
      question,
      depth: deep ? 'deep' : 'fast',
      history: history.slice(-8),
    });
  }

  async render(analysisId: number, image: string, style: RenderStyle, scene: 'exterior' | 'interior', notes: string): Promise<RenderResult> {
    const result = await this.api.post<RenderResult>(`/analyses/${analysisId}/render`, { image, style, scene, notes });
    return checkedRender(result);
  }
}

const RENDER_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/**
 * The render goes into a data: URL inside the page, so only a real image type
 * and plain base64 are accepted: anything else could break out of the attribute.
 */
export function checkedRender(result: RenderResult): RenderResult {
  if (!result || !RENDER_TYPES.includes(result.mimeType) || typeof result.data !== 'string' || !BASE64.test(result.data)) {
    throw new Error('El servicio de IA devolvió una imagen no válida.');
  }
  return { ...result, disclaimer: typeof result.disclaimer === 'string' ? result.disclaimer : '' };
}
