/* Service contracts: who covers which devices for what, until when, and what lapses when one ends (assets.contracts, M22 P2) */
import { useState } from 'react';
import { Link } from 'react-router';

import { TODAY } from '../../../clinic/data/model';
import { lucidePlus } from '../../../icons';
import { cx, NgIcon, UiButton } from '../../../user-management/ui';
import { backofficeActions } from '../../backoffice-actions';
import { useBackofficeStore } from '../../backoffice.store';
import { active, addMonths, CONTRACT_KIND, CONTRACT_STATE, contractProblems, type ContractInput, contractState, type ContractState, equipmentOf, retireImpact } from '../../data/assets';
import { daysUntil } from '../../data/home';
import type { ContractKind, ServiceContract } from '../../data/types';
import { useBoI18n } from '../../i18n/bo-i18n';
import { Drawer, PageHead } from '../../shared/parts';

const STRIP: ContractState[] = ['expired', 'd30', 'd60', 'd90', 'active'];
const KINDS = Object.keys(CONTRACT_KIND) as ContractKind[];
/** The work a contract covers, as the pages name it */
const COVER = { pm: 'PM', calibration: 'สอบเทียบ', repair: 'ซ่อม' };
const baht = (n: number) => `฿${n.toLocaleString('en-US')}`;
const BLANK: ContractInput = { vendor: '', contact: '', kind: 'repair', from: TODAY, to: addMonths(TODAY, 12), annualFee: '', responseHours: '8', equipmentIds: [] };

