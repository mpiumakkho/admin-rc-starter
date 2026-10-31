/* Small building blocks the back office's pages share; their look is in shell/backoffice.scss, under .backoffice */
import type { ReactNode } from 'react';

import { lucideX } from '../../icons';
import { NgIcon, UiButton } from '../../user-management/ui';
import { MODULES, type Module } from '../data/types';
import { useBoI18n } from '../i18n/bo-i18n';

/** The head of a page: its name, where its data comes from and how fresh it is, and its actions on the right */
export function PageHead({ heading, source, freshness, children }: { heading: string; source?: string; freshness?: string; children?: ReactNode }) {
  const { tx } = useBoI18n();
  return (
    <div className="page-head">
      <div className="title-block">
        <h1>{tx(heading)}</h1>
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
