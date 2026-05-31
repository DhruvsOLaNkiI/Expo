import type { CustomFaqOption, CustomFaqQuestion } from '@/features/shared/data/boothLayouts';

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;

export function optionLabel(index: number): string {
  return OPTION_LABELS[index] ?? String(index + 1);
}

export function newCustomFaqOption(): CustomFaqOption {
  return { id: `opt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, text: '' };
}

export function newCustomFaqQuestion(): CustomFaqQuestion {
  return {
    id: `faq-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    question: '',
    options: [newCustomFaqOption(), newCustomFaqOption()],
  };
}

/** Keep only questions with text and at least two filled options. */
export function sanitizeCustomFaqQuestions(questions: CustomFaqQuestion[]): CustomFaqQuestion[] {
  return questions
    .map((q) => ({
      ...q,
      question: q.question.trim(),
      options: q.options
        .map((o) => ({ ...o, text: o.text.trim() }))
        .filter((o) => o.text.length > 0),
    }))
    .filter((q) => q.question.length > 0 && q.options.length >= 2);
}

export function validateCustomFaqQuestions(questions: CustomFaqQuestion[]): string | null {
  if (questions.length === 0) return 'Add at least one question before saving.';

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const label = `Question ${i + 1}`;
    if (!q.question.trim()) return `${label}: enter the question text.`;
    const filled = q.options.filter((o) => o.text.trim()).length;
    if (filled < 2) return `${label}: add at least two answer options.`;
  }

  return null;
}
