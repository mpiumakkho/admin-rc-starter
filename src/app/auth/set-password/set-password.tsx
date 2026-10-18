import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { adminApi } from '../../user-management/config';
import { AdminApiError } from '../../user-management/data/admin-api';
import { errorMessage } from '../../user-management/shared/errors';
import { FORM_BEHAVIOUR, controlName, fieldControl, invalidClass } from '../../user-management/shared/forms';
import { useFormat } from '../../user-management/shared/formatting';
import { cx, UiAlert, UiButton, UiFormField, UiLinkButton } from '../../user-management/ui';
import { AuthAside } from '../auth-aside/auth-aside';
import './set-password.scss';

/** Which email the link came from */
export type EmailLinkKind = 'invite' | 'reset';

interface PasswordForm {
  password: string;
  repeat: string;
}

/**
 * Where the links in emails lead: /activate?token=… from an invitation, /reset-password?token=… from a password
 * reset. Both ask for a new password; after that the person signs in with it.
 */
export function SetPasswordComponent({ link = 'invite' }: { link?: EmailLinkKind }) {
  const { t } = useFormat();
  const navigate = useNavigate();
  const [query] = useSearchParams();
  /** ?token=…, from the link */
  const token = query.get('token') ?? undefined;

  const [saving, setSaving] = useState(false);
  /** Translation key of the last refusal */
  const [error, setError] = useState('');
  /** The server turned the link down: expired, used already, or never made */
  const [deadLink, setDeadLink] = useState(false);
  /** The password rules from the settings, readable without signing in; 8 characters until they arrive */
  const [minLength, setMinLength] = useState(8);

  useEffect(() => {
    let current = true;
    adminApi().getPasswordPolicy().then(policy => current && setMinLength(policy.minLength), () => undefined);
    return () => {
      current = false;
    };
  }, []);

  const form = useForm<PasswordForm>({ ...FORM_BEHAVIOUR, defaultValues: { password: '', repeat: '' } });

  const errors = {
    required: t('This field is required.'),
    minlength: t('useAtLeastCharacters', { count: minLength }),
    mismatch: t('The passwords do not match.'),
  };

  const save = async () => {
    // The repeat is checked against the password as it is now
    await form.trigger('repeat');
    await form.handleSubmit(async ({ password }) => {
      if (!token) {
        return;
      }
      setSaving(true);
      setError('');
      try {
        if (link === 'invite') {
          await adminApi().acceptInvitation(token, password);
        } else {
          await adminApi().confirmPasswordReset(token, password);
        }
        await navigate(`/login?password=${link === 'invite' ? 'set' : 'changed'}`);
      } catch (failure) {
        if (failure instanceof AdminApiError && failure.code === 'invalid_token') {
          setDeadLink(true);
        } else {
          setError(errorMessage(failure));
        }
      } finally {
        setSaving(false);
      }
    })();
  };

  return (
    <app-set-password>
      <div className="auth">
        <AuthAside />
        <div className="auth-main">
          <div className="auth-form-light">
            <div className="brand-logo">
              <img src="assets/images/logo-light.svg" alt="logo" className="logo-on-light" />
              <img src="assets/images/logo.svg" alt="logo" className="logo-on-dark" />
            </div>
            {link === 'invite' ? (
              <>
                <h4>{t('Set your password')}</h4>
                <h6>{t('Choose a password to start using your account.')}</h6>
              </>
            ) : (
              <>
                <h4>{t('Set a new password')}</h4>
                <h6>{t('Choose a new password for your account.')}</h6>
              </>
            )}

            {!token ? (
              <div className="auth-form">
                <UiAlert tone="warning">{t('This link is not complete. Open it again from the email, or copy the whole address.')}</UiAlert>
                <Link className="auth-link back" to="/login">{t('Back to sign in')}</Link>
              </div>
            ) : deadLink ? (
              <div className="auth-form">
                {link === 'invite'
                  ? <UiAlert tone="danger">{t('This invitation has expired or was already used. Ask an administrator to send a new one.')}</UiAlert>
                  : <>
                    <UiAlert tone="danger">{t('This link has expired or was already used. Ask for a new one.')}</UiAlert>
                    <UiLinkButton size="lg" block to="/forgot-password">{t('Send a new link')}</UiLinkButton>
                  </>}
                <Link className="auth-link back" to="/login">{t('Back to sign in')}</Link>
              </div>
            ) : (
              <form className="auth-form" onSubmit={event => { event.preventDefault(); void save(); }} noValidate>
                {error && <UiAlert tone="danger">{t(error)}</UiAlert>}
                <UiFormField label={t('New password')} for="newPassword" errors={errors} control={fieldControl(form, 'password')}
                  hint={t('atLeastCharacters', { count: minLength })}>
                  <input className={cx('ui-input', invalidClass(form, 'password'))} id="newPassword" type="password" autoComplete="new-password"
                    {...controlName('password')} {...form.register('password', { required: true, validate: { minlength: value => !value || value.length >= minLength } })} />
                </UiFormField>
                <UiFormField label={t('Repeat the new password')} for="repeatPassword" errors={errors} control={fieldControl(form, 'repeat')}>
                  <input className={cx('ui-input', invalidClass(form, 'repeat'))} id="repeatPassword" type="password" autoComplete="new-password"
                    {...controlName('repeat')} {...form.register('repeat', {
                      required: true,
                      validate: { mismatch: (value, values) => !value || !values.password || value === values.password },
                    })} />
                </UiFormField>
                <UiButton size="lg" block type="submit" loading={saving}>
                  {` ${t(link === 'invite' ? 'Set password' : 'Change password')} `}
                </UiButton>
                <Link className="auth-link back" to="/login">{t('Back to sign in')}</Link>
              </form>
            )}
          </div>
        </div>
      </div>
    </app-set-password>
  );
}

/** /activate, from an invitation email */
export function ActivatePage() {
  return <SetPasswordComponent link="invite" />;
}

/** /reset-password, from a password reset email */
export function ResetPasswordPage() {
  return <SetPasswordComponent link="reset" />;
}
