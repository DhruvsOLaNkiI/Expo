import { BOOTH_COLOR_PRESETS, type BoothColorPreset } from '@/features/shared/data/boothLayouts';

function normalizeHex(value: string): string {
  const v = value.trim().toLowerCase();
  if (!v.startsWith('#')) return v;
  if (v.length === 4) {
    return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  }
  return v;
}

function matchesPreset(
  color: string,
  accent: string,
  counterColor: string,
  preset: BoothColorPreset,
  eco?: {
    backWallColor: string;
    tvWallColor: string;
    headerFasciaColor: string;
    counterTopColor: string;
  },
): boolean {
  const base =
    normalizeHex(color) === normalizeHex(preset.color) &&
    normalizeHex(accent) === normalizeHex(preset.accent) &&
    normalizeHex(counterColor) === normalizeHex(preset.counterColor);
  if (!eco || !preset.backWallColor) return base;
  return (
    base &&
    normalizeHex(eco.backWallColor) === normalizeHex(preset.backWallColor) &&
    normalizeHex(eco.tvWallColor) === normalizeHex(preset.tvWallColor ?? preset.backWallColor) &&
    normalizeHex(eco.headerFasciaColor) === normalizeHex(preset.headerFasciaColor ?? '#fcfcfc') &&
    normalizeHex(eco.counterTopColor) === normalizeHex(preset.counterTopColor ?? preset.accent)
  );
}

function ColorField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const safe = /^#[0-9a-f]{6}$/i.test(value) ? value : '#ffffff';

  return (
    <div className="exb-booth-color-field">
      <div className="exb-booth-color-field-head">
        <span className="exb-booth-layout-label">{label}</span>
        {hint ? <span className="exb-muted exb-booth-color-hint">{hint}</span> : null}
      </div>
      <div className="exb-booth-color-input-row">
        <input
          type="color"
          className="exb-booth-color-swatch"
          value={safe}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`${label} color picker`}
        />
        <input
          type="text"
          className="exb-input exb-booth-color-hex"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#ffffff"
          spellCheck={false}
        />
      </div>
    </div>
  );
}

type Props = {
  boothId: string;
  boothLabel: string;
  boothCode: string;
  color: string;
  accent: string;
  counterColor: string;
  backWallColor: string;
  tvWallColor: string;
  headerFasciaColor: string;
  counterTopColor: string;
  onColor: (v: string) => void;
  onAccent: (v: string) => void;
  onCounterColor: (v: string) => void;
  onBackWallColor: (v: string) => void;
  onTvWallColor: (v: string) => void;
  onHeaderFasciaColor: (v: string) => void;
  onCounterTopColor: (v: string) => void;
  onApplyPreset: (preset: BoothColorPreset) => void;
};

