import { useLayoutEffect, useRef, type HTMLAttributes, type Ref } from 'react';

import { lucideCheck, lucideMinus } from '../../../icons';
import { cx } from '../core/types';
import { NgIcon } from '../icon/icon';
import './checkbox.scss';

export interface UiCheckboxProps extends Omit<HTMLAttributes<HTMLElement>, 'onChange'> {
  checked?: boolean;
  /** The user ticked or unticked the box */
  onCheckedChange?: (checked: boolean) => void;
  indeterminate?: boolean;
  disabled?: boolean;
  /** Label for screen readers when the checkbox has no visible text */
  ariaLabel?: string;
  /** The box lost focus, for forms that mark a field touched */
  onTouched?: () => void;
  /** The native checkbox, for forms that focus a field */
  inputRef?: Ref<HTMLInputElement>;
}

/**
 * A checkbox with its label as content.
 *
 *   <UiCheckbox checked={remember} onCheckedChange={setRemember}>Remember me</UiCheckbox>
 *   <UiCheckbox checked={all} indeterminate={some} onCheckedChange={toggleAll} ariaLabel="Select all" />
 */
export function UiCheckbox({
  checked = false, onCheckedChange, indeterminate = false, disabled = false, ariaLabel = '', onTouched, inputRef, className, children, ...rest
}: UiCheckboxProps) {
  const input = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    input.current!.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <ui-checkbox {...rest} className={cx('ui-checkbox', className)}>
      <label className="ui-check">
        <input ref={element => {
          input.current = element;
          if (typeof inputRef === 'function') {
            inputRef(element);
          } else if (inputRef) {
            inputRef.current = element;
          }
        }} type="checkbox" className="ui-check-input" checked={checked} disabled={disabled} aria-label={ariaLabel || undefined}
          onChange={event => onCheckedChange?.(event.target.checked)} onBlur={() => onTouched?.()} />
        <span className="ui-check-box" aria-hidden="true">
          <NgIcon svg={indeterminate ? lucideMinus : lucideCheck} />
        </span>
        <span className="ui-check-label">{children}</span>
      </label>
    </ui-checkbox>
  );
}
