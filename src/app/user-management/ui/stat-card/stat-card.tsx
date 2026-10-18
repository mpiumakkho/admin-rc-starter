import type { HTMLAttributes } from 'react';

import { cx, type UiIcon, type UiTone } from '../core/types';
import { UiIconChip } from '../icon-chip/icon-chip';
import { UiTrend } from '../trend/trend';
import './stat-card.scss';

export interface UiStatCardProps extends HTMLAttributes<HTMLElement> {
  label: string;
  value: string | number;
  icon?: UiIcon;
  tone?: UiTone;
  /** Change shown in a pill; leave unset to hide it */
  trend?: number | null;
  /** After the trend number: '%' for a percentage, '' for a count */
  trendSuffix?: string;
  /** A drop is good news for this number */
  inverse?: boolean;
  /** Short note after the trend, such as "vs last month" */
  hint?: string;
}

/**
 * A key number with its label, an icon and how it changed. Content placed inside goes under the number,
 * for example a `UiSplitBar` showing what the total is made of. Wrap the card in an <a> to make the
 * whole card a link, such as to the list behind the number.
 *
 *   <UiStatCard label="Active users" value={1284} icon={lucideUserCheck} tone="success" trend={4.2} hint="vs last month" />
 *   <UiStatCard label="New sign-ups" value={10} trend={7} trendSuffix="" hint="vs the 30 days before" />
 */
export function UiStatCard({
  label, value, icon, tone = 'primary', trend = null, trendSuffix = '%', inverse = false, hint = '', className, children, ...rest
}: UiStatCardProps) {
  return (
    <ui-stat-card {...rest} className={cx('ui-stat-card', className)}>
      <span className="ui-stat-label">{label}</span>
      {icon && <UiIconChip className="ui-stat-icon" icon={icon} tone={tone} />}
      <p className="ui-stat-value">{value}</p>
      {(trend !== null || hint) && (
        <div className="ui-stat-meta">
          {trend ? <UiTrend value={trend} suffix={trendSuffix} inverse={inverse} /> : trend === 0 && <UiTrend value={0} suffix={trendSuffix} />}
          {hint && <span>{hint}</span>}
        </div>
      )}
      <div className="ui-stat-extra">{children}</div>
    </ui-stat-card>
  );
}
