import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { AdminApiError } from '../data/admin-api';
import { useAdmin } from '../data/admin-store';
import { errorMessage } from '../shared/errors';
import { FORM_BEHAVIOUR, controlName, fieldControl, invalidClass } from '../shared/forms';
import { useFormat } from '../shared/formatting';
import { cx, uiToast, UiButton, UiDialog, UiFormField } from '../ui';
import './change-password-dialog.scss';
import { session as sessionService, useSession } from './session';

let nextId = 0;

interface PasswordForm {
  current: string;
  next: string;
  repeat: string;
}

export interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Lets the signed-in user change their own password */
export function ChangePasswordDialog({ open, onOpenChange }: ChangePasswordDialogProps) {
  const session = useSession();
  const store = useAdmin();
  const { t } = useFormat();
  const [ids] = useState(() => {
    const id = nextId++;
    return { form: `password-${id}`, current: `password-${id}-current`, next: `password-${id}-new`, repeat: `password-${id}-repeat` };
  });
  const [saving, setSaving] = useState(false);
  const form = useForm<PasswordForm>({ ...FORM_BEHAVIOUR, defaultValues: { current: '', next: '', repeat: '' } });

  /** The shortest password the settings allow */
  const minLength = store.settings.passwordMinLength;
  const errors = {
    required: t('This field is required.'),
    minlength: t('useAtLeastCharacters', { count: minLength }),
    mismatch: t('The passwords do not match.'),
    wrong: t('The current password is not right.'),
  };

  const reset = () => form.reset();

  const save = form.handleSubmit(async ({ current, next }) => {
    setSaving(true);
    try {
      await sessionService.changePassword(current, next);
      uiToast.show(t('Your password has been changed.'));
      onOpenChange(false);
      reset();
    } catch (error) {
      if (error instanceof AdminApiError && error.code === 'invalid_credentials') {
        form.setError('current', { type: 'wrong' });
      } else {
        uiToast.show(t(errorMessage(error)), 'error');
      }
    } finally {
      setSaving(false);
    }
  });

  return (
    <app-change-password-dialog>
      <UiDialog open={open} onOpenChange={next => { onOpenChange(next); if (!next) { reset(); } }} title={t('Change password')}
        description={t('Use one you do not use anywhere else.')} closeLabel={t('Close')}
        footer={<>
          <UiButton variant="secondary" type="button" onClick={() => { onOpenChange(false); reset(); }}>{t('Cancel')}</UiButton>
          <UiButton type="submit" form={ids.form} loading={saving}>{t('Change password')}</UiButton>
        </>}>
        <form className="password-form" id={ids.form} onSubmit={event => void save(event)} noValidate>
          {/* Lets password managers match the new password to the account */}
          <input type="text" className="ui-sr-only" autoComplete="username" value={session.user?.email ?? ''} tabIndex={-1} aria-hidden="true" readOnly />
          <UiFormField label={t('Current password')} for={ids.current} required errors={errors} control={fieldControl(form, 'current')}>
            <input className={cx('ui-input', invalidClass(form, 'current'))} id={ids.current} type="password" autoComplete="current-password" {...controlName('current')} {...form.register('current', { required: true })} />
          </UiFormField>
          <UiFormField label={t('New password')} for={ids.next} required errors={errors} control={fieldControl(form, 'next')}
            hint={t('atLeastCharacters', { count: minLength })}>
            <input className={cx('ui-input', invalidClass(form, 'next'))} id={ids.next} type="password" autoComplete="new-password" {...controlName('next')} {...form.register('next', {
              required: true,
              validate: { minlength: value => !value || value.length >= minLength },
            })} />
          </UiFormField>
          <UiFormField label={t('Repeat the new password')} for={ids.repeat} required errors={errors} control={fieldControl(form, 'repeat')}>
            <input className={cx('ui-input', invalidClass(form, 'repeat'))} id={ids.repeat} type="password" autoComplete="new-password" {...controlName('repeat')} {...form.register('repeat', {
              required: true,
              validate: { mismatch: (value, values) => !value || !values.next || value === values.next },
            })} />
          </UiFormField>
        </form>
      </UiDialog>
    </app-change-password-dialog>
  );
}
