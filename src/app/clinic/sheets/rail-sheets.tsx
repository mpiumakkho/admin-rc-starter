/* The sheets the context rail leads to beyond the patient's record: one past visit, one document, and the owner's bills */
import { useEffect } from 'react';

import { lucideChevronRight, lucideDownload, lucideFileText } from '../../icons';
import { cx, NgIcon, UiButton } from '../../user-management/ui';
import { clinicActions } from '../clinic-actions';
import { clinicUi } from '../clinic-ui';
import { useClinicStore } from '../clinic.store';
import { TODAY, timeOf } from '../data/model';
import { balanceOf, baht, docDate, invoiceState, openInvoices, outstanding, pastVisits, runningBill, visitRecords } from '../data/rail';
import type { LabResult, Patient } from '../data/types';
import { useClinicI18n } from '../i18n/clinic-i18n';
import { SheetHead } from './sheet-head';

/** The patient and the date or index in a sheet's id, "<patient id>/<key>" */
const splitId = (id: string) => {
  const at = id.indexOf('/');
  return { pid: Number(id.slice(0, at)), key: id.slice(at + 1) };
};

/** When another patient is picked while a sheet of one record of theirs is open, the sheet goes back to the list */
function useFollowPatient(p: Patient, pid: number, tab: 'visits' | 'docs') {
  useEffect(() => {
    if (pid !== p.id) {
      clinicUi.openSheet('patient', { tab });
    }
  }, [p.id, pid, tab]);
}

/** A row that opens something: a name, a line under it, and a chevron */
export function OpenRow({ name, detail, onOpen, children }: { name: string; detail: string; onOpen: () => void; children?: React.ReactNode }) {
  return (
    <button type="button" className="row-card go" onClick={onOpen}>
      <span className="grow"><b>{name}</b><span className="secondary">{detail}</span></span>
      {children}
      <NgIcon className="go-icon" svg={lucideChevronRight} aria-hidden="true" />
    </button>
  );
}

/** A result's date or time, and whether it still needs a look */
export function ResultRow({ r }: { r: LabResult }) {
  const { tx } = useClinicI18n();
  const abnormal = r.flag === 'critical' || r.values.some(v => v[3] !== 0);
  const chip = r.flag === 'critical' && !r.ack ? <span className="chip danger">{tx('Critical')}</span>
    : abnormal && !r.ack ? <span className="chip warn">{tx('ผิดปกติ')}</span>
    : r.ack ? <span className="chip quiet">{tx('รับทราบแล้ว')}</span> : null;
  return (
    <OpenRow name={tx(r.name)} detail={`${tx(r.status)} · ${r.time.startsWith(TODAY) ? timeOf(r.time) : r.time} · ${tx(r.by)}`}
      onOpen={() => clinicUi.openSheet('result', { id: r.id })}>
      {chip}
    </OpenRow>
  );
}

/* ---- One past visit: what it was, its results, documents and bill ---- */
export function PastVisitSheet({ id }: { id: string }) {
  const store = useClinicStore();
  const { tx } = useClinicI18n();
  const p = store.selected;
  const { pid, key: date } = splitId(id);
  useFollowPatient(p, pid, 'visits');
  const visit = pastVisits(p).find(v => v.date === date);
  const records = visitRecords(store.data, p, date);

  return (
    <cl-past-visit-sheet className="contents">
      <SheetHead heading={`${tx('การมารักษา')} · ${date}`} sub={visit ? `${tx(visit.title)} · ${tx(visit.vet)} · ${p.pet}` : p.pet} />
      <div className="sheet-body">
        <div className="section">
          <div className="section-title"><h3>{tx('สรุปการมารักษา')}</h3></div>
          <dl className="data-grid">
            <dt>{tx('วันที่')}</dt><dd>{date}</dd>
            <dt>{tx('เรื่อง')}</dt><dd>{tx(visit?.title ?? '—')}</dd>
            <dt>{tx('สัตวแพทย์')}</dt><dd>{tx(visit?.vet || '—')}</dd>
            <dt>{tx('สถานะ')}</dt><dd><span className="chip quiet">{tx(records.status)}</span></dd>
            <dt>{tx('ใบแจ้งหนี้')}</dt>
            <dd>
              {records.invoice ? (
                <>
                  {`${records.invoice.no} · ${baht(records.invoice.total)} `}
                  <span className={cx('chip', balanceOf(records.invoice) ? 'warn' : 'ok')}>{tx(invoiceState(records.invoice))}</span>
                </>
              ) : tx('ไม่มีในข้อมูลตัวอย่าง')}
            </dd>
          </dl>
        </div>
        <div className="section">
          <div className="section-title"><h3>{tx('ผลตรวจ')}</h3></div>
          <div className="kv-list">
            {records.results.map(r => <ResultRow key={r.id} r={r} />)}
            {!records.results.length && <p className="muted">{tx('ไม่มีผลตรวจใน visit นี้')}</p>}
          </div>
        </div>
        <div className="section">
          <div className="section-title"><h3>{tx('Documents')}</h3></div>
          <div className="kv-list">
            {records.docs.map(({ doc, index }) => (
              <OpenRow key={index} name={tx(doc[0])} detail={tx(doc[1])} onOpen={() => clinicUi.openSheet('document', { id: `${p.id}/${index}` })} />
            ))}
            {!records.docs.length && <p className="muted">{tx('ไม่มีเอกสารใน visit นี้')}</p>}
          </div>
        </div>
        <p className="muted">{tx('บันทึกการรักษาฉบับเต็มของ visit ย้อนหลังไม่อยู่ในข้อมูลตัวอย่าง')}</p>
      </div>
      <div className="sheet-foot">
        <UiButton variant="secondary" size="sm" type="button" onClick={() => clinicUi.openSheet('patient', { tab: 'visits' })}>{tx('กลับไปประวัติการรักษา')}</UiButton>
        <span className="grow"></span>
        {records.invoice && balanceOf(records.invoice) > 0 && (
          <UiButton size="sm" type="button" onClick={() => clinicUi.openSheet('billing')}>{tx('ดูยอดค้างชำระ')}</UiButton>
        )}
      </div>
    </cl-past-visit-sheet>
  );
}

