import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';

import { lucideMail } from '../../icons';
import { adminApi } from '../../user-management/config';
import { LocalAdminApi } from '../../user-management/data/local-admin-api';
import { localBackendActive } from '../../user-management/data/local-backend';
import { errorMessage } from '../../user-management/shared/errors';
import { EMAIL_PATTERN, FORM_BEHAVIOUR, controlName, fieldControl, invalidClass } from '../../user-management/shared/forms';
import { useFormat } from '../../user-management/shared/formatting';
import { cx, NgIcon, UiAlert, UiButton, UiFormField } from '../../user-management/ui';
import { AuthAside } from '../auth-aside/auth-aside';
import './forgot-password.scss';

/**
 * "Forgot password?": asks for an email and has a reset link sent to it. The answer is the same whether or not the
 * email belongs to someone, so the page cannot be used to find out who has an account.
 */
export function ForgotPasswordComponent() {
  const { t } = useFormat();
  const form = useForm<{ email: string }>({ ...FORM_BEHAVIOUR, defaultValues: { email: '' } });
  const [sending, setSending] = useState(false);
  /** Translation key of the last failure */
  const [error, setError] = useState('');
  /** The address the link went to, once sent */
  const [sentTo, setSentTo] = useState('');

  /** With the sample data there is no mail server: the email goes to the browser console */
  const sampleData = adminApi() instanceof LocalAdminApi || localBackendActive();

  const errors = {
    required: t('This field is required.'),
    pattern: t('Enter a valid email address.'),
  };

  const send = form.handleSubmit(async ({ email }) => {
    setSending(true);
    setError('');
    try {
      await adminApi().requestPasswordReset(email);
      setSentTo(email);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setSending(false);
    }
  });

  return (
    <app-forgot-password>
      <div className="auth">
        <AuthAside />
        <div className="auth-main">
          <div className="auth-form-light">
            <div className="brand-logo">
              <img src="assets/images/logo-light.svg" alt="logo" className="logo-on-light" />
              <img src="assets/images/logo.svg" alt="logo" className="logo-on-dark" />
            </div>
            <h4>{t('Forgot your password?')}</h4>
            <h6>{t('Enter your email and we will send you a link to set a new one.')}</h6>

            {sentTo ? (
              <div className="auth-form">
                <UiAlert tone="success">{t('resetLinkSent', { email: sentTo })}</UiAlert>
                {sampleData && <p className="demo-note">{t('With the sample data there is no mail server: the email is written to the browser console.')}</p>}
                {/* Back to the form, to try another address */}
                <UiButton variant="secondary" size="lg" block type="button" onClick={() => setSentTo('')}>{t('Use another email')}</UiButton>
                <Link className="auth-link back" to="/login">{t('Back to sign in')}</Link>
              </div>
            ) : (
              <form className="auth-form" onSubmit={event => void send(event)} noValidate>
                {error && <UiAlert tone="danger">{t(error)}</UiAlert>}
                <UiFormField label={t('Email')} for="resetEmail" errors={errors} control={fieldControl(form, 'email')}>
                  <div className="input-icon">
                    <NgIcon svg={lucideMail} />
                    <input className={cx('ui-input', invalidClass(form, 'email'))} id="resetEmail" type="email" autoComplete="username" placeholder="you@example.com"
                      {...controlName('email')} {...form.register('email', { required: true, pattern: EMAIL_PATTERN })} />
                  </div>
                </UiFormField>
                <UiButton size="lg" block type="submit" loading={sending}>{t('Send link')}</UiButton>
                <Link className="auth-link back" to="/login">{t('Back to sign in')}</Link>
              </form>
            )}
          </div>
        </div>
      </div>
    </app-forgot-password>
  );
}
