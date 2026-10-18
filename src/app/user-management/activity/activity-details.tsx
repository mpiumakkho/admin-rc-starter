import { Link } from 'react-router';

import { lucideCopy, lucideMonitor, lucideSmartphone } from '../../icons';
import { useAdmin } from '../data/admin-store';
import { ACTIVITY_KINDS, ACTIVITY_META } from '../data/catalog';
import type { Activity } from '../data/models';
import { ActivityText } from '../shared/activity-text';
import { useFormat } from '../shared/formatting';
import { NgIcon, uiTableClass, uiToast, UiBadge, UiButton, UiDetailItem, UiDetailList, UiIconChip, UiPerson } from '../ui';
import './activity-details.scss';
import { useActivityFormat, type ActivityTarget } from './activity-format';

type ChangeKind = 'value' | 'list' | 'tone' | 'changed';

/** Where an activity target opens, for a link */
export function targetTo(target: ActivityTarget) {
  return { pathname: target.link.join('/'), search: target.queryParams ? `?${new URLSearchParams(target.queryParams)}` : '' };
}

/** Everything recorded about one activity entry: who, what, where from, and each field it changed */
export function ActivityDetails({ entry }: { entry: Activity }) {
  const store = useAdmin();
  const format = useActivityFormat();
  const f = useFormat();

  const meta = ACTIVITY_META[entry.action];
  const kind = ACTIVITY_KINDS[meta.kind];
  const actor = store.usersById.get(entry.actorId ?? '');
  const actorName = format.actorName(entry);
  const action = format.action(entry);
  const target = format.target(entry);
  const deviceIcon = format.isMobile(entry) ? lucideSmartphone : lucideMonitor;

  const changes = (entry.changes ?? []).map(change => {
    const changeKind: ChangeKind = change.added || change.removed ? 'list'
      : change.field === 'tone' ? 'tone'
      : change.field === 'avatar' || (change.from === undefined && change.to === undefined) ? 'changed'
      : 'value';
    return {
      field: change.field,
      label: format.field(change),
      kind: changeKind,
      from: format.value(change.field, change.from),
      to: format.value(change.field, change.to),
      rawFrom: change.from,
      rawTo: change.to,
      added: (change.added ?? []).map(key => format.listItem(change.field, key)),
      removed: (change.removed ?? []).map(key => format.listItem(change.field, key)),
    };
  });

  /** Shown instead of the change table when nothing was changed */
  const noChanges = entry.action === 'user.password_reset' ? 'Reset link sent by email'
    // An invitation logged without changes is one sent again
    : entry.action === 'user.invited' ? 'Invitation sent again by email.'
    : entry.action === 'auth.sign_in' ? 'Signed in. No data was changed.'
    : 'No changes were recorded.';

  /** The id, for quoting the entry to someone or finding it in the server's logs */
  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(entry.id);
      uiToast.show(f.t('Event reference copied.'));
    } catch {
      uiToast.show(f.t('Could not copy to the clipboard.'), 'error');
    }
  };

  return (
    <app-activity-details>
      <div className="event">
        <UiIconChip icon={meta.icon} tone={meta.tone} />
        <div className="event-text">
          <p className="event-sentence"><ActivityText entry={entry} /></p>
          <p className="event-time">{`${f.localDate(entry.at, 'full')} · ${f.timeAgo(entry.at)}`}</p>
        </div>
      </div>

      <UiDetailList columns={2}>
        <UiDetailItem label={f.t('Done by')}>
          {actor
            ? <Link className="person-link" to={`/users/${actor.id}`}><UiPerson name={actorName} detail={actor.email} src={actor.avatar} size="xs" /></Link>
            : <span className="muted">{actorName}</span>}
        </UiDetailItem>
        <UiDetailItem label={f.t('Target')}>
          {entry.action === 'auth.sign_in'
            ? <span className="muted">—</span>
            : target
              ? <Link to={targetTo(target)}>{target.label ? f.t(target.label) : f.localName(entry.targetLabel)}</Link>
              : <>{` ${f.localName(entry.targetLabel)} `}<span className="muted">{`(${f.t('deleted')})`}</span></>}
        </UiDetailItem>
        <UiDetailItem label={f.t('Action')}>
          <UiBadge tone={meta.tone}>{action}</UiBadge>
        </UiDetailItem>
        <UiDetailItem label={f.t('Type')}>{f.t(kind)}</UiDetailItem>
        {entry.reason && <UiDetailItem className="event-reason" label={f.t('Reason')}>{entry.reason}</UiDetailItem>}
        {entry.ip && (
          <>
            <UiDetailItem label={f.t('IP address')} labelTitle={f.t('abbr.ip')}><code className="mono">{entry.ip}</code></UiDetailItem>
            <UiDetailItem label={f.t('Device')}>
              <span className="device"><NgIcon svg={deviceIcon} />{` ${entry.browser} · ${entry.os}`}</span>
            </UiDetailItem>
          </>
        )}
        <UiDetailItem label={f.t('Event reference')}>
          <span className="event-id">
            <code className="mono">{entry.id}</code>
            <UiButton variant="ghost" size="sm" iconOnly type="button" aria-label={f.t('Copy event reference')} title={f.t('Copy event reference')} onClick={copyId}>
              <NgIcon svg={lucideCopy} />
            </UiButton>
          </span>
        </UiDetailItem>
      </UiDetailList>

      <h3 className="changes-title">{f.t('Changes')}</h3>
      {changes.length ? (
        <div className="ui-table-scroll changes-scroll">
          <table className={`${uiTableClass()} changes`}>
            <thead>
              <tr>
                <th>{f.t('Field')}</th>
                <th>{f.t('Before')}</th>
                <th>{f.t('After')}</th>
              </tr>
            </thead>
            <tbody>
              {changes.map(change => (
                <tr key={change.field}>
                  <td className="field">{change.label}</td>
                  {change.kind === 'list' ? (
                    <>
                      <td>
                        <div className="chips">
                          {change.removed.length
                            ? change.removed.map(label => <UiBadge key={label} tone="danger">{`− ${label}`}</UiBadge>)
                            : <span className="muted">—</span>}
                        </div>
                      </td>
                      <td>
                        <div className="chips">
                          {change.added.length
                            ? change.added.map(label => <UiBadge key={label} tone="success">{`+ ${label}`}</UiBadge>)
                            : <span className="muted">—</span>}
                        </div>
                      </td>
                    </>
                  ) : change.kind === 'tone' ? (
                    <>
                      <td><span className="swatch" style={{ background: `var(--ui-${change.rawFrom})` }}></span></td>
                      <td><span className="swatch" style={{ background: `var(--ui-${change.rawTo})` }}></span></td>
                    </>
                  ) : change.kind === 'changed' ? (
                    <td colSpan={2} className="muted">{f.t('Changed')}</td>
                  ) : (
                    <>
                      <td className="before">{change.from}</td>
                      <td className="after">{change.to}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="no-changes">{f.t(noChanges)}</p>}
    </app-activity-details>
  );
}
