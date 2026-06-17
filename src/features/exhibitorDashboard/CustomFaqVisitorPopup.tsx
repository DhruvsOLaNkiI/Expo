import { useMemo, useRef, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, HelpCircle } from 'lucide-react';
import {
  getAnalyticsSessionId,
  submitFaqResponses,
  type FaqAnswerEntry,
} from '@/dashboard/api/client';
import type { CustomFaqQuestion } from '@/features/shared/data/boothLayouts';
import { optionLabel } from '@/features/exhibitorDashboard/customFaqQuestions';
import { useStore } from '@/store';
import { openUrlInNewTab } from '@/utils/openUrl';

type Props = {
  title: string;
  questions: CustomFaqQuestion[];
  boothId?: string;
  faqPdfUrl?: string;
  onClose: () => void;
  overlayClassName?: string;
};

const DEFAULT_OVERLAY =
  'fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm pointer-events-auto';

export function CustomFaqVisitorPopup({
  title,
  questions,
  boothId,
  faqPdfUrl,
  onClose,
  overlayClassName = DEFAULT_OVERLAY,
}: Props) {
  const visitorProfile = useStore((s) => s.visitorProfile);
  const submittedRef = useRef(false);

  const list = useMemo(
    () =>
      questions.filter(
        (q) => q.question.trim() && q.options.filter((o) => o.text.trim()).length >= 2,
      ),
    [questions],
  );

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  const current = list[step];
  const total = list.length;
  const selectedId = current ? answers[current.id] : undefined;

  const submitAnswers = (answerMap: Record<string, string>) => {
    if (submittedRef.current || !boothId) return;
    submittedRef.current = true;

    const payload: FaqAnswerEntry[] = list.map((q) => {
      const optionId = answerMap[q.id];
      const filled = q.options.filter((o) => o.text.trim());
      const optIndex = filled.findIndex((o) => o.id === optionId);
      const opt = filled[optIndex];
      return {
        questionId: q.id,
        questionText: q.question.trim(),
        optionId: optionId ?? '',
        optionText: opt?.text.trim() ?? '',
        optionLabel: optIndex >= 0 ? optionLabel(optIndex) : '—',
      };
    });

    void submitFaqResponses({
      boothId,
      sessionId: getAnalyticsSessionId(visitorProfile?.id),
      visitorId: visitorProfile?.id,
      visitorName: visitorProfile?.displayName,
      answers: payload.filter((a) => a.optionId),
    });
  };

  if (total === 0) {
    return (
      <div className={overlayClassName} onClick={onClose}>
        <div
          className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0b1220] p-6 text-center shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-sm text-white/70">No FAQ questions are available yet.</p>
          {faqPdfUrl ? (
            <button
              type="button"
              className="mt-4 rounded-lg bg-sky-500/20 px-4 py-2 text-sm text-sky-200"
              onClick={() => openUrlInNewTab(faqPdfUrl)}
            >
              Open FAQ PDF
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className={overlayClassName} onClick={onClose}>
        <div
          className="w-full max-w-lg rounded-2xl border border-emerald-500/25 bg-gradient-to-b from-[#0f172a] to-[#0b1220] p-6 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-4 flex items-center gap-3 text-emerald-300">
            <CheckCircle2 size={28} />
            <h2 className="text-lg font-semibold text-white">Thanks for your answers</h2>
          </div>
          <p className="text-sm leading-relaxed text-white/70">
            Our team will use your responses to guide you through the project. Ask our AI assistant
            or sales rep if you need more detail.
          </p>
          {faqPdfUrl ? (
            <button
              type="button"
              className="mt-5 rounded-lg border border-sky-400/30 bg-sky-500/10 px-4 py-2 text-sm text-sky-200"
              onClick={() => openUrlInNewTab(faqPdfUrl)}
            >
              View full FAQ PDF
            </button>
          ) : null}
          <button
            type="button"
            className="mt-3 ml-3 rounded-lg bg-white/10 px-4 py-2 text-sm text-white"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={overlayClassName} onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-sky-400/20 bg-gradient-to-b from-[#0f172a] to-[#0b1220] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-sky-500/15 text-sky-300">
              <HelpCircle size={20} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">{title}</h2>
              <p className="text-xs text-white/45">
                Question {step + 1} of {total}
              </p>
            </div>
          </div>
          <button type="button" className="text-sm text-white/50 hover:text-white" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          <h3 className="mb-4 text-sm font-medium leading-snug text-white md:text-base">
            {current.question}
          </h3>
          <div className="flex flex-col gap-2">
            {current.options
              .filter((o) => o.text.trim())
              .map((opt, index) => {
                const active = selectedId === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setAnswers((prev) => ({ ...prev, [current.id]: opt.id }))}
                    className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-all ${
                      active
                        ? 'border-sky-400/60 bg-sky-500/10 ring-1 ring-sky-400/30'
                        : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'
                    }`}
                  >
                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-bold text-sky-200">
                      {optionLabel(index)}
                    </span>
                    <span className="text-white/90">{opt.text}</span>
                  </button>
                );
              })}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-white/10 px-5 py-4">
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-white/60 disabled:opacity-30"
            disabled={step <= 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            <ChevronLeft size={16} />
            Back
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-lg bg-sky-500/20 px-4 py-2 text-sm font-medium text-sky-100 disabled:opacity-40"
            disabled={!selectedId}
            onClick={() => {
              if (step >= total - 1) {
                submitAnswers({ ...answers, [current.id]: selectedId! });
                setDone(true);
                return;
              }
              setStep((s) => s + 1);
            }}
          >
            {step >= total - 1 ? 'Finish' : 'Next'}
            {step < total - 1 ? <ChevronRight size={16} /> : null}
          </button>
        </div>
      </div>
    </div>
  );
}
