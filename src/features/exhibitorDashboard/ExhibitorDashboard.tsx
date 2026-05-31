import { useEffect, useState, type ReactNode } from 'react';
import { Calendar, Download } from 'lucide-react';
import { ExhibitorDashboardLayout } from './ExhibitorDashboardLayout';
import { OverviewDashboard } from './OverviewDashboard';
import { ExhibitorSetupPage } from './ExhibitorSetupPage';
import { ExhibitorDocumentsPage } from './ExhibitorDocumentsPage';
import { DocumentsBrochuresPage } from './DocumentsBrochuresPage';
import { ExhibitorFaqPage } from './ExhibitorFaqPage';
import { ExhibitorSalesChatPage } from './ExhibitorSalesChatPage';
import { VisitorInsightsPage } from './VisitorInsightsPage';
import { VisitorProfilePage } from './VisitorProfilePage';
import type { VisitorProfileTarget } from './visitorInsightsData';
import type { ExhibitorNavId } from './exhibitorConfig';
import './exhibitorDashboard.css';

const PAGE_COPY: Record<
  ExhibitorNavId,
  { title: string; subtitle: string; ready: boolean }
> = {
  overview: {
    title: 'My Booth Dashboard',
    subtitle: 'Real-time performance and engagement insights for your booth',
    ready: true,
  },
  setup: {
    title: 'Booth Setup',
    subtitle: 'Logo, unit layouts, site plan, and exhibitor profile',
    ready: true,
  },
  documents: {
    title: 'Documents & Brochures',
    subtitle: 'Upload and manage all documents, brochures and media for your booth',
    ready: true,
  },
  uploads: {
    title: 'Upload Documents',
    subtitle: 'Add brochure, price list, and walkthrough — one slot per file type',
    ready: true,
  },
  faq: {
    title: 'FAQ',
    subtitle: 'Upload your FAQ PDF for visitors and the AI assistant',
    ready: true,
  },
  salesChat: {
    title: 'Sales Chat',
    subtitle: 'Assign your sales person by name and preview visitor chat',
    ready: true,
  },
  live: { title: 'Live Visitors', subtitle: 'Coming soon', ready: false },
  engagement: { title: 'Engagement', subtitle: 'Coming soon', ready: false },
  leads: { title: 'Leads & Enquiries', subtitle: 'Coming soon', ready: false },
  ratings: { title: 'Ratings & Feedback', subtitle: 'Coming soon', ready: false },
  insights: {
    title: 'Visitor Intelligence CRM',
    subtitle: 'Lead scores, booth activity, and follow-up pipeline for your expo visitors',
    ready: true,
  },
  assistance: { title: 'Assistance History', subtitle: 'Coming soon', ready: false },
  reports: { title: 'Reports', subtitle: 'Coming soon', ready: false },
};

const READY_NAV: ExhibitorNavId[] = [
  'overview',
  'setup',
  'documents',
  'uploads',
  'faq',
  'salesChat',
  'insights',
];

export function ExhibitorDashboard() {
  const [activeNav, setActiveNav] = useState<ExhibitorNavId>('overview');
  const [docsHeader, setDocsHeader] = useState<ReactNode>(null);
  const [profileVisitor, setProfileVisitor] = useState<VisitorProfileTarget | null>(null);
  const copy = PAGE_COPY[activeNav];

  useEffect(() => {
    if (activeNav !== 'documents') setDocsHeader(null);
  }, [activeNav]);

  useEffect(() => {
    if (activeNav !== 'insights') setProfileVisitor(null);
  }, [activeNav]);

  const headerExtra =
    activeNav === 'documents' ? (
      docsHeader
    ) : activeNav === 'overview' ? (
      <>
        <button type="button" className="exb-btn">
          <Calendar size={15} />
          May 16 - May 22, 2025
        </button>
        <button type="button" className="exb-btn exb-btn-primary">
          <Download size={15} />
          Export Report
        </button>
      </>
    ) : null;

  return (
    <ExhibitorDashboardLayout
      activeNav={activeNav}
      onNavChange={setActiveNav}
      title={
        profileVisitor && activeNav === 'insights'
          ? `${profileVisitor.name} — Visitor Profile`
          : copy.title
      }
      subtitle={
        profileVisitor && activeNav === 'insights'
          ? 'Booth-only activity, brochure opens, and engagement timeline'
          : copy.subtitle
      }
      headerExtra={headerExtra}
    >
      {activeNav === 'overview' && (
        <OverviewDashboard
          onOpenDocuments={() => setActiveNav('documents')}
          onNav={setActiveNav}
        />
      )}
      {activeNav === 'setup' && <ExhibitorSetupPage onNav={setActiveNav} />}
      {activeNav === 'documents' && (
        <DocumentsBrochuresPage onRegisterHeader={setDocsHeader} onNav={setActiveNav} />
      )}
      {activeNav === 'uploads' && <ExhibitorDocumentsPage onNav={setActiveNav} />}
      {activeNav === 'faq' && <ExhibitorFaqPage onNav={setActiveNav} />}
      {activeNav === 'salesChat' && <ExhibitorSalesChatPage onNav={setActiveNav} />}
      {activeNav === 'insights' &&
        (profileVisitor ? (
          <VisitorProfilePage visitor={profileVisitor} onBack={() => setProfileVisitor(null)} />
        ) : (
          <VisitorInsightsPage onNav={setActiveNav} onOpenProfile={setProfileVisitor} />
        ))}
      {!copy.ready && !READY_NAV.includes(activeNav) && (
        <div className="exb-card exb-coming-soon">
          <h3>{copy.title}</h3>
          <p>This section is coming soon.</p>
        </div>
      )}
    </ExhibitorDashboardLayout>
  );
}
