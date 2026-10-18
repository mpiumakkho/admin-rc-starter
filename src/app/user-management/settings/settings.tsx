import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { lucideHistory, lucideKeyRound, lucideSave, lucideSettings, lucideShieldCheck, lucideUndo2, lucideUserPlus } from '../../icons';
import { session as sessionService, useSession } from '../access/session';
import { useActivityFormat } from '../activity/activity-format';
import { adminStore, useAdmin } from '../data/admin-store';
import {
  ACTIVITY_RETENTION_DAYS, EMAIL_LANGUAGES, INVITE_EXPIRY_DAYS, PASSWORD_HISTORY, PASSWORD_MIN_LENGTHS, REASON_ACTIONS, REAUTH_MINUTES,
  SESSION_TIMEOUT_MINUTES, SUSPEND_INACTIVE_DAYS,
} from '../data/catalog';
import type { ActivityChange, AdminSettings, Language, ReasonAction } from '../data/models';
import { errorMessage } from '../shared/errors';
import { controlName } from '../shared/forms';
import { idleTimeoutLabel, inactiveLabel, passwordHistoryLabel, reauthLabel, retentionLabel, useFormat, type Translate } from '../shared/formatting';
import { useLeaveGuard } from '../shared/leave-guard';
import {
  cx, NgIcon, uiConfirm, uiToast, UiAlert, UiBadge, UiButton, UiCard, UiCheckbox, UiDialog, UiFormField, UiPageHeader, UiSegmented, UiSwitch,
  type UiFieldControl, type UiIcon, type UiOption,
} from '../ui';
import './settings.scss';

const DOMAIN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i;

/** "example.com, Example.co.th" → ["example.com", "example.co.th"] */
function parseDomains(text: string): string[] {
  return [...new Set(text.split(/[,\s]+/).map(domain => domain.trim().toLowerCase().replace(/^@/, '')).filter(Boolean))];
}

type SettingKey = keyof AdminSettings;

/** The settings as the form holds them: the domains as the text typed */
type FormValue = Omit<AdminSettings, 'allowedDomains'> & { allowedDomains: string };

/** The settings kept as a list: a change adds or takes away items, in any order */
const LIST_SETTINGS: readonly SettingKey[] = ['allowedDomains', 'twoFactorRoleIds', 'reasonsRequired'];

/** The groups of settings in the list on the left, each setting in one group, in the order they show */
export const SETTINGS_SECTIONS = [
  {
    key: 'new-users', label: 'New users', description: 'What people start with when an admin adds or invites them.', icon: lucideUserPlus,
    fields: ['defaultRoleId', 'inviteExpiryDays', 'allowedDomains', 'defaultLanguage', 'branchesEnabled'],
  },
  {
    key: 'sign-in', label: 'Sign-in', description: 'Keeps accounts safe on shared or unattended computers.', icon: lucideShieldCheck,
    fields: ['sessionTimeoutMinutes', 'reauthMinutes', 'suspendInactiveDays', 'twoFactorRoleIds'],
  },
  {
    key: 'passwords', label: 'Passwords', description: 'Rules for new passwords. They apply the next time someone sets one.', icon: lucideKeyRound,
    fields: ['passwordMinLength', 'passwordHistory'],
  },
  {
    key: 'activity-log', label: 'Activity log', description: 'How long each change stays in the log, and which changes must say why.',
    icon: lucideHistory, fields: ['activityRetentionDays', 'reasonsRequired'],
  },
] as const satisfies readonly { key: string; label: string; description: string; icon: UiIcon; fields: readonly SettingKey[] }[];

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

/** A setting changed on the page and not saved yet, in the shape the activity log keeps once it is saved */
interface PendingChange extends ActivityChange {
  field: SettingKey;
  section: SettingsSection;
}

/** Each by its own name */
const LANGUAGES = Object.entries(EMAIL_LANGUAGES).map(([code, name]) => ({ code, name }));

/** The changes that can require a reason, in the order of REASON_ACTIONS */
const REASON_LIST = (Object.keys(REASON_ACTIONS) as ReasonAction[]).map(key => ({ key, label: REASON_ACTIONS[key] }));

function toForm(settings: AdminSettings): FormValue {
  return { ...settings, allowedDomains: settings.allowedDomains.join(', ') };
}

function toSettings(value: FormValue): AdminSettings {
  return { ...value, allowedDomains: parseDomains(value.allowedDomains) };
}

