export type AnswerOption = { id: 'A' | 'B' | 'C' | 'D'; text: string; tag: string; points: number };
export type Question = {
  id: number;
  section: string;
  sectionNumber: number;
  text: string;
  options: AnswerOption[];
};

export type LeadCategory = 'hot' | 'warm' | 'cold';

export interface QuestionnaireResult {
  answers: Record<number, 'A' | 'B' | 'C' | 'D'>;
  totalScore: number;
  category: LeadCategory;
  categoryLabel: string;
  submittedAt: string;
  visitorId?: string;
  visitorName?: string;
  visitorEmail?: string;
}

export const SECTIONS = [
  { number: 1, title: 'Decision-Making Speed & Autonomy', range: [1, 3] },
  { number: 2, title: 'Risk Tolerance & Goals', range: [4, 5] },
  { number: 3, title: 'Motivation: Emotional vs. Logical', range: [6, 7] },
  { number: 4, title: 'Financial Readiness & Objections', range: [8, 10] },
  { number: 5, title: 'Vision & Trust', range: [11, 12] },
] as const;

export const QUESTIONS: Question[] = [
  {
    id: 1, sectionNumber: 1, section: 'Decision-Making Speed & Autonomy',
    text: 'What is your first step when you have to make a major financial decision?',
    options: [
      { id: 'A', text: 'I immediately research data and potential ROI.', tag: 'Analytical / Fast', points: 4 },
      { id: 'B', text: 'I discuss it with my family or spouse.', tag: 'Collaborative', points: 3 },
      { id: 'C', text: 'I observe market trends for some time.', tag: 'Cautious / Slow', points: 2 },
      { id: 'D', text: 'I rely on my gut feeling.', tag: 'Impulsive', points: 1 },
    ],
  },
  {
    id: 2, sectionNumber: 1, section: 'Decision-Making Speed & Autonomy',
    text: 'How long does it usually take you to finalize a major investment?',
    options: [
      { id: 'A', text: 'A few days to a week.', tag: 'High Urgency', points: 4 },
      { id: 'B', text: 'A few weeks.', tag: 'Moderate Urgency', points: 3 },
      { id: 'C', text: 'A few months.', tag: 'Low Urgency', points: 2 },
      { id: 'D', text: 'I am currently just looking at options for the future.', tag: 'Window Shopper', points: 1 },
    ],
  },
  {
    id: 3, sectionNumber: 1, section: 'Decision-Making Speed & Autonomy',
    text: 'Who plays the most important role in the final decision regarding your investment?',
    options: [
      { id: 'A', text: 'Entirely me.', tag: 'Sole Decision Maker', points: 4 },
      { id: 'B', text: 'Me and my partner / spouse.', tag: 'Joint Decision', points: 3 },
      { id: 'C', text: 'The advice of family elders.', tag: 'Dependent', points: 2 },
      { id: 'D', text: 'My financial advisor.', tag: 'Guided', points: 1 },
    ],
  },
  {
    id: 4, sectionNumber: 2, section: 'Risk Tolerance & Goals',
    text: 'What is your primary goal for a long-term investment?',
    options: [
      { id: 'A', text: 'High return with calculated risk — Capital Appreciation.', tag: 'High ROI', points: 4 },
      { id: 'B', text: 'A stable and secure passive income.', tag: 'Rental / Stable Income', points: 3 },
      { id: 'C', text: 'Security for the family and an asset for the future.', tag: 'End-Use / Security', points: 2 },
      { id: 'D', text: 'Prestige and status in society.', tag: 'Luxury / Status', points: 1 },
    ],
  },
  {
    id: 5, sectionNumber: 2, section: 'Risk Tolerance & Goals',
    text: 'A newly emerging area has great potential but is under development. What would you do?',
    options: [
      { id: 'A', text: 'Invest immediately for maximum early profit.', tag: 'High Risk / Early Adopter', points: 4 },
      { id: 'B', text: 'Invest once some infrastructure becomes visible.', tag: 'Moderate Risk', points: 3 },
      { id: 'C', text: 'Only go once it is fully developed.', tag: 'Low Risk', points: 2 },
      { id: 'D', text: 'I completely avoid such new areas.', tag: 'Risk Averse', points: 1 },
    ],
  },
  {
    id: 6, sectionNumber: 3, section: 'Motivation: Emotional vs. Logical',
    text: 'What attracts you the most to a new project?',
    options: [
      { id: 'A', text: 'The Return on Investment (ROI) and future growth.', tag: 'Logical / Investor', points: 4 },
      { id: 'B', text: 'The location and connectivity of the project.', tag: 'Practical', points: 3 },
      { id: 'C', text: 'Amenities, lifestyle, and the living experience.', tag: 'Emotional / End-user', points: 2 },
      { id: 'D', text: 'The brand name and reputation of the developer.', tag: 'Trust-seeker', points: 1 },
    ],
  },
  {
    id: 7, sectionNumber: 3, section: 'Motivation: Emotional vs. Logical',
    text: 'What emotion do you feel when thinking about your "dream purchase"?',
    options: [
      { id: 'A', text: 'Financial Freedom', tag: 'Financial Freedom', points: 4 },
      { id: 'B', text: 'Comfort and peace in life.', tag: 'Comfort / Peace', points: 3 },
      { id: 'C', text: 'Success and pride.', tag: 'Pride / Success', points: 2 },
      { id: 'D', text: 'Future security.', tag: 'Safety', points: 1 },
    ],
  },
  {
    id: 8, sectionNumber: 4, section: 'Financial Readiness & Objections',
    text: 'How are you planning to fund your next major asset?',
    options: [
      { id: 'A', text: 'I have funds ready / loan is pre-approved.', tag: 'Financially Ready', points: 4 },
      { id: 'B', text: 'I need to arrange some funds or apply for a loan.', tag: 'Needs Time', points: 3 },
      { id: 'C', text: 'I am currently building my savings.', tag: 'Saving Phase', points: 2 },
      { id: 'D', text: 'It depends entirely on how good the deal is.', tag: 'Opportunistic', points: 1 },
    ],
  },
  {
    id: 9, sectionNumber: 4, section: 'Financial Readiness & Objections',
    text: 'If you find the perfect opportunity today, how soon will you take action?',
    options: [
      { id: 'A', text: 'Immediately or within the next 1 month.', tag: 'Hot Lead', points: 4 },
      { id: 'B', text: 'Within 3 to 6 months.', tag: 'Warm Lead', points: 3 },
      { id: 'C', text: 'Within 6 to 12 months.', tag: 'Cold Lead', points: 2 },
      { id: 'D', text: 'I do not want to make any commitments right now.', tag: 'Not a Lead Yet', points: 1 },
    ],
  },
  {
    id: 10, sectionNumber: 4, section: 'Financial Readiness & Objections',
    text: 'What is your biggest fear when making any major investment?',
    options: [
      { id: 'A', text: 'Market crash or losing money.', tag: 'Financial Fear', points: 4 },
      { id: 'B', text: 'Project delays or not getting possession.', tag: 'Delivery Fear', points: 3 },
      { id: 'C', text: 'Hidden clauses or legal disputes.', tag: 'Trust Deficit', points: 2 },
      { id: 'D', text: 'Regret over making the wrong choice.', tag: "Buyer's Remorse", points: 1 },
    ],
  },
  {
    id: 11, sectionNumber: 5, section: 'Vision & Trust',
    text: 'What builds your trust the most in any company or developer?',
    options: [
      { id: 'A', text: 'Their track record of successfully delivering past projects.', tag: 'Track Record', points: 4 },
      { id: 'B', text: 'Complete transparency in legal and paperwork.', tag: 'Transparency', points: 3 },
      { id: 'C', text: 'Excellent use of virtual / physical tours and technology.', tag: 'Experience Driven', points: 2 },
      { id: 'D', text: 'Reviews from friends and family — word of mouth.', tag: 'Social Proof', points: 1 },
    ],
  },
  {
    id: 12, sectionNumber: 5, section: 'Vision & Trust',
    text: 'Where do you see your investment portfolio in the next 5 years?',
    options: [
      { id: 'A', text: 'Growing aggressively and multiplying several times.', tag: 'Aggressive Growth', points: 4 },
      { id: 'B', text: 'Giving me a stable passive income.', tag: 'Stable Growth', points: 3 },
      { id: 'C', text: 'Providing a secure roof for me and my family.', tag: 'Security Focused', points: 2 },
      { id: 'D', text: "I haven't thought that far ahead yet.", tag: 'Unplanned', points: 1 },
    ],
  },
];

