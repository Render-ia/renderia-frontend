import type { CopilotAnswer, CopilotProposal } from '../analysis/copilot/proposals.ts';
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

  /** The user's saved conversation about this analysis, oldest first. */
  async conversation(analysisId: number): Promise<SavedTurn[]> {
    return savedTurns(await this.api.get<unknown>(`/analyses/${analysisId}/copilot/messages`));
  }

  async render(analysisId: number, image: string, style: RenderStyle, scene: 'exterior' | 'interior', notes: string): Promise<RenderResult> {
    const result = await this.api.post<RenderResult>(`/analyses/${analysisId}/render`, { image, style, scene, notes });
    return checkedRender(result);
  }
}

/** A turn read back from the database, with the proposals the copilot made in it. */
export interface SavedTurn extends ChatTurn {
  proposals: CopilotProposal[];
}

/** Turns read from the server, dropping anything that is not a well-formed turn. */
export function savedTurns(raw: unknown): SavedTurn[] {
  return Array.isArray(raw) ? raw.filter(isSavedTurn).map(cleanTurn) : [];
}

function isSavedTurn(turn: unknown): turn is SavedTurn {
  const t = turn as SavedTurn;
  return !!t && (t.role === 'user' || t.role === 'model') && typeof t.text === 'string';
}

/** Keeps only proposals with the expected shape; their operations are checked again before showing them. */
function cleanTurn(turn: SavedTurn): SavedTurn {
  const proposals = Array.isArray(turn.proposals)
    ? turn.proposals.filter((p) => !!p && typeof p.title === 'string' && typeof p.reason === 'string' && Array.isArray(p.operations))
    : [];
  return { role: turn.role, text: turn.text, proposals };
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
