import type { AnchorHTMLAttributes, ButtonHTMLAttributes, Ref } from 'react';
import { Link, type LinkProps } from 'react-router';

import { cx } from '../core/types';
import './button.scss';

export type UiButtonVariant = 'primary' | 'secondary' | 'soft' | 'outline' | 'ghost' | 'danger' | 'danger-soft';
export type UiButtonSize = 'sm' | 'md' | 'lg';

export interface UiButtonStyle {
  variant?: UiButtonVariant;
  size?: UiButtonSize;
  /** Shows a spinner in place of the label and ignores clicks */
  loading?: boolean;
  /** Square button holding only an icon; give it an aria-label */
  iconOnly?: boolean;
  /** Full width of its container */
  block?: boolean;
}

/** The classes a button of this style has, for any element */
export function uiButtonClass({ variant = 'primary', size = 'md', iconOnly, block, loading }: UiButtonStyle = {}): string {
  return cx('ui-btn', `ui-btn-${variant}`, `ui-btn-${size}`, iconOnly && 'ui-btn-icon', block && 'ui-btn-block', loading && 'ui-btn-loading');
}

function split<T extends UiButtonStyle>(props: T) {
  const { variant, size, loading, iconOnly, block, ...rest } = props;
  return { style: { variant, size, loading, iconOnly, block }, rest };
}

export type UiButtonProps = UiButtonStyle & ButtonHTMLAttributes<HTMLButtonElement> & { ref?: Ref<HTMLButtonElement> };

/**
 * Button styles on a native <button>, so forms and accessibility keep working.
 *
 *   <UiButton>Save</UiButton>
 *   <UiButton variant="secondary" size="sm"><NgIcon svg={lucidePlus} /> Add</UiButton>
 *   <UiButton variant="ghost" iconOnly aria-label="More"><NgIcon svg={lucideEllipsis} /></UiButton>
 *   <UiButton loading={saving}>Save</UiButton>
 */
export function UiButton(props: UiButtonProps) {
  const { style, rest } = split(props);
  const { className, children, ...attributes } = rest;
  return (
    <button {...attributes} className={cx(uiButtonClass(style), className)} aria-busy={style.loading || undefined}>
      {style.loading && <span className="ui-btn-spinner" aria-hidden="true"></span>}
      {children}
    </button>
  );
}

export type UiLinkButtonProps = UiButtonStyle & LinkProps & { ref?: Ref<HTMLAnchorElement> };

/** The same styles on a link to a page of the app (a[uiButton][routerLink] in the Angular app) */
export function UiLinkButton(props: UiLinkButtonProps) {
  const { style, rest } = split(props);
  const { className, children, ...attributes } = rest;
  return (
    <Link {...attributes} className={cx(uiButtonClass(style), typeof className === 'string' ? className : undefined)} aria-busy={style.loading || undefined}>
      {style.loading && <span className="ui-btn-spinner" aria-hidden="true"></span>}
      {children}
    </Link>
  );
}

export type UiAnchorButtonProps = UiButtonStyle & AnchorHTMLAttributes<HTMLAnchorElement> & { ref?: Ref<HTMLAnchorElement> };

/** The same styles on a plain link, such as one to download a file */
export function UiAnchorButton(props: UiAnchorButtonProps) {
  const { style, rest } = split(props);
  const { className, children, ...attributes } = rest;
  return (
    <a {...attributes} className={cx(uiButtonClass(style), className)} aria-busy={style.loading || undefined}>
      {style.loading && <span className="ui-btn-spinner" aria-hidden="true"></span>}
      {children}
    </a>
  );
}
