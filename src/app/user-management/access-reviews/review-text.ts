import type { AdminView } from '../data/admin-store';
import type { AccessReview } from '../data/models';
import type { Translate } from '../shared/formatting';

/** What a review covers, as its pages say it: "Every role · People of Chiang Mai", "Role: Support · Everyone" */
export function reviewScope(review: AccessReview, store: AdminView, t: Translate): string {
  const role = review.roleId
    ? t('roleScope', { role: store.rolesById.get(review.roleId)?.name ?? t('Deleted role') })
    : t('Every role');
  const people = review.branchId
    ? t('peopleOf', { branch: store.branchesById.get(review.branchId)?.name ?? '' })
    : t('Everyone');
  return `${role} · ${people}`;
}
