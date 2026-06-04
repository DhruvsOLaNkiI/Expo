import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CheckCircle2,
  Clock,
  Download,
  Filter,
  Loader2,
  LogIn,
  LogOut,
  Mail,
  MousePointerClick,
  Network,
  Phone,
  Search,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import {
  fetchBoothVisitSessions,
  fetchBoothVisitorEngagementScores,
} from '@/dashboard/api/client';
import {
  CONVERTING_SCORE_MAX,
  CONVERTING_TIER_REFERENCE,
  CONVERTING_TIER_SEGMENTS,
  clampEngagementPoints,
  convertingPctFromPoints,
  convertingTierBadgeLabel,
  convertingTierShortLabel,
  type ConvertingTier,
} from '@/dashboard/engagementLeadScore';
import type { ExhibitorNavId } from './exhibitorConfig';
import { useExhibitorBooth } from './useExhibitorBooth';
import {
  DEMO_VISITORS,
  LEAD_VELOCITY,
  VISITOR_FILTER_TABS,
  applyDemoEngagementScores,
  exportVisitorsCsv,
  filterVisitors,
  formatVisitTime,
  mergeEngagementScores,
  buildAggregatedVisitorRows,
  type QuestionnaireStatus,
  type VisitorCategory,
  type VisitorFilterTab,
  type VisitorProfileTarget,
  type VisitorInsightRow,
} from './visitorInsightsData';

const PAGE_SIZE = 10;

type Props = {
  onNav?: (id: ExhibitorNavId) => void;
  onOpenProfile?: (visitor: VisitorProfileTarget) => void;
};

const CATEGORY_CLASS: Record<VisitorCategory, string> = {
  HOT: 'vcrm-cat-hot',
  WARM: 'vcrm-cat-warm',
  VIP: 'vcrm-cat-vip',
  COLD: 'vcrm-cat-cold',
};

