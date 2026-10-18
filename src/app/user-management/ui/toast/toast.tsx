import type { HTMLAttributes } from 'react';
import { create } from 'zustand';

import { lucideCircleAlert, lucideCircleCheck, lucideInfo, lucideX } from '../../../icons';
import { cx, type UiIcon } from '../core/types';
import { leaveRef, useLeavingList } from '../core/presence';
import { NgIcon } from '../icon/icon';
import { useUiAccessibleView } from '../theme/accessible-view.service';
import './toast.scss';

export type UiToastTone = 'success' | 'error' | 'info';

export interface UiToast {
  id: number;
  message: string;
  tone: UiToastTone;
}

interface UiToastState {
  toasts: UiToast[];
  /** Returns the toast's id, for dismissing it early */
  show(message: string, tone?: UiToastTone, duration?: number): number;
  dismiss(id: number): void;
}

let nextId = 0;

/**
 * Short confirmations that pop up at the bottom of the screen and fade after a few seconds.
 * Place one <UiToaster /> in the app shell, then call `show` from anywhere.
 *
 * In the accessible view they stay until dismissed (WCAG 2.2.3), so the shell shows them in the page, above its
 * content, where they cover nothing (<UiToaster inline />, WCAG 2.4.12).
 *
 *   uiToast.show('User saved');
 *   uiToast.show('Could not delete the role', 'error');
 */
export const useUiToast = create<UiToastState>((set, get) => ({
  toasts: [],
  show(message, tone = 'success', duration = 3000) {
    const toast = { id: nextId++, message, tone };
    // Keep the three newest so a burst of actions does not cover the page
    set(state => ({ toasts: [...state.toasts, toast].slice(-3) }));
    if (!useUiAccessibleView.getState().on) {
      setTimeout(() => get().dismiss(toast.id), duration);
    }
    return toast.id;
  },
  dismiss(id) {
    set(state => ({ toasts: state.toasts.filter(toast => toast.id !== id) }));
  },
}));

/** The toasts, from anywhere: uiToast.show('Saved') */
export const uiToast = {
  show: (message: string, tone?: UiToastTone, duration?: number) => useUiToast.getState().show(message, tone, duration),
  dismiss: (id: number) => useUiToast.getState().dismiss(id),
};

const ICONS: Record<UiToastTone, UiIcon> = {
  success: lucideCircleCheck,
  error: lucideCircleAlert,
  info: lucideInfo,
};

export interface UiToasterProps extends HTMLAttributes<HTMLElement> {
  /** In the flow of the page rather than floating over its bottom */
  inline?: boolean;
  dismissLabel?: string;
}

export function UiToaster({ inline, dismissLabel = 'Dismiss', className, ...rest }: UiToasterProps) {
  const toasts = useUiToast(state => state.toasts);
  const shown = useLeavingList(toasts, toast => toast.id);
  return (
    <ui-toaster aria-live="polite" {...rest} className={cx('ui-toaster', inline && 'ui-toaster-inline', className)}>
      {shown.map(({ item, leaving, done }) => (
        <div key={item.id} className={cx(`ui-toast ui-toast-${item.tone}`, leaving && 'ui-toast-leave')} role="status"
          ref={leaving ? leaveRef(done) : undefined} onAnimationEnd={leaving ? done : undefined}>
          <NgIcon svg={ICONS[item.tone]} className="ui-toast-icon" />
          <span className="ui-toast-message">{item.message}</span>
          <button type="button" className="ui-toast-close" aria-label={dismissLabel} onClick={() => uiToast.dismiss(item.id)}>
            <NgIcon svg={lucideX} />
          </button>
        </div>
      ))}
    </ui-toaster>
  );
}
