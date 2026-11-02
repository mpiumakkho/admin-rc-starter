/* Equipment registry: every device with its readiness, PM and calibration at a glance, and its bed link (assets.registry, M22 P2) */
import { useState } from 'react';

import { TODAY } from '../../../clinic/data/model';
import { lucidePlus } from '../../../icons';
import { cx, NgIcon, UiButton } from '../../../user-management/ui';
import { backofficeActions } from '../../backoffice-actions';
import { useBackofficeStore } from '../../backoffice.store';
import {
  bedsAt, CALIBRATION_STATE, calibrationState, CLASSES, contractsOf, CRITICALITY, DUE_STATE, EQUIPMENT_CLASS, EQUIPMENT_STATUS, equipmentProblems, type EquipmentInput, LOCATIONS, openPm,
  pmState, READINESS, readiness,
} from '../../data/assets';
import type { Criticality, Equipment, EquipmentClass } from '../../data/types';
import { useBoI18n } from '../../i18n/bo-i18n';
import { Drawer, PageHead } from '../../shared/parts';
import { PagerFoot } from '../../shared/pager';
import { usePager } from '../../shared/use-pager';

const STATUSES: Equipment['status'][] = ['in-service', 'down', 'decommissioned'];
const CRITS = Object.keys(CRITICALITY) as Criticality[];
const PLACES = Object.keys(LOCATIONS);
const BLANK: EquipmentInput = {
  name: '', cls: 'monitor', maker: '', model: '', serial: '', location: 'ICU', bed: '', criticality: 'high', purchasedAt: TODAY, purchaseCost: '', pmMonths: '6', calibrationMonths: '12',
};