/** Saves a text file, as a download from the browser */
function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/* ---- One document: the sample has no files, so its details and a page that says so ---- */
export function DocumentSheet({ id }: { id: string }) {
  const store = useClinicStore();
  const { tx } = useClinicI18n();
  const p = store.selected;
  const o = store.owner(p);
  const { pid, key } = splitId(id);
  useFollowPatient(p, pid, 'docs');
  const doc = p.docs[Number(key)];
  const date = doc ? docDate(doc[0]) : '';
  const visit = pastVisits(p).find(v => v.date === date);

  const save = () => {
    if (!doc) {
      return;
    }
    const lines = [doc[0], `${tx('ชนิดไฟล์')}: ${tx(doc[1])}`, `${tx('วันที่')}: ${date || '—'}`, `${tx('ผู้ป่วย')}: ${p.pet} · ${p.hn} · ${p.code}`,
      `${tx('เจ้าของ')}: ${o.name}`, visit ? `${tx('การมารักษา')}: ${visit.date} · ${tx(visit.title)} · ${tx(visit.vet)}` : '', '', tx('ข้อมูลตัวอย่างไม่มีไฟล์จริง — ไฟล์นี้คือรายละเอียดของเอกสาร')];
    download(`${p.hn} ${doc[0]}.txt`.replace(/[\\/:*?"<>|]/g, '-'), lines.join('\n'));
    clinicUi.toast('ดาวน์โหลดรายละเอียดเอกสารแล้ว');
  };

  return (
    <cl-document-sheet className="contents">
      <SheetHead heading={doc ? doc[0] : 'Documents'} sub={doc ? `${tx(doc[1])} · ${p.pet} · ${p.hn}` : p.pet} />
      <div className="sheet-body">
        {doc ? (
          <>
            <div className="section">
              <div className="doc-preview" role="img" aria-label={tx('ตัวอย่างเอกสาร') + ' · ' + tx(doc[0])}>
                <NgIcon svg={lucideFileText} aria-hidden="true" />
                <b>{tx(doc[0])}</b>
                <span className="secondary">{`${p.pet} · ${p.hn} · ${o.name}`}</span>
                <span className="muted">{tx('ข้อมูลตัวอย่างไม่มีไฟล์จริง — แสดงรายละเอียดของเอกสารแทน')}</span>
              </div>
            </div>
            <div className="section">
              <div className="section-title"><h3>{tx('รายละเอียด')}</h3></div>
              <dl className="data-grid">
                <dt>{tx('ชนิดไฟล์')}</dt><dd>{tx(doc[1])}</dd>
                <dt>{tx('วันที่')}</dt><dd>{date || '—'}</dd>
                <dt>{tx('การมารักษา')}</dt>
                <dd>
                  {visit
                    ? <button type="button" className="link" onClick={() => clinicUi.openSheet('pastVisit', { id: `${p.id}/${visit.date}` })}>{`${visit.date} · ${tx(visit.title)}`}</button>
                    : '—'}
                </dd>
                <dt>{tx('ผู้ป่วย')}</dt><dd>{`${p.pet} · ${p.hn}`}</dd>
                <dt>{tx('เจ้าของ')}</dt><dd>{o.name}</dd>
              </dl>
            </div>
          </>
        ) : (
          <p className="muted">{tx('ไม่พบเอกสารนี้')}</p>
        )}
      </div>
      <div className="sheet-foot">
        <UiButton variant="secondary" size="sm" type="button" onClick={() => clinicUi.openSheet('patient', { tab: 'docs' })}>{tx('กลับไปเอกสาร')}</UiButton>
        <span className="grow"></span>
        <UiButton size="sm" type="button" disabled={!doc} onClick={save}><NgIcon svg={lucideDownload} aria-hidden="true" />{tx('ดาวน์โหลดรายละเอียด')}</UiButton>
      </div>
    </cl-document-sheet>
  );
}

/* ---- The owner's bills: what is owed, credit, the open invoices and today's running bill ---- */
export function BillingSheet() {
  const store = useClinicStore();
  const { tx } = useClinicI18n();
  const p = store.selected;
  const o = store.owner(p);
  const open = openInvoices(store.data, p.ownerKey);
  const owed = outstanding(store.data, p.ownerKey);
  const credit = o.credit ?? 0;
  const bill = runningBill(store.data, p);

  const remind = () => {
    const list = open.map(i => `${i.no} · ${i.date} · ${i.pet} · ${baht(balanceOf(i))}`).join('\n');
    clinicActions.sendMessage(p, 'ยอดค้างชำระ', `เรียนคุณ ${o.name}\nยอดค้างชำระกับโรงพยาบาล ${baht(owed)}\n${list}\nชำระได้ที่เคาน์เตอร์การเงินหรือโอนผ่าน PromptPay`);
  };

  return (
    <cl-billing-sheet className="contents">
      <SheetHead heading={`${tx('ค่าใช้จ่าย')} · ${o.name}`} status={owed ? { text: 'ค้างชำระ', cls: 'late' } : { text: 'ไม่มียอดค้าง', cls: 'done' }}
        sub={tx('{0} ใบแจ้งหนี้ค้างชำระ · {1}', { 0: open.length, 1: o.phone })} />
      <div className="sheet-body">
        <div className="section">
          <div className="section-title"><h3>{tx('ยอดคงค้าง')}</h3></div>
          <dl className="data-grid">
            <dt>{tx('ยอดค้างชำระ')}</dt><dd><b className={cx(owed > 0 && 'text-danger')}>{baht(owed)}</b></dd>
            <dt>{tx('เครดิต / มัดจำ')}</dt><dd>{credit ? baht(credit) : '—'}</dd>
          </dl>
        </div>
        <div className="section">
          <div className="section-title"><h3>{tx('ใบแจ้งหนี้ค้างชำระ')}</h3></div>
          <div className="kv-list">
            {open.map(i => (
              <details key={i.id} className="row-card invoice">
                <summary>
                  <span className="grow">
                    <b>{`${i.no} · ${i.pet}`}</b>
                    <span className="secondary">{`${i.date} · ${tx(i.title)} · ${tx('ยอด')} ${baht(i.total)} · ${tx('ชำระแล้ว')} ${baht(i.paid)}`}</span>
                  </span>
                  <span className={cx('chip', i.paid ? 'warn' : 'danger')}>{tx(invoiceState(i))}</span>
                  <b className="amount">{baht(balanceOf(i))}</b>
                </summary>
                <table className="mini-table">
                  <tbody>
                    {i.items.map(([name, amount], index) => <tr key={index}><td>{tx(name)}</td><td className="num">{baht(amount)}</td></tr>)}
                  </tbody>
                </table>
              </details>
            ))}
            {!open.length && <p className="muted">{tx('ไม่มีใบแจ้งหนี้ค้างชำระ')}</p>}
          </div>
        </div>
        <div className="section">
          <div className="section-title"><h3>{tx('ค่าใช้จ่าย visit วันนี้ · {pet}', { pet: p.pet })}</h3></div>
          {bill ? (
            <>
              <table className="mini-table">
                <tbody>
                  {bill.lines.map(([name, amount, ranged], index) => (
                    <tr key={index}><td>{tx(name)}</td><td className="num">{(ranged ? tx('ตั้งแต่') + ' ' : '') + baht(amount)}</td></tr>
                  ))}
                </tbody>
              </table>
              <div className="summary-line total"><span>{tx('รวมโดยประมาณ')}</span><span>{baht(bill.total)}</span></div>
              <p className="muted">{tx('ยังไม่ออกใบแจ้งหนี้ · คิดจากคำสั่งตรวจวันนี้ ช่วงราคาคิดที่ราคาต่ำสุด')}</p>
            </>
          ) : (
            <p className="muted">{tx('ยังไม่มีค่าใช้จ่ายใน visit วันนี้')}</p>
          )}
        </div>
      </div>
      <div className="sheet-foot">
        <UiButton variant="secondary" size="sm" type="button" onClick={() => clinicUi.openSheet('estimate')}>{tx('ใบประเมินค่าใช้จ่าย')}</UiButton>
        <span className="grow"></span>
        <UiButton size="sm" type="button" disabled={!owed} onClick={remind}>{tx('ส่งยอดค้างชำระให้เจ้าของ')}</UiButton>
      </div>
    </cl-billing-sheet>
  );
}
