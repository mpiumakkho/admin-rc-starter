import type { LucideIcon } from '../../../icons';

/** Color role shared by badges, chips, stat cards and other tinted components */
export type UiTone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

/** An icon, such as lucidePlus from app/icons */
export type UiIcon = LucideIcon;

/** One choice in a segmented control, filter chip row or similar picker */
export interface UiOption<T = string> {
  value: T;
  label: string;
  /** Number shown beside the label, such as how many rows match */
  count?: number;
  /** An icon, such as lucideUsers from app/icons */
  icon?: UiIcon;
  /** Read out instead of a short label, such as "English" for "EN"; also shown as a tooltip */
  ariaLabel?: string;
  /** Language of the label, such as "th", so screen readers pronounce it right */
  lang?: string;
  /** Shown but cannot be picked, where the component supports it (ui-segmented) */
  disabled?: boolean;
}

/** Class names joined, leaving out the empty ones: cx('ui-btn', loading && 'ui-btn-loading') */
export function cx(...names: (string | false | null | undefined | 0)[]): string {
  return names.filter(Boolean).join(' ');
}
