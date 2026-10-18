import { useLayoutEffect, useRef, useState } from 'react';

import { useSession } from '../access/session';
import { roleAssignmentState, roleConflict } from '../data/access-rules';
import { adminStore, useAdmin } from '../data/admin-store';
import { fullName, type RoleAssignment, type RoleGrant, type User } from '../data/models';
import { errorMessage } from '../shared/errors';
import { useFormat } from '../shared/formatting';
import { uiToast, UiButton, UiDialog, UiFormField, UiSegmented, type UiOption } from '../ui';
import './role-assignment-dialog.scss';

const DAY_MS = 24 * 60 * 60_000;

let nextId = 0;

type StartMode = 'now' | 'date';
type EndMode = 'never' | 'date';

export interface RoleAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Who gets the role; one person, or everyone selected */
  users?: User[];
  /** For a user not saved yet: the grant is handed to onGranted, not saved */
  draft?: boolean;
  /** Roles a draft already has, so they are not offered again */
  exclude?: string[];
  /** An assignment to change instead of a new one */
  assignment?: RoleAssignment | null;
  /** A draft's grant */
  onGranted?: (grant: RoleGrant) => void;
  /** Saved; the list clears its selection */
  onDone?: () => void;
}

/**
 * Gives a role, for good or until a date, as Microsoft Entra's role assignments do; or changes when one ends and why.
 *
 * - With `users`: gives one person, or everyone selected on the list, the role picked. People who already hold it are
 *   left as they are.
 * - With `draft`: for a user not saved yet; hands the grant to onGranted instead of saving it.
 * - With `assignment`: moves its end (extend, shorten, renew one that has expired) or changes its reason.
 *
 * Only roles the signed-in user may give are offered, in the scopes where they may give them (API.md, "Branch
 * administrators"), with each role's own rules (an end within so many days, a reason); the server checks all of it
 * again.
 */
