/* The work overview: everything that waits in every module, the most pressing first (ux/menus/01-home.md) */
import { useState } from 'react';

import { lucideArrowUpRight } from '../../../icons';
import { cx, NgIcon, UiLinkButton } from '../../../user-management/ui';
import { useBackofficeStore } from '../../backoffice.store';
import { daysUntil, PRIORITY, STATUS, workload } from '../../data/home';
import { MODULES, type Module, type WorkItem } from '../../data/types';
import { useBoI18n } from '../../i18n/bo-i18n';
import { Drawer, ModuleTag, PageHead } from '../../shared/parts';
import { PagerFoot } from '../../shared/pager';
import { usePager } from '../../shared/use-pager';

const MODULE_KEYS = Object.keys(MODULES) as Module[];
const STATUS_KEYS = Object.keys(STATUS) as WorkItem['status'][];
const dueText = (due: string) => {
  const d = daysUntil(due);
  return d < 0 ? 'เกินกำหนด {n} วัน' : d === 0 ? 'วันนี้' : 'อีก {n} วัน';
};

export function OverviewComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const [q, setQ] = useState('');
  const [module, setModule] = useState<Module | ''>('');
  const [status, setStatus] = useState<WorkItem['status'] | ''>('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const items = store.worklist;
  const critical = items.filter(i => i.priority === 'critical').length;
  const load = workload(items);
  const needle = q.trim().toLowerCase();
  const rows = items.filter(i => (!module || i.module === module) && (!status || i.status === status)
    && (!needle || `${i.title} ${i.detail} ${i.ref} ${i.kind}`.toLowerCase().includes(needle)));
  const selected = items.find(i => i.id === selectedId) ?? null;
  const pick = (item: WorkItem) => setSelectedId(selectedId === item.id ? null : item.id);
  const due = (item: WorkItem) => tx(dueText(item.due), { n: Math.abs(daysUntil(item.due)) });

  /** The table's pages */
  const pager = usePager(rows);
  return (
    <bo-overview className="page">
      <PageHead heading="ภาพรวมงาน" source="รวมจาก M11 M06 M22 M24 M28 M31 ตามสิทธิ์ · เปิดรายการต้นทางเพื่อแก้ไข" freshness="ข้อมูล ณ วันนี้ 11:32" />

      {/* How much waits, by module */}
      <div className="kpi-strip tight" role="list">
        <div className="kpi" role="listitem"><span className="kpi-value">{items.length}</span><span className="kpi-label">{tx('รายการทั้งหมด')}</span></div>
        <div className="kpi danger" role="listitem"><span className="kpi-value">{critical}</span><span className="kpi-label">{tx('วิกฤต')}</span></div>
        {load.map(w => (
          <button key={w.module} type="button" className={cx('kpi', module === w.module && 'active')} role="listitem" onClick={() => setModule(module === w.module ? '' : w.module)}>
            <span className="kpi-value">{w.count}{w.critical > 0 && <span className="kpi-sub danger">{w.critical}</span>}</span>
            <span className="kpi-label">{`${w.module} · ${tx(MODULES[w.module].name)}`}</span>
          </button>
        ))}
      </div>

      <div className={cx('split', selected && 'with-drawer')}>
        <div className="panel">
          <div className="filter-bar">
            <input className="ui-input search" type="search" placeholder={tx('ค้นหาชื่อ รหัส หรือรายละเอียด')} aria-label={tx('ค้นหา')} value={q} onChange={event => setQ(event.target.value)} />
            <select className="ui-input" aria-label={tx('โมดูล')} value={module} onChange={event => setModule(event.target.value as Module | '')}>
              <option value="">{tx('ทุกโมดูล')}</option>
              {MODULE_KEYS.map(m => <option key={m} value={m}>{`${m} · ${tx(MODULES[m].name)}`}</option>)}
            </select>
            <select className="ui-input" aria-label={tx('สถานะ')} value={status} onChange={event => setStatus(event.target.value as WorkItem['status'] | '')}>
              <option value="">{tx('ทุกสถานะ')}</option>
              {STATUS_KEYS.map(s => <option key={s} value={s}>{tx(STATUS[s].label)}</option>)}
            </select>
            <span className="secondary grow">{tx('{n} รายการ', { n: rows.length })}</span>
          </div>
          <div className="table-wrap">
            <table className="bo-table worklist">
              <thead>
                <tr>
                  <th scope="col" className="w-priority">{tx('ความเร่งด่วน')}</th>
                  <th scope="col" className="w-module">{tx('โมดูล')}</th>
                  <th scope="col">{tx('งาน')}</th>
                  <th scope="col" className="w-due">{tx('กำหนด')}</th>
                  <th scope="col" className="w-owner">{tx('ผู้รับผิดชอบ')}</th>
                  <th scope="col" className="w-status">{tx('สถานะ')}</th>
                </tr>
              </thead>
              <tbody>
                {pager.rows.map(item => (
                  <tr key={item.id} className={cx(item.id === selectedId && 'selected')} onClick={() => pick(item)} tabIndex={0} onKeyDown={event => { if (event.key === 'Enter') { pick(item); } }} aria-selected={item.id === selectedId}>
                    <td><span className={`chip ${PRIORITY[item.priority].cls}`}>{tx(PRIORITY[item.priority].label)}</span></td>
                    <td><ModuleTag code={item.module} /></td>
                    <td><b>{tx(item.title)}</b><div className="secondary">{`${tx(item.kind)} · ${item.ref}`}</div></td>
                    <td className={cx('num', daysUntil(item.due) < 0 && 'text-danger')}>{due(item)}</td>
                    <td>{tx(item.owner)}</td>
                    <td><span className={`chip ${STATUS[item.status].cls}`}>{tx(STATUS[item.status].label)}</span></td>
                  </tr>
                ))}
                {!rows.length && <tr className="static"><td colSpan={6} className="empty">{tx('ไม่มีงานที่ตรงกับตัวกรอง')}</td></tr>}
              </tbody>
            </table>
          </div>
          <PagerFoot pager={pager} />
        </div>

        {selected && (
          <Drawer heading={selected.title} sub={`${selected.kind} · ${selected.ref}`} onClosed={() => setSelectedId(null)} foot={
            selected.link
              ? <UiLinkButton size="sm" to={selected.link}>{tx('เปิดรายการต้นทาง')}<NgIcon svg={lucideArrowUpRight} aria-hidden="true" /></UiLinkButton>
              : <span className="secondary">{tx('หน้าของโมดูลนี้ยังไม่เปิดใช้ใน BackOffice')}</span>
          }>
            <dl className="data-grid">
              <dt>{tx('โมดูล')}</dt><dd><ModuleTag code={selected.module} /></dd>
              <dt>{tx('ความเร่งด่วน')}</dt><dd><span className={`chip ${PRIORITY[selected.priority].cls}`}>{tx(PRIORITY[selected.priority].label)}</span></dd>
              <dt>{tx('กำหนด')}</dt><dd>{`${selected.due} · ${due(selected)}`}</dd>
              <dt>{tx('ผู้รับผิดชอบ')}</dt><dd>{tx(selected.owner)}</dd>
              <dt>{tx('สถานะ')}</dt><dd>{tx(STATUS[selected.status].label)}</dd>
              <dt>{tx('รายละเอียด')}</dt><dd>{tx(selected.detail)}</dd>
            </dl>
            <p className="secondary">{tx('หน้านี้รวมงานจากหลายโมดูล — การแก้ไขทำที่รายการต้นทางในโมดูลเจ้าของเท่านั้น')}</p>
          </Drawer>
        )}
      </div>
    </bo-overview>
  );
}
