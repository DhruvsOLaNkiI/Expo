import { Bell } from 'lucide-react';
import type { ReactNode } from 'react';
import { EXHIBITOR_NAV, boothDisplayCode, type ExhibitorNavId } from './exhibitorConfig';
import { useExhibitorBooth } from './useExhibitorBooth';

type Props = {
  activeNav: ExhibitorNavId;
  onNavChange: (id: ExhibitorNavId) => void;
  title: string;
  subtitle: string;
  headerExtra?: ReactNode;
  children: ReactNode;
};

export function ExhibitorDashboardLayout({
  activeNav,
  onNavChange,
  title,
  subtitle,
  headerExtra,
  children,
}: Props) {
  const { booth, boothId, loading } = useExhibitorBooth();
  const company = booth?.company.companyName ?? 'Your Company';
  const logoUrl = booth?.headerLogoUrl?.trim();
  const initials = company
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="exb-root">
      <aside className="exb-sidebar">
        <div className="exb-brand-card">
          <div className="exb-logo">
            {logoUrl ? <img src={logoUrl} alt="" className="exb-logo-img" /> : initials}
          </div>
          <div>
            <h3>{company}</h3>
            <p>Booth · {boothDisplayCode(boothId)}</p>
            <span className="exb-online">● Online</span>
          </div>
        </div>
        <nav className="exb-nav">
          {EXHIBITOR_NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`exb-nav-item ${activeNav === item.id ? 'active' : ''}`}
              onClick={() => onNavChange(item.id)}
            >
              <span className="dot" />
              {item.label}
              {'badge' in item && item.badge ? <span className="exb-nav-badge">{item.badge}</span> : null}
            </button>
          ))}
        </nav>
      </aside>

      <main className="exb-main">
        <header className="exb-header">
          <div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <div className="exb-header-actions">
            {headerExtra}
            <button type="button" className="exb-icon-btn" aria-label="Notifications">
              <Bell size={16} />
              <span className="exb-notif-dot">12</span>
            </button>
            <div className="exb-user-chip">
              <div className="exb-avatar">JD</div>
              <div>
                <strong>John Doe</strong>
                <span>Exhibitor</span>
              </div>
            </div>
          </div>
        </header>
        {loading ? <div className="exb-loading">Loading booth assets…</div> : children}
      </main>
    </div>
  );
}
