import type { ChartData, ChartOptions } from 'chart.js';
import { lazy, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';

import {
  lucideBell, lucideBlocks, lucideCopy, lucideDownload, lucideEllipsis, lucidePencil, lucidePlus, lucideSettings, lucideTrash2, lucideUserPlus,
  lucideUsers, lucideWallet,
} from '../icons';
import { EMAIL_PATTERN, FORM_BEHAVIOUR, controlName, fieldControl, invalidClass } from '../user-management/shared/forms';
import {
  cx, DeferOnViewport, NgIcon, uiConfirm, uiTableClass, uiToast, UiAlert, UiAvatar, UiBadge, UiBulkBar, UiButton, UiCard, UiChartLegend, UiCheckbox,
  UiChoiceCards, UiDetailItem, UiDetailList, UiDialog, UiEmptyState, UiFileDropzone, UiFilterChips, UiFormField, UiIconChip, UiMenu,
  UiMenuDivider, UiMenuItem, UiMenuTrigger, UiPageHeader, UiPageSize, UiPagination, UiPerson, UiPersonSelect, UiProgress, UiSearchInput, UiSegmented,
  UiSortHeader, UiStatCard, UiSwitch, UiTimeline, UiTimelineItem, UiTrend, useUiTableMinRows, useUiTableState, type UiChoice, type UiOption,
  type UiPersonOption,
} from '../user-management/ui';
import { areaFill, UI_CHART_PALETTE } from '../user-management/ui/charts/chart-colors';
import './ui-kit.scss';

// Chart.js loads with the chart, when it comes into view (the Angular app's @defer)
const UiChart = lazy(() => import('../user-management/ui/charts/chart').then(m => ({ default: m.UiChart })));

interface Sample {
  id: number;
  name: string;
  team: string;
  score: number;
}

const VARIANTS = ['primary', 'secondary', 'soft', 'outline', 'ghost', 'danger', 'danger-soft'] as const;
const RANGES: UiOption[] = [{ value: '24h', label: '24h' }, { value: '7d', label: '7d' }, { value: '30d', label: '30d' }];
const TABS: UiOption[] = [
  { value: 'general', label: 'General' },
  { value: 'members', label: 'Members', count: 12 },
  { value: 'billing', label: 'Billing' },
];
const CHIPS: UiOption[] = [
  { value: 'all', label: 'All', count: 24 },
  { value: 'open', label: 'Open', count: 9 },
  { value: 'closed', label: 'Closed', count: 15 },
];
const PLANS: UiChoice[] = [
  { value: 'solo', title: 'Solo', meta: '$0', description: 'One person' },
  { value: 'team', title: 'Team', meta: '$12', description: 'Up to 20 people' },
  { value: 'company', title: 'Company', meta: '$49', description: 'Unlimited' },
];
const SAMPLES: Sample[] = [
  { id: 1, name: 'Aurora', team: 'Design', score: 92 },
  { id: 2, name: 'Basil', team: 'Sales', score: 71 },
  { id: 3, name: 'Cedar', team: 'Engineering', score: 85 },
  { id: 4, name: 'Dahlia', team: 'Support', score: 64 },
  { id: 5, name: 'Elm', team: 'Engineering', score: 78 },
  { id: 6, name: 'Fern', team: 'Design', score: 88 },
];
const FIRST_NAMES = ['Ann', 'Ben', 'Chloe', 'Dan', 'Ella', 'Finn', 'Grace', 'Hugo', 'Isla', 'Jack', 'Kate', 'Leo', 'Mia', 'Noah', 'Olive',
  'Paul', 'Quinn', 'Ruby', 'Sam', 'Tara', 'Uma', 'Vic', 'Will', 'Xena', 'Yuki', 'Zoe', 'Arun', 'Busaba', 'Chai', 'Dao'];
const LAST_NAMES = ['Adams', 'Baker', 'Carter', 'Davis', 'Evans', 'Foster', 'Green', 'Hughes', 'Irwin', 'Jones', 'Kelly', 'Lewis', 'Moore', 'Nash',
  'Owens', 'Parker', 'Quinn', 'Reed', 'Scott', 'Turner', 'Underwood', 'Vance', 'Walker', 'Young', 'Zimmer', 'Boonmee', 'Chaiyaporn', 'Duangdee',
  'Kaewkla', 'Srisuk', 'Thongdee', 'Wongsa', 'Phromma', 'Saetang', 'Jaidee', 'Meechai', 'Nakorn', 'Panya', 'Rattana', 'Siriwat'];
/** 1,200 people, as an organization of that size would have, for the person picker: every first name with every last name, by name */
const SAMPLE_PEOPLE: UiPersonOption[] = FIRST_NAMES.flatMap(first => LAST_NAMES.map(last => ({
  id: `${first}-${last}`.toLowerCase(),
  name: `${first} ${last}`,
  detail: `${first}.${last}@example.com`.toLowerCase(),
}))).sort((a, b) => a.name.localeCompare(b.name));

const SEARCH = (row: Sample, query: string) => row.name.toLowerCase().includes(query) || row.team.toLowerCase().includes(query);
const SORTERS = { name: (a: Sample, b: Sample) => a.name.localeCompare(b.name), score: (a: Sample, b: Sample) => a.score - b.score };
const LEGEND = [
  { label: 'Visits', color: UI_CHART_PALETTE[0], value: '12.4k' },
  { label: 'Sign-ups', color: UI_CHART_PALETTE[2], value: '1.9k' },
];
const CHART_DATA: ChartData<'line'> = {
  labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  datasets: [
    { label: 'Visits', data: [18, 22, 19, 27, 31, 26, 34], borderColor: UI_CHART_PALETTE[0], backgroundColor: areaFill(UI_CHART_PALETTE[0]), fill: true },
    { label: 'Sign-ups', data: [6, 8, 7, 9, 12, 10, 13], borderColor: UI_CHART_PALETTE[2], backgroundColor: areaFill(UI_CHART_PALETTE[2]), fill: true },
  ],
};
const CHART_OPTIONS: ChartOptions<'line'> = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: { legend: { display: false } },
  elements: { point: { radius: 0, hoverRadius: 4 }, line: { borderWidth: 2.5, cubicInterpolationMode: 'monotone' } },
  scales: { x: { grid: { display: false }, border: { display: false } }, y: { border: { display: false } } },
};

