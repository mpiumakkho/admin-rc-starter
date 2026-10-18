import type { HTMLAttributes, Ref } from 'react';

import { cx } from '../core/types';
import './switch.scss';

export interface UiSwitchProps extends Omit<HTMLAttributes<HTMLElement>, 'onChange'> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  description?: string;
  disabled?: boolean;
  ariaLabel?: string;
  onTouched?: () => void;
  inputRef?: Ref<HTMLInputElement>;
}

/**
 * An on/off switch with a label and an optional description.
 *
 *   <UiSwitch checked={notify} onCheckedChange={setNotify} description="News about your account">Email notifications</UiSwitch>
 */
export function UiSwitch({
  checked = false, onCheckedChange, description = '', disabled = false, ariaLabel = '', onTouched, inputRef, className, children, ...rest
}: UiSwitchProps) {
  return (
    <ui-switch {...rest} className={cx('ui-switch', className)}>
      <label className="ui-switch-row">
        <span className="ui-switch-text">
          <span className="ui-switch-label">{children}</span>
          {description && <span className="ui-switch-description">{description}</span>}
        </span>
        <input ref={inputRef} type="checkbox" role="switch" className="ui-switch-input" checked={checked} disabled={disabled}
          aria-label={ariaLabel || undefined} onChange={event => onCheckedChange?.(event.target.checked)} onBlur={() => onTouched?.()} />
        <span className="ui-switch-track" aria-hidden="true"><span className="ui-switch-knob"></span></span>
      </label>
    </ui-switch>
  );
}
