/** Buyer questionnaire is 12 questions × max 4 pts = 48. */

export const QUESTIONNAIRE_MAX_SCORE = 48;
export const QUESTIONNAIRE_MIN_SCORE = 12;

export type LeadPossibilityTier = 'high' | 'medium' | 'low';

export const LEAD_POSSIBILITY_SEGMENTS: {
  id: LeadPossibilityTier;
  name: string;
  scoreMin: number;
  scoreMax: number;
  pctRange: string;
  color: string;
}[] = [
  {
    id: 'high',
    name: 'High Possibility Lead',
    scoreMin: 38,
    scoreMax: 48,
    pctRange: '80–100%',
    color: '#22c55e',
  },
  {
    id: 'medium',
    name: 'Medium Possibility',
    scoreMin: 26,
    scoreMax: 37,
    pctRange: '60–80%',
    color: '#f59e0b',
  },
  {
    id: 'low',
    name: 'Low Possibility Lead',
    scoreMin: 12,
    scoreMax: 25,
    pctRange: '0–60%',
    color: '#3b82f6',
  },
];

export function scoreToPossibilityTier(score: number): LeadPossibilityTier {
  if (score >= 38) return 'high';
  if (score >= 26) return 'medium';
  return 'low';
}

export function scoreToPercentOfMax(score: number): number {
  return Math.round((score / QUESTIONNAIRE_MAX_SCORE) * 100);
}

export type LeadPossibilityChartRow = {
  id: LeadPossibilityTier;
  name: string;
  value: number;
  color: string;
  scoreRange: string;
  pctRange: string;
  sharePct: number;
};

export function buildLeadPossibilityChart(counts: Record<LeadPossibilityTier, number>): LeadPossibilityChartRow[] {
  const total = counts.high + counts.medium + counts.low;
  return LEAD_POSSIBILITY_SEGMENTS.map((seg) => {
    const value = counts[seg.id];
    return {
      id: seg.id,
      name: seg.name,
      value,
      color: seg.color,
      scoreRange: `${seg.scoreMin}–${seg.scoreMax}`,
      pctRange: seg.pctRange,
      sharePct: total > 0 ? Math.round((value / total) * 100) : 0,
    };
  });
}

export const DEMO_LEAD_POSSIBILITY_COUNTS: Record<LeadPossibilityTier, number> = {
  high: 25,
  medium: 31,
  low: 18,
};
