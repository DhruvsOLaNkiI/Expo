import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Clock,
  DoorOpen,
  FileText,
  HelpCircle,
  LogIn,
  LogOut,
  Mail,
  Phone,
  Timer,
} from 'lucide-react';
import {
  fetchBoothVisitorProfile,
  type BoothVisitorProfileRow,
  type VisitorTimelineEventRow,
} from '@/dashboard/api/client';
import { useExhibitorBooth } from './useExhibitorBooth';
import {
  buildDemoVisitorProfile,
  formatVisitTime,
  type VisitorProfileTarget,
} from './visitorInsightsData';

type Props = {
  visitor: VisitorProfileTarget;
  onBack: () => void;
};

const CATEGORY_CLASS = {
  HOT: 'vcrm-cat-hot',
  WARM: 'vcrm-cat-warm',
  VIP: 'vcrm-cat-vip',
  COLD: 'vcrm-cat-cold',
} as const;

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function formatDuration(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  const mins = Math.floor(ms / 60_000);
  const secs = Math.round((ms % 60_000) / 1000);
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

function timelineIcon(type: VisitorTimelineEventRow['type']) {
  switch (type) {
    case 'booth_enter':
      return <LogIn size={14} />;
    case 'booth_exit':
      return <LogOut size={14} />;
    case 'doc_open':
      return <BookOpen size={14} />;
    case 'doc_close':
      return <FileText size={14} />;
    case 'faq_answer':
      return <HelpCircle size={14} />;
    default:
      return <Clock size={14} />;
  }
}

function mergeProfile(
  live: BoothVisitorProfileRow | null,
  demo: BoothVisitorProfileRow,
): BoothVisitorProfileRow {
  if (!live) return demo;
  const hasLive =
    live.boothVisits.length > 0 ||
    live.documentSessions.length > 0 ||
    live.faqAnswers > 0;
  if (!hasLive) return demo;
  return live;
}

export function VisitorProfilePage({ visitor, onBack }: Props) {
  const { boothId, booth } = useExhibitorBooth();
  const boothCompany = booth?.company.companyName ?? 'Vertex Elite';
  const [profile, setProfile] = useState<BoothVisitorProfileRow | null>(null);
  const [loading, setLoading] = useState(true);

  const demoProfile = useMemo(
    () => buildDemoVisitorProfile(visitor, boothId),
    [visitor, boothId],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const load = async () => {
      const live = await fetchBoothVisitorProfile(boothId, {
        visitorId: visitor.visitorId,
        sessionId: visitor.sessionId,
        visitorName: visitor.name,
      });
      if (!cancelled) {
        setProfile(mergeProfile(live, demoProfile));
        setLoading(false);
      }
    };
    void load();
    const interval = window.setInterval(() => void load(), 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [boothId, visitor, demoProfile]);

  const data = profile ?? demoProfile;
  const avgStayMs =
    data.totalVisits > 0 ? Math.round(data.totalDwellMs / data.totalVisits) : 0;
  const contactEmail = data.email ?? visitor.email;
  const contactPhone = data.phone ?? visitor.phone;

  return (
    <div className="vprof-page">
      <button type="button" className="exb-btn vprof-back" onClick={onBack}>
        <ArrowLeft size={15} />
        Back to Visitor Insights
      </button>

      <section className="vprof-hero exb-card">
        <div className="vprof-hero-main">
          <div className="vprof-avatar" style={{ background: `hsl(${visitor.avatarHue} 45% 38%)` }}>
            {initials(visitor.name)}
          </div>
          <div>
            <div className="vprof-hero-title">
              <h2>{visitor.name}</h2>
              <span className={`vcrm-cat ${CATEGORY_CLASS[visitor.category]}`}>
                {visitor.category}
              </span>
            </div>
            <p className="vprof-role">
              {visitor.role} · {visitor.company}
            </p>
            {(contactEmail || contactPhone) && (
              <p className="vprof-contact">
                {contactEmail ? (
                  <a href={`mailto:${contactEmail}`}>
                    <Mail size={13} />
                    {contactEmail}
                  </a>
                ) : null}
                {contactPhone ? (
                  <a href={`tel:${contactPhone.replace(/\s/g, '')}`}>
                    <Phone size={13} />
                    {contactPhone}
                  </a>
                ) : null}
              </p>
            )}
            <p className="vprof-booth-note">
              Activity at <strong>{boothCompany}</strong> only
            </p>
          </div>
        </div>
        <div className="vprof-hero-score">
          <div
            className="vcrm-score-ring vprof-score-ring"
            style={{
              background: `conic-gradient(#22d3ee ${visitor.leadScore * 3.6}deg, rgba(255,255,255,0.08) 0deg)`,
            }}
          >
            <span>{visitor.leadScore}</span>
          </div>
          <small>{visitor.scoreLabel}</small>
        </div>
      </section>

      <section className="exb-row vprof-stats">
        <article className="exb-card exb-stat-card">
          <DoorOpen size={18} className="exb-stat-icon blue" />
          <span className="exb-stat-sub">Booth visits</span>
          <strong className="exb-kpi-value sm">{data.totalVisits}</strong>
        </article>
        <article className="exb-card exb-stat-card">
          <Timer size={18} className="exb-stat-icon green" />
          <span className="exb-stat-sub">Total time in booth</span>
          <strong className="exb-kpi-value sm">
            {data.totalDwellMs > 0 ? formatDuration(data.totalDwellMs) : '—'}
          </strong>
        </article>
        <article className="exb-card exb-stat-card">
          <BookOpen size={18} className="exb-stat-icon purple" />
          <span className="exb-stat-sub">Brochure opens</span>
          <strong className="exb-kpi-value sm">{data.documentsOpened}</strong>
        </article>
        <article className="exb-card exb-stat-card">
          <HelpCircle size={18} className="exb-stat-icon amber" />
          <span className="exb-stat-sub">FAQ answers</span>
          <strong className="exb-kpi-value sm">{data.faqAnswers}</strong>
        </article>
      </section>

      <section className="exb-row vprof-main">
        <article className="exb-card vprof-docs-card">
          <div className="exb-card-head">
            <h3>Brochure & document activity</h3>
            <FileText size={18} className="vcrm-chart-icon" />
          </div>
          {loading ? (
            <p className="vprof-empty">Loading document sessions…</p>
          ) : data.documentSessions.length === 0 ? (
            <p className="vprof-empty">No brochure opens recorded for this visitor at your booth.</p>
          ) : (
            <div className="exb-table-scroll">
              <table className="exb-table vprof-docs-table">
                <thead>
                  <tr>
                    <th>Document</th>
                    <th>Opened</th>
                    <th>Closed</th>
                    <th>Duration</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.documentSessions.map((doc) => (
                    <tr key={`${doc.docUrl}-${doc.openedAt}`}>
                      <td>
                        <div className="vprof-doc-name">
                          <FileText size={16} />
                          <div>
                            <strong>{doc.docTitle}</strong>
                            <span>{doc.docUrl.split('/').pop()}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="vcrm-visit-time">
                          <LogIn size={12} className="vcrm-visit-icon vcrm-visit-icon-entry" />
                          <span>{formatVisitTime(doc.openedAt)}</span>
                        </div>
                      </td>
                      <td>
                        {doc.stillOpen ? (
                          <span className="vcrm-visit-live">
                            <span className="vcrm-visit-live-dot" />
                            Still reading
                          </span>
                        ) : doc.closedAt ? (
                          <div className="vcrm-visit-time">
                            <LogOut size={12} className="vcrm-visit-icon vcrm-visit-icon-exit" />
                            <span>{formatVisitTime(doc.closedAt)}</span>
                          </div>
                        ) : (
                          <span className="vcrm-visit-empty">—</span>
                        )}
                      </td>
                      <td>
                        {doc.dwellMs ? formatDuration(doc.dwellMs) : doc.stillOpen ? '—' : '—'}
                      </td>
                      <td>
                        {doc.stillOpen ? (
                          <span className="vprof-status vprof-status-open">Open</span>
                        ) : (
                          <span className="vprof-status vprof-status-closed">Closed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <aside className="exb-card vprof-side">
          <div className="vprof-side-block">
            <h4>Session summary</h4>
            <ul className="vprof-summary-list">
              <li>
                <span>Latest entry</span>
                <strong>{formatVisitTime(visitor.enteredAt ?? data.boothVisits[0]?.enteredAt)}</strong>
              </li>
              <li>
                <span>Latest exit</span>
                <strong>
                  {visitor.stillInside
                    ? 'In booth now'
                    : formatVisitTime(visitor.exitedAt ?? data.boothVisits[0]?.exitedAt)}
                </strong>
              </li>
              <li>
                <span>Avg stay</span>
                <strong>{avgStayMs > 0 ? formatDuration(avgStayMs) : '—'}</strong>
              </li>
            </ul>
          </div>

          <div className="vprof-side-block">
            <h4>Booth visits</h4>
            {data.boothVisits.length === 0 ? (
              <p className="vprof-empty-sm">No booth entry recorded yet.</p>
            ) : (
              <ul className="vprof-visit-list">
                {data.boothVisits.map((v) => (
                  <li key={`${v.sessionId}-${v.enteredAt}`}>
                    <div>
                      <strong>{formatVisitTime(v.enteredAt)}</strong>
                      <span>
                        {v.stillInside
                          ? 'Currently in booth'
                          : v.exitedAt
                            ? `Left ${formatVisitTime(v.exitedAt)}`
                            : 'No exit recorded'}
                      </span>
                    </div>
                    {v.dwellMs ? (
                      <em>{formatDuration(v.dwellMs)}</em>
                    ) : v.stillInside ? (
                      <em className="vprof-live">Live</em>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </section>

      <section className="exb-card vprof-timeline-card">
        <div className="exb-card-head">
          <h3>Activity timeline</h3>
          <Clock size={18} className="vcrm-chart-icon" />
        </div>
        {data.timeline.length === 0 ? (
          <p className="vprof-empty">No booth activity recorded yet.</p>
        ) : (
          <ol className="vprof-timeline">
            {data.timeline.map((event) => (
              <li key={event.id} className={`vprof-timeline-item vprof-timeline-${event.type}`}>
                <div className="vprof-timeline-icon">{timelineIcon(event.type)}</div>
                <div className="vprof-timeline-body">
                  <strong>{event.label}</strong>
                  {event.detail ? <span>{event.detail}</span> : null}
                </div>
                <time>{formatVisitTime(event.at)}</time>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
