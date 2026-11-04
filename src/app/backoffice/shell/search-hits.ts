/* What the bar's search finds: the back office's pages and the work waiting (ux/02: global search) */
import { lucideClipboardList } from '../../icons';
import type { UiIcon } from '../../user-management/ui';
import { BACKOFFICE_NAV } from './nav';

/** The most of each kind the list shows */
const EACH = 5;

export interface SearchHit {
  key: string;
  name: string;
  detail: string;
  icon: UiIcon;
  path: string;
}

/** Pages whose name or group has the text, then work whose title, kind, number or module has it; those starting with it first */
export function searchBackoffice(text: string, work: { id: string; title: string; kind: string; ref: string; module: string; link?: string }[], t: (s: string) => string): SearchHit[] {
  const query = text.trim().toLowerCase();
  if (!query) {
    return [];
  }
  const has = (...words: string[]) => words.some(word => word.toLowerCase().includes(query));
  const first = (a: SearchHit, b: SearchHit) => Number(!a.name.toLowerCase().startsWith(query)) - Number(!b.name.toLowerCase().startsWith(query));
  const pages = BACKOFFICE_NAV.flatMap(group => group.links
    .filter(link => has(link.label, t(link.label), group.label, t(group.label)))
    .map(link => ({ key: link.path, name: t(link.label), detail: t(group.label), icon: group.icon, path: link.path })))
    .sort(first)
    .slice(0, EACH);
  const tasks = work
    .filter(item => has(item.title, t(item.title), item.kind, t(item.kind), item.ref, item.module))
    .map(item => ({ key: item.id, name: t(item.title), detail: `${item.module} · ${t(item.kind)} · ${item.ref}`, icon: lucideClipboardList, path: item.link ?? '/backoffice/home/overview' }))
    .sort(first)
    .slice(0, EACH);
  return [...pages, ...tasks];
}
