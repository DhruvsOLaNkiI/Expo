import { Plus, Trash2 } from 'lucide-react';
import type { CustomFaqQuestion } from '@/features/shared/data/boothLayouts';
import {
  newCustomFaqOption,
  newCustomFaqQuestion,
  optionLabel,
} from './customFaqQuestions';

type Props = {
  questions: CustomFaqQuestion[];
  onChange: (next: CustomFaqQuestion[]) => void;
  disabled?: boolean;
};

export function CustomFaqQuestionsEditor({ questions, onChange, disabled }: Props) {
  const addQuestion = () => onChange([...questions, newCustomFaqQuestion()]);

  const removeQuestion = (id: string) => onChange(questions.filter((q) => q.id !== id));

  const patchQuestion = (id: string, question: string) =>
    onChange(questions.map((q) => (q.id === id ? { ...q, question } : q)));

  const addOption = (questionId: string) =>
    onChange(
      questions.map((q) =>
        q.id === questionId ? { ...q, options: [...q.options, newCustomFaqOption()] } : q,
      ),
    );

  const removeOption = (questionId: string, optionId: string) =>
    onChange(
      questions.map((q) =>
        q.id === questionId
          ? { ...q, options: q.options.filter((o) => o.id !== optionId) }
          : q,
      ),
    );

  const patchOption = (questionId: string, optionId: string, text: string) =>
    onChange(
      questions.map((q) =>
        q.id === questionId
          ? {
              ...q,
              options: q.options.map((o) => (o.id === optionId ? { ...o, text } : o)),
            }
          : q,
      ),
    );

  return (
    <section className="exb-card exb-faq-custom">
      <div className="exb-faq-custom-head">
        <div>
          <h3>Custom questions</h3>
          <p className="exb-muted">
            Add your own buyer questions with multiple-choice options. Visitors and your AI assistant
            can use these alongside your FAQ PDF.
          </p>
        </div>
        <button
          type="button"
          className="exb-btn exb-btn-primary"
          disabled={disabled}
          onClick={addQuestion}
        >
          <Plus size={14} />
          Add question
        </button>
      </div>

      {questions.length === 0 ? (
        <p className="exb-faq-custom-empty">
          No custom questions yet. Click <strong>Add question</strong> to create one with answer
          options.
        </p>
      ) : (
        <ul className="exb-faq-q-list">
          {questions.map((row, qIndex) => (
            <li key={row.id} className="exb-faq-q-card">
              <div className="exb-faq-q-head">
                <span className="exb-faq-q-num">Question {qIndex + 1}</span>
                <button
                  type="button"
                  className="exb-btn exb-btn-sm exb-btn-danger"
                  disabled={disabled}
                  onClick={() => removeQuestion(row.id)}
                >
                  <Trash2 size={12} />
                  Remove
                </button>
              </div>

              <label className="exb-faq-field">
                Question
                <input
                  className="exb-field"
                  value={row.question}
                  disabled={disabled}
                  placeholder="e.g. What is your preferred unit size?"
                  onChange={(e) => patchQuestion(row.id, e.target.value)}
                />
              </label>

              <div className="exb-faq-options">
                <span className="exb-faq-options-label">Answer options</span>
                {row.options.map((opt, optIndex) => (
                  <div key={opt.id} className="exb-faq-option-row">
                    <span className="exb-faq-option-label">{optionLabel(optIndex)}</span>
                    <input
                      className="exb-field"
                      value={opt.text}
                      disabled={disabled}
                      placeholder={`Option ${optionLabel(optIndex)}`}
                      onChange={(e) => patchOption(row.id, opt.id, e.target.value)}
                    />
                    <button
                      type="button"
                      className="exb-icon-btn"
                      disabled={disabled || row.options.length <= 2}
                      title={row.options.length <= 2 ? 'At least two options required' : 'Remove option'}
                      onClick={() => removeOption(row.id, opt.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="exb-btn exb-btn-sm"
                  disabled={disabled || row.options.length >= 6}
                  onClick={() => addOption(row.id)}
                >
                  <Plus size={12} />
                  Add option
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
