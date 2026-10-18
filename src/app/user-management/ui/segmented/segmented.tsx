import { useLayoutEffect, useRef, useState, type HTMLAttributes } from 'react';

import { cx, type UiOption } from '../core/types';
import { NgIcon } from '../icon/icon';
import './segmented.scss';

export interface UiSegmentedProps<T> extends Omit<HTMLAttributes<HTMLElement>, 'onChange'> {
  options?: UiOption<T>[];
  value?: T | null;
  onValueChange?: (value: T) => void;
  variant?: 'pill' | 'underline';
  size?: 'sm' | 'md';
  ariaLabel?: string;
  disabled?: boolean;
  /** The group lost focus after a choice, for forms that mark a field touched */
  onTouched?: () => void;
}

/**
 * Pick one of a few options. `pill` looks like a toggle group, `underline` like tabs.
 *
 *   <UiSegmented options={ranges} value={range} onValueChange={setRange} />
 *   <UiSegmented options={tabs} value={tab} onValueChange={setTab} variant="underline" />
 *
 * The chosen option's background (pill) or line (underline) is one mark that slides to the option picked, so the
 * choice moves rather than jumps. Until the mark is measured, and in forced colors, the option marks itself.
 */
export function UiSegmented<T = string>({
  options = [], value = null, onValueChange, variant: variantProp, size: sizeProp, ariaLabel = '', disabled = false, onTouched, className, ...rest
}: UiSegmentedProps<T>) {
  const variant = variantProp ?? 'pill';
  const size = sizeProp ?? 'md';
  const indicator = useRef<HTMLSpanElement>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  /** The mark sits under the chosen option */
  const [placed, setPlaced] = useState(false);
  /** The mark has been placed once, so from now on it slides */
  const [ready, setReady] = useState(false);
  const readyRef = useRef(false);

  // Labels change width with the language and once the fonts load, and a hidden group gets its size when shown
  useLayoutEffect(() => {
    /** Puts the mark under the chosen option, where the option is now */
    const place = () => {
      const index = options.findIndex(option => option.value === value);
      const button = buttons.current[index];
      if (!button || !button.offsetWidth) {
        setPlaced(false);
        return;
      }
      const mark = indicator.current!;
      mark.style.transform = `translateX(${button.offsetLeft}px)`;
      mark.style.width = `${button.offsetWidth}px`;
      setPlaced(true);
      if (!readyRef.current) {
        readyRef.current = true;
        // After this placing has been drawn, so the first one does not slide
        requestAnimationFrame(() => setReady(true));
      }
    };
    const resized = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place);
    buttons.current.slice(0, options.length).forEach(button => button && resized?.observe(button));
    place();
    return () => resized?.disconnect();
  }, [options, value]);

  const select = (choice: T) => {
    onValueChange?.(choice);
    onTouched?.();
  };

  return (
    // variant and size, when given, stay on the element as attributes, as Angular keeps an input written as one
    <ui-segmented role="group" aria-label={ariaLabel || undefined} variant={variantProp} size={sizeProp} {...rest}
      className={cx(`ui-segmented ui-segmented-${variant} ui-segmented-${size}`, placed && 'ui-seg-sliding', ready && 'ui-seg-ready', className)}>
      <span ref={indicator} className="ui-seg-indicator" aria-hidden="true"></span>
      {options.map((option, index) => (
        <button key={String(option.value)} ref={element => { buttons.current[index] = element; }} type="button"
          className={cx('ui-seg-option', option.value === value && 'ui-seg-active')}
          aria-pressed={option.value === value} aria-label={option.ariaLabel ? `${option.label} · ${option.ariaLabel}` : undefined} title={option.ariaLabel || undefined}
          lang={option.lang || undefined} disabled={disabled || !!option.disabled} onClick={() => select(option.value)}>
          {option.icon && <NgIcon svg={option.icon} />}
          {` ${option.label} `}
          {option.count !== undefined && <span className="ui-seg-count">{option.count}</span>}
        </button>
      ))}
    </ui-segmented>
  );
}
