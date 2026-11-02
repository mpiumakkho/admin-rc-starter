/* Alerts and exceptions: what went wrong across the modules, acknowledged here and settled in the owning workflow (ux/menus/01-home.md) */
import { useState } from 'react';

import { lucideArrowUpRight, lucideCheck } from '../../../icons';
import { cx, NgIcon, UiButton, UiLinkButton } from '../../../user-management/ui';
import { backofficeActions } from '../../backoffice-actions';
import { useBackofficeStore } from '../../backoffice.store';
import { EXCEPTION_KIND, exceptionGroups, SEVERITY, severityCounts } from '../../data/home';
import type { BoException, Severity } from '../../data/types';
import { useBoI18n } from '../../i18n/bo-i18n';
import { ModuleTag, PageHead } from '../../shared/parts';
import { PagerFoot } from '../../shared/pager';
import { usePager } from '../../shared/use-pager';

const SEVERITY_KEYS = Object.keys(SEVERITY) as Severity[];

export function AlertsComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const [severity, setSeverity] = useState<Severity | ''>('');

  const exceptions = store.data.exceptions;
  const counts = severityCounts(exceptions);
  const groups = exceptionGroups(exceptions.filter(x => !severity || x.severity === severity));
  const acknowledged: BoException[] = exceptions.filter(x => !!x.acknowledgedAt).sort((a, b) => b.acknowledgedAt!.localeCompare(a.acknowledgedAt!));
  const severityChip = (x: BoException) => <span className={`chip ${SEVERITY[x.severity].cls}`}>{tx(SEVERITY[x.severity].label)}</span>;

  /** The table's pages */
  const pager = usePager(acknowledged);
  return (
    <bo-alerts className="page">
      <PageHead heading="การแจ้งเตือนและข้อยกเว้น" source="การชำระ/ส่งออกไม่สำเร็จ สต็อกต่ำ ใกล้หมดอายุ ใบอนุญาต อุปกรณ์เสีย และความเสี่ยง SLA · รับทราบที่นี่ แก้ไขที่โมดูลเจ้าของ" freshness="ข้อมูล ณ วันนี้ 11:32" />

      <div className="kpi-strip" role="list">
        {SEVERITY_KEYS.map(s => (
          <button key={s} type="button" className={cx('kpi', SEVERITY[s].cls, severity === s && 'active')} role="listitem" onClick={() => setSeverity(severity === s ? '' : s)}>
            <span className="kpi-value">{counts[s]}</span><span className="kpi-label">{tx(SEVERITY[s].label)}</span>
          </button>
        ))}
        <div className="kpi" role="listitem"><span className="kpi-value">{acknowledged.length}</span><span className="kpi-label">{tx('รับทราบแล้ว')}</span></div>
      </div>

      <div className="panel groups">
        {groups.map(group => (
          <section key={group.kind} className="group" aria-label={tx(EXCEPTION_KIND[group.kind])}>
            <div className="section-title"><h2>{tx(EXCEPTION_KIND[group.kind])}<span className="count">{group.list.length}</span></h2></div>
            <div className="table-wrap">
              <table className="bo-table alerts">
                <thead>
                  <tr>
                    <th scope="col" className="w-priority">{tx('ระดับ')}</th>
                    <th scope="col">{tx('ข้อยกเว้น')}</th>
                    <th scope="col" className="w-at">{tx('เมื่อ')}</th>
                    <th scope="col" className="w-owner">{tx('จัดการใน')}</th>
                    <th scope="col" className="w-actions"><span className="visually-hidden">{tx('การทำงาน')}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {group.list.map(x => (
                    <tr key={x.id} className="static">
                      <td>{severityChip(x)}</td>
                      <td><b>{tx(x.title)}</b><div className="secondary">{tx(x.detail)}</div><div className="secondary"><ModuleTag code={x.module} />{` · ${x.ref}`}</div></td>
                      <td className="num">{x.at}</td>
                      <td>{tx(x.source)}</td>
                      <td className="row-actions">
                        {x.link && <UiLinkButton variant="secondary" size="sm" to={x.link}>{tx('เปิด workflow')}<NgIcon svg={lucideArrowUpRight} aria-hidden="true" /></UiLinkButton>}
                        <UiButton size="sm" type="button" onClick={() => backofficeActions.acknowledge(x)}><NgIcon svg={lucideCheck} aria-hidden="true" />{tx('รับทราบ')}</UiButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
        {!groups.length && <p className="empty">{tx('ไม่มีข้อยกเว้นที่ยังไม่รับทราบ')}</p>}

        {acknowledged.length > 0 && (
          <details className="group">
            <summary><h2>{tx('รับทราบแล้ว')}<span className="count">{acknowledged.length}</span></h2></summary>
            <div className="table-wrap">
              <table className="bo-table alerts">
                <thead>
                  <tr>
                    <th scope="col" className="w-priority">{tx('ระดับ')}</th>
                    <th scope="col">{tx('ข้อยกเว้น')}</th>
                    <th scope="col" className="w-at">{tx('รับทราบเมื่อ')}</th>
                    <th scope="col">{tx('สิ่งที่ทำ')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pager.rows.map(x => (
                    <tr key={x.id} className="static">
                      <td>{severityChip(x)}</td>
                      <td><b>{tx(x.title)}</b><div className="secondary">{`${tx(EXCEPTION_KIND[x.kind])} · ${x.ref}`}</div></td>
                      <td className="num">{x.acknowledgedAt}<div className="secondary">{tx(x.acknowledgedBy ?? '')}</div></td>
                      <td>{x.note ? tx(x.note) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PagerFoot pager={pager} />
          </details>
        )}
      </div>
    </bo-alerts>
  );
}