export function RegistryComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [cls, setCls] = useState<EquipmentClass | ''>('');
  const [status, setStatus] = useState<Equipment['status'] | ''>('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<EquipmentInput>({ ...BLANK });

  const d = store.data;
  const q = query.trim().toLowerCase();
  const rows = d.equipment.filter(e => (status ? e.status === status : e.status !== 'decommissioned')
    && (!location || e.location === location) && (!cls || e.cls === cls)
    && (!q || [e.name, e.id, e.serial, e.maker, e.model].some(v => v.toLowerCase().includes(q))));
  const selected = d.equipment.find(e => e.id === selectedId) ?? null;
  const beds = bedsAt(form.location);
  const problems = equipmentProblems(d, form);

  const pick = (id: string) => { setCreating(false); setSelectedId(selectedId === id ? null : id); };
  const openCreate = () => { setSelectedId(null); setCreating(true); };
  const set = <K extends keyof EquipmentInput>(key: K, value: EquipmentInput[K]) => setForm({ ...form, [key]: value });
  const create = () => backofficeActions.addEquipment(form, e => {
    setCreating(false);
    setForm({ ...BLANK });
    setStatus('');
    setSelectedId(e.id);
  });

  /** The table's pages */
  const pager = usePager(rows);
  return (
    <bo-equipment-registry className="page">
      <PageHead heading="ทะเบียนอุปกรณ์" source="M22 P2 · ทะเบียนอุปกรณ์การแพทย์ตาม TAHSA-11 · ผูกเตียงกับผังเตียง M10 · ต้นทุนเป็นข้อมูลการดำเนินงาน ไม่ใช่ทะเบียนสินทรัพย์ทางบัญชี · ต้นแบบก่อนสัญญาหน้าของ M22 (GATED)" freshness="ข้อมูล ณ วันนี้ 11:32">
        <UiButton size="sm" type="button" onClick={openCreate}><NgIcon svg={lucidePlus} aria-hidden="true" />{tx('ขึ้นทะเบียนอุปกรณ์')}</UiButton>
      </PageHead>

      <div className={cx('split', (selected || creating) && 'with-drawer')}>
        <div className="panel">
          <div className="filter-bar">
            <input className="ui-input search" type="search" aria-label={tx('ค้นหา')} placeholder={tx('ชื่อ รหัส หรือหมายเลขเครื่อง')} value={query} onChange={event => setQuery(event.target.value)} />
            <select className="ui-input" aria-label={tx('ที่ตั้ง')} value={location} onChange={event => setLocation(event.target.value)}>
              <option value="">{tx('ทุกที่ตั้ง')}</option>
              {PLACES.map(l => <option key={l} value={l}>{tx(l)}</option>)}
            </select>
            <select className="ui-input" aria-label={tx('ชนิด')} value={cls} onChange={event => setCls(event.target.value as EquipmentClass | '')}>
              <option value="">{tx('ทุกชนิด')}</option>
              {CLASSES.map(c => <option key={c} value={c}>{tx(EQUIPMENT_CLASS[c].label)}</option>)}
            </select>
            <div className="segmented" role="group" aria-label={tx('สถานะ')}>
              <button type="button" className={cx(!status && 'active')} aria-pressed={!status} onClick={() => setStatus('')}>{tx('ใช้อยู่')}</button>
              {STATUSES.map(s => <button key={s} type="button" className={cx(status === s && 'active')} aria-pressed={status === s} onClick={() => setStatus(s)}>{tx(EQUIPMENT_STATUS[s].label)}</button>)}
            </div>
            <span className="secondary grow">{tx('{n} รายการ', { n: rows.length })}</span>
          </div>
          <div className="table-wrap">
            <table className="bo-table equipment">
              <thead>
                <tr>
                  <th scope="col">{tx('อุปกรณ์')}</th>
                  <th scope="col" className="w-owner">{tx('ที่ตั้ง')}</th>
                  <th scope="col" className="w-kind">{tx('ความสำคัญ')}</th>
                  <th scope="col" className="w-status">{tx('ความพร้อม')}</th>
                  <th scope="col" className="w-due">{tx('PM ถัดไป')}</th>
                  <th scope="col" className="w-status">{tx('สอบเทียบ')}</th>
                </tr>
              </thead>
              <tbody>
                {pager.rows.map(e => {
                  const r = readiness(d, e);
                  const pm = e.status === 'decommissioned' ? undefined : openPm(d, e.id);
                  const pmS = pmState(d, e);
                  const cal = calibrationState(d, e);
                  return (
                    <tr key={e.id} tabIndex={0} className={cx(e.id === selectedId && 'selected')} aria-selected={e.id === selectedId} onClick={() => pick(e.id)} onKeyDown={event => { if (event.key === 'Enter') { pick(e.id); } }}>
                      <td><b>{tx(e.name)}</b><div className="secondary">{e.id} · {e.maker} {e.model}</div></td>
                      <td>{tx(e.location)}{e.bed && <div className="secondary">{tx('เตียง {bed}', { bed: e.bed })}</div>}</td>
                      <td><span className={`chip ${CRITICALITY[e.criticality].cls}`}>{tx(CRITICALITY[e.criticality].label)}</span></td>
                      <td>
                        {e.status === 'decommissioned'
                          ? <span className="chip quiet">{tx(EQUIPMENT_STATUS[e.status].label)}</span>
                          : <span className={`chip ${READINESS[r.state].cls}`}>{tx(READINESS[r.state].label)}</span>}
                      </td>
                      <td className="num">{pm && pmS ? <><span>{pm.due}</span><div className={cx('secondary', pmS === 'overdue' && 'text-danger')}>{tx(DUE_STATE[pmS].label)}</div></> : '—'}</td>
                      <td>{cal ? <span className={`chip ${CALIBRATION_STATE[cal].cls}`}>{tx(CALIBRATION_STATE[cal].label)}</span> : <span className="secondary">{tx('ไม่ต้องสอบเทียบ')}</span>}</td>
                    </tr>
                  );
                })}
                {!rows.length && <tr className="static"><td colSpan={6} className="empty">{tx('ไม่มีอุปกรณ์ที่ตรงกับตัวกรอง')}</td></tr>}
              </tbody>
            </table>
          </div>
          <PagerFoot pager={pager} />
        </div>

        {creating ? (
          <Drawer heading="ขึ้นทะเบียนอุปกรณ์" sub="PM ครั้งแรกวางแผนหนึ่งรอบจากวันนี้" onClosed={() => setCreating(false)} foot={<>
            <UiButton variant="secondary" size="sm" type="button" onClick={() => setCreating(false)}>{tx('ยกเลิก')}</UiButton>
            <span className="grow"></span>
            <UiButton size="sm" type="button" disabled={problems.length > 0} onClick={create}>{tx('ขึ้นทะเบียน')}</UiButton>
          </>}>
            <div className="form-grid">
              <label className="full">{tx('ชื่ออุปกรณ์')}<input className="ui-input" value={form.name} onChange={event => set('name', event.target.value)} /></label>
              <label>{tx('ชนิด')}
                <select className="ui-input" value={form.cls} onChange={event => set('cls', event.target.value as EquipmentClass)}>
                  {CLASSES.map(c => <option key={c} value={c}>{tx(EQUIPMENT_CLASS[c].label)}</option>)}
                </select>
              </label>
              <label>{tx('ความสำคัญ')}
                <select className="ui-input" value={form.criticality} onChange={event => set('criticality', event.target.value as Criticality)}>
                  {CRITS.map(c => <option key={c} value={c}>{tx(CRITICALITY[c].label)}</option>)}
                </select>
              </label>
              <label>{tx('ผู้ผลิต')}<input className="ui-input" value={form.maker} onChange={event => set('maker', event.target.value)} /></label>
              <label>{tx('รุ่น')}<input className="ui-input" value={form.model} onChange={event => set('model', event.target.value)} /></label>
              <label className="full">{tx('หมายเลขเครื่อง')}<input className="ui-input" value={form.serial} onChange={event => set('serial', event.target.value)} /></label>
              <label>{tx('ที่ตั้ง')}
                <select className="ui-input" value={form.location} onChange={event => setForm({ ...form, location: event.target.value, bed: '' })}>
                  {PLACES.map(l => <option key={l} value={l}>{tx(l)}</option>)}
                </select>
              </label>
              <label>{tx('เตียง (M10)')}
                <select className="ui-input" disabled={!beds.length} value={form.bed} onChange={event => set('bed', event.target.value)}>
                  <option value="">{tx('ไม่ผูกเตียง')}</option>
                  {beds.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </label>
              <label>{tx('วันที่ซื้อ')}<input className="ui-input" type="date" value={form.purchasedAt} onChange={event => set('purchasedAt', event.target.value)} /></label>
              <label>{tx('ราคาซื้อ (บาท)')}<input className="ui-input" inputMode="decimal" value={form.purchaseCost} onChange={event => set('purchaseCost', event.target.value)} /></label>
              <label>{tx('รอบ PM (เดือน)')}<input className="ui-input" inputMode="numeric" value={form.pmMonths} onChange={event => set('pmMonths', event.target.value)} /></label>
              <label>{tx('รอบสอบเทียบ (เดือน)')}<input className="ui-input" inputMode="numeric" placeholder={tx('ว่างถ้าไม่ต้องสอบเทียบ')} value={form.calibrationMonths} onChange={event => set('calibrationMonths', event.target.value)} /></label>
            </div>
            {problems.length > 0 && <ul className="problems">{problems.map(p => <li key={p}>{tx(p)}</li>)}</ul>}
          </Drawer>
        ) : selected ? (() => {
          const r = readiness(d, selected);
          const contracts = contractsOf(d, selected.id);
          return (
            <Drawer heading={tx(selected.name)} sub={`${selected.id} · ${tx(EQUIPMENT_CLASS[selected.cls].label)}`} onClosed={() => setSelectedId(null)} foot={<>
              {selected.status !== 'decommissioned' && <UiButton variant="secondary" size="sm" type="button" onClick={() => backofficeActions.moveEquipment(selected)}>{tx('แก้ไขที่ตั้ง')}</UiButton>}
              <span className="grow"></span>
              <UiButton size="sm" type="button" onClick={() => backofficeActions.openEquipment(selected.id)}>{tx('เปิดรายละเอียด')}</UiButton>
            </>}>
              <dl className="data-grid">
                <dt>{tx('ผู้ผลิต / รุ่น')}</dt><dd>{selected.maker} {selected.model}</dd>
                <dt>{tx('หมายเลขเครื่อง')}</dt><dd>{selected.serial}</dd>
                <dt>{tx('ที่ตั้ง')}</dt><dd>{tx(selected.location)}{selected.bed && <> · {tx('เตียง {bed}', { bed: selected.bed })}</>}</dd>
                <dt>{tx('สถานะ')}</dt><dd><span className={`chip ${EQUIPMENT_STATUS[selected.status].cls}`}>{tx(EQUIPMENT_STATUS[selected.status].label)}</span></dd>
                <dt>{tx('สัญญาบริการ')}</dt><dd>{contracts.length ? contracts.map(c => <div key={c.id}>{c.id} · {tx(c.vendor)}</div>) : <span className="text-danger">{tx('ไม่มี')}</span>}</dd>
              </dl>
              {selected.status !== 'decommissioned' && <>
                <div className="sum-row"><b>{tx('ความพร้อม')}</b><span className={`chip ${READINESS[r.state].cls}`}>{tx(READINESS[r.state].label)}</span></div>
                <ul className="checks">{r.reasons.length ? r.reasons.map(x => <li key={x}>{tx(x)}</li>) : <li className="ok-text">{tx('ไม่มีรายการค้าง')}</li>}</ul>
              </>}
            </Drawer>
          );
        })() : null}
      </div>
    </bo-equipment-registry>
  );
}
