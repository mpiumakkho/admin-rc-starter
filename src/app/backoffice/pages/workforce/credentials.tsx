/* Licenses and credentials: verification and expiry at 30/60/90 days, renewed into a fresh check (workforce.credentials, M24 P2) */
import { useState } from 'react';

import { TODAY } from '../../../clinic/data/model';
import { lucidePlus } from '../../../icons';
import { cx, NgIcon, UiButton } from '../../../user-management/ui';
import { backofficeActions } from '../../backoffice-actions';
import { useBackofficeStore } from '../../backoffice.store';
import { daysUntil } from '../../data/home';
import type { License, LicenseKind } from '../../data/types';
import { canVerify, expiryCounts, LICENSE_KIND, LICENSE_STATE, licenseProblems, licenseState, type LicenseInput, type LicenseState, ROLE, staffOf } from '../../data/workforce';
import { useBoI18n } from '../../i18n/bo-i18n';
import { Drawer, PageHead } from '../../shared/parts';
import { PagerFoot } from '../../shared/pager';
import { usePager } from '../../shared/use-pager';

const STRIP: LicenseState[] = ['expired', 'd30', 'd60', 'd90', 'pending'];
const KINDS = Object.keys(LICENSE_KIND) as LicenseKind[];

export function CredentialsComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const [filter, setFilter] = useState<LicenseState | ''>('');
  const [kind, setKind] = useState<LicenseKind | ''>('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<LicenseInput>({ staffId: 'S04', kind: 'controlled-license', number: '', issuer: '', issuedAt: TODAY, expiresAt: '' });

  const d = store.data;
  const c = expiryCounts(d);
  const rows = d.licenses.filter(l => (!filter || licenseState(l) === filter) && (!kind || l.kind === kind)).sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));
  const selected = d.licenses.find(l => l.id === selectedId) ?? null;
  const holders = d.staff.filter(s => KINDS.some(k => LICENSE_KIND[k].roles.includes(s.role)));
  const role = staffOf(d, form.staffId)?.role;
  const kindsFor = KINDS.filter(k => role && LICENSE_KIND[k].roles.includes(role));
  const problems = licenseProblems(d, form);

  const days = (l: License) => daysUntil(l.expiresAt);
  const holder = (l: License) => staffOf(d, l.staffId)?.name ?? '—';
  const position = (l: License) => staffOf(d, l.staffId)?.position ?? '';
  const toggle = (s: LicenseState) => setFilter(filter === s ? '' : s);
  const pick = (id: string) => { setCreating(false); setSelectedId(selectedId === id ? null : id); };
  const openCreate = () => { setSelectedId(null); setCreating(true); };
  const set = <K extends keyof LicenseInput>(key: K, value: LicenseInput[K]) => setForm({ ...form, [key]: value });
  const pickStaff = (id: string) => {
    const r = staffOf(d, id)?.role;
    const k = KINDS.find(x => r && LICENSE_KIND[x].roles.includes(r)) ?? form.kind;
    setForm({ ...form, staffId: id, kind: k, issuer: '' });
  };
  const create = () => backofficeActions.addLicense(form, license => {
    setCreating(false);
    setForm({ ...form, number: '', expiresAt: '' });
    setFilter('');
    setSelectedId(license.id);
  });

  /** The table's pages */
  const pager = usePager(rows);
  return (
    <bo-credentials className="page">
      <PageHead heading="ใบอนุญาตและคุณสมบัติวิชาชีพ" source="M24 P2 · ติดตามการตรวจสอบและวันหมดอายุ 30/60/90 วัน · ไทยไม่มีระบบรับรองพยาบาลสัตว์ โรงพยาบาลกำหนดขอบเขตเอง · ต้นแบบก่อนสัญญาหน้าของ M24 (GATED)" freshness="ข้อมูล ณ วันนี้ 11:32">
        <UiButton size="sm" type="button" onClick={openCreate}><NgIcon svg={lucidePlus} aria-hidden="true" />{tx('บันทึกใบอนุญาต')}</UiButton>
      </PageHead>

      <div className="kpi-strip" role="list">
        {STRIP.map(s => (
          <button key={s} type="button" role="listitem" onClick={() => toggle(s)}
            className={cx('kpi', filter === s && 'active', (s === 'expired' || s === 'd30') && c[s] > 0 && 'danger', (s === 'd60' || s === 'pending') && c[s] > 0 && 'warn')}>
            <span className="kpi-value">{c[s]}</span><span className="kpi-label">{tx(LICENSE_STATE[s].label)}</span>
          </button>
        ))}
      </div>

      <div className={cx('split', (selected || creating) && 'with-drawer')}>
        <div className="panel">
          <div className="filter-bar">
            <select className="ui-input" aria-label={tx('ชนิด')} value={kind} onChange={event => setKind(event.target.value as LicenseKind | '')}>
              <option value="">{tx('ทุกชนิด')}</option>
              {KINDS.map(k => <option key={k} value={k}>{tx(LICENSE_KIND[k].label)}</option>)}
            </select>
            <span className="secondary grow">{tx('{n} รายการ · เรียงตามวันหมดอายุ', { n: rows.length })}</span>
          </div>
          <div className="table-wrap">
            <table className="bo-table credentials">
              <thead>
                <tr>
                  <th scope="col" className="w-owner">{tx('ผู้ถือ')}</th>
                  <th scope="col">{tx('ชนิด')}</th>
                  <th scope="col" className="w-ref">{tx('เลขที่')}</th>
                  <th scope="col" className="w-due">{tx('หมดอายุ')}</th>
                  <th scope="col" className="w-kind">{tx('เหลือเวลา')}</th>
                  <th scope="col" className="w-status">{tx('สถานะ')}</th>
                </tr>
              </thead>
              <tbody>
                {pager.rows.map(l => {
                  const st = licenseState(l);
                  const n = days(l);
                  return (
                    <tr key={l.id} tabIndex={0} className={cx(l.id === selectedId && 'selected')} aria-selected={l.id === selectedId} onClick={() => pick(l.id)} onKeyDown={event => { if (event.key === 'Enter') { pick(l.id); } }}>
                      <td><b>{tx(holder(l))}</b><div className="secondary">{tx(position(l))}</div></td>
                      <td>{tx(LICENSE_KIND[l.kind].label)}<div className="secondary">{tx(l.issuer)}</div></td>
                      <td>{l.number}</td>
                      <td className="num">{l.expiresAt}</td>
                      <td className={cx('num', n <= 30 && 'text-danger')}>{n < 0 ? tx('หมดอายุแล้ว {n} วัน', { n: -n }) : tx('{n} วัน', { n })}</td>
                      <td><span className={`chip ${LICENSE_STATE[st].cls}`}>{tx(LICENSE_STATE[st].label)}</span></td>
                    </tr>
                  );
                })}
                {!rows.length && <tr className="static"><td colSpan={6} className="empty">{tx('ไม่มีใบอนุญาตที่ตรงกับตัวกรอง')}</td></tr>}
              </tbody>
            </table>
          </div>
          <PagerFoot pager={pager} />
        </div>

        {creating ? (
          <Drawer heading="บันทึกใบอนุญาต" sub="รอตรวจสอบกับผู้ออกก่อนใช้" onClosed={() => setCreating(false)} foot={<>
            <UiButton variant="secondary" size="sm" type="button" onClick={() => setCreating(false)}>{tx('ยกเลิก')}</UiButton>
            <span className="grow"></span>
            <UiButton size="sm" type="button" disabled={problems.length > 0} onClick={create}>{tx('บันทึกใบอนุญาต')}</UiButton>
          </>}>
            <div className="form-grid">
              <label className="full">{tx('ชื่อบุคลากร')}
                <select className="ui-input" value={form.staffId} onChange={event => pickStaff(event.target.value)}>
                  {holders.map(s => <option key={s.id} value={s.id}>{`${tx(s.name)} · ${tx(ROLE[s.role].label)}`}</option>)}
                </select>
              </label>
              <label className="full">{tx('ชนิด')}
                <select className="ui-input" value={form.kind} onChange={event => setForm({ ...form, kind: event.target.value as LicenseKind, issuer: '' })}>
                  {kindsFor.map(k => <option key={k} value={k}>{tx(LICENSE_KIND[k].label)}</option>)}
                </select>
              </label>
              <label>{tx('เลขที่')}<input className="ui-input" value={form.number} onChange={event => set('number', event.target.value)} /></label>
              <label>{tx('ผู้ออก')}<input className="ui-input" value={form.issuer} onChange={event => set('issuer', event.target.value)} /></label>
              <label>{tx('วันออก')}<input className="ui-input" type="date" value={form.issuedAt} onChange={event => set('issuedAt', event.target.value)} /></label>
              <label>{tx('วันหมดอายุ')}<input className="ui-input" type="date" value={form.expiresAt} onChange={event => set('expiresAt', event.target.value)} /></label>
            </div>
            {problems.length > 0 && <ul className="problems">{problems.map(p => <li key={p}>{tx(p)}</li>)}</ul>}
          </Drawer>
        ) : selected ? (() => {
          const st = licenseState(selected);
          return (
            <Drawer heading={selected.number} sub={`${tx(holder(selected))} · ${tx(LICENSE_KIND[selected.kind].label)}`} onClosed={() => setSelectedId(null)} foot={<>
              <UiButton variant="secondary" size="sm" type="button" onClick={() => backofficeActions.renewLicense(selected)}>{tx('บันทึกการต่ออายุ')}</UiButton>
              <span className="grow"></span>
              {selected.verification === 'pending' && <UiButton size="sm" type="button" disabled={!canVerify(d, selected, store.userName)} onClick={() => backofficeActions.verifyLicense(selected)}>{tx('ตรวจสอบแล้ว')}</UiButton>}
            </>}>
              <dl className="data-grid">
                <dt>{tx('ผู้ออก')}</dt><dd>{tx(selected.issuer)}</dd>
                <dt>{tx('ใช้ได้')}</dt><dd>{selected.issuedAt} → {selected.expiresAt}</dd>
                <dt>{tx('สถานะ')}</dt><dd><span className={`chip ${LICENSE_STATE[st].cls}`}>{tx(LICENSE_STATE[st].label)}</span></dd>
                <dt>{tx('ตรวจสอบ')}</dt><dd>{selected.verifiedBy ? `${tx(selected.verifiedBy)} · ${selected.verifiedAt}` : tx('ยังไม่ได้ตรวจสอบ')}</dd>
              </dl>
              {selected.kind === 'vet-license' && st !== 'valid' && <p className="notice warn">{tx('สัตวแพทย์ที่ใบอนุญาตยังไม่ได้ตรวจสอบหรือหมดอายุ จัดเวรตรวจและรับเวร on-call ไม่ได้ และสิทธิ์ที่อิงใบอนุญาตนี้ถูกระงับโดยผล')}</p>}
              <div className="timeline">
                {selected.history.map((h, i) => <div key={i} className="tl">{h[0]} · <b>{tx(h[2])}</b> · {tx(h[1])}{h[3] && <> — {tx(h[3])}</>}</div>)}
              </div>
            </Drawer>
          );
        })() : null}
      </div>
    </bo-credentials>
  );
}
