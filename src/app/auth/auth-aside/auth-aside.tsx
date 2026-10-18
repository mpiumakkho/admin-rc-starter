import { useTranslation } from 'react-i18next';

import { lucideHistory, lucideShieldCheck, lucideUsers } from '../../icons';
import { NgIcon } from '../../user-management/ui';
import './auth-aside.scss';

const year = new Date().getFullYear();

/**
 * Brand panel beside the sign-in form. Hidden on small screens.
 */
export function AuthAside() {
  const { t } = useTranslation();
  return (
    <app-auth-aside>
      <img src="assets/images/logo.svg" alt="logo" className="auth-aside-logo" />
      <div className="auth-aside-body">
        <h2 className="auth-aside-title">{t('Manage your users, roles and permissions in one place.')}</h2>
        <ul className="auth-points">
          <li><span className="auth-point-icon"><NgIcon svg={lucideUsers} /></span>{t('Add, invite and suspend users')}</li>
          <li><span className="auth-point-icon"><NgIcon svg={lucideShieldCheck} /></span>{t('Decide what each role can do')}</li>
          <li><span className="auth-point-icon"><NgIcon svg={lucideHistory} /></span>{t('See every change in the activity log')}</li>
        </ul>
      </div>
      <p className="auth-aside-footer">{`© ${year} Admin Dashboard`}</p>
    </app-auth-aside>
  );
}
