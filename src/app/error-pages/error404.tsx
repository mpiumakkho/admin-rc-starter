import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import './error404.scss';

export function Error404Component() {
  const { t } = useTranslation();
  return (
    <app-error404>
      <div className="error-page">
        <div className="error-content">
          <div className="error-message">
            <h1 className="error-code">404</h1>
            <div className="error-text">
              <h2>{t('Sorry!')}</h2>
              <h3>{t('The page you are looking for was not found.')}</h3>
            </div>
          </div>
          <Link className="error-home" to="/">{t('Back to home')}</Link>
        </div>
      </div>
    </app-error404>
  );
}
