import { useRef } from 'react';
import { Upload } from 'lucide-react';
import type {
  BoothPlacementAdjust,
  BoothPlacementSlot,
  BoothWallPlacementAdjustments,
} from '@/features/booths/components/boothWallMetrics';
import {
  normalizePlacementAdjust,
  PLACEMENT_ADJUST_LIMITS,
} from '@/features/booths/components/boothWallMetrics';
import { ExhibitorPlacementPreview } from './ExhibitorPlacementPreview';

type ImageFieldProps = {
  label: string;
  hint: string;
  url: string;
  adjust: BoothPlacementAdjust;
  onUrl: (url: string) => void;
  onUpload: (file: File) => Promise<void>;
  onAdjust: (patch: Partial<BoothPlacementAdjust>) => void;
  onResetAdjust: () => void;
};

function PlacementAdjustSliders({
  adjust,
  onAdjust,
  onReset,
}: {
  adjust: BoothPlacementAdjust;
  onAdjust: (patch: Partial<BoothPlacementAdjust>) => void;
  onReset: () => void;
}) {
  const { offsetX, offsetY, scale } = normalizePlacementAdjust(adjust);
  const { offsetX: lx, offsetY: ly, scale: ls } = PLACEMENT_ADJUST_LIMITS;

  return (
    <div className="exb-placement-adjust">
      <div className="exb-placement-adjust-head">
        <span>Position &amp; size</span>
        <button type="button" className="exb-link exb-link-sm" onClick={onReset}>
          Reset
        </button>
      </div>
      <label className="exb-placement-adjust-row">
        <span>↔ Horizontal</span>
        <input
          type="range"
          min={lx.min}
          max={lx.max}
          step={lx.step}
          value={offsetX}
          onChange={(e) => onAdjust({ offsetX: Number(e.target.value) })}
        />
        <output>{offsetX.toFixed(2)} m</output>
      </label>
      <label className="exb-placement-adjust-row">
        <span>↕ Vertical</span>
        <input
          type="range"
          min={ly.min}
          max={ly.max}
          step={ly.step}
          value={offsetY}
          onChange={(e) => onAdjust({ offsetY: Number(e.target.value) })}
        />
        <output>{offsetY.toFixed(2)} m</output>
      </label>
      <label className="exb-placement-adjust-row">
        <span>Size</span>
        <input
          type="range"
          min={ls.min}
          max={ls.max}
          step={ls.step}
          value={scale}
          onChange={(e) => onAdjust({ scale: Number(e.target.value) })}
        />
        <output>{Math.round(scale * 100)}%</output>
      </label>
    </div>
  );
}

function PlacementImageField({
  label,
  hint,
  url,
  adjust,
  onUrl,
  onUpload,
  onAdjust,
  onResetAdjust,
}: ImageFieldProps) {
  return (
    <div className="exb-booth-layout-field">
      <span className="exb-booth-layout-label">{label}</span>
      <span className="exb-muted exb-placement-hint">{hint}</span>
      <div className="exb-asset-logo-row">
        {url ? (
          <img src={url} alt="" className="exb-asset-logo-preview exb-placement-preview" />
        ) : (
          <div className="exb-asset-logo-placeholder exb-placement-placeholder">IMG</div>
        )}
        <div className="exb-booth-layout-actions">
          <label className="exb-btn">
            <Upload size={14} />
            Upload image
            <input
              type="file"
              className="exb-hidden-input"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (!f) return;
                void onUpload(f);
              }}
            />
          </label>
          {url ? (
            <button type="button" className="exb-btn" onClick={() => onUrl('')}>
              Remove
            </button>
          ) : null}
        </div>
      </div>
      {url ? (
        <PlacementAdjustSliders adjust={adjust} onAdjust={onAdjust} onReset={onResetAdjust} />
      ) : null}
    </div>
  );
}

