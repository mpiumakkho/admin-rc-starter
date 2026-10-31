import { create } from 'zustand';

import { uiToast } from '../user-management/ui';
import { boI18n } from './i18n/bo-i18n';

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
  intro?: string[];
  facts?: [string, string][];
  warning?: string;
  fields?: DialogField[];
  after?: string;
  confirmLabel: string;
  onConfirm: (values: Record<string, string>) => void;
}

/** The open dialog, for components to follow: useBackofficeUi(state => state.dialog) */
export const useBackofficeUi = create<{ dialog: DialogRequest | null }>(() => ({ dialog: null }));

/** The back office's dialog and messages, as the clinic's (clinic/clinic-ui.ts) */
export const backofficeUi = {
  ask(request: DialogRequest) {
    useBackofficeUi.setState({ dialog: request });
  },

  closeDialog() {
    useBackofficeUi.setState({ dialog: null });
  },

  /** A message in the workspace's language */
  toast(key: string, vars?: Record<string, string | number>, tone: 'success' | 'error' | 'info' = 'success') {
    uiToast.show(boI18n.t(key, vars), tone);
  },
};
