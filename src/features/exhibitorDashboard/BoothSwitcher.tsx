import { Building2, ChevronDown, Store } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { boothDisplayCode } from './exhibitorConfig';
import { useExhibitorBoothContext } from './ExhibitorBoothContext';

export function BoothSwitcher() {
  const { boothId, booth, booths, setBoothId, hallId, hallLabel, halls, setHallId, loading } =
    useExhibitorBoothContext();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const company = booth?.company.companyName ?? 'Your Company';
  const logoUrl = booth?.headerLogoUrl?.trim();
  const initials = company
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="exb-booth-switcher" ref={rootRef}>
      <button
        type="button"
        className="exb-brand-card exb-brand-card-btn"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={loading}
      >
        <div className="exb-logo">
          {logoUrl ? <img src={logoUrl} alt="" className="exb-logo-img" /> : initials}
        </div>
        <div className="exb-brand-card-body">
          <h3>{company}</h3>
          <p>
            Booth · {boothDisplayCode(boothId)} · {hallLabel}
          </p>
          <span className="exb-online">{loading ? '● Loading…' : '● Online'}</span>
        </div>
        <ChevronDown size={16} className={`exb-booth-chevron ${open ? 'open' : ''}`} />
      </button>

      {open ? (
        <div className="exb-booth-panel" role="listbox" aria-label="Switch hall and booth">
          <div className="exb-booth-panel-head">
            <Building2 size={14} />
            <span>Expo hall</span>
          </div>
          <div className="exb-booth-scroll exb-hall-scroll">
            {halls.map((h) => {
              const active = h.hallId === hallId;
              const num = h.hallId.replace(/\D/g, '') || '?';
              return (
                <button
                  key={h.hallId}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`exb-booth-option ${active ? 'active' : ''}`}
                  onClick={() => {
                    void setHallId(h.hallId).then(() => setOpen(false));
                  }}
                >
                  <span className="exb-booth-option-avatar">{num}</span>
                  <span className="exb-booth-option-text">
                    <strong>{h.label}</strong>
                    <em>{h.hallId}</em>
                  </span>
                  {active ? <span className="exb-booth-option-check">✓</span> : null}
                </button>
              );
            })}
          </div>

          <div className="exb-booth-panel-head">
            <Store size={14} />
            <span>Switch booth ({booths.length})</span>
          </div>
          <div className="exb-booth-scroll">
            {booths.map((b) => {
              const active = b.id === boothId;
              const itemInitials = b.label
                .split(/\s+/)
                .map((w) => w[0])
                .join('')
                .slice(0, 2)
                .toUpperCase();
              return (
                <button
                  key={b.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`exb-booth-option ${active ? 'active' : ''}`}
                  onClick={() => {
                    setBoothId(b.id);
                    setOpen(false);
                  }}
                >
                  <span className="exb-booth-option-avatar">{itemInitials}</span>
                  <span className="exb-booth-option-text">
                    <strong>{b.label}</strong>
                    <em>Booth · {b.code}</em>
                  </span>
                  {active ? <span className="exb-booth-option-check">✓</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
