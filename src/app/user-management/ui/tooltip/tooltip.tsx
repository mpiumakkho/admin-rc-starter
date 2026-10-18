import { useEffect, useRef, useState, type FocusEvent, type HTMLAttributes } from 'react';

import { cx } from '../core/types';
import './tooltip.scss';

/** How long the pointer rests on the control before its tooltip shows */
const HOVER_DELAY = 300;

export interface UiTooltipProps extends HTMLAttributes<HTMLElement> {
  /** The main line */
  text: string;
  /** A second, quieter line, such as what a press does next */
  detail?: string;
  /** Which edge of the control it lines up with */
  align?: 'start' | 'end';
}

/**
 * A short text under a control: on hover, on keyboard focus, and at once after a click, so a control that changes
 * something (such as the display size) shows what it changed to. It follows its props while it is open.
 *
 *   <UiTooltip text="Display size 110%" detail="Press to switch to 125%" align="end">
 *     <button type="button" aria-label="Display size 110% · Press to switch to 125%">…</button>
 *   </UiTooltip>
 *
 * Screen readers do not read it: give the control the same words as its name (aria-label). As WCAG 1.4.13 asks, the
 * pointer can move onto it without it going, Escape hides it without moving focus or the pointer, and it stays until
 * the pointer and focus leave. `align="end"` lines it up with the control's right edge, for controls at the right of
 * the page.
 */
export function UiTooltip({ text, detail = '', align = 'start', className, children, ...rest }: UiTooltipProps) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  /** Escape hid it; it shows again once the pointer and focus have left and come back */
  const [dismissed, setDismissed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => event.key === 'Escape' && setDismissed(true);
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, []);

  const pointerIn = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setHovered(true), HOVER_DELAY);
  };
  const pointerOut = () => {
    clearTimeout(timer.current);
    setHovered(false);
    setDismissed(dismissed => focused && dismissed);
  };
  /** At once after a click, without waiting for the hover delay */
  const clicked = () => {
    clearTimeout(timer.current);
    setHovered(true);
    setDismissed(false);
  };
  /** Focus from the keyboard shows it; focus from a click is the click's */
  const focusIn = (event: FocusEvent) => {
    if ((event.target as Element).matches(':focus-visible')) {
      setFocused(true);
    }
  };
  const focusOut = (event: FocusEvent) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setFocused(false);
      setDismissed(dismissed => hovered && dismissed);
    }
  };

  return (
    <ui-tooltip {...rest} className={cx('ui-tooltip', className)}
      onMouseEnter={pointerIn} onMouseLeave={pointerOut} onClick={clicked} onFocus={focusIn} onBlur={focusOut}>
      {children}
      {(hovered || focused) && !dismissed && (
        <span className={cx('ui-tooltip-panel', align === 'end' && 'ui-tooltip-end', 'ui-tooltip-in')} aria-hidden="true">
          <span className="ui-tooltip-text">{text}</span>
          {detail && <span className="ui-tooltip-detail">{detail}</span>}
        </span>
      )}
    </ui-tooltip>
  );
}
