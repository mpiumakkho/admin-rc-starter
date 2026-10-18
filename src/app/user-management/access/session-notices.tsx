import { adminStore, useAdmin } from '../data/admin-store';
import { useFormat } from '../shared/formatting';
import { cx, useUiAccessibleView, UiAlert, UiButton, UiLinkButton } from '../ui';
import { TWO_FACTOR_SETUP_PATH, useSession } from './session';
import './session-notices.scss';

/**
 * What the accessible view tells rather than does by itself (WCAG 2.2.4, 3.2.5): that changes made elsewhere are
 * waiting, and that the role now requires two-step sign-in. Each waits for a button; nothing moves until then.
 *
 * Place one above the page content in the app shell.
 */
export function SessionNotices() {
  const store = useAdmin();
  const session = useSession();
  const accessible = useUiAccessibleView(state => state.on);
  const { t } = useFormat();
  /** In the usual view, Session opens the setup page at once */
  const setupRequired = session.twoFactorSetupRequired && accessible;
  return (
    <app-session-notices className={cx((store.changesWaiting || setupRequired) && 'has-notices')}>
      {store.changesWaiting && (
        <UiAlert tone="info" title={t('Newer changes are waiting')}
          actions={<UiButton variant="secondary" size="sm" type="button" onClick={() => void adminStore.showChanges()}>{t('Show the changes')}</UiButton>}>
          {` ${t('changesWaiting')} `}
        </UiAlert>
      )}
      {setupRequired && (
        <UiAlert tone="warning" title={t('Turn on two-step sign-in')}
          actions={<UiLinkButton size="sm" to={TWO_FACTOR_SETUP_PATH}>{t('Set it up')}</UiLinkButton>}>
          {` ${t('Your role requires two-step sign-in. Turn it on to continue.')} `}
        </UiAlert>
      )}
    </app-session-notices>
  );
}
