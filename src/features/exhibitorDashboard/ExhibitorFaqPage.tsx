import { useCallback, useEffect, useState } from 'react';
import { HelpCircle } from 'lucide-react';
import type { CustomFaqQuestion } from '@/features/shared/data/boothLayouts';
import { openUrlInNewTab } from '@/utils/openUrl';
import { CustomFaqQuestionsEditor } from './CustomFaqQuestionsEditor';
import { ExhibitorChecklistBanner } from './ExhibitorChecklistBanner';
import {
  sanitizeCustomFaqQuestions,
  validateCustomFaqQuestions,
} from './customFaqQuestions';
import {
  exhibitorUploadError,
  exhibitorUploadFile,
  useExhibitorPersist,
} from './exhibitorUpload';
import type { ExhibitorNavId } from './exhibitorConfig';
import { UploadSlotCard } from './UploadSlotCard';
import { FaqResponsesDashboard } from './FaqResponsesDashboard';
import { useExhibitorBooth } from './useExhibitorBooth';

type Props = { onNav: (id: ExhibitorNavId) => void };

export function ExhibitorFaqPage({ onNav }: Props) {
  const { booth, boothId, patchBooth, loading } = useExhibitorBooth();
  const persist = useExhibitorPersist(patchBooth);
  const [faqUrl, setFaqUrl] = useState('');
  const [customQuestions, setCustomQuestions] = useState<CustomFaqQuestion[]>([]);
  const [uploading, setUploading] = useState(false);
  const [savingQuestions, setSavingQuestions] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setFaqUrl(booth?.faqUrl ?? '');
    if (!dirty) {
      setCustomQuestions(booth?.customFaqQuestions ?? []);
    }
  }, [booth?.faqUrl, booth?.customFaqQuestions, booth?.id, dirty]);

  const saveCustomQuestions = useCallback(async () => {
    const validationError = validateCustomFaqQuestions(customQuestions);
    if (validationError) {
      setErrorMsg(validationError);
      setStatusMsg(null);
      return;
    }

    setSavingQuestions(true);
    setErrorMsg(null);
    const cleaned = sanitizeCustomFaqQuestions(customQuestions);
    setCustomQuestions(cleaned);
    setDirty(false);
    const result = await persist({ customFaqQuestions: cleaned }, 'Custom FAQ questions');
    setStatusMsg(result.message);
    if (!result.ok) setErrorMsg(result.message);
    setSavingQuestions(false);
  }, [customQuestions, persist]);

  if (loading || !booth) {
    return <div className="exb-loading">Loading FAQ…</div>;
  }

  return (
    <>
      <ExhibitorChecklistBanner onGo={onNav} filterNav="faq" />
      {(statusMsg || errorMsg) && (
        <div className={`exb-toast ${errorMsg ? 'error' : 'ok'}`}>{errorMsg ?? statusMsg}</div>
      )}

      <section className="exb-card exb-faq-hero">
        <div className="exb-faq-hero-icon">
          <HelpCircle size={32} />
        </div>
        <div>
          <h3>FAQ for visitors & AI</h3>
          <p className="exb-muted">
            Upload one PDF with answers to common buyer questions. Your AI assistant and help desk use this
            document — keep it separate from brochures and price lists.
          </p>
        </div>
      </section>

      <div className="exb-slot-grid exb-slot-grid-single">
        <UploadSlotCard
          title="FAQ document"
          description="Single PDF with frequently asked questions about your project."
          accept=".pdf,application/pdf"
          hint="PDF only · max 100 MB"
          url={faqUrl}
          uploading={uploading}
          onUpload={async (file) => {
            setUploading(true);
            setErrorMsg(null);
            try {
              const url = await exhibitorUploadFile(file, boothId, 'faq');
              setFaqUrl(url);
              const r = await persist({ faqUrl: url }, 'FAQ');
              setStatusMsg(r.message);
            } catch (e) {
              setErrorMsg(exhibitorUploadError(e));
            } finally {
              setUploading(false);
            }
          }}
        />
      </div>

      {faqUrl && (
        <div className="exb-card exb-faq-actions">
          <p>FAQ is linked to your booth.</p>
          <button type="button" className="exb-btn exb-btn-primary" onClick={() => openUrlInNewTab(faqUrl)}>
            Open FAQ PDF
          </button>
        </div>
      )}

      <CustomFaqQuestionsEditor
        questions={customQuestions}
        onChange={(next) => {
          setDirty(true);
          setCustomQuestions(next);
        }}
        disabled={savingQuestions}
      />

      {(booth.customFaqQuestions?.length ?? 0) > 0 && !dirty && (
        <p className="exb-faq-linked">
          {booth.customFaqQuestions?.length} custom question(s) saved — visitors see them on the booth FAQ button.
        </p>
      )}

      <div className="exb-page-actions">
        <button
          type="button"
          className="exb-btn exb-btn-primary"
          disabled={savingQuestions || customQuestions.length === 0}
          onClick={() => void saveCustomQuestions()}
        >
          {savingQuestions ? 'Saving…' : 'Save custom questions'}
        </button>
      </div>

      <FaqResponsesDashboard boothId={boothId} />
    </>
  );
}
