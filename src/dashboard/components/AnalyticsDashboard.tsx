import { useCallback, useEffect, useState } from 'react';
import { fetchAnalyticsDashboard } from '../api/client';
import { getCmsPublicUrl, getExpoPublicUrl, isStandaloneDashboard } from '../config';
import type { AnalyticsDashboardData } from '../types';
import { useStore } from '@/store';

function formatDwell(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
}

function formatZone(zone: string): string {
  if (zone === 'registration_lobby') return 'Registration lobby';
  if (zone === 'expo_hall') return 'Main expo hall';
  if (zone === 'help_desk') return 'Help Desk';
  if (zone === 'ai_chat') return 'AI concierge';
  if (zone === 'viewing_document') return 'Viewing documents';
  if (zone.startsWith('booth:')) {
    return zone
      .slice(6)
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  return zone;
}

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">{label}</p>
      <p className="mt-2 text-2xl font-bold text-[#d4af37]">{value}</p>
      {hint ? <p className="mt-1 text-xs text-white/45">{hint}</p> : null}
    </div>
  );
}

function CategoryBar({
  hot,
  warm,
  cold,
}: {
  hot: number;
  warm: number;
  cold: number;
}) {
  const total = hot + warm + cold || 1;
  return (
    <div className="space-y-2">
      {(
        [
          ['Hot leads', hot, 'bg-red-500/80'],
          ['Warm leads', warm, 'bg-amber-500/80'],
          ['Cold leads', cold, 'bg-sky-500/70'],
        ] as const
      ).map(([label, n, color]) => (
        <div key={label}>
          <div className="mb-1 flex justify-between text-xs text-white/60">
            <span>{label}</span>
            <span>{n}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div className={`h-full ${color}`} style={{ width: `${(n / total) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function AnalyticsDashboard({ standalone }: { standalone?: boolean } = {}) {
  const isStandalone = standalone ?? isStandaloneDashboard();
  const setCmsPage = useStore((s) => s.setCmsPage);
  const [data, setData] = useState<AnalyticsDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const next = await fetchAnalyticsDashboard();
    if (!next) {
      setError('Could not load analytics. Set MONGODB_URI in .env and run npm run dev.');
      setData(null);
    } else {
      setData(next);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(t);
  }, [load]);

  return (
    <div className="min-h-screen bg-[#0a0a10] text-white">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-6 py-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#d4af37]">
            Virtual Expo
          </p>
          <h1 className="text-xl font-bold tracking-tight">Visitor &amp; engagement analytics</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg border border-white/15 px-4 py-2 text-xs font-semibold uppercase tracking-wider hover:bg-white/5"
          >
            Refresh
          </button>
          {isStandalone ? (
            <>
              <a
                href={getCmsPublicUrl()}
                className="rounded-lg border border-[#d4af37]/30 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#d4af37] hover:bg-[#d4af37]/10"
              >
                CMS
              </a>
              <a
                href={getExpoPublicUrl()}
                className="rounded-lg border border-white/15 px-4 py-2 text-xs font-semibold uppercase tracking-wider hover:bg-white/5"
              >
                ← 3D Expo
              </a>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setCmsPage('cms')}
                className="rounded-lg border border-[#d4af37]/30 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#d4af37] hover:bg-[#d4af37]/10"
              >
                CMS
              </button>
              <button
                type="button"
                onClick={() => setCmsPage('expo')}
                className="rounded-lg border border-white/15 px-4 py-2 text-xs font-semibold uppercase tracking-wider hover:bg-white/5"
              >
                ← 3D Expo
              </button>
            </>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 p-6">
        {loading && !data ? (
          <p className="text-sm text-white/50">Loading analytics…</p>
        ) : null}
        {error ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
            {error}
          </div>
        ) : null}

        {data ? (
          <>
            <p className="text-xs text-white/40">
              Updated {new Date(data.asOf).toLocaleString()} · Sessions refresh every 30s
            </p>

            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Registered visitors" value={data.visitors.total} hint="All time in MongoDB" />
              <StatCard label="Registered today" value={data.visitors.registeredToday} />
              <StatCard label="Lobby check-ins today" value={data.visitors.checkedInToday} />
              <StatCard
                label="Live on platform"
                value={data.sessions.activeNow}
                hint={`${data.sessions.totalSessions} total sessions tracked`}
              />
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
                <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-white/50">
                  Buyer questionnaire ratings
                </h2>
                <div className="mb-4 flex items-end gap-6">
                  <div>
                    <p className="text-[10px] uppercase text-white/40">Submissions</p>
                    <p className="text-3xl font-bold text-white">{data.questionnaires.total}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-white/40">Avg score</p>
                    <p className="text-3xl font-bold text-[#d4af37]">
                      {data.questionnaires.avgScore}
                      <span className="text-lg text-white/40"> / 48</span>
                    </p>
                  </div>
                </div>
                <CategoryBar
                  hot={data.questionnaires.byCategory.hot}
                  warm={data.questionnaires.byCategory.warm}
                  cold={data.questionnaires.byCategory.cold}
                />
                <ul className="mt-5 space-y-2 border-t border-white/10 pt-4">
                  {data.questionnaires.recent.length === 0 ? (
                    <li className="text-xs text-white/40">No questionnaire submissions yet.</li>
                  ) : (
                    data.questionnaires.recent.map((q, i) => (
                      <li
                        key={`${q.submittedAt}-${i}`}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <span className="truncate text-white/80">{q.visitorName}</span>
                        <span className="shrink-0 text-xs text-white/45">
                          {q.totalScore} pts · {q.categoryLabel}
                        </span>
                      </li>
                    ))
                  )}
                </ul>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
                <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-white/50">
                  Documents opened
                </h2>
                <p className="mb-4 text-sm text-white/55">
                  <span className="font-bold text-white">{data.documents.totalOpens}</span> opens
                  across <span className="font-bold text-white">{data.documents.uniqueDocs}</span>{' '}
                  unique resources
                </p>
                <ul className="space-y-2">
                  {data.documents.topDocuments.length === 0 ? (
                    <li className="text-xs text-white/40">No brochure / PDF opens tracked yet.</li>
                  ) : (
                    data.documents.topDocuments.map((d) => (
                      <li key={d.title} className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate text-white/80">{d.title}</span>
                        <span className="shrink-0 flex gap-2">
                          {d.avgDwellMs != null && d.avgDwellMs > 0 ? (
                            <span className="rounded bg-violet-500/15 px-2 py-0.5 text-[10px] text-violet-200">
                              avg {Math.round(d.avgDwellMs / 1000)}s
                            </span>
                          ) : null}
                          <span className="rounded bg-white/10 px-2 py-0.5 text-xs font-semibold">
                            {d.opens}
                          </span>
                        </span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
                <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-white/50">
                  Where visitors stay
                </h2>
                <ul className="space-y-3">
                  {data.zones.topZones.length === 0 ? (
                    <li className="text-xs text-white/40">
                      Zone time appears after visitors move around the 3D expo.
                    </li>
                  ) : (
                    data.zones.topZones.map((z) => (
                      <li key={z.zone}>
                        <div className="mb-1 flex justify-between text-sm">
                          <span className="text-white/85">{formatZone(z.zone)}</span>
                          <span className="text-white/50">{formatDwell(z.totalDwellMs)}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full bg-[#d4af37]/70"
                            style={{
                              width: `${Math.min(
                                100,
                                (z.totalDwellMs /
                                  Math.max(data.zones.topZones[0]?.totalDwellMs ?? 1, 1)) *
                                  100,
                              )}%`,
                            }}
                          />
                        </div>
                        <p className="mt-0.5 text-[10px] text-white/35">{z.visits} visits</p>
                      </li>
                    ))
                  )}
                </ul>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
                <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-white/50">
                  Recent visitors
                </h2>
                <ul className="space-y-2">
                  {data.recentVisitors.length === 0 ? (
                    <li className="text-xs text-white/40">No registrations yet.</li>
                  ) : (
                    data.recentVisitors.map((v) => (
                      <li
                        key={v.visitorId}
                        className="flex items-start justify-between gap-2 border-b border-white/5 pb-2 text-sm last:border-0"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-white/90">{v.displayName}</p>
                          <p className="truncate text-xs text-white/40">{v.email || v.visitorId}</p>
                        </div>
                        <span className="shrink-0 text-[10px] text-white/35">
                          {v.lobbyCheckInAt ? 'Checked in' : 'Registered'}
                        </span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </section>

            <section className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-white/50">
                Live activity feed
              </h2>
              <ul className="space-y-2">
                {data.recentActivity.length === 0 ? (
                  <li className="text-xs text-white/40">No events yet — browse the expo to generate data.</li>
                ) : (
                  data.recentActivity.map((a, i) => (
                    <li key={`${a.at}-${i}`} className="flex gap-3 text-sm">
                      <time className="shrink-0 text-[10px] text-white/35 tabular-nums">
                        {new Date(a.at).toLocaleTimeString()}
                      </time>
                      <span className="text-white/75">{a.label}</span>
                    </li>
                  ))
                )}
              </ul>
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
