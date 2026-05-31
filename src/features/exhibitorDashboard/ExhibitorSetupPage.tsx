import { useCallback, useEffect, useState } from 'react';
import { ImagePlus, Plus, Trash2, Upload } from 'lucide-react';
import {
  siteMapToStorageFields,
  siteMapUrlsFromConfig,
  floorPlansFromConfig,
  floorPlansToStorageFields,
  unitLayoutsFromConfig,
  unitLayoutsToStorageFields,
  type CompanyProfile,
  type UnitLayoutItem,
} from '@/features/shared/data/boothLayouts';
import { ExhibitorChecklistBanner } from './ExhibitorChecklistBanner';
import {
  exhibitorUploadError,
  exhibitorUploadFile,
  useExhibitorPersist,
} from './exhibitorUpload';
import type { ExhibitorNavId } from './exhibitorConfig';
import { useExhibitorBooth } from './useExhibitorBooth';

function newUnitLayout(name = ''): UnitLayoutItem {
  return { id: `ul-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name, imageUrl: '' };
}

function newFloorPlan(name = ''): UnitLayoutItem {
  return { id: `fp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name, imageUrl: '' };
}

type Props = { onNav: (id: ExhibitorNavId) => void };

export function ExhibitorSetupPage({ onNav }: Props) {
  const { booth, boothId, patchBooth, loading } = useExhibitorBooth();
  const persist = useExhibitorPersist(patchBooth);

  const [headerLogoUrl, setHeaderLogoUrl] = useState('');
  const [unitLayouts, setUnitLayouts] = useState<UnitLayoutItem[]>([newUnitLayout()]);
  const [floorPlans, setFloorPlans] = useState<UnitLayoutItem[]>([newFloorPlan()]);
  const [siteMapUrl, setSiteMapUrl] = useState('');
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!booth) return;
    setHeaderLogoUrl(booth.headerLogoUrl ?? '');
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
        headerLogoUrl: headerLogoUrl.trim() || undefined,
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
  }, [company, floorPlans, headerLogoUrl, persist, siteMapUrl, unitLayouts]);

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
        <section className="exb-card exb-page-section">
          <h3>Logo</h3>
          <p className="exb-muted">Your brand mark on the 3D booth header.</p>
          <div className="exb-asset-logo-row">
            {headerLogoUrl ? (
              <img src={headerLogoUrl} alt="" className="exb-asset-logo-preview" />
            ) : (
              <div className="exb-asset-logo-placeholder">{company.companyName.slice(0, 2).toUpperCase()}</div>
            )}
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
                  void (async () => {
                    try {
                      const url = await exhibitorUploadFile(f, boothId, 'logo');
                      setHeaderLogoUrl(url);
                      const r = await persist({ headerLogoUrl: url }, 'Logo');
                      setStatusMsg(r.message);
                    } catch (err) {
                      setErrorMsg(exhibitorUploadError(err));
                    }
                  })();
                }}
              />
            </label>
          </div>
        </section>

        <section className="exb-card exb-page-section exb-page-wide">
          <div className="exb-card-head">
            <h3>Unit layouts</h3>
            <button type="button" className="exb-btn" onClick={() => setUnitLayouts((p) => [...p, newUnitLayout()])}>
              <Plus size={14} />
              Add layout
            </button>
          </div>
          <p className="exb-muted">Name each unit type (2 BHK, 3 BHK, Penthouse…) and upload its layout image or PDF.</p>
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
          <p className="exb-muted">Name each floor plan (2 BHK, 3 BHK, Penthouse…) and upload its image or PDF.</p>
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
          <p className="exb-muted">Master plan visitors open from the Site layout button.</p>
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
