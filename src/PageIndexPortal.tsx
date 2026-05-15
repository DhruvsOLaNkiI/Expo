import { useCallback, useRef, useState } from 'react';
import { useStore } from './store';

type IndexResponse = { ok: true; outputPath: string; tree: unknown } | { ok: false; error: string };

export function PageIndexPortal() {
  const setCmsPage = useStore((s) => s.setCmsPage);
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [tree, setTree] = useState<unknown | null>(null);
  const [outputPath, setOutputPath] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [loadingIndex, setLoadingIndex] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loadingAsk, setLoadingAsk] = useState(false);

  const onPickFile = useCallback(() => {
    const f = fileRef.current?.files?.[0];
    if (!f) return;
    if (f.type !== 'application/pdf') {
      setStatus('Please choose a PDF file.');
      return;
    }
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setFile(f);
    setPdfUrl(URL.createObjectURL(f));
    setTree(null);
    setOutputPath(null);
    setAnswer('');
    setStatus(`Selected: ${f.name} (${(f.size / (1024 * 1024)).toFixed(2)} MB)`);
  }, [pdfUrl]);

  const runIndex = useCallback(async () => {
    if (!file) {
      setStatus('Select a PDF first.');
      return;
    }
    setLoadingIndex(true);
    setStatus('Indexing (text + vision on sparse pages; may take several minutes)…');
    setAnswer('');
    try {
      const fd = new FormData();
      fd.append('pdf', file, file.name);
      const res = await fetch('/api/pageindex/index', { method: 'POST', body: fd });
      const data = (await res.json()) as IndexResponse;
      if (!res.ok || !data.ok) {
        setStatus(`Error: ${!data.ok ? data.error : res.statusText}`);
        return;
      }
      setTree(data.tree);
      setOutputPath(data.outputPath);
      setStatus(`Indexed. Saved: ${data.outputPath}`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Request failed (is dev server running?)');
    } finally {
      setLoadingIndex(false);
    }
  }, [file]);

  const runAsk = useCallback(async () => {
    if (!tree) {
      setStatus('Run indexing first.');
      return;
    }
    const q = question.trim();
    if (!q) return;
    setLoadingAsk(true);
    setAnswer('');
    try {
      const res = await fetch('/api/pageindex/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, tree }),
      });
      const data = (await res.json()) as { ok: boolean; answer?: string; error?: string };
      if (!res.ok || !data.ok) {
        setAnswer(`Error: ${data.error || res.statusText}`);
        return;
      }
      setAnswer(data.answer ?? '');
    } catch (e) {
      setAnswer(e instanceof Error ? e.message : 'Ask request failed');
    } finally {
      setLoadingAsk(false);
    }
  }, [tree, question]);

  return (
    <div className="min-h-screen bg-[#0a0a10] text-[#f5f0e6] font-sans">
      <header className="border-b border-white/10 bg-black/40 px-4 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold tracking-wide text-[#d4af37]">PageIndex · PDF tools</h1>
            <p className="mt-1 text-xs text-white/50">
              Upload a PDF, build a section tree (PageIndex + Gemini). <strong className="text-white/70">Image-heavy pages</strong> are rasterized and
              transcribed with <strong className="text-white/70">Gemini vision</strong> when the PDF has little embedded text — indexing can take longer and
              uses more API calls. Then use Ask or open the PDF for full graphics.
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white/80 hover:bg-white/10"
            onClick={() => setCmsPage('expo')}
          >
            Back to expo
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#d4af37]">1. PDF</h2>
            <p className="mt-2 rounded-lg border border-amber-500/20 bg-amber-950/30 px-3 py-2 text-[11px] text-amber-100/90 leading-relaxed">
              <strong className="text-amber-200">Floor plan PDFs:</strong> many slides are pictures, not selectable text. The index may only list section titles and pages — that is why answers often say to open the full file. Re-run <strong>Run PageIndex</strong> after our latest update to pull longer text excerpts when the PDF does contain text.
            </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <input ref={fileRef} type="file" accept="application/pdf" className="text-sm" onChange={onPickFile} />
            {pdfUrl && (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-[#d4af37] underline hover:text-[#f5d060]"
              >
                Open uploaded PDF
              </a>
            )}
          </div>
          <button
            type="button"
            disabled={!file || loadingIndex}
            onClick={() => void runIndex()}
            className="mt-4 rounded-lg bg-[#d4af37] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-black disabled:opacity-40"
          >
            {loadingIndex ? 'Indexing…' : 'Run PageIndex'}
          </button>
          {status && <p className="mt-3 text-xs text-white/60 whitespace-pre-wrap">{status}</p>}
          <p className="mt-2 text-[10px] text-white/35">
            Requires <code className="rounded bg-black/40 px-1">npm run dev</code>, <code className="rounded bg-black/40 px-1">npm run pageindex:install</code>, and{' '}
            <code className="rounded bg-black/40 px-1">VITE_GEMINI_API_KEY</code> in <code className="rounded bg-black/40 px-1">.env</code>.
          </p>
        </div>

        {tree != null && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#d4af37]">2. Outline (from index)</h2>
            {outputPath && <p className="mt-2 text-xs text-white/45 font-mono">{outputPath}</p>}
            <pre className="mt-3 max-h-64 overflow-auto rounded-lg border border-white/10 bg-black/50 p-3 text-[10px] leading-relaxed text-white/70">
              {JSON.stringify(tree, null, 2).slice(0, 24_000)}
              {JSON.stringify(tree).length > 24_000 ? '\n… truncated for display' : ''}
            </pre>
          </div>
        )}

        {tree != null && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#d4af37]">3. Ask (Gemini + outline)</h2>
            <p className="mt-2 text-xs text-white/45">
              Answers use the indexed outline only—not full page text. For floor plans and drawings, use &quot;Open uploaded PDF&quot; above.
            </p>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. What sections mention parking?"
              rows={3}
              className="mt-3 w-full resize-y rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#d4af37]/50"
            />
            <button
              type="button"
              disabled={loadingAsk || !question.trim()}
              onClick={() => void runAsk()}
              className="mt-3 rounded-lg border border-[#d4af37]/40 bg-[#d4af37]/15 px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#f5e6bc] disabled:opacity-40"
            >
              {loadingAsk ? 'Asking…' : 'Get answer'}
            </button>
            {answer && (
              <div className="mt-4 rounded-lg border border-white/10 bg-black/35 p-3 text-sm leading-relaxed text-white/85 whitespace-pre-wrap">
                {answer}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