export function ContractsComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const [filter, setFilter] = useState<ContractState | ''>('');
  const [showRetired, setShowRetired] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<ContractInput>({ ...BLANK, equipmentIds: [] });

  const d = store.data;
  const c = { expired: 0, d30: 0, d60: 0, d90: 0, active: 0, retired: 0 };
  for (const k of d.contracts) {
    c[contractState(k)]++;
  }
  const fees = d.contracts.filter(k => ['d30', 'd60', 'd90', 'active'].includes(contractState(k))).reduce((n, k) => n + k.annualFee, 0);
  const rows = d.contracts.filter(k => (filter ? contractState(k) === filter : showRetired || k.status === 'active')).sort((a, b) => a.to.localeCompare(b.to));
  const selected = d.contracts.find(k => k.id === selectedId) ?? null;
  const devices = active(d);
  const problems = contractProblems(d, form);

  const days = (k: ServiceContract) => daysUntil(k.to);
  const name = (id: string) => equipmentOf(d, id)?.name ?? id;
  const toggle = (s: ContractState) => setFilter(filter === s ? '' : s);
  const pick = (id: string) => { setCreating(false); setSelectedId(selectedId === id ? null : id); };
  const openCreate = () => { setSelectedId(null); setCreating(true); };
  const set = <K extends keyof ContractInput>(key: K, value: ContractInput[K]) => setForm({ ...form, [key]: value });
  const toggleDevice = (id: string) => set('equipmentIds', form.equipmentIds.includes(id) ? form.equipmentIds.filter(x => x !== id) : [...form.equipmentIds, id]);
  const create = () => backofficeActions.addContract(form, k => {
    setCreating(false);
    setForm({ ...BLANK, equipmentIds: [] });
    setFilter('');
    setSelectedId(k.id);
  });

  return (
    <bo-contracts className="page">
      <PageHead heading="สัญญาบริการอุปกรณ์" source="M22 P2 · ผู้ให้บริการ ขอบเขต และวันหมดอายุ 30/60/90 วัน · อุปกรณ์ critical ต้องมีสัญญาซ่อมที่มีผล · ค่าบริการเป็นข้อมูลติดตาม ไม่ใช่การตั้งหนี้ · ต้นแบบก่อนสัญญาหน้าของ M22 (GATED)" freshness="ข้อมูล ณ วันนี้ 11:32">
        <UiButton size="sm" type="button" onClick={openCreate}><NgIcon svg={lucidePlus} aria-hidden="true" />{tx('บันทึกสัญญา')}</UiButton>
      </PageHead>

      <div className="kpi-strip" role="list">
        {STRIP.map(s => (
          <button key={s} type="button" role="listitem" onClick={() => toggle(s)}
            className={cx('kpi', filter === s && 'active', (s === 'expired' || s === 'd30') && c[s] > 0 && 'danger', s === 'd60' && c[s] > 0 && 'warn')}>
            <span className="kpi-value">{c[s]}</span><span className="kpi-label">{tx(CONTRACT_STATE[s].label)}</span>
          </button>
        ))}
        <div className="kpi" role="listitem"><span className="kpi-value">{baht(fees)}</span><span className="kpi-label">{tx('ค่าบริการต่อปีของสัญญาที่มีผล')}</span></div>
      </div>

      <div className={cx('split', (selected || creating) && 'with-drawer')}>
        <div className="panel">
          <div className="filter-bar">
            <label className="check"><input type="checkbox" checked={showRetired} onChange={event => setShowRetired(event.target.checked)} />{tx('แสดงสัญญาที่ยกเลิกแล้ว')}</label>
            <span className="secondary grow">{tx('{n} รายการ · เรียงตามวันสิ้นสุด', { n: rows.length })}</span>
          </div>
          <div className="table-wrap">
            <table className="bo-table contracts">
              <thead>
                <tr>
                  <th scope="col" className="w-ref">{tx('เลขที่')}</th>
                  <th scope="col">{tx('ผู้ให้บริการ')}</th>
                  <th scope="col" className="w-kind">{tx('ขอบเขต')}</th>
                  <th scope="col" className="w-due">{tx('สิ้นสุด')}</th>
                  <th scope="col" className="w-amount num">{tx('ต่อปี')}</th>
                  <th scope="col" className="w-amount num">{tx('อุปกรณ์')}</th>
                  <th scope="col" className="w-status">{tx('สถานะ')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(k => {
                  const st = contractState(k);
                  const n = days(k);
                  return (
                    <tr key={k.id} tabIndex={0} className={cx(k.id === selectedId && 'selected')} aria-selected={k.id === selectedId} onClick={() => pick(k.id)} onKeyDown={event => { if (event.key === 'Enter') { pick(k.id); } }}>
                      <td><b>{k.id}</b></td>
                      <td>{tx(k.vendor)}<div className="secondary">{tx(k.contact)}</div></td>
                      <td>{tx(CONTRACT_KIND[k.kind].label)}<div className="secondary">{tx('ตอบสนอง {n} ชม.', { n: k.responseHours })}</div></td>
                      <td className="num">{k.to}{st !== 'retired' && <div className={cx('secondary', n <= 30 && 'text-danger')}>{n < 0 ? tx('หมดอายุแล้ว {n} วัน', { n: -n }) : tx('{n} วัน', { n })}</div>}</td>
                      <td className="num">{baht(k.annualFee)}</td>
                      <td className="num">{k.equipmentIds.length}</td>
                      <td><span className={`chip ${CONTRACT_STATE[st].cls}`}>{tx(CONTRACT_STATE[st].label)}</span></td>
                    </tr>
                  );
                })}
                {!rows.length && <tr className="static"><td colSpan={7} className="empty">{tx('ไม่มีสัญญาที่ตรงกับตัวกรอง')}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {creating ? (
          <Drawer heading="บันทึกสัญญา" sub="ผู้ให้บริการ ขอบเขต และอุปกรณ์ในสัญญา" onClosed={() => setCreating(false)} foot={<>
            <UiButton variant="secondary" size="sm" type="button" onClick={() => setCreating(false)}>{tx('ยกเลิก')}</UiButton>
            <span className="grow"></span>
            <UiButton size="sm" type="button" disabled={problems.length > 0} onClick={create}>{tx('บันทึกสัญญา')}</UiButton>
          </>}>
            <div className="form-grid">
              <label className="full">{tx('ผู้ให้บริการ')}<input className="ui-input" value={form.vendor} onChange={event => set('vendor', event.target.value)} /></label>
              <label className="full">{tx('ผู้ติดต่อ')}<input className="ui-input" placeholder={tx('ชื่อ · โทรศัพท์')} value={form.contact} onChange={event => set('contact', event.target.value)} /></label>
              <label>{tx('ขอบเขต')}
                <select className="ui-input" value={form.kind} onChange={event => set('kind', event.target.value as ContractKind)}>
                  {KINDS.map(k => <option key={k} value={k}>{tx(CONTRACT_KIND[k].label)}</option>)}
                </select>
              </label>
              <label>{tx('ตอบสนอง (ชม.)')}<input className="ui-input" inputMode="numeric" value={form.responseHours} onChange={event => set('responseHours', event.target.value)} /></label>
              <label>{tx('เริ่ม')}<input className="ui-input" type="date" value={form.from} onChange={event => set('from', event.target.value)} /></label>
              <label>{tx('สิ้นสุด')}<input className="ui-input" type="date" value={form.to} onChange={event => set('to', event.target.value)} /></label>
              <label className="full">{tx('ค่าบริการต่อปี (บาท)')}<input className="ui-input" inputMode="decimal" value={form.annualFee} onChange={event => set('annualFee', event.target.value)} /></label>
            </div>
            <fieldset className="pick-list">
              <legend>{tx('อุปกรณ์ในสัญญา')}</legend>
              {devices.map(e => (
                <label key={e.id} className="check"><input type="checkbox" checked={form.equipmentIds.includes(e.id)} onChange={() => toggleDevice(e.id)} />{tx(e.name)} <span className="secondary">{e.id}</span></label>
              ))}
            </fieldset>
            {problems.length > 0 && <ul className="problems">{problems.map(p => <li key={p}>{tx(p)}</li>)}</ul>}
          </Drawer>
        ) : selected ? (() => {
          const k = selected;
          const st = contractState(k);
          const uncovered = retireImpact(d, k);
          return (
            <Drawer heading={`${k.id} · ${tx(k.vendor)}`} sub={`${tx(CONTRACT_KIND[k.kind].label)} · ${k.from} → ${k.to}`} onClosed={() => setSelectedId(null)} foot={k.status === 'active' ? <>
              <UiButton variant="danger-soft" size="sm" type="button" onClick={() => backofficeActions.retireContract(k)}>{tx('ยกเลิกสัญญา')}</UiButton>
              <span className="grow"></span>
              <UiButton size="sm" type="button" onClick={() => backofficeActions.renewContract(k)}>{tx('ต่อสัญญา')}</UiButton>
            </> : null}>
              <dl className="data-grid">
                <dt>{tx('ผู้ติดต่อ')}</dt><dd>{tx(k.contact)}</dd>
                <dt>{tx('ครอบคลุม')}</dt><dd>{tx(CONTRACT_KIND[k.kind].covers.map(w => COVER[w]).join(' · '))}</dd>
                <dt>{tx('ค่าบริการต่อปี')}</dt><dd>{baht(k.annualFee)}</dd>
                <dt>{tx('สถานะ')}</dt><dd><span className={`chip ${CONTRACT_STATE[st].cls}`}>{tx(CONTRACT_STATE[st].label)}</span></dd>
              </dl>
              {st === 'expired' && uncovered.length > 0 && <p className="notice danger">{tx('สัญญาหมดอายุแล้ว — อุปกรณ์เหล่านี้ไม่มีสัญญาซ่อม: {list}', { list: uncovered.map(e => e.id).join(', ') })}</p>}
              <div className="section-title">{tx('อุปกรณ์ในสัญญา')}</div>
              <div className="table-wrap">
                <table className="bo-table">
                  <tbody>
                    {k.equipmentIds.map(id => (
                      <tr key={id} className="static"><td><Link className="link" to={`/backoffice/assets/equipment/${id}`}>{tx(name(id))}</Link><div className="secondary">{id}</div></td></tr>
                    ))}
                    {!k.equipmentIds.length && <tr className="static"><td className="empty">{tx('ไม่มีอุปกรณ์ในสัญญา')}</td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="timeline">
                {k.history.map((h, i) => <div key={i} className="tl">{h[0]} · <b>{tx(h[2])}</b> · {tx(h[1])}{h[3] && <> — {tx(h[3])}</>}</div>)}
              </div>
            </Drawer>
          );
        })() : null}
      </div>
    </bo-contracts>
  );
}
