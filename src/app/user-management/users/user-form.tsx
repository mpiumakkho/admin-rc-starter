import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router';

import { lucideSave, lucideShieldPlus, lucideUserPen, lucideUserPlus, lucideUserX, lucideX } from '../../icons';
import { session as sessionService, useSession } from '../access/session';
import { AdminApiError } from '../data/admin-api';
import { adminStore, useAdmin } from '../data/admin-store';
import { DEPARTMENTS, EMAIL_LANGUAGES, STATUS_META } from '../data/catalog';
import { fullName, type Language, type RoleGrant, type UserStatus } from '../data/models';
import { RoleBadge, RoleBadges } from '../shared/badges';
import { errorMessage } from '../shared/errors';
import { EMAIL_PATTERN, FORM_BEHAVIOUR, controlName, fieldControl, invalidClass } from '../shared/forms';
import { useFormat } from '../shared/formatting';
import { useLeaveGuard } from '../shared/leave-guard';
import {
  cx, NgIcon, uiConfirm, uiToast, UiAlert, UiButton, UiCard, UiEmptyState, UiFileDropzone, UiFormField, UiLinkButton, UiPageHeader, UiSegmented,
  type UiOption,
} from '../ui';
import { RoleAssignmentDialog } from './role-assignment-dialog';
import './user-form.scss';

const AVATAR_SIZE = 160;

const LANGUAGES = Object.entries(EMAIL_LANGUAGES).map(([code, name]) => ({ code, name }));

interface UserFormValues {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  department: string;
  /** Empty: no branch */
  branchId: string;
  /** Empty: the settings' language, until they use the app */
  language: Language | '';
  status: UserStatus;
  avatar: string;
}

/**
 * Adds a user, or edits one (/users/:id/edit). Fills the window on desktop (page-fit), the buttons at the bottom as on
 * the pages with tables; the fields scroll inside the card when they are taller than the window. Leaving with changes
 * not saved asks first.
 */
