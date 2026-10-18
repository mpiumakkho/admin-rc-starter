import type { HTMLAttributes, ReactNode } from 'react';

import { lucideCircleAlert, lucideCircleCheck, lucideInfo, lucideTriangleAlert } from '../../../icons';
import { cx, type UiIcon, type UiTone } from '../core/types';
import { NgIcon } from '../icon/icon';
import './alert.scss';

const ICONS: Partial<Record<UiTone, UiIcon>> = {
  success: lucideCircleCheck,
  warning: lucideTriangleAlert,
  danger: lucideCircleAlert,
};

export interface UiAlertProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  tone?: UiTone;
  title?: string;
  /** Each tone has a fitting default */
  icon?: UiIcon;
  /** Shown after the text, such as a button ([uiAlertActions] in the Angular app) */
  actions?: ReactNode;
}

/**
 * A short message in the page, tinted by tone: an error under a form, a note that a page is read-only.
 * Danger alerts are announced to screen readers as they appear.
 *
 *   <UiAlert tone="danger">Wrong email or password.</UiAlert>
 *   <UiAlert tone="info" title="Read-only">Your role can view roles but not change them.</UiAlert>
 */
export function UiAlert({ tone = 'info', title = '', icon, actions, className, children, ...rest }: UiAlertProps) {
  return (
    <ui-alert role={tone === 'danger' ? 'alert' : 'status'} {...rest} className={cx(`ui-alert ui-alert-${tone}`, className)}>
      <NgIcon className="ui-alert-icon" svg={icon ?? ICONS[tone] ?? lucideInfo} aria-hidden="true" />
      <div className="ui-alert-body">
        {title && <p className="ui-alert-title">{title}</p>}
        <div className="ui-alert-text">{children}</div>
      </div>
      {actions}
    </ui-alert>
  );
}
