/* Small building blocks the back office's pages share; their look is in shell/backoffice.scss, under .backoffice */
import type { ReactNode } from 'react';
import { useLocation } from 'react-router';

import { lucideChevronRight, lucideX } from '../../icons';
import { NgIcon, UiButton } from '../../user-management/ui';
import { MODULES, type Module } from '../data/types';
import { useBoI18n } from '../i18n/bo-i18n';
import { BACKOFFICE_NAV } from '../shell/nav';

/** The menu group a page is under, by the longest menu path its address starts with */
function groupOf(url: string) {
  let best: { group: (typeof BACKOFFICE_NAV)[number]; length: number } | undefined;
  for (const group of BACKOFFICE_NAV) {
    for (const link of group.links) {
      if ((url === link.path || url.startsWith(link.path + '/')) && link.path.length > (best?.length ?? 0)) {
        best = { group, length: link.path.length };
      }
    }
  }
  return best?.group;
}

/** The head of a page, as the admin's: its menu group's icon, the group leading into its name, where its data comes from and how fresh it is, and its actions on the right */
export function PageHead({ heading, source, freshness, children }: { heading: string; source?: string; freshness?: string; children?: ReactNode }) {
  const { tx } = useBoI18n();
  const group = groupOf(useLocation().pathname);
  return (
    <div className="page-head">
      {group && <span className="page-icon" aria-hidden="true"><NgIcon svg={group.icon} /></span>}
      <div className="title-block">
        <div className="title-row">
          {group && (
            <nav className="crumbs" aria-label={tx('เส้นทาง')}><span>{tx(group.label)}</span><NgIcon svg={lucideChevronRight} className="crumb-separator" aria-hidden="true" /></nav>
          )}
          <h1>{tx(heading)}</h1>
        </div>
        <div className="subtitle">
          {source && <span>{tx(source)}</span>}
          {freshness && <span className="freshness">{tx(freshness)}</span>}
        </div>
      </div>
      <div className="page-actions">{children}</div>
    </div>
  );
}

/** A module's tag: its code and name */
export function ModuleTag({ code }: { code: Module }) {
  const { tx } = useBoI18n();
  return <span className="module-tag" title={tx(MODULES[code].name)}><b>{code}</b> {tx(MODULES[code].name)}</span>;
}

/** The inspector beside a table: the record picked from it, with its actions; Escape or the button closes it */
export function Drawer({ heading, sub, onClosed, children, foot }: { heading: string; sub?: string; onClosed: () => void; children?: ReactNode; foot?: ReactNode }) {
  const { tx } = useBoI18n();
  return (
    <aside className="drawer" aria-label={tx(heading)} onKeyDown={event => { if (event.key === 'Escape') { onClosed(); } }}>
      <div className="drawer-head">
        <div>
          <h2>{tx(heading)}</h2>
          {sub && <div className="secondary">{tx(sub)}</div>}
        </div>
        <UiButton variant="ghost" size="sm" type="button" aria-label={tx('ปิด')} onClick={onClosed}><NgIcon svg={lucideX} aria-hidden="true" /></UiButton>
      </div>
      <div className="drawer-body">{children}</div>
      <div className="drawer-foot">{foot}</div>
    </aside>
  );
}
