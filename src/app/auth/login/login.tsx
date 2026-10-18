import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { lucideEye, lucideEyeOff, lucideLockKeyhole, lucideMail } from '../../icons';
import { session as sessionService } from '../../user-management/access/session';
import { TwoFactorCodeField, type TwoFactorCodeFieldHandle } from '../../user-management/access/two-factor-code-field';
import { adminApi } from '../../user-management/config';
import { AdminApiError } from '../../user-management/data/admin-api';
import { LocalAdminApi } from '../../user-management/data/local-admin-api';
import { localBackendActive } from '../../user-management/data/local-backend';
import { DEMO_ACCOUNTS } from '../../user-management/data/mock-data';
import { EMAIL_PATTERN, FORM_BEHAVIOUR, controlName, fieldControl, invalidClass } from '../../user-management/shared/forms';
import { useFormat } from '../../user-management/shared/formatting';
import { cx, NgIcon, UiAlert, UiButton, UiCheckbox, UiFormField } from '../../user-management/ui';
import { AuthAside } from '../auth-aside/auth-aside';
import './login.scss';

/** What to tell someone whose sign-in was refused */
const SIGN_IN_ERRORS: Record<string, string> = {
  invalid_credentials: 'Wrong email or password.',
  account_suspended: 'This account is suspended. Ask an administrator to restore it.',
  invite_pending: 'This account has not been activated yet. Accept the invitation email first.',
  invalid_code: 'That code is not right. Codes change every 30 seconds; try the newest one.',
  too_many_requests: 'Too many attempts. Wait a few minutes and try again.',
};

interface LoginForm {
  email: string;
  password: string;
  remember: boolean;
  code: string;
}

