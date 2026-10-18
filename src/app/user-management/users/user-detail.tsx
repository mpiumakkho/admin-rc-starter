import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';

import {
  lucideArrowRight, lucideBan, lucideBuilding2, lucideCheck, lucideEllipsis, lucideHistory, lucideKeyRound, lucideLogOut, lucideMail, lucideMonitor,
  lucidePencil, lucidePhone, lucideShieldCheck, lucideShieldPlus, lucideSmartphone, lucideTrash2, lucideUserCheck, lucideUserRound, lucideUserX,
  lucideX,
} from '../../icons';
import { ChangePasswordDialog } from '../access/change-password-dialog';
import { RecoveryCodesDialog } from '../access/recovery-codes-dialog';
import { useSession } from '../access/session';
import { TwoFactorDialog } from '../access/two-factor-dialog';
import { activeRoleIds, permissionsOf, roleAssignmentState, type RoleAssignmentState } from '../data/access-rules';
import { adminStore, useAdmin } from '../data/admin-store';
import { ACTIVITY_META, EMAIL_LANGUAGES, PERMISSION_GROUPS } from '../data/catalog';
import { fullName, type Language, type Permission, type RoleAssignment, type UserSession, type UserStatus } from '../data/models';
import { ActivityText } from '../shared/activity-text';
import { RoleBadge, RoleBadges, StatusBadge } from '../shared/badges';
import { errorMessage } from '../shared/errors';
import { useFormat } from '../shared/formatting';
import { reasonPrompt } from '../shared/reason-prompt';
import {
  cx, NgIcon, uiConfirm, uiToast, UiAvatar, UiBadge, UiButton, UiCard, UiDetailItem, UiDetailList, UiEmptyState, UiLinkButton, UiMenu,
  UiMenuDivider, UiMenuItem, UiMenuTrigger, UiPageHeader, UiSegmented, UiTimeline, UiTimelineItem, type UiOption, type UiTone,
} from '../ui';
import { RoleAssignmentDialog } from './role-assignment-dialog';
import './user-detail.scss';

type Tab = 'details' | 'roles' | 'activity' | 'security';
const TABS: Tab[] = ['details', 'roles', 'activity', 'security'];
/** Older links name the roles tab by its earlier name */
const TAB_ALIASES: Record<string, Tab> = { permissions: 'roles' };

const STATE_LABELS: Record<RoleAssignmentState, string> = { active: 'Active', scheduled: 'Scheduled', expired: 'Ended' };
const STATE_TONES: Record<RoleAssignmentState, UiTone> = { active: 'success', scheduled: 'info', expired: 'neutral' };

/**
 * One person's profile: details, roles and permissions, activity and security. Fills the window on desktop (page-fit):
 * the tab's cards reach the bottom and scroll inside, as on the pages with tables.
 */
