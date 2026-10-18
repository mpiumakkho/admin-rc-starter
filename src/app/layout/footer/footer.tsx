import { useTranslation } from 'react-i18next';

import './footer.scss';

const year = new Date().getFullYear();

export function Footer() {
  const { t } = useTranslation();
  return (
    <app-footer>
      <footer className="footer">
        <div className="footer-content">
          <span>{`Copyright © ${year} Admin Dashboard`}</span>
          <span>{t('All rights reserved.')}</span>
        </div>
      </footer>
    </app-footer>
  );
}