const CONVERTING_BADGE_CLASS: Record<ConvertingTier, string> = {
  high: 'vcrm-conv-high',
  medium: 'vcrm-conv-medium',
  low: 'vcrm-conv-low',
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function LeadScoreRing({ score, label }: { score: number; label: string }) {
  const pct = Math.min(100, score);
  return (
    <div className="vcrm-score-cell">
      <div
        className="vcrm-score-ring vcrm-score-ring-lead"
        style={{ background: `conic-gradient(#22d3ee ${pct * 3.6}deg, rgba(255,255,255,0.08) 0deg)` }}
      >
        <span>{score}</span>
      </div>
      <small>{label}</small>
    </div>
  );
}

function InterestPtsCell({ points }: { points?: number }) {
  if (points == null || points <= 0) {
    return <span className="vcrm-visit-empty">—</span>;
  }
  const capped = clampEngagementPoints(points);
  const pct = convertingPctFromPoints(capped);
  return (
    <div className="vcrm-score-cell vcrm-interest-cell">
      <div
        className="vcrm-score-ring vcrm-score-ring-interest"
        style={{ background: `conic-gradient(#a78bfa ${pct * 3.6}deg, rgba(255,255,255,0.08) 0deg)` }}
      >
        <span>{capped}</span>
      </div>
      <small>{pct}% · max {CONVERTING_SCORE_MAX}</small>
    </div>
  );
}

function ConvertingTierBadge({
  tier,
  points,
}: {
  tier?: ConvertingTier | null;
  points?: number;
}) {
  if (points == null || points <= 0) {
    return <span className="vcrm-visit-empty">—</span>;
  }
  if (!tier) {
    return (
      <span className="vcrm-conv-badge vcrm-conv-below">
        Below threshold
        <em>{points} pts</em>
      </span>
    );
  }
  const seg = CONVERTING_TIER_SEGMENTS.find((s) => s.id === tier);
  return (
    <span className={`vcrm-conv-badge ${CONVERTING_BADGE_CLASS[tier]}`}>
      {convertingTierShortLabel(tier)} · {seg?.pctRange ?? ''}
      <em>{points} pts</em>
    </span>
  );
}

function QuestionnaireBadge({ status }: { status: QuestionnaireStatus }) {
  if (status === 'Completed') {
    return (
      <span className="vcrm-q vcrm-q-done">
        <CheckCircle2 size={13} /> Completed
      </span>
    );
  }
  if (status === 'In Progress') {
    return (
      <span className="vcrm-q vcrm-q-progress">
        <Loader2 size={13} className="vcrm-spin" /> In Progress
      </span>
    );
  }
  return (
    <span className="vcrm-q vcrm-q-pending">
      <Clock size={13} /> Not Invited
    </span>
  );
}

function VisitTimeCell({ iso }: { iso?: string }) {
  if (!iso) {
    return <span className="vcrm-visit-empty">—</span>;
  }
  return (
    <div className="vcrm-visit-time">
      <LogIn size={12} className="vcrm-visit-icon vcrm-visit-icon-entry" />
      <span>{formatVisitTime(iso)}</span>
    </div>
  );
}

function ExitTimeCell({ iso, stillInside }: { iso?: string; stillInside?: boolean }) {
  if (stillInside) {
    return (
      <span className="vcrm-visit-live">
        <span className="vcrm-visit-live-dot" />
        In booth
      </span>
    );
  }
  if (!iso) {
    return <span className="vcrm-visit-empty">—</span>;
  }
  return (
    <div className="vcrm-visit-time">
      <LogOut size={12} className="vcrm-visit-icon vcrm-visit-icon-exit" />
      <span>{formatVisitTime(iso)}</span>
    </div>
  );
}

function ContactCell({ email, phone }: { email?: string; phone?: string }) {
  if (!email && !phone) {
    return <span className="vcrm-visit-empty">—</span>;
  }
  return (
    <div className="vcrm-contact">
      {email ? (
        <a className="vcrm-contact-line" href={`mailto:${email}`} onClick={(e) => e.stopPropagation()}>
          <Mail size={11} />
          {email}
        </a>
      ) : null}
      {phone ? (
        <a className="vcrm-contact-line" href={`tel:${phone.replace(/\s/g, '')}`} onClick={(e) => e.stopPropagation()}>
          <Phone size={11} />
          {phone}
        </a>
      ) : null}
    </div>
  );
}

function LeadScoreOverviewSection({ rows }: { rows: VisitorInsightRow[] }) {
  const scored = rows.filter((r) => r.leadScore > 0);
  const avg =
    scored.length > 0
      ? Math.round(scored.reduce((n, r) => n + r.leadScore, 0) / scored.length)
      : 0;
  const top = [...scored].sort((a, b) => b.leadScore - a.leadScore).slice(0, 4);

  return (
    <article className="exb-card vcrm-summary-card vcrm-lead-score-section">
      <div className="vcrm-summary-head">
        <div>
          <h3>
            <Sparkles size={16} />
            Lead Score
          </h3>
          <p className="vcrm-section-note">
            Buyer questionnaire — psychological purchase intent. This is <strong>different data</strong>{' '}
            from menu Interest Pts below.
          </p>
        </div>
        <div className="vcrm-summary-stat">
          <strong>{avg}</strong>
          <span>Avg score</span>
        </div>
      </div>
      <ul className="vcrm-summary-visitors">
        {top.length === 0 ? (
          <li className="vcrm-summary-empty">No questionnaire scores yet.</li>
        ) : (
          top.map((row) => (
            <li key={row.id}>
              <div className="vcrm-avatar vcrm-avatar-sm" style={{ background: `hsl(${row.avatarHue} 45% 38%)` }}>
                {initials(row.name)}
              </div>
              <div className="vcrm-summary-visitor-meta">
                <strong>{row.name}</strong>
                <span>{row.scoreLabel}</span>
              </div>
              <LeadScoreRing score={row.leadScore} label={row.scoreLabel} />
            </li>
          ))
        )}
      </ul>
    </article>
  );
}

function MenuInterestSection({ rows }: { rows: VisitorInsightRow[] }) {
  const engaged = rows.filter((r) => (r.engagementPoints ?? 0) > 0);
  const avgPts =
    engaged.length > 0
      ? Math.round(
          (engaged.reduce((n, r) => n + (r.engagementPoints ?? 0), 0) / engaged.length) * 10,
        ) / 10
      : 0;

  const tierCounts = { high: 0, medium: 0, low: 0, below: 0 };
  for (const row of engaged) {
    const tier = row.convertingTier;
    if (tier === 'high') tierCounts.high += 1;
    else if (tier === 'medium') tierCounts.medium += 1;
    else if (tier === 'low') tierCounts.low += 1;
    else tierCounts.below += 1;
  }

  const top = [...engaged].sort((a, b) => (b.engagementPoints ?? 0) - (a.engagementPoints ?? 0)).slice(0, 4);

  return (
    <article className="exb-card vcrm-summary-card vcrm-menu-interest-section">
      <div className="vcrm-summary-head">
        <div>
          <h3>
            <MousePointerClick size={16} />
            Interest Pts &amp; Converting
          </h3>
          <p className="vcrm-section-note">
            Booth HUD menu clicks — <strong>{CONVERTING_SCORE_MAX} pts = 100%</strong> converting
            possibility. Separate from questionnaire Lead Score.
          </p>
        </div>
        <div className="vcrm-summary-stat vcrm-summary-stat-interest">
          <strong>{avgPts}</strong>
          <span>Avg interest pts</span>
        </div>
      </div>

      <table className="vcrm-tier-table">
        <thead>
          <tr>
            <th>Tier</th>
            <th>Points</th>
            <th>Converting</th>
            <th>Visitors</th>
          </tr>
        </thead>
        <tbody>
          {CONVERTING_TIER_REFERENCE.map((ref) => {
            const key = ref.tier.toLowerCase() as 'high' | 'medium' | 'low';
            const count = tierCounts[key];
            return (
              <tr key={ref.tier}>
                <td>
                  <span className="vcrm-tier-dot" style={{ background: ref.color }} />
                  {ref.tier}
                </td>
                <td>{ref.points}</td>
                <td>{ref.pct}</td>
                <td>{count}</td>
              </tr>
            );
          })}
          <tr>
            <td>
              <span className="vcrm-tier-dot vcrm-tier-dot-muted" />
              Below threshold
            </td>
            <td>&lt; 3.5</td>
            <td>—</td>
            <td>{tierCounts.below}</td>
          </tr>
        </tbody>
      </table>

      <ul className="vcrm-summary-visitors">
        {top.length === 0 ? (
          <li className="vcrm-summary-empty">No menu engagement yet.</li>
        ) : (
          top.map((row) => (
            <li key={row.id}>
              <div className="vcrm-avatar vcrm-avatar-sm" style={{ background: `hsl(${row.avatarHue} 45% 38%)` }}>
                {initials(row.name)}
              </div>
              <div className="vcrm-summary-visitor-meta">
                <strong>{row.name}</strong>
                <span>{convertingTierBadgeLabel(row.convertingTier ?? null, row.engagementPoints ?? 0)}</span>
              </div>
              <InterestPtsCell points={row.engagementPoints} />
            </li>
          ))
        )}
      </ul>
    </article>
  );
}

function VisitorRow({
  row,
  onOpen,
}: {
  row: VisitorInsightRow;
  onOpen: (row: VisitorInsightRow) => void;
}) {
  return (
    <tr
      className={`vcrm-row-clickable ${row.atYourBooth ? 'vcrm-row-highlight' : ''}`}
      onClick={() => onOpen(row)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(row);
        }
      }}
      tabIndex={0}
      role="button"
    >
      <td>
        <div className="vcrm-visitor">
          <div className="vcrm-avatar" style={{ background: `hsl(${row.avatarHue} 45% 38%)` }}>
            {initials(row.name)}
          </div>
          <div>
            <strong>{row.name}</strong>
            <span>{row.company}</span>
            <em>
              {row.role}
              {(row.visitCount ?? 0) > 1 ? ` · ${row.visitCount} visits` : ''}
            </em>
          </div>
        </div>
      </td>
      <td>
        <ContactCell email={row.email} phone={row.phone} />
      </td>
      <td>
        <LeadScoreRing score={row.leadScore} label={row.scoreLabel} />
      </td>
      <td>
        <InterestPtsCell points={row.engagementPoints} />
      </td>
      <td>
        <ConvertingTierBadge tier={row.convertingTier} points={row.engagementPoints} />
      </td>
      <td>
        <span className={`vcrm-cat ${CATEGORY_CLASS[row.category]}`}>{row.category}</span>
      </td>
      <td>
        <span className="vcrm-visit-count">{(row.visitCount ?? 1).toLocaleString()}</span>
      </td>
      <td>
        <VisitTimeCell iso={row.enteredAt} />
      </td>
      <td>
        <ExitTimeCell iso={row.exitedAt} stillInside={row.stillInside} />
      </td>
      <td>
        <QuestionnaireBadge status={row.questionnaire} />
      </td>
    </tr>
  );
}

