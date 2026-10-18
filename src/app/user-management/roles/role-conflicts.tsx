import { useState } from 'react';
import { Link } from 'react-router';

import { lucideEllipsis, lucidePencil, lucidePlus, lucideShieldAlert, lucideTrash2 } from '../../icons';
import { useSession } from '../access/session';
import { adminStore, useAdmin } from '../data/admin-store';
import { fullName, type RoleConflict } from '../data/models';
import { RoleBadge } from '../shared/badges';
import { errorMessage } from '../shared/errors';
import { useFormat } from '../shared/formatting';
import {
  cx, NgIcon, uiConfirm, uiTableClass, uiToast, UiBadge, UiButton, UiCard, UiCheckbox, UiDialog, UiEmptyState, UiFormField, UiMenu, UiMenuDivider,
  UiMenuItem, UiMenuTrigger, UiPageHeader, UiPerson,
} from '../ui';
import './role-conflicts.scss';

/**
 * Roles nobody may hold at the same time, so that one person cannot both do and check the same work: NIST RBAC's
 * static separation of duty (API.md, "Conflicting roles"). Everyone who can see the roles reads the rules; roles.manage
 * adds, changes and deletes them. A rule made while people already hold its roles leaves them, and lists them here to
 * fix, as an access review would. Fills the window on desktop (page-fit): the lists scroll inside their cards.
 */