/** Each setting in the form that differs from the saved one, in the order of the groups */
function changesOf(saved: AdminSettings, value: FormValue): PendingChange[] {
  const now = toSettings(value);
  return SETTINGS_SECTIONS.flatMap(section => section.fields.flatMap<PendingChange>(field => {
    if (LIST_SETTINGS.includes(field)) {
      const before = saved[field] as readonly string[];
      const after = now[field] as readonly string[];
      const added = after.filter(item => !before.includes(item));
      const removed = before.filter(item => !after.includes(item));
      return added.length || removed.length ? [{ field, section, added, removed }] : [];
    }
    return saved[field] === now[field] ? [] : [{ field, section, from: String(saved[field]), to: String(now[field]) }];
  }));
}

/** What is wrong with a setting as the form holds it, by Angular's error keys */
function errorsOf(value: FormValue, field: SettingKey): Record<string, boolean> | null {
  if (field === 'defaultRoleId' && !value.defaultRoleId) {
    return { required: true };
  }
  if (field === 'allowedDomains' && !parseDomains(value.allowedDomains).every(domain => DOMAIN.test(domain))) {
    return { domains: true };
  }
  return null;
}

/** "New users and Passwords", in the language of the page */
function sectionNames(t: Translate, sections: readonly SettingsSection[]): string {
  const names = sections.map(section => t(section.label));
  return names.length > 1 ? t('listAnd', { items: names.slice(0, -1).join(', '), last: names.at(-1) }) : names[0] ?? '';
}

/**
 * How new accounts and sign-ins work. Anyone with settings.view can read it; settings.manage can change it.
 *
 * The groups of settings are listed as the roles are on their page, one open at a time (?section=…). Unlike roles, the
 * settings are one record saved at once: a change in one group stays while another is open, the list marks the groups
 * with changes, and one Save sends all of them, so the log has one entry and the password is asked for once. Fills the
 * window on desktop (page-fit), the buttons at the bottom as on the pages with tables; the settings scroll inside the
 * card when they are taller than the window.
 */
