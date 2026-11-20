/**
 * Confidence levels of the proposal (stage 3: high, medium or low). One place decides the thresholds for the inspector, the
 * plan overlay, the 3D viewer and the reports.
 */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

export const CONFIDENCE_THRESHOLDS = { high: 0.85, medium: 0.6 } as const;

export const CONFIDENCE_LEVELS: { level: ConfidenceLevel; label: string; color: string; hint: string }[] = [
  { level: 'high', label: 'Alta', color: '#0f9184', hint: '85 % o más: la IA está segura.' },
  { level: 'medium', label: 'Media', color: '#d99a00', hint: 'Entre 60 % y 85 %: conviene mirarlo.' },
  { level: 'low', label: 'Baja', color: '#d93a5b', hint: 'Menos de 60 %: revísalo antes de usar sus medidas.' },
];

export function confidenceLevel(confidence: number): ConfidenceLevel {
  if (confidence >= CONFIDENCE_THRESHOLDS.high) return 'high';
  if (confidence >= CONFIDENCE_THRESHOLDS.medium) return 'medium';
  return 'low';
}

export function levelInfo(level: ConfidenceLevel) {
  return CONFIDENCE_LEVELS.find((l) => l.level === level)!;
}

export function countByLevel(confidences: number[]): Record<ConfidenceLevel, number> {
  const counts: Record<ConfidenceLevel, number> = { high: 0, medium: 0, low: 0 };
  for (const c of confidences) counts[confidenceLevel(c)]++;
  return counts;
}
