import { Upload } from 'lucide-react';
import type { BoothHeaderBranding } from '@/features/shared/data/boothLayouts';
import {
  MANAGED_HEADER_BOOTH_IDS,
  resolveBoothHeaderBranding,
  resolveFasciaLayout,
  resolveHeaderLogoScale,
  resolveManagedHeaderCopy,
} from '@/features/shared/data/boothLayouts';

type WallLogoFieldProps = {
  label: string;
  url: string;
  onUrl: (url: string) => void;
  onUpload: (file: File) => Promise<void>;
};

function WallLogoField({ label, url, onUrl, onUpload }: WallLogoFieldProps) {
  return (
    <div className="exb-booth-layout-field">
      <span className="exb-booth-layout-label">{label}</span>
      <div className="exb-asset-logo-row">
        {url ? (
          <img src={url} alt="" className="exb-asset-logo-preview" />
        ) : (
          <div className="exb-asset-logo-placeholder">LG</div>
        )}
        <div className="exb-booth-layout-actions">
          <label className="exb-btn">
            <Upload size={14} />
            Upload logo
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
    </div>
  );
}

type Props = {
  boothId?: string;
  boothName: string;
  companyTagline: string;
  /** Matches 3D header fascia (side wall color for most booths). */
  headerFasciaColor?: string;
  accentColor?: string;
  headerLogoUrl: string;
  projectLogoUrl: string;
  wallLogoLeftUrl: string;
  wallLogoRightUrl: string;
  standeeImageUrl: string;
  headerBranding: BoothHeaderBranding;
  onLogoUrl: (url: string) => void;
  onProjectLogoUrl: (url: string) => void;
  onWallLogoLeftUrl: (url: string) => void;
  onWallLogoRightUrl: (url: string) => void;
  onStandeeImageUrl: (url: string) => void;
  onBrandingChange: (patch: Partial<BoothHeaderBranding>) => void;
  onUploadLogo: (file: File) => Promise<void>;
  onUploadProjectLogo: (file: File) => Promise<void>;
  onUploadWallLogoLeft: (file: File) => Promise<void>;
  onUploadWallLogoRight: (file: File) => Promise<void>;
  onUploadStandeeImage: (file: File) => Promise<void>;
};

