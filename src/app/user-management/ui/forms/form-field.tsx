import type { HTMLAttributes, ReactNode } from 'react';

import { cx } from '../core/types';
import './form-field.scss';

/** The library's field style for an <input>, <select> or <textarea> (input[uiInput] in the Angular app) */
export const UI_INPUT = 'ui-input';

/** A control's state, as a form library reports it, for a field to say what is wrong once it has been used */
export interface UiFieldControl {
  /** Error keys of the control, such as { required: true } */
  errors?: Record<string, unknown> | null;
  touched?: boolean;
  dirty?: boolean;
}

export interface UiFormFieldProps extends HTMLAttributes<HTMLElement> {
  label?: string;
  /** The id of the control, so clicking the label focuses it */
  for?: string;
  hint?: string;
  required?: boolean;
  /** Shown after the label for fields that can be left empty, such as "(optional)" */
  optionalLabel?: string;
  /** Message per validation error key, for example { required: '…', email: '…' } */
  errors?: Record<string, string>;
  /** The control's errors and whether it has been touched or changed: its first error with a message then shows */
  control?: UiFieldControl;
  /** Or the message to show, worked out elsewhere */
  error?: string;
  /** Beside the label, at the end of its row ([uiFieldAside] in the Angular app) */
  aside?: ReactNode;
}

/**
 * Label, control, hint and error message, laid out as one field. The error shows once the control has been touched or
 * changed, using the first key of its errors found in `errors`.
 *
 *   <UiFormField label="Email" for="email" required errors={{ required: 'Enter an email', email: 'Not a valid email' }} control={emailState}>
 *     <input className="ui-input" id="email" {...register('email')} />
 *   </UiFormField>
 */
export function UiFormField({
  label = '', for: forId = '', hint = '', required, optionalLabel = '', errors = {}, control, error, aside, className, children, ...rest
}: UiFormFieldProps) {
  let message = error ?? '';
  if (!message && control?.errors && (control.touched || control.dirty)) {
    const key = Object.keys(control.errors).find(name => errors[name]);
    message = key ? errors[key] : '';
  }
  return (
    <ui-form-field {...rest} className={cx('ui-form-field', className)}>
      {label && (
        <div className="ui-field-label-row">
          <label className="ui-field-label" htmlFor={forId || undefined}>
            {` ${label} `}
            {required && <span className="ui-field-required" aria-hidden="true">*</span>}
            {optionalLabel && <span className="ui-field-optional">{optionalLabel}</span>}
          </label>
          {aside}
        </div>
      )}
      {children}
      {message ? <p className="ui-field-error" role="alert">{message}</p> : hint && <p className="ui-field-hint">{hint}</p>}
    </ui-form-field>
  );
}
