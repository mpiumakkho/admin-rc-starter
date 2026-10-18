import type { HTMLAttributes } from 'react';

import { lucideMinus, lucideTrendingDown, lucideTrendingUp } from '../../../icons';
import { cx } from '../core/types';
import { NgIcon } from '../icon/icon';
import './trend.scss';

export interface UiTrendProps extends HTMLAttributes<HTMLElement> {
  value: number;
  suffix?: string;
  /** Treat a drop as good news (for errors, churn, costs) */
  inverse?: boolean;
}

/**
 * A change shown as a pill: green going up, red going down, grey when flat.
 *
 *   <UiTrend value={12.5} />           +12.5%
 *   <UiTrend value={-3} inverse />     -3%, green, because fewer is better here
 */
export function UiTrend({ value, suffix = '%', inverse = false, className, ...rest }: UiTrendProps) {
  const mood = value === 0 ? 'flat' : (value > 0) !== inverse ? 'good' : 'bad';
  const icon = value > 0 ? lucideTrendingUp : value < 0 ? lucideTrendingDown : lucideMinus;
  const rounded = Math.round(value * 10) / 10;
  return (
    <ui-trend {...rest} className={cx(`ui-trend ui-trend-${mood}`, className)}>
      <NgIcon svg={icon} />{`${value > 0 ? '+' : ''}${rounded}${suffix}`}
    </ui-trend>
  );
}