export function UserFormComponent() {
  const store = useAdmin();
  const session = useSession();
  const f = useFormat();
  const { t } = f;
  const navigate = useNavigate();
  /** From the route: missing when adding a user */
  const id = useParams()['id'];

  const [saving, setSaving] = useState(false);
  const saved = useRef(false);
  /** Changed by hand since the page opened, as an Angular form is dirty */
  const dirty = useRef(false);

  const user = id ? store.usersById.get(id) : undefined;
  const isEdit = !!id;
  const canListUsers = session.canSomewhere('users.view');
  const notFound = isEdit && store.loaded && !user;
  /** People cannot change their own role or status, so they cannot lock themselves out or promote themselves */
  const isSelf = isEdit && id === session.userId;
  /** Without users.edit, people editing their own profile change only their name, phone and photo */
  const profileOnly = isSelf && !session.allows('users.edit', user?.branchId ?? null);
  /** What adding or editing someone needs: through a branch, it reaches that branch's people only */
  const permission = isEdit ? 'users.edit' as const : 'users.create' as const;
  /** "No branch" is for those who have the permission for the whole organization */
  const noBranchAllowed = session.allows(permission, null);
  /** With branches off, the field still shows for someone who adds people only through branches */
  const showBranch = store.branchesEnabled || !noBranchAllowed;
  const defaultLanguage = EMAIL_LANGUAGES[store.settings.defaultLanguage];
  /**
   * Open branches to pick from, and the one someone already belongs to even when it has closed; through a branch, the
   * ones the signed-in user looks after
   */
  const branchChoices = store.branches.filter(branch =>
    (branch.active && session.allows(permission, branch.id)) || branch.id === user?.branchId);

  // Filled from the user when editing, as the page opens
  const form = useForm<UserFormValues>({
    ...FORM_BEHAVIOUR,
    defaultValues: user ? {
      firstName: user.firstName, lastName: user.lastName, email: user.email, phone: user.phone, department: user.department,
      branchId: user.branchId ?? '', language: user.language ?? '', status: user.status, avatar: user.avatar,
    } : {
      firstName: '', lastName: '', email: '', phone: '', department: DEPARTMENTS[0],
      // Through a branch, new people join one of the signed-in user's branches
      branchId: noBranchAllowed ? '' : branchChoices[0]?.id ?? '',
      language: '', status: 'invited', avatar: '',
    },
  });
  const status = form.watch('status');
  const avatar = form.watch('avatar');

  useEffect(() => {
    const watching = form.watch((_, change) => {
      if (change.type === 'change') {
        dirty.current = true;
      }
    });
    return () => watching.unsubscribe();
  }, [form]);

  /**
   * The default role from the settings, for good, when the signed-in user may give it; otherwise the least powerful
   * role they may give that has no rules of its own. Through a branch, none: the server gives the default role limited
   * to the new user's branch.
   */
  const defaultGrants = (): RoleGrant[] => {
    const assignable = store.roles.filter(role => session.canGive(role, null, 'users.create')
      && role.assignment.maxDays === null && !role.assignment.reasonRequired);
    const role = assignable.find(item => item.id === store.settings.defaultRoleId)
      ?? [...assignable].sort((a, b) => a.permissions.length - b.permissions.length)[0];
    return role ? [{ roleId: role.id, endsAt: null }] : [];
  };
  /** A new user's first roles: the default role to begin with, when the signed-in user may give it */
  const [grants, setGrants] = useState<RoleGrant[]>(defaultGrants);
  const grantedIds = grants.map(grant => grant.roleId);
  const [addingRole, setAddingRole] = useState(false);

  /** Someone else's roles, changed on their profile */
  const canChangeRoles = !!user && !isSelf && session.canOn('users.edit', user);

  const statusOptions: UiOption<UserStatus>[] = (Object.keys(STATUS_META) as UserStatus[]).map(value => ({ value, label: t(STATUS_META[value].label) }));
  const title = user ? fullName(user) : '';

  // Error message per validation error, translated
  const errorMessages: Record<string, string> = {
    required: t('This field is required.'),
    maxLength: t('Use 50 characters or fewer.'),
    email: t('Enter a valid email address.'),
    taken: t('Another user already has this email.'),
    pattern: t('Use 9 to 15 digits.'),
    domain: t('emailDomainHint', { domains: store.settings.allowedDomains.join(', ') }),
  };

  const branchName = (branchId: string) => store.branchesById.get(branchId)?.name ?? '';
  const roleName = (roleId: string) => store.rolesById.get(roleId)?.name ?? '';

  const addGrant = (grant: RoleGrant) => {
    setGrants(current => [...current, grant]);
    dirty.current = true;
  };

  const removeGrant = (roleId: string) => {
    setGrants(current => current.filter(grant => grant.roleId !== roleId));
    dirty.current = true;
  };

  /** Allowed domains from the settings; a user keeps an email they already have */
  const emailDomain = (value: string) => {
    const email = String(value ?? '').trim().toLowerCase();
    const domains = store.settings.allowedDomains;
    const unchanged = email === user?.email.toLowerCase();
    return !(email.includes('@') && domains.length && !unchanged && !domains.includes(email.split('@')[1]));
  };

  const emailFree = (value: string) => !value || !store.isEmailTaken(value, id);

  /** Shrinks the picked image to a small square, so it fits in storage */
  const pickAvatar = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      uiToast.show(t('Choose an image file.'), 'error');
      return;
    }
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = AVATAR_SIZE;
    const side = Math.min(bitmap.width, bitmap.height);
    canvas.getContext('2d')!.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
    form.setValue('avatar', canvas.toDataURL('image/jpeg', 0.85));
    dirty.current = true;
  };

  const removeAvatar = () => {
    form.setValue('avatar', '');
    dirty.current = true;
  };

  const save = form.handleSubmit(async () => {
    // Every field, the ones that cannot be changed here too, as Angular's getRawValue
    const { branchId, language, avatar, ...rest } = form.getValues();
    const profile = { ...rest, branchId: branchId || null, language: language || null };
    setSaving(true);
    try {
      // The photo goes only when it changed: one kept from before stays as it is
      const result = id
        ? await adminStore.updateUser(id, avatar === user?.avatar ? profile : { ...profile, avatar })
        : await adminStore.createUser({ ...profile, avatar, roles: grants });
      saved.current = true;
      uiToast.show(t(id ? 'toast.userUpdated' : 'toast.userCreated', { name: fullName(result) }));
      void navigate(`/users/${result.id}`);
    } catch (error) {
      if (error instanceof AdminApiError && (error.code === 'email_taken' || error.code === 'email_domain')) {
        form.setError('email', { type: error.code === 'email_taken' ? 'taken' : 'domain' });
      } else {
        uiToast.show(t(errorMessage(error)), 'error');
      }
    } finally {
      setSaving(false);
    }
  }, () => uiToast.show(t('Check the highlighted fields.'), 'error'));

  // Asks before leaving with unsaved changes; after the session ended there is nothing to save to, so it leaves without asking
  useLeaveGuard(() => !saved.current && dirty.current && sessionService.view.signedIn, () => uiConfirm.ask({
    title: t('Discard your changes?'),
    message: t('The changes you made on this page are not saved yet.'),
    confirmLabel: t('Discard'),
    cancelLabel: t('Keep editing'),
    tone: 'danger',
  }));

  if (notFound) {
    return (
      <app-user-form className="page-fit">
        <UiCard>
          <UiEmptyState icon={lucideUserX} title={t('User not found')} description={t('They may have been deleted.')}>
            <UiLinkButton variant="secondary" to="/users">{t('Back to users')}</UiLinkButton>
          </UiEmptyState>
        </UiCard>
      </app-user-form>
    );
  }

  return (
    <app-user-form className="page-fit">
      <UiPageHeader
        title={isSelf ? t('Edit profile') : isEdit ? t('Edit user') : t('Add user')}
        subtitle={isEdit ? title : t('Create an account and choose what they can do.')}
        icon={isEdit ? lucideUserPen : lucideUserPlus}
        breadcrumbLabel={t('Breadcrumb')} breadcrumbs={canListUsers ? [{ label: t('Users'), link: '/users' }] : []} />

      <form onSubmit={event => void save(event)} noValidate>
        <UiCard fill footer={<>
          <UiLinkButton variant="secondary" to={isEdit ? `/users/${id}` : '/users'}>{t('Cancel')}</UiLinkButton>
          <UiButton type="submit" loading={saving}><NgIcon svg={lucideSave} />{` ${isEdit ? t('Save changes') : t('Add user')}`}</UiButton>
        </>}>
          {/* Two columns of sections on a wide page, one when narrow */}
          <div className="form-grid">
            <section className="form-section">
              <div className="form-section-intro">
                <h2>{t('Profile')}</h2>
                <p>{t('Name, photo, contact details and team.')}</p>
              </div>
              <div className="field-grid">
                <UiFormField className="span-2" label={t('Photo')}>
                  <UiFileDropzone compact accept="image/*" preview={avatar} title={t('Click to upload or drag and drop')}
                    hint={t('A PNG or JPG image. It is cropped to a square.')} removeLabel={t('Remove photo')}
                    onFileSelected={file => void pickAvatar(file)} onRemoved={removeAvatar} />
                </UiFormField>
                <UiFormField label={t('First name')} for="firstName" required errors={errorMessages} control={fieldControl(form, 'firstName')}>
                  <input className={cx('ui-input', invalidClass(form, 'firstName'))} id="firstName" autoComplete="given-name"
                    {...controlName('firstName')} {...form.register('firstName', { required: true, maxLength: 50 })} />
                </UiFormField>
                <UiFormField label={t('Last name')} for="lastName" required errors={errorMessages} control={fieldControl(form, 'lastName')}>
                  <input className={cx('ui-input', invalidClass(form, 'lastName'))} id="lastName" autoComplete="family-name"
                    {...controlName('lastName')} {...form.register('lastName', { required: true, maxLength: 50 })} />
                </UiFormField>
                <UiFormField className="span-2" label={t('Email')} for="email" required errors={errorMessages} control={fieldControl(form, 'email')}
                  hint={t('Used to sign in.')}>
                  <input className={cx('ui-input', invalidClass(form, 'email'))} id="email" type="email" autoComplete="email" placeholder="name@example.com"
                    disabled={profileOnly} {...controlName('email')} {...form.register('email', {
                      required: true,
                      validate: { email: value => !value || EMAIL_PATTERN.test(value), taken: emailFree, domain: emailDomain },
                    })} />
                </UiFormField>
                <UiFormField label={t('Phone')} for="phone" optionalLabel={t('(optional)')} errors={errorMessages} control={fieldControl(form, 'phone')}>
                  <input className={cx('ui-input', invalidClass(form, 'phone'))} id="phone" type="tel" autoComplete="tel" placeholder="0812345678"
                    {...controlName('phone')} {...form.register('phone', { pattern: /^[0-9+\-\s]{9,15}$/ })} />
                </UiFormField>
                <UiFormField label={t('Department')} for="department" required errors={errorMessages} control={fieldControl(form, 'department')}>
                  <select className={cx('ui-input', invalidClass(form, 'department'))} id="department" disabled={profileOnly}
                    {...controlName('department')} {...form.register('department', { required: true })}>
                    {DEPARTMENTS.map(department => <option key={department} value={department}>{t(department)}</option>)}
                  </select>
                </UiFormField>
                {showBranch && (
                  <UiFormField label={t('Branch')} for="branchId" optionalLabel={noBranchAllowed ? t('(optional)') : ''} required={!noBranchAllowed}>
                    <select className="ui-input" id="branchId" disabled={profileOnly} {...controlName('branchId')} {...form.register('branchId')}>
                      {noBranchAllowed && <option value="">{t('No branch')}</option>}
                      {branchChoices.map(branch => (
                        <option key={branch.id} value={branch.id}>{branch.active ? branch.name : t('closedBranch', { name: branch.name })}</option>
                      ))}
                    </select>
                  </UiFormField>
                )}
                <UiFormField label={t('Email language')} for="language" hint={t('Their emails are in this language. The app keeps it to the one they last used.')}>
                  <select className="ui-input" id="language" {...controlName('language')} {...form.register('language')}>
                    <option value="">{t('sameAsSettings', { language: defaultLanguage })}</option>
                    {LANGUAGES.map(language => <option key={language.code} value={language.code} lang={language.code}>{language.name}</option>)}
                  </select>
                </UiFormField>
              </div>
            </section>

            <section className="form-section">
              <div className="form-section-intro">
                <h2>{t('Role and status')}</h2>
                <p>{t('Decides what they can see and change.')}</p>
              </div>
              <div className="field-stack">
                {profileOnly ? (
                  <UiAlert tone="info">{t('You can change your name, phone and photo. Ask an administrator to change anything else.')}</UiAlert>
                ) : isSelf && (
                  <UiAlert tone="info">{t('You cannot change your own role or status. Ask another administrator.')}</UiAlert>
                )}
                {user ? (
                  // Roles change on the profile, one assignment at a time, each saved at once
                  <div className="roles-field" role="group" aria-labelledby="rolesLabel">
                    <span className="roles-label" id="rolesLabel">{t('Roles')}</span>
                    <RoleBadges user={user} max={6} />
                    {canChangeRoles && <Link className="roles-link" to={`/users/${user.id}?tab=roles`}>{t('Change roles on the profile')}</Link>}
                  </div>
                ) : (
                  <div className="roles-field" role="group" aria-labelledby="rolesLabel">
                    <span className="roles-label" id="rolesLabel">{t('Roles')}</span>
                    <ul className="grant-list">
                      {grants.map(grant => (
                        <li key={grant.roleId} className="grant">
                          <RoleBadge roleId={grant.roleId} />
                          <span className="grant-when">
                            {grant.branchId && ` ${branchName(grant.branchId)} · `}
                            {grant.startsAt && ` ${t('fromDate', { date: f.localDate(grant.startsAt) })} · `}
                            {` ${grant.endsAt ? t('untilDate', { date: f.localDate(grant.endsAt) }) : t('For good')} `}
                          </span>
                          <UiButton variant="ghost" size="sm" iconOnly type="button" className="grant-remove" onClick={() => removeGrant(grant.roleId)}
                            aria-label={t('removeRoleNamed', { role: roleName(grant.roleId) })} title={t('removeRoleNamed', { role: roleName(grant.roleId) })}>
                            <NgIcon svg={lucideX} />
                          </UiButton>
                        </li>
                      ))}
                      {!grants.length && <li className="grant-none">{t('noRolesGetDefault', { role: roleName(store.settings.defaultRoleId) })}</li>}
                    </ul>
                    <UiButton variant="secondary" size="sm" type="button" className="grant-add" onClick={() => setAddingRole(true)}>
                      <NgIcon svg={lucideShieldPlus} />{` ${t('Add a role')}`}
                    </UiButton>
                  </div>
                )}
                <UiFormField label={t('Status')} hint={t('Invited users get an email to set their password. Suspended users cannot sign in.')}>
                  <UiSegmented options={statusOptions} value={status} {...controlName('status')} disabled={isSelf} ariaLabel={t('Status')}
                    onValueChange={value => { form.setValue('status', value); dirty.current = true; }} />
                </UiFormField>
              </div>
            </section>
          </div>
        </UiCard>
      </form>
      {/* Outside the form above: the dialog has a form of its own, and a form inside a form is not valid HTML */}
      {!user && <RoleAssignmentDialog draft exclude={grantedIds} open={addingRole} onOpenChange={setAddingRole} onGranted={addGrant} />}
    </app-user-form>
  );
}
