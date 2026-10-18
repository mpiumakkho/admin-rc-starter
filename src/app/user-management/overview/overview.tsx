import type { ChartData, ChartOptions } from 'chart.js';
import { lazy, useMemo, useState } from 'react';
import { Link } from 'react-router';

import {
  lucideActivity, lucideArrowRight, lucideBan, lucideCircleCheck, lucideClockAlert, lucideHistory, lucideLayoutDashboard, lucideMailCheck,
  lucideMailWarning, lucideUserPlus, lucideUsers,
} from '../../icons';
import { useSession } from '../access/session';
import { ActivityDialog } from '../activity/activity-dialog';
import { roleAssignmentState } from '../data/access-rules';
import { adminStore, useAdmin } from '../data/admin-store';
import { ACTIVITY_META, DEPARTMENTS, STATUS_META } from '../data/catalog';
import { fullName, type Activity, type User, type UserStatus } from '../data/models';
import { ActivityText } from '../shared/activity-text';
import { RoleBadges } from '../shared/badges';
import { intlLocale, useFormat } from '../shared/formatting';
import {
  cx, DeferOnViewport, NgIcon, uiToast, UiAlert, UiButton, UiCard, UiChartLegend, UiEmptyState, UiIconChip, UiLinkButton, UiPageHeader, UiPerson,
  UiProgress, UiSegmented, UiSplitBar, UiStatCard, UiTimeline, UiTimelineItem, type UiLegendItem, type UiOption, type UiSplitPart, type UiTone,
} from '../ui';
import { UI_CHART_PALETTE } from '../ui/charts/chart-colors';
import './overview.scss';

// Chart.js loads after the page opens (the Angular app's @defer)
const UiChart = lazy(() => import('../ui/charts/chart').then(m => ({ default: m.UiChart })));

const DAY = 24 * 60 * 60 * 1000;

// Chart colors per role tone, matching the badges
const TONE_COLORS: Record<UiTone, string> = {
  primary: '#6366f1',
  info: '#0ea5e9',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  neutral: '#94a3b8',
};

/** With more roles than fit the card, the chart names the ones most people hold and adds up the rest */
const CHART_ROLES = 5;
/** Lighter than the neutral tone, so "other roles" never looks like a role of its own */
const OTHER_ROLES_COLOR = '#cbd5e1';

/** A role held for a time shows on the overview this many days before it ends */
const ENDING_SOON_DAYS = 7;

const SIGNUP_OPTIONS: ChartOptions<'bar'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { display: false }, border: { display: false } },
    y: { beginAtZero: true, ticks: { precision: 0 }, border: { display: false } },
  },
};

const ROLE_OPTIONS: ChartOptions<'doughnut'> = {
  cutout: '76%',
  responsive: true,
  maintainAspectRatio: true,
  plugins: { legend: { display: false } },
};

