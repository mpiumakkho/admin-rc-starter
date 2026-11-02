/* LINE CRM: the service messages that wait (reminders, bill links), sent only with the owner's consent, and the log of what went (sales.lineCrm, M15 P1 subset) */
import { useState } from 'react';

import { cx, UiButton } from '../../../user-management/ui';
import { backofficeActions } from '../../backoffice-actions';
import { useBackofficeStore } from '../../backoffice.store';
import { lineSummary, MESSAGE_KIND, MESSAGE_STATUS, outbox, owners } from '../../data/sales';
import type { MessageKind } from '../../data/types';
import { useBoI18n } from '../../i18n/bo-i18n';
import { PageHead } from '../../shared/parts';
import { PagerFoot } from '../../shared/pager';
import { usePager } from '../../shared/use-pager';

const KINDS = Object.keys(MESSAGE_KIND) as MessageKind[];

export function LineCrmComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const [kind, setKind] = useState<MessageKind | ''>('');
  const s = lineSummary(store.clinic.data, store.data);
  const box = outbox(store.clinic.data, store.data);
  const rows = box.filter(i => !kind || i.kind === kind);
  const readyCount = box.filter(i => !i.block).length;
  const log = store.data.messages.slice().sort((a, b) => b.at.localeCompare(a.at));
  const ownerRows = owners(store.clinic.data, store.data);
  const flag = (on: boolean, label: string) => <span className={cx('chip', on ? 'ok' : 'quiet')}>{`${tx(label)} ${on ? '✓' : '✕'}`}</span>;

  /** The table's pages */
  const pager = usePager(rows);
  return (
    <bo-line-crm className="page">
      <PageHead heading="LINE CRM" source="M15 · ข้อความบริการผ่าน LINE OA · ส่งได้เฉพาะเจ้าของที่เชื่อม LINE และให้ความยินยอมตามวัตถุประสงค์ (M31) · แคมเปญและแต้มสะสมเป็น P2" freshness="ข้อมูล ณ วันนี้ 11:32">
        <UiButton size="sm" type="button" disabled={!readyCount} onClick={() => backofficeActions.sendAll(box)}>{tx('ส่งที่ส่งได้ทั้งหมด ({n})', { n: readyCount })}</UiButton>
      </PageHead>

      <div className="kpi-strip" role="list">
        <div className="kpi" role="listitem"><span className="kpi-value">{`${s.linked}/${s.owners}`}</span><span className="kpi-label">{tx('เจ้าของที่เชื่อม LINE')}</span></div>
        <div className="kpi" role="listitem"><span className="kpi-value">{s.reminder}</span><span className="kpi-label">{tx('ยินยอมรับการแจ้งเตือน')}</span></div>
        <div className={cx('kpi', readyCount > 0 && 'info')} role="listitem"><span className="kpi-value">{readyCount}</span><span className="kpi-label">{tx('รอส่ง · ติดความยินยอม {n}', { n: box.length - readyCount })}</span></div>
        <div className="kpi" role="listitem"><span className="kpi-value">{s.today}</span><span className="kpi-label">{tx('ส่งวันนี้ · อ่านแล้ว {n}%', { n: s.readRate })}</span></div>
        <div className={cx('kpi', s.failed > 0 && 'danger')} role="listitem"><span className="kpi-value">{s.failed}</span><span className="kpi-label">{tx('ส่งไม่สำเร็จ')}</span></div>
      </div>

      <div className="record">
        <div className="record-main">
          <div className="panel">
            <div className="filter-bar">
              <b>{tx('รอส่ง')}</b>
              <select className="ui-input" aria-label={tx('ประเภทข้อความ')} value={kind} onChange={event => setKind(event.target.value as MessageKind | '')}>
                <option value="">{tx('ทุกประเภท')}</option>
                {KINDS.map(k => <option key={k} value={k}>{tx(MESSAGE_KIND[k].label)}</option>)}
              </select>
              <span className="secondary grow">{tx('นัดพรุ่งนี้ · วัคซีนครบกำหนดใน 30 วัน · ใบแจ้งหนี้ค้างชำระ')}</span>
            </div>
            <div className="table-wrap">
              <table className="bo-table outbox">
                <thead>
                  <tr>
                    <th scope="col" className="w-kind">{tx('ประเภท')}</th>
                    <th scope="col" className="w-owner">{tx('เจ้าของ / สัตว์')}</th>
                    <th scope="col">{tx('ข้อความ')}</th>
                    <th scope="col" className="w-due">{tx('สำหรับ')}</th>
                    <th scope="col" className="w-send"><span className="visually-hidden">{tx('การทำงาน')}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {pager.rows.map(i => (
                    <tr key={i.key} className={cx('static', i.block && 'blocked')}>
                      <td><span className={`chip ${MESSAGE_KIND[i.kind].cls}`}>{tx(MESSAGE_KIND[i.kind].label)}</span></td>
                      <td><b>{i.ownerKey}</b><div className="secondary">{i.pet}</div></td>
                      <td>{tx(i.text)}{i.retry && <div className="secondary text-danger">{`${tx('ครั้งก่อนส่งไม่สำเร็จ')} · ${i.retry.at}`}</div>}</td>
                      <td className="num">{i.due}</td>
                      <td>
                        {i.block ? <span className="chip quiet">{tx(i.block)}</span>
                          : <UiButton size="sm" variant="secondary" type="button" onClick={() => backofficeActions.sendMessage(i)}>{tx(i.retry ? 'ส่งใหม่' : 'ส่ง')}</UiButton>}
                      </td>
                    </tr>
                  ))}
                  {!rows.length && <tr className="static"><td colSpan={5} className="empty">{tx('ไม่มีข้อความรอส่ง')}</td></tr>}
                </tbody>
              </table>
            </div>
            <PagerFoot pager={pager} />
          </div>

          <div className="panel">
            <div className="filter-bar"><b>{tx('ข้อความที่ส่งแล้ว')}</b><span className="secondary grow">{tx('service_message_log · ล่าสุดก่อน')}</span></div>
            <div className="table-wrap">
              <table className="bo-table">
                <thead>
                  <tr>
                    <th scope="col" className="w-at">{tx('เวลา')}</th>
                    <th scope="col" className="w-kind">{tx('ประเภท')}</th>
                    <th scope="col" className="w-owner">{tx('เจ้าของ')}</th>
                    <th scope="col">{tx('ข้อความ')}</th>
                    <th scope="col" className="w-owner">{tx('โดย')}</th>
                    <th scope="col" className="w-status">{tx('สถานะ')}</th>
                  </tr>
                </thead>
                <tbody>
                  {log.map(m => (
                    <tr key={m.id} className="static">
                      <td className="num">{m.at}</td>
                      <td><span className={`chip ${MESSAGE_KIND[m.kind].cls}`}>{tx(MESSAGE_KIND[m.kind].label)}</span></td>
                      <td>{m.ownerKey}<div className="secondary">{m.id}</div></td>
                      <td>{tx(m.text)}{m.error && <div className="secondary text-danger">{tx(m.error)}</div>}</td>
                      <td>{tx(m.by)}</td>
                      <td><span className={`chip ${MESSAGE_STATUS[m.status].cls}`}>{tx(MESSAGE_STATUS[m.status].label)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Who is on LINE and what they agreed to: kept by M31, shown here, changed there */}
        <aside className="record-rail">
          <div className="panel actions">
            <b>{tx('ความยินยอมของเจ้าของ')}</b>
            <ul className="consents">
              {ownerRows.map(o => (
                <li key={o.owner.name}>
                  <b>{o.owner.name}</b>
                  {o.link ? (
                    <>
                      <span className="secondary">{`LINE ${o.link.displayName} · ${o.link.consent.version}`}</span>
                      <span className="flags">{flag(o.link.consent.service, 'บริการ')}{flag(o.link.consent.reminder, 'แจ้งเตือน')}{flag(o.link.consent.marketing, 'การตลาด')}</span>
                      {o.link.withdrawn && <span className="secondary text-danger">{tx('ถอนความยินยอมการแจ้งเตือนเมื่อ {at}', { at: o.link.withdrawn.at })}</span>}
                    </>
                  ) : <span className="secondary">{tx('ไม่ได้เชื่อม LINE · ช่องทางที่เลือก: {prefer}', { prefer: tx(o.owner.prefer) })}</span>}
                </li>
              ))}
            </ul>
            <p className="secondary">{tx('ความยินยอมบันทึกและถอนที่ M31 (PDPA) · การถอนหยุดข้อความของวัตถุประสงค์นั้นทันที')}</p>
          </div>
        </aside>
      </div>
    </bo-line-crm>
  );
}
