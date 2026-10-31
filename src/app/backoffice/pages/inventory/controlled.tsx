/*
 * The controlled-drug ledger (INV-CDL-01): the log of every dispense, waste and count, append-only, and the card that
 * records a new one with the witness the drug's rule asks for; a count that differs opens an investigation that someone
 * else closes one way. Thai classes per ADR-0026; the อย. export waits for the server's own (gated).
 */
import { useState } from 'react';
import { useSearchParams } from 'react-router';

import { cx, UiButton } from '../../../user-management/ui';
import { backofficeActions } from '../../backoffice-actions';
import { useBackofficeStore } from '../../backoffice.store';
import {
  canResolve, CONTROL_SYSTEM, controlledItems, INVESTIGATION, ledgerProblems, NOTE_MIN, openInvestigations, WASTE_REASONS, wasteProblems, wasteReason, witnessesFor,
  type LedgerDispenseInput, type WasteInput,
} from '../../data/inventory';
import type { WasteReason } from '../../data/types';
import { useBoI18n } from '../../i18n/bo-i18n';
import { PageHead } from '../../shared/parts';

type Tab = 'dispense' | 'waste' | 'count';
const TABS: { key: Tab; label: string }[] = [{ key: 'dispense', label: 'เบิก-จ่าย' }, { key: 'waste', label: 'ยาเสีย' }, { key: 'count', label: 'นับสต็อก' }];