export function LoginComponent() {
  const { t } = useFormat();
  const navigate = useNavigate();
  const [query] = useSearchParams();
  /** ?returnUrl=…: the page to open after signing in, set by the guards */
  const returnUrl = query.get('returnUrl') ?? undefined;
  /** ?expired=ended or ?expired=idle: why the session ended while the app was open */
  const expired = query.get('expired') ?? undefined;
  /** ?password=set or ?password=changed: back from a link in an email, with a new password to sign in with */
  const password = query.get('password') ?? undefined;

  const form = useForm<LoginForm>({ ...FORM_BEHAVIOUR, defaultValues: { email: '', password: '', remember: true, code: '' } });
  const codeField = useRef<TwoFactorCodeFieldHandle>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  /** Translation key of the last refusal */
  const [error, setError] = useState('');
  /** The password was right and the account uses two-step sign-in: now the code from the app */
  const [codeStep, setCodeStep] = useState(false);
  /** A code from the app, or a recovery code (recovery) */
  const [recovery, setRecovery] = useState(false);
  const [focusCode, setFocusCode] = useState(0);

  useEffect(() => {
    if (focusCode) {
      codeField.current?.focus();
    }
  }, [focusCode]);

  /** With the sample data, in the browser or behind the pretend server, one account per role to try; a real server has none */
  const demoAccounts = adminApi() instanceof LocalAdminApi || localBackendActive() ? DEMO_ACCOUNTS : [];

  const errors = {
    required: t('This field is required.'),
    email: t('Enter a valid email address.'),
    pattern: t('Enter a valid email address.'),
    minLength: t('Use at least 6 characters.'),
  };

  /** Only addresses inside this app, so a link cannot send someone elsewhere after signing in */
  const safeReturnUrl = (): string | null => returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//') ? returnUrl : null;

  const signIn = form.handleSubmit(async values => {
    setSigningIn(true);
    setError('');
    try {
      await sessionService.signIn(values.email, values.password, values.remember, codeStep ? values.code : undefined);
      await navigate(safeReturnUrl() ?? sessionService.view.homeUrl());
    } catch (failure) {
      const code = failure instanceof AdminApiError ? failure.code : '';
      if (code === 'two_factor_required') {
        setCodeStep(true);
        setFocusCode(count => count + 1);
      } else if (code === 'invalid_code' && recovery) {
        setError('That recovery code is not right, or it was used already.');
      } else {
        setError(SIGN_IN_ERRORS[code] ?? 'Could not sign in. Try again.');
      }
    } finally {
      setSigningIn(false);
    }
  });

  /** Back from the code to the email and password, to use another account */
  const startOver = () => {
    setCodeStep(false);
    form.resetField('code');
    setRecovery(false);
    setError('');
  };

  /** Fills in a sample account and signs in with it */
  const signInAs = (email: string) => {
    startOver();
    form.setValue('email', email);
    form.setValue('password', 'demo-password');
    void signIn();
  };

  return (
    <app-login>
      <div className="auth">
        <AuthAside />
        <div className="auth-main">
          <div className="auth-form-light">
            <div className="brand-logo">
              <img src="assets/images/logo-light.svg" alt="logo" className="logo-on-light" />
              <img src="assets/images/logo.svg" alt="logo" className="logo-on-dark" />
            </div>
            <h4>{t('Welcome back')}</h4>
            <h6>{t('Sign in to the admin to continue.')}</h6>
            <form className="login-form" onSubmit={event => void signIn(event)} noValidate>
              {error ? <UiAlert tone="danger">{t(error)}</UiAlert>
                : password === 'set' ? <UiAlert tone="success">{t('Your password is set. Sign in to start.')}</UiAlert>
                : password === 'changed' ? <UiAlert tone="success">{t('Your password has been changed. Sign in with the new one.')}</UiAlert>
                : expired === 'idle' ? <UiAlert tone="warning">{t('You were signed out after a while without activity. Sign in again to continue.')}</UiAlert>
                : expired ? <UiAlert tone="warning">{t('Your session has ended. Sign in again to continue.')}</UiAlert>
                : null}
              {codeStep ? (
                <>
                  <UiAlert tone="info" title={t('Two-step sign-in')}>
                    {` ${t(recovery ? 'Type one of the recovery codes you saved when you turned on two-step sign-in.' : 'Type the 6-digit code from the authenticator app on your phone.')} `}
                  </UiAlert>
                  <TwoFactorCodeField ref={codeField} form={form} name="code" inputId="loginCode" recovery={recovery} onRecoveryChange={setRecovery} hinted={false} />
                  <UiButton size="lg" block type="submit" loading={signingIn}>{t('Verify')}</UiButton>
                  <button type="button" className="auth-link start-over" onClick={startOver}>{t('Use another account')}</button>
                </>
              ) : (
                <>
                  <UiFormField label={t('Email')} for="loginEmail" errors={errors} control={fieldControl(form, 'email')}>
                    <div className="input-icon">
                      <NgIcon svg={lucideMail} />
                      <input className={cx('ui-input', invalidClass(form, 'email'))} id="loginEmail" type="email" autoComplete="username" placeholder="you@example.com"
                        {...controlName('email')} {...form.register('email', { required: true, pattern: EMAIL_PATTERN })} />
                    </div>
                  </UiFormField>
                  <UiFormField label={t('Password')} for="loginPassword" errors={errors} control={fieldControl(form, 'password')}
                    aside={<Link to="/forgot-password" className="auth-link" {...{ uifieldaside: '' }}>{t('Forgot password?')}</Link>}>
                    <div className="input-icon">
                      <NgIcon svg={lucideLockKeyhole} />
                      <input className={cx('ui-input', invalidClass(form, 'password'))} id="loginPassword" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="••••••••"
                        {...controlName('password')} {...form.register('password', { required: true, minLength: 6 })} />
                      <button type="button" className="input-action" onClick={() => setShowPassword(!showPassword)}
                        aria-label={t(showPassword ? 'Hide password' : 'Show password')} aria-pressed={showPassword}>
                        <NgIcon svg={showPassword ? lucideEyeOff : lucideEye} />
                      </button>
                    </div>
                  </UiFormField>
                  <UiCheckbox checked={form.watch('remember')} {...controlName('remember')} onCheckedChange={checked => form.setValue('remember', checked)}>{t('Keep me signed in')}</UiCheckbox>
                  <UiButton size="lg" block type="submit" loading={signingIn}>{t('Sign in')}</UiButton>
                </>
              )}
            </form>

            {demoAccounts.length > 0 && (
              <section className="demo" aria-label={t('Sample accounts')}>
                <p className="demo-title">{t('Try a role from the sample data')}</p>
                <div className="demo-accounts">
                  {demoAccounts.map(account => (
                    <button key={account.email} type="button" className="demo-account" disabled={signingIn} onClick={() => signInAs(account.email)}
                      title={account.email}>{account.roleName}</button>
                  ))}
                </div>
                <p className="demo-note">{t('Or use the email of any active user, with any password of 6 or more characters.')}</p>
              </section>
            )}
          </div>
        </div>
      </div>
    </app-login>
  );
}