function ClickablePreviewSlot({
  label,
  url,
  onUpload,
  inner,
  variant = 'side',
}: {
  label: string;
  url: string;
  onUpload: (file: File) => Promise<void>;
  inner?: boolean;
  variant?: 'side' | 'counter';
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const className =
    variant === 'counter'
      ? 'exb-placement-preview-counter exb-placement-preview-clickable'
      : `exb-placement-preview-side exb-placement-preview-clickable${inner ? ' exb-placement-preview-inner' : ''}`;

  return (
    <button
      type="button"
      className={className}
      title={`Click to upload — ${label}`}
      onClick={() => inputRef.current?.click()}
    >
      {url ? <img src={url} alt="" /> : <span>{label}</span>}
      <span className="exb-placement-preview-upload-hint">+ upload</span>
      <input
        ref={inputRef}
        type="file"
        className="exb-hidden-input"
        accept="image/*"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          void onUpload(f);
        }}
      />
    </button>
  );
}

type Props = {
  sideWallLeftImageUrl: string;
  sideWallRightImageUrl: string;
  exteriorWallLeftImageUrl: string;
  exteriorWallRightImageUrl: string;
  counterFrontImageUrl: string;
  onSideWallLeftUrl: (url: string) => void;
  onSideWallRightUrl: (url: string) => void;
  onExteriorWallLeftUrl: (url: string) => void;
  onExteriorWallRightUrl: (url: string) => void;
  onCounterFrontUrl: (url: string) => void;
  onUploadSideWallLeft: (file: File) => Promise<void>;
  onUploadSideWallRight: (file: File) => Promise<void>;
  onUploadExteriorWallLeft: (file: File) => Promise<void>;
  onUploadExteriorWallRight: (file: File) => Promise<void>;
  onUploadCounterFront: (file: File) => Promise<void>;
  onUploadPlacementSlot: (slot: BoothPlacementSlot, file: File) => Promise<void>;
  wallPlacementAdjustments: BoothWallPlacementAdjustments;
  onAdjustPlacement: (slot: BoothPlacementSlot, patch: Partial<BoothPlacementAdjust>) => void;
  onResetPlacementAdjust: (slot: BoothPlacementSlot) => void;
  onClearAllPlacementImages: () => void;
};