export function OverviewComponent() {
  const store = useAdmin();
  const session = useSession();
  const f = useFormat();
  const { t } = f;
  const [now] = useState(() => Date.now());

  /* Summary numbers */

  const joinedBetween = (fromDaysAgo: number, toDaysAgo: number) => store.users.filter(user => {
    const age = now - new Date(user.createdAt).getTime();
    return age >= toDaysAgo * DAY && age < fromDaysAgo * DAY;
  }).length;

  const total = store.users.length;
  const active = store.users.filter(user => user.status === 'active').length;
  const invited = store.users.filter(user => user.status === 'invited').length;
  /** The last 30 days, not the calendar month: early in a month that would be a misleadingly small number */
  const newThisMonth = joinedBetween(30, 0);
  /** A difference in people, not a percentage, which runs into the hundreds on numbers this small */
  const newTrend = newThisMonth - joinedBetween(60, 30);
  /**
   * Open accounts whose owner signed in during the last 7 days, from each user's last activity: how many
   * people actually use the admin, which the account status alone does not say
   */
  const recentlyActive = store.users.filter(user =>
    user.status === 'active' && !!user.lastActiveAt && now - new Date(user.lastActiveAt).getTime() < 7 * DAY).length;
  const recentShare = active ? Math.round(recentlyActive / active * 100) : 0;

  /** Accounts by status, under the total */
  const statusSplit: UiSplitPart[] = (Object.keys(STATUS_META) as UserStatus[]).map(status => ({
    label: t(STATUS_META[status].label),
    value: store.users.filter(user => user.status === status).length,
    tone: STATUS_META[status].tone,
  }));

  /* New users per month */

  const rangeOptions: UiOption<number>[] = [
    { value: 6, label: t('6 months') },
    { value: 12, label: t('12 months') },
  ];
  const [months, setMonths] = useState(12);

  const signupData = useMemo<ChartData<'bar'>>(() => {
    const formatter = new Intl.DateTimeFormat(intlLocale(f.language), { month: 'short' });
    const today = new Date(now);
    const buckets = Array.from({ length: months }, (_, index) => {
      const date = new Date(today.getFullYear(), today.getMonth() - (months - 1 - index), 1);
      return { key: `${date.getFullYear()}-${date.getMonth()}`, label: formatter.format(date), total: 0 };
    });
    const byKey = new Map(buckets.map(bucket => [bucket.key, bucket]));
    for (const user of store.users) {
      const created = new Date(user.createdAt);
      const bucket = byKey.get(`${created.getFullYear()}-${created.getMonth()}`);
      if (bucket) {
        bucket.total++;
      }
    }
    return {
      labels: buckets.map(bucket => bucket.label),
      datasets: [{
        // Shown in the tooltip
        label: t('New users'),
        data: buckets.map(bucket => bucket.total),
        backgroundColor: UI_CHART_PALETTE[0],
        hoverBackgroundColor: '#4f46e5',
        maxBarThickness: 28,
        borderRadius: 6,
        borderSkipped: false,
      }],
    };
  }, [store.users, months, f.language, t, now]);

  /** The bar chart's numbers for screen readers, such as "New users per month: Nov 3, Dec 5, …" */
  const signupSummary = t('newUsersChart', {
    values: (signupData.labels ?? []).map((label, index) => `${label} ${signupData.datasets[0].data[index]}`).join(', '),
  });

  /* Users per role */

  const roleBreakdown = useMemo(() => {
    const roles = store.roles.map(role => ({
      id: role.id as string | null,
      label: role.name,
      color: TONE_COLORS[role.tone],
      // Each person once, by their main role, so the parts make up the whole
      value: store.mainRoleCounts.get(role.id) ?? 0,
    }));
    if (roles.length <= CHART_ROLES + 1) {
      return roles;
    }
    const byCount = [...roles].sort((a, b) => b.value - a.value);
    const rest = byCount.slice(CHART_ROLES);
    return [...byCount.slice(0, CHART_ROLES), {
      id: null,
      label: t('otherRoles', { count: rest.length }),
      color: OTHER_ROLES_COLOR,
      value: rest.reduce((sum, role) => sum + role.value, 0),
    }];
  }, [store.roles, store.mainRoleCounts, t]);

  /** Each role links to the users who have it; the rest added up, to the list of every role */
  const roleLegend: UiLegendItem[] = roleBreakdown.map(({ id, ...item }) => id ? { ...item, link: '/users', queryParams: { role: id } } : { ...item, link: '/roles' });

  const roleData = useMemo<ChartData<'doughnut'>>(() => ({
    labels: roleBreakdown.map(role => role.label),
    datasets: [{
      data: roleBreakdown.map(role => role.value),
      backgroundColor: roleBreakdown.map(role => role.color),
      borderWidth: 0,
      spacing: 3,
      borderRadius: 6,
      hoverOffset: 4,
    }],
  }), [roleBreakdown]);

  /* Lists */

  const recentActivity = store.activity.slice(0, 7);
  /** The entry open in the details dialog */
  const [selectedEntry, setSelectedEntry] = useState<Activity | null>(null);
  const recentlyJoined = [...store.users].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);

  /* Needs attention */

  /**
   * Invited people whose last invitation has expired (see the settings), oldest first. The last invitation is
   * the account's creation or a later resend from the activity log, so sending again clears the item.
   */
  const staleInvites = useMemo(() => {
    const lastSent = new Map<string, string>();
    for (const entry of store.activity) {
      if (entry.action === 'user.invited' && entry.targetId && entry.at > (lastSent.get(entry.targetId) ?? '')) {
        lastSent.set(entry.targetId, entry.at);
      }
    }
    return store.users
      .filter(user => user.status === 'invited')
      .map(user => {
        const resent = lastSent.get(user.id) ?? '';
        return { user, sentAt: resent > user.createdAt ? resent : user.createdAt };
      })
      .filter(item => now - new Date(item.sentAt).getTime() > store.settings.inviteExpiryDays * DAY)
      .sort((a, b) => a.sentAt.localeCompare(b.sentAt));
  }, [store.activity, store.users, store.settings, now]);

  const suspended = store.users.filter(user => user.status === 'suspended').length;

  /** Roles held for a time that end within a week, soonest first, so someone can renew what is still needed */
  const endingRoles = store.users
    .filter(user => user.status === 'active')
    .flatMap(user => user.roles
      .filter(assignment => assignment.endsAt && roleAssignmentState(assignment, store.now) === 'active'
        && new Date(assignment.endsAt).getTime() - store.now <= ENDING_SOON_DAYS * DAY)
      .map(assignment => ({ user, assignment, role: store.rolesById.get(assignment.roleId)?.name ?? '' })))
    .sort((a, b) => a.assignment.endsAt!.localeCompare(b.assignment.endsAt!));
  const [resending, setResending] = useState<string | null>(null);

  const resendInvite = async (user: User) => {
    setResending(user.id);
    try {
      await adminStore.resendInvite(user.id);
      uiToast.show(t('toast.inviteResent', { email: user.email }));
    } catch {
      uiToast.show(t('Something went wrong. Try again.'), 'error');
    } finally {
      setResending(null);
    }
  };

  const departments = DEPARTMENTS
    .map(name => ({ name, count: store.users.filter(user => user.department === name).length }))
    .sort((a, b) => b.count - a.count)
    .map(item => ({ ...item, share: Math.round(item.count / (total || 1) * 100) }));

  return (
    <app-overview>
      <UiPageHeader title={t('Overview')} subtitle={t('How your users and roles are doing.')} icon={lucideLayoutDashboard}>
        {session.canSomewhere('users.create') && <UiLinkButton to="/users/new"><NgIcon svg={lucideUserPlus} />{` ${t('Add user')}`}</UiLinkButton>}
      </UiPageHeader>

      {store.accessReviewsWaiting > 0 && (
        <UiAlert className="reviews-waiting" tone="info"
          actions={<UiLinkButton size="sm" variant="secondary" to="/access-reviews">{t('Review now')}</UiLinkButton>}>
          {` ${t('reviewsWaiting', { count: store.accessReviewsWaiting })} `}
        </UiAlert>
      )}

      {/* Each number opens the users behind it */}
      <div className="stat-grid">
        <Link to="/users">
          <UiStatCard label={t('Total users')} value={total} icon={lucideUsers} tone="primary">
            <UiSplitBar parts={statusSplit} />
          </UiStatCard>
        </Link>
        <Link to="/users?status=active&sort=active">
          <UiStatCard label={t('Signed in in the last 7 days')} value={recentlyActive} icon={lucideActivity} tone="success" hint={t('recentShare', { share: recentShare })} />
        </Link>
        <Link to="/users?sort=joined">
          <UiStatCard label={t('Joined in the last 30 days')} value={newThisMonth} icon={lucideUserPlus} tone="info" trend={newTrend} trendSuffix="" hint={t('vs the previous 30 days')} />
        </Link>
        <Link to="/users?status=invited">
          <UiStatCard label={t('Pending invitations')} value={invited} icon={lucideMailCheck} tone="warning" hint={t('Not signed in yet')} />
        </Link>
      </div>

      <div className={cx('overview-grid', !session.canSomewhere('activity.view') && 'no-activity')}>
        <UiCard className="span-8 chart-card" title={t('New users')} description={t('People who joined each month')}
          actions={<UiSegmented size="sm" options={rangeOptions} value={months} onValueChange={setMonths} ariaLabel={t('Time range')} />}>
          <div className="chart-box">
            {/* Chart.js loads after the page opens */}
            <DeferOnViewport placeholder={<div></div>}>
              <UiChart type="bar" data={signupData} options={SIGNUP_OPTIONS} label={signupSummary} />
            </DeferOnViewport>
          </div>
        </UiCard>

        <UiCard className="span-4" title={t('Users by role')} description={t('Each person once, by their main role')}
          actions={session.can('roles.view') && (
            <UiLinkButton variant="ghost" size="sm" to="/roles">
              {t(session.can('roles.manage') ? 'Manage' : 'View all')}<span className="ui-sr-only">{` ${t('Roles & permissions')}`}</span><NgIcon svg={lucideArrowRight} />
            </UiLinkButton>
          )}>
          <div className="role-body">
            <div className="role-layout">
              <div className="donut">
                {total
                  ? (
                    <DeferOnViewport placeholder={<div className="donut-empty"></div>}>
                      <UiChart type="doughnut" data={roleData} options={ROLE_OPTIONS} />
                    </DeferOnViewport>
                  )
                  : <div className="donut-empty"></div>}
                <div className="donut-center">
                  <span className="donut-value">{total}</span>
                  <span className="donut-label">{t('Users')}</span>
                </div>
              </div>
              <UiChartLegend className="role-legend" items={roleLegend} layout="list" />
            </div>
          </div>
        </UiCard>

        {/* Without activity.view the log stays empty, so this card makes way for the next one */}
        {session.canSomewhere('activity.view') && (
          <UiCard className="span-7" title={t('Recent activity')} description={t('Latest changes made by admins')}
            actions={(
              <UiLinkButton variant="ghost" size="sm" to="/activity">
                {t('View all')}<span className="ui-sr-only">{` ${t('Activity log')}`}</span><NgIcon svg={lucideArrowRight} />
              </UiLinkButton>
            )}>
            {recentActivity.length ? (
              <UiTimeline>
                {recentActivity.map(entry => (
                  <UiTimelineItem key={entry.id} icon={ACTIVITY_META[entry.action].icon} tone={ACTIVITY_META[entry.action].tone} time={f.timeAgo(entry.at)}>
                    <button type="button" className="timeline-link" onClick={() => setSelectedEntry(entry)}>
                      <ActivityText entry={entry} />
                    </button>
                  </UiTimelineItem>
                ))}
              </UiTimeline>
            ) : <UiEmptyState compact icon={lucideHistory} title={t('No activity yet')} description={t('Changes made by admins appear here.')} />}
          </UiCard>
        )}

        <UiCard className="span-5 lower" title={t('Needs attention')} description={t('Things an admin should follow up')} flush>
          {staleInvites.length || suspended || endingRoles.length ? (
            <ul className="attention-list">
              {staleInvites.length > 0 && (
                <>
                  <li className="attention-item">
                    <UiIconChip size="sm" icon={lucideMailWarning} tone="warning" />
                    <div className="attention-text">
                      <span className="attention-title">{t('staleInvites', { count: staleInvites.length })}</span>
                      <span className="attention-sub">{t('inviteExpiredHint', { days: store.settings.inviteExpiryDays })}</span>
                    </div>
                    {staleInvites.length > 3 && (
                      <UiLinkButton variant="ghost" size="sm" to="/users?status=invited">
                        {t('View all')}<span className="ui-sr-only">{` ${t('Pending invitations')}`}</span>
                      </UiLinkButton>
                    )}
                  </li>
                  {staleInvites.slice(0, 3).map(item => (
                    <li key={item.user.id} className="attention-person">
                      <UiPerson name={fullName(item.user)} detail={t('invitedAgo', { time: f.timeAgo(item.sentAt) })} src={item.user.avatar} />
                      {session.canOn('users.create', item.user) && (
                        <UiButton variant="secondary" size="sm" type="button" loading={resending === item.user.id} onClick={() => void resendInvite(item.user)}>
                          {` ${t('Send again')} `}
                        </UiButton>
                      )}
                    </li>
                  ))}
                </>
              )}
              {endingRoles.length > 0 && (
                <>
                  <li className="attention-item">
                    <UiIconChip size="sm" icon={lucideClockAlert} tone="info" />
                    <div className="attention-text">
                      <span className="attention-title">{t('endingRoles', { count: endingRoles.length })}</span>
                      <span className="attention-sub">{t('Renew them on the profile if they are still needed.')}</span>
                    </div>
                    <UiLinkButton variant="ghost" size="sm" to="/users?role=temporary">
                      {t('See list')}<span className="ui-sr-only">{` ${t('endingRoles', { count: endingRoles.length })}`}</span>
                    </UiLinkButton>
                  </li>
                  {endingRoles.slice(0, 3).map(item => (
                    <li key={item.assignment.id} className="attention-person">
                      <Link className="person-link" to={`/users/${item.user.id}?tab=roles`}>
                        <UiPerson name={fullName(item.user)} detail={t('roleEnds', { role: item.role, date: f.localDate(item.assignment.endsAt) })} src={item.user.avatar} />
                      </Link>
                    </li>
                  ))}
                </>
              )}
              {suspended > 0 && (
                <li className="attention-item">
                  <UiIconChip size="sm" icon={lucideBan} tone="danger" />
                  <div className="attention-text">
                    <span className="attention-title">{t('suspendedAccounts', { count: suspended })}</span>
                    <span className="attention-sub">{t('Check whether they still need to be suspended.')}</span>
                  </div>
                  <UiLinkButton variant="ghost" size="sm" to="/users?status=suspended">
                    {t('See list')}<span className="ui-sr-only">{` ${t('suspendedAccounts', { count: suspended })}`}</span>
                  </UiLinkButton>
                </li>
              )}
            </ul>
          ) : (
            <UiEmptyState compact icon={lucideCircleCheck} title={t('Nothing needs your attention')}
              description={t('Every invitation is recent, no account is suspended and no role ends this week.')} />
          )}
        </UiCard>

        <UiCard className="span-7 lower" title={t('Users by department')}>
          {total ? (
            <div className="bars">
              {departments.map(department => (
                <UiProgress key={department.name} value={department.share} label={t(department.name)} valueLabel={`${department.count} · ${department.share}%`} />
              ))}
            </div>
          ) : <UiEmptyState compact icon={lucideUsers} title={t('No users yet')} description={t('Add the first user to get started.')} />}
        </UiCard>

        <UiCard className="span-5 lower" title={t('Recently joined')} description={t('The newest accounts')} flush
          actions={(
            <UiLinkButton variant="ghost" size="sm" to="/users">
              {t('View all')}<span className="ui-sr-only">{` ${t('Users')}`}</span><NgIcon svg={lucideArrowRight} />
            </UiLinkButton>
          )}>
          {recentlyJoined.length ? (
            <ul className="person-list">
              {recentlyJoined.map(user => (
                <li key={user.id}>
                  <Link className="person-link" to={`/users/${user.id}`}>
                    <UiPerson name={fullName(user)} detail={user.email} src={user.avatar} />
                    <span className="person-meta">
                      <RoleBadges user={user} max={1} />
                      <span className="joined">{f.timeAgo(user.createdAt)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <UiEmptyState compact icon={lucideUserPlus} title={t('No users yet')} description={t('Add the first user to get started.')}>
              {session.canSomewhere('users.create') && <UiLinkButton size="sm" to="/users/new">{t('Add user')}</UiLinkButton>}
            </UiEmptyState>
          )}
        </UiCard>
      </div>

      <ActivityDialog entry={selectedEntry} onClosed={() => setSelectedEntry(null)} />
    </app-overview>
  );
}
