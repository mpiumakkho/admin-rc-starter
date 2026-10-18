import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';

import { AdminApiError } from '../data/admin-api';
import { useAdmin } from '../data/admin-store';
import { errorMessage } from '../shared/errors';
import { FORM_BEHAVIOUR, fieldControl, invalidClass } from '../shared/forms';
import { reauthLabel, useFormat } from '../shared/formatting';
import { cx, UiAlert, UiButton, UiDialog, UiFormField } from '../ui';
import './reauth-dialog.scss';
import { session as sessionService, useSession } from './session';
import { TwoFactorCodeField, type TwoFactorCodeFieldHandle } from './two-factor-code-field';

/** What to tell someone whose password was refused; the email is theirs already, so only the password can be wrong */
const SIGN_IN_ERRORS: Partial<Record<string, string>> = {
  invalid_credentials: 'That password is not right.',
  account_suspended: 'This account is suspended. Ask an administrator to restore it.',
};

interface ReauthForm {
  password: string;
  code: string;
}

/**
 * Asks the signed-in person for their password again, over the page they are on:
 *
 * - In the accessible view, a session that ends does not take the person away: they sign in again here and carry on
 *   with what they had typed (WCAG 2.2.5, 3.2.5). Or they go to the sign-in page, where the usual view takes them at
 *   once. Nothing else closes it.
 * - A risky change refused with reauth_required (API.md, "Confirming who you are"): once they confirm who they are,
 *   the change goes again by itself; closing the dialog leaves it unsent.
 *
 * Place one in the app shell, as <UiToaster />.
 */
export function ReauthDialog() {
  const session = useSession();
  const store = useAdmin();
  const { t } = useFormat();
  const form = useForm<ReauthForm>({ ...FORM_BEHAVIOUR, defaultValues: { password: '', code: '' } });
  const { ref: passwordRef, ...password } = form.register('password', { required: true });
  const codeField = useRef<TwoFactorCodeFieldHandle>(null);

  /** Signing in again after the session ended comes first: a change waiting for the password cannot go without it */
  const purpose: 'signIn' | 'confirm' | null = session.paused ? 'signIn' : session.reauthRequested ? 'confirm' : null;
  const email = session.user?.email ?? '';
  /** A code from the app, or a recovery code */
  const [recovery, setRecovery] = useState(false);
  /** The password was right and the account uses two-step sign-in: now the code from the app */
  const [codeStep, setCodeStep] = useState(false);
  const [busy, setBusy] = useState(false);
  /** Translation key of the last refusal */
  const [error, setError] = useState('');
  const [focusCode, setFocusCode] = useState(0);

  useEffect(() => {
    if (focusCode) {
      codeField.current?.focus();
    }
  }, [focusCode]);

  const description = purpose === 'confirm'
    ? t('reauthConfirm', { time: reauthLabel(t, store.settings.reauthMinutes) })
    : purpose === 'signIn' ? t(session.paused === 'idle' ? 'reauthIdle' : 'reauthEnded') : '';

  const reset = () => {
    form.reset();
    setCodeStep(false);
    setRecovery(false);
    setError('');
  };

  const signIn = form.handleSubmit(async values => {
    setBusy(true);
    setError('');
    const code = codeStep ? values.code : undefined;
    try {
      if (purpose === 'confirm') {
        await sessionService.reauthenticate(values.password, code);
      } else {
        await sessionService.resume(values.password, code);
      }
      reset();
    } catch (failure) {
      const reason = failure instanceof AdminApiError ? failure.code : '';
      if (reason === 'two_factor_required') {
        setCodeStep(true);
        setFocusCode(count => count + 1);
      } else if (reason === 'invalid_code' && recovery) {
        setError('That recovery code is not right, or it was used already.');
      } else {
        setError(SIGN_IN_ERRORS[reason] ?? errorMessage(failure));
      }
    } finally {
      setBusy(false);
    }
  });

  /** Closes the confirmation, leaving the change that waited unsent */
  const cancel = () => {
    if (purpose === 'confirm') {
      reset();
      sessionService.cancelReauth();
    }
  };

  const leave = () => {
    reset();
    sessionService.leave();
  };

  return (
    <app-reauth-dialog>
      <UiDialog size="sm" open={!!purpose} onOpenChange={open => open || cancel()} dismissible={purpose === 'confirm'}
        title={t(purpose === 'confirm' ? 'Confirm it is you' : 'Sign in again to carry on')} closeLabel={t('Close')} description={description}
        footer={purpose === 'confirm' ? <>
          <UiButton variant="secondary" type="button" onClick={cancel}>{t('Cancel')}</UiButton>
          <UiButton type="submit" form="reauth-form" loading={busy}>{t('Confirm')}</UiButton>
        </> : <>
          <UiButton variant="secondary" type="button" onClick={leave}>{t('Go to the sign-in page')}</UiButton>
          <UiButton type="submit" form="reauth-form" loading={busy}>{t('Sign in')}</UiButton>
        </>}>
        <form id="reauth-form" className="reauth-form" onSubmit={event => void signIn(event)} noValidate>
          {error && <UiAlert tone="danger">{t(error)}</UiAlert>}
          <UiFormField label={t('Email')} for="reauth-email">
            <input className="ui-input" id="reauth-email" value={email} readOnly autoComplete="username" />
          </UiFormField>
          <UiFormField label={t('Password')} for="reauth-password" errors={{ required: t('This field is required.') }} control={fieldControl(form, 'password')}>
            {/* The dialog opens on the password, the only thing to type: showModal() focuses the element with the autofocus
                attribute, which React's autoFocus does not write */}
            <input className={cx('ui-input', invalidClass(form, 'password'))} id="reauth-password" type="password" autoComplete="current-password"
              {...password} ref={element => { passwordRef(element); element?.setAttribute('autofocus', ''); }} />
          </UiFormField>
          {codeStep && (
            <TwoFactorCodeField ref={codeField} form={form} name="code" inputId="reauth-code" recovery={recovery} onRecoveryChange={setRecovery} />
          )}
        </form>
      </UiDialog>
    </app-reauth-dialog>
  );
}
