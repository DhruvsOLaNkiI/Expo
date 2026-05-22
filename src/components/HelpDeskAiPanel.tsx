import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useStore } from '../store';
import { fetchExpoLiveStats } from '../api/expoStats';
import {
  buildExpoDeveloperCatalog,
  DEVELOPER_LIST_MODES,
  filterDevelopersByMode,
  filterProjects,
  getAiSuggestion,
  getBoothDirectionHint,
  getFeaturedDevelopers,
  getTrendingDevelopers,
  PROJECT_FILTERS,
  type DeveloperListMode,
  type ExpoDeveloper,
  type ExpoProject,
  type ProjectFilterTag,
  type PropertyTypeChoice,
} from '../data/helpDeskCatalog';
import { computeCatalogStats, type ExpoLiveStats } from '../data/expoStats';
import { buildExpoTeleportDestinations } from '../data/expoTeleportDestinations';
import {
  loadHelpDeskMemory,
  pushRecentDeveloper,
  saveHelpDeskPreferences,
  toggleSavedDeveloper,
} from '../helpDeskPersist';

type Step = 'welcome' | 'developer_mode' | 'browse' | 'projects' | 'floor_map';

const GOLD = '#d4af37';
const GOLD_LIGHT = '#f5e6c8';

function speak(text: string) {
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.92;
    u.pitch = 1.02;
    window.speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}

function GradientThumb({ gradient, label }: { gradient: string; label: string }) {
  return (
    <div
      style={{
        background: gradient,
        borderRadius: 10,
        height: '100%',
        minHeight: 72,
        display: 'flex',
        alignItems: 'flex-end',
        padding: 8,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.08em',
        color: 'rgba(255,255,255,0.85)',
        textTransform: 'uppercase',
      }}
    >
      {label}
    </div>
  );
}

