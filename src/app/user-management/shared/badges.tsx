import { lucideClock } from '../../icons';
import { roleAssignmentState } from '../data/access-rules';
import { useAdmin } from '../data/admin-store';
import { STATUS_META } from '../data/catalog';
import type { Role, User, UserStatus } from '../data/models';
import { NgIcon, UiBadge } from '../ui';
import './badges.scss';
import { useFormat } from './formatting';

/** A user's status as a colored badge */
export function StatusBadge({ status }: { status: UserStatus }) {
  const f = useFormat();
  const meta = STATUS_META[status];
  return <app-status-badge><UiBadge tone={meta.tone} dot>{f.t(meta.label)}</UiBadge></app-status-badge>;
}

/** A role's name in its color */
export function RoleBadge({ roleId }: { roleId: string }) {
  const store = useAdmin();
  const role = store.rolesById.get(roleId);
  return <app-role-badge>{role && <UiBadge tone={role.tone}>{role.name}</UiBadge>}</app-role-badge>;
}

export interface RoleBadgesProps {
  user: Pick<User, 'roles'>;
  /** How many to show before "+n" */
  max?: number;
  className?: string;
}

/**
 * The roles someone holds now, the ones with most permissions first, up to `max`, then "+2". A role held for a time
 * has a clock and says when it ends.
 */
export function RoleBadges({ user, max = 2, className }: RoleBadgesProps) {
  const store = useAdmin();
  const f = useFormat();
  const items = user.roles
    .filter(item => roleAssignmentState(item, store.now) === 'active')
    .map(item => ({ role: store.rolesById.get(item.roleId), endsAt: item.endsAt }))
    .filter((item): item is { role: Role; endsAt: string | null } => !!item.role)
    .sort((a, b) => b.role.permissions.length - a.role.permissions.length);
  const shown = items.slice(0, max);
  const rest = items.slice(max);
  const restNames = rest.map(item => item.role.name).join(', ');

  return (
    <app-role-badges className={className}>
      {shown.map(item => (
        <UiBadge key={item.role.id} tone={item.role.tone} title={item.endsAt ? f.t('untilDate', { date: f.localDate(item.endsAt) }) : undefined}>
          {` ${item.role.name} `}
          {item.endsAt && (
            <>
              <NgIcon className="role-badge-clock" svg={lucideClock} aria-hidden="true" />
              <span className="ui-sr-only">{f.t('untilDate', { date: f.localDate(item.endsAt) })}</span>
            </>
          )}
        </UiBadge>
      ))}
      {shown.length === 0 && <span className="role-badges-none">{f.t('No role')}</span>}
      {rest.length > 0 && (
        <UiBadge tone="neutral" title={restNames}><span aria-hidden="true">{`+${rest.length}`}</span><span className="ui-sr-only">{restNames}</span></UiBadge>
      )}
    </app-role-badges>
  );
}
