/* The staff directory: who works here and where each stands, with the credential and shift risks beside them (workforce.staff, M24 P2) */
import { useState } from 'react';

import { TODAY } from '../../../clinic/data/model';
import { lucidePlus } from '../../../icons';
import { cx, NgIcon, UiButton } from '../../../user-management/ui';
import { backofficeActions } from '../../backoffice-actions';
import { useBackofficeStore } from '../../backoffice.store';
import type { StaffMember, StaffRole } from '../../data/types';
import { DEPARTMENTS, EMPLOYMENT, LICENSE_KIND, LICENSE_STATE, licensesOf, licenseState, ROLE, STAFF_STATUS, staffProblems, staffRows, type StaffInput } from '../../data/workforce';
import { useBoI18n } from '../../i18n/bo-i18n';
import { Drawer, PageHead } from '../../shared/parts';

const ROLES = Object.keys(ROLE) as StaffRole[];
const EMPLOYMENTS = Object.keys(EMPLOYMENT) as StaffMember['employment'][];
const blank = (): StaffInput => ({ name: '', role: 'nurse', position: '', department: 'Ward', employment: 'full-time', phone: '', startedAt: TODAY });

export function StaffComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<StaffRole | ''>('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<StaffInput>(blank);

  const all = staffRows(store.data);
  const q = query.trim().toLowerCase();
  const rows = all.filter(r => (!role || r.staff.role === role) && (!q || `${r.staff.name} ${r.staff.position} ${r.staff.department}`.toLowerCase().includes(q)));
  const k = {
    total: all.length, active: all.filter(r => r.staff.status === 'active').length, leave: all.filter(r => r.onLeaveToday).length,
    credential: all.filter(r => r.credential && ['expired', 'pending', 'd30'].includes(r.credential)).length, conflicts: all.filter(r => r.conflicts).length,
  };
  const selected = all.find(r => r.staff.id === selectedId) ?? null;
  const licenses = selectedId ? licensesOf(store.data, selectedId) : [];
  const problems = staffProblems(store.data, form);
  const set = <K extends keyof StaffInput>(key: K, value: StaffInput[K]) => setForm({ ...form, [key]: value });
  const pick = (id: string) => { setCreating(false); setSelectedId(selectedId === id ? null : id); };
  const openCreate = () => { setSelectedId(null); setCreating(true); };
  const create = () => backofficeActions.addStaff(form, member => { setCreating(false); setForm(blank()); setSelectedId(member.id); });

  return (
    <bo-staff className="page">
      <PageHead heading="บุคลากรทั้งหมด" source="M24 P2 · ทะเบียนบุคลากรและสถานะการปฏิบัติงาน · ไม่ใช่บัญชีผู้ใช้ (M14 IAM) · ไม่มีเงินเดือนหรือสัญญาจ้าง · ต้นแบบก่อนสัญญาหน้าของ M24 (GATED)" freshness="ข้อมูล ณ วันนี้ 11:32">
        <UiButton size="sm" type="button" onClick={openCreate}><NgIcon svg={lucidePlus} aria-hidden="true" />{tx('เพิ่มบุคลากร')}</UiButton>
      </PageHead>

      <div className="kpi-strip" role="list">
        <div className="kpi" role="listitem"><span className="kpi-value">{k.active}</span><span className="kpi-label">{tx('ปฏิบัติงาน · ทั้งหมด {n}', { n: k.total })}</span></div>
        <div className={cx('kpi', k.leave > 0 && 'warn')} role="listitem"><span className="kpi-value">{k.leave}</span><span className="kpi-label">{tx('ลาวันนี้')}</span></div>
        <div className={cx('kpi', k.credential > 0 && 'danger')} role="listitem"><span className="kpi-value">{k.credential}</span><span className="kpi-label">{tx('ใบอนุญาตต้องจัดการ')}</span></div>
        <div className={cx('kpi', k.conflicts > 0 && 'warn')} role="listitem"><span className="kpi-value">{k.conflicts}</span><span className="kpi-label">{tx('มีความขัดแย้งในเวรสัปดาห์นี้')}</span></div>
      </div>

      <div className={cx('split', (selected || creating) && 'with-drawer')}>
        <div className="panel">
          <div className="filter-bar">
            <input className="ui-input search" type="search" aria-label={tx('ค้นหาชื่อหรือตำแหน่ง')} placeholder={tx('ค้นหาชื่อหรือตำแหน่ง')} value={query} onChange={event => setQuery(event.target.value)} />
            <select className="ui-input" aria-label={tx('บทบาท')} value={role} onChange={event => setRole(event.target.value as StaffRole | '')}>
              <option value="">{tx('ทุกบทบาท')}</option>
              {ROLES.map(r => <option key={r} value={r}>{tx(ROLE[r].label)}</option>)}
            </select>
            <span className="secondary grow">{tx('{n} คน', { n: rows.length })}</span>
          </div>
          <div className="table-wrap">
            <table className="bo-table staff">
              <thead>
                <tr>
                  <th scope="col">{tx('ชื่อ / ตำแหน่ง')}</th>
                  <th scope="col" className="w-kind">{tx('บทบาท')}</th>
                  <th scope="col" className="w-kind">{tx('แผนก')}</th>
                  <th scope="col" className="w-status">{tx('ใบอนุญาต')}</th>
                  <th scope="col" className="w-status">{tx('เวรสัปดาห์นี้')}</th>
                  <th scope="col" className="w-owner">IAM</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.staff.id} tabIndex={0} className={cx(r.staff.id === selectedId && 'selected')} aria-selected={r.staff.id === selectedId} onClick={() => pick(r.staff.id)} onKeyDown={event => { if (event.key === 'Enter') { pick(r.staff.id); } }}>
                    <td><b>{tx(r.staff.name)}</b><div className="secondary">{`${tx(r.staff.position)} · ${tx(EMPLOYMENT[r.staff.employment])}`}</div></td>
                    <td><span className={`chip ${ROLE[r.staff.role].cls}`}>{tx(ROLE[r.staff.role].label)}</span></td>
                    <td>{tx(r.staff.department)}</td>
                    <td>{r.credential ? <span className={`chip ${LICENSE_STATE[r.credential].cls}`}>{tx(LICENSE_STATE[r.credential].label)}</span> : <span className="secondary">{tx('ไม่ต้องมี')}</span>}</td>
                    <td>
                      {r.onLeaveToday ? <span className="chip warn">{tx('ลาวันนี้')}</span> : r.shifts ? <span>{tx('{n} เวร', { n: r.shifts })}</span> : <span className="secondary">—</span>}
                      {r.conflicts > 0 && <div className="secondary text-danger">{tx('ขัดแย้ง {n}', { n: r.conflicts })}</div>}
                    </td>
                    <td>{r.staff.iamUser ? <span className="secondary">{r.staff.iamUser}</span> : <span className="secondary">{tx('ยังไม่เชื่อม')}</span>}</td>
                  </tr>
                ))}
                {!rows.length && <tr className="static"><td colSpan={6} className="empty">{tx('ไม่พบบุคลากรที่ตรงกับตัวกรอง')}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {creating ? (
          <Drawer heading="เพิ่มบุคลากร" sub="ทะเบียนบุคลากร · บัญชีผู้ใช้สร้างแยกที่ IAM" onClosed={() => setCreating(false)} foot={<>
            <UiButton variant="secondary" size="sm" type="button" onClick={() => setCreating(false)}>{tx('ยกเลิก')}</UiButton>
            <span className="grow"></span>
            <UiButton size="sm" type="button" disabled={problems.length > 0} onClick={create}>{tx('เพิ่มบุคลากร')}</UiButton>
          </>}>
            <div className="form-grid">
              <label className="full">{tx('ชื่อที่ใช้ในโรงพยาบาล')}<input className="ui-input" value={form.name} onChange={event => set('name', event.target.value)} placeholder="น.สพ. / สพ.ญ. / พ.ส. …" /></label>
              <label>{tx('บทบาท')}
                <select className="ui-input" value={form.role} onChange={event => set('role', event.target.value as StaffRole)}>
                  {ROLES.map(r => <option key={r} value={r}>{tx(ROLE[r].label)}</option>)}
                </select>
              </label>
              <label>{tx('ตำแหน่งงาน')}<input className="ui-input" value={form.position} onChange={event => set('position', event.target.value)} /></label>
              <label>{tx('แผนก')}
                <select className="ui-input" value={form.department} onChange={event => set('department', event.target.value)}>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{tx(d)}</option>)}
                </select>
              </label>
              <label>{tx('การจ้าง')}
                <select className="ui-input" value={form.employment} onChange={event => set('employment', event.target.value as StaffMember['employment'])}>
                  {EMPLOYMENTS.map(e => <option key={e} value={e}>{tx(EMPLOYMENT[e])}</option>)}
                </select>
              </label>
              <label>{tx('โทรศัพท์')}<input className="ui-input" value={form.phone} onChange={event => set('phone', event.target.value)} /></label>
              <label>{tx('วันเริ่มงาน')}<input className="ui-input" type="date" value={form.startedAt} onChange={event => set('startedAt', event.target.value)} /></label>
            </div>
            {problems.length > 0 && <ul className="problems">{problems.map(p => <li key={p}>{tx(p)}</li>)}</ul>}
          </Drawer>
        ) : selected ? (
          <Drawer heading={selected.staff.name} sub={`${tx(selected.staff.position)} · ${tx(STAFF_STATUS[selected.staff.status].label)}`} onClosed={() => setSelectedId(null)} foot={<>
            <UiButton variant="secondary" size="sm" type="button" onClick={() => backofficeActions.editStaff(selected.staff)}>{tx('แก้ไขข้อมูล')}</UiButton>
            <span className="grow"></span>
            <UiButton size="sm" type="button" onClick={() => backofficeActions.openStaff(selected.staff.id)}>{tx('เปิดหน้ารายละเอียด')}</UiButton>
          </>}>
            <dl className="data-grid">
              <dt>{tx('บทบาท')}</dt><dd>{`${tx(ROLE[selected.staff.role].label)} · ${tx(selected.staff.department)}`}</dd>
              <dt>{tx('การจ้าง')}</dt><dd>{`${tx(EMPLOYMENT[selected.staff.employment])} · ${tx('{n} ชม./สัปดาห์', { n: selected.staff.weeklyHours })}`}</dd>
              <dt>{tx('เริ่มงาน')}</dt><dd>{selected.staff.startedAt}</dd>
              <dt>{tx('โทรศัพท์')}</dt><dd>{selected.staff.phone}</dd>
              <dt>IAM</dt><dd>{selected.staff.iamUser ?? tx('ยังไม่เชื่อมบัญชีผู้ใช้')}</dd>
            </dl>
            <div className="section-title">{tx('ใบอนุญาต')}</div>
            {licenses.map(l => {
              const st = licenseState(l);
              return <div key={l.id} className="sum-row"><span>{tx(LICENSE_KIND[l.kind].label)}<div className="secondary">{`${l.number} · ${tx('หมดอายุ')} ${l.expiresAt}`}</div></span><span className={`chip ${LICENSE_STATE[st].cls}`}>{tx(LICENSE_STATE[st].label)}</span></div>;
            })}
            {!licenses.length && <p className="secondary">{tx('ตำแหน่งนี้ไม่ต้องมีใบอนุญาต')}</p>}
          </Drawer>
        ) : null}
      </div>
    </bo-staff>
  );
}
