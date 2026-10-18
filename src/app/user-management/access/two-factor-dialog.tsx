import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';

import { lucideCheck, lucideCopy } from '../../icons';
import { AdminApiError } from '../data/admin-api';
import { adminStore } from '../data/admin-store';
import type { TwoFactorSetup } from '../data/models';
import { errorMessage } from '../shared/errors';
import { FORM_BEHAVIOUR, fieldControl, invalidClass } from '../shared/forms';
import { useFormat } from '../shared/formatting';
import { cx, NgIcon, uiToast, UiAlert, UiButton, UiDialog, UiFormField } from '../ui';
import { RecoveryCodes } from './recovery-codes';
import { TwoFactorCodeField, type TwoFactorCodeFieldHandle } from './two-factor-code-field';
import './two-factor-dialog.scss';

let nextId = 0;

interface TwoFactorForm {
  code: string;
  anyCode: string;
}

export interface TwoFactorDialogProps {
  mode?: 'enable' | 'disable';
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Turns two-step sign-in on (scan a QR code with an authenticator app, type a code to prove it works, then save the
 * recovery codes) or off (type a current code, or a recovery code). For the signed-in user only.
 */
export function TwoFactorDialog({ mode = 'enable', open, onOpenChange }: TwoFactorDialogProps) {
  const { t } = useFormat();
  const [formId] = useState(() => `two-factor-${nextId++}`);
  const form = useForm<TwoFactorForm>({ ...FORM_BEHAVIOUR, defaultValues: { code: '', anyCode: '' } });
  const codeField = useRef<TwoFactorCodeFieldHandle>(null);
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  /** Turned on: the recovery codes to save, shown this once */
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  const title = recoveryCodes ? 'Save your recovery codes' : mode === 'enable' ? 'Turn on two-step sign-in' : 'Turn off two-step sign-in';
  const description = recoveryCodes ? 'Two-step sign-in is on.'
    : mode === 'enable' ? 'Signing in will need a code from your phone as well as your password.' : 'Signing in will need only your password again.';
  const errors = {
    required: t('Type the 6-digit code.'),
    pattern: t('Type the 6-digit code.'),
    wrong: t('That code is not right. Codes change every 30 seconds; try the newest one.'),
  };

  const reset = () => {
    setSetup(null);
    setQr(null);
    setFailed(false);
    form.reset();
    setRecoveryCodes(null);
  };

  // Each time it opens to turn on, a new secret: one that was shown and abandoned is never used
  useEffect(() => {
    if (!open || mode !== 'enable') {
      return undefined;
    }
    let cancelled = false;
    reset();
    (async () => {
      try {
        const started = await adminStore.startTwoFactor();
        if (cancelled) {
          return;
        }
        setSetup(started);
        // The QR code library loads only when someone sets this up
        const { renderSVG } = await import('uqr');
        const svg = renderSVG(started.uri, { pixelSize: 4, blackColor: '#0f172a' });
        if (!cancelled) {
          setQr(`data:image/svg+xml;base64,${btoa(svg)}`);
        }
      } catch {
        if (!cancelled) {
          setFailed(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, mode]);

  const change = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      reset();
    }
  };

  const grouped = (secret: string) => secret.match(/.{1,4}/g)?.join(' ') ?? secret;

  const copy = async (secret: string) => {
    await navigator.clipboard?.writeText(secret).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const field: keyof TwoFactorForm = mode === 'enable' ? 'code' : 'anyCode';
  const submit = form.handleSubmit(async values => {
    setSaving(true);
    try {
      if (mode === 'enable') {
        // On: the recovery codes show before the dialog closes
        const { recoveryCodes: codes } = await adminStore.confirmTwoFactor(values.code);
        setRecoveryCodes(codes);
        uiToast.show(t('Two-step sign-in is on.'));
      } else {
        await adminStore.disableTwoFactor(values.anyCode);
        uiToast.show(t('Two-step sign-in is off.'));
        change(false);
      }
    } catch (error) {
      if (error instanceof AdminApiError && error.code === 'invalid_code') {
        form.setError(field, { type: 'wrong' });
        codeField.current?.focus();
      } else {
        uiToast.show(t(errorMessage(error)), 'error');
      }
    } finally {
      setSaving(false);
    }
  });

  return (
    <app-two-factor-dialog>
      <UiDialog open={open} onOpenChange={change} title={t(title)} description={t(description)} closeLabel={t('Close')}
        footer={recoveryCodes
          ? <UiButton type="button" onClick={() => change(false)}>{t('Done')}</UiButton>
          : <>
            <UiButton variant="secondary" type="button" onClick={() => change(false)}>{t('Cancel')}</UiButton>
            <UiButton type="submit" form={formId} variant={mode === 'enable' ? 'primary' : 'danger'} loading={saving} disabled={mode === 'enable' && !setup}>
              {` ${t(mode === 'enable' ? 'Turn on' : 'Turn off')} `}
            </UiButton>
          </>}>
        {recoveryCodes ? <RecoveryCodes codes={recoveryCodes} /> : (
          // No form library submit here, so the submit event is handled directly
          <form className="two-factor" id={formId} onSubmit={event => void submit(event)} noValidate>
            {mode === 'enable' && (
              <ol className="steps">
                <li>
                  <p>{t('Scan this code with an authenticator app, such as Google Authenticator or Microsoft Authenticator.')}</p>
                  <div className="qr">
                    {qr
                      ? <img src={qr} width={176} height={176} alt={t('Code to scan with your authenticator app')} />
                      : failed
                        ? <UiAlert tone="danger">{t('Could not start. Close this and try again.')}</UiAlert>
                        : <span className="qr-loading" aria-hidden="true"></span>}
                  </div>
                  {setup && (
                    <>
                      <p className="manual">{t('Cannot scan? Type this key into the app instead:')}</p>
                      <div className="secret">
                        <code>{grouped(setup.secret)}</code>
                        <UiButton variant="ghost" size="sm" iconOnly type="button" onClick={() => copy(setup.secret)} aria-label={t('Copy key')}>
                          <NgIcon svg={copied ? lucideCheck : lucideCopy} />
                        </UiButton>
                      </div>
                    </>
                  )}
                </li>
                <li>
                  <p>{t('Type the 6-digit code the app shows.')}</p>
                </li>
              </ol>
            )}
            {mode === 'enable'
              ? (
                <UiFormField label={t('Code')} for={`${formId}-code`} errors={errors} control={fieldControl(form, 'code')}>
                  <input className={cx('ui-input code-input', invalidClass(form, 'code'))} id={`${formId}-code`} inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456"
                    {...form.register('code', { required: true, pattern: /^\d{6}$/ })} />
                </UiFormField>
              )
              // Turning it off works with a recovery code too, for someone who lost their phone
              : <TwoFactorCodeField ref={codeField} form={form} name="anyCode" inputId={`${formId}-code`} />}
          </form>
        )}
      </UiDialog>
    </app-two-factor-dialog>
  );
}
