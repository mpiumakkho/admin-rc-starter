/* Scope and clinical privileges: the hospital's own matrix, each grant resting on a usable license, changed with a reason by someone else (workforce.privileges, M24 P2) */
import { Fragment, useState } from 'react';

import { cx } from '../../../user-management/ui';
import { backofficeActions } from '../../backoffice-actions';
import { useBackofficeStore } from '../../backoffice.store';
import type { Privilege, StaffRole } from '../../data/types';
import { LICENSE_KIND, PRIVILEGE, PRIVILEGE_CELL, privilegeCell, privilegeGaps, PRIVILEGES, ROLE, staffOf, type PrivilegeCell } from '../../data/workforce';
import { useBoI18n } from '../../i18n/bo-i18n';
import { PageHead } from '../../shared/parts';

const CLINICAL: StaffRole[] = ['vet', 'nurse', 'pharmacist'];
const LEGEND: PrivilegeCell[] = ['granted', 'at-risk', 'lapsed', 'none'];

export function PrivilegesComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const [role, setRole] = useState<StaffRole | ''>('');
  const d = store.data;
  const people = d.staff.filter(s => CLINICAL.includes(s.role) && s.status !== 'inactive' && (!role || s.role === role));
  /** What the cell rests on, or what it lacks */
  const hint = (staffId: string, p: Privilege, c: PrivilegeCell) =>
    c === 'lapsed' || c === 'none' ? privilegeGaps(d, staffId, p)[0] ?? PRIVILEGE_CELL[c].label : PRIVILEGE_CELL[c].label;
  const roleList = (p: Privilege) => PRIVILEGE[p].roles.map(r => tx(ROLE[r].label)).join(', ');
  const needs = (p: Privilege) => (PRIVILEGE[p].needs.length ? PRIVILEGE[p].needs.map(k => tx(LICENSE_KIND[k].label)).join(' + ') : tx('ตามขอบเขตที่โรงพยาบาลกำหนด'));

  return (
    <bo-privileges className="page">
      <PageHead heading="ขอบเขตและสิทธิ์วิชาชีพ" source="M24 P2 · ขอบเขตที่โรงพยาบาลกำหนดเอง (ไทยไม่มีระบบรับรองพยาบาลสัตว์) · สิทธิ์อิงใบอนุญาตที่ตรวจสอบแล้ว · ไม่ใช่บทบาทใน IAM และตารางเวรไม่ให้สิทธิ์ · ต้นแบบก่อนสัญญาหน้าของ M24 (GATED)" freshness="ข้อมูล ณ วันนี้ 11:32" />

      <div className="record ledger">
        <div className="record-main">
          <div className="panel">
            <div className="filter-bar">
              <div className="segmented" role="group" aria-label={tx('บทบาท')}>
                <button type="button" className={cx(!role && 'active')} aria-pressed={!role} onClick={() => setRole('')}>{tx('ทั้งหมด')}</button>
                {CLINICAL.map(r => <button key={r} type="button" className={cx(role === r && 'active')} aria-pressed={role === r} onClick={() => setRole(r)}>{tx(ROLE[r].label)}</button>)}
              </div>
              <span className="secondary grow">{tx('กดช่องเพื่อให้หรือถอนสิทธิ์ · ต้องมีเหตุผล · เปลี่ยนสิทธิ์ของตัวเองไม่ได้')}</span>
            </div>
            <div className="table-wrap">
              <table className="bo-table matrix">
                <thead>
                  <tr>
                    <th scope="col">{tx('ชื่อบุคลากร')}</th>
                    {PRIVILEGES.map(p => <th key={p} scope="col" className="priv-col">{tx(PRIVILEGE[p].label)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {people.map(s => (
                    <tr key={s.id} className="static">
                      <th scope="row"><b>{tx(s.name)}</b><div className="secondary">{tx(ROLE[s.role].label)}</div></th>
                      {PRIVILEGES.map(p => {
                        const c = privilegeCell(d, s.id, p);
                        return (
                          <td key={p} className="priv-col">
                            {c !== 'n/a' && (
                              <button type="button" className={`priv ${PRIVILEGE_CELL[c].cls}`} aria-label={`${tx(s.name)} · ${tx(PRIVILEGE[p].label)}: ${tx(PRIVILEGE_CELL[c].label)}`} title={tx(hint(s.id, p, c))}
                                onClick={() => backofficeActions.changePrivilege(s.id, p)}>{PRIVILEGE_CELL[c].mark}</button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="legend">
              {LEGEND.map(l => <span key={l}><span className={`priv ${PRIVILEGE_CELL[l].cls}`} aria-hidden="true">{PRIVILEGE_CELL[l].mark}</span>{tx(PRIVILEGE_CELL[l].label)}</span>)}
            </div>
          </div>

          <div className="panel">
            <div className="filter-bar"><b>{tx('สิทธิ์อิงอะไร')}</b><span className="secondary grow">{tx('ใบอนุญาตต้องตรวจสอบแล้วและยังไม่หมดอายุ · ใบอนุญาตใช้ไม่ได้ สิทธิ์ถูกระงับโดยผลโดยไม่ต้องถอน')}</span></div>
            <dl className="data-grid wide">
              {PRIVILEGES.map(p => <Fragment key={p}><dt>{tx(PRIVILEGE[p].label)}</dt><dd>{roleList(p)} · {needs(p)}</dd></Fragment>)}
            </dl>
          </div>
        </div>

        <aside className="record-rail">
          <div className="panel actions">
            <b>{tx('ประวัติการเปลี่ยนสิทธิ์')}</b>
            <div className="timeline compact">
              {d.privilegeLog.map(c => (
                <div key={c.id} className="tl">
                  <span className={`chip ${c.action === 'grant' ? 'ok' : 'danger'}`}>{tx(c.action === 'grant' ? 'ให้สิทธิ์' : 'ถอนสิทธิ์')}</span>
                  <b>{tx(staffOf(d, c.staffId)?.name ?? c.staffId)}</b> · {tx(PRIVILEGE[c.privilege].label)}
                  <div className="secondary">{`${c.at} · ${tx(c.by)} — ${tx(c.reason)}`}</div>
                </div>
              ))}
            </div>
            <p className="secondary">{tx('บันทึกต่อท้ายเท่านั้น · ผู้มีอำนาจตาม M24 เป็นผู้เปลี่ยน · สิทธิ์ในระบบ (สั่งยา บันทึก) ยังต้องมีบทบาทที่ IAM ให้')}</p>
          </div>
        </aside>
      </div>
    </bo-privileges>
  );
}