interface KitForm {
  email: string;
  plan: string;
  notify: boolean;
  terms: boolean;
}

/**
 * Every piece in user-management/ui, with a short usage note. Not in the menu; open /ui-kit.
 * Use it as the reference when building another dashboard on the library.
 */
export function UiKitComponent() {
  /* Buttons */
  const [loading, setLoading] = useState(false);
  const load = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 1500);
  };

  /* Navigation */
  const [range, setRange] = useState('7d');
  const [tab, setTab] = useState('general');
  const [chip, setChip] = useState('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(3);
  const [owner, setOwner] = useState<string | null>(null);

  /* Forms */
  const form = useForm<KitForm>({ ...FORM_BEHAVIOUR, defaultValues: { email: 'not-an-email', plan: 'team', notify: true, terms: false } });
  const [preview, setPreview] = useState('');
  const [allChecked, setAllChecked] = useState(false);
  const [someChecked, setSomeChecked] = useState(true);
  form.register('terms', { validate: { required: value => value === true } });

  /* Feedback */
  const [dialogOpen, setDialogOpen] = useState(false);
  const showToast = (tone: 'success' | 'error' | 'info') => uiToast.show({ success: 'Saved', error: 'Could not save', info: 'Link copied' }[tone], tone);
  const ask = async () => {
    const yes = await uiConfirm.ask({ title: 'Delete this project?', message: 'This cannot be undone.', tone: 'danger', confirmLabel: 'Delete' });
    uiToast.show(yes ? 'Deleted' : 'Kept', yes ? 'success' : 'info');
  };

  /* Table */
  const table = useUiTableState<Sample, 'name' | 'score'>({ rows: SAMPLES, id: row => row.id, pageSize: 4, search: SEARCH, sorters: SORTERS });
  const scroll = useRef<HTMLDivElement>(null);
  useUiTableMinRows(scroll, 4);

  return (
    <app-ui-kit>
      <UiPageHeader title="Component gallery" subtitle="Every piece in user-management/ui, with how to use it." icon={lucideBlocks} breadcrumbs={[{ label: 'Developers' }]} />

      <div className="kit">
        {/* Buttons */}
        <UiCard title="Button" description="On a native <button> or <a>. Variants, sizes, icons and a loading state."
          actions={<code className="tag">button[uiButton]</code>}>
          <div className="row-wrap">
            {VARIANTS.map(variant => <UiButton key={variant} variant={variant} type="button">{variant}</UiButton>)}
          </div>
          <div className="row-wrap">
            <UiButton size="sm" type="button"><NgIcon svg={lucidePlus} /> Small</UiButton>
            <UiButton type="button"><NgIcon svg={lucidePlus} /> Medium</UiButton>
            <UiButton size="lg" type="button"><NgIcon svg={lucidePlus} /> Large</UiButton>
            <UiButton variant="secondary" iconOnly type="button" aria-label="Settings"><NgIcon svg={lucideSettings} /></UiButton>
            <UiButton variant="ghost" iconOnly type="button" aria-label="Notifications"><NgIcon svg={lucideBell} /></UiButton>
            <UiButton type="button" loading={loading} onClick={load}><NgIcon svg={lucideDownload} /> Click to load</UiButton>
          </div>
          <pre className="snippet">{'<button uiButton variant="secondary" size="sm" [loading]="saving()">Save</button>'}</pre>
        </UiCard>

        {/* Display */}
        <UiCard title="Badge, trend, icon chip, avatar, person" description="Small pieces for lists and tables.">
          <div className="row-wrap">
            <UiBadge tone="primary">Primary</UiBadge>
            <UiBadge tone="success" dot>Active</UiBadge>
            <UiBadge tone="warning" dot>Invited</UiBadge>
            <UiBadge tone="danger" dot>Suspended</UiBadge>
            <UiBadge tone="info">Info</UiBadge>
            <UiBadge>Neutral</UiBadge>
          </div>
          <div className="row-wrap">
            <UiTrend value={12.5} />
            <UiTrend value={-3.2} />
            <UiTrend value={-8} inverse />
            <UiTrend value={0} />
            <UiIconChip icon={lucideUsers} />
            <UiIconChip icon={lucideWallet} tone="success" />
            <UiIconChip icon={lucideBell} tone="warning" size="sm" />
          </div>
          <div className="row-wrap">
            <UiAvatar name="Henry Klein" src="assets/images/faces/face8.jpg" size="lg" />
            <UiAvatar name="Nattaya Srisuk" size="lg" />
            <UiAvatar name="Krit" size="md" />
            <UiPerson name="Henry Klein" detail="henry@example.com" src="assets/images/faces/face8.jpg" />
          </div>
          <pre className="snippet">{'<ui-badge tone="success" dot>Active</ui-badge>  <ui-trend [value]="4.2" />  <ui-person [name]="…" [detail]="…" [src]="…" />'}</pre>
        </UiCard>

        {/* Stat cards */}
        <div className="stat-row">
          <UiStatCard label="Total users" value="1,284" icon={lucideUsers} trend={8.4} hint="vs last month" />
          <UiStatCard label="Revenue" value="$48.2k" icon={lucideWallet} tone="success" trend={-2.1} hint="vs last month" />
          <UiStatCard label="Open tickets" value="37" icon={lucideBell} tone="warning" trend={-12} inverse hint="fewer is better" />
        </div>

        {/* Navigation */}
        <UiCard title="Segmented, tabs, filter chips, search, person, pagination" description="Pickers and navigation; all support two-way binding.">
          <div className="row-wrap">
            <UiSegmented options={RANGES} value={range} onValueChange={setRange} ariaLabel="Range" />
            <UiFilterChips options={CHIPS} value={chip} onValueChange={setChip} />
          </div>
          <UiSegmented variant="underline" options={TABS} value={tab} onValueChange={setTab} ariaLabel="Sections" />
          <div className="row-wrap">
            <UiSearchInput className="grow" value={query} onValueChange={setQuery} placeholder="Search projects" />
            <UiPagination page={page} onPageChange={setPage} pageCount={12} />
          </div>
          {/* One person out of thousands: the list searches, and shows the first 50 it finds */}
          <div className="row-wrap">
            <UiPersonSelect label="Owner" people={SAMPLE_PEOPLE} value={owner} onValueChange={setOwner} searchLabel="Search name or email"
              clearLabel="Clear owner" />
          </div>
          <pre className="snippet">{'<ui-segmented [options]="ranges" [(value)]="range" />  <ui-pagination [(page)]="page" [pageCount]="12" />\n'
            + '<ui-person-select label="Owner" [people]="people" [(value)]="owner" searchLabel="Search name or email" />'}</pre>
        </UiCard>

        {/* Forms */}
        <UiCard title="Form controls" description="Work with Reactive Forms. Errors appear after the field is touched; press Validate."
          footer={<>
            <UiButton variant="secondary" type="button" onClick={() => form.reset()}>Reset</UiButton>
            <UiButton type="button" onClick={() => void form.trigger()}>Validate</UiButton>
          </>}>
          <form className="form-demo">
            <UiFormField label="Email" for="kitEmail" required hint="We never share it." errors={{ required: 'Enter an email.', pattern: 'That is not a valid email.' }}
              control={fieldControl(form, 'email')}>
              <input className={cx('ui-input', invalidClass(form, 'email'))} id="kitEmail" {...controlName('email')} {...form.register('email', { required: true, pattern: EMAIL_PATTERN })} />
            </UiFormField>
            <UiFormField label="Team size" for="kitSize">
              <select className="ui-input" id="kitSize"><option>1–10</option><option>11–50</option><option>51+</option></select>
            </UiFormField>
            <UiChoiceCards className="span-2" choices={PLANS} {...controlName('plan')} value={form.watch('plan')} onValueChange={value => form.setValue('plan', value)} ariaLabel="Plan" />
            <UiSwitch className="span-2" checked={form.watch('notify')} {...controlName('notify')} onCheckedChange={checked => form.setValue('notify', checked)} description="Weekly summary by email">
              Email me updates
            </UiSwitch>
            <div className="row-wrap span-2">
              <UiCheckbox checked={form.watch('terms')} {...controlName('terms')} onCheckedChange={checked => form.setValue('terms', checked)}>I agree to the terms</UiCheckbox>
              <UiCheckbox checked={allChecked} indeterminate={someChecked} onCheckedChange={checked => { setAllChecked(checked); setSomeChecked(false); }}>
                Select all (indeterminate)
              </UiCheckbox>
              <UiCheckbox disabled>Disabled</UiCheckbox>
            </div>
            <UiFileDropzone className="span-2" accept="image/*" preview={preview} hint="PNG or JPG" onFileSelected={file => setPreview(URL.createObjectURL(file))}
              onRemoved={() => setPreview('')} />
          </form>
        </UiCard>

        {/* Feedback */}
        <UiCard title="Alert" description="A message in the page: an error under a form, a note that a page is read-only. Danger alerts are announced as they appear.">
          <div className="stack">
            <UiAlert tone="info">Your role can view roles but not change them.</UiAlert>
            <UiAlert tone="success" title="Imported">48 users were added.</UiAlert>
            <UiAlert tone="warning">Only the first 500 rows are read.</UiAlert>
            <UiAlert tone="danger">Wrong email or password.</UiAlert>
          </div>
          <pre className="snippet">{'<ui-alert tone="danger">Wrong email or password.</ui-alert>'}</pre>
        </UiCard>

        <UiCard title="Toast, confirm, dialog, empty state, progress" description="Feedback after an action, and states for empty or loading content.">
          <div className="row-wrap">
            <UiButton variant="secondary" type="button" onClick={() => showToast('success')}>Toast: success</UiButton>
            <UiButton variant="secondary" type="button" onClick={() => showToast('error')}>Toast: error</UiButton>
            <UiButton variant="secondary" type="button" onClick={() => showToast('info')}>Toast: info</UiButton>
            <UiButton variant="danger-soft" type="button" onClick={() => void ask()}>Confirm…</UiButton>
            <UiButton type="button" onClick={() => setDialogOpen(true)}>Open dialog</UiButton>
          </div>
          <div className="split">
            <UiEmptyState compact title="Nothing here yet" description="Projects you create appear here.">
              <UiButton size="sm" type="button"><NgIcon svg={lucidePlus} /> New project</UiButton>
            </UiEmptyState>
            <div className="stack">
              <UiProgress value={72} label="Storage" valueLabel="72%" />
              <UiProgress value={38} tone="success" label="Seats" valueLabel="19 of 50" />
              <UiProgress value={91} tone="danger" label="API quota" valueLabel="91%" />
            </div>
          </div>
          <pre className="snippet">{"this.toast.show('Saved');   if (await this.confirm.ask({ title: 'Delete?', tone: 'danger' })) { … }"}</pre>
        </UiCard>

        {/* Table */}
        <UiCard title="Table + UiTableState" description="Search, sort, page and select as signals; the markup stays a plain <table>. Add dense for tighter rows." flush>
          <div className="table-tools">
            <UiSearchInput className="grow" value={table.query} onValueChange={table.search} placeholder="Search" />
          </div>
          {table.selectedIds.size > 0 && (
            <UiBulkBar label={`${table.selectedIds.size} selected`} onCleared={table.clearSelection}>
              <UiButton size="sm" variant="danger-soft" type="button"><NgIcon svg={lucideTrash2} /> Delete</UiButton>
            </UiBulkBar>
          )}
          <div className="ui-table-scroll" ref={scroll}>
            <table className={uiTableClass()}>
              <thead>
                <tr>
                  <th className="ui-cell-shrink">
                    <UiCheckbox checked={table.allOnPageSelected} indeterminate={table.someOnPageSelected} onCheckedChange={table.togglePage} ariaLabel="Select all" />
                  </th>
                  <th><UiSortHeader table={table} sortKey="name">Name</UiSortHeader></th>
                  <th>Team</th>
                  <th className="ui-cell-end"><UiSortHeader table={table} sortKey="score">Score</UiSortHeader></th>
                  <th className="ui-cell-shrink"></th>
                </tr>
              </thead>
              <tbody>
                {table.pageRows.map(row => (
                  <tr key={row.id} className={table.isSelected(row) ? 'ui-row-selected' : undefined}>
                    <td className="ui-cell-shrink"><UiCheckbox checked={table.isSelected(row)} onCheckedChange={() => table.toggle(row)} ariaLabel={`Select ${row.name}`} /></td>
                    <td><UiPerson name={row.name} detail={row.team} /></td>
                    <td><UiBadge>{row.team}</UiBadge></td>
                    <td className="ui-cell-end">{row.score}</td>
                    <td className="ui-cell-shrink">
                      <UiMenuTrigger menu={
                        <UiMenu>
                          <UiMenuItem icon={lucidePencil}>Edit</UiMenuItem>
                          <UiMenuItem icon={lucideCopy}>Duplicate</UiMenuItem>
                          <UiMenuDivider />
                          <UiMenuItem tone="danger" icon={lucideTrash2}>Delete</UiMenuItem>
                        </UiMenu>
                      }>
                        <UiButton variant="ghost" size="sm" iconOnly type="button" aria-label="Actions"><NgIcon svg={lucideEllipsis} /></UiButton>
                      </UiMenuTrigger>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="table-foot">
            <UiPageSize table={table} label={`${table.range.from}–${table.range.to} of ${table.range.total}`} sizes={[4, 8, 12]} />
            <UiPagination page={table.currentPage} onPageChange={table.setPage} pageCount={table.pageCount} />
          </div>
        </UiCard>

        {/* Timeline, details, chart */}
        <div className="split">
          <UiCard title="Timeline" description="Events joined by a line.">
            <UiTimeline>
              <UiTimelineItem icon={lucideUserPlus} tone="success" time="2 min ago"><b>Henry</b> invited <b>Jane</b></UiTimelineItem>
              <UiTimelineItem icon={lucidePencil} tone="info" time="1 hour ago"><b>Jane</b> updated her profile</UiTimelineItem>
              <UiTimelineItem icon={lucideTrash2} tone="danger" time="Yesterday"><b>Krit</b> deleted a project</UiTimelineItem>
            </UiTimeline>
          </UiCard>
          <UiCard title="Detail list" description="Label and value pairs.">
            <UiDetailList columns={2}>
              <UiDetailItem label="Email">henry@example.com</UiDetailItem>
              <UiDetailItem label="Role"><UiBadge tone="primary">Administrator</UiBadge></UiDetailItem>
              <UiDetailItem label="Joined">4 Oct 2025</UiDetailItem>
              <UiDetailItem label="Status"><UiBadge tone="success" dot>Active</UiBadge></UiDetailItem>
            </UiDetailList>
          </UiCard>
        </div>

        <UiCard title="Charts (ui/charts)" description="ui-chart follows dark mode and loads Chart.js inside @defer; areaFill draws the gradient."
          actions={<UiChartLegend items={LEGEND} />}>
          <div className="chart">
            <DeferOnViewport placeholder={<div></div>}>
              <UiChart type="line" data={CHART_DATA} options={CHART_OPTIONS} label="Visits and sign-ups over the last 7 days" />
            </DeferOnViewport>
          </div>
        </UiCard>
      </div>

      <UiDialog open={dialogOpen} onOpenChange={setDialogOpen} title="Invite people" description="They get an email with a link to join."
        footer={<>
          <UiButton variant="secondary" type="button" onClick={() => setDialogOpen(false)}>Cancel</UiButton>
          <UiButton type="button" onClick={() => setDialogOpen(false)}><NgIcon svg={lucideUserPlus} /> Send invites</UiButton>
        </>}>
        <UiFormField label="Email addresses" for="kitInvite" hint="Separate addresses with commas.">
          <textarea className="ui-input" id="kitInvite" rows={3} placeholder="jane@example.com, krit@example.com"></textarea>
        </UiFormField>
      </UiDialog>
    </app-ui-kit>
  );
}
