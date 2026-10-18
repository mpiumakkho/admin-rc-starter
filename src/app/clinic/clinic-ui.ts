import { create } from 'zustand';

import { uiToast } from '../user-management/ui';
import { clinicI18n } from './i18n/clinic-i18n';

/**
 * Side sheets: one at a time, beside the context rail. The patient's sheets show the selected patient; the others
 * show one record, by its id.
 */
export type SheetKind =
  | 'visit' | 'patient' | 'owner' | 'notes' | 'results' | 'estimate'
  | 'result' | 'order' | 'appointment' | 'prescription' | 'newOrder';

export interface SheetState { kind: SheetKind; id?: string; tab?: string }

/** A field of a confirmation dialog */
export interface DialogField {
  name: string;
  label: string;
  type: 'input' | 'textarea' | 'select' | 'checkbox';
  options?: { value: string; label: string }[];
  value?: string;
  placeholder?: string;
  optional?: boolean;
  /** An error message, or null when the value will do; it can look at the other fields */
  validate?: (value: string, all: Record<string, string>) => string | null;
}

/** A dialog that asks for a decision, with fields when it needs them; values of checkboxes are 'yes' or '' */
export interface DialogRequest {
  title: string;
  tone?: 'primary' | 'danger';
  /** Short paragraphs above the fields */
  intro?: string[];
  /** Label / value rows above the fields */
  facts?: [string, string][];
  /** A warning box above the fields */
  warning?: string;
  fields?: DialogField[];
  /** A note under the fields */
  after?: string;
  confirmLabel: string;
  onConfirm: (values: Record<string, string>) => void;
}

interface ClinicUiState {
  sheet: SheetState | null;
  dialog: DialogRequest | null;
}

/** The open sheet and dialog, for components to follow: useClinicUi(state => state.sheet) */
export const useClinicUi = create<ClinicUiState>(() => ({ sheet: null, dialog: null }));

/** What opens and closes the workspace's sheets and dialogs, and says what happened */
export const clinicUi = {
  get sheet(): SheetState | null {
    return useClinicUi.getState().sheet;
  },

  openSheet(kind: SheetKind, options: { id?: string; tab?: string } = {}) {
    useClinicUi.setState({ sheet: { kind, ...options } });
  },

  /** The same sheet again closes it, as the context rail's buttons do */
  toggleSheet(kind: SheetKind, tab?: string) {
    const open = useClinicUi.getState().sheet;
    if (open && open.kind === kind && (!tab || open.tab === tab)) {
      clinicUi.closeSheet();
    } else {
      clinicUi.openSheet(kind, { tab });
    }
  },

  closeSheet() {
    useClinicUi.setState({ sheet: null });
  },

  ask(request: DialogRequest) {
    useClinicUi.setState({ dialog: request });
  },

  closeDialog() {
    useClinicUi.setState({ dialog: null });
  },

  /** A message in the workspace's language */
  toast(key: string, vars?: Record<string, string | number>, tone: 'success' | 'error' | 'info' = 'success') {
    uiToast.show(clinicI18n.t(key, vars), tone);
  },
};
