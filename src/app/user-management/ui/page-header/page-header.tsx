import { Fragment, type HTMLAttributes } from 'react';
import { Link } from 'react-router';

import { lucideChevronRight, lucideHouse } from '../../../icons';
import { cx, type UiIcon } from '../core/types';
import { NgIcon } from '../icon/icon';
import './page-header.scss';

export interface UiBreadcrumb {
  label: string;
  /** Link; leave out for the current page */
  link?: string;
}

export interface UiPageHeaderProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title: string;
  subtitle?: string;
  icon?: UiIcon;
  breadcrumbs?: UiBreadcrumb[];
  /** Screen reader name of the breadcrumb trail */
  breadcrumbLabel?: string;
  /** Link for a house icon at the start of the trail, for example '/'. Off by default: next to the page icon it reads as a second icon */
  homeLink?: string;
  homeLabel?: string;
}

/**
 * Top of a page: icon, title and description, with the breadcrumb trail leading into the title on the same
 * line (Users › Edit user) so it takes no extra row. Buttons placed inside appear on the right.
 *
 *   <UiPageHeader title="Users" subtitle="Everyone who can sign in" icon={lucideUsers} breadcrumbs={[{ label: 'Management' }]}>
 *     <UiButton>Add user</UiButton>
 *   </UiPageHeader>
 */
export function UiPageHeader({
  title, subtitle = '', icon, breadcrumbs = [], breadcrumbLabel = 'Breadcrumb', homeLink = '', homeLabel = 'Home', className, children, ...rest
}: UiPageHeaderProps) {
  return (
    <ui-page-header {...rest} className={cx('ui-page-header', className)}>
      <div className="ui-page-head-row">
        {icon && <span className="ui-page-head-icon"><NgIcon svg={icon} /></span>}
        <div className="ui-page-head-text">
          <div className="ui-page-head-title-row">
            {(breadcrumbs.length > 0 || homeLink) && (
              <nav className="ui-crumbs" aria-label={breadcrumbLabel}>
                {homeLink && (
                  <>
                    <Link to={homeLink} aria-label={homeLabel}><NgIcon svg={lucideHouse} /></Link>
                    <NgIcon svg={lucideChevronRight} className="ui-crumb-separator" />
                  </>
                )}
                {breadcrumbs.map((crumb, index) => (
                  <Fragment key={index}>
                    {crumb.link ? <Link to={crumb.link}>{crumb.label}</Link> : <span>{crumb.label}</span>}
                    <NgIcon svg={lucideChevronRight} className="ui-crumb-separator" />
                  </Fragment>
                ))}
              </nav>
            )}
            <h1 className="ui-page-head-title">{title}</h1>
          </div>
          {subtitle && <p className="ui-page-head-subtitle">{subtitle}</p>}
        </div>
        <div className="ui-page-head-actions">{children}</div>
      </div>
    </ui-page-header>
  );
}
