import { useLayoutEffect, useState } from 'react';

import { lucideX } from '../../icons';
import { roleAssignmentState } from '../data/access-rules';
import { adminStore, useAdmin } from '../data/admin-store';
import { REVIEW_DAYS, REVIEW_MAX_DAYS } from '../data/catalog';
import { fullName, type AccessReview, type User } from '../data/models';
import { errorMessage } from '../shared/errors';
import { intlLocale, useFormat } from '../shared/formatting';
import { cx, NgIcon, uiToast, UiButton, UiDialog, UiFormField } from '../ui';
import './start-review-dialog.scss';

const DAY_MS = 24 * 60 * 60_000;
/** The most people a review may name to decide all of it (API.md, "Access reviews") */
const MAX_REVIEWERS = 20;

export interface StartReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The review, once started */
  onStarted?: (review: AccessReview) => void;
}

/**
 * Starts an access review (reviews.manage): which roles, whose, until when, and who else decides besides each person's
 * administrators. It says how many role assignments it will cover before it starts.
 */
export function StartReviewDialog({ open, onOpenChange, onStarted }: StartReviewDialogProps) {
  const store = useAdmin();
  const f = useFormat();
  const { t } = f;

  const [name, setName] = useState('');
  /** Empty: every role */
  const [roleId, setRoleId] = useState('');
  /** Empty: everyone */
  const [branchId, setBranchId] = useState('');
  const [due, setDue] = useState('');
  const [reviewerIds, setReviewerIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState('');

  const today = dateInput(store.now);
  /** Within a year of starting; the last day ends a little before that */
  const lastDay = dateInput(store.now + (REVIEW_MAX_DAYS - 1) * DAY_MS);

  /** How many role assignments it would cover now: held now or later, of the role picked, by the people picked */
  const covered = store.users
    .filter(user => !branchId || user.branchId === branchId)
    .reduce((count, user) => count + user.roles.filter(item => (!roleId || item.roleId === roleId)
      && roleAssignmentState(item, store.now) !== 'expired').length, 0);

  const reviewers = reviewerIds.map(id => store.usersById.get(id)).filter((user): user is User => !!user);
  /** Active people not named yet, by name */
  const candidates = store.users
    .filter(user => user.status === 'active' && !reviewerIds.includes(user.id))
    .sort((a, b) => fullName(a).localeCompare(fullName(b)));

  // Each time it opens: named after this month, every role of everyone, closing in two weeks
  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    const month = new Intl.DateTimeFormat(intlLocale(f.language ?? ''), { month: 'long', year: 'numeric' }).format(new Date());
    setName(t('reviewName', { month }));
    setRoleId('');
    setBranchId('');
    setDue(dateInput(Date.now() + REVIEW_DAYS * DAY_MS));
    setReviewerIds([]);
    setProblem('');
  }, [open]);

  /** Adds the person picked; the list stays on its prompt (a controlled select) */
  const addReviewer = (id: string) => {
    if (id && !reviewerIds.includes(id)) {
      setReviewerIds(ids => [...ids, id]);
    }
  };

  const removeReviewer = (id: string) => setReviewerIds(ids => ids.filter(item => item !== id));

  const start = async () => {
    const trimmed = name.trim();
    const dueAt = due ? endOfDay(due) : 0;
    if (!trimmed) {
      setProblem('Give the review a name.');
      return;
    }
    if (dueAt <= Date.now() || dueAt > Date.now() + REVIEW_MAX_DAYS * DAY_MS) {
      setProblem('Pick a day from today to a year from now.');
      return;
    }
    setSaving(true);
    setProblem('');
    try {
      const review = await adminStore.startAccessReview({
        name: trimmed, roleId: roleId || null, branchId: branchId || null, dueAt: new Date(dueAt).toISOString(), reviewerIds,
      });
      uiToast.show(t('toast.reviewStarted', { name: trimmed }));
      onOpenChange(false);
      onStarted?.(review);
    } catch (error) {
      setProblem(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <app-start-review-dialog>
      <UiDialog open={open} onOpenChange={onOpenChange} title={t('Start access review')}
        description={t('The people who look after each person decide whether they keep each role.')} closeLabel={t('Close')}
        footer={<>
          <UiButton variant="secondary" type="button" onClick={() => onOpenChange(false)}>{t('Cancel')}</UiButton>
          <UiButton type="submit" form="startReviewForm" loading={saving} disabled={!covered}>{t('Start review')}</UiButton>
        </>}>
        <form className="review-form" id="startReviewForm" onSubmit={event => { event.preventDefault(); void start(); }} noValidate>
          <UiFormField label={t('Name')} for="reviewName" required>
            <input className="ui-input" id="reviewName" name="name" value={name} onChange={event => setName(event.target.value)} maxLength={100} autoComplete="off" />
          </UiFormField>
          <div className="review-scope">
            <UiFormField label={t('Roles')} for="reviewRole">
              <select className="ui-input" id="reviewRole" name="role" value={roleId} onChange={event => setRoleId(event.target.value)}>
                <option value="">{t('Every role')}</option>
                {store.roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}
              </select>
            </UiFormField>
            {store.branchesEnabled && (
              <UiFormField label={t('People')} for="reviewBranch">
                <select className="ui-input" id="reviewBranch" name="branch" value={branchId} onChange={event => setBranchId(event.target.value)}>
                  <option value="">{t('Everyone')}</option>
                  {store.branches.map(branch => <option key={branch.id} value={branch.id}>{t('peopleOf', { branch: branch.name })}</option>)}
                </select>
              </UiFormField>
            )}
          </div>
          <p className={cx('review-covers', !covered && 'review-covers-none')} aria-live="polite">
            {` ${t(covered ? 'reviewCovers' : 'Nobody holds these roles now.', { count: covered })} `}
          </p>
          <UiFormField label={t('Closes')} for="reviewDue" hint={t('At the end of that day the roles marked Remove are taken away. Roles nobody decided stay.')} required>
            <input className="ui-input review-date" type="date" id="reviewDue" name="due" value={due} onChange={event => setDue(event.target.value)}
              min={today} max={lastDay} />
          </UiFormField>
          <UiFormField label={t('Reviewers')} for="reviewReviewer" optionalLabel={t('(optional)')}
            hint={t('Each person\'s administrators decide about their roles. Add anyone else who should decide all of them, such as a department head.')}>
            <select className="ui-input" id="reviewReviewer" value="" onChange={event => addReviewer(event.target.value)} disabled={reviewerIds.length >= MAX_REVIEWERS}>
              <option value="">{t('Add a reviewer…')}</option>
              {candidates.map(user => <option key={user.id} value={user.id}>{fullName(user)}</option>)}
            </select>
            {reviewers.length > 0 && (
              <ul className="review-reviewers" aria-label={t('Reviewers')}>
                {reviewers.map(user => (
                  <li key={user.id}>
                    <span>{fullName(user)}</span>
                    <UiButton variant="ghost" size="sm" iconOnly type="button" onClick={() => removeReviewer(user.id)}
                      aria-label={t('removeReviewer', { name: fullName(user) })}>
                      <NgIcon svg={lucideX} />
                    </UiButton>
                  </li>
                ))}
              </ul>
            )}
          </UiFormField>
          {problem && <p className="review-problem" role="alert">{t(problem)}</p>}
        </form>
      </UiDialog>
    </app-start-review-dialog>
  );
}

/** A moment as a date input's value, in local time: "2026-10-31" */
function dateInput(ms: number): string {
  const date = new Date(ms);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** The last moment of a date, in local time: a review "closing on 31 Oct" takes all of that day */
function endOfDay(value: string): number {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 23, 59, 59, 999).getTime();
}
