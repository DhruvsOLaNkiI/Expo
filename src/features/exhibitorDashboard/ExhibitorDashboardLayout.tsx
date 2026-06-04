import { Bell } from 'lucide-react';
import type { ReactNode } from 'react';
import { EXHIBITOR_NAV, type ExhibitorNavId } from './exhibitorConfig';
import { BoothSwitcher } from './BoothSwitcher';
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
  const { loading } = useExhibitorBooth();

  return (
    <div className="exb-root">
      <aside className="exb-sidebar">
        <BoothSwitcher />
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
