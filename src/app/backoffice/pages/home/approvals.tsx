/* The approval queue: requests a canonical rule needs a decision on, each decided by its owning module's rule (ux/menus/01-home.md) */
import { useState } from 'react';

import { lucideCircleCheck, lucideCircleX } from '../../../icons';
import { cx, NgIcon, UiButton } from '../../../user-management/ui';
import { backofficeActions } from '../../backoffice-actions';
import { useBackofficeStore } from '../../backoffice.store';
import { ageDays, APPROVAL_KIND, APPROVAL_STATUS, approvalAging, canDecide } from '../../data/home';
import type { Approval } from '../../data/types';
import { useBoI18n } from '../../i18n/bo-i18n';
import { Drawer, ModuleTag, PageHead } from '../../shared/parts';
import { PagerFoot } from '../../shared/pager';
import { usePager } from '../../shared/use-pager';

const STATUS_KEYS = Object.keys(APPROVAL_STATUS) as Approval['status'][];
const baht = (n: number) => `฿${n.toLocaleString('en-US')}`;

export function ApprovalsComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const [status, setStatus] = useState<Approval['status'] | ''>('pending');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const approvals = store.data.approvals;
  const aging = approvalAging(approvals);
  const decidedToday = approvals.filter(a => a.decidedAt?.startsWith('2026-09-24')).length;
  const rows = approvals.filter(a => !status || a.status === status);
  const selected = approvals.find(a => a.id === selectedId) ?? null;
  const pick = (a: Approval) => setSelectedId(selectedId === a.id ? null : a.id);
  const mayDecide = selected ? canDecide(selected, store.userName) : false;

  /** The table's pages */
  const pager = usePager(rows);
  return (
    <bo-approvals className="page">
      <PageHead heading="รายการอนุมัติ" source="คืนเงิน ส่วนลด ส่งออกบันทึกตรวจสอบ ข้อร้องเรียนรุนแรง สิทธิ์ชั่วคราว · ตัดสินได้เฉพาะตามกฎของโมดูลเจ้าของ" freshness="ข้อมูล ณ วันนี้ 11:32" />

      <div className="kpi-strip" role="list">
        <div className="kpi" role="listitem"><span className="kpi-value">{aging.pending}</span><span className="kpi-label">{tx('รออนุมัติ')}</span></div>
        <div className={cx('kpi', aging.overDay > 0 && 'warn')} role="listitem"><span className="kpi-value">{aging.overDay}</span><span className="kpi-label">{tx('รอเกิน 1 วัน')}</span></div>
        <div className="kpi" role="listitem"><span className="kpi-value">{aging.oldest}</span><span className="kpi-label">{tx('รอนานสุด (วัน)')}</span></div>
        <div className="kpi" role="listitem"><span className="kpi-value">{decidedToday}</span><span className="kpi-label">{tx('ตัดสินวันนี้')}</span></div>
      </div>

      <div className={cx('split', selected && 'with-drawer')}>
        <div className="panel">
          <div className="filter-bar">
            <div className="segmented" role="group" aria-label={tx('สถานะ')}>
              {STATUS_KEYS.map(s => (
                <button key={s} type="button" className={cx(status === s && 'active')} aria-pressed={status === s} onClick={() => setStatus(s)}>{tx(APPROVAL_STATUS[s].label)}</button>
              ))}
              <button type="button" className={cx(status === '' && 'active')} aria-pressed={status === ''} onClick={() => setStatus('')}>{tx('ทั้งหมด')}</button>
            </div>
            <span className="secondary grow">{tx('{n} รายการ', { n: rows.length })}</span>
          </div>
          <div className="table-wrap">
            <table className="bo-table approvals">
              <thead>
                <tr>
                  <th scope="col" className="w-ref">{tx('เลขที่')}</th>
                  <th scope="col" className="w-kind">{tx('ประเภท')}</th>
                  <th scope="col">{tx('คำขอ')}</th>
                  <th scope="col" className="w-amount num">{tx('จำนวนเงิน')}</th>
                  <th scope="col" className="w-owner">{tx('ขอโดย')}</th>
                  <th scope="col" className="w-due">{tx('รอมาแล้ว')}</th>
                  <th scope="col" className="w-status">{tx('สถานะ')}</th>
                </tr>
              </thead>
              <tbody>
                {pager.rows.map(a => (
                  <tr key={a.id} className={cx(a.id === selectedId && 'selected')} onClick={() => pick(a)} tabIndex={0} onKeyDown={event => { if (event.key === 'Enter') { pick(a); } }} aria-selected={a.id === selectedId}>
                    <td><b>{a.ref}</b><div className="secondary"><ModuleTag code={a.module} /></div></td>
                    <td>{tx(APPROVAL_KIND[a.kind])}</td>
                    <td><b>{tx(a.title)}</b><div className="secondary">{tx(a.detail)}</div></td>
                    <td className="num">{a.amount ? baht(a.amount) : '—'}</td>
                    <td>{tx(a.requestedBy)}<div className="secondary">{a.requestedAt}</div></td>
                    <td className={cx('num', a.status === 'pending' && ageDays(a.requestedAt) >= 1 && 'text-danger')}>{tx('{n} วัน', { n: ageDays(a.requestedAt) })}</td>
                    <td><span className={`chip ${APPROVAL_STATUS[a.status].cls}`}>{tx(APPROVAL_STATUS[a.status].label)}</span></td>
                  </tr>
                ))}
                {!rows.length && <tr className="static"><td colSpan={7} className="empty">{tx('ไม่มีคำขอในสถานะนี้')}</td></tr>}
              </tbody>
            </table>
          </div>
          <PagerFoot pager={pager} />
        </div>

        {selected && (
          <Drawer heading={selected.title} sub={`${APPROVAL_KIND[selected.kind]} · ${selected.ref}`} onClosed={() => setSelectedId(null)} foot={
            selected.status === 'pending' && (
              <>
                <UiButton variant="danger" size="sm" type="button" disabled={!mayDecide} onClick={() => backofficeActions.decide(selected, 'rejected')}>
                  <NgIcon svg={lucideCircleX} aria-hidden="true" />{tx('ปฏิเสธ')}
                </UiButton>
                <span className="grow"></span>
                <UiButton size="sm" type="button" disabled={!mayDecide} onClick={() => backofficeActions.decide(selected, 'approved')}>
                  <NgIcon svg={lucideCircleCheck} aria-hidden="true" />{tx('อนุมัติ')}
                </UiButton>
              </>
            )
          }>
            <dl className="data-grid">
              <dt>{tx('โมดูล')}</dt><dd><ModuleTag code={selected.module} /></dd>
              <dt>{tx('ขอโดย')}</dt><dd>{`${tx(selected.requestedBy)} · ${selected.requestedAt}`}</dd>
              <dt>{tx('ผู้มีสิทธิ์ตัดสิน')}</dt><dd>{tx(selected.approver)}</dd>
              {!!selected.amount && <><dt>{tx('จำนวนเงิน')}</dt><dd className="num-left">{baht(selected.amount)}</dd></>}
              <dt>{tx('เหตุผลที่ขอ')}</dt><dd>{tx(selected.reason)}</dd>
            </dl>
            <h3>{tx('หลักฐานประกอบ')}</h3>
            <dl className="data-grid">
              {selected.evidence.map((e, index) => [<dt key={`t${index}`}>{tx(e[0])}</dt>, <dd key={`d${index}`}>{tx(e[1])}</dd>])}
            </dl>
            {selected.status !== 'pending' ? (
              <div className={`decision ${APPROVAL_STATUS[selected.status].cls}`}>
                <b>{tx(APPROVAL_STATUS[selected.status].label)}</b>{` · ${tx(selected.decidedBy ?? '')} · ${selected.decidedAt}`}
                <p>{tx(selected.decision ?? '')}</p>
              </div>
            ) : !mayDecide && (
              <p className="secondary">{tx('คุณเป็นผู้ขอรายการนี้ จึงตัดสินเองไม่ได้ (การแยกหน้าที่)')}</p>
            )}
          </Drawer>
        )}
      </div>
    </bo-approvals>
  );
}
