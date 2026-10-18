import { useState, type HTMLAttributes } from 'react';

import { cx } from '../core/types';
import { useUiAccessibleView } from '../theme/accessible-view.service';
import './avatar.scss';

export type UiAvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZES: Record<UiAvatarSize, number> = { xs: 24, sm: 32, md: 40, lg: 56, xl: 80 };

// Background colors for initials, picked from the name so a person keeps the same color; each keeps white text at 4.5:1
const COLORS = ['#4f46e5', '#0369a1', '#047857', '#b45309', '#be185d', '#6d28d9', '#0f766e', '#c2410c'];
// The same hues, deep enough for 7:1 in the accessible view
const AAA_COLORS = ['#3730a3', '#0c4a6e', '#064e3b', '#78350f', '#831843', '#4c1d95', '#134e4a', '#7c2d12'];

export interface UiAvatarProps extends HTMLAttributes<HTMLElement> {
  name?: string;
  src?: string | null;
  size?: UiAvatarSize;
}

/**
 * A round photo, or the person's initials on a color when there is no photo (or it fails to load).
 *
 *   <UiAvatar name="Henry Klein" src="faces/henry.jpg" size="md" />
 */
export function UiAvatar({ name = '', src = '', size = 'md', className, style, ...rest }: UiAvatarProps) {
  // A failure is of one source: a new photo gets a fresh try
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const accessible = useUiAccessibleView(state => state.on);
  const failed = !!src && failedSrc === src;
  const pixels = SIZES[size];

  const words = name.trim().split(/\s+/).filter(Boolean);
  const initials = (words.length > 1 ? words[0][0] + words[words.length - 1][0] : (words[0] ?? '?').slice(0, 2)).toUpperCase();

  let hash = 0;
  for (const char of name) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  const colors = accessible ? AAA_COLORS : COLORS;
  const color = colors[hash % colors.length];

  return (
    <ui-avatar {...rest} className={cx('ui-avatar', className)} role="img" aria-label={name}
      style={{ width: `${pixels}px`, height: `${pixels}px`, fontSize: `${pixels * 0.38}px`, background: src && !failed ? 'var(--ui-hover)' : color, ...style }}>
      {src && !failed ? <img src={src} alt={name} onError={() => setFailedSrc(src)} /> : <span aria-hidden="true" data-initials={initials}></span>}
    </ui-avatar>
  );
}