export function BoothColorThemeSection({
  boothId,
  boothLabel,
  boothCode,
  color,
  accent,
  counterColor,
  backWallColor,
  tvWallColor,
  headerFasciaColor,
  counterTopColor,
  onColor,
  onAccent,
  onCounterColor,
  onBackWallColor,
  onTvWallColor,
  onHeaderFasciaColor,
  onCounterTopColor,
  onApplyPreset,
}: Props) {
  const isEcoBooth = boothId === 'builder-8';
  const eco = isEcoBooth
    ? { backWallColor, tvWallColor, headerFasciaColor, counterTopColor }
    : undefined;

  const activePresetId =
    BOOTH_COLOR_PRESETS.find((p) => matchesPreset(color, accent, counterColor, p, eco))?.id ??
    'custom';

  return (
    <section className="exb-card exb-page-section exb-page-wide exb-booth-color-section">
      <h3>Booth colors</h3>
      <div className="exb-booth-color-scope" role="note">
        <strong>
          Editing {boothLabel} ({boothCode})
        </strong>
        <p>
          Colors apply only to <strong>this</strong> booth in the 3D hall — not every stall at once. Use the
          booth switcher (top left) to theme Luxe Towers, Aurum, etc. separately. In the expo, use{' '}
          <strong>Jump to → {boothLabel}</strong> to stand in front of your booth and see walls + header.
        </p>
        <p className="exb-booth-color-scope-hall">
          The <strong>red hall carpet</strong> is fixed for the whole venue. Theme presets mostly change{' '}
          <strong>Accent / trim</strong> (pillars &amp; gold strips); for a bold wall color use{' '}
          <strong>Custom</strong> and change <strong>Side wall color</strong> (e.g. <code>#e85d04</code> orange).
        </p>
      </div>
      <p className="exb-muted">
        Pick a ready-made theme or use <strong>Custom</strong> to set colors.
        {isEcoBooth
          ? ' Eldeco (B-08) has separate controls for back wall, TV bay, header fascia, and counter top.'
          : ' Side wall color also paints the header fascia. Colors save automatically when you adjust a picker.'}
      </p>

      <p className="exb-booth-color-presets-label">Theme presets</p>
      <div className="exb-booth-color-presets">
        {BOOTH_COLOR_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={`exb-booth-color-preset${activePresetId === preset.id ? ' active' : ''}`}
            onClick={() => onApplyPreset(preset)}
          >
            <span className="exb-booth-color-preset-swatches" aria-hidden>
              <i style={{ background: preset.color }} />
              <i style={{ background: preset.accent }} />
              <i style={{ background: preset.counterColor }} />
            </span>
            <span>{preset.label}</span>
          </button>
        ))}
        <button
          type="button"
          className={`exb-booth-color-preset exb-booth-color-preset-custom${
            activePresetId === 'custom' ? ' active' : ''
          }`}
        >
          <span className="exb-booth-color-preset-swatches exb-booth-color-preset-swatches-custom" aria-hidden>
            <i />
            <i />
            <i />
          </span>
          <span>Custom</span>
        </button>
      </div>

      <div className="exb-booth-color-preview" aria-hidden>
        <div className="exb-booth-color-preview-wall" style={{ background: isEcoBooth ? backWallColor : color }}>
          {isEcoBooth ? (
            <div className="exb-booth-color-preview-tv" style={{ background: tvWallColor }}>
              <span>TV</span>
            </div>
          ) : null}
          <div className="exb-booth-color-preview-trim" style={{ background: accent }} />
          <div
            className="exb-booth-color-preview-header"
            style={{ background: isEcoBooth ? headerFasciaColor : color }}
          >
            Header
          </div>
          <div className="exb-booth-color-preview-counter" style={{ background: counterColor }}>
            <span className="exb-booth-color-preview-counter-top" style={{ background: isEcoBooth ? counterTopColor : accent }}>
              Top
            </span>
          </div>
        </div>
      </div>

      <div className="exb-booth-color-grid">
        <ColorField
          label="Side wall color"
          hint={isEcoBooth ? 'Entrance wing panels' : 'Back wall & side panels'}
          value={color}
          onChange={onColor}
        />
        <ColorField
          label="Accent / trim"
          hint="Pillars & trim strips"
          value={accent}
          onChange={onAccent}
        />
        <ColorField
          label="Counter body"
          hint="Reception desk body"
          value={counterColor}
          onChange={onCounterColor}
        />
      </div>

      {isEcoBooth ? (
        <>
          <h4 className="exb-placement-group-title">Eldeco B-08 surfaces</h4>
          <div className="exb-booth-color-grid exb-booth-color-grid-eco">
            <ColorField
              label="Back wall"
              hint="Main rear wall behind TV"
              value={backWallColor}
              onChange={onBackWallColor}
            />
            <ColorField
              label="TV wall color"
              hint="Panel behind main LED screen"
              value={tvWallColor}
              onChange={onTvWallColor}
            />
            <ColorField
              label="Header color"
              hint="Top fascia panel background"
              value={headerFasciaColor}
              onChange={onHeaderFasciaColor}
            />
            <ColorField
              label="Counter top"
              hint="Green trim bar on desk"
              value={counterTopColor}
              onChange={onCounterTopColor}
            />
          </div>
        </>
      ) : null}
    </section>
  );
}
