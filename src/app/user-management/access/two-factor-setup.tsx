import { useState } from 'react';
import { useNavigate } from 'react-router';

import { lucideLogOut, lucideShieldCheck } from '../../icons';
import { adminStore } from '../data/admin-store';
import { useFormat } from '../shared/formatting';
import { NgIcon, UiButton, UiCard, UiEmptyState } from '../ui';
import { session as sessionService, useSession } from './session';
import { TwoFactorDialog } from './two-factor-dialog';
import './two-factor-setup.scss';

/**
 * Where someone lands whose role requires two-step sign-in while it is off (API.md, "Roles that must use two-step
 * sign-in"). Nothing else opens until they turn it on; then the data loads in full and they go on to their first page.
 */
export function TwoFactorSetupComponent() {
  const session = useSession();
  const { t } = useFormat();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  /** After the dialog closes: if two-step sign-in is now on, everything loads and the person goes on */
  const proceed = async () => {
    await adminStore.load().catch(() => undefined);
    if (!adminStore.state.twoFactorSetupRequired) {
      await navigate(sessionService.view.homeUrl());
    }
  };

  return (
    <app-two-factor-setup>
      <div className="setup">
        <UiCard>
          <UiEmptyState icon={lucideShieldCheck} title={t('Turn on two-step sign-in to continue')}
            description={t('twoFactorRequiredHint', { role: session.role?.name ?? '' })}>
            <UiButton variant="secondary" type="button" onClick={() => void sessionService.signOut()}><NgIcon svg={lucideLogOut} />{` ${t('Sign out')} `}</UiButton>
            <UiButton type="button" onClick={() => setOpen(true)}>{t('Turn on')}</UiButton>
          </UiEmptyState>
        </UiCard>
      </div>
      <TwoFactorDialog mode="enable" open={open} onOpenChange={next => {
        setOpen(next);
        if (!next) {
          void proceed();
        }
      }} />
    </app-two-factor-setup>
  );
}
