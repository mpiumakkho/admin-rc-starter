import { useNavigate } from 'react-router';

import { lucideArrowLeft, lucideShieldOff } from '../../icons';
import { useFormat } from '../shared/formatting';
import { NgIcon, UiButton, UiCard, UiEmptyState, UiLinkButton } from '../ui';
import { useSession } from './session';

/** Shown in place of a page the signed-in user's role does not allow; the guards in guards.ts send people here */
export function NoAccessComponent() {
  const session = useSession();
  const { t } = useFormat();
  const navigate = useNavigate();
  return (
    <app-no-access>
      <UiCard>
        <UiEmptyState icon={lucideShieldOff} title={t("You don't have access to this page")}
          description={t('noAccessHint', { role: session.role?.name ?? '' })}>
          <UiButton variant="secondary" type="button" onClick={() => void navigate(-1)}><NgIcon svg={lucideArrowLeft} />{` ${t('Go back')} `}</UiButton>
          <UiLinkButton to={session.homeUrl()}>{t('Go to home')}</UiLinkButton>
        </UiEmptyState>
      </UiCard>
    </app-no-access>
  );
}
