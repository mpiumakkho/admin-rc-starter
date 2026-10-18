import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import type { FieldValues, Path, UseFormReturn } from 'react-hook-form';

import { fieldControl, invalidClass } from '../shared/forms';
import { useFormat } from '../shared/formatting';
import { cx, UiFormField } from '../ui';
import './two-factor-code-field.scss';

/** Six digits from the authenticator app, or a recovery code such as "abcde-fghjk", in any case, with or without the dash */
export const TWO_FACTOR_CODE = /^(\d{6}|[a-z0-9]{5}[\s-]?[a-z0-9]{5})$/i;

/** The field's rules, for form.register: required, and either kind of code */
export const TWO_FACTOR_CODE_RULES = { required: true, pattern: TWO_FACTOR_CODE } as const;

export interface TwoFactorCodeFieldHandle {
  focus(): void;
}

export interface TwoFactorCodeFieldProps<T extends FieldValues> {
  /** The form the code belongs to; set the field's "wrong" error (form.setError) when the server answers invalid_code */
  form: UseFormReturn<T>;
  name: Path<T>;
  inputId: string;
  /** A recovery code rather than one from the app */
  recovery?: boolean;
  onRecoveryChange?: (recovery: boolean) => void;
  /** Without the hint under the field, where the page says the same above it */
  hinted?: boolean;
  ref?: Ref<TwoFactorCodeFieldHandle>;
}

const CODE_HINT = 'Type the 6-digit code the app shows.';
const RECOVERY_HINT = 'Type one of the codes you saved when you turned on two-step sign-in.';

/**
 * The code two-step sign-in asks for: six digits from the authenticator app, or, through the link under it, one of the
 * recovery codes (API.md, "Recovery codes"). The form owns the field (TWO_FACTOR_CODE_RULES).
 */
export function TwoFactorCodeField<T extends FieldValues>({
  form, name, inputId, recovery: recoveryProp, onRecoveryChange, hinted = true, ref,
}: TwoFactorCodeFieldProps<T>) {
  const { t } = useFormat();
  const [ownRecovery, setOwnRecovery] = useState(false);
  const recovery = recoveryProp ?? ownRecovery;
  const input = useRef<HTMLInputElement | null>(null);
  const [switched, setSwitched] = useState(0);

  useImperativeHandle(ref, () => ({ focus: () => input.current?.focus() }), []);
  useEffect(() => {
    if (switched) {
      input.current?.focus();
    }
  }, [switched]);

  const switchKind = () => {
    const next = !recovery;
    setOwnRecovery(next);
    onRecoveryChange?.(next);
    form.resetField(name);
    setSwitched(count => count + 1);
  };

  const missing = t(recovery ? 'Type a recovery code, such as abcde-fghjk.' : 'Type the 6-digit code.');
  const errors = {
    required: missing,
    pattern: missing,
    wrong: t(recovery ? 'That recovery code is not right, or it was used already.' : 'That code is not right. Codes change every 30 seconds; try the newest one.'),
  };

  const { ref: registerRef, ...field } = form.register(name, TWO_FACTOR_CODE_RULES);
  const setRef = (element: HTMLInputElement | null) => {
    input.current = element;
    registerRef(element);
  };

  return (
    <app-two-factor-code-field>
      {/* One input for either kind, as the Angular app's, whose form field finds its control only outside an @if */}
      <UiFormField label={t(recovery ? 'Recovery code' : 'Code')} for={inputId} errors={errors} control={fieldControl(form, name)}
        hint={hinted ? t(recovery ? RECOVERY_HINT : CODE_HINT) : ''}>
        <input ref={setRef} {...field} className={cx('ui-input code-input', invalidClass(form, name))} id={inputId}
          inputMode={recovery ? undefined : 'numeric'} autoComplete={recovery ? 'off' : 'one-time-code'} autoCapitalize={recovery ? 'off' : undefined}
          spellCheck={recovery ? false : undefined} maxLength={recovery ? 11 : 6} placeholder={recovery ? 'abcde-fghjk' : '123456'} />
      </UiFormField>
      {/* Pressed, it leaves the focus in the field: the field it is about to change asks for nothing yet, and no message
          appearing under it moves the button away from the pointer before the press ends */}
      <button type="button" className="code-switch" onMouseDown={event => event.preventDefault()} onClick={switchKind}>
        {` ${t(recovery ? 'Use the code from the app' : 'Lost your phone? Use a recovery code')} `}
      </button>
    </app-two-factor-code-field>
  );
}
