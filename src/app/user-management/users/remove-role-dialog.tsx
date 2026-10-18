import { useLayoutEffect, useState } from 'react';

import { useSession } from '../access/session';
import { roleAssignmentState } from '../data/access-rules';
import { adminStore, useAdmin } from '../data/admin-store';
import type { User } from '../data/models';
import { errorMessage } from '../shared/errors';
import { useFormat } from '../shared/formatting';
import { MAX_REASON } from '../shared/reason-prompt';
import { cx, uiToast, UiButton, UiDialog, UiFormField } from '../ui';
import './remove-role-dialog.scss';

let nextId = 0;

export interface RemoveRoleDialogProps {
  users: User[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The roles changed; the list clears its selection */
  onDone?: () => void;
}

/**
 * Takes a role away from everyone selected on the users list: their current and scheduled assignments of it end now.
 * Only roles someone selected holds, and that the signed-in user may give, are offered. The reason goes to the activity
 * log, required when the settings say so (API.md, "Reasons").
 */
export function RemoveRoleDialog({ users, open, onOpenChange, onDone }: RemoveRoleDialogProps) {
  const store = useAdmin();
  const session = useSession();
  const { t } = useFormat();
  const [formId] = useState(() => `remove-role-${nextId++}`);
  const [saving, setSaving] = useState(false);
  const [role, setRole] = useState('');
  const [reason, setReason] = useState('');
  /** Sent without the reason the settings require */
  const [reasonMissing, setReasonMissing] = useState(false);

  const reasonRequired = store.settings.reasonsRequired.includes('removeRole');
  /** Roles someone selected holds now or later, in a scope where the signed-in user may take them away */
  const offered = store.roles.filter(item => users.some(user => user.roles.some(held => held.roleId === item.id
    && roleAssignmentState(held, store.now) !== 'expired' && session.canGive(item, held.branchId))));

  useLayoutEffect(() => {
    if (open) {
      setRole(offered[0]?.id ?? '');
      setReason('');
      setReasonMissing(false);
    }
  }, [open]);

  const save = async () => {
    const text = reason.trim();
    if (reasonRequired && !text) {
      setReasonMissing(true);
      return;
    }
    setSaving(true);
    try {
      const changed = await adminStore.assignRoles(users.map(user => user.id), { removeRoleId: role, ...(text ? { reason: text } : {}) });
      uiToast.show(t('toast.roleTaken', { count: changed.length }));
      onOpenChange(false);
      onDone?.();
    } catch (error) {
      uiToast.show(t(errorMessage(error)), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <app-remove-role-dialog>
      <UiDialog open={open} onOpenChange={onOpenChange} title={t('removeRoleCount', { count: users.length })}
        description={t('The role ends now for everyone selected who holds it.')} closeLabel={t('Close')}
        footer={<>
          <UiButton variant="secondary" type="button" onClick={() => onOpenChange(false)}>{t('Cancel')}</UiButton>
          <UiButton variant="danger" type="submit" form={formId} loading={saving} disabled={!role}>{t('Take role away')}</UiButton>
        </>}>
        <form id={formId} onSubmit={event => { event.preventDefault(); void save(); }} noValidate>
          <UiFormField label={t('Role')} for={`${formId}-role`}>
            <select className="ui-input" id={`${formId}-role`} value={role} onChange={event => setRole(event.target.value)}>
              {offered.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </UiFormField>
          <UiFormField className="remove-reason" label={t('Reason')} for={`${formId}-reason`} required={reasonRequired}
            optionalLabel={reasonRequired ? '' : t('(optional)')} error={reasonMissing ? t('Give a reason. The activity log keeps it.') : undefined}>
            <textarea className={cx('ui-input', reasonMissing && 'ng-invalid ng-touched')} id={`${formId}-reason`} rows={2} maxLength={MAX_REASON} value={reason}
              onChange={event => { setReason(event.target.value); setReasonMissing(false); }} />
          </UiFormField>
        </form>
      </UiDialog>
    </app-remove-role-dialog>
  );
}
