/* Recent activity: what was done, in order, to pick work up again; read only (ux/menus/01-home.md) */
import { useState } from 'react';

import { cx } from '../../../user-management/ui';
import { useBackofficeStore } from '../../backoffice.store';
import { MODULES, type ActivityEntry, type Module } from '../../data/types';
import { useBoI18n } from '../../i18n/bo-i18n';
import { Drawer, ModuleTag, PageHead } from '../../shared/parts';

const MODULE_KEYS = Object.keys(MODULES) as Module[];

export function ActivityComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const [mine, setMine] = useState(false);
  const [module, setModule] = useState<Module | ''>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const me = store.userName;
  const rows = store.data.activity.filter(e => (!mine || e.by === me) && (!module || e.module === module)
    && (!from || e.at >= from) && (!to || e.at.slice(0, 10) <= to));
  const selected = store.data.activity.find(e => e.id === selectedId) ?? null;
  const pick = (e: ActivityEntry) => setSelectedId(selectedId === e.id ? null : e.id);

  return (
    <bo-activity className="page">
      <PageHead heading="กิจกรรมล่าสุด" source="จากบันทึกตรวจสอบของ BackOffice ตามสิทธิ์ · อ่านอย่างเดียว ไม่ส่งออก" freshness="ข้อมูล ณ วันนี้ 11:32" />

      <div className={cx('split', selected && 'with-drawer')}>
        <div className="panel">
          <div className="filter-bar">
            <label className="check"><input type="checkbox" checked={mine} onChange={event => setMine(event.target.checked)} />{tx('เฉพาะของฉัน')}</label>
            <select className="ui-input" aria-label={tx('โมดูล')} value={module} onChange={event => setModule(event.target.value as Module | '')}>
              <option value="">{tx('ทุกโมดูล')}</option>
              {MODULE_KEYS.map(m => <option key={m} value={m}>{`${m} · ${tx(MODULES[m].name)}`}</option>)}
            </select>
            <label className="date-field"><span className="visually-hidden">{tx('ตั้งแต่')}</span><input className="ui-input" type="date" value={from} onChange={event => setFrom(event.target.value)} /></label>
            <span className="secondary">–</span>
            <label className="date-field"><span className="visually-hidden">{tx('ถึง')}</span><input className="ui-input" type="date" value={to} onChange={event => setTo(event.target.value)} /></label>
            <span className="secondary grow">{tx('{n} รายการ', { n: rows.length })}</span>
          </div>
          <div className="table-wrap">
            <table className="bo-table activity">
              <thead>
                <tr>
                  <th scope="col" className="w-at">{tx('เมื่อ')}</th>
                  <th scope="col" className="w-owner">{tx('โดย')}</th>
                  <th scope="col" className="w-module">{tx('โมดูล')}</th>
                  <th scope="col">{tx('การกระทำ')}</th>
                  <th scope="col" className="w-ref">{tx('รายการ')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(e => (
                  <tr key={e.id} className={cx(e.id === selectedId && 'selected')} onClick={() => pick(e)} tabIndex={0} onKeyDown={event => { if (event.key === 'Enter') { pick(e); } }} aria-selected={e.id === selectedId}>
                    <td className="num">{e.at}</td>
                    <td>{tx(e.by)}</td>
                    <td><ModuleTag code={e.module} /></td>
                    <td><b>{tx(e.action)}</b>{e.detail && <div className="secondary">{tx(e.detail)}</div>}</td>
                    <td>{e.target}<div className="secondary">{tx(e.ref)}</div></td>
                  </tr>
                ))}
                {!rows.length && <tr className="static"><td colSpan={5} className="empty">{tx('ไม่มีกิจกรรมในช่วงที่เลือก')}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {selected && (
          <Drawer heading={selected.action} sub={`${selected.at} · ${selected.by}`} onClosed={() => setSelectedId(null)}>
            <dl className="data-grid">
              <dt>{tx('โมดูล')}</dt><dd><ModuleTag code={selected.module} /></dd>
              <dt>{tx('รายการ')}</dt><dd>{selected.target}</dd>
              <dt>{tx('อ้างอิง')}</dt><dd>{tx(selected.ref)}</dd>
              {selected.detail && <><dt>{tx('รายละเอียด')}</dt><dd>{tx(selected.detail)}</dd></>}
              {(selected.before || selected.after) && (
                <>
                  <dt>{tx('ก่อน')}</dt><dd>{tx(selected.before ?? '—')}</dd>
                  <dt>{tx('หลัง')}</dt><dd>{tx(selected.after ?? '—')}</dd>
                </>
              )}
            </dl>
            <p className="secondary">{tx('บันทึกนี้แก้ไขไม่ได้ · การส่งออกบันทึกตรวจสอบต้องขออนุมัติในรายการอนุมัติ')}</p>
          </Drawer>
        )}
      </div>
    </bo-activity>
  );
}
