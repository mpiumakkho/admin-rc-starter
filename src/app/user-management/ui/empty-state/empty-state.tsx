import type { HTMLAttributes } from 'react';

import { lucideInbox } from '../../../icons';
import { cx, type UiIcon } from '../core/types';
import { NgIcon } from '../icon/icon';
import './empty-state.scss';

export interface UiEmptyStateProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title: string;
  description?: string;
  icon?: UiIcon;
  compact?: boolean;
}

/**
 * What to show when a list is empty or a search finds nothing. Buttons go inside.
 *
 *   <UiEmptyState title="No users found" description="Try another search.">
 *     <UiButton variant="secondary">Clear filters</UiButton>
 *   </UiEmptyState>
 */
export function UiEmptyState({ title, description = '', icon = lucideInbox, compact, className, children, ...rest }: UiEmptyStateProps) {
  return (
    <ui-empty-state {...rest} className={cx('ui-empty-state', compact && 'ui-empty-compact', className)}>
      <span className="ui-empty-icon"><NgIcon svg={icon} /></span>
      <p className="ui-empty-title">{title}</p>
      {description && <p className="ui-empty-description">{description}</p>}
      <div className="ui-empty-actions">{children}</div>
    </ui-empty-state>
  );
}
