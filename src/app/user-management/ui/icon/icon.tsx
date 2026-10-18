import type { CSSProperties, HTMLAttributes } from 'react';

import type { UiIcon } from '../core/types';
import './icon.scss';

/** Lucide icons are drawn a little finer than their default 2px stroke, as the Angular app's provideNgIconsConfig sets */
const STROKE_WIDTH = 1.75;

export interface NgIconProps extends HTMLAttributes<HTMLElement> {
  /** The icon, such as lucidePlus from app/icons */
  svg: UiIcon;
  /** Width and height, such as '1.25rem'; 1em (the font size) by default */
  size?: string;
}

/**
 * An icon, as @ng-icons/core draws it in the Angular app: an <ng-icon> one em square holding the SVG, its stroke width
 * from --ng-icon__stroke-width. Hidden from screen readers unless given aria-hidden="false".
 *
 *   <NgIcon svg={lucidePlus} />
 */
export function NgIcon({ svg: Svg, size, className, style, ...rest }: NgIconProps) {
  const variables = { '--ng-icon__stroke-width': STROKE_WIDTH, ...(size ? { '--ng-icon__size': size } : {}) } as CSSProperties;
  return (
    <ng-icon role="img" aria-hidden="true" {...rest} className={className} style={{ ...variables, ...style }}>
      <Svg style={{ strokeWidth: 'var(--ng-icon__stroke-width, 2)' }} aria-hidden="true" />
    </ng-icon>
  );
}
