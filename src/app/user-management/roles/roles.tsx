import { useLayoutEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { lucideCopy, lucideLock, lucidePlus, lucideSave, lucideShieldAlert, lucideShieldCheck, lucideTrash2, lucideUsers } from '../../icons';
import { useSession } from '../access/session';
import { adminStore, useAdmin } from '../data/admin-store';
import { ASSIGNMENT_MAX_DAYS, DEFAULT_ASSIGNMENT_RULES, PERMISSION_GROUPS, ROLE_TONES, TONE_NAMES, type PermissionGroup } from '../data/catalog';
import type { Permission, Role } from '../data/models';
import { errorMessage } from '../shared/errors';
import { useFormat } from '../shared/formatting';
import {
  cx, NgIcon, uiConfirm, uiToast, UiAlert, UiBadge, UiButton, UiCard, UiCheckbox, UiDialog, UiFormField, UiLinkButton, UiPageHeader, UiSearchInput,
  type UiTone,
} from '../ui';
import './roles.scss';

/** More roles than this, and the list gets a search box */
const SEARCH_FROM = 6;

/** The editor's copy of a role, until it is saved */
interface RoleDraft {
  name: string;
  description: string;
  tone: UiTone;
  permissions: ReadonlySet<Permission>;
  maxDays: number | null;
  reasonRequired: boolean;
}

function draftOf(role: Role | undefined): RoleDraft {
  return {
    name: role?.name ?? '',
    description: role?.description ?? '',
    tone: role?.tone ?? 'primary',
    permissions: new Set(role?.permissions ?? []),
    maxDays: role?.assignment.maxDays ?? null,
    reasonRequired: role?.assignment.reasonRequired ?? false,
  };
}

/**
 * Roles and what each allows. Fills the window on desktop (page-fit), the editor's buttons at the bottom as on the pages
 * with tables; the permissions and a long role list scroll inside.
 */
export function RolesComponent() {
  const store = useAdmin();
  const session = useSession();
  const { t } = useFormat();
  const navigate = useNavigate();
  /** ?role=… picks the role to edit */
  const roleParam = useSearchParams()[0].get('role');
  const roleList = useRef<HTMLElement>(null);

  /** People who hold roles that cannot be held together, for the count on the Conflicting roles button */
  const toFix = session.can('users.view') ? store.roleConflictViolations.length : 0;
  const [saving, setSaving] = useState(false);

  const selected: Role | undefined = store.rolesById.get(roleParam ?? '') ?? store.roles[0];

  /* Role list */

  /** The list gets a search box once there are more roles than fit at a glance */
  const searchable = store.roles.length > SEARCH_FROM;
  const [query, setQuery] = useState('');
  const needle = searchable ? query.trim().toLowerCase() : '';
  const shownRoles = needle ? store.roles.filter(role => `${role.name} ${role.description}`.toLowerCase().includes(needle)) : store.roles;

  // Editable copies of the selected role; they reset whenever another role is picked or saved
  const [draft, setDraft] = useState(() => draftOf(selected));
  const [draftRole, setDraftRole] = useState(selected);
  if (draftRole !== selected) {
    setDraftRole(selected);
    setDraft(draftOf(selected));
  }
  const edit = (changes: Partial<RoleDraft>) => setDraft(current => ({ ...current, ...changes }));

  // A value set elsewhere stays in the list
  const maxDayOptions = [...new Set([...ASSIGNMENT_MAX_DAYS, selected?.assignment.maxDays ?? null])].map(value => ({
    value,
    label: value === null ? t('No limit') : t('dayCount', { count: value }),
  }));

  /* What the signed-in user's role allows here */

  /** Without roles.manage the page is read-only */
  const canManage = session.can('roles.manage');
  /** Nobody changes the permissions of a role they hold, so they cannot lock themselves out or promote themselves */
  const isOwnRole = session.roles.some(role => role.id === selected?.id);
  /** Nobody changes a role that allows more than their own, as with people (see access-rules.ts) */
  const roleEditable = canManage && session.canAssign(selected);
  /** A built-in role's permissions come from the system */
  const matrixLocked = !roleEditable || isOwnRole || !!selected?.system;
  const isDefaultRole = selected?.id === store.settings.defaultRoleId;
  /** Some permissions are ones the signed-in user does not hold, so they cannot tick or untick them */
  const someLocked = !matrixLocked && PERMISSION_GROUPS.some(group => group.permissions.some(permission => !session.can(permission.key)));
  /** Roles to copy permissions from: only those that grant nothing the signed-in user lacks */
  const copyableRoles = store.roles.filter(role => session.canAssign(role));

  const dirty = !!selected && (draft.name !== selected.name || draft.description !== selected.description || draft.tone !== selected.tone
    || draft.permissions.size !== selected.permissions.length || selected.permissions.some(permission => !draft.permissions.has(permission))
    || draft.maxDays !== selected.assignment.maxDays || draft.reasonRequired !== selected.assignment.reasonRequired);

  const userCount = store.roleCounts.get(selected?.id ?? '') ?? 0;
  /** Someone holds it now, or will: it cannot be deleted yet */
  const inUse = store.users.some(user => store.holdsOrWillHold(user, selected?.id ?? ''));

  // The role being edited stays in sight in a long list, as after creating one or opening ?role=…
  useLayoutEffect(() => {
    const list = roleList.current;
    if (!list) {
      return undefined;
    }
    if (list.clientHeight) {
      keepActiveRoleInSight(list);
      return undefined;
    }
    // On a page just opened the list can have no height yet, and every row would seem out of sight: wait for it
    const sized = new ResizeObserver(() => {
      if (list.clientHeight) {
        sized.disconnect();
        keepActiveRoleInSight(list);
      }
    });
    sized.observe(list);
    return () => sized.disconnect();
  }, [selected, shownRoles]);

  /** Picks another role through ?role=…, keeping the scroll position */
  const switchTo = (roleId: string | null) => navigate({ search: roleId ? `?role=${encodeURIComponent(roleId)}` : '' }, { state: { scroll: 'manual' } });

  /** Opens a role in the editor; false, with a reminder, while the editor has unsaved changes */
  const select = (role: Role): boolean => {
    if (dirty) {
      uiToast.show(t('Save or discard your changes first.'), 'info');
      return false;
    }
    void switchTo(role.id);
    return true;
  };

  /** The dropdown on narrow screens; it stays on the role being edited when that cannot change yet (a controlled select) */
  const pick = (roleId: string) => {
    const role = store.rolesById.get(roleId);
    if (role) {
      select(role);
    }
  };

  /* Permission matrix */

  const has = (permission: Permission) => draft.permissions.has(permission);

  /** Whether this box can be changed: the page is editable and the signed-in user holds the permission */
  const editable = (permission: Permission) => !matrixLocked && session.can(permission);

  const groupEditable = (group: PermissionGroup) => group.permissions.some(permission => editable(permission.key));

  const toggleAll = (permissions: Permission[], on: boolean) => {
    const changed = permissions.filter(editable);
    if (!changed.length) {
      return;
    }
    setDraft(current => {
      const next = new Set(current.permissions);
      changed.forEach(permission => on ? next.add(permission) : next.delete(permission));
      return { ...current, permissions: next };
    });
  };

  const groupState = (group: PermissionGroup): 'all' | 'some' | 'none' => {
    const granted = group.permissions.filter(permission => has(permission.key)).length;
    return granted === group.permissions.length ? 'all' : granted ? 'some' : 'none';
  };

  const toggleGroup = (group: PermissionGroup) => toggleAll(group.permissions.map(permission => permission.key), groupState(group) !== 'all');

  /* Saving */

  const discard = () => setDraft(draftOf(selected));

  const save = async () => {
    const role = selected;
    if (!role || !draft.name.trim() || !roleEditable) {
      return;
    }
    setSaving(true);
    try {
      const assignment = { maxDays: draft.maxDays, reasonRequired: draft.reasonRequired };
      // A built-in role keeps the name, description and permissions the system gives it
      await adminStore.updateRole(role.id, role.system ? { tone: draft.tone, assignment } : {
        name: draft.name.trim(),
        description: draft.description.trim(),
        tone: draft.tone,
        permissions: PERMISSION_GROUPS.flatMap(group => group.permissions.map(permission => permission.key)).filter(has),
        assignment,
      });
      uiToast.show(t('toast.roleSaved', { name: draft.name.trim() }));
    } catch (error) {
      uiToast.show(t(errorMessage(error)), 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    const role = selected;
    if (!role) {
      return;
    }
    const confirmed = await uiConfirm.ask({
      title: t('confirm.deleteRole', { name: role.name }),
      message: t('This cannot be undone.'),
      confirmLabel: t('Delete'),
      cancelLabel: t('Cancel'),
      tone: 'danger',
    });
    if (!confirmed) {
      return;
    }
    try {
      await adminStore.deleteRole(role.id);
      uiToast.show(t('toast.roleDeleted', { name: role.name }));
      void switchTo(null);
    } catch (error) {
      uiToast.show(t(errorMessage(error)), 'error');
    }
  };

  /* New role dialog */

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [copyFrom, setCopyFrom] = useState('');
  /** The name field has been left once: empty, it shows as wrong from then on, as an Angular control stays touched */
  const [newNameTouched, setNewNameTouched] = useState(false);

  const openCreate = () => {
    setNewName('');
    setNewDescription('');
    setCopyFrom('');
    setCreating(true);
  };

  /** A new role of your own, starting as a copy of this one: the way to change what a built-in role allows */
  const duplicate = (role: Role) => {
    setNewName(t('copyOfRole', { name: role.name }).slice(0, 40));
    setNewDescription(role.description);
    setCopyFrom(role.id);
    setCreating(true);
  };

  const create = async () => {
    const name = newName.trim();
    if (!name) {
      return;
    }
    const source = store.rolesById.get(copyFrom);
    try {
      const role = await adminStore.createRole({
        name,
        description: newDescription.trim(),
        tone: ROLE_TONES[store.roles.length % ROLE_TONES.length],
        permissions: source ? [...source.permissions] : session.can('users.view') ? ['users.view'] : [],
        assignment: source ? { ...source.assignment } : { ...DEFAULT_ASSIGNMENT_RULES },
      });
      setCreating(false);
      uiToast.show(t('toast.roleCreated', { name: role.name }));
      void switchTo(role.id);
    } catch (error) {
      uiToast.show(t(errorMessage(error)), 'error');
    }
  };

  const deleteTitle = selected?.system ? 'Built-in roles cannot be deleted.'
    : inUse ? 'This role still has users. Move them to another role first.'
    : isDefaultRole ? 'New users get this role by default. Pick another default in the settings first.' : '';

  return (
    <app-roles className="page-fit">
      <UiPageHeader title={t('Roles & permissions')} subtitle={t('Decide what each group of people can see and change.')} icon={lucideShieldCheck}
        breadcrumbLabel={t('Breadcrumb')} breadcrumbs={[{ label: t('User management') }]}>
        <UiLinkButton variant="secondary" to="/roles/conflicts">
          <NgIcon svg={lucideShieldAlert} />{` ${t('Conflicting roles')} `}
          {toFix > 0 && <UiBadge tone="danger">{toFix}<span className="ui-sr-only">{` ${t('to fix')}`}</span></UiBadge>}
        </UiLinkButton>
        {canManage && <UiButton type="button" onClick={openCreate}><NgIcon svg={lucidePlus} />{` ${t('New role')}`}</UiButton>}
      </UiPageHeader>

      <div className="roles-layout">
        {/* Wide screens: every role in a card beside the editor, searchable once there are many */}
        <UiCard className="role-panel" flush fit title={t('Roles')} description={t('roleTotal', { count: store.roles.length })}>
          {searchable && (
            <div className="role-search">
              <UiSearchInput size="sm" value={query} onValueChange={setQuery} placeholder={t('Search roles')} ariaLabel={t('Search roles')} clearLabel={t('Clear search')} />
            </div>
          )}
          <nav ref={roleList} className="role-list" aria-label={t('Roles')}>
            {shownRoles.map(item => (
              <button key={item.id} type="button" className={cx('role-item', item.id === selected?.id && 'active')}
                aria-current={item.id === selected?.id ? 'true' : undefined} onClick={() => select(item)}>
                <span className={`role-dot tone-${item.tone}`}></span>
                <span className="role-text">
                  <span className="role-name">
                    {` ${item.name} `}
                    {item.system && <NgIcon svg={lucideLock} title={t('Built-in role')} />}
                  </span>
                  <span className="role-description" title={item.description}>{item.description}</span>
                </span>
                <span className="role-count"><NgIcon svg={lucideUsers} />{` ${store.roleCounts.get(item.id) ?? 0}`}</span>
              </button>
            ))}
            {!shownRoles.length && <p className="role-empty">{t('No roles match your search.')}</p>}
          </nav>
        </UiCard>

        {/* Narrow screens: a dropdown right above the editor */}
        <UiFormField className="role-picker" label={t('Role')} for="rolePicker">
          <select className="ui-input" id="rolePicker" value={selected?.id ?? ''} onChange={event => pick(event.target.value)}>
            {store.roles.map(item => (
              <option key={item.id} value={item.id}>{t('roleOption', { name: item.name, count: store.roleCounts.get(item.id) ?? 0 })}</option>
            ))}
          </select>
        </UiFormField>

        {/* Editor */}
        {selected && (
          <UiCard className="editor" fill title={t(roleEditable ? 'Edit role' : 'Role')} description={t('userCount', { count: userCount })}
            actions={
              <div className="editor-actions">
                {selected.system && <UiBadge tone="neutral"><NgIcon svg={lucideLock} />{` ${t('Built-in role')}`}</UiBadge>}
                {canManage && session.canAssign(selected) && (
                  <UiButton variant="ghost" size="sm" type="button" onClick={() => duplicate(selected)}><NgIcon svg={lucideCopy} />{` ${t('Duplicate')}`}</UiButton>
                )}
              </div>
            }
            footerClassName="editor-footer"
            footer={roleEditable && <>
              <UiButton variant="danger-soft" type="button" className="delete" disabled={selected.system || inUse || isDefaultRole}
                title={deleteTitle ? t(deleteTitle) : ''} onClick={() => void remove()}>
                <NgIcon svg={lucideTrash2} />{` ${t('Delete role')} `}
              </UiButton>
              <UiButton variant="secondary" type="button" disabled={!dirty} onClick={discard}>{t('Discard')}</UiButton>
              <UiButton type="button" disabled={!dirty || !draft.name.trim()} loading={saving} onClick={() => void save()}>
                <NgIcon svg={lucideSave} />{` ${t('Save changes')}`}
              </UiButton>
            </>}>
            {!canManage ? (
              <UiAlert className="editor-note" tone="info">{t('Your role can view roles but not change them.')}</UiAlert>
            ) : !roleEditable ? (
              <UiAlert className="editor-note" tone="info">{t('This role has permissions you do not have, so you cannot change it.')}</UiAlert>
            ) : selected.system ? (
              <UiAlert className="editor-note" tone="info">{t('Built-in roles keep the name and permissions the system gives them. Duplicate it to make a role of your own.')}</UiAlert>
            ) : isOwnRole ? (
              <UiAlert className="editor-note" tone="info">{t('This is your own role, so you cannot change its permissions. Another administrator can.')}</UiAlert>
            ) : someLocked && (
              <UiAlert className="editor-note" tone="neutral">{t('Permissions you do not have yourself cannot be changed.')}</UiAlert>
            )}

            <div className="editor-fields">
              <UiFormField label={t('Name')} for="roleName" required>
                <input className="ui-input" id="roleName" value={draft.name} onChange={event => edit({ name: event.target.value })} maxLength={40}
                  readOnly={!roleEditable || selected.system} />
              </UiFormField>
              <UiFormField label={t('Description')} for="roleDescription">
                <input className="ui-input" id="roleDescription" value={draft.description} onChange={event => edit({ description: event.target.value })}
                  maxLength={120} readOnly={!roleEditable || selected.system} />
              </UiFormField>
              <div className="tone-field">
                <span className="field-title">{t('Color')}</span>
                <div className="tone-swatches" role="radiogroup" aria-label={t('Color')}>
                  {ROLE_TONES.map(option => (
                    <button key={option} type="button" role="radio" className={cx(`swatch tone-${option}`, draft.tone === option && 'selected')}
                      aria-checked={draft.tone === option} aria-label={t(TONE_NAMES[option])} disabled={!roleEditable} onClick={() => edit({ tone: option })}></button>
                  ))}
                </div>
              </div>
              {/* How the role may be given, as Microsoft Entra PIM's role settings */}
              <UiFormField label={t('Longest assignment')} for="roleMaxDays" hint={t('With a limit, each time it is given it must end within that long.')}>
                <select className="ui-input" id="roleMaxDays" value={String(draft.maxDays)} disabled={!roleEditable}
                  onChange={event => edit({ maxDays: event.target.value === 'null' ? null : Number(event.target.value) })}>
                  {maxDayOptions.map(option => <option key={String(option.value)} value={String(option.value)}>{option.label}</option>)}
                </select>
              </UiFormField>
              <div className="reason-field">
                <UiCheckbox checked={draft.reasonRequired} disabled={!roleEditable} onCheckedChange={checked => edit({ reasonRequired: checked })}>
                  {t('Ask for a reason each time it is given')}
                </UiCheckbox>
              </div>
            </div>

            <div className="matrix">
              {PERMISSION_GROUPS.map(group => (
                <section key={group.key} className="matrix-group">
                  <header className="matrix-head">
                    <UiCheckbox checked={groupState(group) === 'all'} indeterminate={groupState(group) === 'some'} disabled={!groupEditable(group)}
                      onCheckedChange={() => toggleGroup(group)}>
                      <span className="matrix-title">{t(group.label)}</span>
                    </UiCheckbox>
                  </header>
                  <div className="matrix-items">
                    {group.permissions.map(permission => (
                      <UiCheckbox key={permission.key} checked={has(permission.key)} disabled={!editable(permission.key)}
                        onCheckedChange={checked => toggleAll([permission.key], checked)}>
                        {` ${t(permission.label)} `}
                        <code className="permission-key">{permission.key}</code>
                      </UiCheckbox>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </UiCard>
        )}
      </div>

      <UiDialog open={creating} onOpenChange={setCreating} title={t('New role')} description={t('Start from scratch or copy another role\'s permissions.')}
        closeLabel={t('Close')}
        footer={<>
          <UiButton variant="secondary" type="button" onClick={() => setCreating(false)}>{t('Cancel')}</UiButton>
          <UiButton type="submit" form="newRoleForm" disabled={!newName.trim()}>{t('Create role')}</UiButton>
        </>}>
        <form className="dialog-form" id="newRoleForm" onSubmit={event => { event.preventDefault(); void create(); }} noValidate>
          <UiFormField label={t('Name')} for="newRoleName" required>
            <input className={cx('ui-input', newNameTouched && !newName && 'ng-invalid ng-touched')} id="newRoleName" name="name" value={newName}
              onChange={event => setNewName(event.target.value)} onBlur={() => setNewNameTouched(true)} maxLength={40} required />
          </UiFormField>
          <UiFormField label={t('Description')} for="newRoleDescription" optionalLabel={t('(optional)')}>
            <input className="ui-input" id="newRoleDescription" name="description" value={newDescription} onChange={event => setNewDescription(event.target.value)}
              maxLength={120} />
          </UiFormField>
          <UiFormField label={t('Copy permissions from')} for="copyFrom">
            <select className="ui-input" id="copyFrom" name="copyFrom" value={copyFrom} onChange={event => setCopyFrom(event.target.value)}>
              <option value="">{t('None (view users only)')}</option>
              {copyableRoles.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </UiFormField>
        </form>
      </UiDialog>
    </app-roles>
  );
}

/** Scrolls the list just enough to show the role being edited; only the list scrolls, never the page around it */
function keepActiveRoleInSight(list: HTMLElement) {
  const row = list.querySelector<HTMLElement>('.role-item.active');
  if (!row) {
    return;
  }
  const listBox = list.getBoundingClientRect();
  const rowBox = row.getBoundingClientRect();
  if (rowBox.top < listBox.top) {
    list.scrollTop -= listBox.top - rowBox.top;
  } else if (rowBox.bottom > listBox.bottom) {
    list.scrollTop += rowBox.bottom - listBox.bottom;
  }
}