export function RoleAssignmentDialog({
  open, onOpenChange, users = [], draft = false, exclude = [], assignment = null, onGranted, onDone,
}: RoleAssignmentDialogProps) {
  const store = useAdmin();
  const session = useSession();
  const f = useFormat();
  const { t } = f;
  const [formId] = useState(() => `role-assignment-${nextId++}`);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState('');

  const [role, setRole] = useState('');
  /** Empty: the whole organization; otherwise a branch id */
  const [scope, setScope] = useState('');
  const [startMode, setStartMode] = useState<StartMode>('now');
  const [startDate, setStartDate] = useState('');
  const [endMode, setEndMode] = useState<EndMode>('never');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

  /** Giving a new user their first roles needs users.create; anyone else's, users.edit */
  const permission = draft ? 'users.create' as const : 'users.edit' as const;
  /** A role for the whole organization needs the permission for the whole organization */
  const organizationAllowed = session.allows(permission, null);
  /** The open branches where the signed-in user may give roles */
  const branches = store.openBranches.filter(branch => session.allows(permission, branch.id));

  /** Roles the signed-in user may give in a scope, other than ones the person holds now or later there */
  const offeredIn = (scopeValue: string) => {
    const single = users.length === 1 ? users[0] : null;
    const excluded = new Set(exclude);
    const branchId = scopeValue || null;
    return store.roles.filter(item => session.canGive(item, branchId, permission) && !excluded.has(item.id)
      && !(single && store.holdsOrWillHold(single, item.id, branchId)));
  };
  const offered = offeredIn(scope);
  const rulesOf = (roleId: string) => store.rolesById.get(assignment?.roleId ?? roleId)?.assignment ?? { maxDays: null, reasonRequired: false };
  const rules = rulesOf(role);
  const started = !!assignment && roleAssignmentState(assignment, store.now) !== 'scheduled';

  const roleName = (roleId: string) => store.rolesById.get(roleId)?.name ?? '';
  const branchName = (branchId: string) => store.branchesById.get(branchId)?.name ?? '';

  const title = assignment
    ? t('changeAssignmentTitle', { role: roleName(assignment.roleId) })
    : draft ? t('Add a role')
    : users.length === 1 ? t('giveRoleTo', { name: fullName(users[0]) }) : t('giveRoleCount', { count: users.length });
  const description = assignment
    ? t('Extend it, end it sooner, or renew it after it has ended.')
    : t(users.length > 1
      ? 'Everyone selected gets the role. People who already have it are left as they are.'
      : 'Give it for good, or until a date when it ends by itself.');
  /** The role's own rules, under its name */
  const rulesHint = [
    rules.maxDays !== null ? t('roleMaxDaysHint', { count: rules.maxDays }) : '',
    rules.reasonRequired ? t('This role needs a reason.') : '',
  ].filter(Boolean).join(' ');
  const startOptions: UiOption<StartMode>[] = [{ value: 'now', label: t('Now') }, { value: 'date', label: t('On a date') }];
  const endOptions: UiOption<EndMode>[] = [
    { value: 'never', label: t('For good'), disabled: rules.maxDays !== null },
    { value: 'date', label: t('On a date') },
  ];

  const today = dateInput(store.now);
  /** When it starts, as the dates stand */
  const startAt = (mode: StartMode, date: string) => {
    if (assignment) {
      return Math.max(new Date(assignment.startsAt).getTime(), store.now);
    }
    const value = mode === 'date' ? date : '';
    return Math.max(value ? startOfDay(value) : 0, store.now);
  };
  const start = startAt(startMode, startDate);
  const endMin = dateInput(start);
  const endMax = rules.maxDays === null ? null : dateInput(start + rules.maxDays * DAY_MS);

  /** For good, or the given end; a role that must end defaults to its longest */
  const setEnd = (endsAt: string | null, roleId: string, from: number) => {
    const maxDays = rulesOf(roleId).maxDays;
    if (endsAt) {
      setEndMode('date');
      setEndDate(dateInput(new Date(endsAt).getTime()));
    } else if (maxDays !== null) {
      setEndMode('date');
      setEndDate(dateInput(from + maxDays * DAY_MS));
    } else {
      setEndMode('never');
      setEndDate(dateInput(from + 30 * DAY_MS));
    }
  };

  /** Another role picked: one that must end gets an end at its longest */
  const pickRole = (roleId: string, from = start) => {
    setRole(roleId);
    if (!assignment) {
      setEnd(null, roleId, from);
    }
  };

  // Each time it opens: the assignment as it is, or the first role offered, from now, for good when its rules allow.
  // While it is open, another scope (or a change elsewhere) can leave the role picked already held there: the first one
  // offered instead
  const wasOpen = useRef(false);
  const offeredIds = offered.map(item => item.id).join(' ');
  useLayoutEffect(() => {
    if (!open) {
      wasOpen.current = false;
      return;
    }
    if (!wasOpen.current) {
      wasOpen.current = true;
      const nextScope = assignment?.branchId ?? (organizationAllowed ? '' : branches[0]?.id ?? '');
      const nextRole = assignment?.roleId ?? offeredIn(nextScope)[0]?.id ?? '';
      const from = startAt('now', today);
      setProblem('');
      setScope(nextScope);
      setRole(nextRole);
      setStartMode('now');
      setStartDate(today);
      setReason(assignment?.reason ?? '');
      setEnd(assignment?.endsAt ?? null, nextRole, from);
    } else if (!assignment && !offered.some(item => item.id === role)) {
      pickRole(offered[0]?.id ?? '');
    }
  }, [open, offeredIds, role]);

  /** The form as a grant, or null with what is wrong shown */
  const grant = (): RoleGrant | null => {
    const now = Date.now();
    const begins = assignment || startMode === 'now' || !startDate ? null : startOfDay(startDate);
    if (begins !== null && begins < startOfDay(dateInput(now))) {
      setProblem('Pick today or a later day.');
      return null;
    }
    let endsAt: string | null = null;
    if (endMode === 'date') {
      if (!endDate) {
        return null;
      }
      const from = Math.max(begins ?? now, assignment ? new Date(assignment.startsAt).getTime() : 0, now);
      let end = endOfDay(endDate);
      // The last day allowed ends when the role's longest assignment does
      if (rules.maxDays !== null) {
        end = Math.min(end, from + rules.maxDays * DAY_MS);
      }
      if (end <= from) {
        setProblem('Pick an end after the start.');
        return null;
      }
      endsAt = new Date(end).toISOString();
    }
    const text = reason.trim();
    if (rules.reasonRequired && !text) {
      setProblem('This role needs a reason.');
      return null;
    }
    return {
      roleId: assignment?.roleId ?? role,
      ...(!assignment && scope ? { branchId: scope } : {}),
      ...(begins !== null && begins > now ? { startsAt: new Date(begins).toISOString() } : {}),
      endsAt,
      ...(text ? { reason: text } : {}),
    };
  };

  const save = async () => {
    setProblem('');
    const granted = grant();
    if (!granted) {
      return;
    }
    if (draft && !assignment) {
      onGranted?.(granted);
      onOpenChange(false);
      return;
    }
    // One person: say which rule a conflicting role breaks before asking the server (API.md, "Conflicting roles")
    const single = users.length === 1 ? users[0] : null;
    if (single) {
      const held = single.roles.filter(item => item.id !== assignment?.id);
      const period = { startsAt: assignment?.startsAt ?? granted.startsAt ?? new Date().toISOString(), endsAt: granted.endsAt };
      const conflict = roleConflict(store.roleConflicts, held, assignment?.roleId ?? granted.roleId, period, Date.now());
      if (conflict) {
        setProblem(t('conflictProblem', { role: roleName(conflict.roleId), rule: conflict.rule.name }));
        return;
      }
    }
    setSaving(true);
    try {
      if (assignment) {
        await adminStore.updateRoleAssignment(assignment.id, { endsAt: granted.endsAt, reason: granted.reason ?? '' });
        uiToast.show(t('Role assignment saved.'));
      } else if (users.length === 1) {
        await adminStore.assignRole({ userId: users[0].id, ...granted });
        uiToast.show(t('Role given.'));
      } else {
        const changed = await adminStore.assignRoles(users.map(user => user.id), { add: granted });
        uiToast.show(t('toast.roleGiven', { count: changed.length }));
      }
      onOpenChange(false);
      onDone?.();
    } catch (error) {
      setProblem(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <app-role-assignment-dialog>
      <UiDialog open={open} onOpenChange={onOpenChange} title={title} description={description} closeLabel={t('Close')}
        footer={<>
          <UiButton variant="secondary" type="button" onClick={() => onOpenChange(false)}>{t('Cancel')}</UiButton>
          <UiButton type="submit" form={formId} loading={saving} disabled={!assignment && !role}>
            {` ${t(assignment ? 'Save changes' : draft ? 'Add' : 'Give role')} `}
          </UiButton>
        </>}>
        <form id={formId} className="assignment-form" onSubmit={event => { event.preventDefault(); void save(); }} noValidate>
          {assignment ? (
            <p className="assignment-role">
              <span>{t('Role')}</span>
              <b>{roleName(assignment.roleId)}</b>
              {store.branchesEnabled && assignment.branchId && <span>{`· ${branchName(assignment.branchId)}`}</span>}
              <span className="assignment-started">{t(started ? 'startedOn' : 'startsOn', { date: f.localDate(assignment.startsAt) })}</span>
            </p>
          ) : (
            <>
              <UiFormField label={t('Role')} for={`${formId}-role`} hint={rulesHint} required>
                <select className="ui-input" id={`${formId}-role`} value={role} onChange={event => pickRole(event.target.value)}>
                  {offered.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
                </select>
              </UiFormField>
              {(store.branchesEnabled || !organizationAllowed) && (
                <UiFormField label={t('Applies in')} for={`${formId}-scope`} hint={t('A role for one branch allows what it allows there only.')}>
                  <select className="ui-input" id={`${formId}-scope`} value={scope} onChange={event => setScope(event.target.value)}>
                    {organizationAllowed && <option value="">{t('Whole organization')}</option>}
                    {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                  </select>
                </UiFormField>
              )}
              <UiFormField label={t('Starts')} for={`${formId}-start`}>
                <UiSegmented options={startOptions} value={startMode} onValueChange={setStartMode} ariaLabel={t('Starts')} />
                {startMode === 'date' && (
                  <input className="ui-input assignment-date" type="date" id={`${formId}-start`} value={startDate} min={today} aria-label={t('Start date')}
                    onChange={event => setStartDate(event.target.value)} />
                )}
              </UiFormField>
            </>
          )}
          <UiFormField label={t('Ends')} for={`${formId}-end`} hint={assignment ? rulesHint : ''}>
            <UiSegmented options={endOptions} value={endMode} onValueChange={setEndMode} ariaLabel={t('Ends')} />
            {endMode === 'date' && (
              <input className="ui-input assignment-date" type="date" id={`${formId}-end`} value={endDate} min={endMin} max={endMax ?? undefined}
                aria-label={t('End date')} onChange={event => setEndDate(event.target.value)} />
            )}
          </UiFormField>
          <UiFormField label={t('Reason')} for={`${formId}-reason`} required={rules.reasonRequired} optionalLabel={rules.reasonRequired ? '' : t('(optional)')}>
            <textarea className="ui-input" id={`${formId}-reason`} rows={2} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} />
          </UiFormField>
          {problem && <p className="assignment-problem" role="alert">{t(problem)}</p>}
        </form>
      </UiDialog>
    </app-role-assignment-dialog>
  );
}

/** A moment as a date input's value, in local time: "2026-10-31" */
function dateInput(ms: number): string {
  const date = new Date(ms);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function startOfDay(value: string): number {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).getTime();
}

/** The last moment of a date, in local time: a role "until 31 Oct" lasts the whole of that day */
function endOfDay(value: string): number {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 23, 59, 59, 999).getTime();
}
