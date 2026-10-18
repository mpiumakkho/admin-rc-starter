import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

import { cx } from '../../user-management/ui';
import { clinicUi, useClinicUi, type SheetKind, type SheetState } from '../clinic-ui';
import { EstimateSheet, NotesSheet, OwnerSheet, PatientSheet, ResultsPreviewSheet, VisitSheet } from './patient-sheets';
import { AppointmentSheet, NewOrderSheet, OrderSheet, PrescriptionSheet, ResultSheet } from './record-sheets';

/** Widths of the sheets, as in the design: sm 396, md 460, lg 600 pixels */
const SHEET_WIDTH: Record<SheetKind, number> = {
  visit: 396, notes: 396, results: 396, result: 396, order: 396, appointment: 396,
  owner: 460, patient: 460, newOrder: 460,
  prescription: 600, estimate: 600,
};

/** The sheet of one kind, as the Angular app's @switch picks it */
function SheetOf({ sheet }: { sheet: SheetState }) {
  switch (sheet.kind) {
    case 'visit': return <VisitSheet />;
    case 'patient': return <PatientSheet tab={sheet.tab || 'overview'} />;
    case 'owner': return <OwnerSheet tab={sheet.tab || 'contact'} />;
    case 'notes': return <NotesSheet />;
    case 'results': return <ResultsPreviewSheet />;
    case 'estimate': return <EstimateSheet />;
    case 'result': return <ResultSheet id={sheet.id ?? ''} />;
    case 'order': return <OrderSheet id={sheet.id ?? ''} />;
    case 'appointment': return <AppointmentSheet id={sheet.id ?? ''} />;
    case 'prescription': return <PrescriptionSheet id={sheet.id ?? ''} />;
    case 'newOrder': return <NewOrderSheet />;
  }
}

/**
 * The side sheet (L3) and the scrim behind it: one at a time, over the tab and beside the context rail. A new sheet is
 * drawn out of sight first and slides out a frame later, so drawing it never eats into the slide; it keeps the last
 * sheet while it slides away. Focus moves in when it opens, Escape closes it, and focus goes back to where it was.
 */
export function SheetHost() {
  const sheet = useClinicUi(state => state.sheet);
  const panel = useRef<HTMLElement>(null);

  /** The open sheet, or the last one while it slides away */
  const [shown, setShown] = useState<SheetState | null>(sheet);
  if (sheet && sheet !== shown) {
    setShown(sheet);
  }
  const width = SHEET_WIDTH[shown?.kind ?? 'visit'];

  /** Out on the screen: a frame after the open sheet is drawn; back in at once when it closes */
  const [out, setOut] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  const frame = useRef(0);
  const wasOpen = useRef(false);

  const open = !!sheet;
  useLayoutEffect(() => {
    if (open && !wasOpen.current) {
      opener.current = document.activeElement as HTMLElement | null;
      frame.current = requestAnimationFrame(() => {
        if (useClinicUi.getState().sheet) {
          setOut(true);
          // Without preventScroll the browser scrolls the workspace sideways to show the sheet still sliding in
          panel.current?.focus({ preventScroll: true });
        }
      });
    } else if (!open && wasOpen.current) {
      cancelAnimationFrame(frame.current);
      setOut(false);
      // Back to where it was opened from, when focus was inside the sheet
      if (panel.current?.contains(document.activeElement) && opener.current?.isConnected) {
        opener.current.focus();
      }
      opener.current = null;
    }
    wasOpen.current = open;
  }, [open]);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  // Escape closes the sheet wherever focus is, unless a dialog is open, which Escape closes first
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && clinicUi.sheet && !document.querySelector('dialog[open]')) {
        clinicUi.closeSheet();
      }
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, []);

  return (
    <cl-sheet-host className="contents">
      <div className={cx('scrim', out && 'show')} onClick={() => clinicUi.closeSheet()} aria-hidden="true"></div>
      <aside ref={panel} className={cx('sheet', open && 'drawn', out && 'open')} inert={!open} tabIndex={-1}
        style={{ '--sheet-w': `${width}px` } as CSSProperties} aria-labelledby={open ? 'clinic-sheet-title' : undefined}>
        {shown && <SheetOf key={shown.kind} sheet={shown} />}
      </aside>
    </cl-sheet-host>
  );
}
