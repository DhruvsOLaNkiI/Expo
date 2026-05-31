import { useRef, useState } from 'react';
import { CheckCircle2, FileText, Upload } from 'lucide-react';
import { openUrlInNewTab } from '@/utils/openUrl';

type Props = {
  title: string;
  description: string;
  accept: string;
  hint?: string;
  url: string;
  uploading?: boolean;
  onUpload: (file: File) => Promise<void>;
  onClear?: () => void;
};

export function UploadSlotCard({
  title,
  description,
  accept,
  hint,
  url,
  uploading,
  onUpload,
  onClear,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const done = Boolean(url.trim());

  const pick = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    await onUpload(file);
  };

  return (
    <article className={`exb-slot-card ${done ? 'done' : ''} ${drag ? 'drag' : ''}`}>
      <div className="exb-slot-head">
        <div className="exb-slot-icon">{done ? <CheckCircle2 size={20} /> : <FileText size={20} />}</div>
        <div>
          <h4>{title}</h4>
          <p>{description}</p>
        </div>
      </div>

      {done && (
        <div className="exb-slot-preview">
          {/\.(mp4|webm)(\?|#|$)/i.test(url) ? (
            <video src={url} controls className="exb-slot-media" />
          ) : /\.pdf/i.test(url) ? (
            <div className="exb-slot-pdf">PDF uploaded</div>
          ) : (
            <img src={url} alt="" className="exb-slot-media" />
          )}
          <div className="exb-slot-actions">
            <button type="button" className="exb-btn exb-btn-sm" onClick={() => openUrlInNewTab(url)}>
              View
            </button>
            {onClear && (
              <button type="button" className="exb-btn exb-btn-sm" onClick={onClear}>
                Replace
              </button>
            )}
          </div>
        </div>
      )}

      <div
        className="exb-slot-drop"
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          void pick(e.dataTransfer.files);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          className="exb-hidden-input"
          accept={accept}
          onChange={(e) => {
            void pick(e.target.files);
            e.target.value = '';
          }}
        />
        <Upload size={22} className="exb-slot-drop-icon" />
        <p>{done ? 'Drop a new file to replace' : 'Drag & drop or choose file'}</p>
        {hint && <span className="exb-muted">{hint}</span>}
        <button
          type="button"
          className="exb-btn exb-btn-primary exb-btn-sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? 'Uploading…' : done ? 'Replace file' : 'Choose file'}
        </button>
      </div>
    </article>
  );
}