export function SettingsComponent() {
  const store = useAdmin();
  const session = useSession();
  const { t } = useFormat();
  const format = useActivityFormat();
  const navigate = useNavigate();
  /** From ?section=…; the first group when there is none */
  const sectionParam = useSearchParams()[0].get('section');

  const canManage = session.can('settings.manage');
  const [saving, setSaving] = useState(false);
  /** The list of the changes not saved yet is open */
  const [reviewing, setReviewing] = useState(false);

  const selected: SettingsSection = SETTINGS_SECTIONS.find(section => section.key === sectionParam) ?? SETTINGS_SECTIONS[0];

  // The form: the settings as saved when the page opened, and which fields were left or changed by hand
  const [value, setValue] = useState<FormValue>(() => toForm(store.settings));
  const [touched, setTouched] = useState<ReadonlySet<SettingKey>>(new Set());
  const [dirty, setDirty] = useState<ReadonlySet<SettingKey>>(new Set());

  const edit = <K extends SettingKey>(field: K, next: FormValue[K]) => {
    setValue(current => ({ ...current, [field]: next }));
    setDirty(current => new Set(current).add(field));
  };
  const touch = (field: SettingKey) => setTouched(current => new Set(current).add(field));
  const reset = (settings: AdminSettings) => {
    setValue(toForm(settings));
    setTouched(new Set());
    setDirty(new Set());
  };
  const control = (field: SettingKey): UiFieldControl => ({ errors: errorsOf(value, field), touched: touched.has(field), dirty: dirty.has(field) });
  /** The library's red border, on a field left with a value that is not right */
  const invalidClass = (field: SettingKey) => errorsOf(value, field) && touched.has(field) ? 'ng-invalid ng-touched' : undefined;

  /** Each setting that differs from the saved one, in the order of the groups; changing one back takes it off */
  const changes = changesOf(store.settings, value);

  /** The groups with changes, each with its own */
  const changedSections = SETTINGS_SECTIONS
    .map(section => ({ section, changes: changes.filter(change => change.section === section) }))
    .filter(group => group.changes.length);

  /** How many changes each group has, for the marks in the list */
  const changeCounts = new Map<string, number>(changedSections.map(group => [group.section.key, group.changes.length]));

  /** The groups with a field showing an error, so the list says where to look */
  const invalidSections = new Set(SETTINGS_SECTIONS
    .filter(section => section.fields.some(field => errorsOf(value, field) && (touched.has(field) || dirty.has(field))))
    .map(section => section.key));

  /** Saving would hold the signed-in administrator back until they turn on two-step sign-in themselves (API.md) */
  const holdsBackSelf = !!session.user && !session.user.twoFactor && session.roles.some(role => value.twoFactorRoleIds.includes(role.id));
  /** Saving would hold the signed-in administrator back: said wherever Save can be pressed, not only under the roles */
  const holdsBackSelfOnSave = changes.some(change => change.field === 'twoFactorRoleIds') && holdsBackSelf;

  const expiryOptions: UiOption<number>[] = INVITE_EXPIRY_DAYS.map(days => ({ value: days, label: t('dayCount', { count: days }) }));
  const timeoutOptions = SESSION_TIMEOUT_MINUTES.map(minutes => ({ value: minutes, label: idleTimeoutLabel(t, minutes) }));
  const reauthOptions = REAUTH_MINUTES.map(minutes => ({ value: minutes, label: reauthLabel(t, minutes) }));
  const inactiveOptions = SUSPEND_INACTIVE_DAYS.map(days => ({ value: days, label: inactiveLabel(t, days) }));
  const passwordLengthOptions = PASSWORD_MIN_LENGTHS.map(count => ({ value: count, label: t('characterCount', { count }) }));
  const historyOptions = PASSWORD_HISTORY.map(count => ({ value: count, label: passwordHistoryLabel(t, count) }));
  const retentionOptions = ACTIVITY_RETENTION_DAYS.map(days => ({ value: days, label: retentionLabel(t, days) }));

  const errorMessages = {
    required: t('This field is required.'),
    domains: t('Enter domains such as example.com, separated by commas.'),
  };

  /** Opens a group; the changes in the others stay */
  const open = (section: SettingsSection) => {
    setReviewing(false);
    void navigate({ search: section === SETTINGS_SECTIONS[0] ? '' : `?section=${section.key}` }, { state: { scroll: 'manual' } });
  };

  /** A group in the dropdown, with how many of its changes are not saved */
  const sectionOption = (section: SettingsSection) => {
    const label = t(section.label);
    const count = changeCounts.get(section.key);
    return count ? t('sectionChanged', { section: label, count }) : label;
  };

  /** One change as the activity log shows it once saved, every item of a list named */
  const describe = (change: PendingChange) => {
    if (change.added || change.removed) {
      return [
        ...(change.added ?? []).map(item => '+' + format.listItem(change.field, item)),
        ...(change.removed ?? []).map(item => '−' + format.listItem(change.field, item)),
      ].join(', ');
    }
    return `${format.value(change.field, change.from)} → ${format.value(change.field, change.to)}`;
  };

  /** Puts settings back as they were saved, as Angular's setValue and markAsUntouched for each */
  const undoFields = (fields: readonly SettingKey[]) => {
    const original = toForm(store.settings);
    const next = { ...value };
    fields.forEach(field => Object.assign(next, { [field]: original[field] }));
    setValue(next);
    setTouched(current => new Set([...current].filter(field => !fields.includes(field))));
    if (!changesOf(store.settings, next).length) {
      setReviewing(false);
    }
  };

  /** Every change, in every group; asks first when some are in groups out of sight */
  const discard = async () => {
    const elsewhere = changedSections.filter(group => group.section !== selected);
    if (elsewhere.length && !reviewing) {
      const confirmed = await uiConfirm.ask({
        title: t('Discard all changes?'),
        message: t('discardElsewhere', { sections: sectionNames(t, elsewhere.map(group => group.section)) }),
        confirmLabel: t('Discard all'),
        cancelLabel: t('Keep editing'),
        tone: 'danger',
      });
      if (!confirmed) {
        return;
      }
    }
    setReviewing(false);
    reset(store.settings);
  };

  const save = async () => {
    const invalid = (field: SettingKey) => !!errorsOf(value, field);
    if (SETTINGS_SECTIONS.some(section => section.fields.some(invalid))) {
      setTouched(new Set(SETTINGS_SECTIONS.flatMap(section => section.fields)));
      // To the first group with a field to correct, where its message shows
      const first = SETTINGS_SECTIONS.find(section => section.fields.some(invalid));
      if (first && first !== selected) {
        open(first);
      }
      setReviewing(false);
      return;
    }
    setSaving(true);
    try {
      const settings = await adminStore.updateSettings(toSettings(value));
      reset(settings);
      setReviewing(false);
      uiToast.show(t('Settings saved.'));
    } catch (error) {
      uiToast.show(t(errorMessage(error)), 'error');
    } finally {
      setSaving(false);
    }
  };

  /** Ticks or unticks a role in the list that must use two-step sign-in */
  const toggleTwoFactorRole = (roleId: string, required: boolean) => {
    const others = value.twoFactorRoleIds.filter(id => id !== roleId);
    edit('twoFactorRoleIds', required ? [...others, roleId] : others);
  };

  /** Ticks or unticks a change that must have a reason */
  const toggleReason = (action: ReasonAction, required: boolean) => {
    const others = value.reasonsRequired.filter(item => item !== action);
    // In the order of the list, as the log shows them
    edit('reasonsRequired', REASON_LIST.map(item => item.key).filter(key => key === action ? required : others.includes(key)));
  };

  // Asks before leaving with unsaved changes, saying in which groups; after the session ended there is nothing to save
  // to, so it leaves without asking
  useLeaveGuard(() => changes.length > 0 && sessionService.view.signedIn, () => uiConfirm.ask({
    title: t('Discard your changes?'),
    message: t('unsavedIn', { sections: sectionNames(t, changedSections.map(group => group.section)) }),
    confirmLabel: t('Discard'),
    cancelLabel: t('Keep editing'),
    tone: 'danger',
  }));

  const disabled = !canManage;
  /** A <select> of numbers */
  const numberSelect = (field: SettingKey & ('sessionTimeoutMinutes' | 'reauthMinutes' | 'suspendInactiveDays' | 'passwordMinLength'
    | 'passwordHistory' | 'activityRetentionDays'), options: { value: number; label: string }[]) => (
    <select className={cx('ui-input select-input', invalidClass(field))} id={field} {...controlName(field)} value={String(value[field])} disabled={disabled}
      onChange={event => edit(field, Number(event.target.value))} onBlur={() => touch(field)}>
      {options.map(option => <option key={option.value} value={String(option.value)}>{option.label}</option>)}
    </select>
  );

  return (
    <app-settings className="page-fit">
      <UiPageHeader title={t('Settings')} subtitle={t('How new accounts and sign-ins work.')} icon={lucideSettings} breadcrumbLabel={t('Breadcrumb')}
        breadcrumbs={[{ label: t('User management') }]} />

      <div className="settings-layout">
        {/* Wide screens: the groups in a card beside the open one, as the roles on their page; a mark on each with changes not saved */}
        <UiCard className="section-panel" flush title={t('Sections')}>
          <nav className="section-list" aria-label={t('Sections')}>
            {SETTINGS_SECTIONS.map(item => {
              const count = changeCounts.get(item.key);
              return (
                <button key={item.key} type="button" className={cx('section-item', item === selected && 'active')}
                  aria-current={item === selected ? 'true' : undefined} onClick={() => open(item)}>
                  <NgIcon className="section-icon" svg={item.icon} />
                  <span className="section-text">
                    <span className="section-name">{t(item.label)}</span>
                    <span className="section-description" title={t(item.description)}>{t(item.description)}</span>
                  </span>
                  {count ? (
                    <UiBadge tone={invalidSections.has(item.key) ? 'danger' : 'warning'}>
                      <span aria-hidden="true">{count}</span>
                      <span className="ui-sr-only">{t(invalidSections.has(item.key) ? 'sectionInvalid' : 'pendingCount', { count })}</span>
                    </UiBadge>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </UiCard>

        {/* Narrow screens: a dropdown right above the open group */}
        <UiFormField className="section-picker" label={t('Section')} for="sectionPicker">
          <select className="ui-input" id="sectionPicker" value={selected.key}
            onChange={event => { const section = SETTINGS_SECTIONS.find(item => item.key === event.target.value); if (section) { open(section); } }}>
            {SETTINGS_SECTIONS.map(item => <option key={item.key} value={item.key}>{sectionOption(item)}</option>)}
          </select>
        </UiFormField>

        <form className="editor" onSubmit={(event: FormEvent) => { event.preventDefault(); void save(); }} noValidate>
          <UiCard fill title={t(selected.label)} description={t(selected.description)}
            actions={
              <div>
                {canManage && changeCounts.get(selected.key) ? (
                  <UiButton variant="ghost" size="sm" type="button" onClick={() => undoFields(selected.fields)}>
                    <NgIcon svg={lucideUndo2} />{` ${t('Undo changes here')}`}
                  </UiButton>
                ) : null}
              </div>
            }
            footerClassName="editor-footer"
            // One Save and one Discard for every group: what is not saved yet, wherever it is, shows at the left
            footer={canManage && <>
              {changes.length > 0 && (
                <div className="pending" role="status">
                  <span className="pending-dot" aria-hidden="true"></span>
                  <span className="pending-text">{t('pendingCount', { count: changes.length })}</span>
                  <UiButton variant="soft" size="sm" type="button" onClick={() => setReviewing(true)}>{t('Show changes')}</UiButton>
                </div>
              )}
              <UiButton variant="secondary" type="button" disabled={!changes.length} onClick={() => void discard()}>{t('Discard')}</UiButton>
              <UiButton type="submit" disabled={!changes.length} loading={saving}><NgIcon svg={lucideSave} />{` ${t('Save changes')}`}</UiButton>
            </>}>
            {!canManage ? (
              <UiAlert className="editor-note" tone="info">{t('Your role can view the settings but not change them.')}</UiAlert>
            ) : holdsBackSelfOnSave && selected.key !== 'sign-in' && (
              <UiAlert className="editor-note" tone="warning">{t('twoFactorSelfWarning')}</UiAlert>
            )}

            {/* Each group fades in where the last one was (ui-enter-fade) */}
            {selected.key === 'new-users' && (
              <div key="new-users" className="section-fields ui-enter-fade">
                <UiFormField label={t('Default role')} for="defaultRoleId" required errors={errorMessages} control={control('defaultRoleId')}
                  hint={t('Picked in advance on the Add user form.')}>
                  <select className={cx('ui-input select-input', invalidClass('defaultRoleId'))} id="defaultRoleId" {...controlName('defaultRoleId')} value={value.defaultRoleId}
                    disabled={disabled} onChange={event => edit('defaultRoleId', event.target.value)} onBlur={() => touch('defaultRoleId')}>
                    {store.roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}
                  </select>
                </UiFormField>
                <UiFormField label={t('Invitations expire after')} hint={t('Expired invitations show on the overview, ready to send again.')}>
                  <UiSegmented options={expiryOptions} value={value.inviteExpiryDays} {...controlName('inviteExpiryDays')} disabled={disabled} ariaLabel={t('Invitations expire after')}
                    onValueChange={days => edit('inviteExpiryDays', days)} onTouched={() => touch('inviteExpiryDays')} />
                </UiFormField>
                <UiFormField label={t('Allowed email domains')} for="allowedDomains" errors={errorMessages} control={control('allowedDomains')}
                  hint={t('Separate domains with commas. Leave empty to allow any email.')}>
                  <input className={cx('ui-input', invalidClass('allowedDomains'))} id="allowedDomains" {...controlName('allowedDomains')} value={value.allowedDomains} disabled={disabled}
                    placeholder="example.com, example.co.th" autoComplete="off" onChange={event => edit('allowedDomains', event.target.value)}
                    onBlur={() => touch('allowedDomains')} />
                </UiFormField>
                <UiFormField label={t('Email language')} for="defaultLanguage"
                  hint={t('For people who have not used the app yet, such as someone just invited. Everyone else gets emails in the language they last used.')}>
                  <select className="ui-input select-input" id="defaultLanguage" {...controlName('defaultLanguage')} value={value.defaultLanguage} disabled={disabled}
                    onChange={event => edit('defaultLanguage', event.target.value as Language)} onBlur={() => touch('defaultLanguage')}>
                    {LANGUAGES.map(language => <option key={language.code} value={language.code} lang={language.code}>{language.name}</option>)}
                  </select>
                </UiFormField>
                <UiSwitch checked={value.branchesEnabled} {...controlName('branchesEnabled')} disabled={disabled} onCheckedChange={on => edit('branchesEnabled', on)}
                  onTouched={() => touch('branchesEnabled')} description={t('People belong to a branch, and roles can be given for one branch only.')}>
                  {` ${t('Use branches')} `}
                </UiSwitch>
              </div>
            )}
            {selected.key === 'sign-in' && (
              <div key="sign-in" className="section-fields ui-enter-fade">
                <UiFormField label={t('Sign out when idle')} for="sessionTimeoutMinutes" hint={t('Signs people out after this long without a click, key press or scroll.')}>
                  {numberSelect('sessionTimeoutMinutes', timeoutOptions)}
                </UiFormField>
                <UiFormField label={t('Ask for the password again after')} for="reauthMinutes" hint={t('reauthHint')}>
                  {numberSelect('reauthMinutes', reauthOptions)}
                </UiFormField>
                <UiFormField label={t('Suspend accounts not used for')} for="suspendInactiveDays" hint={t('inactiveHint')}>
                  {numberSelect('suspendInactiveDays', inactiveOptions)}
                </UiFormField>
                <UiFormField label={t('Two-step sign-in required for')} hint={t('People with these roles must turn on two-step sign-in before they can do anything else.')}>
                  <div className="role-checks" role="group" aria-label={t('Two-step sign-in required for')}>
                    {store.roles.map(role => (
                      <UiCheckbox key={role.id} checked={value.twoFactorRoleIds.includes(role.id)} disabled={!canManage}
                        onCheckedChange={checked => toggleTwoFactorRole(role.id, checked)}>{role.name}</UiCheckbox>
                    ))}
                  </div>
                </UiFormField>
                {holdsBackSelf && <UiAlert tone="warning">{t('twoFactorSelfWarning')}</UiAlert>}
              </div>
            )}
            {selected.key === 'passwords' && (
              <div key="passwords" className="section-fields ui-enter-fade">
                <UiFormField label={t('Shortest password')} for="passwordMinLength">
                  {numberSelect('passwordMinLength', passwordLengthOptions)}
                </UiFormField>
                <UiFormField label={t('Recent passwords not allowed again')} for="passwordHistory" hint={t('Stops people from going back to a password they used recently.')}>
                  {numberSelect('passwordHistory', historyOptions)}
                </UiFormField>
              </div>
            )}
            {selected.key === 'activity-log' && (
              <div key="activity-log" className="section-fields ui-enter-fade">
                <UiFormField label={t('Keep activity for')} for="activityRetentionDays" hint={t('Older entries are deleted every night. Export them first if you need them.')}>
                  {numberSelect('activityRetentionDays', retentionOptions)}
                </UiFormField>
                <UiFormField label={t('Ask for a reason when')} hint={t('The person making the change has to say why, and the log keeps it.')}>
                  <div className="reason-checks" role="group" aria-label={t('Ask for a reason when')}>
                    {REASON_LIST.map(action => (
                      <UiCheckbox key={action.key} checked={value.reasonsRequired.includes(action.key)} disabled={!canManage}
                        onCheckedChange={checked => toggleReason(action.key, checked)}>{t(action.label)}</UiCheckbox>
                    ))}
                  </div>
                </UiFormField>
              </div>
            )}
          </UiCard>
        </form>
      </div>

      {/* Every change not saved yet, by group, each one to undo on its own */}
      <UiDialog open={reviewing} onOpenChange={setReviewing} title={t('Changes not saved yet')} description={t('They are saved together. Undo any you do not want.')}
        closeLabel={t('Close')}
        footer={<>
          <UiButton variant="secondary" type="button" onClick={() => void discard()}>{t('Discard all')}</UiButton>
          <UiButton type="button" loading={saving} onClick={() => void save()}><NgIcon svg={lucideSave} />{` ${t('Save changes')}`}</UiButton>
        </>}>
        {/* Only while open, so nothing in it doubles what the page shows */}
        {reviewing && (
          <div className="review">
            {changedSections.map(group => (
              <section key={group.section.key} className="review-group">
                <h3 className="review-title">
                  <button type="button" className="review-open" onClick={() => open(group.section)}>
                    <NgIcon svg={group.section.icon} />{` ${t(group.section.label)}`}
                  </button>
                </h3>
                <ul className="review-list">
                  {group.changes.map(change => (
                    <li key={change.field} className="review-item">
                      <span className="review-text">
                        <span className="review-field">{format.field(change)}</span>
                        <span className="review-value">{describe(change)}</span>
                      </span>
                      <UiButton variant="ghost" size="sm" type="button" aria-label={t('undoChange', { field: format.field(change) })}
                        onClick={() => undoFields([change.field])}>
                        <NgIcon svg={lucideUndo2} />{` ${t('Undo')} `}
                      </UiButton>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {holdsBackSelfOnSave && <UiAlert tone="warning">{t('twoFactorSelfWarning')}</UiAlert>}
          </div>
        )}
      </UiDialog>
    </app-settings>
  );
}
