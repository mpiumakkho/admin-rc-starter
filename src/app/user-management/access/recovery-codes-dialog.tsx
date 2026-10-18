import { useState } from 'react';

import { adminStore } from '../data/admin-store';
import { errorMessage } from '../shared/errors';
import { useFormat } from '../shared/formatting';
import { UiAlert, UiButton, UiDialog } from '../ui';
import { RecoveryCodes } from './recovery-codes';

export interface RecoveryCodesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** New codes were made: how many are left changed */
  onMade?: () => void;
}

/**
 * Makes ten new recovery codes for the signed-in user, which replace the old ones, and shows them this once
 * (API.md, "Recovery codes"). A risky change: the password may be asked again first (ReauthDialog).
 */
export function RecoveryCodesDialog({ open, onOpenChange, onMade }: RecoveryCodesDialogProps) {
  const { t } = useFormat();
  const [codes, setCodes] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);
  /** Translation key of what went wrong */
  const [error, setError] = useState('');

  const reset = () => {
    setCodes(null);
    setError('');
  };
  const change = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      reset();
    }
  };

  const make = async () => {
    setSaving(true);
    setError('');
    try {
      setCodes(await adminStore.createRecoveryCodes());
      onMade?.();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setSaving(false);
    }
  };

  return (
    <app-recovery-codes-dialog>
      <UiDialog open={open} onOpenChange={change} title={t('New recovery codes')}
        description={t(codes ? '' : 'New codes replace the ones you have now, so those stop working.')} closeLabel={t('Close')}
        footer={codes
          ? <UiButton type="button" onClick={() => change(false)}>{t('Done')}</UiButton>
          : <>
            <UiButton variant="secondary" type="button" onClick={() => change(false)}>{t('Cancel')}</UiButton>
            <UiButton type="button" loading={saving} onClick={make}>{t('Make new codes')}</UiButton>
          </>}>
        {codes ? <RecoveryCodes codes={codes} /> : error && <UiAlert tone="danger">{t(error)}</UiAlert>}
      </UiDialog>
    </app-recovery-codes-dialog>
  );
}