export function BoothLayoutSetupSection({
  boothId,
  boothName,
  companyTagline,
  headerFasciaColor = '#fcfaf5',
  accentColor = '#d4af37',
  headerLogoUrl,
  projectLogoUrl,
  wallLogoLeftUrl,
  wallLogoRightUrl,
  standeeImageUrl,
  headerBranding,
  onLogoUrl,
  onProjectLogoUrl,
  onWallLogoLeftUrl,
  onWallLogoRightUrl,
  onStandeeImageUrl,
  onBrandingChange,
  onUploadLogo,
  onUploadProjectLogo,
  onUploadWallLogoLeft,
  onUploadWallLogoRight,
  onUploadStandeeImage,
}: Props) {
  const usesManagedHeader = boothId ? MANAGED_HEADER_BOOTH_IDS.has(boothId) : false;
  const resolved = resolveBoothHeaderBranding({
    name: boothName,
    headerBranding,
    companyTagline,
  });
  const managedCopy = resolveManagedHeaderCopy({
    headerBranding: {
      ...headerBranding,
      projectName: headerBranding.projectName?.trim() || boothName,
    },
    companyTagline,
    hasProjectLogo: Boolean(projectLogoUrl.trim()),
  });
  const logoScale = resolveHeaderLogoScale(headerBranding);
  const previewLogoMaxH = Math.round(44 * logoScale);
  const { centerLogo, hideCenterText, showRera } = resolveFasciaLayout(
    headerBranding,
    Boolean(projectLogoUrl.trim()),
  );
  const previewTitle = usesManagedHeader ? managedCopy.title : resolved.projectName;
  const previewSubtitle = usesManagedHeader ? managedCopy.subtitle : resolved.projectSubtitle;

  return (
    <section className="exb-card exb-page-section exb-page-wide exb-booth-layout-section">
      <h3>Booth layout</h3>
      <p className="exb-muted">
        Header fascia and back-wall logos appear in fixed slots on the 3D booth — same positions for
        every exhibitor. R2 is paused; logos are saved locally in booth config and auto-resized.
        {usesManagedHeader ? (
          <>
            {' '}
            <strong>B-04 Crown Estates</strong> uses a dedicated managed header in the 3D expo — enable{' '}
            <em>Center header logo only</em> to hide title text and center your logo.
          </>
        ) : null}
      </p>

      <div className="exb-fascia-preview" aria-hidden>
        <div
          className={`exb-fascia-preview-bar${centerLogo ? ' exb-fascia-preview-bar-logo-center' : ''}`}
          style={{ background: headerFasciaColor, borderColor: accentColor }}
        >
          {!centerLogo ? (
            <div className="exb-fascia-slot exb-fascia-slot-logo">
              {headerLogoUrl ? (
                <img
                  src={headerLogoUrl}
                  alt=""
                  style={{ maxHeight: previewLogoMaxH, maxWidth: Math.round(88 * logoScale) }}
                />
              ) : (
                <span>LOGO</span>
              )}
            </div>
          ) : null}
          <div
            className={`exb-fascia-slot exb-fascia-slot-center${centerLogo ? ' exb-fascia-slot-center-logo' : ''}`}
          >
            {centerLogo && headerLogoUrl ? (
              <img
                src={headerLogoUrl}
                alt=""
                style={{ maxHeight: previewLogoMaxH + 8, maxWidth: Math.round(140 * logoScale) }}
              />
            ) : null}
            {!hideCenterText && (previewTitle || previewSubtitle) ? (
              <>
                {previewTitle ? <strong>{previewTitle}</strong> : null}
                {previewSubtitle ? <em>{previewSubtitle}</em> : null}
              </>
            ) : hideCenterText || centerLogo ? (
              <span className="exb-muted">Center text hidden</span>
            ) : null}
          </div>
          {showRera && !projectLogoUrl ? (
            <div className="exb-fascia-slot exb-fascia-slot-rera">
              <span className="exb-fascia-rera-label">RERA</span>
              <span>{resolved.reraNumber || 'Registration no.'}</span>
            </div>
          ) : (
            <div className="exb-fascia-slot exb-fascia-slot-logo exb-fascia-slot-project-logo">
              {projectLogoUrl ? (
                <img
                  src={projectLogoUrl}
                  alt=""
                  style={{ maxHeight: previewLogoMaxH, maxWidth: Math.round(88 * logoScale) }}
                />
              ) : (
                <span>PROJECT LOGO</span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="exb-wall-logo-preview" aria-hidden>
        <div className="exb-wall-logo-preview-row">
          <div className="exb-wall-logo-slot">
            {wallLogoLeftUrl ? <img src={wallLogoLeftUrl} alt="" /> : <span>LOGO</span>}
          </div>
          <div className="exb-wall-logo-screen">Main screen</div>
          <div className="exb-wall-logo-slot">
            {wallLogoRightUrl ? <img src={wallLogoRightUrl} alt="" /> : <span>LOGO</span>}
          </div>
        </div>
      </div>

      <div className="exb-booth-layout-grid">
        <div className="exb-booth-layout-field">
          <span className="exb-booth-layout-label">Header logo · top fascia (left slot)</span>
          <div className="exb-asset-logo-row">
            {headerLogoUrl ? (
              <img src={headerLogoUrl} alt="" className="exb-asset-logo-preview" />
            ) : (
              <div className="exb-asset-logo-placeholder">LG</div>
            )}
            <div className="exb-booth-layout-actions">
              <label className="exb-btn">
                <Upload size={14} />
                Upload logo
                <input
                  type="file"
                  className="exb-hidden-input"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (!f) return;
                    void onUploadLogo(f);
                  }}
                />
              </label>
              {headerLogoUrl ? (
                <button type="button" className="exb-btn" onClick={() => onLogoUrl('')}>
                  Remove
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="exb-booth-layout-field">
          <span className="exb-booth-layout-label">Project logo · top fascia (right slot)</span>
          <div className="exb-asset-logo-row">
            {projectLogoUrl ? (
              <img src={projectLogoUrl} alt="" className="exb-asset-logo-preview" />
            ) : (
              <div className="exb-asset-logo-placeholder">PR</div>
            )}
            <div className="exb-booth-layout-actions">
              <label className="exb-btn">
                <Upload size={14} />
                Upload logo
                <input
                  type="file"
                  className="exb-hidden-input"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (!f) return;
                    void onUploadProjectLogo(f);
                  }}
                />
              </label>
              {projectLogoUrl ? (
                <button type="button" className="exb-btn" onClick={() => onProjectLogoUrl('')}>
                  Remove
                </button>
              ) : null}
            </div>
          </div>
          <p className="exb-muted exb-logo-scale-hint">
            Appears on the right of AIROCITY / project name. Replaces the RERA text slot when set.
          </p>
        </div>

        <div className="exb-booth-layout-field exb-logo-scale-field">
          <div className="exb-logo-scale-head">
            <span className="exb-booth-layout-label">Header logo size · top fascia</span>
            <span className="exb-logo-scale-value">{Math.round(logoScale * 100)}%</span>
          </div>
          <input
            type="range"
            className="exb-range"
            min={50}
            max={250}
            step={5}
            value={Math.round(logoScale * 100)}
            onChange={(e) =>
              onBrandingChange({ logoScale: Number(e.target.value) / 100 })
            }
          />
          <p className="exb-muted exb-logo-scale-hint">
            Drag to enlarge or shrink the logo on the white header beam above your booth (50%–250%).
          </p>
        </div>

        <WallLogoField
          label="Wall logo · left of main screen"
          url={wallLogoLeftUrl}
          onUrl={onWallLogoLeftUrl}
          onUpload={onUploadWallLogoLeft}
        />
        <WallLogoField
          label="Wall logo · right of main screen"
          url={wallLogoRightUrl}
          onUrl={onWallLogoRightUrl}
          onUpload={onUploadWallLogoRight}
        />

        <div className="exb-booth-layout-field">
          <span className="exb-booth-layout-label">
            {boothId === 'builder-8'
              ? 'Standing signage board · poster beside the desk (uses project logo if empty)'
              : 'Standee poster · roll-up beside the desk (uses project logo if empty)'}
          </span>
          <div className="exb-asset-logo-row">
            {standeeImageUrl ? (
              <img src={standeeImageUrl} alt="" className="exb-asset-logo-preview" />
            ) : (
              <div className="exb-asset-logo-placeholder">ST</div>
            )}
            <div className="exb-booth-layout-actions">
              <label className="exb-btn">
                <Upload size={14} />
                Upload poster
                <input
                  type="file"
                  className="exb-hidden-input"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (!f) return;
                    void onUploadStandeeImage(f);
                  }}
                />
              </label>
              {standeeImageUrl ? (
                <button type="button" className="exb-btn" onClick={() => onStandeeImageUrl('')}>
                  Remove
                </button>
              ) : null}
            </div>
          </div>
          <p className="exb-muted exb-logo-scale-hint">
            Tall portrait artwork (roughly 3:5) fills the whole standee. With no poster, the standee
            prints your project name — “{resolved.projectName}”.
          </p>
        </div>

        <label className="exb-booth-layout-field exb-booth-layout-checkbox">
          <input
            type="checkbox"
            checked={centerLogo}
            onChange={(e) =>
              onBrandingChange({
                centerHeaderLogo: e.target.checked,
                hideCenterText: e.target.checked ? true : headerBranding.hideCenterText,
                hideRera: e.target.checked ? true : headerBranding.hideRera,
              })
            }
          />
          <span>
            <strong>Center header logo only</strong> — hide project name / subtitle in the middle,
            move your header logo to the center, and hide the RERA block on the right.
          </span>
        </label>

        <label className="exb-booth-layout-field exb-booth-layout-checkbox">
          <input
            type="checkbox"
            checked={hideCenterText && !centerLogo}
            disabled={centerLogo}
            onChange={(e) => onBrandingChange({ hideCenterText: e.target.checked })}
          />
          <span>
            <strong>Hide center text only</strong> — keep logo on the left; remove project name and
            subtitle (RERA on the right stays).
          </span>
        </label>

        <label className="exb-booth-layout-field exb-booth-layout-checkbox">
          <input
            type="checkbox"
            checked={headerBranding.hideSubtitle === true}
            disabled={hideCenterText}
            onChange={(e) =>
              onBrandingChange({
                hideSubtitle: e.target.checked,
                ...(e.target.checked ? { projectSubtitle: '' } : {}),
              })
            }
          />
          <span>
            <strong>Hide subtitle</strong> — remove the “LUXURY RESIDENCES” line under the project
            name; keep the title.
          </span>
        </label>

        <label className="exb-booth-layout-field">
          <span className="exb-booth-layout-label">Project name · hanging board + fascia</span>
          <input
            className="exb-field"
            placeholder={boothName}
            value={headerBranding.projectName ?? ''}
            onChange={(e) => onBrandingChange({ projectName: e.target.value })}
          />
          <span className="exb-muted" style={{ display: 'block', marginTop: 4, fontSize: 11 }}>
            This custom name shows on the white hanging ceiling board.
          </span>
        </label>

        <label className="exb-booth-layout-field">
          <span className="exb-booth-layout-label">
            Hanging board font size · {Math.round((headerBranding.hangingTitleScale ?? 1.25) * 100)}%
          </span>
          <input
            type="range"
            min={0.7}
            max={1.8}
            step={0.05}
            value={headerBranding.hangingTitleScale ?? 1.25}
            onChange={(e) =>
              onBrandingChange({ hangingTitleScale: Number(e.target.value) })
            }
          />
        </label>

        <label className="exb-booth-layout-field">
          <span className="exb-booth-layout-label">Subtitle · under project name</span>
          <input
            className="exb-field"
            placeholder={companyTagline || 'Optional — leave blank to hide'}
            value={headerBranding.hideSubtitle ? '' : (headerBranding.projectSubtitle ?? '')}
            disabled={headerBranding.hideSubtitle === true || hideCenterText}
            onChange={(e) =>
              onBrandingChange({
                projectSubtitle: e.target.value,
                hideSubtitle: false,
              })
            }
          />
        </label>

        <label className="exb-booth-layout-field">
          <span className="exb-booth-layout-label">RERA registration · right slot (if no project logo)</span>
          <input
            className="exb-field"
            placeholder="e.g. P52100001234"
            value={headerBranding.reraNumber ?? ''}
            onChange={(e) => onBrandingChange({ reraNumber: e.target.value })}
            disabled={Boolean(projectLogoUrl)}
          />
        </label>
      </div>
    </section>
  );
}
