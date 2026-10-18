import { useTranslation } from 'react-i18next';

import { lucideAccessibility } from '../icons';
import { NgIcon, useUiAccessibleView } from '../user-management/ui';
import './accessible-view-switch.scss';

/**
 * Turns the accessible view on or off, on the pages without the navbar (signing in, the links in emails, the error
 * pages); signed in, the account menu does it. Every page must lead to the accessible view for it to count as AAA,
 * so this switch meets AAA itself in both views: 44 pixels tall, its text 7:1.
 */
export function AccessibleViewSwitch() {
  const { t } = useTranslation();
  const view = useUiAccessibleView();
  return (
    <app-accessible-view-switch>
      <button type="button" className="view-switch" role="switch" aria-checked={view.on} onClick={view.toggle}>
        <NgIcon svg={lucideAccessibility} aria-hidden="true" />
        {` ${t('Accessible view')} `}
        {/* The state is aria-checked for screen readers; the name stays the same as it changes */}
        <span className="view-switch-state" aria-hidden="true">{t(view.on ? 'On' : 'Off')}</span>
      </button>
    </app-accessible-view-switch>
  );
}