export function computeScore(answers: Record<number, 'A' | 'B' | 'C' | 'D'>): number {
  return QUESTIONS.reduce((sum, q) => {
    const chosen = answers[q.id];
    if (!chosen) return sum;
    const opt = q.options.find((o) => o.id === chosen);
    return sum + (opt?.points ?? 0);
  }, 0);
}

export function scoreToCategory(score: number): LeadCategory {
  if (score >= 38) return 'hot';
  if (score >= 26) return 'warm';
  return 'cold';
}

export const CATEGORY_META: Record<LeadCategory, {
  label: string;
  subtitle: string;
  color: string;
  bgGradient: string;
  borderColor: string;
  icon: string;
  prediction: string;
}> = {
  hot: {
    label: 'High Intent Buyer',
    subtitle: 'Score 38–48 · Hot Lead',
    color: '#f97316',
    bgGradient: 'from-orange-950/80 to-red-950/60',
    borderColor: 'border-orange-500/40',
    icon: '🔥',
    prediction: 'You are a decisive action-taker with a clear vision. Our team will be in touch with exclusive early-bird opportunities tailored to your goals.',
  },
  warm: {
    label: 'Serious Prospect',
    subtitle: 'Score 26–37 · Warm Lead',
    color: '#d4af37',
    bgGradient: 'from-yellow-950/80 to-amber-950/60',
    borderColor: 'border-[#d4af37]/40',
    icon: '⭐',
    prediction: 'You value trust and transparency. We will share project details, delivery records, and connect you with our property advisors at the right time.',
  },
  cold: {
    label: 'Future Explorer',
    subtitle: 'Score 12–25 · Nurture Lead',
    color: '#60a5fa',
    bgGradient: 'from-blue-950/80 to-indigo-950/60',
    borderColor: 'border-blue-500/40',
    icon: '🔭',
    prediction: 'You are exploring your options wisely. We will keep you updated with market insights and the best investment opportunities as you plan ahead.',
  },
};

const LS_KEY = 'vr-expo-questionnaire-done';

export function markQuestionnaireDone(): void {
  try { localStorage.setItem(LS_KEY, '1'); } catch { /* */ }
}

export function isQuestionnaireDone(): boolean {
  try { return localStorage.getItem(LS_KEY) === '1'; } catch { return false; }
}
