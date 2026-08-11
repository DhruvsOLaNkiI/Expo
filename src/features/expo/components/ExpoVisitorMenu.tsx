import { useState } from 'react';
import { useStore } from '@/store';
import { mergeSceneConfig } from '@/features/shared/data/boothLayouts';
import {
  RENDER_QUALITY_PRESETS,
  getRenderQualityPreset,
  isRenderQuality,
  type RenderQuality,
} from '@/features/shared/data/renderQuality';
import { SMOOTH_MODE_SCENE_PATCH } from '@/utils/devicePerformance';
import { CAMERA_MODES, CAMERA_MODE_ORDER } from '@/features/expo/camera/cameraModes';
import { readAdminSession } from '@/features/admin/adminSession';
import { isVisitorAssignedAdmin } from '@/features/admin/adminVisitors';
import { FastTravelPanel } from '@/features/teleport/FastTravelPanel';

type Tab = 'travel' | 'concierge' | 'settings';

type Props = {
  onOpenAnalytics: () => void;
};

export function ExpoVisitorMenu({ onOpenAnalytics }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('travel');

  const visitorProfile = useStore((s) => s.visitorProfile);
  const clearVisitorProfile = useStore((s) => s.clearVisitorProfile);
  const showInstructions = useStore((s) => s.showInstructions);
  const registrationUi = useStore((s) => s.registrationUi);
  const ctaResourcePopup = useStore((s) => s.ctaResourcePopup);
  const activeBooth = useStore((s) => s.activeBooth);
  const helpDeskOpen = useStore((s) => s.helpDeskOpen);
  const aiChatOpen = useStore((s) => s.aiChatOpen);
  const hallLayoutEditMode = useStore((s) => s.hallLayoutEditMode);
  const cmsPage = useStore((s) => s.cmsPage);
  const expoPhase = useStore((s) => s.expoPhase);

  const setHelpDeskOpen = useStore((s) => s.setHelpDeskOpen);
  const setAiChatOpen = useStore((s) => s.setAiChatOpen);
  const setCmsPage = useStore((s) => s.setCmsPage);
  const setHallLayoutEditMode = useStore((s) => s.setHallLayoutEditMode);
  const setHallLayoutSelection = useStore((s) => s.setHallLayoutSelection);
  const cameraMode = useStore((s) => s.cameraMode);
  const setCameraMode = useStore((s) => s.setCameraMode);
  const sceneOverrides = useStore((s) => s.sceneOverrides);
  const patchScene = useStore((s) => s.patchSceneOverride);
  const isAdmin = useStore((s) => s.isAdmin);
  const setAdminLoginOpen = useStore((s) => s.setAdminLoginOpen);
  const logoutAdmin = useStore((s) => s.logoutAdmin);

  if (
    !visitorProfile ||
    cmsPage !== 'expo' ||
    showInstructions ||
    registrationUi !== 'none' ||
    ctaResourcePopup ||
    activeBooth ||
    helpDeskOpen ||
    aiChatOpen ||
    hallLayoutEditMode
  ) {
    return null;
  }

  const cfg = mergeSceneConfig(sceneOverrides);
  const activeQuality: RenderQuality = isRenderQuality(cfg.renderQuality) ? cfg.renderQuality : 'hd';
  const inExpo = expoPhase === 'expo';
  const assignedAdmin = isVisitorAssignedAdmin(visitorProfile);
  const keyAdmin = readAdminSession();

  const close = () => setOpen(false);

  const openConcierge = (pane?: 'welcome' | 'halls') => {
    close();
    setHelpDeskOpen(true, pane ? { pane } : undefined);
  };

  return (
    <div
      data-expo-ui
      className="fixed top-[max(0.75rem,env(safe-area-inset-top))] right-[max(0.75rem,env(safe-area-inset-right))] z-[58] pointer-events-auto flex flex-col items-end gap-2"
    >
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group flex items-center gap-2.5 rounded-2xl border-2 border-[#d4af37] bg-[#faf8f4] px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.28)] transition-transform hover:scale-[1.02]"
          aria-label="Open visitor menu"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1a1520] text-[#d4af37] text-lg font-bold">
            ☰
          </span>
          <span className="text-left hidden sm:block">
            <span className="block text-[10px] uppercase tracking-[0.2em] text-[#8a7a5a]">Expo</span>
            <span className="block text-sm font-bold text-[#1a1520]">Menu</span>
          </span>
        </button>
      )}

      {open && (
        <>
          <div
            className="fixed inset-0 z-[-1] bg-black/25 backdrop-blur-[2px]"
            onClick={close}
            aria-hidden
          />
          <div
            className="w-[min(92vw,22rem)] max-h-[min(78vh,32rem)] overflow-hidden rounded-2xl border-2 border-[#d4af37]/60 shadow-[0_20px_60px_rgba(0,0,0,0.35)] flex flex-col"
            style={{
              background: 'linear-gradient(165deg, #faf8f4 0%, #f2ebe0 55%, #e8dfd0 100%)',
            }}
          >
            <div className="flex items-start justify-between gap-2 border-b border-[#d4af37]/25 px-4 py-3 shrink-0">
              <div className="min-w-0">
                <p className="text-[9px] uppercase tracking-[0.3em] text-[#8a7a5a]">Visitor</p>
                <p className="text-sm font-bold text-[#1a1520] truncate">{visitorProfile.displayName}</p>
                <p className="text-[10px] font-mono text-[#b8952e] tracking-wide">{visitorProfile.id}</p>
              </div>
              <button
                type="button"
                onClick={close}
                className="shrink-0 h-8 w-8 rounded-full border border-[#d4af37]/40 bg-white/80 text-[#5c4a1a] hover:bg-[#d4af37]/15 text-lg leading-none"
                aria-label="Close menu"
              >
                ×
              </button>
            </div>

            <div className="flex gap-1 px-3 pt-2 shrink-0">
              {(['travel', 'concierge', 'settings'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`flex-1 rounded-lg py-2 text-[9px] font-bold uppercase tracking-wider transition-colors ${
                    tab === t
                      ? 'bg-[#1a1520] text-[#d4af37]'
                      : 'bg-white/60 text-[#5c4a1a] hover:bg-white'
                  }`}
                >
                  {t === 'travel' ? 'Travel' : t === 'concierge' ? 'Help' : 'Settings'}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3">
              {tab === 'travel' && (
                <FastTravelPanel theme="light" onNavigate={close} />
              )}

              {tab === 'concierge' && (
                <div className="space-y-2">
                  <MenuAction
                    label="Smart Help Desk"
                    hint="Developers, projects & floor map"
                    accent
                    onClick={() => openConcierge()}
                  />
                  <MenuAction
                    label="Which Hall To Go"
                    hint="Switch between expo halls 1–6"
                    onClick={() => openConcierge('halls')}
                  />
                  <MenuAction
                    label="Ask AI Assistant"
                    hint="Expo concierge chat"
                    onClick={() => {
                      close();
                      setAiChatOpen(true, undefined);
                    }}
                  />
                  {inExpo && (
                    <MenuAction
                      label="Help Desk (3D)"
                      hint="Teleport to center help desk"
                      onClick={() => {
                        close();
                        setHelpDeskOpen(true);
                      }}
                    />
                  )}
                </div>
              )}

              {tab === 'settings' && (
                <div className="space-y-4">
                  {isAdmin ? (
                    <div className="rounded-lg border border-violet-400/35 bg-violet-950/15 px-3 py-2 flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-violet-800">
                        {assignedAdmin
                          ? `Admin · ${visitorProfile?.id ?? ''}`
                          : 'Admin · global environment'}
                      </span>
                      {keyAdmin && !assignedAdmin ? (
                        <button
                          type="button"
                          onClick={() => logoutAdmin()}
                          className="text-[9px] font-semibold uppercase text-violet-700 hover:text-violet-900"
                        >
                          Sign out
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        close();
                        setAdminLoginOpen(true);
                      }}
                      className="w-full rounded-lg border border-violet-400/40 bg-violet-50 px-3 py-2.5 text-left"
                    >
                      <span className="block text-xs font-bold uppercase tracking-wider text-violet-900">
                        Admin login
                      </span>
                      <span className="block text-[10px] text-violet-800/80 mt-0.5">
                        Edit global expo environment, CMS & layout
                      </span>
                    </button>
                  )}

                  <div>
                    <p className="text-[9px] uppercase tracking-wider text-[#8a7a5a] mb-2">Camera · press V</p>
                    <div className="flex rounded-xl border border-[#e8dcc8] bg-white p-1">
                      {CAMERA_MODE_ORDER.map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setCameraMode(mode)}
                          className={`flex-1 rounded-lg py-2 text-[9px] font-bold uppercase ${
                            cameraMode === mode
                              ? 'bg-[#d4af37] text-black'
                              : 'text-[#5c4a1a] hover:bg-[#faf8f4]'
                          }`}
                        >
                          {CAMERA_MODES[mode].shortLabel}
                        </button>
                      ))}
                    </div>
                  </div>

                  {isAdmin ? (
                    <>
                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-[#8a7a5a] mb-2">
                          Global quality (all visitors)
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {RENDER_QUALITY_PRESETS.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => patchScene(getRenderQualityPreset(p.id).patch)}
                              className={`rounded-lg px-2.5 py-1.5 text-[9px] font-bold uppercase ${
                                activeQuality === p.id
                                  ? 'bg-[#d4af37] text-black'
                                  : 'bg-white border border-[#e8dcc8] text-[#5c4a1a]'
                              }`}
                            >
                              {p.label}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => patchScene(SMOOTH_MODE_SCENE_PATCH)}
                            className="rounded-lg border border-emerald-600/30 bg-emerald-50 px-2.5 py-1.5 text-[9px] font-bold uppercase text-emerald-800"
                          >
                            Smooth
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <ToggleRow
                          label="LED screens & videos"
                          checked={cfg.showVideos}
                          onChange={(v) => patchScene({ showVideos: v })}
                        />
                        <ToggleRow
                          label="Center ring canopy (hide for FPS)"
                          checked={cfg.showHallCanopy}
                          onChange={(v) => patchScene({ showHallCanopy: v })}
                        />
                        <ToggleRow
                          label="Ballroom stage"
                          checked={cfg.showBallroom}
                          onChange={(v) => patchScene({ showBallroom: v })}
                        />
                      </div>

                      <div className="border-t border-[#e8dcc8] pt-3 space-y-2">
                        <p className="text-[9px] uppercase tracking-wider text-[#8a7a5a]">Admin tools</p>
                        <MenuAction
                          label="Open CMS"
                          hint="Booths, scene, all halls"
                          small
                          onClick={() => {
                            close();
                            setCmsPage('cms');
                          }}
                        />
                        {inExpo && (
                          <MenuAction
                            label="Edit layout"
                            hint="Move booths & hall objects"
                            small
                            onClick={() => {
                              close();
                              setHallLayoutSelection(null);
                              setHallLayoutEditMode(true);
                            }}
                          />
                        )}
                        <MenuAction
                          label="PageIndex"
                          hint="Document search portal"
                          small
                          onClick={() => {
                            close();
                            setCmsPage('pageindex');
                          }}
                        />
                        <MenuAction
                          label="Analytics"
                          hint="Live visitor dashboard"
                          small
                          onClick={() => {
                            close();
                            onOpenAnalytics();
                          }}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="rounded-xl border border-[#e8dcc8] bg-white px-3 py-2.5">
                      <p className="text-[9px] uppercase tracking-wider text-[#8a7a5a] mb-2">
                        Your display settings
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="rounded-md bg-[#d4af37]/20 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#5c4a1a]">
                          {getRenderQualityPreset(activeQuality).label}
                        </span>
                        <span
                          className={`rounded-md px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider ${
                            cfg.performanceBoost
                              ? 'bg-sky-100 text-sky-900'
                              : 'bg-[#f4f0e8] text-[#8a7a5a]'
                          }`}
                        >
                          {cfg.performanceBoost ? 'Boost ON' : 'Boost OFF'}
                        </span>
                        <span className="rounded-md bg-[#f4f0e8] px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#8a7a5a]">
                          {cfg.showVideos ? 'Videos on' : '3D only'}
                        </span>
                      </div>
                      <p className="mt-2 text-[10px] text-[#8a7a5a] leading-relaxed">
                        Set by the expo admin for everyone. Sign in as admin to change Full HD / HD / 480p or Boost.
                      </p>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Sign out and enter a new Visitor ID?')) {
                        clearVisitorProfile();
                        close();
                      }
                    }}
                    className="w-full rounded-lg border border-[#e8dcc8] py-2 text-[10px] font-semibold uppercase tracking-wider text-[#8a7a5a] hover:bg-white/80"
                  >
                    Change visitor ID
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MenuAction({
  label,
  hint,
  onClick,
  accent,
  small,
}: {
  label: string;
  hint?: string;
  onClick: () => void;
  accent?: boolean;
  small?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-xl border transition-colors ${
        small ? 'px-3 py-2' : 'px-3 py-2.5'
      } ${
        accent
          ? 'border-[#d4af37]/55 bg-[#d4af37]/12 hover:bg-[#d4af37]/22'
          : 'border-[#e8dcc8] bg-white hover:bg-[#faf8f4]'
      }`}
    >
      <span className={`block font-bold text-[#1a1520] ${small ? 'text-[11px]' : 'text-xs'}`}>{label}</span>
      {hint ? <span className="block text-[10px] text-[#8a7a5a] mt-0.5">{hint}</span> : null}
    </button>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-[#e8dcc8] bg-white px-3 py-2">
      <input
        type="checkbox"
        className="h-3.5 w-3.5 accent-[#d4af37]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="text-[11px] font-medium text-[#1a1520]">{label}</span>
    </label>
  );
}
