import { useAdmin } from '../data/admin-store';
import { ACTIVITY_META } from '../data/catalog';
import { fullName, type Activity } from '../data/models';
import { useFormat } from './formatting';
import './activity-text.scss';

// Placeholders handed to the translation, then swapped for the names. Names are inserted as text,
// never as HTML, because they come from user data.
const TOKENS = { actor: '{actor}', target: '{target}' };

/** One activity entry as a sentence, such as "Henry Klein suspended Jane Doe", with the names in bold */
export function ActivityText({ entry }: { entry: Activity }) {
  const store = useAdmin();
  const f = useFormat();
  const user = store.usersById.get(entry.actorId ?? '');
  const actor = user ? fullName(user) : entry.actorId === null ? f.t('System') : '—';
  const parts = f.t(ACTIVITY_META[entry.action].message, TOKENS).split(/(\{actor\}|\{target\})/).filter(Boolean);
  return (
    <app-activity-text>
      {parts.map((part, index) => part === TOKENS.actor
        ? <b key={index}>{actor}</b>
        : part === TOKENS.target ? <b key={index}>{f.localName(entry.targetLabel)}</b> : ` ${part} `)}
    </app-activity-text>
  );
}
