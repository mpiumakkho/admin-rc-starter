/* Insurance claims: claims and pre-authorisations tracked by hand from the form to the money, until the insurers' APIs (sales.insuranceClaims, M16 P1) */
import { useState } from 'react';
import { useSearchParams } from 'react-router';

import { baht } from '../../../clinic/data/rail';
import { lucidePlus, lucidePrinter } from '../../../icons';
import { cx, NgIcon, UiButton } from '../../../user-management/ui';
import { backofficeActions } from '../../backoffice-actions';
import { useBackofficeStore } from '../../backoffice.store';
import { CLAIM_KIND, CLAIM_STATUS, claimableInvoices, claimEstimate, claimProblems, claimSummary, eobVariance, INSURERS, isOverdue, policyOf } from '../../data/sales';
import type { ClaimInput } from '../../data/sales';
import type { Claim, ClaimStatus, Insurer } from '../../data/types';
import { useBoI18n } from '../../i18n/bo-i18n';
import { Drawer, PageHead } from '../../shared/parts';

const STATUS_KEYS = Object.keys(CLAIM_STATUS) as ClaimStatus[];

/** Approved covers both full and partial approvals; not sent covers drafts and forms ready */
const matches = (c: Claim, s: ClaimStatus) =>
  s === 'approved' ? c.status === 'approved' || c.status === 'partially-approved' : s === 'draft' ? c.status === 'draft' || c.status === 'documents-ready' : c.status === s;

