import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import './error500.scss';

export function Error500Component() {
  const { t } = useTranslation();
  return (
    <app-error500>
      <div className="error-page server-error">
        <div className="error-content">
          <div className="error-message">
            <h1 className="error-code">500</h1>
            <div className="error-text">
              <h2>{t('Sorry!')}</h2>
              <h3>{t('Something went wrong on our side.')}</h3>
            </div>
          </div>
          <Link className="error-home" to="/">{t('Back to home')}</Link>
        </div>
      </div>
    </app-error500>
  );
}