export function ControlledComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const [params] = useSearchParams();
  const CONTROL = CONTROL_SYSTEM;
  const items = controlledItems(store.stock);
  const open = openInvestigations(store.data);
  const [drug, setDrug] = useState(params.get('drug') ?? '');
  const [tab, setTab] = useState<Tab>((params.get('tab') as Tab | null) ?? 'dispense');
  const [openOnly, setOpenOnly] = useState(params.get('tab') === 'count');
  const dispenses = store.data.ledgerDispenses.filter(d => !drug || d.drug === drug);
  const wastes = store.data.wastes.filter(w => !drug || w.drug === drug);
  const counts = store.data.counts.filter(c => (!drug || c.drug === drug) && (!openOnly || c.investigation === 'open'));

  /* The action card */
  const [form, setForm] = useState<Tab>('dispense');
  const [formDrug, setFormDrug] = useState(drug);
  const [patient, setPatient] = useState('');
  const [encounter, setEncounter] = useState('');
  const [order, setOrder] = useState('');
  const [qty, setQty] = useState('');
  const [witness, setWitness] = useState('');
  const [wasteKind, setWasteKind] = useState<WasteReason>('partial_dose');
  const [detail, setDetail] = useState('');
  const [dispenseId, setDispenseId] = useState('');
  const patients = store.clinic.data.patients.map(p => `${p.pet} · ${store.clinic.data.owners[p.ownerKey]?.name ?? p.ownerKey}`);
  const witnesses = witnessesFor(store.userName);
  const selectedItem = items.find(i => i.drug.name === formDrug) ?? null;
  const unit = selectedItem?.drug.unit ?? '';
  const needsWitness = !!selectedItem?.drug.requiresWitnessDispense;
  const drugDispenses = store.data.ledgerDispenses.filter(d => d.drug === formDrug);
  const dispenseInput: LedgerDispenseInput = { drug: formDrug, patient, encounter, order, qty: Number(qty), witness: witness || undefined };
  const dispenseProblems = Object.values(ledgerProblems(store.data, dispenseInput, store.userName, selectedItem?.onHand ?? null)) as string[];
  const wasteInput: WasteInput = { drug: formDrug, qty: Number(qty), reason: wasteKind, detail, witness, dispenseId: dispenseId || undefined };
  const wasteProblemList = Object.values(wasteProblems(wasteInput, store.userName)) as string[];
  const clear = () => { setPatient(''); setEncounter(''); setOrder(''); setQty(''); setWitness(''); setDetail(''); setDispenseId(''); };
  const unitSuffix = unit ? ` (${tx(unit)})` : '';

  return (
    <bo-controlled className="page">
      <PageHead heading="บัญชียาควบคุม" source="M06 · ยาเสพติดให้โทษและวัตถุออกฤทธิ์ตาม ADR-0026 · พยานเป็นช่องในรายการเบิกและยาเสีย ไม่มีการลงนามแยก · ทุกรายการ append-only" freshness="ข้อมูล ณ วันนี้ 11:32">
        <select className="ui-input" aria-label={tx('รายการยา')} value={drug} onChange={event => setDrug(event.target.value)}>
          <option value="">{tx('ยาควบคุมทุกรายการ')}</option>
          {items.map(i => <option key={i.drug.id} value={i.drug.name}>{i.drug.name}</option>)}
        </select>
      </PageHead>

      <div className="kpi-strip" role="list">
        {items.map(i => (
          <button key={i.drug.id} type="button" className={cx('kpi', i.isLow && 'warn', drug === i.drug.name && 'active')} role="listitem" onClick={() => setDrug(drug === i.drug.name ? '' : i.drug.name)}>
            <span className="kpi-value">{i.onHand ?? '—'} <small>{tx(i.drug.unit)}</small></span>
            <span className="kpi-label">{`${i.drug.name} · ${tx(CONTROL[i.drug.classSystem].short)} ${i.drug.category}${i.drug.requiresWitnessDispense ? ` · ${tx('เบิกต้องมีพยาน')}` : ''}`}</span>
          </button>
        ))}
        <div className={cx('kpi', open.length > 0 && 'danger')} role="listitem"><span className="kpi-value">{open.length}</span><span className="kpi-label">{tx('การสอบสวนที่เปิดอยู่')}</span></div>
      </div>

      <div className="record ledger">
        <div className="record-main">
          <div className="panel">
            <div className="filter-bar">
              <div className="segmented" role="group" aria-label={tx('บันทึกในบัญชี')}>
                {TABS.map(t => <button key={t.key} type="button" className={cx(tab === t.key && 'active')} aria-pressed={tab === t.key} onClick={() => setTab(t.key)}>{tx(t.label)}</button>)}
              </div>
              {tab === 'count' && <label className="check"><input type="checkbox" checked={openOnly} onChange={event => setOpenOnly(event.target.checked)} />{tx('เฉพาะที่สอบสวนอยู่')}</label>}
              <span className="secondary grow">{tx('{n} รายการ', { n: tab === 'dispense' ? dispenses.length : tab === 'waste' ? wastes.length : counts.length })}</span>
            </div>
            <div className="table-wrap">
              {tab === 'dispense' && (
                <table className="bo-table">
                  <thead><tr><th scope="col" className="w-at">{tx('เวลา')}</th><th scope="col">{tx('รายการยา')}</th><th scope="col" className="w-amount num">{tx('จำนวน')}</th><th scope="col" className="w-owner">{tx('ผู้ทำ')}</th><th scope="col" className="w-owner">{tx('พยาน')}</th><th scope="col">{tx('อ้างอิง')}</th><th scope="col" className="w-ref">Lot</th></tr></thead>
                  <tbody>
                    {dispenses.map(d => (
                      <tr key={d.id} className="static">
                        <td className="num">{d.at}</td>
                        <td><b>{d.drug}</b><div className="secondary">{d.id}</div></td>
                        <td className="num">{d.qty} {tx(d.unit)}</td>
                        <td>{tx(d.by)}</td>
                        <td>{tx(d.witness ?? '—')}</td>
                        <td>{d.patient}<div className="secondary">{d.order ?? '—'}{d.encounter && ` · ${d.encounter}`}</div></td>
                        <td>{d.lot ?? '—'}</td>
                      </tr>
                    ))}
                    {!dispenses.length && <tr className="static"><td colSpan={7} className="empty">{tx('ยังไม่มีรายการเบิก')}</td></tr>}
                  </tbody>
                </table>
              )}
              {tab === 'waste' && (
                <table className="bo-table">
                  <thead><tr><th scope="col" className="w-at">{tx('เวลา')}</th><th scope="col">{tx('รายการยา')}</th><th scope="col" className="w-amount num">{tx('จำนวน')}</th><th scope="col" className="w-kind">{tx('เหตุผล')}</th><th scope="col">{tx('รายละเอียด')}</th><th scope="col" className="w-owner">{tx('ผู้ทำ')}</th><th scope="col" className="w-owner">{tx('พยาน')}</th></tr></thead>
                  <tbody>
                    {wastes.map(w => (
                      <tr key={w.id} className="static">
                        <td className="num">{w.at}</td>
                        <td><b>{w.drug}</b><div className="secondary">{w.id}{w.dispenseId && ` · ${w.dispenseId}`}</div></td>
                        <td className="num">{w.qty} {tx(w.unit)}</td>
                        <td><span className={`chip ${wasteReason(w.reason).fromStock ? 'warn' : 'quiet'}`}>{tx(wasteReason(w.reason).label)}</span></td>
                        <td>{tx(w.detail)}</td>
                        <td>{tx(w.by)}</td>
                        <td>{tx(w.witness)}</td>
                      </tr>
                    ))}
                    {!wastes.length && <tr className="static"><td colSpan={7} className="empty">{tx('ยังไม่มีรายการยาเสีย')}</td></tr>}
                  </tbody>
                </table>
              )}
              {tab === 'count' && (
                <table className="bo-table counts">
                  <thead><tr><th scope="col" className="w-at">{tx('เวลา')}</th><th scope="col">{tx('รายการยา')}</th><th scope="col" className="w-amount num">{tx('นับได้')}</th><th scope="col" className="w-amount num">{tx('คาด')}</th><th scope="col" className="w-amount num">{tx('ส่วนต่าง')}</th><th scope="col" className="w-owner">{tx('ผู้นับ')}</th><th scope="col" className="w-status">{tx('สถานะ')}</th><th scope="col" className="w-actions"><span className="visually-hidden">{tx('การทำงาน')}</span></th></tr></thead>
                  <tbody>
                    {counts.map(c => (
                      <tr key={c.id} className={cx('static', c.investigation === 'open' && 'open')}>
                        <td className="num">{c.at}</td>
                        <td><b>{c.drug}</b><div className="secondary">{c.id}</div></td>
                        <td className="num">{c.actual} {tx(c.unit)}</td>
                        <td className="num">{c.expected}</td>
                        <td className={cx('num', c.discrepancy !== 0 && 'text-danger')}>{c.discrepancy > 0 ? '+' : ''}{c.discrepancy}</td>
                        <td>{tx(c.by)}{c.resolvedBy && <div className="secondary">{`${tx('สรุปโดย')} ${tx(c.resolvedBy)} · ${c.resolvedAt}`}</div>}</td>
                        <td><span className={`chip ${INVESTIGATION[c.investigation].cls}`}>{tx(INVESTIGATION[c.investigation].label)}</span>{c.resolutionNotes && <div className="secondary">{tx(c.resolutionNotes)}</div>}</td>
                        <td>
                          {c.investigation === 'open' && (
                            <div className="row-actions">
                              <UiButton size="sm" type="button" disabled={!canResolve(c, store.userName)} title={canResolve(c, store.userName) ? '' : tx('ผู้นับสรุปผลเองไม่ได้')} onClick={() => backofficeActions.resolveInvestigation(c, 'resolved')}>{tx('สรุปผลสอบสวน')}</UiButton>
                              <UiButton variant="secondary" size="sm" type="button" disabled={!canResolve(c, store.userName)} onClick={() => backofficeActions.resolveInvestigation(c, 'escalated')}>{tx('ส่งต่อระดับสูง')}</UiButton>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {!counts.length && <tr className="static"><td colSpan={8} className="empty">{tx(openOnly ? 'ไม่มีการสอบสวนที่เปิดอยู่' : 'ยังไม่มีการนับ')}</td></tr>}
                  </tbody>
                </table>
              )}
            </div>
          </div>
          <div className="notice">{tx('ยังไม่มีการส่งออกบัญชีตามรูปแบบ อย. (บจ.8 / บจ.9) — รอ export จากระบบพร้อมหัวใบอนุญาต ไม่สร้างจากแถวที่เห็นในหน้านี้')}</div>
        </div>

        {/* The action card: one form per tab, each confirmed once more before it is recorded */}
        <aside className="record-rail">
          <div className="panel action-card">
            <div className="segmented" role="group" aria-label={tx('บันทึกรายการ')}>
              {TABS.map(t => <button key={t.key} type="button" className={cx(form === t.key && 'active')} aria-pressed={form === t.key} onClick={() => setForm(t.key)}>{tx(t.label)}</button>)}
            </div>
            <label className="field">{tx('รายการยา')}
              <select className="ui-input" value={formDrug} onChange={event => setFormDrug(event.target.value)}>
                <option value="">{tx('— เลือกยาควบคุม —')}</option>
                {items.map(i => <option key={i.drug.id} value={i.drug.name}>{`${i.drug.name} · ${i.onHand ?? '—'} ${tx(i.drug.unit)}`}</option>)}
              </select>
            </label>
            {form === 'dispense' && (
              <>
                <label className="field">{tx('ผู้ป่วย')}
                  <select className="ui-input" value={patient} onChange={event => setPatient(event.target.value)}>
                    <option value="">{tx('— เลือกผู้ป่วย —')}</option>
                    {patients.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </label>
                <div className="two">
                  <label className="field">Visit<input className="ui-input" value={encounter} onChange={event => setEncounter(event.target.value)} placeholder="ENC-…" /></label>
                  <label className="field">{tx('คำสั่ง')}<input className="ui-input" value={order} onChange={event => setOrder(event.target.value)} placeholder="RX-…" /></label>
                </div>
                <label className="field">{tx('จำนวนที่เบิก')}{unitSuffix}<input className="ui-input" type="number" min="0" step="any" value={qty} onChange={event => setQty(event.target.value)} /></label>
                <label className="field">{tx('พยาน')} <span className="muted">{tx(needsWitness ? '(ยานี้บังคับ)' : '(ตามกฎของยา)')}</span>
                  <select className="ui-input" value={witness} onChange={event => setWitness(event.target.value)}>
                    <option value="">{tx('— ไม่มี —')}</option>
                    {witnesses.map(w => <option key={w} value={w}>{tx(w)}</option>)}
                  </select>
                </label>
                {dispenseProblems.length > 0 && <ul className="problems">{dispenseProblems.map(p => <li key={p}>{tx(p)}</li>)}</ul>}
                <UiButton size="sm" type="button" disabled={dispenseProblems.length > 0} onClick={() => backofficeActions.ledgerDispense(dispenseInput, () => { setTab('dispense'); clear(); })}>{tx('บันทึกการเบิก')}</UiButton>
              </>
            )}
            {form === 'waste' && (
              <>
                <label className="field">{tx('จำนวน')}{unitSuffix}<input className="ui-input" type="number" min="0" step="any" value={qty} onChange={event => setQty(event.target.value)} /></label>
                <label className="field">{tx('เหตุผล')}
                  <select className="ui-input" value={wasteKind} onChange={event => setWasteKind(event.target.value as WasteReason)}>
                    {WASTE_REASONS.map(r => <option key={r.value} value={r.value}>{`${tx(r.label)}${r.fromStock ? ` · ${tx('ตัดจากคลัง')}` : ''}`}</option>)}
                  </select>
                </label>
                <label className="field">{tx('รายการเบิกที่เกี่ยวข้อง')} <span className="muted">{tx('(ไม่บังคับ)')}</span>
                  <select className="ui-input" value={dispenseId} onChange={event => setDispenseId(event.target.value)}>
                    <option value="">{tx('— ไม่มี —')}</option>
                    {drugDispenses.map(d => <option key={d.id} value={d.id}>{`${d.id} · ${d.patient} · ${d.qty} ${tx(d.unit)}`}</option>)}
                  </select>
                </label>
                <label className="field">{tx('รายละเอียด (≥{n} ตัวอักษร)', { n: NOTE_MIN })}<textarea className="ui-input" rows={2} value={detail} onChange={event => setDetail(event.target.value)}></textarea></label>
                <label className="field">{tx('พยาน')} <span className="muted">{tx('(บังคับเสมอ)')}</span>
                  <select className="ui-input" value={witness} onChange={event => setWitness(event.target.value)}>
                    <option value="">{tx('— เลือกพยาน —')}</option>
                    {witnesses.map(w => <option key={w} value={w}>{tx(w)}</option>)}
                  </select>
                </label>
                {wasteProblemList.length > 0 && <ul className="problems">{wasteProblemList.map(p => <li key={p}>{tx(p)}</li>)}</ul>}
                <UiButton size="sm" type="button" disabled={wasteProblemList.length > 0} onClick={() => backofficeActions.recordWaste(wasteInput, () => { setTab('waste'); clear(); })}>{tx('บันทึกยาเสีย')}</UiButton>
              </>
            )}
            {form === 'count' && (
              <>
                <label className="field">{tx('จำนวนที่นับได้')}{unitSuffix}<input className="ui-input" type="number" min="0" step="any" value={qty} onChange={event => setQty(event.target.value)} /></label>
                <p className="secondary">{tx('กรอกเฉพาะที่นับได้ · จำนวนที่คาดและส่วนต่างเป็นของระบบ แสดงหลังบันทึก · ต่างกันจะเปิดการสอบสวนทันที')}</p>
                <UiButton size="sm" type="button" disabled={!formDrug || !(qty !== '' && Number(qty) >= 0)} onClick={() => backofficeActions.recordCount(formDrug, Number(qty), () => { setTab('count'); setOpenOnly(false); clear(); })}>{tx('บันทึกการนับ')}</UiButton>
              </>
            )}
            <p className="secondary">{tx('ผู้ทำรายการ: {name}', { name: store.userName })}</p>
          </div>
        </aside>
      </div>
    </bo-controlled>
  );
}
