import { lucideX } from '../../icons';
import { cx, NgIcon } from '../../user-management/ui';
import { clinicUi } from '../clinic-ui';
import type { Badge } from '../data/types';
import { useClinicI18n } from '../i18n/clinic-i18n';

export interface SheetHeadProps {
  heading: string;
  status?: Badge | null;
  sub?: string;
  tabs?: { id: string; label: string }[];
  activeTab?: string;
}

/** A sheet's head: its title and status, what it is about, and its sections when it has some */
export function SheetHead({ heading, status = null, sub = '', tabs = [], activeTab = '' }: SheetHeadProps) {
  const { tx } = useClinicI18n();
  const pick = (tab: string) => {
    const open = clinicUi.sheet;
    if (open) {
      clinicUi.openSheet(open.kind, { id: open.id, tab });
    }
  };
  return (
    <cl-sheet-head className="contents">
      <div className="sheet-head">
        <h2 id="clinic-sheet-title">{tx(heading)}</h2>
        {status && <span className={`status ${status.cls}`}>{tx(status.text)}</span>}
        <span className="spacer"></span>
        <button type="button" className="sheet-icon" aria-label={tx('ปิด')} onClick={() => clinicUi.closeSheet()}><NgIcon svg={lucideX} aria-hidden="true" /></button>
      </div>
      {sub && <div className="sheet-sub">{tx(sub)}</div>}
      {tabs.length > 0 && (
        <div className="sheet-tabs" role="group" aria-label={tx('ส่วนของข้อมูล')}>
          {tabs.map(tab => (
            <button key={tab.id} type="button" className={cx(tab.id === activeTab && 'active')} aria-pressed={tab.id === activeTab} onClick={() => pick(tab.id)}>
              {` ${tx(tab.label)} `}
            </button>
          ))}
        </div>
      )}
    </cl-sheet-head>
  );
}
