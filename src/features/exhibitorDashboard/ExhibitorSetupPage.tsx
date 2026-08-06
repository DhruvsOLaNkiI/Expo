import { useCallback, useEffect, useRef, useState } from 'react';
import type { BoothLayoutPatch } from '@/features/shared/data/boothLayouts';
import { ImagePlus, Plus, Trash2, Upload } from 'lucide-react';
import {
  siteMapToStorageFields,
  siteMapUrlsFromConfig,
  floorPlansFromConfig,
  floorPlansToStorageFields,
  unitLayoutsFromConfig,
  unitLayoutsToStorageFields,
  type BoothHeaderBranding,
  type CompanyProfile,
  type UnitLayoutItem,
} from '@/features/shared/data/boothLayouts';
import { ExhibitorChecklistBanner } from './ExhibitorChecklistBanner';
import { BoothLayoutSetupSection } from './BoothLayoutSetupSection';
import { BoothColorThemeSection } from './BoothColorThemeSection';
import { BoothPlacementSetupSection } from './BoothPlacementSetupSection';
import {
  BUILDER_8_GREEN_THEME,
  type BoothColorPreset,
} from '@/features/shared/data/boothLayouts';
import {
  isLocalBoothLogoUrl,
  isRemoteBoothLogoUrl,
  sanitizeBoothLogoUrlForWebGL,
} from './exhibitorLogo';
import {
  exhibitorUploadError,
  exhibitorUploadBoothLogo,
  exhibitorUploadPlacementImage,
  exhibitorUploadFile,
  useExhibitorPersist,
} from './exhibitorUpload';
import type { ExhibitorNavId } from './exhibitorConfig';
import { boothDisplayCode } from './exhibitorConfig';
import { useExhibitorBooth } from './useExhibitorBooth';
import type {
  BoothPlacementAdjust,
  BoothPlacementSlot,
  BoothWallPlacementAdjustments,
} from '@/features/booths/components/boothWallMetrics';
import { compactWallPlacementAdjustments } from '@/features/booths/components/boothWallMetrics';

function newUnitLayout(name = ''): UnitLayoutItem {
  return { id: `ul-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name, imageUrl: '' };
}

function newFloorPlan(name = ''): UnitLayoutItem {
  return { id: `fp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name, imageUrl: '' };
}

function loadLocalImageUrl(raw: string | undefined): string {
  const u = raw ?? '';
  return isLocalBoothLogoUrl(u) ? u : '';
}

/** Empty string → `null` so saved overrides actually clear (undefined would keep the old value). */
function patchPlacementImageUrl(url: string): string | null {
  return sanitizeBoothLogoUrlForWebGL(url) || null;
}

function isValidHexColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value.trim());
}

function patchThemeColor(value: string): string | null {
  const v = value.trim();
  return isValidHexColor(v) ? v : null;
}

type Props = { onNav: (id: ExhibitorNavId) => void };

