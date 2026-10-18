import type { HTMLAttributes } from 'react';

import { cx, type UiTone } from '../core/types';
import './badge.scss';

export interface UiBadgeProps extends HTMLAttributes<HTMLElement> {
  tone?: UiTone;
  /** A colored dot before the label */
  dot?: boolean;
}

/**
 * A small tinted label, for statuses and categories.
 *
 *   <UiBadge tone="success" dot>Active</UiBadge>
 */
export function UiBadge({ tone = 'neutral', dot, className, children, ...rest }: UiBadgeProps) {
  return (
    <ui-badge {...rest} className={cx(`ui-badge ui-badge-${tone}`, className)}>
      {dot && <span className="ui-badge-dot" aria-hidden="true"></span>}
      {children}
    </ui-badge>
  );
}