export function VisitorInsightsPage({ onOpenProfile }: Props) {
  const { boothId, booth } = useExhibitorBooth();
  const boothCompany = booth?.company.companyName ?? 'Vertex Elite';

  const [tab, setTab] = useState<VisitorFilterTab>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [visitSessions, setVisitSessions] = useState<Awaited<ReturnType<typeof fetchBoothVisitSessions>>>([]);
  const [engagementScores, setEngagementScores] = useState<
    Awaited<ReturnType<typeof fetchBoothVisitorEngagementScores>>
  >([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [sessions, scores] = await Promise.all([
        fetchBoothVisitSessions(boothId),
        fetchBoothVisitorEngagementScores(boothId),
      ]);
      if (!cancelled) {
        setVisitSessions(sessions);
        setEngagementScores(scores);
      }
    };
    void load();
    const interval = window.setInterval(() => void load(), 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [boothId]);

  const allRows = useMemo(() => {
    const base =
      visitSessions.length > 0
        ? buildAggregatedVisitorRows(visitSessions, boothCompany)
        : DEMO_VISITORS;
    const withEngagement =
      engagementScores.length > 0
        ? mergeEngagementScores(base, engagementScores)
        : applyDemoEngagementScores(base);
    return withEngagement;
  }, [visitSessions, engagementScores, boothCompany]);

  const filtered = useMemo(
    () => filterVisitors(allRows, tab, search, boothCompany),
    [allRows, tab, search, boothCompany],
  );

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const hotAtBooth = allRows.filter((r) => r.atYourBooth && r.category === 'HOT').length;
  const conversionScore = 8.4;
  const conversionDelta = 12;

  return (
    <div className="vcrm-page">
      <div className="vcrm-toolbar">
        <div className="vcrm-search">
          <Search size={16} />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={`Search across ${allRows.length} active visitors…`}
          />
        </div>
        <div className="vcrm-toolbar-actions">
          <button type="button" className="exb-btn vcrm-btn-ghost">
            <Filter size={14} />
            Advanced Filters
          </button>
          <button
            type="button"
            className="exb-btn exb-btn-primary"
            onClick={() => exportVisitorsCsv(filtered)}
          >
            <Download size={14} />
            Export CSV
          </button>
        </div>
      </div>

      <div className="vcrm-tabs-row">
        <div className="vcrm-tabs">
          {VISITOR_FILTER_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`vcrm-tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => {
                setTab(t.id);
                setPage(1);
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="vcrm-tab-hint">
          One row per visitor at <strong>{boothCompany}</strong> — click a row for full visit history
        </p>
      </div>

      <section className="exb-row exb-row-split vcrm-dual-summary">
        <LeadScoreOverviewSection rows={allRows} />
        <MenuInterestSection rows={allRows} />
      </section>

      <section className="exb-card vcrm-table-card">
        <div className="vcrm-table-legend">
          <p>
            <strong>Lead Score</strong> — questionnaire intent (kept separate).{' '}
            <strong>Interest Pts</strong> — menu engagement ({CONVERTING_SCORE_MAX} = 100%).{' '}
            <strong>Visits</strong> — total booth entries; times on profile.{' '}
            <strong>Converting</strong> — High · 100% (14), Medium · 50% (7–13.5), Low · 25%
            (3.5–6.5), below threshold under 3.5 pts.
          </p>
        </div>
        <div className="exb-table-scroll">
          <table className="exb-table vcrm-table">
            <thead>
              <tr>
                <th>Visitor</th>
                <th>Contact</th>
                <th>Lead Score</th>
                <th>Interest Pts</th>
                <th>Converting</th>
                <th>Category</th>
                <th>Visits</th>
                <th>Last entry</th>
                <th>Last exit</th>
                <th>Questionnaire</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="exb-empty">
                    No visitors match your filters.
                  </td>
                </tr>
              ) : (
                pageRows.map((row) => (
                  <VisitorRow key={row.id} row={row} onOpen={(r) => onOpenProfile?.(r)} />
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="exb-table-footer">
          <span>
            Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, total)} of{' '}
            {total} visitors
          </span>
          <div className="exb-pagination">
            <button
              type="button"
              className="exb-btn"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                className={`exb-btn ${safePage === n ? 'active' : ''}`}
                onClick={() => setPage(n)}
              >
                {n}
              </button>
            ))}
            {totalPages > 5 && <span className="vcrm-ellipsis">…</span>}
            <button
              type="button"
              className="exb-btn"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </section>

      <section className="exb-row vcrm-analytics-row">
        <article className="exb-card vcrm-chart-card">
          <div className="exb-card-head">
            <h3>Lead Velocity Trend</h3>
            <TrendingUp size={18} className="vcrm-chart-icon" />
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={LEAD_VELOCITY} barSize={28}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="hour" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
              <Tooltip
                cursor={{ fill: 'rgba(34,211,238,0.08)' }}
                contentStyle={{
                  background: '#0b1220',
                  border: '1px solid rgba(34,211,238,0.25)',
                  borderRadius: 10,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="leads" radius={[6, 6, 0, 0]}>
                {LEAD_VELOCITY.map((entry) => (
                  <Cell
                    key={entry.hour}
                    fill={entry.hour === '15:00' ? '#22d3ee' : 'rgba(255,255,255,0.12)'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </article>

        <article className="exb-card vcrm-conversion-card">
          <div className="vcrm-conversion-head">
            <div>
              <h3>Conversion Potential</h3>
              <div className="vcrm-conversion-score">
                <strong>{conversionScore}</strong>
                <span>/ 10</span>
              </div>
              <p className="vcrm-conversion-delta">
                <TrendingUp size={14} /> +{conversionDelta}%
              </p>
            </div>
            <div className="vcrm-conversion-icon">
              <Network size={22} />
            </div>
          </div>
          <p className="vcrm-conversion-copy">
            Visitor engagement is peaking at your booth ({boothCompany}). Automated follow-ups are
            triggered for <strong>{hotAtBooth + 4}</strong> leads with high questionnaire scores.
          </p>
        </article>
      </section>
    </div>
  );
}
