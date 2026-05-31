import type { ExhibitorNavId } from './exhibitorConfig';
import {
  buildExhibitorChecklist,
  exhibitorChecklistProgress,
  type ExhibitorChecklistItem,
} from './exhibitorUpload';
import { useExhibitorBooth } from './useExhibitorBooth';

type Props = {
  onGo: (nav: ExhibitorNavId) => void;
  filterNav?: ExhibitorChecklistItem['nav'];
};

export function ExhibitorChecklistBanner({ onGo, filterNav }: Props) {
  const { booth } = useExhibitorBooth();
  if (!booth) return null;

  const all = buildExhibitorChecklist(booth);
  const items = filterNav ? all.filter((i) => i.nav === filterNav) : all;
  const progress = exhibitorChecklistProgress(items);
  const pending = items.filter((i) => !i.done);

  if (pending.length === 0) {
    return (
      <div className="exb-checklist exb-checklist-done">
        <strong>All required items complete</strong>
        <span>Your booth is ready for visitors.</span>
      </div>
    );
  }

  return (
    <div className="exb-checklist">
      <div className="exb-checklist-head">
        <div>
          <strong>Setup progress</strong>
          <span>
            {progress.done} of {progress.total} complete ({progress.pct}%)
          </span>
        </div>
        <div className="exb-checklist-bar">
          <i style={{ width: `${progress.pct}%` }} />
        </div>
      </div>
      <ul className="exb-checklist-items">
        {pending.map((item) => (
          <li key={item.id}>
            <button type="button" className="exb-checklist-link" onClick={() => onGo(item.nav)}>
              {item.label}
              <span>Upload →</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
