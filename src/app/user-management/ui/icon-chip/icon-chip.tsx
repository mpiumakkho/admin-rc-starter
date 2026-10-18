import type { HTMLAttributes } from 'react';

import { cx, type UiIcon, type UiTone } from '../core/types';
import { NgIcon } from '../icon/icon';
import './icon-chip.scss';

export interface UiIconChipProps extends HTMLAttributes<HTMLElement> {
  icon: UiIcon;
  tone?: UiTone;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * An icon on a soft tinted square, for stat cards, lists and empty states.
 *
 *   <UiIconChip icon={lucideUsers} tone="primary" />
 */
export function UiIconChip({ icon, tone = 'primary', size = 'md', className, ...rest }: UiIconChipProps) {
  return (
    <ui-icon-chip aria-hidden="true" {...rest} className={cx(`ui-icon-chip ui-icon-chip-${tone} ui-icon-chip-${size}`, className)}>
      <NgIcon svg={icon} />
    </ui-icon-chip>
  );
}
