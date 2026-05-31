import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Users } from 'lucide-react';
import { fetchBoothFaqSubmissions, type FaqSubmissionRow } from '@/dashboard/api/client';

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function visitorLabel(row: FaqSubmissionRow): string {
  return row.visitorName?.trim() || row.visitorId?.trim() || 'Guest visitor';
}

type FlatRow = {
  key: string;
  visitor: string;
  submittedAt: string;
  question: string;
  answer: string;
  optionLabel: string;
};

function flattenSubmissions(rows: FaqSubmissionRow[]): FlatRow[] {
  const flat: FlatRow[] = [];
  for (const sub of rows) {
    const visitor = visitorLabel(sub);
    for (const a of sub.answers) {
      flat.push({
        key: `${sub.id}-${a.questionId}`,
        visitor,
        submittedAt: sub.submittedAt,
        question: a.questionText,
        answer: a.optionText,
        optionLabel: a.optionLabel,
      });
    }
  }
  return flat.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

type Props = { boothId: string };

export function FaqResponsesDashboard({ boothId }: Props) {
  const [rows, setRows] = useState<FaqSubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const data = await fetchBoothFaqSubmissions(boothId);
    setRows(data);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(interval);
  }, [boothId]);

  const flat = useMemo(() => flattenSubmissions(rows), [rows]);
  const uniqueVisitors = useMemo(() => new Set(rows.map((r) => r.sessionId)).size, [rows]);

  return (
    <section className="exb-card exb-faq-responses">
      <div className="exb-faq-responses-head">
        <div className="exb-faq-responses-title">
          <Users size={18} />
          <div>
            <h3>FAQ responses</h3>
            <p className="exb-muted">Who answered your custom booth questions</p>
          </div>
        </div>
        <button type="button" className="exb-btn exb-btn-sm" disabled={loading} onClick={() => void load()}>
          <RefreshCw size={14} className={loading ? 'exb-spin' : undefined} />
          Refresh
        </button>
      </div>

      <div className="exb-faq-responses-stats">
        <div>
          <strong>{uniqueVisitors}</strong>
          <span>Visitors answered</span>
        </div>
        <div>
          <strong>{flat.length}</strong>
          <span>Total answers</span>
        </div>
      </div>

      <div className="exb-table-scroll">
        <table className="exb-table exb-faq-responses-table">
          <thead>
            <tr>
              <th>Visitor</th>
              <th>Answered</th>
              <th>Question</th>
              <th>Selected answer</th>
            </tr>
          </thead>
          <tbody>
            {flat.length === 0 ? (
              <tr>
                <td colSpan={4} className="exb-empty">
                  {loading
                    ? 'Loading responses…'
                    : 'No FAQ answers yet. Visitors appear here after they finish your booth FAQ quiz.'}
                </td>
              </tr>
            ) : (
              flat.map((r) => (
                <tr key={r.key}>
                  <td>
                    <strong>{r.visitor}</strong>
                  </td>
                  <td>{formatWhen(r.submittedAt)}</td>
                  <td>{r.question}</td>
                  <td>
                    <span className="exb-faq-answer-pill">
                      <em>{r.optionLabel}</em> {r.answer}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