export function ClaimsComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const [params] = useSearchParams();
  const [status, setStatus] = useState<ClaimStatus | ''>((params.get('status') as ClaimStatus | null) ?? '');
  const [insurer, setInsurer] = useState<Insurer | ''>('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  /* The new claim */
  const [creating, setCreating] = useState(false);
  const policies = store.data.policies;
  const [policyId, setPolicyId] = useState(policies[0]?.id ?? '');
  const [kind, setKind] = useState<'claim' | 'pre-auth'>('claim');
  const [invoiceId, setInvoiceId] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [amount, setAmount] = useState('');

  const s = claimSummary(store.data);
  const rows = store.data.claims.filter(c => (!insurer || c.insurer === insurer) && (!status || matches(c, status)));
  const selected = store.data.claims.find(c => c.id === selectedId) ?? null;
  const policy = policyOf(store.data, policyId);
  const invoices = policy ? claimableInvoices(store.clinic.data, store.data, policy) : [];
  const estimateFor = (id: string) => {
    const i = store.clinic.data.invoices.find(x => x.id === id);
    return policy && i && kind === 'claim' ? claimEstimate(policy, i.total) : null;
  };
  const estimate = estimateFor(invoiceId);
  const input: ClaimInput = { policyId, kind, invoiceId: kind === 'claim' ? invoiceId || undefined : undefined, diagnosis, amount: Number(amount) };
  const problems = Object.values(claimProblems(store.clinic.data, store.data, input)) as string[];

  const policyNo = (c: Claim) => policyOf(store.data, c.policyId)?.policyNo ?? '—';
  const remaining = (c: Claim) => policyOf(store.data, c.policyId)?.remaining ?? 0;
  const invoiceNo = (c: Claim) => store.clinic.data.invoices.find(i => i.id === c.invoiceId)?.no ?? '—';
  const toggle = (k: ClaimStatus) => setStatus(status === k ? '' : k);
  const pick = (c: Claim) => { setCreating(false); setSelectedId(selectedId === c.id ? null : c.id); };
  const openCreate = () => { setSelectedId(null); setCreating(true); };
  const pickPolicy = (id: string) => { setPolicyId(id); setInvoiceId(''); setAmount(''); };
  const pickInvoice = (id: string) => {
    setInvoiceId(id);
    const e = estimateFor(id);
    if (e !== null) {
      setAmount(String(e));
    }
  };
  const create = () => backofficeActions.createClaim(input, claim => {
    setCreating(false);
    setDiagnosis('');
    setAmount('');
    setInvoiceId('');
    setSelectedId(claim.id);
    setStatus('');
  });

  return (
    <bo-claims className="page">
      <PageHead heading="การเคลมประกันสัตว์เลี้ยง" source="M16 P1 · ออกเอกสารตามแบบของบริษัทประกัน ส่งเอง และบันทึกสถานะ · การส่งผ่าน API ของ Falcon MSIG Roojai เป็น P4" freshness="ข้อมูล ณ วันนี้ 11:32">
        <UiButton size="sm" type="button" onClick={openCreate}><NgIcon svg={lucidePlus} aria-hidden="true" />{tx('สร้างเคลม')}</UiButton>
      </PageHead>

      <div className="kpi-strip" role="list">
        <button type="button" className={cx('kpi', status === 'draft' && 'active')} role="listitem" onClick={() => toggle('draft')}><span className="kpi-value">{s.drafts}</span><span className="kpi-label">{tx('ยังไม่ส่ง')}</span></button>
        <button type="button" className={cx('kpi', s.waiting.count > 0 && 'warn', status === 'submitted' && 'active')} role="listitem" onClick={() => toggle('submitted')}><span className="kpi-value">{baht(s.waiting.amount)}</span><span className="kpi-label">{tx('ส่งแล้ว รอผล · {n} · เกิน 14 วัน {m}', { n: s.waiting.count, m: s.overdue })}</span></button>
        <button type="button" className={cx('kpi', status === 'approved' && 'active')} role="listitem" onClick={() => toggle('approved')}><span className="kpi-value">{baht(s.approved.amount)}</span><span className="kpi-label">{tx('อนุมัติแล้ว รอรับเงิน · {n}', { n: s.approved.count })}</span></button>
        <button type="button" className={cx('kpi', status === 'reimbursed' && 'active')} role="listitem" onClick={() => toggle('reimbursed')}><span className="kpi-value">{baht(s.reimbursed)}</span><span className="kpi-label">{tx('ได้รับเงินแล้ว')}</span></button>
        <button type="button" className={cx('kpi', s.rejected > 0 && 'danger', status === 'rejected' && 'active')} role="listitem" onClick={() => toggle('rejected')}><span className="kpi-value">{s.rejected}</span><span className="kpi-label">{tx('ปฏิเสธ')}</span></button>
      </div>

      <div className={cx('split', (selected || creating) && 'with-drawer')}>
        <div className="panel">
          <div className="filter-bar">
            <select className="ui-input" aria-label={tx('บริษัทประกัน')} value={insurer} onChange={event => setInsurer(event.target.value as Insurer | '')}>
              <option value="">{tx('ทุกบริษัท')}</option>
              {INSURERS.map(x => <option key={x} value={x}>{x}</option>)}
            </select>
            <select className="ui-input" aria-label={tx('สถานะ')} value={status} onChange={event => setStatus(event.target.value as ClaimStatus | '')}>
              <option value="">{tx('ทุกสถานะ')}</option>
              {STATUS_KEYS.map(k => <option key={k} value={k}>{tx(CLAIM_STATUS[k].label)}</option>)}
            </select>
            <span className="secondary grow">{tx('{n} รายการ', { n: rows.length })}</span>
          </div>
          <div className="table-wrap">
            <table className="bo-table">
              <thead>
                <tr>
                  <th scope="col" className="w-ref">{tx('เลขที่')}</th>
                  <th scope="col" className="w-kind">{tx('บริษัทประกัน')}</th>
                  <th scope="col">{tx('เจ้าของ / สัตว์')}</th>
                  <th scope="col" className="w-amount num">{tx('ยอดเคลม')}</th>
                  <th scope="col" className="w-amount num">{tx('ยอดอนุมัติ')}</th>
                  <th scope="col" className="w-status">{tx('สถานะ')}</th>
                  <th scope="col" className="w-at">{tx('ล่าสุด')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(c => (
                  <tr key={c.id} tabIndex={0} className={cx(c.id === selectedId && 'selected')} aria-selected={c.id === selectedId} onClick={() => pick(c)} onKeyDown={event => { if (event.key === 'Enter') { pick(c); } }}>
                    <td><b>{c.id}</b><div className="secondary">{tx(CLAIM_KIND[c.kind])}</div></td>
                    <td>{c.insurer}<div className="secondary">{policyNo(c)}</div></td>
                    <td>{c.ownerKey}<div className="secondary">{`${c.pet} · ${tx(c.diagnosis)}`}</div></td>
                    <td className="num">{baht(c.amount)}</td>
                    <td className="num">{c.approvedAmount === undefined ? '—' : baht(c.approvedAmount)}</td>
                    <td><span className={`chip ${CLAIM_STATUS[c.status].cls}`}>{tx(CLAIM_STATUS[c.status].label)}</span>{isOverdue(c) && <div className="secondary text-danger">{tx('เกิน 14 วัน — ติดตาม')}</div>}</td>
                    <td className="num">{c.log[c.log.length - 1][0]}</td>
                  </tr>
                ))}
                {!rows.length && <tr className="static"><td colSpan={7} className="empty">{tx('ไม่มีเคลมที่ตรงกับตัวกรอง')}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {creating ? (
          <Drawer heading="สร้างเคลม" sub="ฉบับร่าง · ออกเอกสารแล้วจึงส่ง" onClosed={() => setCreating(false)} foot={<>
            <UiButton variant="secondary" size="sm" type="button" onClick={() => setCreating(false)}>{tx('ยกเลิก')}</UiButton>
            <span className="grow"></span>
            <UiButton size="sm" type="button" disabled={problems.length > 0} onClick={create}>{tx('สร้างฉบับร่าง')}</UiButton>
          </>}>
            <div className="form-grid">
              <label className="full">{tx('กรมธรรม์')}
                <select className="ui-input" value={policyId} onChange={event => pickPolicy(event.target.value)}>
                  {policies.map(p => <option key={p.id} value={p.id}>{`${p.insurer} · ${p.policyNo} · ${p.ownerKey} · ${p.pet}`}</option>)}
                </select>
              </label>
              <div className="full segmented" role="group" aria-label={tx('ประเภท')}>
                <button type="button" className={cx(kind === 'claim' && 'active')} aria-pressed={kind === 'claim'} onClick={() => setKind('claim')}>{tx(CLAIM_KIND.claim)}</button>
                <button type="button" className={cx(kind === 'pre-auth' && 'active')} aria-pressed={kind === 'pre-auth'} onClick={() => setKind('pre-auth')}>{tx(CLAIM_KIND['pre-auth'])}</button>
              </div>
              {kind === 'claim' && (
                <label className="full">{tx('เลขที่ใบแจ้งหนี้')}
                  <select className="ui-input" value={invoiceId} onChange={event => pickInvoice(event.target.value)}>
                    <option value="">{tx('— เลือกใบแจ้งหนี้ —')}</option>
                    {invoices.map(i => <option key={i.id} value={i.id}>{`${i.no} · ${tx(i.title)} · ${baht(i.total)}`}</option>)}
                  </select>
                </label>
              )}
              <label className="full">{tx('การวินิจฉัย')}<input className="ui-input" value={diagnosis} onChange={event => setDiagnosis(event.target.value)} /></label>
              <label>{tx('จำนวนเงิน (บาท)')}<input className="ui-input" type="number" min="0" value={amount} onChange={event => setAmount(event.target.value)} /></label>
            </div>
            {policy && (
              <dl className="data-grid">
                <dt>{tx('วงเงินคงเหลือ')}</dt><dd>{`${baht(policy.remaining)} / ${baht(policy.limit)}`}</dd>
                <dt>{tx('ค่าเสียหายส่วนแรก')}</dt><dd>{`${baht(policy.deductible)} · ${tx('ร่วมจ่าย')} ${policy.copay * 100}%`}</dd>
                <dt>{tx('คุ้มครองถึง')}</dt><dd>{policy.validTo}</dd>
                {estimate !== null && <><dt>{tx('ประมาณการที่เบิกได้')}</dt><dd><b>{baht(estimate)}</b></dd></>}
              </dl>
            )}
            {problems.length > 0 && <ul className="problems">{problems.map(p => <li key={p}>{tx(p)}</li>)}</ul>}
          </Drawer>
        ) : selected && (
          <Drawer heading={selected.id} sub={`${tx(CLAIM_KIND[selected.kind])} · ${selected.insurer} · ${tx(CLAIM_STATUS[selected.status].label)}`} onClosed={() => setSelectedId(null)} foot={<>
            {(selected.status === 'draft' || selected.status === 'documents-ready') && (
              <UiButton variant="secondary" size="sm" type="button" onClick={() => backofficeActions.printClaim(selected)}><NgIcon svg={lucidePrinter} aria-hidden="true" />{tx('ออกเอกสาร')}</UiButton>
            )}
            <span className="grow"></span>
            {selected.status === 'documents-ready' && <UiButton size="sm" type="button" onClick={() => backofficeActions.submitClaim(selected)}>{tx('บันทึกการส่ง')}</UiButton>}
            {selected.status === 'submitted' && <UiButton size="sm" type="button" onClick={() => backofficeActions.decideClaim(selected)}>{tx('บันทึกผลพิจารณา')}</UiButton>}
            {(selected.status === 'approved' || selected.status === 'partially-approved') && <UiButton size="sm" type="button" onClick={() => backofficeActions.reimburse(selected)}>{tx('บันทึกรับเงิน')}</UiButton>}
          </>}>
            <dl className="data-grid">
              <dt>{tx('กรมธรรม์')}</dt><dd>{`${policyNo(selected)} · ${tx('วงเงินคงเหลือ')} ${baht(remaining(selected))}`}</dd>
              <dt>{tx('เจ้าของ / สัตว์')}</dt><dd>{`${selected.ownerKey} · ${selected.pet}`}</dd>
              <dt>{tx('การวินิจฉัย')}</dt><dd>{tx(selected.diagnosis)}</dd>
              <dt>{tx('เลขที่ใบแจ้งหนี้')}</dt><dd>{invoiceNo(selected)}</dd>
              <dt>{tx('ยอดเคลม')}</dt><dd>{baht(selected.amount)}</dd>
              {selected.insurerRef && <><dt>{tx('เลขรับเรื่อง')}</dt><dd>{`${selected.insurerRef} · ${tx(selected.submittedVia ?? '')}`}</dd></>}
              {selected.approvedAmount !== undefined && <><dt>{tx('ผลพิจารณา')}</dt><dd>{`${baht(selected.approvedAmount)} · ${tx(selected.decisionNote ?? '')}`}</dd></>}
              {selected.reimbursed && (() => {
                const r = selected.reimbursed;
                const v = eobVariance(selected);
                return <>
                  <dt>{tx('ได้รับเงิน')}</dt><dd>{`${baht(r.amount)} → ${tx(r.payee === 'hospital' ? 'โรงพยาบาล' : 'เจ้าของ')} · ${r.ref || '—'}`}</dd>
                  <dt>EOB</dt><dd className={cx(!!v && 'text-danger')}>{v ? tx('ต่างจากที่อนุมัติ {amount}', { amount: baht(v) }) : tx('ตรงกับที่อนุมัติ')}</dd>
                </>;
              })()}
            </dl>
            <div className="timeline">
              {selected.log.map((l, index) => (
                <div key={index} className="tl"><span className={`chip ${CLAIM_STATUS[l[2]].cls}`}>{tx(CLAIM_STATUS[l[2]].label)}</span>{`${l[0]} · ${tx(l[1])} — ${tx(l[3])}`}</div>
              ))}
            </div>
          </Drawer>
        )}
      </div>
    </bo-claims>
  );
}
