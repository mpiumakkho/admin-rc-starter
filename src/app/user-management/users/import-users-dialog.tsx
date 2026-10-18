import { useMemo, useState } from 'react';

import { lucideCircleAlert, lucideCircleCheck, lucideDownload, lucideFileSpreadsheet } from '../../icons';
import { useSession } from '../access/session';
import { adminStore, useAdmin } from '../data/admin-store';
import { DEPARTMENTS } from '../data/catalog';
import type { RoleGrant, UserStatus } from '../data/models';
import { checkImportRows, IMPORT_COLUMNS } from '../data/user-import';
import { downloadText, parseCsv, toCsv } from '../shared/csv';
import { errorMessage } from '../shared/errors';
import { useFormat } from '../shared/formatting';
import { cx, NgIcon, uiTableClass, uiToast, UiAlert, UiButton, UiDialog, UiFileDropzone, UiSegmented, type UiOption } from '../ui';
import './import-users-dialog.scss';

/** The most rows one import takes */
const MAX_ROWS = 500;

export interface ImportUsersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Adds users from a CSV file. Every row is checked as the server would before anything is saved; rows with
 * problems are listed and left out.
 */
export function ImportUsersDialog({ open, onOpenChange }: ImportUsersDialogProps) {
  const store = useAdmin();
  const session = useSession();
  const { t } = useFormat();

  const [fileName, setFileName] = useState('');
  /** The file's rows, header first; null before a file is picked */
  const [cells, setCells] = useState<string[][] | null>(null);
  const [status, setStatus] = useState<UserStatus>('invited');
  const [importing, setImporting] = useState(false);
  const [tooMany, setTooMany] = useState(false);

  const statusOptions: UiOption<UserStatus>[] = [
    { value: 'invited', label: t('Send invitations') },
    { value: 'active', label: t('Add as active') },
  ];

  const result = useMemo(() => {
    if (!cells) {
      return null;
    }
    const settings = store.settings;
    return checkImportRows(cells, {
      roles: store.roles,
      takenEmails: new Set(store.users.map(user => user.email.toLowerCase())),
      allowedDomains: settings.allowedDomains,
      defaultRoleId: settings.defaultRoleId,
      canAssign: (role, branchId) => session.canGive(role, branchId, 'users.create'),
      canAdd: branchId => session.allows('users.create', branchId),
      status,
      branches: settings.branchesEnabled ? store.branches : undefined,
      conflicts: store.roleConflicts,
    });
  }, [cells, store.settings, store.roles, store.users, store.branches, store.roleConflicts, session, status]);

  const ready = result?.rows.filter(row => !row.problems.length) ?? [];
  const withProblems = result?.rows.filter(row => row.problems.length).length ?? 0;

  const roleNames = (grants: RoleGrant[]) => grants.map(grant => store.rolesById.get(grant.roleId)?.name).filter(Boolean).join(', ') || '—';

  const pick = async (file: File) => {
    const rows = parseCsv(await file.text());
    setTooMany(rows.length - 1 > MAX_ROWS);
    setFileName(file.name);
    setCells(rows.slice(0, MAX_ROWS + 1));
  };

  const chooseAgain = () => {
    setCells(null);
    setFileName('');
    setTooMany(false);
  };

  /** A file with the columns and two sample rows, to fill in */
  const downloadTemplate = () => {
    // Through a branch, one of the signed-in user's, and the roles they may give there
    const openBranches = store.openBranches.filter(item => session.allows('users.create', item.id));
    const scope = session.allows('users.create', null) ? null : openBranches[0]?.id ?? null;
    const roles = store.roles.filter(role => session.canGive(role, scope, 'users.create'));
    // With branches on, a Branch column too, by code
    const branch = store.branchesEnabled || scope ? openBranches[0]?.code ?? '' : null;
    const withBranch = (row: string[]) => branch === null ? row : [...row.slice(0, 5), row[0] === 'First name' ? 'Branch' : branch, ...row.slice(5)];
    downloadText('users-template.csv', toCsv([
      withBranch([...IMPORT_COLUMNS]),
      withBranch(['Ann', 'Smith', 'ann.smith@example.com', '0812345678', DEPARTMENTS[0], roles[0]?.name ?? '']),
      withBranch(['Somchai', 'Jaidee', 'somchai.j@example.com', '', DEPARTMENTS[1], roles.at(-1)?.name ?? '']),
    ]));
  };

  const close = () => {
    onOpenChange(false);
    chooseAgain();
  };

  const runImport = async () => {
    const drafts = ready.map(row => row.draft);
    if (!drafts.length) {
      return;
    }
    setImporting(true);
    try {
      await adminStore.createUsers(drafts);
      uiToast.show(t('toast.imported', { count: drafts.length }));
      close();
    } catch (error) {
      uiToast.show(t(errorMessage(error)), 'error');
    } finally {
      setImporting(false);
    }
  };

  const checked = result;
  return (
    <app-import-users-dialog>
      <UiDialog open={open} onOpenChange={next => { onOpenChange(next); if (!next) { chooseAgain(); } }} size="lg" title={t('Import users')}
        description={t('Add many people at once from a spreadsheet saved as CSV (comma-separated values).')} closeLabel={t('Close')}
        footer={<>
          <UiButton variant="secondary" type="button" onClick={close}>{t('Cancel')}</UiButton>
          <UiButton type="button" disabled={!ready.length} loading={importing} onClick={() => void runImport()}>
            {` ${t('importButton', { count: ready.length })} `}
          </UiButton>
        </>}>
        {checked ? (
          <>
            <div className="file-bar">
              <NgIcon svg={lucideFileSpreadsheet} className="file-icon" />
              <span className="file-name">{fileName}</span>
              <UiButton variant="ghost" size="sm" type="button" onClick={chooseAgain}>{t('Choose another file')}</UiButton>
            </div>

            {checked.missingColumns.length ? (
              <UiAlert tone="danger">{t('importMissingColumns', { columns: checked.missingColumns.join(', ') })}</UiAlert>
            ) : !checked.rows.length ? (
              <UiAlert tone="warning">{t('The file has no rows under its header.')}</UiAlert>
            ) : (
              <>
                <div className="summary">
                  <span className="summary-item ok"><NgIcon svg={lucideCircleCheck} />{` ${t('importReady', { count: ready.length })}`}</span>
                  {withProblems > 0 && (
                    <span className="summary-item problem"><NgIcon svg={lucideCircleAlert} />{` ${t('importProblems', { count: withProblems })}`}</span>
                  )}
                </div>
                {tooMany && <UiAlert tone="warning">{t('Only the first 500 rows are read. Split larger files.')}</UiAlert>}

                <div className="ui-table-scroll preview">
                  <table className={uiTableClass(true)}>
                    <thead>
                      <tr>
                        <th className="ui-cell-shrink">{t('Line')}</th>
                        <th>{t('Name')}</th>
                        <th>{t('Email')}</th>
                        <th>{t('Role')}</th>
                        <th>{t('Check')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {checked.rows.map(row => (
                        <tr key={row.line} className={cx(row.problems.length > 0 && 'has-problem')}>
                          <td className="ui-cell-shrink muted">{row.line}</td>
                          <td>{`${row.draft.firstName} ${row.draft.lastName}`}</td>
                          <td className="muted">{row.draft.email}</td>
                          <td>{roleNames(row.draft.roles)}</td>
                          <td>
                            {row.problems.length ? (
                              <span className="problem-text">
                                {row.problems.map(problem => <span key={problem}>{t(problem)}</span>)}
                              </span>
                            ) : (
                              <span className="ok-text"><NgIcon svg={lucideCircleCheck} />{` ${t('Ready')}`}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="status-row">
                  <span className="status-label">{t('New users')}</span>
                  <UiSegmented size="sm" options={statusOptions} value={status} onValueChange={value => value && setStatus(value)} ariaLabel={t('Status')} />
                </div>
                {withProblems > 0 && <p className="note">{t('Rows with problems are left out. Fix them in the file and import it again.')}</p>}
              </>
            )}
          </>
        ) : (
          <>
            <UiFileDropzone accept=".csv,text/csv" title={t('Click to choose a CSV file or drag it here')}
              hint={t('Columns: First name, Last name, Email, Phone, Department, Role. The first three are needed.')}
              onFileSelected={file => void pick(file)} />
            <UiButton variant="ghost" size="sm" type="button" className="template" onClick={downloadTemplate}>
              <NgIcon svg={lucideDownload} />{` ${t('Download a template')} `}
            </UiButton>
          </>
        )}
      </UiDialog>
    </app-import-users-dialog>
  );
}
