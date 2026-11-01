/* One person: licenses, CE, privileges and shifts in one place, with the IAM account linked and not owned (workforce.staff detail, M24/M14) */
import { Link, useParams } from 'react-router';

import { TODAY } from '../../../clinic/data/model';
import { lucideArrowLeft, lucideExternalLink } from '../../../icons';
import { NgIcon, UiButton } from '../../../user-management/ui';
import { backofficeActions } from '../../backoffice-actions';
import { useBackofficeStore } from '../../backoffice.store';
import type { LeaveType } from '../../data/types';
import {
  addDays, CE_STATUS, ceSummary, EMPLOYMENT, LEAVE_STATUS, LEAVE_TYPE, leaveTaken, LICENSE_KIND, LICENSE_STATE, licensesOf, licenseState, PRIVILEGE, PRIVILEGE_CELL, privilegeCell, PRIVILEGES,
  ROLE, SHIFT, STAFF_STATUS, staffOf, weekday, weekOf,
} from '../../data/workforce';
import { useBoI18n } from '../../i18n/bo-i18n';

const FROM = weekOf(TODAY);
const TO = addDays(FROM, 13);

export function StaffDetailComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const { id = '' } = useParams();
  const d = store.data;
  const m = staffOf(d, id);
  if (!m) {
    return (
      <bo-staff-detail className="page">
        <div className="panel prompt">{tx('ไม่พบบุคลากรนี้')}<div className="secondary"><Link className="link" to="/backoffice/workforce/staff">{tx('บุคลากรทั้งหมด')}</Link></div></div>
      </bo-staff-detail>
    );
  }
  const licenses = licensesOf(d, id);
  const privileges = PRIVILEGES.map(key => ({ key, cell: privilegeCell(d, id, key) })).filter(p => ['granted', 'at-risk', 'lapsed'].includes(p.cell));
  const shifts = d.shifts.filter(s => s.staffId === id && FROM <= s.date && s.date <= TO).sort((a, b) => a.date.localeCompare(b.date) || SHIFT[a.kind].start - SHIFT[b.kind].start);
  const ce = ceSummary(d).find(r => r.staff.id === id) ?? null;
  const ceRecords = d.ce.filter(c => c.staffId === id && c.date.startsWith(TODAY.slice(0, 4)));
  const leaves = d.leaves.filter(l => l.staffId === id);
  const taken = Object.entries(leaveTaken(d, id)) as [LeaveType, number][];
  // What M24 recorded about the person: the license steps and the back office's own log, newest first
  const fromLicenses = licenses.flatMap(l => l.history.map(h => [h[0], h[1], `${h[2]} · ${l.number}`, h[3]] as [string, string, string, string]));
  const fromLog = d.activity.filter(a => a.module === 'M24' && (a.ref === m.name || a.ref.startsWith(`${m.name} ·`) || a.target === m.id) && !/ใบอนุญาต/.test(a.action))
    .map(a => [a.at, a.by, a.action, a.detail ?? ''] as [string, string, string, string]);
  const fromPrivileges = d.privilegeLog.filter(c => c.staffId === m.id).map(c => [c.at, c.by, `${c.action === 'grant' ? 'ให้สิทธิ์' : 'ถอนสิทธิ์'} · ${PRIVILEGE[c.privilege].label}`, c.reason] as [string, string, string, string]);
  const history = [...fromLicenses, ...fromPrivileges, ...fromLog.filter(a => !/สิทธิ์วิชาชีพ/.test(a[2]))].sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <bo-staff-detail className="page">
      <div className="page-head">
        <div className="title-block">
          <Link className="link back" to="/backoffice/workforce/staff"><NgIcon svg={lucideArrowLeft} aria-hidden="true" />{tx('บุคลากรทั้งหมด')}</Link>
          <h1>{tx(m.name)} <span className={`chip ${STAFF_STATUS[m.status].cls}`}>{tx(STAFF_STATUS[m.status].label)}</span></h1>
          <div className="subtitle">
            <span>{`${m.id} · ${tx(m.position)} · ${tx(m.department)} · ${tx(ROLE[m.role].label)}`}</span>
            <span className="freshness">{tx('ข้อมูล ณ วันนี้ 11:32')}</span>
          </div>
        </div>
        <div className="page-actions"><UiButton variant="secondary" size="sm" type="button" onClick={() => backofficeActions.editStaff(m)}>{tx('แก้ไขข้อมูล')}</UiButton></div>
      </div>

      <div className="record">
        <div className="record-main">
          <div className="panel">
            <div className="filter-bar"><b>{tx('ใบอนุญาต')}</b><span className="secondary grow">{tx('ตรวจสอบและต่ออายุที่หน้าใบอนุญาต')}</span><Link className="link" to="/backoffice/workforce/credentials">{tx('ใบอนุญาตและ Credential')}</Link></div>
            <div className="table-wrap">
              <table className="bo-table">
                <thead><tr><th scope="col">{tx('ชนิด')}</th><th scope="col" className="w-ref">{tx('เลขที่')}</th><th scope="col" className="w-due">{tx('หมดอายุ')}</th><th scope="col" className="w-status">{tx('สถานะ')}</th></tr></thead>
                <tbody>
                  {licenses.map(l => {
                    const st = licenseState(l);
                    return (
                      <tr key={l.id} className="static">
                        <td>{tx(LICENSE_KIND[l.kind].label)}<div className="secondary">{tx(l.issuer)}</div></td>
                        <td>{l.number}</td>
                        <td className="num">{l.expiresAt}</td>
                        <td><span className={`chip ${LICENSE_STATE[st].cls}`}>{tx(LICENSE_STATE[st].label)}</span></td>
                      </tr>
                    );
                  })}
                  {!licenses.length && <tr className="static"><td colSpan={4} className="empty">{tx('ตำแหน่งนี้ไม่ต้องมีใบอนุญาต')}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel">
            <div className="filter-bar"><b>{tx('สิทธิ์วิชาชีพ')}</b><span className="secondary grow">{tx('ตามขอบเขตที่โรงพยาบาลกำหนด · ไม่ใช่บทบาทในระบบ')}</span><Link className="link" to="/backoffice/workforce/privileges">{tx('Scope และ Privilege')}</Link></div>
            <div className="chips-row">
              {privileges.map(p => <span key={p.key} className={`chip ${PRIVILEGE_CELL[p.cell].cls}`} title={tx(PRIVILEGE_CELL[p.cell].label)}>{PRIVILEGE_CELL[p.cell].mark} {tx(PRIVILEGE[p.key].label)}</span>)}
              {!privileges.length && <span className="secondary">{tx('ยังไม่มีสิทธิ์วิชาชีพ')}</span>}
            </div>
          </div>

          <div className="panel">
            <div className="filter-bar"><b>{tx('เวรสองสัปดาห์')}</b><span className="secondary grow">{FROM} – {TO}</span><Link className="link" to="/backoffice/workforce/schedule">{tx('ตารางเวร')}</Link></div>
            <div className="table-wrap">
              <table className="bo-table">
                <thead><tr><th scope="col" className="w-at">{tx('วันที่')}</th><th scope="col">{tx('เวร')}</th><th scope="col" className="w-kind">{tx('จุดงาน')}</th><th scope="col" className="w-status">{tx('สถานะ')}</th></tr></thead>
                <tbody>
                  {shifts.map(s => (
                    <tr key={s.id} className="static">
                      <td>{`${s.date} · ${tx(weekday(s.date))}`}</td>
                      <td><span className={`shift ${s.kind}`}>{tx(SHIFT[s.kind].label)}</span> {SHIFT[s.kind].time}</td>
                      <td>{s.area}</td>
                      <td><span className={`chip ${s.status === 'published' ? 'ok' : 'quiet'}`}>{tx(s.status === 'published' ? 'ประกาศแล้ว' : 'ฉบับร่าง')}</span></td>
                    </tr>
                  ))}
                  {!shifts.length && <tr className="static"><td colSpan={4} className="empty">{tx('ไม่มีเวรในสองสัปดาห์นี้')}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {ce && (
            <div className="panel">
              <div className="filter-bar"><b>{tx('CE ปีนี้')}</b><span className="secondary grow">{tx('{a} / {b} ชม. · รอตรวจ {c} ชม.', { a: ce.approved, b: ce.target, c: ce.pending })}</span><Link className="link" to="/backoffice/workforce/education">{tx('Continuing Education')}</Link></div>
              <div className="table-wrap">
                <table className="bo-table">
                  <tbody>
                    {ceRecords.map(r => (
                      <tr key={r.id} className="static"><td className="w-due num">{r.date}</td><td>{tx(r.course)}<div className="secondary">{tx(r.provider)}</div></td><td className="w-amount num">{r.hours} {tx('ชม.')}</td><td className="w-status"><span className={`chip ${CE_STATUS[r.status].cls}`}>{tx(CE_STATUS[r.status].label)}</span></td></tr>
                    ))}
                    {!ceRecords.length && <tr className="static"><td className="empty">{tx('ยังไม่มีบันทึก CE ปีนี้')}</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <aside className="record-rail">
          <div className="panel summary">
            <div className="sum-row"><span>{tx('การจ้าง')}</span><b>{tx(EMPLOYMENT[m.employment])}</b></div>
            <div className="sum-row"><span>{tx('ชั่วโมงตามสัญญา')}</span><b>{tx('{n} ชม./สัปดาห์', { n: m.weeklyHours })}</b></div>
            <div className="sum-row"><span>{tx('เริ่มงาน')}</span><b>{m.startedAt}</b></div>
            <div className="sum-row"><span>{tx('โทรศัพท์')}</span><b>{m.phone}</b></div>
            {taken.map(t => <div key={t[0]} className="sum-row"><span>{tx(LEAVE_TYPE[t[0]])} {tx('ปีนี้')}</span><b>{tx('{n} วัน', { n: t[1] })}</b></div>)}
          </div>
          <div className="panel actions">
            <b>{tx('บัญชีผู้ใช้ (IAM)')}</b>
            {m.iamUser ? <>
              <span>{m.iamUser}</span>
              <Link className="link" to="/users"><NgIcon svg={lucideExternalLink} aria-hidden="true" />{tx('เปิดใน IAM')}</Link>
            </> : <span className="secondary">{tx('ยังไม่เชื่อมบัญชีผู้ใช้')}</span>}
            <p className="secondary">{tx('ทะเบียนบุคลากรไม่ใช่บัญชีผู้ใช้ — การเข้าระบบ บทบาท และสิทธิ์ในระบบจัดการที่ M14 · ตารางเวรไม่ให้บทบาทใด ๆ')}</p>
          </div>
          {leaves.length > 0 && (
            <div className="panel actions">
              <b>{tx('การลา')}</b>
              {leaves.map(l => <div key={l.id} className="sum-row"><span>{tx(LEAVE_TYPE[l.type])} {l.from}–{l.to}</span><span className={`chip ${LEAVE_STATUS[l.status].cls}`}>{tx(LEAVE_STATUS[l.status].label)}</span></div>)}
            </div>
          )}
        </aside>
      </div>

      <div className="panel">
        <div className="filter-bar"><b>{tx('ประวัติ')}</b><span className="secondary grow">{tx('จากบันทึกของ M24 · ล่าสุดก่อน')}</span></div>
        <div className="timeline">
          {history.map((h, i) => <div key={i} className="tl">{h[0]} · <b>{tx(h[2])}</b> · {tx(h[1])}{h[3] && <> — {tx(h[3])}</>}</div>)}
          {!history.length && <p className="muted">{tx('ยังไม่มีประวัติ')}</p>}
        </div>
      </div>
    </bo-staff-detail>
  );
}
