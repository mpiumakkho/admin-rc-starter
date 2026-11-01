/* One device: PM, calibration, downtime, contracts, cost and its bed in one place (assets.registry detail, M22 P2 / M10) */
import { Link, useNavigate, useParams } from 'react-router';

import { inpatients } from '../../../clinic/data/ward';
import { lucideArrowLeft } from '../../../icons';
import { NgIcon, UiButton } from '../../../user-management/ui';
import { backofficeActions } from '../../backoffice-actions';
import { useBackofficeStore } from '../../backoffice.store';
import {
  CALIBRATION_RESULT, calibrationLapses, calibrationsOf, CONTRACT_KIND, CONTRACT_STATE, contractState, costOf, CRITICALITY, DOWNTIME_KIND, downtimeHours, DUE_STATE, EQUIPMENT_CLASS,
  EQUIPMENT_STATUS, equipmentOf, openDecommission, openDowntimeOf, pmState, READINESS, readiness, reliability,
} from '../../data/assets';
import { useBoI18n } from '../../i18n/bo-i18n';

const baht = (n: number) => `฿${n.toLocaleString('en-US')}`;
const hours = (n: number | null) => (n === null ? '—' : n >= 100 ? Math.round(n).toLocaleString('en-US') : n.toFixed(1));

export function EquipmentDetailComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const navigate = useNavigate();
  const { id = '' } = useParams();
  const d = store.data;
  const e = equipmentOf(d, id);
  if (!e) {
    return (
      <bo-equipment-detail className="page">
        <div className="panel prompt">{tx('ไม่พบอุปกรณ์นี้')}<div className="secondary"><Link className="link" to="/backoffice/assets/registry">{tx('ทะเบียนอุปกรณ์')}</Link></div></div>
      </bo-equipment-detail>
    );
  }
  const r = readiness(d, e);
  const rel = reliability(d, [id]);
  const pmS = pmState(d, e);
  const pm = d.pm.filter(t => t.equipmentId === id).sort((a, b) => b.due.localeCompare(a.due));
  const calibrations = calibrationsOf(d, id).reverse();
  const lapses = calibrationLapses(d, e);
  const downtime = d.downtime.filter(x => x.equipmentId === id).sort((a, b) => b.from.localeCompare(a.from));
  const openDown = openDowntimeOf(d, id);
  const contracts = d.contracts.filter(c => c.equipmentIds.includes(id));
  const decommission = openDecommission(d, id);
  const cost = costOf(e);
  // The pet in the device's bed now, from the ward (M10)
  const occupant = e.bed ? inpatients(store.clinic.data).find(p => p.admission!.bed === e.bed)?.pet ?? null : null;
  const history = [...e.history].sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <bo-equipment-detail className="page">
      <div className="page-head">
        <div className="title-block">
          <Link className="link back" to="/backoffice/assets/registry"><NgIcon svg={lucideArrowLeft} aria-hidden="true" />{tx('ทะเบียนอุปกรณ์')}</Link>
          <h1>{tx(e.name)} <span className={`chip ${EQUIPMENT_STATUS[e.status].cls}`}>{tx(EQUIPMENT_STATUS[e.status].label)}</span></h1>
          <div className="subtitle">
            <span>{`${e.id} · ${tx(EQUIPMENT_CLASS[e.cls].label)} · ${e.maker} ${e.model} · ${e.serial}`}</span>
            <span className="freshness">{tx('ข้อมูล ณ วันนี้ 11:32')}</span>
          </div>
        </div>
        {e.status !== 'decommissioned' && (
          <div className="page-actions">
            <UiButton variant="secondary" size="sm" type="button" onClick={() => backofficeActions.moveEquipment(e)}>{tx('แก้ไขที่ตั้ง')}</UiButton>
            {openDown
              ? <UiButton size="sm" type="button" onClick={() => backofficeActions.closeDowntime(openDown)}>{tx('กลับมาใช้งาน')}</UiButton>
              : <UiButton variant="danger" size="sm" type="button" onClick={() => void navigate(`/backoffice/assets/downtime?report=${e.id}`)}>{tx('แจ้งขัดข้อง')}</UiButton>}
          </div>
        )}
      </div>

      <div className="record">
        <div className="record-main">
          <div className="panel">
            <div className="filter-bar"><b>{tx('PM')}</b><span className="secondary grow">{tx('ทุก {n} เดือน · ครั้งถัดไปวางแผนจากวันที่ทำ', { n: e.pmMonths })}</span><Link className="link" to="/backoffice/assets/pm">{tx('แผน PM')}</Link></div>
            <div className="table-wrap">
              <table className="bo-table">
                <thead><tr><th scope="col" className="w-ref">{tx('เลขที่')}</th><th scope="col" className="w-due">{tx('กำหนด')}</th><th scope="col" className="w-due">{tx('วันที่ทำ')}</th><th scope="col">{tx('ผล')}</th><th scope="col" className="w-amount num">{tx('ค่าใช้จ่าย')}</th></tr></thead>
                <tbody>
                  {pm.map(t => (
                    <tr key={t.id} className="static">
                      <td>{t.id}</td>
                      <td className="num">{t.due}{t.movedFrom && <div className="secondary">{tx('เลื่อนจาก {date}', { date: t.movedFrom })}</div>}</td>
                      <td className="num">{t.doneAt ?? '—'}</td>
                      <td>
                        {t.status === 'open' && pmS ? <span className={`chip ${DUE_STATE[pmS].cls}`}>{tx(DUE_STATE[pmS].label)}</span>
                          : t.status === 'cancelled' ? <span className="chip quiet">{tx('ยกเลิกแล้ว')}</span>
                            : <><span className={`chip ${t.outcome === 'pass' ? 'ok' : 'danger'}`}>{tx(t.outcome === 'pass' ? 'ผ่าน' : 'ไม่ผ่าน')}</span>{t.findings && <div className="secondary">{tx(t.findings)}</div>}</>}
                      </td>
                      <td className="num">{t.cost ? baht(t.cost) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {e.calibrationMonths && (
            <div className="panel">
              <div className="filter-bar"><b>{tx('การสอบเทียบ')}</b><span className="secondary grow">{tx('ทุก {n} เดือน', { n: e.calibrationMonths })}{lapses.length > 0 && <> · <span className="text-danger">{tx('เคยเกินกำหนด {n} ครั้ง', { n: lapses.length })}</span></>}</span><Link className="link" to="/backoffice/assets/calibration">{tx('Calibration')}</Link></div>
              <div className="table-wrap">
                <table className="bo-table">
                  <thead><tr><th scope="col" className="w-ref">{tx('เลขที่')}</th><th scope="col" className="w-due">{tx('วันที่')}</th><th scope="col">{tx('ผู้สอบเทียบ')}</th><th scope="col" className="w-status">{tx('ผล')}</th><th scope="col" className="w-due">{tx('ครั้งถัดไป')}</th></tr></thead>
                  <tbody>
                    {calibrations.map(c => (
                      <tr key={c.id} className="static"><td>{c.id}</td><td className="num">{c.date}</td><td>{tx(c.by)}{c.certificate && <div className="secondary">{c.certificate}</div>}</td><td><span className={`chip ${CALIBRATION_RESULT[c.result].cls}`}>{tx(CALIBRATION_RESULT[c.result].label)}</span></td><td className="num">{c.nextDue}</td></tr>
                    ))}
                    {!calibrations.length && <tr className="static"><td colSpan={5} className="empty">{tx('ยังไม่มีผลสอบเทียบ')}</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="panel">
            <div className="filter-bar"><b>{tx('การขัดข้อง')}</b><span className="secondary grow">{tx('12 เดือน · MTBF {a} ชม. · MTTR {b} ชม.', { a: hours(rel.mtbf), b: hours(rel.mttr) })}</span><Link className="link" to="/backoffice/assets/downtime">{tx('Downtime')}</Link></div>
            <div className="table-wrap">
              <table className="bo-table">
                <thead><tr><th scope="col" className="w-ref">{tx('เลขที่')}</th><th scope="col" className="w-at">{tx('ช่วง')}</th><th scope="col">{tx('อาการ / การแก้ไข')}</th><th scope="col" className="w-amount num">{tx('ชั่วโมง')}</th></tr></thead>
                <tbody>
                  {downtime.map(x => (
                    <tr key={x.id} className="static">
                      <td>{x.id}<div className="secondary">{tx(DOWNTIME_KIND[x.kind])}</div></td>
                      <td className="num">{x.from}<div className="secondary">{x.to ?? tx('ยังไม่ปิด')}</div></td>
                      <td>{tx(x.problem)}{x.fix && <div className="secondary">{tx(x.fix)}</div>}</td>
                      <td className={x.to ? 'num' : 'num text-danger'}>{hours(downtimeHours(x))}</td>
                    </tr>
                  ))}
                  {!downtime.length && <tr className="static"><td colSpan={4} className="empty">{tx('ไม่มีการขัดข้อง')}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel">
            <div className="filter-bar"><b>{tx('สัญญาบริการ')}</b><span className="grow"></span><Link className="link" to="/backoffice/assets/contracts">{tx('Service Contracts')}</Link></div>
            <div className="table-wrap">
              <table className="bo-table">
                <tbody>
                  {contracts.map(c => {
                    const st = contractState(c);
                    return (
                      <tr key={c.id} className="static"><td className="w-ref">{c.id}</td><td>{tx(c.vendor)}<div className="secondary">{tx(CONTRACT_KIND[c.kind].label)} · {tx(c.contact)}</div></td><td className="w-due num">{c.to}</td><td className="w-status"><span className={`chip ${CONTRACT_STATE[st].cls}`}>{tx(CONTRACT_STATE[st].label)}</span></td></tr>
                    );
                  })}
                  {!contracts.length && <tr className="static"><td className="empty">{tx('ไม่มีสัญญาบริการ')}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <aside className="record-rail">
          {e.status !== 'decommissioned' && (
            <div className="panel actions">
              <b>{tx('ความพร้อม')} <span className={`chip ${READINESS[r.state].cls}`}>{tx(READINESS[r.state].label)}</span></b>
              <ul className="checks">{r.reasons.length ? r.reasons.map(x => <li key={x}>{tx(x)}</li>) : <li className="ok-text">{tx('ไม่มีรายการค้าง')}</li>}</ul>
              {decommission && <Link className="link" to="/backoffice/assets/decommission">{decommission.id} · {tx('มีคำขอเลิกใช้')}</Link>}
            </div>
          )}
          <div className="panel summary">
            <div className="sum-row"><span>{tx('ที่ตั้ง')}</span><b>{tx(e.location)}</b></div>
            <div className="sum-row"><span>{tx('เตียง (M10)')}</span><b>{e.bed ?? '—'}</b></div>
            {occupant && <p className="notice info">{tx('มีสัตว์ป่วยที่เตียง: {pet}', { pet: occupant })}</p>}
            <div className="sum-row"><span>{tx('ความสำคัญ')}</span><span className={`chip ${CRITICALITY[e.criticality].cls}`}>{tx(CRITICALITY[e.criticality].label)}</span></div>
            <div className="sum-row"><span>{tx('ความพร้อมใช้ 12 เดือน')}</span><b>{(rel.availability * 100).toFixed(1)}%</b></div>
            <div className="sum-row"><span>{tx('ขัดข้อง 12 เดือน')}</span><b>{rel.failures}</b></div>
          </div>
          <div className="panel summary">
            <b>{tx('ต้นทุน')}</b>
            <div className="sum-row"><span>{tx('ราคาซื้อ')} · {e.purchasedAt}</span><b>{baht(cost.purchase)}</b></div>
            <div className="sum-row"><span>{tx('ค่าบำรุงรักษาและซ่อม')}</span><b>{baht(cost.upkeep)}</b></div>
            <div className="sum-row"><span>{tx('รวม')}</span><b>{baht(cost.total)}</b></div>
            <p className="secondary">{tx('ข้อมูลการดำเนินงานของ M22 ไม่ใช่ทะเบียนสินทรัพย์ ค่าเสื่อมราคาและการตัดจำหน่ายอยู่ในระบบบัญชี')}</p>
          </div>
        </aside>
      </div>

      <div className="panel">
        <div className="filter-bar"><b>{tx('ประวัติ')}</b><span className="secondary grow">{tx('จากบันทึกของ M22 · ล่าสุดก่อน')}</span></div>
        <div className="timeline">
          {history.map((h, i) => <div key={i} className="tl">{h[0]} · <b>{tx(h[2])}</b> · {tx(h[1])}{h[3] && <> — {tx(h[3])}</>}</div>)}
        </div>
      </div>
    </bo-equipment-detail>
  );
}
