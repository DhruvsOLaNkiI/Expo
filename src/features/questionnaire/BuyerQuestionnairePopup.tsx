import { useState, useCallback, useEffect } from 'react';
import {
  QUESTIONS,
  SECTIONS,
  CATEGORY_META,
  computeScore,
  scoreToCategory,
  markQuestionnaireDone,
  type QuestionnaireResult,
} from './questionnaireData';
import { useStore } from '@/store';

const TOTAL = QUESTIONS.length;

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = Math.round((current / total) * 100);
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-white/40">
          Question {current} of {total}
        </span>
        <span className="text-[10px] font-bold text-[#d4af37]">{pct}%</span>
      </div>
      <div className="h-1 w-full rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#d4af37] to-[#f5e6a0] transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function SectionBadge({ name }: { name: string }) {
  return (
    <div className="mb-3 inline-block rounded-full border border-[#d4af37]/25 bg-[#d4af37]/10 px-3 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-[#d4af37]">
      {name}
    </div>
  );
}

function QuestionStep({
  questionIdx,
  answer,
  onAnswer,
}: {
  questionIdx: number;
  answer: 'A' | 'B' | 'C' | 'D' | undefined;
  onAnswer: (id: 'A' | 'B' | 'C' | 'D') => void;
}) {
  const q = QUESTIONS[questionIdx];
  const optionLabels = ['A', 'B', 'C', 'D'] as const;
  const borderColors: Record<string, string> = {
    A: 'border-emerald-500/60 bg-emerald-950/30',
    B: 'border-[#d4af37]/60 bg-[#d4af37]/10',
    C: 'border-orange-500/60 bg-orange-950/25',
    D: 'border-blue-500/60 bg-blue-950/25',
  };

  return (
    <div className="flex flex-col gap-3">
      <SectionBadge name={q.section} />
      <h3 className="text-sm font-semibold leading-snug text-white md:text-base">
        {q.text}
      </h3>
      <div className="mt-1 flex flex-col gap-2">
        {q.options.map((opt) => {
          const isSelected = answer === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onAnswer(opt.id)}
              className={`group flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-all duration-200
                ${isSelected
                  ? `${borderColors[opt.id]} ring-1 ring-offset-0`
                  : 'border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.07]'
                }`}
            >
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold transition-all ${
                  isSelected
                    ? 'border-[#d4af37] bg-[#d4af37] text-black'
                    : 'border-white/20 text-white/50 group-hover:border-[#d4af37]/60 group-hover:text-[#d4af37]'
                }`}
              >
                {opt.id}
              </span>
              <div>
                <p className={`text-[13px] leading-snug ${isSelected ? 'text-white' : 'text-white/75'}`}>
                  {opt.text}
                </p>
                <p className="mt-0.5 text-[10px] text-white/35">{opt.tag}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ResultScreen({ result, onClose }: { result: QuestionnaireResult; onClose: () => void }) {
  const meta = CATEGORY_META[result.category];
  const maxScore = TOTAL * 4;
  const pct = Math.round((result.totalScore / maxScore) * 100);

  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-4 text-5xl">{meta.icon}</div>
      <div
        className={`mb-1 inline-block rounded-full border px-4 py-1 text-xs font-bold uppercase tracking-widest ${meta.borderColor}`}
        style={{ color: meta.color }}
      >
        {meta.subtitle}
      </div>
      <h2 className="mb-2 text-2xl font-bold tracking-wide text-white">{meta.label}</h2>

      <div className="mb-5 flex items-center gap-3">
        <div className="text-4xl font-black text-white">{result.totalScore}</div>
        <div className="text-left text-xs text-white/40">
          out of {maxScore} points<br />
          <span className="font-semibold" style={{ color: meta.color }}>{pct}% match</span>
        </div>
      </div>

      <div className={`mb-5 w-full rounded-2xl border bg-gradient-to-br p-4 text-left ${meta.bgGradient} ${meta.borderColor}`}>
        <p className="text-sm leading-relaxed text-white/80">{meta.prediction}</p>
      </div>

      <div className="mb-5 w-full rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-white/35">Your Answers</p>
        <div className="grid grid-cols-4 gap-1.5">
          {QUESTIONS.map((q) => {
            const chosen = result.answers[q.id];
            const opt = q.options.find((o) => o.id === chosen);
            return (
              <div key={q.id} className="flex flex-col items-center rounded-lg border border-white/10 bg-white/[0.04] p-1.5">
                <span className="text-[9px] text-white/30">Q{q.id}</span>
                <span
                  className="mt-0.5 text-sm font-bold"
                  style={{ color: meta.color }}
                >
                  {chosen ?? '—'}
                </span>
                <span className="text-[8px] leading-tight text-white/30">{opt?.points ?? 0}pt</span>
              </div>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="w-full rounded-xl bg-[#d4af37] py-3 text-sm font-bold uppercase tracking-widest text-black transition-colors hover:bg-[#c9a430]"
      >
        Explore the Expo
      </button>
    </div>
  );
}

async function submitQuestionnaire(result: QuestionnaireResult): Promise<void> {
  try {
    await fetch('/api/questionnaire/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    });
  } catch {
    // Non-critical — result is stored locally anyway
  }
}

export function BuyerQuestionnairePopup({ onClose }: { onClose: () => void }) {
  const visitorProfile = useStore((s) => s.visitorProfile);
  const [step, setStep] = useState(0); // 0 = intro, 1-12 = questions, 13 = result
  const [answers, setAnswers] = useState<Record<number, 'A' | 'B' | 'C' | 'D'>>({});
  const [result, setResult] = useState<QuestionnaireResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const questionIdx = step - 1; // 0-based index into QUESTIONS
  const currentQuestion = step >= 1 && step <= TOTAL ? QUESTIONS[questionIdx] : null;
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : undefined;

  const currentSection = currentQuestion
    ? SECTIONS.find((s) => s.range[0] <= currentQuestion.id && currentQuestion.id <= s.range[1])
    : null;

  const isFirstOfSection = currentSection
    ? currentQuestion?.id === currentSection.range[0]
    : false;

  const handleAnswer = useCallback((id: 'A' | 'B' | 'C' | 'D') => {
    if (!currentQuestion) return;
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: id }));
    // Auto-advance after short delay
    setTimeout(() => {
      setStep((s) => s + 1);
    }, 320);
  }, [currentQuestion]);

  const handleBack = () => setStep((s) => Math.max(0, s - 1));

  const handleSkip = () => {
    markQuestionnaireDone();
    onClose();
  };

  // When step reaches TOTAL + 1, finalize
  useEffect(() => {
    if (step !== TOTAL + 1) return;
    const score = computeScore(answers);
    const category = scoreToCategory(score);
    const res: QuestionnaireResult = {
      answers,
      totalScore: score,
      category,
      categoryLabel: CATEGORY_META[category].label,
      submittedAt: new Date().toISOString(),
      visitorId: visitorProfile?.id,
      visitorName: visitorProfile?.displayName,
      visitorEmail: visitorProfile?.email,
    };
    setResult(res);
    setSubmitting(true);
    markQuestionnaireDone();
    void submitQuestionnaire(res).finally(() => setSubmitting(false));
  }, [step, answers, visitorProfile]);

  const isShowingResult = step === TOTAL + 1 && result;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm pointer-events-auto">
      <div
        className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[#d4af37]/20 bg-[#0d0d14]/98 shadow-2xl"
        style={{ maxHeight: '90dvh' }}
      >
        {/* Gold header bar */}
        <div className="h-1 w-full bg-gradient-to-r from-[#b08d29] via-[#d4af37] to-[#b08d29]" />

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 md:px-7 md:py-6">

          {/* Intro */}
          {step === 0 && (
            <div className="flex flex-col items-center text-center">
              <div className="mb-3 text-4xl">📊</div>
              <h2 className="mb-2 text-xl font-bold tracking-wide text-white">
                Quick Buyer Insight Survey
              </h2>
              <p className="mb-4 text-sm leading-relaxed text-white/55">
                Answer 12 short questions to help us personalise your expo experience.
                Takes under 3 minutes — your responses are confidential.
              </p>
              <div className="mb-5 w-full rounded-xl border border-[#d4af37]/15 bg-[#d4af37]/5 p-4 text-left">
                {SECTIONS.map((s) => (
                  <div key={s.number} className="flex items-start gap-2 py-1">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#d4af37]/20 text-[9px] font-bold text-[#d4af37]">
                      {s.number}
                    </span>
                    <span className="text-[12px] text-white/60">{s.title}</span>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="mb-3 w-full rounded-xl bg-[#d4af37] py-3 text-sm font-bold uppercase tracking-widest text-black hover:bg-[#c9a430] transition-colors"
              >
                Begin Survey
              </button>
              <button type="button" onClick={handleSkip} className="text-[11px] text-white/30 hover:text-white/60 underline">
                Skip — explore expo directly
              </button>
            </div>
          )}

          {/* Questions */}
          {step >= 1 && step <= TOTAL && (
            <>
              <ProgressBar current={step} total={TOTAL} />
              {isFirstOfSection && currentSection && (
                <div className="mb-4 rounded-lg border border-[#d4af37]/15 bg-[#d4af37]/5 px-3 py-2 text-[11px] font-semibold text-[#d4af37]">
                  Section {currentSection.number} · {currentSection.title}
                </div>
              )}
              <QuestionStep
                questionIdx={questionIdx}
                answer={currentAnswer}
                onAnswer={handleAnswer}
              />
            </>
          )}

          {/* Result */}
          {isShowingResult && (
            submitting ? (
              <div className="flex flex-col items-center py-10 text-white/50">
                <div className="mb-3 h-6 w-6 animate-spin rounded-full border-2 border-[#d4af37] border-t-transparent" />
                Calculating your profile…
              </div>
            ) : (
              <ResultScreen result={result} onClose={onClose} />
            )
          )}
        </div>

        {/* Footer nav (questions only) */}
        {step >= 1 && step <= TOTAL && (
          <div className="flex items-center justify-between border-t border-white/[0.06] px-5 py-3 md:px-7">
            <button
              type="button"
              onClick={handleBack}
              className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-white/50 hover:bg-white/10"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={handleSkip}
              className="text-[11px] text-white/25 hover:text-white/50"
            >
              Skip survey
            </button>
            <button
              type="button"
              disabled={!currentAnswer}
              onClick={() => setStep((s) => s + 1)}
              className="rounded-lg border border-[#d4af37]/35 bg-[#d4af37]/15 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-[#d4af37] hover:bg-[#d4af37]/25 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