export function HelpDeskAiPanel() {
  const helpDeskOpen = useStore((s) => s.helpDeskOpen);
  const setHelpDeskOpen = useStore((s) => s.setHelpDeskOpen);
  const openAiChat = useStore((s) => s.openAiChat);
  const boothOverrides = useStore((s) => s.boothOverrides);
  const teleportPlayer = useStore((s) => s.teleportPlayer);
  const playerPosition = useStore((s) => s.playerPosition);
  const visitorProfile = useStore((s) => s.visitorProfile);

  const [step, setStep] = useState<Step>('welcome');
  const [propertyType, setPropertyType] = useState<PropertyTypeChoice | null>(null);
  const [listMode, setListMode] = useState<DeveloperListMode | null>(null);
  const [activeFilters, setActiveFilters] = useState<Set<ProjectFilterTag>>(new Set());
  const [selectedDeveloper, setSelectedDeveloper] = useState<ExpoDeveloper | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>(() => loadHelpDeskMemory().savedBoothIds);
  const [directionHint, setDirectionHint] = useState<string | null>(null);
  const [meetingNote, setMeetingNote] = useState<string | null>(null);
  const [liveStats, setLiveStats] = useState<ExpoLiveStats | null>(null);

  const catalog = useMemo(() => buildExpoDeveloperCatalog(boothOverrides), [boothOverrides]);
  const catalogStats = useMemo(() => computeCatalogStats(boothOverrides), [boothOverrides]);
  const teleportDestinations = useMemo(
    () => buildExpoTeleportDestinations(boothOverrides),
    [boothOverrides],
  );

  const filteredDevelopers = useMemo(() => {
    if (!propertyType || !listMode) return [];
    return filterDevelopersByMode(catalog, listMode, propertyType);
  }, [catalog, propertyType, listMode]);

  const trending = useMemo(() => getTrendingDevelopers(catalog), [catalog]);
  const featured = useMemo(() => getFeaturedDevelopers(catalog), [catalog]);
  const recentIds = useMemo(() => loadHelpDeskMemory().recentBoothIds, [step, selectedDeveloper]);

  const aiSuggestion = useMemo(() => {
    const base = getAiSuggestion(propertyType ?? 'residential', listMode, activeFilters);
    const s = liveStats ?? catalogStats;
    const visitorLine =
      liveStats?.mongoConnected && liveStats.visitorsRegisteredToday != null
        ? ` ${liveStats.visitorsRegisteredToday} visitor(s) registered today (${liveStats.visitorsTotal} total).`
        : '';
    return `${base} Live expo: ${s.developerCount} developers, ${s.totalProjects} projects in the catalog.${visitorLine}`;
  }, [propertyType, listMode, activeFilters, liveStats, catalogStats]);

  const resetFlow = useCallback(() => {
    setStep('welcome');
    setPropertyType(null);
    setListMode(null);
    setActiveFilters(new Set());
    setSelectedDeveloper(null);
    setDirectionHint(null);
    setMeetingNote(null);
  }, []);

  useEffect(() => {
    if (!helpDeskOpen) {
      resetFlow();
      return;
    }
    const mem = loadHelpDeskMemory();
    setSavedIds(mem.savedBoothIds);
    void fetchExpoLiveStats().then(setLiveStats);
    const greeting = visitorProfile?.displayName
      ? `Welcome ${visitorProfile.displayName} to the Virtual Property Expo. What type of property are you looking for?`
      : 'Welcome to the Virtual Property Expo. What type of property are you looking for?';
    speak(greeting);
  }, [helpDeskOpen, resetFlow, visitorProfile?.displayName]);

  if (!helpDeskOpen) return null;

  const close = () => setHelpDeskOpen(false);

  const teleportToBooth = (boothId: string, dev: ExpoDeveloper) => {
    const dest = teleportDestinations.find((d) => d.id === boothId);
    if (dest) {
      pushRecentDeveloper(boothId);
      saveHelpDeskPreferences({
        propertyType: propertyType ?? undefined,
        listMode: listMode ?? undefined,
        lastBoothIds: [boothId],
      });
      teleportPlayer(dest.position);
      setHelpDeskOpen(false);
    }
  };

  const showDirection = (dev: ExpoDeveloper) => {
    const dest = teleportDestinations.find((d) => d.id === dev.boothId);
    if (!dest) return;
    const hint = getBoothDirectionHint(playerPosition, dest.position);
    setDirectionHint(hint);
    speak(`Directions to ${dev.name}. ${hint}`);
  };

  const handleSave = (boothId: string) => {
    const nowSaved = toggleSavedDeveloper(boothId);
    setSavedIds(loadHelpDeskMemory().savedBoothIds);
    setMeetingNote(nowSaved ? 'Developer saved to your shortlist.' : 'Removed from shortlist.');
  };

  const scheduleMeeting = (dev: ExpoDeveloper) => {
    setMeetingNote(`Meeting request noted for ${dev.name}. Our concierge will connect you at the booth.`);
    speak(`Your meeting request for ${dev.name} has been noted. Please visit the booth or speak with our hostess.`);
  };

  const toggleFilter = (id: ProjectFilterTag) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const pickPropertyType = (type: PropertyTypeChoice) => {
    setPropertyType(type);
    setStep('developer_mode');
    speak('How many developers would you like to explore?');
  };

  const pickListMode = (mode: DeveloperListMode) => {
    setListMode(mode);
    saveHelpDeskPreferences({ propertyType: propertyType ?? undefined, listMode: mode });
    setStep('browse');
  };

  const openProjects = (dev: ExpoDeveloper) => {
    setSelectedDeveloper(dev);
    pushRecentDeveloper(dev.boothId);
    setStep('projects');
  };

  const displayedProjects = selectedDeveloper
    ? filterProjects(selectedDeveloper.projects, activeFilters)
    : [];

  return (
    <div
      className="fixed inset-0 z-[65] pointer-events-auto flex items-center justify-center p-3 md:p-6"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }}
      onClick={close}
    >
      <div
        className="w-full max-w-5xl max-h-[92vh] overflow-hidden rounded-2xl border shadow-2xl flex flex-col"
        style={{
          background: 'linear-gradient(145deg, rgba(12,12,18,0.96) 0%, rgba(22,18,12,0.94) 100%)',
          borderColor: 'rgba(212,175,55,0.35)',
          boxShadow: '0 0 60px rgba(212,175,55,0.12), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b shrink-0"
          style={{ borderColor: 'rgba(212,175,55,0.2)' }}
        >
          <div>
            <p className="text-[10px] uppercase tracking-[0.35em] text-[#8a7a5a] mb-1">Smart Concierge</p>
            <h2 className="text-lg md:text-xl font-bold tracking-wide" style={{ color: GOLD_LIGHT }}>
              Virtual Property Expo · Noida
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {step !== 'welcome' && step !== 'floor_map' && (
              <button
                type="button"
                onClick={() => (step === 'projects' ? setStep('browse') : resetFlow())}
                className="text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-lg border border-white/15 text-white/70 hover:bg-white/5"
              >
                {step === 'projects' ? 'Back' : 'Restart'}
              </button>
            )}
            <button
              type="button"
              onClick={close}
              className="w-9 h-9 rounded-full border border-[#d4af37]/40 text-[#d4af37] hover:bg-[#d4af37]/15 text-lg leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Main content */}
          <div className="flex-1 overflow-y-auto p-5 md:p-6">
            {step === 'welcome' && (
              <WelcomeStep
                onPick={pickPropertyType}
                visitorName={visitorProfile?.displayName}
                stats={liveStats ?? catalogStats}
                mongoConnected={liveStats?.mongoConnected ?? false}
                onAskAi={() => {
                  setHelpDeskOpen(false);
                  openAiChat('expo-concierge');
                }}
              />
            )}

            {step === 'developer_mode' && (
              <DeveloperModeStep
                propertyType={propertyType!}
                onPick={pickListMode}
                developerCount={
                  propertyType === 'residential'
                    ? (liveStats ?? catalogStats).residentialDeveloperCount
                    : (liveStats ?? catalogStats).commercialDeveloperCount
                }
              />
            )}

            {step === 'browse' && (
              <BrowseStep
                developers={filteredDevelopers}
                activeFilters={activeFilters}
                onToggleFilter={toggleFilter}
                onTeleport={teleportToBooth}
                onViewProjects={openProjects}
                onDirection={showDirection}
                onSave={handleSave}
                onSchedule={scheduleMeeting}
                savedIds={savedIds}
              />
            )}

            {step === 'projects' && selectedDeveloper && (
              <ProjectsStep
                developer={selectedDeveloper}
                projects={displayedProjects}
                activeFilters={activeFilters}
                onToggleFilter={toggleFilter}
                onTeleport={() => teleportToBooth(selectedDeveloper.boothId, selectedDeveloper)}
                onDirection={() => showDirection(selectedDeveloper)}
                onSave={() => handleSave(selectedDeveloper.boothId)}
                onSchedule={() => scheduleMeeting(selectedDeveloper)}
                saved={savedIds.includes(selectedDeveloper.boothId)}
              />
            )}

            {step === 'floor_map' && (
              <FloorMapStep onClose={() => setStep(propertyType && listMode ? 'browse' : 'welcome')} />
            )}
          </div>

          {/* Sidebar — smart features */}
          {(step === 'browse' || step === 'projects') && (
            <aside
              className="hidden md:flex w-72 shrink-0 flex-col gap-4 p-4 border-l overflow-y-auto"
              style={{ borderColor: 'rgba(212,175,55,0.15)', background: 'rgba(0,0,0,0.25)' }}
            >
              <SidebarCard title="AI Suggestion">
                <p className="text-xs leading-relaxed text-[#c9b896]">{aiSuggestion}</p>
                <button
                  type="button"
                  className="mt-2 text-[10px] uppercase tracking-wider text-[#d4af37] hover:underline"
                  onClick={() => speak(aiSuggestion)}
                >
                  🔊 Listen
                </button>
              </SidebarCard>

              {trending.length > 0 && (
                <SidebarCard title="Trending Booths">
                  {trending.slice(0, 3).map((d) => (
                    <MiniDevRow key={d.boothId} dev={d} onOpen={() => openProjects(d)} />
                  ))}
                </SidebarCard>
              )}

              {featured.length > 0 && (
                <SidebarCard title="Featured">
                  {featured.slice(0, 3).map((d) => (
                    <MiniDevRow key={`f-${d.boothId}`} dev={d} onOpen={() => openProjects(d)} />
                  ))}
                </SidebarCard>
              )}

              {recentIds.length > 0 && (
                <SidebarCard title="Recently Viewed">
                  {recentIds.slice(0, 4).map((id) => {
                    const d = catalog.find((x) => x.boothId === id);
                    if (!d) return null;
                    return <MiniDevRow key={`r-${id}`} dev={d} onOpen={() => openProjects(d)} />;
                  })}
                </SidebarCard>
              )}
            </aside>
          )}
        </div>

        {/* Footer actions */}
        <div
          className="shrink-0 flex flex-wrap gap-2 px-5 py-3 border-t"
          style={{ borderColor: 'rgba(212,175,55,0.15)' }}
        >
          <FooterBtn label="Floor Map" onClick={() => setStep('floor_map')} />
          <FooterBtn
            label="Voice Guide"
            onClick={() =>
              speak(
                step === 'welcome'
                  ? 'Choose residential for homes and apartments, or commercial for office and retail spaces.'
                  : aiSuggestion,
              )
            }
          />
          {(directionHint || meetingNote) && (
            <p className="w-full text-[11px] text-[#a89878] mt-1">{directionHint ?? meetingNote}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function SidebarCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div
      className="rounded-xl p-3 border"
      style={{
        background: 'rgba(255,255,255,0.04)',
        borderColor: 'rgba(212,175,55,0.2)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <p className="text-[9px] uppercase tracking-[0.25em] text-[#8a7a5a] mb-2">{title}</p>
      {children}
    </div>
  );
}

function MiniDevRow({ dev, onOpen }: { dev: ExpoDeveloper; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left py-1.5 text-xs text-[#e8dcc4] hover:text-[#d4af37] transition-colors"
    >
      {dev.name}
    </button>
  );
}

function FooterBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-lg border border-[#d4af37]/30 text-[#d4af37] hover:bg-[#d4af37]/10 transition-colors"
    >
      {label}
    </button>
  );
}

function WelcomeStep({
  onPick,
  visitorName,
  stats,
  mongoConnected,
  onAskAi,
}: {
  onPick: (t: PropertyTypeChoice) => void;
  visitorName?: string;
  stats: { developerCount: number; totalProjects: number; visitorsRegisteredToday?: number | null };
  mongoConnected: boolean;
  onAskAi: () => void;
}) {
  return (
    <div className="animate-fade-in">
      <p className="text-sm text-[#b8aa8f] mb-4 leading-relaxed">
        {visitorName ? `Hello ${visitorName}. ` : ''}
        Welcome to the Virtual Property Expo. What type of property are you looking for?
      </p>
      <div
        className="mb-5 rounded-xl border px-4 py-3 text-[11px] leading-relaxed text-[#c9b896]"
        style={{ borderColor: 'rgba(212,175,55,0.25)', background: 'rgba(212,175,55,0.06)' }}
      >
        <p className="font-semibold text-[#d4af37] text-[10px] uppercase tracking-wider mb-1">Live expo stats</p>
        <p>
          <strong className="text-[#f5e6c8]">{stats.developerCount}</strong> developers ·{' '}
          <strong className="text-[#f5e6c8]">{stats.totalProjects}</strong> projects in catalog
          {mongoConnected && stats.visitorsRegisteredToday != null ? (
            <>
              {' '}
              · <strong className="text-[#f5e6c8]">{stats.visitorsRegisteredToday}</strong> registered today
            </>
          ) : null}
        </p>
        <button
          type="button"
          onClick={onAskAi}
          className="mt-2 text-[10px] font-bold uppercase tracking-wider text-[#d4af37] hover:underline"
        >
          Ask AI about developers & registrations →
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <PropertyCard
          title="Residential Properties"
          subtitle="Apartments, villas & premium homes"
          gradient="linear-gradient(135deg,#1a1520 0%,#4a3728 50%,#d4af37 100%)"
          onClick={() => onPick('residential')}
        />
        <PropertyCard
          title="Commercial Properties"
          subtitle="Office spaces, retail & mixed-use"
          gradient="linear-gradient(135deg,#0f172a 0%,#312e81 50%,#818cf8 100%)"
          onClick={() => onPick('commercial')}
        />
      </div>
    </div>
  );
}

function PropertyCard({
  title,
  subtitle,
  gradient,
  onClick,
}: {
  title: string;
  subtitle: string;
  gradient: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group text-left rounded-2xl p-6 border transition-all duration-300 hover:scale-[1.02] hover:shadow-lg"
      style={{
        background: gradient,
        borderColor: 'rgba(212,175,55,0.4)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
      }}
    >
      <p className="text-lg font-bold text-white mb-1">{title}</p>
      <p className="text-xs text-white/75">{subtitle}</p>
      <p className="mt-4 text-[10px] uppercase tracking-[0.2em] text-[#f5e6c8] opacity-0 group-hover:opacity-100 transition-opacity">
        Select →
      </p>
    </button>
  );
}

function DeveloperModeStep({
  propertyType,
  onPick,
  developerCount,
}: {
  propertyType: PropertyTypeChoice;
  onPick: (m: DeveloperListMode) => void;
  developerCount?: number;
}) {
  return (
    <div>
      <p className="text-sm text-[#b8aa8f] mb-2">
        {propertyType === 'residential' ? 'Residential' : 'Commercial'} · How many developers would you like to explore?
        {developerCount != null ? (
          <span className="block text-[11px] text-[#8a7a5a] mt-1">
            {developerCount} developer{developerCount === 1 ? '' : 's'} exhibiting in this category (live catalog).
          </span>
        ) : null}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
        {DEVELOPER_LIST_MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onPick(m.id)}
            className="text-left rounded-xl p-4 border transition-all hover:border-[#d4af37]/60 hover:bg-[#d4af37]/8"
            style={{
              background: 'rgba(255,255,255,0.03)',
              borderColor: 'rgba(212,175,55,0.25)',
            }}
          >
            <p className="font-semibold text-[#f5e6c8] text-sm">{m.label}</p>
            <p className="text-[11px] text-[#8a7a5a] mt-1">{m.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function FilterChips({
  active,
  onToggle,
}: {
  active: Set<ProjectFilterTag>;
  onToggle: (id: ProjectFilterTag) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {PROJECT_FILTERS.map((f) => {
        const on = active.has(f.id);
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => onToggle(f.id)}
            className="text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full border transition-colors"
            style={{
              borderColor: on ? GOLD : 'rgba(255,255,255,0.15)',
              background: on ? 'rgba(212,175,55,0.2)' : 'transparent',
              color: on ? GOLD_LIGHT : '#9a9080',
            }}
          >
            {f.label}
          </button>
        );
      })}
    </div>
  );
}

function BrowseStep({
  developers,
  activeFilters,
  onToggleFilter,
  onTeleport,
  onViewProjects,
  onDirection,
  onSave,
  onSchedule,
  savedIds,
}: {
  developers: ExpoDeveloper[];
  activeFilters: Set<ProjectFilterTag>;
  onToggleFilter: (id: ProjectFilterTag) => void;
  onTeleport: (id: string, d: ExpoDeveloper) => void;
  onViewProjects: (d: ExpoDeveloper) => void;
  onDirection: (d: ExpoDeveloper) => void;
  onSave: (id: string) => void;
  onSchedule: (d: ExpoDeveloper) => void;
  savedIds: string[];
}) {
  return (
    <div>
      <FilterChips active={activeFilters} onToggle={onToggleFilter} />
      {developers.length === 0 ? (
        <p className="text-sm text-[#8a7a5a]">No developers match your filters. Try adjusting filters or list mode.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {developers.map((d) => (
            <DeveloperCard
              key={d.boothId}
              dev={d}
              saved={savedIds.includes(d.boothId)}
              onTeleport={() => onTeleport(d.boothId, d)}
              onViewProjects={() => onViewProjects(d)}
              onDirection={() => onDirection(d)}
              onSave={() => onSave(d.boothId)}
              onSchedule={() => onSchedule(d)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DeveloperCard({
  dev,
  saved,
  onTeleport,
  onViewProjects,
  onDirection,
  onSave,
  onSchedule,
}: {
  dev: ExpoDeveloper;
  saved: boolean;
  onTeleport: () => void;
  onViewProjects: () => void;
  onDirection: () => void;
  onSave: () => void;
  onSchedule: () => void;
}) {
  return (
    <div
      className="rounded-xl overflow-hidden border transition-all hover:border-[#d4af37]/50"
      style={{ borderColor: 'rgba(212,175,55,0.22)', background: 'rgba(255,255,255,0.03)' }}
    >
      <div className="h-28 relative">
        <GradientThumb gradient={dev.previewGradient} label={dev.categoryLabel} />
        <div
          className="absolute top-2 left-2 w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold border"
          style={{ background: 'rgba(0,0,0,0.6)', borderColor: GOLD, color: GOLD_LIGHT }}
        >
          {dev.logoInitials}
        </div>
      </div>
      <div className="p-4">
        <h3 className="font-bold text-[#f5e6c8]">{dev.name}</h3>
        <p className="text-[11px] text-[#8a7a5a] mt-1">{dev.tagline}</p>
        <div className="flex flex-wrap gap-2 mt-3">
          <ActionBtn primary label="Teleport to Booth" onClick={onTeleport} />
          <ActionBtn label="View Projects" onClick={onViewProjects} />
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          <ActionBtn small label="Direction" onClick={onDirection} />
          <ActionBtn small label={saved ? 'Saved ✓' : 'Save'} onClick={onSave} />
          <ActionBtn small label="Schedule" onClick={onSchedule} />
        </div>
      </div>
    </div>
  );
}

function ProjectsStep({
  developer,
  projects,
  activeFilters,
  onToggleFilter,
  onTeleport,
  onDirection,
  onSave,
  onSchedule,
  saved,
}: {
  developer: ExpoDeveloper;
  projects: ExpoProject[];
  activeFilters: Set<ProjectFilterTag>;
  onToggleFilter: (id: ProjectFilterTag) => void;
  onTeleport: () => void;
  onDirection: () => void;
  onSave: () => void;
  onSchedule: () => void;
  saved: boolean;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-xl font-bold text-[#f5e6c8]">{developer.name}</h3>
          <p className="text-xs text-[#8a7a5a]">{developer.tagline}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionBtn primary label="Teleport to Booth" onClick={onTeleport} />
          <ActionBtn label="Direction" onClick={onDirection} />
          <ActionBtn label={saved ? 'Saved ✓' : 'Save Developer'} onClick={onSave} />
          <ActionBtn label="Schedule Meeting" onClick={onSchedule} />
        </div>
      </div>
      <FilterChips active={activeFilters} onToggle={onToggleFilter} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {projects.map((p) => (
          <ProjectCard key={p.id} project={p} />
        ))}
      </div>
      {projects.length === 0 && (
        <p className="text-sm text-[#8a7a5a]">No projects match the selected filters.</p>
      )}
    </div>
  );
}

function ProjectCard({ project }: { project: ExpoProject }) {
  const statusLabel =
    project.status === 'ready'
      ? 'Ready to Move'
      : project.status === 'new_launch'
        ? 'New Launch'
        : 'Under Construction';

  return (
    <div
      className="rounded-xl overflow-hidden border"
      style={{ borderColor: 'rgba(212,175,55,0.2)', background: 'rgba(0,0,0,0.3)' }}
    >
      <div className="h-24">
        <GradientThumb gradient={project.thumbnailGradient} label={project.category} />
      </div>
      <div className="p-3">
        <p className="font-semibold text-sm text-[#f5e6c8]">{project.name}</p>
        <dl className="mt-2 space-y-1 text-[11px] text-[#a89878]">
          <div className="flex justify-between gap-2">
            <dt>Price</dt>
            <dd className="text-[#d4af37]">{project.priceRange}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Location</dt>
            <dd>{project.location}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Config</dt>
            <dd>{project.configuration}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Status</dt>
            <dd>{statusLabel}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

function FloorMapStep({ onClose }: { onClose: () => void }) {
  return (
    <div className="text-center">
      <p className="text-sm text-[#b8aa8f] mb-4">Expo floor layout — Noida Virtual Property Expo</p>
      <div
        className="rounded-xl border p-4 mx-auto max-w-lg"
        style={{ borderColor: 'rgba(212,175,55,0.3)', background: 'rgba(255,255,255,0.04)' }}
      >
        <img src="/maps/site-map.svg" alt="Expo floor map" className="w-full h-auto opacity-90" />
      </div>
      <p className="text-[11px] text-[#8a7a5a] mt-4">
        West wing: Luxe, Aurum, Vertex · East wing: Crown, Monarch, Horizon · Center: Help Desk
      </p>
      <button type="button" onClick={onClose} className="mt-4 text-[#d4af37] text-xs uppercase tracking-wider">
        ← Back to browse
      </button>
    </div>
  );
}

function ActionBtn({
  label,
  onClick,
  primary,
  small,
}: {
  label: string;
  onClick: () => void;
  primary?: boolean;
  small?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border font-semibold transition-all hover:scale-[1.02] ${small ? 'text-[9px] px-2 py-1' : 'text-[10px] px-3 py-1.5'} uppercase tracking-wider`}
      style={
        primary
          ? { background: 'rgba(212,175,55,0.25)', borderColor: GOLD, color: GOLD_LIGHT }
          : { background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(212,175,55,0.3)', color: '#c9b896' }
      }
    >
      {label}
    </button>
  );
}