export function BoothPlacementSetupSection({
  sideWallLeftImageUrl,
  sideWallRightImageUrl,
  exteriorWallLeftImageUrl,
  exteriorWallRightImageUrl,
  counterFrontImageUrl,
  onSideWallLeftUrl,
  onSideWallRightUrl,
  onExteriorWallLeftUrl,
  onExteriorWallRightUrl,
  onCounterFrontUrl,
  onUploadSideWallLeft,
  onUploadSideWallRight,
  onUploadExteriorWallLeft,
  onUploadExteriorWallRight,
  onUploadCounterFront,
  onUploadPlacementSlot,
  wallPlacementAdjustments,
  onAdjustPlacement,
  onResetPlacementAdjust,
  onClearAllPlacementImages,
}: Props) {
  const adj = (slot: BoothPlacementSlot) => wallPlacementAdjustments[slot] ?? {};
  const hasAnyPlacementImage = Boolean(
    sideWallLeftImageUrl ||
      sideWallRightImageUrl ||
      exteriorWallLeftImageUrl ||
      exteriorWallRightImageUrl ||
      counterFrontImageUrl,
  );
  return (
    <section className="exb-card exb-page-section exb-page-wide exb-booth-layout-section">
      <h3>Image placements</h3>
      <p className="exb-muted">
        <strong>Outside walls</strong> = large white side panels (walk the aisle to see them).{' '}
        <strong>Inside walls</strong> = entrance panels as you walk in. Click any slot below or in the
        3D preview to upload. The large <strong>main back screen</strong> in the expo is the default
        walkthrough video — change it under <strong>Documents → Walkthrough video</strong>, not here.
      </p>
      {hasAnyPlacementImage ? (
        <p className="exb-muted">
          Thumbnails below are saved for this booth only. Use <strong>Remove</strong> on each slot (or
          clear all) if you did not upload a poster — old saves can show your header logo by mistake.
        </p>
      ) : null}
      {hasAnyPlacementImage ? (
        <button type="button" className="exb-btn exb-btn-sm" onClick={onClearAllPlacementImages}>
          Clear all wall &amp; counter images
        </button>
      ) : null}

      <p className="exb-muted exb-placement-diagram-label">Click a slot to upload</p>
      <div className="exb-placement-preview">
        <div className="exb-placement-preview-booth exb-placement-preview-booth-wide">
          <ClickablePreviewSlot
            label="Out · left"
            url={exteriorWallLeftImageUrl}
            onUpload={onUploadExteriorWallLeft}
          />
          <ClickablePreviewSlot
            label="In · left"
            url={sideWallLeftImageUrl}
            onUpload={onUploadSideWallLeft}
            inner
          />
          <div className="exb-placement-preview-center">
            <div className="exb-placement-preview-screen">Main screen</div>
            <ClickablePreviewSlot
              label="Counter"
              url={counterFrontImageUrl}
              onUpload={onUploadCounterFront}
              variant="counter"
            />
          </div>
          <ClickablePreviewSlot
            label="In · right"
            url={sideWallRightImageUrl}
            onUpload={onUploadSideWallRight}
            inner
          />
          <ClickablePreviewSlot
            label="Out · right"
            url={exteriorWallRightImageUrl}
            onUpload={onUploadExteriorWallRight}
          />
        </div>
      </div>

      <ExhibitorPlacementPreview
        sideWallLeftImageUrl={sideWallLeftImageUrl}
        sideWallRightImageUrl={sideWallRightImageUrl}
        exteriorWallLeftImageUrl={exteriorWallLeftImageUrl}
        exteriorWallRightImageUrl={exteriorWallRightImageUrl}
        counterFrontImageUrl={counterFrontImageUrl}
        wallPlacementAdjustments={wallPlacementAdjustments}
        onUploadSlot={onUploadPlacementSlot}
      />

      <h4 className="exb-placement-group-title">Outside the booth (aisle walls)</h4>
      <div className="exb-booth-layout-grid exb-placement-grid">
        <PlacementImageField
          label="Left wall · outside"
          hint="Large white wall facing the expo aisle — visible when walking past the booth."
          url={exteriorWallLeftImageUrl}
          adjust={adj('exteriorLeft')}
          onUrl={onExteriorWallLeftUrl}
          onUpload={onUploadExteriorWallLeft}
          onAdjust={(patch) => onAdjustPlacement('exteriorLeft', patch)}
          onResetAdjust={() => onResetPlacementAdjust('exteriorLeft')}
        />
        <PlacementImageField
          label="Right wall · outside"
          hint="Outer right side wall — faces the aisle, outside the booth floor."
          url={exteriorWallRightImageUrl}
          adjust={adj('exteriorRight')}
          onUrl={onExteriorWallRightUrl}
          onUpload={onUploadExteriorWallRight}
          onAdjust={(patch) => onAdjustPlacement('exteriorRight', patch)}
          onResetAdjust={() => onResetPlacementAdjust('exteriorRight')}
        />
      </div>

      <h4 className="exb-placement-group-title">Inside the booth</h4>
      <div className="exb-booth-layout-grid exb-placement-grid">
        <PlacementImageField
          label="Left wall · inside"
          hint="Entrance wing panel inside the booth (left as you walk in)."
          url={sideWallLeftImageUrl}
          adjust={adj('interiorLeft')}
          onUrl={onSideWallLeftUrl}
          onUpload={onUploadSideWallLeft}
          onAdjust={(patch) => onAdjustPlacement('interiorLeft', patch)}
          onResetAdjust={() => onResetPlacementAdjust('interiorLeft')}
        />
        <PlacementImageField
          label="Right wall · inside"
          hint="Entrance wing panel inside the booth (right as you walk in)."
          url={sideWallRightImageUrl}
          adjust={adj('interiorRight')}
          onUrl={onSideWallRightUrl}
          onUpload={onUploadSideWallRight}
          onAdjust={(patch) => onAdjustPlacement('interiorRight', patch)}
          onResetAdjust={() => onResetPlacementAdjust('interiorRight')}
        />
        <PlacementImageField
          label="Counter front"
          hint="Branding panel on the reception desk."
          url={counterFrontImageUrl}
          adjust={adj('counterFront')}
          onUrl={onCounterFrontUrl}
          onUpload={onUploadCounterFront}
          onAdjust={(patch) => onAdjustPlacement('counterFront', patch)}
          onResetAdjust={() => onResetPlacementAdjust('counterFront')}
        />
      </div>
    </section>
  );
}
