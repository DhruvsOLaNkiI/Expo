import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  Cell as PieSlice,
} from 'recharts';
import {
  Bell,
  Calendar,
  Clock3,
  Download,
  FileText,
  UserCheck,
  Users,
  UsersRound,
} from 'lucide-react';
import {
  ColumnDef,
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import './exhibitorDashboard.css';
import { ExhibitorBoothPreview } from './ExhibitorBoothPreview';
import { TrafficHeatmap } from './TrafficHeatmap';
import { useExhibitorBooth } from './useExhibitorBooth';
import { boothDisplayCode, type ExhibitorNavId } from './exhibitorConfig';
import { ExhibitorChecklistBanner } from './ExhibitorChecklistBanner';
import {
  buildExhibitorChecklist,
  exhibitorChecklistProgress,
} from './exhibitorUpload';
import {
  fetchBoothDocumentStats,
  fetchBoothFaqSubmissions,
  fetchBoothLivePresence,
  fetchBoothVisitSessions,
  fetchBoothVisitorStats,
  type BoothDocumentStatRow,
  type BoothLivePresence,
  type BoothVisitorStats,
  type FaqSubmissionRow,
} from '@/dashboard/api/client';

type DocRow = { document: string; opens: number; avgTime: string; downloads: number; progress: number };

type LiveVisitorRow = {
  id: string;
  name: string;
  location: string;
  time: string;
  duration: string;
};

type FaqOverviewStats = {
  totalQuestions: number;
  uniqueVisitors: number;
  avgQuestions: string;
  topQuestions: { question: string; count: number }[];
};

type AssistanceRow = {
  visitor: string;
  time: string;
  request: string;
  status: string;
};

function formatDwell(ms: number): string {
  if (ms <= 0) return '—';
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

function labelFromDocStat(row: BoothDocumentStatRow): string {
  const title = row.docTitle?.trim();
  if (title) return title;
  try {
    const path = new URL(row.docUrl, 'https://expo.local').pathname;
    const base = path.split('/').pop() ?? 'Document';
    return decodeURIComponent(base)
      .replace(/\.(pdf|png|jpe?g|webp|mp4|svg)$/i, '')
      .replace(/[-_]+/g, ' ')
      .trim() || 'Document';
  } catch {
    return 'Document';
  }
}

function docStatsToRows(stats: BoothDocumentStatRow[]): DocRow[] {
  if (stats.length === 0) return [];
  const maxOpens = Math.max(...stats.map((s) => s.opens), 1);
  return stats.slice(0, 5).map((s) => ({
    document: labelFromDocStat(s),
    opens: s.opens,
    avgTime: formatDwell(s.avgDwellMs),
    downloads: s.closes,
    progress: Math.round((s.opens / maxOpens) * 100),
  }));
}

function formatEntryClock(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatDurationSince(iso: string): string {
  const ms = Math.max(0, Date.now() - new Date(iso).getTime());
  return formatDwell(ms);
}

function liveRowsFromPresence(presence: BoothLivePresence): LiveVisitorRow[] {
  return presence.visitors
    .slice(0, 8)
    .map((v) => ({
      id: v.visitorKey,
      name: v.visitorName?.trim() || v.visitorId?.trim() || 'Guest visitor',
      location: 'In your booth',
      time: formatEntryClock(v.enteredAt),
      duration: formatDurationSince(v.enteredAt),
    }));
}

function liveRowsFromSessions(sessions: Awaited<ReturnType<typeof fetchBoothVisitSessions>>): LiveVisitorRow[] {
  const open = sessions.filter((s) => s.stillInside);
  const list =
    open.length > 0
      ? open
      : sessions.filter((s) => {
          if (s.exitedAt) return false;
          return Date.now() - new Date(s.enteredAt).getTime() < 5 * 60_000;
        });

  return list
    .sort((a, b) => b.enteredAt.localeCompare(a.enteredAt))
    .slice(0, 8)
    .map((s) => ({
      id: s.visitId ?? `${s.sessionId}-${s.enteredAt}`,
      name: s.visitorName?.trim() || s.visitorId?.trim() || 'Guest visitor',
      location: 'In your booth',
      time: formatEntryClock(s.enteredAt),
      duration: s.stillInside ? formatDurationSince(s.enteredAt) : formatDwell(s.dwellMs ?? 0),
    }));
}

function aggregateFaqStats(submissions: FaqSubmissionRow[]): FaqOverviewStats {
  const uniqueSessions = new Set(submissions.map((s) => s.sessionId));
  let totalQuestions = 0;
  const questionCounts = new Map<string, number>();

  for (const sub of submissions) {
    for (const a of sub.answers) {
      totalQuestions += 1;
      const q = a.questionText.trim() || 'Question';
      questionCounts.set(q, (questionCounts.get(q) ?? 0) + 1);
    }
  }

  const topQuestions = [...questionCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([question, count]) => ({ question, count }));

  return {
    totalQuestions,
    uniqueVisitors: uniqueSessions.size,
    avgQuestions:
      uniqueSessions.size > 0 ? (totalQuestions / uniqueSessions.size).toFixed(2) : '0',
    topQuestions,
  };
}

function assistanceFromFaq(submissions: FaqSubmissionRow[]): AssistanceRow[] {
  const rows: AssistanceRow[] = [];
  for (const sub of submissions.slice(0, 8)) {
    const visitor = sub.visitorName?.trim() || sub.visitorId?.trim() || 'Guest visitor';
    const time = new Date(sub.submittedAt).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
    for (const a of sub.answers.slice(0, 1)) {
      rows.push({
        visitor,
        time,
        request: `${a.questionText} → ${a.optionLabel}: ${a.optionText}`,
        status: 'Completed',
      });
    }
    if (rows.length >= 5) break;
  }
  return rows.slice(0, 5);
}

function formatGrowthPct(pct: number): string {
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct}%`;
}

const qualityLeads = [
  { name: 'Hot Leads', value: 25, color: '#ef4444' },
  { name: 'Warm Leads', value: 31, color: '#f59e0b' },
  { name: 'Cold Leads', value: 18, color: '#3b82f6' },
];

const funnelData = [
  { value: 1683, name: 'Booth Entered', fill: '#8b5cf6' },
  { value: 982, name: 'Viewed Brochure', fill: '#3b82f6' },
  { value: 512, name: 'Viewed Price List', fill: '#22c55e' },
  { value: 238, name: 'Asked Questions', fill: '#f59e0b' },
  { value: 74, name: 'Generated Lead', fill: '#ef4444' },
];

const EMPTY_FAQ_STATS: FaqOverviewStats = {
  totalQuestions: 0,
  uniqueVisitors: 0,
  avgQuestions: '0',
  topQuestions: [],
};

function funnelPct(value: number, top: number): string {
  if (top <= 0) return '0%';
  return value === top ? '100%' : `${((value / top) * 100).toFixed(1)}%`;
}

function VisitorEngagementFunnel() {
  const top = funnelData[0]?.value ?? 1;

  return (
    <div className="exb-funnel-body">
      {funnelData.map((step, index) => {
        const topWidth = (step.value / top) * 100;
        const nextValue = funnelData[index + 1]?.value ?? step.value * 0.35;
        const bottomWidth = (nextValue / top) * 100;
        const topInset = Math.max(0, (100 - topWidth) / 2);
        const bottomInset = Math.max(0, (100 - bottomWidth) / 2);

        return (
          <div key={step.name} className="exb-funnel-row">
            <div className="exb-funnel-visual">
              <div
                className="exb-funnel-segment"
                style={{
                  backgroundColor: step.fill,
                  clipPath: `polygon(${topInset}% 0, ${100 - topInset}% 0, ${100 - bottomInset}% 100%, ${bottomInset}% 100%)`,
                }}
              />
            </div>
            <div className="exb-funnel-metric">
              <span className="exb-funnel-dot" style={{ backgroundColor: step.fill }} />
              <span className="exb-funnel-label">{step.name}</span>
              <b className="exb-funnel-pct">{funnelPct(step.value, top)}</b>
            </div>
          </div>
        );
      })}
      <div className="exb-funnel-foot">
        <span>{top.toLocaleString()} booth entries</span>
        <span>{funnelData[funnelData.length - 1]?.value.toLocaleString() ?? 0} leads</span>
      </div>
    </div>
  );
}

const heatX = ['Entry', 'Reception', 'Lounge', 'TV Screen', 'Brochure Wall', 'Agent Desk', 'Exit'];
const heatY = ['10 AM', '12 PM', '2 PM', '4 PM', '6 PM'];
const heatData = [
  [20, 35, 42, 50, 29, 31, 12],
  [28, 41, 52, 60, 33, 38, 19],
  [35, 48, 66, 74, 41, 45, 24],
  [30, 43, 58, 62, 38, 40, 20],
  [18, 27, 36, 44, 26, 29, 15],
];

const columnHelper = createColumnHelper<DocRow>();
const docColumns: ColumnDef<DocRow, unknown>[] = [
  columnHelper.accessor('document', { header: 'Document' }),
  columnHelper.accessor('opens', { header: 'Opens' }),
  columnHelper.accessor('avgTime', { header: 'Avg Time' }),
  columnHelper.accessor('downloads', { header: 'Downloads' }),
];

function sparkFromSeries(values: number[]) {
  if (!values.length) return [{ y: 0 }];
  return values.map((y, x) => ({ x, y: Math.max(0, y) }));
}

type KpiCardProps = {
  title: string;
  value: string;
  sub: string;
  growth: string;
  color: string;
  icon: LucideIcon;
  sparkValues?: number[];
};

function KpiCard({ title, value, sub, growth, color, icon: Icon, sparkValues }: KpiCardProps) {
  const spark = sparkFromSeries(sparkValues ?? []);
  const showSpark = (sparkValues?.some((v) => v > 0) ?? false) && spark.some((p) => p.y > 0);
  return (
    <motion.div whileHover={{ y: -2 }} className="exb-card exb-kpi-card">
      <div className="exb-kpi-head">
        <div className="exb-icon-wrap" style={{ borderColor: `${color}66`, color }}>
          <Icon size={16} />
        </div>
        <div className="exb-kpi-body">
          <p className="exb-muted">{title}</p>
          <p className="exb-kpi-value">{value}</p>
          <p className="exb-growth" style={{ color }}>
            {growth}
          </p>
          <p className="exb-kpi-sub">{sub}</p>
        </div>
      </div>
      {showSpark && (
        <div className="exb-spark">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={spark}>
              <defs>
                <linearGradient id={`k-${title.replace(/\s/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="y"
                stroke={color}
                fill={`url(#k-${title.replace(/\s/g, '')})`}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </motion.div>
  );
}

type Props = {
  onOpenDocuments?: () => void;
  onNav?: (id: ExhibitorNavId) => void;
};

export function OverviewDashboard({ onOpenDocuments, onNav }: Props) {
  const { booth, boothId } = useExhibitorBooth();
  const [visitorStats, setVisitorStats] = useState<BoothVisitorStats | null>(null);
  const [docRows, setDocRows] = useState<DocRow[]>([]);
  const [livePresence, setLivePresence] = useState<BoothLivePresence>({
    count: 0,
    visitors: [],
    mongoConnected: false,
  });
  const [liveVisitors, setLiveVisitors] = useState<LiveVisitorRow[]>([]);
  const [faqStats, setFaqStats] = useState<FaqOverviewStats>(EMPTY_FAQ_STATS);
  const [assistanceHistory, setAssistanceHistory] = useState<AssistanceRow[]>([]);
  const checklist = booth ? buildExhibitorChecklist(booth) : [];
  const progress = exhibitorChecklistProgress(checklist);
  const table = useReactTable({
    data: docRows,
    columns: docColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [stats, docs, faqSubs] = await Promise.all([
        fetchBoothVisitorStats(boothId),
        fetchBoothDocumentStats(boothId),
        fetchBoothFaqSubmissions(boothId),
      ]);
      if (cancelled) return;
      if (stats) setVisitorStats(stats);
      setDocRows(docStatsToRows(docs));
      const faq = aggregateFaqStats(faqSubs);
      setFaqStats(faq);
      setAssistanceHistory(assistanceFromFaq(faqSubs));
    };
    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [boothId]);

  useEffect(() => {
    let cancelled = false;
    const pollLive = async () => {
      const presence = await fetchBoothLivePresence(boothId);
      if (cancelled) return;
      setLivePresence(presence);
      if (presence.mongoConnected) {
        setLiveVisitors(liveRowsFromPresence(presence));
        setVisitorStats((prev) =>
          prev ? { ...prev, liveVisitorsNow: presence.count, mongoConnected: true } : prev,
        );
        return;
      }
      const sessions = await fetchBoothVisitSessions(boothId);
      if (cancelled) return;
      setLiveVisitors(liveRowsFromSessions(sessions));
    };
    void pollLive();
    const timer = window.setInterval(() => void pollLive(), 1_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [boothId]);

  const trendSpark = useMemo(
    () => visitorStats?.visitTrend.map((d) => d.visitors) ?? [],
    [visitorStats],
  );

  const kpis = useMemo((): KpiCardProps[] => {
    const s = visitorStats;
    const trend = s?.visitTrend ?? [];
    return [
      {
        title: 'Live Visitors',
        value: String(livePresence.mongoConnected ? livePresence.count : (s?.liveVisitorsNow ?? 0)),
        sub: livePresence.mongoConnected
          ? 'Updates every second while guests are in your booth'
          : 'Currently in your booth',
        growth: livePresence.mongoConnected ? 'Live · 1s refresh' : s?.mongoConnected ? 'Live' : 'Demo',
        color: '#22c55e',
        icon: Users,
        sparkValues: trend.length ? trend : undefined,
      },
      {
        title: 'Total Visitors',
        value: (s?.uniqueVisitorsTotal ?? 0).toLocaleString(),
        sub: 'Unique people who entered your booth',
        growth: `${formatGrowthPct(s?.uniqueVisitorsGrowthPct ?? 0)} vs prev 7 days`,
        color: '#8b5cf6',
        icon: UsersRound,
        sparkValues: trendSpark,
      },
      {
        title: 'Avg. Time In Booth',
        value: formatDwell(s?.avgDwellMsInBooth ?? 0),
        sub: `Last 7 days: ${(s?.uniqueVisitorsLast7Days ?? 0).toLocaleString()} unique`,
        growth: s?.mongoConnected ? 'From zone tracking' : 'No data yet',
        color: '#3b82f6',
        icon: Clock3,
      },
      {
        title: 'Total Booth Visits',
        value: (s?.totalBoothVisits ?? 0).toLocaleString(),
        sub: 'Every time someone walks in (includes repeats)',
        growth: formatGrowthPct(s?.totalBoothVisitsGrowthPct ?? 0),
        color: '#f59e0b',
        icon: FileText,
        sparkValues: trend.length ? trend : undefined,
      },
      {
        title: 'FAQ Engagements',
        value: String(faqStats.uniqueVisitors),
        sub: `${faqStats.totalQuestions} answers submitted`,
        growth: faqStats.totalQuestions > 0 ? `${faqStats.avgQuestions} avg / visitor` : 'No FAQ data yet',
        color: '#ec4899',
        icon: UserCheck,
      },
    ];
  }, [visitorStats, trendSpark, faqStats, livePresence]);

  const visitTrendChart = useMemo(
    () =>
      visitorStats?.visitTrend.map((d) => ({ day: d.label, visitors: d.visitors })) ?? [
        { day: '—', visitors: 0 },
      ],
    [visitorStats],
  );

  const hasVisitTrend = useMemo(
    () => visitTrendChart.some((d) => d.visitors > 0),
    [visitTrendChart],
  );

  const hot = useMemo(() => qualityLeads.reduce((s, x) => s + x.value, 0), []);

  return (
    <>
        {onNav && <ExhibitorChecklistBanner onGo={onNav} />}
        {booth && progress.pct < 100 && onNav && (
          <section className="exb-card exb-quick-setup">
            <h3>Complete your booth ({progress.pct}%)</h3>
            <p className="exb-muted">Use dedicated pages for each upload — no generic file picker.</p>
            <div className="exb-quick-setup-btns">
              <button type="button" className="exb-btn" onClick={() => onNav('setup')}>Booth Setup</button>
              <button type="button" className="exb-btn" onClick={() => onNav('documents')}>Documents & Brochures</button>
              <button type="button" className="exb-btn" onClick={() => onNav('uploads')}>Upload Documents</button>
              <button type="button" className="exb-btn" onClick={() => onNav('faq')}>FAQ</button>
              <button type="button" className="exb-btn exb-btn-primary" onClick={() => onNav('salesChat')}>Sales Chat</button>
            </div>
          </section>
        )}
        <p className="exb-metrics-hint">
          <strong>Total Visitors</strong> counts each person once per booth (registered profile ID, or one per browser
          session if they did not sign in). <strong>Total Booth Visits</strong> counts every entry, including return
          visits. Data updates when guests explore the 3D expo with MongoDB connected.
          {!visitorStats?.mongoConnected && (
            <span className="exb-metrics-warn"> Start the dev server with MONGODB_URI to record live stats.</span>
          )}
        </p>

        <section className="exb-kpi-grid">{kpis.map((k) => <KpiCard key={k.title} {...k} />)}</section>

        <section className="exb-row exb-row-2">
          <article className="exb-card exb-chart-card">
            <div className="exb-card-head">
              <h3>Booth Visit Trend</h3>
              <button type="button" className="exb-pill">
                Last 7 Days · unique / day
              </button>
            </div>
            {hasVisitTrend ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={visitTrendChart}>
                  <defs>
                    <linearGradient id="visitLine" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <Tooltip contentStyle={{ background: '#0b1220', border: '1px solid rgba(255,255,255,0.16)', borderRadius: 12 }} />
                  <Area type="monotone" dataKey="visitors" stroke="#8b5cf6" fill="url(#visitLine)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="exb-chart-empty">
                No booth visits yet — data appears when visitors enter your booth in the 3D expo.
              </div>
            )}
          </article>

          <article className="exb-card">
            <div className="exb-card-head"><h3>Visitor Quality (Leads)</h3></div>
            <div className="exb-donut-wrap">
              <ResponsiveContainer width="52%" height={220}>
                <PieChart>
                  <Pie data={qualityLeads} dataKey="value" nameKey="name" innerRadius={62} outerRadius={90} paddingAngle={2}>
                    {qualityLeads.map((x) => <PieSlice key={x.name} fill={x.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="exb-legend">
                <h4>{hot}<span>Total Leads</span></h4>
                {qualityLeads.map((x) => <p key={x.name}><i style={{ background: x.color }} />{x.name}<b>{x.value}</b></p>)}
                <ul>
                  <li><span>Lead Conversion</span><b>5.9%</b></li>
                  <li><span>Qualified Leads</span><b>68.9%</b></li>
                  <li><span>Interested Visitors</span><b>32.4%</b></li>
                </ul>
              </div>
            </div>
          </article>
        </section>

        <section className="exb-row exb-row-2 exb-row-funnel">
          <article className="exb-card">
            <div className="exb-card-head"><h3>Top Brochures & Documents</h3><button type="button" className="exb-link" onClick={onOpenDocuments}>View All</button></div>
            {docRows.length === 0 ? (
              <p className="exb-chart-empty" style={{ minHeight: 120 }}>
                No document opens yet — visitors appear here when they open brochures or PDFs in your booth.
              </p>
            ) : (
              <>
            <table className="exb-table">
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id}>{hg.headers.map((h) => <th key={h.id}>{flexRender(h.column.columnDef.header, h.getContext())}</th>)}</tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id}>
                    {row.getVisibleCells().map((cell) => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="exb-progress-list">
              {docRows.map((r) => (
                <div key={r.document}><span>{r.document}</span><div><i style={{ width: `${r.progress}%` }} /></div></div>
              ))}
            </div>
              </>
            )}
          </article>

          <article className="exb-card exb-funnel-card">
            <div className="exb-card-head"><h3>Visitor Engagement Funnel</h3></div>
            <VisitorEngagementFunnel />
          </article>
        </section>

        <section className="exb-row exb-row-4">
          <article className="exb-card">
            <div className="exb-card-head">
              <h3>AI Assistant & FAQ Analytics</h3>
              <button type="button" className="exb-link" onClick={() => onNav?.('faq')}>View All</button>
            </div>
            <div className="exb-metrics-4">
              <div><span>Total Questions</span><b>{faqStats.totalQuestions}</b></div>
              <div><span>Unique Visitors</span><b>{faqStats.uniqueVisitors}</b></div>
              <div><span>Avg Questions</span><b>{faqStats.avgQuestions}</b></div>
              <div><span>Responses</span><b>{faqStats.totalQuestions}</b></div>
            </div>
            <table className="exb-table">
              <thead><tr><th>Top Questions Asked</th><th>Count</th></tr></thead>
              <tbody>
                {faqStats.topQuestions.length === 0 ? (
                  <tr><td colSpan={2} className="exb-empty">No FAQ answers yet — data appears when visitors complete your booth FAQ.</td></tr>
                ) : (
                  faqStats.topQuestions.map((q) => <tr key={q.question}><td>{q.question}</td><td>{q.count}</td></tr>)
                )}
              </tbody>
            </table>
          </article>

          <article className="exb-card exb-live-list">
            <div className="exb-card-head">
              <h3>Live Visitors In Booth</h3>
              <button type="button" className="exb-link" onClick={() => onNav?.('insights')}>View All</button>
            </div>
            <div className="scroll">
              {liveVisitors.length === 0 ? (
                <p className="exb-empty" style={{ padding: '24px 12px' }}>
                  No one is in your booth right now.
                </p>
              ) : (
                liveVisitors.map((v) => (
                  <div className="item" key={v.id}>
                    <div className="avatar">{v.name.split(' ').map((x) => x[0]).join('').slice(0, 2)}</div>
                    <div className="meta"><strong>{v.name}</strong><span>{v.location}</span></div>
                    <div className="meta right"><strong>{v.time}</strong><span>{v.duration}</span></div>
                    <span className="online-dot" />
                  </div>
                ))
              )}
            </div>
          </article>
        </section>

        <section className="exb-row exb-row-5">
          <article className="exb-card">
            <div className="exb-card-head">
              <h3>Assistance History</h3>
              <button type="button" className="exb-link" onClick={() => onNav?.('faq')}>View All</button>
            </div>
            <table className="exb-table">
              <thead><tr><th>Visitor</th><th>Time</th><th>Request</th><th>Status</th></tr></thead>
              <tbody>
                {assistanceHistory.length === 0 ? (
                  <tr><td colSpan={4} className="exb-empty">No FAQ responses recorded yet.</td></tr>
                ) : (
                  assistanceHistory.map((r) => (
                    <tr key={`${r.visitor}-${r.time}-${r.request}`}>
                      <td>{r.visitor}</td><td>{r.time}</td><td>{r.request}</td>
                      <td><span className={`status ${r.status.toLowerCase()}`}>{r.status}</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </article>
          <article className="exb-card exb-booth-preview-card">
            <div className="exb-card-head">
              <div>
                <h3>Your Booth</h3>
                <p className="exb-muted" style={{ margin: '4px 0 0', fontSize: 11 }}>
                  {booth?.company.companyName ?? booth?.name ?? 'Booth'} · {boothDisplayCode(boothId)} · LMB orbit · scroll zoom
                </p>
              </div>
              <span className="exb-pill">Live model</span>
            </div>
            <ExhibitorBoothPreview />
          </article>
        </section>

        <section className="exb-card exb-heatmap-card">
          <div className="exb-card-head"><h3>Traffic Heatmap (Booth)</h3><button className="exb-link">View Full Heatmap</button></div>
          <div className="exb-heatmap-wrap">
            <TrafficHeatmap
              xLabels={heatX}
              yLabels={heatY}
              data={heatData}
              cellStyle={(_, ratio) => ({
                background: `rgba(${Math.round(255 * ratio)}, ${Math.round(180 * (1 - ratio) + 80)}, ${Math.round(255 * (1 - ratio))}, 0.88)`,
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px',
                fontSize: '11px',
                color: '#e5e7eb',
              })}
            />
          </div>
        </section>
    </>
  );
}