export function ExhibitorSetupPage({ onNav }: Props) {
  const { booth, boothId, patchBooth, loading } = useExhibitorBooth();
  const persist = useExhibitorPersist(patchBooth);
  const colorPersistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleColorPersist = useCallback(
    (patch: BoothLayoutPatch, label = 'Booth colors') => {
      if (colorPersistTimer.current) clearTimeout(colorPersistTimer.current);
      colorPersistTimer.current = setTimeout(() => {
        void persist(patch, label).then((r) => {
          if (r.ok) {
            setStatusMsg(r.message);
            setErrorMsg(null);
          } else {
            setErrorMsg(r.message);
          }
        });
      }, 350);
    },
    [persist],
  );

  useEffect(
    () => () => {
      if (colorPersistTimer.current) clearTimeout(colorPersistTimer.current);
    },
    [],
  );

  const [color, setColor] = useState('#fcfaf5');
  const [accent, setAccent] = useState('#d4af37');
  const [counterColor, setCounterColor] = useState('#ffffff');
  const [backWallColor, setBackWallColor] = useState<string>(BUILDER_8_GREEN_THEME.backWallColor);
  const [tvWallColor, setTvWallColor] = useState<string>(BUILDER_8_GREEN_THEME.tvWallColor);
  const [headerFasciaColor, setHeaderFasciaColor] = useState<string>(BUILDER_8_GREEN_THEME.headerFasciaColor);
  const [counterTopColor, setCounterTopColor] = useState<string>(BUILDER_8_GREEN_THEME.counterTopColor);
  const [headerTextColor, setHeaderTextColor] = useState('');
  const [headerLogoUrl, setHeaderLogoUrl] = useState('');
  const [projectLogoUrl, setProjectLogoUrl] = useState('');
  const [wallLogoLeftUrl, setWallLogoLeftUrl] = useState('');
  const [wallLogoRightUrl, setWallLogoRightUrl] = useState('');
  const [sideWallLeftImageUrl, setSideWallLeftImageUrl] = useState('');
  const [sideWallRightImageUrl, setSideWallRightImageUrl] = useState('');
  const [exteriorWallLeftImageUrl, setExteriorWallLeftImageUrl] = useState('');
  const [exteriorWallRightImageUrl, setExteriorWallRightImageUrl] = useState('');
  const [counterFrontImageUrl, setCounterFrontImageUrl] = useState('');
  const [standeeImageUrl, setStandeeImageUrl] = useState('');
  const [wallPlacementAdjustments, setWallPlacementAdjustments] = useState<BoothWallPlacementAdjustments>({});
  const [headerBranding, setHeaderBranding] = useState<BoothHeaderBranding>({});
  const [unitLayouts, setUnitLayouts] = useState<UnitLayoutItem[]>([newUnitLayout()]);
  const [floorPlans, setFloorPlans] = useState<UnitLayoutItem[]>([newFloorPlan()]);
  const [siteMapUrl, setSiteMapUrl] = useState('');
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!booth) return;
    const rawLogo = booth.headerLogoUrl ?? '';
    setHeaderLogoUrl(loadLocalImageUrl(rawLogo));
    const rawProjectLogo = booth.projectLogoUrl ?? '';
    setProjectLogoUrl(loadLocalImageUrl(rawProjectLogo));
    const rawLeft = booth.wallLogoLeftUrl ?? '';
    setWallLogoLeftUrl(loadLocalImageUrl(rawLeft));
    const rawRight = booth.wallLogoRightUrl ?? '';
    setWallLogoRightUrl(loadLocalImageUrl(rawRight));
    const rawSideLeft = booth.sideWallLeftImageUrl ?? '';
    const rawSideRight = booth.sideWallRightImageUrl ?? '';
    const rawExtLeft = booth.exteriorWallLeftImageUrl ?? '';
    const rawExtRight = booth.exteriorWallRightImageUrl ?? '';
    setExteriorWallLeftImageUrl(loadLocalImageUrl(rawExtLeft));
    setExteriorWallRightImageUrl(loadLocalImageUrl(rawExtRight));
    setSideWallLeftImageUrl(loadLocalImageUrl(rawSideLeft));
    setSideWallRightImageUrl(loadLocalImageUrl(rawSideRight));
    const rawCounter = booth.counterFrontImageUrl ?? '';
    setCounterFrontImageUrl(loadLocalImageUrl(rawCounter));
    setStandeeImageUrl(loadLocalImageUrl(booth.standeeImageUrl ?? ''));
    setWallPlacementAdjustments({ ...(booth.wallPlacementAdjustments ?? {}) });
    if (
      isRemoteBoothLogoUrl(rawLogo) ||
      isRemoteBoothLogoUrl(rawProjectLogo) ||
      isRemoteBoothLogoUrl(rawLeft) ||
      isRemoteBoothLogoUrl(rawRight) ||
      isRemoteBoothLogoUrl(rawSideLeft) ||
      isRemoteBoothLogoUrl(rawSideRight) ||
      isRemoteBoothLogoUrl(rawExtLeft) ||
      isRemoteBoothLogoUrl(rawExtRight) ||
      isRemoteBoothLogoUrl(rawCounter)
    ) {
      setStatusMsg('Previous cloud images were skipped — upload again (stored locally for now).');
    }
    setColor(booth.color || '#fcfaf5');
    setAccent(booth.accent || '#d4af37');
    setCounterColor(booth.counterColor || '#ffffff');
    setBackWallColor(booth.backWallColor || booth.color || '#fcfaf5');
    setTvWallColor(booth.tvWallColor || BUILDER_8_GREEN_THEME.tvWallColor);
    setHeaderFasciaColor(
      booth.headerFasciaColor ||
        (boothId === 'builder-4' ? '#a690f0' : BUILDER_8_GREEN_THEME.headerFasciaColor),
    );
    setCounterTopColor(booth.counterTopColor || booth.accent || BUILDER_8_GREEN_THEME.counterTopColor);
    setHeaderTextColor(booth.headerTextColor || '');
    setHeaderBranding({ ...(booth.headerBranding ?? {}) });
    const layouts = unitLayoutsFromConfig(booth);
    setUnitLayouts(layouts.length ? layouts : [newUnitLayout()]);
    const plans = floorPlansFromConfig(booth);
    setFloorPlans(plans.length ? plans : [newFloorPlan()]);
    setSiteMapUrl(siteMapUrlsFromConfig(booth)[0] ?? '');
    setCompany({ ...booth.company });
  }, [booth]);

  const saveAll = useCallback(async () => {
    if (!company) return;
    setSaving(true);
    setErrorMsg(null);
    const result = await persist(
      {
        color: patchThemeColor(color) ?? undefined,
        accent: patchThemeColor(accent) ?? undefined,
        counterColor: patchThemeColor(counterColor) ?? undefined,
        backWallColor: patchThemeColor(backWallColor) ?? null,
        headerTextColor: patchThemeColor(headerTextColor) ?? null,
        tvWallColor: boothId === 'builder-8' ? tvWallColor.trim() || undefined : undefined,
        headerFasciaColor:
          boothId === 'builder-8' || boothId === 'builder-4'
            ? headerFasciaColor.trim() || undefined
            : undefined,
        counterTopColor: boothId === 'builder-8' ? counterTopColor.trim() || undefined : undefined,
        headerLogoUrl: patchPlacementImageUrl(headerLogoUrl),
        projectLogoUrl: patchPlacementImageUrl(projectLogoUrl),
        wallLogoLeftUrl: patchPlacementImageUrl(wallLogoLeftUrl),
        wallLogoRightUrl: patchPlacementImageUrl(wallLogoRightUrl),
        sideWallLeftImageUrl: patchPlacementImageUrl(sideWallLeftImageUrl),
        sideWallRightImageUrl: patchPlacementImageUrl(sideWallRightImageUrl),
        exteriorWallLeftImageUrl: patchPlacementImageUrl(exteriorWallLeftImageUrl),
        exteriorWallRightImageUrl: patchPlacementImageUrl(exteriorWallRightImageUrl),
        counterFrontImageUrl: patchPlacementImageUrl(counterFrontImageUrl),
        standeeImageUrl: patchPlacementImageUrl(standeeImageUrl),
        wallPlacementAdjustments: compactWallPlacementAdjustments(wallPlacementAdjustments),
        wallPlacementV2: true,
        headerBranding,
        ...unitLayoutsToStorageFields(unitLayouts),
        ...floorPlansToStorageFields(floorPlans),
        ...siteMapToStorageFields([siteMapUrl]),
        company,
      },
      'Booth setup',
    );
    setStatusMsg(result.ok ? result.message : null);
    if (!result.ok) setErrorMsg(result.message);
    setSaving(false);
  }, [
    color,
    accent,
    counterColor,
    backWallColor,
    tvWallColor,
    headerFasciaColor,
    counterTopColor,
    headerTextColor,
    boothId,
    company,
    counterFrontImageUrl,
    exteriorWallLeftImageUrl,
    exteriorWallRightImageUrl,
    floorPlans,
    headerBranding,
    headerLogoUrl,
    projectLogoUrl,
    wallLogoLeftUrl,
    wallLogoRightUrl,
    sideWallLeftImageUrl,
    sideWallRightImageUrl,
    standeeImageUrl,
    persist,
    siteMapUrl,
    unitLayouts,
    wallPlacementAdjustments,
  ]);

  const onAdjustPlacement = useCallback(
    (slot: BoothPlacementSlot, patch: Partial<BoothPlacementAdjust>) => {
      setWallPlacementAdjustments((prev) => {
        const next = {
          ...prev,
          [slot]: { ...prev[slot], ...patch },
        };
        void persist(
          { wallPlacementAdjustments: compactWallPlacementAdjustments(next), wallPlacementV2: true },
          'Poster position',
        );
        return next;
      });
    },
    [persist],
  );

  const onResetPlacementAdjust = useCallback(
    (slot: BoothPlacementSlot) => {
      setWallPlacementAdjustments((prev) => {
        const next = { ...prev };
        delete next[slot];
        void persist(
          { wallPlacementAdjustments: compactWallPlacementAdjustments(next), wallPlacementV2: true },
          'Poster position reset',
        );
        return next;
      });
    },
    [persist],
  );

  const applyColorPreset = useCallback(
    async (preset: BoothColorPreset) => {
      setColor(preset.color);
      setAccent(preset.accent);
      setCounterColor(preset.counterColor);
      setBackWallColor(preset.backWallColor ?? preset.color);
      setHeaderTextColor('');
      if (boothId === 'builder-8') {
        setTvWallColor(preset.tvWallColor ?? BUILDER_8_GREEN_THEME.tvWallColor);
        setHeaderFasciaColor(preset.headerFasciaColor ?? BUILDER_8_GREEN_THEME.headerFasciaColor);
        setCounterTopColor(preset.counterTopColor ?? preset.accent);
      } else if (boothId === 'builder-4') {
        setHeaderFasciaColor(preset.headerFasciaColor ?? '#a690f0');
      }
      const r = await persist(
        {
          color: preset.color,
          accent: preset.accent,
          counterColor: preset.counterColor,
          backWallColor: preset.backWallColor ?? preset.color,
          headerTextColor: null,
          ...(boothId === 'builder-8'
            ? {
                tvWallColor: preset.tvWallColor ?? tvWallColor,
                headerFasciaColor: preset.headerFasciaColor ?? headerFasciaColor,
                counterTopColor: preset.counterTopColor ?? preset.accent,
              }
            : boothId === 'builder-4'
              ? {
                  headerFasciaColor: preset.headerFasciaColor ?? headerFasciaColor,
                }
              : {}),
        },
        `Theme: ${preset.label}`,
      );
      setStatusMsg(r.message);
      if (!r.ok) setErrorMsg(r.message);
    },
    [persist, boothId, tvWallColor, headerFasciaColor],
  );

  const buildWallPersistPatch = useCallback(
    (patch: {
      sideWallLeftImageUrl?: string | null;
      sideWallRightImageUrl?: string | null;
      exteriorWallLeftImageUrl?: string | null;
      exteriorWallRightImageUrl?: string | null;
    }) => {
      const out: import('@/features/shared/data/boothLayouts').BoothLayoutPatch = {
        wallPlacementV2: true,
        wallPlacementAdjustments: compactWallPlacementAdjustments(wallPlacementAdjustments),
      };
      if ('sideWallLeftImageUrl' in patch) {
        out.sideWallLeftImageUrl =
          patch.sideWallLeftImageUrl === null
            ? null
            : patchPlacementImageUrl(patch.sideWallLeftImageUrl ?? '');
      }
      if ('sideWallRightImageUrl' in patch) {
        out.sideWallRightImageUrl =
          patch.sideWallRightImageUrl === null
            ? null
            : patchPlacementImageUrl(patch.sideWallRightImageUrl ?? '');
      }
      if ('exteriorWallLeftImageUrl' in patch) {
        out.exteriorWallLeftImageUrl =
          patch.exteriorWallLeftImageUrl === null
            ? null
            : patchPlacementImageUrl(patch.exteriorWallLeftImageUrl ?? '');
      }
      if ('exteriorWallRightImageUrl' in patch) {
        out.exteriorWallRightImageUrl =
          patch.exteriorWallRightImageUrl === null
            ? null
            : patchPlacementImageUrl(patch.exteriorWallRightImageUrl ?? '');
      }
      return out;
    },
    [wallPlacementAdjustments],
  );

  const clearPlacementImage = useCallback(
    async (
      field:
        | 'sideWallLeftImageUrl'
        | 'sideWallRightImageUrl'
        | 'exteriorWallLeftImageUrl'
        | 'exteriorWallRightImageUrl'
        | 'counterFrontImageUrl',
      label: string,
    ) => {
      if (field === 'counterFrontImageUrl') {
        const r = await persist({ counterFrontImageUrl: null, wallPlacementV2: true }, label);
        setStatusMsg(r.message);
        return;
      }
      const r = await persist(buildWallPersistPatch({ [field]: null }), label);
      setStatusMsg(r.message);
    },
    [buildWallPersistPatch, persist],
  );

  const clearAllPlacementImages = useCallback(async () => {
    setSideWallLeftImageUrl('');
    setSideWallRightImageUrl('');
    setExteriorWallLeftImageUrl('');
    setExteriorWallRightImageUrl('');
    setCounterFrontImageUrl('');
    setWallPlacementAdjustments({});
    const r = await persist(
      {
        sideWallLeftImageUrl: null,
        sideWallRightImageUrl: null,
        exteriorWallLeftImageUrl: null,
        exteriorWallRightImageUrl: null,
        counterFrontImageUrl: null,
        wallPlacementAdjustments: null,
        wallPlacementV2: true,
      },
      'All wall posters cleared',
    );
    setStatusMsg(r.message);
  }, [persist]);

  const uploadPlacementSlot = useCallback(
    async (slot: BoothPlacementSlot, file: File) => {
      try {
        const url = await exhibitorUploadPlacementImage(file);
        switch (slot) {
          case 'exteriorLeft':
            setExteriorWallLeftImageUrl(url);
            await persist(buildWallPersistPatch({ exteriorWallLeftImageUrl: url }), 'Left outside wall image');
            break;
          case 'exteriorRight':
            setExteriorWallRightImageUrl(url);
            await persist(buildWallPersistPatch({ exteriorWallRightImageUrl: url }), 'Right outside wall image');
            break;
          case 'interiorLeft':
            setSideWallLeftImageUrl(url);
            await persist(buildWallPersistPatch({ sideWallLeftImageUrl: url }), 'Left inside wall image');
            break;
          case 'interiorRight':
            setSideWallRightImageUrl(url);
            await persist(buildWallPersistPatch({ sideWallRightImageUrl: url }), 'Right inside wall image');
            break;
          case 'counterFront':
            setCounterFrontImageUrl(url);
            await persist({ counterFrontImageUrl: url, wallPlacementV2: true }, 'Counter front image');
            break;
        }
        setStatusMsg('Image uploaded — switch to the expo tab (or refresh) to see it live.');
        setErrorMsg(null);
      } catch (err) {
        setErrorMsg(exhibitorUploadError(err));
      }
    },
    [buildWallPersistPatch, persist],
  );

  if (loading || !booth || !company) {
    return <div className="exb-loading">Loading booth setup…</div>;
  }

  return (
    <>
      <ExhibitorChecklistBanner onGo={onNav} filterNav="setup" />
      {(statusMsg || errorMsg) && (
        <div className={`exb-toast ${errorMsg ? 'error' : 'ok'}`}>{errorMsg ?? statusMsg}</div>
      )}

      <div className="exb-page-actions">
        <button type="button" className="exb-btn exb-btn-primary" disabled={saving} onClick={() => void saveAll()}>
          Save booth setup
        </button>
      </div>

      <div className="exb-page-grid">
        <BoothColorThemeSection
          boothId={boothId}
          boothLabel={booth?.name ?? boothId}
          boothCode={boothDisplayCode(boothId)}
          color={color}
          accent={accent}
          counterColor={counterColor}
          backWallColor={backWallColor}
          tvWallColor={tvWallColor}
          headerFasciaColor={headerFasciaColor}
          counterTopColor={counterTopColor}
          headerTextColor={headerTextColor}
          onColor={(v) => {
            setColor(v);
            const c = patchThemeColor(v);
            if (c) scheduleColorPersist({ color: c });
            else if (!v.trim()) scheduleColorPersist({ color: null });
          }}
          onAccent={(v) => {
            setAccent(v);
            const c = patchThemeColor(v);
            if (c) scheduleColorPersist({ accent: c });
            else if (!v.trim()) scheduleColorPersist({ accent: null });
          }}
          onCounterColor={(v) => {
            setCounterColor(v);
            const c = patchThemeColor(v);
            if (c) scheduleColorPersist({ counterColor: c });
            else if (!v.trim()) scheduleColorPersist({ counterColor: null });
          }}
          onBackWallColor={(v) => {
            setBackWallColor(v);
            const c = patchThemeColor(v);
            if (c) scheduleColorPersist({ backWallColor: c });
            else if (!v.trim()) scheduleColorPersist({ backWallColor: null });
          }}
          onTvWallColor={(v) => {
            setTvWallColor(v);
            if (boothId !== 'builder-8') return;
            const c = patchThemeColor(v);
            if (c) scheduleColorPersist({ tvWallColor: c });
            else if (!v.trim()) scheduleColorPersist({ tvWallColor: null });
          }}
          onHeaderFasciaColor={(v) => {
            setHeaderFasciaColor(v);
            if (boothId !== 'builder-8' && boothId !== 'builder-4') return;
            const c = patchThemeColor(v);
            if (c) scheduleColorPersist({ headerFasciaColor: c });
            else if (!v.trim()) scheduleColorPersist({ headerFasciaColor: null });
          }}
          onCounterTopColor={(v) => {
            setCounterTopColor(v);
            if (boothId !== 'builder-8') return;
            const c = patchThemeColor(v);
            if (c) scheduleColorPersist({ counterTopColor: c });
            else if (!v.trim()) scheduleColorPersist({ counterTopColor: null });
          }}
          onHeaderTextColor={(v) => {
            setHeaderTextColor(v);
            const c = patchThemeColor(v);
            if (c) scheduleColorPersist({ headerTextColor: c });
            else scheduleColorPersist({ headerTextColor: null });
          }}
          onApplyPreset={(preset) => void applyColorPreset(preset)}
        />

        <BoothLayoutSetupSection
          boothId={boothId}
          boothName={booth.name}
          companyTagline={company.tagline}
          headerFasciaColor={
            boothId === 'builder-8' || boothId === 'builder-4' ? headerFasciaColor : color
          }
          accentColor={accent}
          headerLogoUrl={headerLogoUrl}
          projectLogoUrl={projectLogoUrl}
          wallLogoLeftUrl={wallLogoLeftUrl}
          wallLogoRightUrl={wallLogoRightUrl}
          standeeImageUrl={standeeImageUrl}
          headerBranding={headerBranding}
          onLogoUrl={(url) => {
            setHeaderLogoUrl(url);
            if (!url) void persist({ headerLogoUrl: null }, 'Header logo removed');
          }}
          onProjectLogoUrl={(url) => {
            setProjectLogoUrl(url);
            if (!url) void persist({ projectLogoUrl: null }, 'Project logo removed');
          }}
          onWallLogoLeftUrl={setWallLogoLeftUrl}
          onWallLogoRightUrl={setWallLogoRightUrl}
          onStandeeImageUrl={(url) => {
            setStandeeImageUrl(url);
            if (!url) void persist({ standeeImageUrl: null }, 'Standee poster removed');
          }}
          onBrandingChange={(patch) => {
            setHeaderBranding((prev) => {
              const next = { ...prev, ...patch };
              if (
                'centerHeaderLogo' in patch ||
                'hideCenterText' in patch ||
                'hideRera' in patch
              ) {
                void persist({ headerBranding: next }, 'Header fascia layout').then((r) => {
                  if (r.ok) setStatusMsg(r.message);
                  else setErrorMsg(r.message);
                });
              }
              return next;
            });
          }}
          onUploadLogo={async (f) => {
            try {
              const url = await exhibitorUploadBoothLogo(f);
              setHeaderLogoUrl(url);
              const r = await persist({ headerLogoUrl: url }, 'Header logo');
              setStatusMsg(r.message);
            } catch (err) {
              setErrorMsg(exhibitorUploadError(err));
            }
          }}
          onUploadProjectLogo={async (f) => {
            try {
              const url = await exhibitorUploadBoothLogo(f);
              setProjectLogoUrl(url);
              const r = await persist({ projectLogoUrl: url }, 'Project logo');
              setStatusMsg(r.message);
            } catch (err) {
              setErrorMsg(exhibitorUploadError(err));
            }
          }}
          onUploadWallLogoLeft={async (f) => {
            try {
              const url = await exhibitorUploadBoothLogo(f);
              setWallLogoLeftUrl(url);
              const r = await persist({ wallLogoLeftUrl: url }, 'Left wall logo');
              setStatusMsg(r.message);
            } catch (err) {
              setErrorMsg(exhibitorUploadError(err));
            }
          }}
          onUploadWallLogoRight={async (f) => {
            try {
              const url = await exhibitorUploadBoothLogo(f);
              setWallLogoRightUrl(url);
              const r = await persist({ wallLogoRightUrl: url }, 'Right wall logo');
              setStatusMsg(r.message);
            } catch (err) {
              setErrorMsg(exhibitorUploadError(err));
            }
          }}
          onUploadStandeeImage={async (f) => {
            try {
              const url = await exhibitorUploadPlacementImage(f);
              setStandeeImageUrl(url);
              const r = await persist({ standeeImageUrl: url }, 'Standee poster');
              setStatusMsg(r.message);
            } catch (err) {
              setErrorMsg(exhibitorUploadError(err));
            }
          }}
        />

        <BoothPlacementSetupSection
          sideWallLeftImageUrl={sideWallLeftImageUrl}
          sideWallRightImageUrl={sideWallRightImageUrl}
          exteriorWallLeftImageUrl={exteriorWallLeftImageUrl}
          exteriorWallRightImageUrl={exteriorWallRightImageUrl}
          counterFrontImageUrl={counterFrontImageUrl}
          onClearAllPlacementImages={() => void clearAllPlacementImages()}
          onSideWallLeftUrl={(url) => {
            setSideWallLeftImageUrl(url);
            if (!url) {
              onResetPlacementAdjust('interiorLeft');
              void clearPlacementImage('sideWallLeftImageUrl', 'Left inside wall image removed');
            }
          }}
          onSideWallRightUrl={(url) => {
            setSideWallRightImageUrl(url);
            if (!url) {
              onResetPlacementAdjust('interiorRight');
              void clearPlacementImage('sideWallRightImageUrl', 'Right inside wall image removed');
            }
          }}
          onExteriorWallLeftUrl={(url) => {
            setExteriorWallLeftImageUrl(url);
            if (!url) {
              onResetPlacementAdjust('exteriorLeft');
              void clearPlacementImage('exteriorWallLeftImageUrl', 'Left outside wall image removed');
            }
          }}
          onExteriorWallRightUrl={(url) => {
            setExteriorWallRightImageUrl(url);
            if (!url) {
              onResetPlacementAdjust('exteriorRight');
              void clearPlacementImage('exteriorWallRightImageUrl', 'Right outside wall image removed');
            }
          }}
          onCounterFrontUrl={(url) => {
            setCounterFrontImageUrl(url);
            if (!url) {
              onResetPlacementAdjust('counterFront');
              void clearPlacementImage('counterFrontImageUrl', 'Counter front image removed');
            }
          }}
          onUploadSideWallLeft={async (f) => {
            try {
              const url = await exhibitorUploadPlacementImage(f);
              setSideWallLeftImageUrl(url);
              const r = await persist(
                buildWallPersistPatch({ sideWallLeftImageUrl: url }),
                'Left inside wall image',
              );
              setStatusMsg(r.message);
            } catch (err) {
              setErrorMsg(exhibitorUploadError(err));
            }
          }}
          onUploadSideWallRight={async (f) => {
            try {
              const url = await exhibitorUploadPlacementImage(f);
              setSideWallRightImageUrl(url);
              const r = await persist(
                buildWallPersistPatch({ sideWallRightImageUrl: url }),
                'Right inside wall image',
              );
              setStatusMsg(r.message);
            } catch (err) {
              setErrorMsg(exhibitorUploadError(err));
            }
          }}
          onUploadExteriorWallLeft={async (f) => {
            try {
              const url = await exhibitorUploadPlacementImage(f);
              setExteriorWallLeftImageUrl(url);
              const r = await persist(
                buildWallPersistPatch({ exteriorWallLeftImageUrl: url }),
                'Left outside wall image',
              );
              setStatusMsg(r.message);
            } catch (err) {
              setErrorMsg(exhibitorUploadError(err));
            }
          }}
          onUploadExteriorWallRight={async (f) => {
            try {
              const url = await exhibitorUploadPlacementImage(f);
              setExteriorWallRightImageUrl(url);
              const r = await persist(
                buildWallPersistPatch({ exteriorWallRightImageUrl: url }),
                'Right outside wall image',
              );
              setStatusMsg(r.message);
            } catch (err) {
              setErrorMsg(exhibitorUploadError(err));
            }
          }}
          onUploadCounterFront={async (f) => {
            try {
              const url = await exhibitorUploadPlacementImage(f);
              setCounterFrontImageUrl(url);
              const r = await persist({ counterFrontImageUrl: url }, 'Counter front image');
              setStatusMsg(r.message);
            } catch (err) {
              setErrorMsg(exhibitorUploadError(err));
            }
          }}
          onUploadPlacementSlot={uploadPlacementSlot}
          wallPlacementAdjustments={wallPlacementAdjustments}
          onAdjustPlacement={onAdjustPlacement}
          onResetPlacementAdjust={onResetPlacementAdjust}
        />

        <section className="exb-card exb-page-section exb-page-wide">
          <div className="exb-card-head">
            <h3>Unit layouts</h3>
            <button type="button" className="exb-btn" onClick={() => setUnitLayouts((p) => [...p, newUnitLayout()])}>
              <Plus size={14} />
              Add layout
            </button>
          </div>
          <p className="exb-muted">
            Name each unit type (2 BHK, 3 BHK, Penthouse…) and upload its layout image or PDF. Files
            are stored locally in booth config for testing (R2 paused).
          </p>
          <div className="exb-unit-layout-list">
            {unitLayouts.map((row, idx) => (
              <div key={row.id} className="exb-unit-layout-row">
                <input
                  className="exb-field"
                  placeholder="Layout name"
                  value={row.name}
                  onChange={(e) =>
                    setUnitLayouts((p) => p.map((u, i) => (i === idx ? { ...u, name: e.target.value } : u)))
                  }
                />
                <div className="exb-unit-layout-file">
                  {row.imageUrl ? (
                    <span className="exb-unit-thumb">
                      {/\.pdf/i.test(row.imageUrl) ? 'PDF' : <img src={row.imageUrl} alt="" />}
                    </span>
                  ) : (
                    <span className="exb-muted">No file</span>
                  )}
                  <label className="exb-btn exb-btn-sm">
                    <ImagePlus size={14} />
                    Upload
                    <input
                      type="file"
                      className="exb-hidden-input"
                      accept="image/*,.pdf,application/pdf"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = '';
                        if (!f) return;
                        void (async () => {
                          try {
                            const url = await exhibitorUploadFile(f, boothId, 'unit-layout');
                            setUnitLayouts((p) => p.map((u, i) => (i === idx ? { ...u, imageUrl: url } : u)));
                          } catch (err) {
                            setErrorMsg(exhibitorUploadError(err));
                          }
                        })();
                      }}
                    />
                  </label>
                </div>
                <button
                  type="button"
                  className="exb-icon-btn"
                  disabled={unitLayouts.length <= 1}
                  onClick={() => setUnitLayouts((p) => p.filter((_, i) => i !== idx))}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="exb-card exb-page-section exb-page-wide">
          <div className="exb-card-head">
            <h3>Floor plans</h3>
            <button type="button" className="exb-btn" onClick={() => setFloorPlans((p) => [...p, newFloorPlan()])}>
              <Plus size={14} />
              Add floor plan
            </button>
          </div>
          <p className="exb-muted">
            Name each floor plan (2 BHK, 3 BHK, Penthouse…) and upload its image or PDF. Stored
            locally for testing (R2 paused).
          </p>
          <div className="exb-unit-layout-list">
            {floorPlans.map((row, idx) => (
              <div key={row.id} className="exb-unit-layout-row">
                <input
                  className="exb-field"
                  placeholder="Floor plan name"
                  value={row.name}
                  onChange={(e) =>
                    setFloorPlans((p) => p.map((u, i) => (i === idx ? { ...u, name: e.target.value } : u)))
                  }
                />
                <div className="exb-unit-layout-file">
                  {row.imageUrl ? (
                    <span className="exb-unit-thumb">
                      {/\.pdf/i.test(row.imageUrl) ? 'PDF' : <img src={row.imageUrl} alt="" />}
                    </span>
                  ) : (
                    <span className="exb-muted">No file</span>
                  )}
                  <label className="exb-btn exb-btn-sm">
                    <ImagePlus size={14} />
                    Upload
                    <input
                      type="file"
                      className="exb-hidden-input"
                      accept="image/*,.pdf,application/pdf"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = '';
                        if (!f) return;
                        void (async () => {
                          try {
                            const url = await exhibitorUploadFile(f, boothId, 'floor-plan');
                            setFloorPlans((p) => p.map((u, i) => (i === idx ? { ...u, imageUrl: url } : u)));
                          } catch (err) {
                            setErrorMsg(exhibitorUploadError(err));
                          }
                        })();
                      }}
                    />
                  </label>
                </div>
                <button
                  type="button"
                  className="exb-icon-btn"
                  disabled={floorPlans.length <= 1}
                  onClick={() => setFloorPlans((p) => p.filter((_, i) => i !== idx))}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="exb-card exb-page-section">
          <h3>Site layout</h3>
          <p className="exb-muted">
            Master plan visitors open from the Site layout button. Stored locally for testing (R2
            paused).
          </p>
          {siteMapUrl && (
            <div className="exb-asset-preview-mini">
              {/\.pdf/i.test(siteMapUrl) ? <span>PDF uploaded</span> : <img src={siteMapUrl} alt="" />}
            </div>
          )}
          <label className="exb-btn">
            <Upload size={14} />
            Upload site layout
            <input
              type="file"
              className="exb-hidden-input"
              accept="image/*,.pdf,application/pdf"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (!f) return;
                void (async () => {
                  try {
                    const url = await exhibitorUploadFile(f, boothId, 'site-map');
                    setSiteMapUrl(url);
                    const r = await persist(siteMapToStorageFields([url]), 'Site layout');
                    setStatusMsg(r.message);
                  } catch (err) {
                    setErrorMsg(exhibitorUploadError(err));
                  }
                })();
              }}
            />
          </label>
        </section>

        <section className="exb-card exb-page-section exb-page-wide">
          <h3>Exhibitor profile</h3>
          <p className="exb-muted">Company details on your dashboard and visitor contact card.</p>
          <div className="exb-exhibitor-fields exb-exhibitor-grid">
            <label>
              <span>Company name</span>
              <input className="exb-field" value={company.companyName} onChange={(e) => setCompany({ ...company, companyName: e.target.value })} />
            </label>
            <label>
              <span>Tagline</span>
              <input className="exb-field" value={company.tagline} onChange={(e) => setCompany({ ...company, tagline: e.target.value })} />
            </label>
            <label>
              <span>Website</span>
              <input className="exb-field" value={company.website} onChange={(e) => setCompany({ ...company, website: e.target.value })} />
            </label>
            <label>
              <span>Phone</span>
              <input className="exb-field" value={company.phone} onChange={(e) => setCompany({ ...company, phone: e.target.value })} />
            </label>
            <label>
              <span>Email</span>
              <input className="exb-field" value={company.email} onChange={(e) => setCompany({ ...company, email: e.target.value })} />
            </label>
            <label>
              <span>WhatsApp</span>
              <input className="exb-field" value={company.whatsapp} onChange={(e) => setCompany({ ...company, whatsapp: e.target.value })} />
            </label>
          </div>
        </section>
      </div>
    </>
  );
}