export function UserDetailComponent() {
  const store = useAdmin();
  const session = useSession();
  const f = useFormat();
  const { t } = f;
  const navigate = useNavigate();
  const id = useParams()['id'] ?? '';
  /** ?tab=security and so on, to open a tab from a link such as the account menu's */
  const tabParam = useSearchParams()[0].get('tab');

  const user = store.usersById.get(id);
  /** Every permission of the roles they hold now */
  const permissions = permissionsOf(user, store.roles, store.now);
  const name = user ? fullName(user) : '';
  const isSelf = id === session.userId;

  /* What the signed-in user's role allows for this person */

  /**
   * Nobody can change someone whose role allows more than their own; through a branch, only its people (API.md,
   * "Branch administrators")
   */
  const canEdit = !!user && session.canOn('users.edit', user);
  /** Everyone can edit their own name, phone and photo */
  const canEditProfile = !!user && session.canEditProfile(user);
  /** Nobody suspends or deletes themselves */
  const canSetStatus = canEdit && !isSelf;
  const canDelete = !!user && !isSelf && session.canOn('users.delete', user);
  /** The ⋯ menu: status, reset password and delete, none of which apply to yourself */
  const hasMenu = !isSelf && (canEdit || canDelete);
  const canViewActivity = session.canSomewhere('activity.view');
  /** Devices and two-step sign-in: your own, or, with users.edit, those of people you manage */
  const canSeeSecurity = isSelf || canEdit;
  /** Their role must use two-step sign-in (settings), so they cannot turn it off themselves */
  const twoFactorRequired = !!user && activeRoleIds(user, store.now).some(roleId => store.settings.twoFactorRoleIds.includes(roleId));

  /* Roles tab */

  /** Someone else's roles, when the signed-in user may manage them */
  const canChangeRoles = canEdit && !isSelf;
  /** Their assignments: the ones that count now, then scheduled, then ended, each newest first */
  const order: Record<RoleAssignmentState, number> = { active: 0, scheduled: 1, expired: 2 };
  const assignments = (user?.roles ?? [])
    .map(assignment => {
      const giver = assignment.assignedById ? store.usersById.get(assignment.assignedById) : undefined;
      const role = store.rolesById.get(assignment.roleId);
      return {
        assignment,
        state: roleAssignmentState(assignment, store.now),
        givenBy: giver ? fullName(giver) : '',
        canChange: canChangeRoles && session.canGive(role, assignment.branchId),
      };
    })
    .sort((a, b) => order[a.state] - order[b.state] || b.assignment.startsAt.localeCompare(a.assignment.startsAt));
  const [assigning, setAssigning] = useState(false);
  /** The assignment being changed, or null to give a new role */
  const [editing, setEditing] = useState<RoleAssignment | null>(null);

  /** Everything done by or to this person; the tab counts it all */
  const activity = store.activity.filter(entry => entry.actorId === id || entry.targetId === id);
  /** The latest thirty, scrolling inside the tab's card; the card links to the whole log for this person */
  const recentActivity = activity.slice(0, 30);

  const [tab, setTab] = useState<Tab>('details');
  const tabs: UiOption<Tab>[] = [
    { value: 'details', label: t('Details') },
    { value: 'roles', label: t('Roles & permissions'), count: store.activeRoles(user).length },
    ...canViewActivity ? [{ value: 'activity' as const, label: t('Activity'), count: activity.length }] : [],
    ...canSeeSecurity ? [{ value: 'security' as const, label: t('Security') }] : [],
  ];

  /* Security tab */

  /** Where they are signed in; loaded when the tab opens, and again when the data changes */
  const [sessions, setSessions] = useState<UserSession[] | null>(null);
  const [ending, setEnding] = useState<string | null>(null);
  const [twoFactorMode, setTwoFactorMode] = useState<'enable' | 'disable'>('enable');
  const [twoFactorOpen, setTwoFactorOpen] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  /** How many of your own recovery codes are left, with two-step sign-in on; null until loaded */
  const [recoveryCodesLeft, setRecoveryCodesLeft] = useState<number | null>(null);
  const [makingCodes, setMakingCodes] = useState(false);

  useLayoutEffect(() => {
    const param = tabParam ?? '';
    const wanted = (TAB_ALIASES[param] ?? param) as Tab;
    if (wanted && TABS.includes(wanted)) {
      setTab(wanted);
    }
  }, [tabParam]);

  const loadRecoveryCodesLeft = async () => {
    setRecoveryCodesLeft(await adminStore.recoveryCodesLeft().catch(() => null));
  };

  const currentId = useRef(id);
  currentId.current = id;
  const loadSessions = async (forId: string) => {
    try {
      const list = await adminStore.listSessions(forId);
      // Still the same person: the route may have moved on while this loaded
      if (forId === currentId.current) {
        setSessions(list);
      }
    } catch {
      setSessions([]);
    }
  };

  const twoFactor = user?.twoFactor;
  useEffect(() => {
    if (tab === 'security' && canSeeSecurity) {
      void loadSessions(id);
    }
    if (tab === 'security' && isSelf && twoFactor) {
      void loadRecoveryCodesLeft();
    }
  }, [id, store.revision, tab, canSeeSecurity, isSelf, twoFactor]);

  const isPhone = (device: UserSession) => device.os === 'iOS' || device.os === 'Android';

  const showError = (error: unknown) => uiToast.show(t(errorMessage(error)), 'error');

  const openTwoFactor = (mode: 'enable' | 'disable') => {
    setTwoFactorMode(mode);
    setTwoFactorOpen(true);
  };

  const resetTwoFactor = async () => {
    if (!user) {
      return;
    }
    const reason = await reasonPrompt.ask('resetSignIn', {
      title: t('resetTwoFactorTitle', { name: fullName(user) }),
      message: t('Use this when they lose their phone. They can sign in with just their password until they turn it on again.'),
      confirmLabel: t('Turn off'),
      tone: 'danger',
    });
    if (reason !== null) {
      try {
        await adminStore.resetTwoFactor(user.id, reason || undefined);
        uiToast.show(t('Two-step sign-in is off.'));
      } catch (error) {
        showError(error);
      }
    }
  };

  const endSession = async (device: UserSession) => {
    // Someone else's needs a reason when the settings say so; your own never does
    const reason = isSelf ? '' : await reasonPrompt.ask('endSessions', {
      title: t('endSessionTitle', { name, device: `${device.browser} · ${device.os}` }),
      message: t('They need to sign in again on that device.'),
      confirmLabel: t('Sign out'),
      tone: 'danger',
    }, true);
    if (reason === null) {
      return;
    }
    setEnding(device.id);
    try {
      await adminStore.endSession(device.id, reason || undefined);
      uiToast.show(t('Signed out of that device.'));
      await loadSessions(id);
    } catch (error) {
      showError(error);
    } finally {
      setEnding(null);
    }
  };

  const endOtherSessions = async () => {
    const options = {
      title: t(isSelf ? 'Sign out of all other devices?' : 'endAllSessionsTitle', { name }),
      message: t(isSelf ? 'You stay signed in here.' : 'They need to sign in again everywhere.'),
      confirmLabel: t('Sign out'),
      cancelLabel: t('Cancel'),
      tone: 'danger' as const,
    };
    // Your own devices need no reason
    const reason = isSelf ? (await uiConfirm.ask(options) ? '' : null) : await reasonPrompt.ask('endSessions', options);
    if (reason === null) {
      return;
    }
    setEnding('all');
    try {
      await adminStore.endSessions(id, reason || undefined);
      uiToast.show(t(isSelf ? 'Signed out of your other devices.' : 'Signed out everywhere.'));
      await loadSessions(id);
    } catch (error) {
      showError(error);
    } finally {
      setEnding(null);
    }
  };

  const granted = (permission: Permission) => permissions.has(permission);

  /** Which of their roles grant a permission, when they hold more than one */
  const sources = (permission: Permission): string => {
    const roles = store.activeRoles(user);
    return roles.length > 1 ? roles.filter(role => role.permissions.includes(permission)).map(role => role.name).join(', ') : '';
  };

  const branchName = (branchId: string | null) => branchId ? store.branchesById.get(branchId)?.name ?? '' : '';

  /** The language of their emails, by its own name; until known, the settings' one */
  const languageName = (language: Language | null) => {
    const fallback = EMAIL_LANGUAGES[store.settings.defaultLanguage];
    return language ? EMAIL_LANGUAGES[language] : t('sameAsSettings', { language: fallback });
  };

  const roleName = (roleId: string) => store.rolesById.get(roleId)?.name ?? '';

  const giveRole = () => {
    setEditing(null);
    setAssigning(true);
  };

  const changeAssignment = (assignment: RoleAssignment) => {
    setEditing(assignment);
    setAssigning(true);
  };

  const removeAssignment = async (assignment: RoleAssignment) => {
    if (!user) {
      return;
    }
    const reason = await reasonPrompt.ask('removeRole', {
      title: t('removeRoleTitle', { role: roleName(assignment.roleId), name: fullName(user) }),
      message: t('It ends now. The activity log keeps a record of it.'),
      confirmLabel: t('Take away'),
      tone: 'danger',
    });
    if (reason === null) {
      return;
    }
    try {
      await adminStore.removeRoleAssignment(assignment.id, reason || undefined);
      uiToast.show(t('Role taken away.'));
    } catch (error) {
      showError(error);
    }
  };

  const setStatus = async (status: UserStatus) => {
    if (!user) {
      return;
    }
    const suspend = status === 'suspended';
    const reason = await reasonPrompt.ask('status', {
      title: t(suspend ? 'confirm.suspendUser' : 'confirm.activateUser', { name: fullName(user) }),
      message: t(suspend ? 'They are signed out and cannot sign in until reactivated.' : 'They can sign in again.'),
      confirmLabel: t(suspend ? 'Suspend' : 'Activate'),
      tone: suspend ? 'danger' : 'primary',
    }, true);
    if (reason === null) {
      return;
    }
    try {
      await adminStore.setUserStatus([user.id], status, reason || undefined);
      uiToast.show(t(suspend ? 'toast.suspended' : 'toast.activated', { count: 1 }));
    } catch (error) {
      showError(error);
    }
  };

  const resetPassword = async () => {
    if (!user) {
      return;
    }
    // Someone else's needs a reason when the settings say so
    const reason = isSelf ? '' : await reasonPrompt.ask('resetSignIn', {
      title: t('confirm.resetPassword', { name: fullName(user) }),
      message: t('Their password stops working and they get an email to set a new one.'),
      confirmLabel: t('Reset password'),
      tone: 'danger',
    }, true);
    if (reason === null) {
      return;
    }
    try {
      await adminStore.resetPassword(user.id, reason || undefined);
      uiToast.show(t('toast.passwordReset', { email: user.email }), 'info');
    } catch (error) {
      showError(error);
    }
  };

  const remove = async () => {
    if (!user || isSelf) {
      return;
    }
    const reason = await reasonPrompt.ask('delete', {
      title: t('confirm.deleteUser', { name: fullName(user) }),
      message: t('They lose access right away. This cannot be undone.'),
      confirmLabel: t('Delete'),
      tone: 'danger',
    });
    if (reason === null) {
      return;
    }
    try {
      await adminStore.deleteUsers([user.id], reason || undefined);
      uiToast.show(t('toast.deleted', { count: 1 }));
      void navigate('/users');
    } catch (error) {
      showError(error);
    }
  };

  if (!user) {
    return (
      <app-user-detail className="page-fit">
        <UiCard>
          <UiEmptyState icon={lucideUserX} title={t('User not found')} description={t('They may have been deleted.')}>
            <UiLinkButton variant="secondary" to="/users">{t('Back to users')}</UiLinkButton>
          </UiEmptyState>
        </UiCard>
      </app-user-detail>
    );
  }

  const branch = store.branchesEnabled ? branchName(user.branchId) : '';
  const sessionCount = sessions?.length ?? 0;

  return (
    <app-user-detail className="page-fit">
      <UiPageHeader title={name} subtitle={t('User profile')} icon={lucideUserRound} breadcrumbLabel={t('Breadcrumb')}
        breadcrumbs={session.canSomewhere('users.view') ? [{ label: t('Users'), link: '/users' }] : []} />

      <UiCard className="profile">
        <div className="profile-row">
          <UiAvatar name={name} src={user.avatar} size="xl" />
          <div className="profile-text">
            <h2 className="profile-name">
              {` ${name} `}
              {isSelf && <span className="you">{t('You')}</span>}
            </h2>
            <div className="profile-meta">
              <span><NgIcon svg={lucideMail} />{` ${user.email}`}</span>
              {user.phone && <span><NgIcon svg={lucidePhone} />{` ${user.phone}`}</span>}
              {branch && <span><NgIcon svg={lucideBuilding2} /><span className="ui-sr-only">{`${t('Branch')}: `}</span>{branch}</span>}
            </div>
            <div className="profile-badges">
              <RoleBadges user={user} max={3} />
              <StatusBadge status={user.status} />
              <span className="since">{`${t('Member since')} ${f.localDate(user.createdAt)}`}</span>
            </div>
          </div>
          {(canEditProfile || hasMenu) && (
            <div className="profile-actions">
              {canEditProfile && (
                <UiLinkButton variant="secondary" to={`/users/${user.id}/edit`}><NgIcon svg={lucidePencil} />{` ${t(isSelf ? 'Edit profile' : 'Edit')}`}</UiLinkButton>
              )}
              {hasMenu && (
                <UiMenuTrigger menu={
                  <UiMenu>
                    {canSetStatus && (user.status === 'suspended'
                      ? <UiMenuItem icon={lucideUserCheck} onTriggered={() => void setStatus('active')}>{t('Activate')}</UiMenuItem>
                      : <UiMenuItem icon={lucideBan} onTriggered={() => void setStatus('suspended')}>{t('Suspend')}</UiMenuItem>)}
                    {canEdit && !isSelf && <UiMenuItem icon={lucideKeyRound} onTriggered={() => void resetPassword()}>{t('Reset password')}</UiMenuItem>}
                    {canDelete && (
                      <>
                        <UiMenuDivider />
                        <UiMenuItem tone="danger" icon={lucideTrash2} onTriggered={() => void remove()}>{t('Delete user')}</UiMenuItem>
                      </>
                    )}
                  </UiMenu>
                }>
                  <UiButton variant="secondary" iconOnly type="button" aria-label={t('More actions')}>
                    <NgIcon svg={lucideEllipsis} />
                  </UiButton>
                </UiMenuTrigger>
              )}
            </div>
          )}
        </div>
        <UiSegmented className="tabs" variant="underline" options={tabs} value={tab} onValueChange={setTab} ariaLabel={t('Sections')} />
      </UiCard>

      {/* On a desktop the tab takes the rest of the window and its cards reach the bottom, as on the pages with tables.
          Each tab fades in where the last one was (ui-enter-fade) */}
      <div className="tab-panel">
        {tab === 'details' && (
          <UiCard key="details" fill title={t('Details')} className="ui-enter-fade">
            <UiDetailList className="details" columns={2}>
              <UiDetailItem label={t('Full name')}>{name}</UiDetailItem>
              <UiDetailItem label={t('Email')}>{user.email}</UiDetailItem>
              <UiDetailItem label={t('Phone')}>{user.phone || '—'}</UiDetailItem>
              <UiDetailItem label={t('Department')}>{t(user.department)}</UiDetailItem>
              <UiDetailItem label={t('Email language')}>{languageName(user.language)}</UiDetailItem>
              {store.branchesEnabled && <UiDetailItem label={t('Branch')}>{branchName(user.branchId) || t('No branch')}</UiDetailItem>}
              <UiDetailItem label={t('Roles')}><RoleBadges user={user} max={6} /></UiDetailItem>
              <UiDetailItem label={t('Status')}><StatusBadge status={user.status} /></UiDetailItem>
              <UiDetailItem label={t('Joined')}>{f.localDate(user.createdAt, 'datetime')}</UiDetailItem>
              <UiDetailItem label={t('Last active')}>{f.timeAgo(user.lastActiveAt, t('Never'))}</UiDetailItem>
              <UiDetailItem label={t('Two-step sign-in')}>
                <UiBadge tone={user.twoFactor ? 'success' : 'neutral'}>{t(user.twoFactor ? 'On' : 'Off')}</UiBadge>
              </UiDetailItem>
              <UiDetailItem label={t('User reference')}><code className="code">{user.id}</code></UiDetailItem>
            </UiDetailList>
          </UiCard>
        )}
        {tab === 'roles' && (
          <>
            <div key="roles" className="roles-tab ui-enter-fade">
              <UiCard fill title={t('Roles')} description={t('What they hold, from when and until when.')} actions={canChangeRoles && (
                <UiButton variant="secondary" size="sm" type="button" onClick={giveRole}><NgIcon svg={lucideShieldPlus} />{` ${t('Give role')}`}</UiButton>
              )}>
                {assignments.length ? (
                  <ul className="assignments">
                    {assignments.map(item => (
                      <li key={item.assignment.id} className={cx('assignment', item.state === 'expired' && 'assignment-expired')}>
                        <div className="assignment-main">
                          <RoleBadge roleId={item.assignment.roleId} />
                          <UiBadge tone={STATE_TONES[item.state]} dot>{t(STATE_LABELS[item.state])}</UiBadge>
                          {store.branchesEnabled && (
                            <span className="assignment-scope">
                              <NgIcon svg={lucideBuilding2} />
                              {` ${item.assignment.branchId ? branchName(item.assignment.branchId) : t('Whole organization')}`}
                            </span>
                          )}
                          <span className="assignment-period">
                            {` ${t(item.state === 'scheduled' ? 'fromDate' : 'sinceDate', { date: f.localDate(item.assignment.startsAt) })} `}
                            {' · '}
                            {item.assignment.endsAt
                              ? ` ${t(item.state === 'expired' ? 'endedOn' : 'untilDate', { date: f.localDate(item.assignment.endsAt) })} `
                              : ` ${t('For good')} `}
                          </span>
                        </div>
                        {(item.assignment.reason || item.givenBy) && (
                          <p className="assignment-meta">
                            {item.assignment.reason && <span>{item.assignment.reason}</span>}
                            {item.givenBy && <span>{t('givenBy', { name: item.givenBy })}</span>}
                          </p>
                        )}
                        {item.canChange && (
                          <div className="assignment-actions">
                            <UiButton variant="ghost" size="sm" type="button" onClick={() => changeAssignment(item.assignment)}>
                              {` ${t(item.state === 'expired' ? 'Renew' : 'Change end')}`}<span className="ui-sr-only">{` ${roleName(item.assignment.roleId)}`}</span>
                            </UiButton>
                            {item.state !== 'expired' && (
                              <UiButton variant="ghost" size="sm" type="button" onClick={() => void removeAssignment(item.assignment)}>
                                {` ${t('Take away')}`}<span className="ui-sr-only">{` ${roleName(item.assignment.roleId)}`}</span>
                              </UiButton>
                            )}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <UiEmptyState compact icon={lucideShieldCheck} title={t('No role')} description={t('They can sign in and see their own profile only.')} />
                )}
              </UiCard>
              <UiCard fill title={t('Permissions')} description={t('Everything the roles they hold now allow, together.')} actions={session.can('roles.view') && (
                <UiLinkButton variant="ghost" size="sm" to="/roles"><NgIcon svg={lucideShieldCheck} />{` ${t('Roles & permissions')}`}</UiLinkButton>
              )}>
                <div className="permission-groups">
                  {PERMISSION_GROUPS.map(group => (
                    <div key={group.key} className="permission-group">
                      <p className="permission-group-title">{t(group.label)}</p>
                      <ul>
                        {group.permissions.map(permission => {
                          const from = sources(permission.key);
                          return (
                            <li key={permission.key} className={cx(!granted(permission.key) && 'denied')}>
                              <NgIcon svg={granted(permission.key) ? lucideCheck : lucideX} />
                              <span>
                                {` ${t(permission.label)} `}
                                {from && <span className="permission-source">{from}</span>}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              </UiCard>
            </div>
            {canChangeRoles && <RoleAssignmentDialog users={[user]} assignment={editing} open={assigning} onOpenChange={setAssigning} />}
          </>
        )}
        {tab === 'activity' && (
          <UiCard key="activity" fill className="ui-enter-fade" title={t('Activity')} description={t('Changes made by or to this user')} actions={
            <UiLinkButton variant="ghost" size="sm" to={`/activity?user=${encodeURIComponent(user.id)}`}>{`${t('View in activity log')} `}<NgIcon svg={lucideArrowRight} /></UiLinkButton>
          }>
            {activity.length ? (
              <UiTimeline>
                {recentActivity.map(entry => (
                  <UiTimelineItem key={entry.id} icon={ACTIVITY_META[entry.action].icon} tone={ACTIVITY_META[entry.action].tone} time={f.timeAgo(entry.at)}>
                    <ActivityText entry={entry} />
                    {entry.reason && <span className="activity-reason">{`“${entry.reason}”`}</span>}
                  </UiTimelineItem>
                ))}
              </UiTimeline>
            ) : (
              <UiEmptyState compact icon={lucideHistory} title={t('No activity yet')} />
            )}
          </UiCard>
        )}
        {tab === 'security' && (
          <>
            <div key="security" className="security ui-enter-fade">
              <div className="security-cards">
                <UiCard title={t('Two-step sign-in')} description={t('A code from an authenticator app as well as the password.')}>
                  <div className="security-row">
                    <UiBadge tone={user.twoFactor ? 'success' : 'neutral'}>{t(user.twoFactor ? 'On' : 'Off')}</UiBadge>
                    <span className="security-text">
                      {` ${t(user.twoFactor ? 'Signing in needs a code from their phone.' : 'Signing in needs only the password.')} `}
                    </span>
                    {isSelf ? (
                      user.twoFactor && twoFactorRequired ? <span className="security-note">{t('Your role requires it.')}</span>
                      : user.twoFactor ? <UiButton variant="secondary" size="sm" type="button" onClick={() => openTwoFactor('disable')}>{t('Turn off')}</UiButton>
                      : <UiButton size="sm" type="button" onClick={() => openTwoFactor('enable')}>{t('Turn on')}</UiButton>
                    ) : user.twoFactor && (
                      <UiButton variant="danger-soft" size="sm" type="button" onClick={() => void resetTwoFactor()}>{t('Turn off')}</UiButton>
                    )}
                  </div>
                  {/* Your recovery codes, for when you lose your phone */}
                  {isSelf && user.twoFactor && recoveryCodesLeft !== null && (
                    <div className="security-row recovery-row">
                      <span className={cx('security-text', !recoveryCodesLeft && 'security-warning')}>
                        {` ${t(recoveryCodesLeft ? 'recoveryCodesLeft' : 'No recovery codes left. Make new ones in case you lose your phone.', { count: recoveryCodesLeft })} `}
                      </span>
                      <UiButton variant="secondary" size="sm" type="button" onClick={() => setMakingCodes(true)}>{t('New recovery codes')}</UiButton>
                    </div>
                  )}
                </UiCard>

                {isSelf && (
                  <UiCard title={t('Password')} description={t('Changing it signs you out on your other devices.')}>
                    <div className="security-row">
                      <span className="security-text">{t('Use one you do not use anywhere else.')}</span>
                      <UiButton variant="secondary" size="sm" type="button" onClick={() => setChangingPassword(true)}>{t('Change password')}</UiButton>
                    </div>
                  </UiCard>
                )}
              </div>

              <UiCard className="devices" fill title={t('Signed-in devices')} description={t(isSelf ? 'Where you are signed in now.' : 'Where they are signed in now.')} flush
                actions={sessionCount > (isSelf ? 1 : 0) && (
                  <UiButton variant="ghost" size="sm" type="button" loading={ending === 'all'} onClick={() => void endOtherSessions()}>
                    <NgIcon svg={lucideLogOut} />{` ${t(isSelf ? 'Sign out of other devices' : 'Sign out everywhere')} `}
                  </UiButton>
                )}>
                {sessions ? (
                  sessions.length ? (
                    <ul className="device-list">
                      {sessions.map(device => (
                        <li key={device.id} className="device">
                          <span className="device-icon"><NgIcon svg={isPhone(device) ? lucideSmartphone : lucideMonitor} /></span>
                          <span className="device-text">
                            <span className="device-name">
                              {` ${t('deviceName', { browser: device.browser, os: device.os })} `}
                              {device.current && <UiBadge tone="success">{t('This device')}</UiBadge>}
                            </span>
                            <span className="device-meta">
                              {` ${device.ip} · ${t('lastSeen', { time: f.timeAgo(device.lastSeenAt) })} · ${t('signedInOn', { date: f.localDate(device.createdAt) })} `}
                            </span>
                          </span>
                          {!device.current && (
                            <UiButton variant="ghost" size="sm" type="button" loading={ending === device.id} onClick={() => void endSession(device)}>{t('Sign out')}</UiButton>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <UiEmptyState compact icon={lucideMonitor} title={t('Not signed in anywhere')} />
                  )
                ) : (
                  <p className="device-loading">{t('Loading…')}</p>
                )}
              </UiCard>
            </div>

            {isSelf && (
              <>
                <TwoFactorDialog mode={twoFactorMode} open={twoFactorOpen}
                  onOpenChange={open => { setTwoFactorOpen(open); if (!open) { void loadRecoveryCodesLeft(); } }} />
                <RecoveryCodesDialog open={makingCodes} onOpenChange={setMakingCodes} onMade={() => void loadRecoveryCodesLeft()} />
                <ChangePasswordDialog open={changingPassword} onOpenChange={setChangingPassword} />
              </>
            )}
          </>
        )}
      </div>
    </app-user-detail>
  );
}
