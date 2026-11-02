/* Import and export history: the jobs across modules, their result and file, read only; a job is re-run where it is owned, and generic import waits for its contract (INT-IEX-01) */
import { useState } from 'react';
import { Link } from 'react-router';

import { cx } from '../../../user-management/ui';
import { useBackofficeStore } from '../../backoffice.store';
import { JOB_STATUS, type JobStatus, jobs } from '../../data/integrations';
import { useBoI18n } from '../../i18n/bo-i18n';
import { Drawer, ModuleTag, PageHead } from '../../shared/parts';

const STATUS_KEYS = Object.keys(JOB_STATUS) as JobStatus[];

export function ImportExportComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const [kind, setKind] = useState('');
  const [module, setModule] = useState('');
  const [status, setStatus] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const all = jobs(store.data);
  const rows = all.filter(j => (!kind || j.kind === kind) && (!module || j.module === module) && (!status || j.status === status));
  const selected = all.find(j => j.id === selectedId);
  const pick = (id: string) => setSelectedId(selectedId === id ? null : id);
  const chip = (s: JobStatus) => <span className={`chip ${JOB_STATUS[s].cls}`}>{tx(JOB_STATUS[s].label)}</span>;

  return (
    <bo-import-export className="page">
      <PageHead heading="ประวัติการนำเข้าและส่งออก" source="INT-IEX-01 · M11 accounting_export_log · M31 RoPA · ประวัติอ่านอย่างเดียว ไม่ใช่คิวที่สอง · ส่งออกสำเร็จไม่ได้แปลว่าปลายทางยอมรับ" freshness="ข้อมูล ณ วันนี้ 11:32" />

      <div className={cx('split', selected && 'with-drawer')}>
        <div className="panel">
          <div className="filter-bar">
            <select className="ui-input" aria-label={tx('ประเภท')} value={kind} onChange={event => setKind(event.target.value)}>
              <option value="">{tx('ทุกประเภท')}</option>
              <option value="export">{tx('ส่งออก')}</option>
              <option value="import">{tx('นำเข้า')}</option>
            </select>
            <select className="ui-input" aria-label={tx('โมดูล')} value={module} onChange={event => setModule(event.target.value)}>
              <option value="">{tx('ทุกโมดูล')}</option>
              <option value="M11">M11</option>
              <option value="M31">M31</option>
            </select>
            <select className="ui-input" aria-label={tx('สถานะ')} value={status} onChange={event => setStatus(event.target.value)}>
              <option value="">{tx('ทุกสถานะ')}</option>
              {STATUS_KEYS.map(s => <option key={s} value={s}>{tx(JOB_STATUS[s].label)}</option>)}
            </select>
            <span className="secondary grow">{tx('{n} รายการ', { n: rows.length })}</span>
          </div>
          <div className="table-wrap">
            <table className="bo-table jobs">
              <thead><tr>
                <th scope="col" className="w-at">{tx('เวลา')}</th>
                <th scope="col">{tx('งาน')}</th>
                <th scope="col" className="w-module">{tx('โมดูล')}</th>
                <th scope="col" className="w-status">{tx('สถานะ')}</th>
                <th scope="col" className="num w-kind">{tx('ผลลัพธ์')}</th>
                <th scope="col" className="w-ref">{tx('ไฟล์ผลลัพธ์')}</th>
              </tr></thead>
              <tbody>
                {rows.map(j => (
                  <tr key={j.id} className={cx(j.id === selectedId && 'selected')} tabIndex={0} onClick={() => pick(j.id)} onKeyDown={event => { if (event.key === 'Enter') { pick(j.id); } }} aria-selected={j.id === selectedId}>
                    <td className="num">{j.at}</td>
                    <td><b>{tx(j.title)}</b><div className="secondary">{`${tx(j.kind === 'export' ? 'ส่งออก' : 'นำเข้า')} · ${j.id}`}</div></td>
                    <td><ModuleTag code={j.module} /></td>
                    <td>{chip(j.status)}</td>
                    <td className="num">{j.result}</td>
                    <td>{j.artifact ?? '—'}</td>
                  </tr>
                ))}
                {!rows.length && <tr className="static"><td colSpan={6} className="empty">{tx('ไม่มีรายการที่ตรงกับตัวกรอง')}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {selected && (
          <Drawer heading={selected.title} sub={selected.id} onClosed={() => setSelectedId(null)} foot={<Link className="link" to={selected.link}>{tx('เปิดหน้า {page}', { page: tx(selected.owner) })}</Link>}>
            <dl className="data-grid">
              <dt>{tx('สถานะ')}</dt><dd>{chip(selected.status)} {`· ${selected.result}`}</dd>
              <dt>{tx('เวลา')}</dt><dd>{`${selected.at} · ${tx(selected.by)}`}</dd>
              <dt>{tx('ขอบเขต')}</dt><dd>{tx(selected.scope)}</dd>
              <dt>{tx('ไฟล์ผลลัพธ์')}</dt><dd>{selected.artifact ?? tx('ส่งผ่าน API ไม่มีไฟล์')}</dd>
            </dl>
            {selected.errors.length > 0 && <>
              <h3>{tx('ข้อผิดพลาด')}</h3>
              <ul className="plain">{selected.errors.map(e => <li key={e} className="text-danger">{e}</li>)}</ul>
            </>}
            <p className="secondary">{tx('การส่งใหม่ทำที่หน้าเจ้าของงาน')}</p>
          </Drawer>
        )}
      </div>

      <div className="panel">
        <div className="filter-bar"><b>{tx('การนำเข้า')}</b><span className="chip quiet">GATED</span></div>
        <p className="notice warn">{tx('การนำเข้าทั่วไปยังไม่เปิดใช้งาน: รอสัญญา job log และการรับไฟล์')}</p>
      </div>
    </bo-import-export>
  );
}