export function RoleConflictsComponent() {
  const store = useAdmin();
  const session = useSession();
  const { t } = useFormat();

  const canManage = session.can('roles.manage');
  /** The people to fix, while the signed-in user can see people at all */
  const toFix = session.can('users.view') ? store.roleConflictViolations : [];

  /** Each rule with how many people break it */
  const rows = store.roleConflicts.map(rule => ({
    rule,
    roleIds: rule.roleIds.filter(roleId => store.rolesById.has(roleId)),
    toFix: toFix.filter(item => item.rule.id === rule.id).length,
  }));

  /* Add and edit */

  const [editing, setEditing] = useState<RoleConflict | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState('');

  const open = (rule: RoleConflict | null) => {
    setEditing(rule);
    setName(rule?.name ?? '');
    setDescription(rule?.description ?? '');
    setPicked(rule ? [...rule.roleIds] : []);
    setProblem('');
    setDialogOpen(true);
  };

  const toggle = (roleId: string, checked: boolean) => setPicked(ids => checked ? [...ids, roleId] : ids.filter(id => id !== roleId));

  const save = async () => {
    const trimmed = name.trim();
    // In the order of the roles page
    const roleIds = store.roles.map(role => role.id).filter(id => picked.includes(id));
    if (!trimmed || roleIds.length < 2) {
      setProblem(!trimmed ? 'This field is required.' : 'Pick at least two roles.');
      return;
    }
    setSaving(true);
    setProblem('');
    try {
      const draft = { name: trimmed, description: description.trim(), roleIds };
      if (editing) {
        await adminStore.updateRoleConflict(editing.id, draft);
        uiToast.show(t('toast.ruleSaved', { name: trimmed }));
      } else {
        await adminStore.createRoleConflict(draft);
        uiToast.show(t('toast.ruleAdded', { name: trimmed }));
      }
      setDialogOpen(false);
    } catch (error) {
      setProblem(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (rule: RoleConflict) => {
    const confirmed = await uiConfirm.ask({
      title: t('confirm.deleteRule', { name: rule.name }),
      message: t('People can then hold these roles together again.'),
      confirmLabel: t('Delete'),
      cancelLabel: t('Cancel'),
      tone: 'danger',
    });
    if (!confirmed) {
      return;
    }
    try {
      await adminStore.deleteRoleConflict(rule.id);
      uiToast.show(t('toast.ruleDeleted', { name: rule.name }));
    } catch (error) {
      uiToast.show(t(errorMessage(error)), 'error');
    }
  };

  const roleBadges = (roleIds: string[]) => roleIds.map(roleId => <RoleBadge key={roleId} roleId={roleId} />);

  return (
    <app-role-conflicts className="page-fit">
      <UiPageHeader title={t('Conflicting roles')} subtitle={t('Roles nobody may hold at the same time, so one person cannot both do and check the same work.')}
        icon={lucideShieldAlert} breadcrumbLabel={t('Breadcrumb')}
        breadcrumbs={[{ label: t('User management') }, { label: t('Roles & permissions'), link: '/roles' }]}>
        {canManage && <UiButton type="button" onClick={() => open(null)}><NgIcon svg={lucidePlus} />{` ${t('Add rule')}`}</UiButton>}
      </UiPageHeader>

      <div className="conflicts-layout">
        <UiCard flush fit title={t('Rules')} description={t('Giving one of these roles to someone who holds another of the same rule is refused.')}>
          {rows.length ? (
            <div className="ui-table-scroll">
              <table className={cx(uiTableClass(true), 'rules-table')}>
                <thead>
                  <tr>
                    <th>{t('Rule')}</th>
                    <th className="hide-sm">{t('Roles')}</th>
                    <th className="cell-number">{t('To fix')}</th>
                    {canManage && <th className="ui-cell-shrink"><span className="ui-sr-only">{t('Actions')}</span></th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={row.rule.id}>
                      <td className="cell-rule">
                        <span className="rule-name">{row.rule.name}</span>
                        {row.rule.description && <span className="rule-description">{row.rule.description}</span>}
                        {/* Phones: the roles under the rule, in place of their column */}
                        <span className="rule-roles show-sm">{roleBadges(row.roleIds)}</span>
                      </td>
                      <td className="hide-sm">
                        <span className="rule-roles">{roleBadges(row.roleIds)}</span>
                      </td>
                      <td className="cell-number">
                        {row.toFix ? <UiBadge tone="danger">{row.toFix}</UiBadge> : <span className="muted">0</span>}
                      </td>
                      {canManage && (
                        <td className="ui-cell-shrink">
                          <UiMenuTrigger menu={
                            <UiMenu>
                              <UiMenuItem icon={lucidePencil} onTriggered={() => open(row.rule)}>{t('Edit')}</UiMenuItem>
                              <UiMenuDivider />
                              <UiMenuItem tone="danger" icon={lucideTrash2} onTriggered={() => void remove(row.rule)}>{t('Delete')}</UiMenuItem>
                            </UiMenu>
                          }>
                            <UiButton variant="ghost" size="sm" iconOnly type="button" aria-label={t('actionsFor', { name: row.rule.name })}>
                              <NgIcon svg={lucideEllipsis} />
                            </UiButton>
                          </UiMenuTrigger>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <UiEmptyState icon={lucideShieldAlert} title={t('No rules yet')} description={t('Add one for roles that should never be held by the same person.')}>
              {canManage && <UiButton type="button" onClick={() => open(null)}>{t('Add rule')}</UiButton>}
            </UiEmptyState>
          )}
        </UiCard>

        {toFix.length > 0 && (
          <UiCard className="to-fix" flush fit title={t('To fix')} description={t('They held these roles before the rule was made. Take one away on their profile.')}>
            <div className="ui-table-scroll">
              <table className={cx(uiTableClass(true), 'fix-table')}>
                <thead>
                  <tr>
                    <th>{t('User')}</th>
                    <th className="hide-sm">{t('Rule')}</th>
                    <th>{t('Roles they hold')}</th>
                  </tr>
                </thead>
                <tbody>
                  {toFix.map(item => (
                    <tr key={item.user.id + item.rule.id}>
                      <td>
                        <Link className="person-link" to={`/users/${item.user.id}?tab=roles`}>
                          <UiPerson name={fullName(item.user)} detail={item.user.email} src={item.user.avatar} size="xs" />
                        </Link>
                        {/* Phones: the rule under the person, in place of its column */}
                        <span className="rule-description show-sm">{item.rule.name}</span>
                      </td>
                      <td className="hide-sm">{item.rule.name}</td>
                      <td>
                        <span className="rule-roles">{roleBadges(item.roleIds)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </UiCard>
        )}
      </div>

      <UiDialog open={dialogOpen} onOpenChange={setDialogOpen} title={t(editing ? 'Edit rule' : 'Add rule')} closeLabel={t('Close')}
        footer={<>
          <UiButton variant="secondary" type="button" onClick={() => setDialogOpen(false)}>{t('Cancel')}</UiButton>
          <UiButton type="submit" form="ruleForm" loading={saving}>{t(editing ? 'Save changes' : 'Add rule')}</UiButton>
        </>}>
        <form className="rule-form" id="ruleForm" onSubmit={event => { event.preventDefault(); void save(); }} noValidate>
          <UiFormField label={t('Name')} for="ruleName" required>
            <input className="ui-input" id="ruleName" name="name" value={name} onChange={event => setName(event.target.value)} maxLength={100} autoComplete="off" />
          </UiFormField>
          <UiFormField label={t('Description')} for="ruleDescription" optionalLabel={t('(optional)')}>
            <textarea className="ui-input" id="ruleDescription" name="description" rows={2} value={description}
              onChange={event => setDescription(event.target.value)} maxLength={500}></textarea>
          </UiFormField>
          <UiFormField label={t('Roles nobody may hold together')} hint={t('Pick two or more.')} required>
            <div className="rule-role-checks" role="group" aria-label={t('Roles nobody may hold together')}>
              {store.roles.map(role => (
                <UiCheckbox key={role.id} checked={picked.includes(role.id)} onCheckedChange={checked => toggle(role.id, checked)}>{role.name}</UiCheckbox>
              ))}
            </div>
          </UiFormField>
          {problem && <p className="rule-problem" role="alert">{t(problem)}</p>}
        </form>
      </UiDialog>
    </app-role-conflicts>
  );
}
