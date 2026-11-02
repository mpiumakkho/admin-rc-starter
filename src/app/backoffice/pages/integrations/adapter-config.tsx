/* The accounting adapter's settings, read from its typed schema step by step, with what a test can and cannot tell; saving, activating and rotating wait for their contracts (INT-ACC-01, GATED) */
import { Fragment, useState } from 'react';

import { cx, UiButton } from '../../../user-management/ui';
import { backofficeActions } from '../../backoffice-actions';
import { useBackofficeStore } from '../../backoffice.store';
import { ADAPTER, ADAPTER_TARGETS, CONFIG_STEPS, reviewChecklist } from '../../data/integrations';
import { useBoI18n } from '../../i18n/bo-i18n';
import { PageHead } from '../../shared/parts';

export function AdapterConfigComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const [step, setStep] = useState('adapter');
  const stepLabel = CONFIG_STEPS.find(s => s[0] === step)![1];
  const tests = store.data.adapterTests;
  const passedLabel = (passed: boolean) => tx(passed ? 'ผ่าน' : 'ยืนยันตัวตนไม่ผ่าน');
  const fields = (list: [string, string][]) => (
    <dl className="data-grid">{list.map(f => <Fragment key={f[0]}><dt>{tx(f[0])}</dt><dd>{tx(f[1])}</dd></Fragment>)}</dl>
  );

  return (
    <bo-adapter-config className="page">
      <PageHead heading="ตั้งค่า Accounting Adapter" source="INT-ACC-01 · M11 · ADR-0009 (Proposed) · ค่าจาก typed schema ของ adapter · ไม่มีการตั้งค่า e-Tax · สัญญาการออกแบบ (GATED)" freshness="ข้อมูล ณ วันนี้ 11:32" />
      <p className="notice warn">{tx('สัญญา config schema ข้อมูลลับ และการเปิดใช้ยังไม่อนุมัติ หน้านี้อ่านอย่างเดียว ยกเว้นการทดสอบการเชื่อมต่อ')}</p>

      <div className="segmented steps" role="group" aria-label={tx('ขั้นตอนการตั้งค่า')}>
        {CONFIG_STEPS.map(([key, label]) => <button key={key} type="button" className={cx(step === key && 'active')} aria-pressed={step === key} onClick={() => setStep(key)}>{tx(label)}</button>)}
      </div>

      <div className="split with-drawer">
        <section className="panel config-form" aria-label={tx(stepLabel)}>
          <div className="filter-bar"><b>{tx(stepLabel)}</b><span className="secondary grow">{tx('อ่านจาก {v}', { v: ADAPTER.contractVersion })}</span></div>
          {step === 'adapter' && <>
            <ul className="target-list">
              {ADAPTER_TARGETS.map(t => (
                <li key={t.key} className={cx(t.key === ADAPTER.target && 'current')}><b>{t.name}</b><span className="secondary">{tx(t.mode)}</span>{t.key === ADAPTER.target && <span className="chip info">{tx('ใช้งานอยู่')}</span>}</li>
              ))}
            </ul>
            <dl className="data-grid">
              <dt>{tx('สถานะ')}</dt><dd><span className="chip info">{tx('เปิดใช้งาน')}</span> {`${ADAPTER.activatedAt} · ${tx(ADAPTER.activatedBy)}`}</dd>
              <dt>{tx('เวอร์ชันสัญญา')}</dt><dd>{ADAPTER.contractVersion}</dd>
              <dt>{tx('ความสามารถ')}</dt>
              <dd>{ADAPTER.capabilities.map(c => <div key={c[0]}>{`${tx(c[1] ? 'มี' : 'ไม่มี')} · ${tx(c[0])}`}</div>)}</dd>
            </dl>
          </>}
          {step === 'connection' && <>
            <dl className="data-grid">
              {ADAPTER.connection.map(f => <Fragment key={f[0]}><dt>{tx(f[0])}</dt><dd>{tx(f[1])}</dd></Fragment>)}
              <dt>{tx('ข้อมูลลับ')}</dt>
              <dd><span className="chip quiet">{tx('ตั้งค่าข้อมูลลับแล้ว')}</span> {`${ADAPTER.credential.label} · ${ADAPTER.credential.fingerprint}`}
                <div className="secondary">{tx('เปลี่ยนล่าสุด {at} · {by}', { at: ADAPTER.credential.rotatedAt, by: tx(ADAPTER.credential.rotatedBy) })}</div></dd>
            </dl>
            <p className="secondary foot-note">{tx('ไม่แสดงหรือคัดลอกค่าข้อมูลลับหลังบันทึก · ไม่มีใบรับรอง e-Tax หรือข้อมูลกรมสรรพากรใน SEPH-1')}</p>
          </>}
          {step === 'mapping' && <>
            <div className="table-wrap">
              <table className="bo-table">
                <thead><tr><th scope="col">{tx('ใน SEPH-1')}</th><th scope="col">{tx('ใน PEAK')}</th></tr></thead>
                <tbody>{ADAPTER.mapping.map(m => <tr key={m[0]} className="static"><td>{tx(m[0])}</td><td>{tx(m[1])}</td></tr>)}</tbody>
              </table>
            </div>
            <p className="secondary foot-note">{tx('การตรวจการจับคู่ข้อมูลแยกจากการตรวจการเชื่อมต่อ · {v}', { v: ADAPTER.mappingVersion })}</p>
          </>}
          {step === 'retry' && <>
            {fields(ADAPTER.retry)}
            <p className="secondary foot-note">{tx('ค่าจาก delivery contract · การส่งใหม่ใช้ idempotency key เดิม')}</p>
          </>}
          {step === 'reconciliation' && fields(ADAPTER.reconciliation)}
          {step === 'review' && <>
            <ul className="checklist">
              {reviewChecklist(store.data).map(c => (
                <li key={c[0]}><span className={`chip ${c[1] ? 'ok' : 'danger'}`}>{tx(c[1] ? 'ผ่าน' : 'ยังไม่ผ่าน')}</span><b>{tx(c[0])}</b><span className="secondary">{tx(c[2])}</span></li>
              ))}
            </ul>
            <p className="secondary foot-note">{tx('ไม่มีการเปลี่ยนแปลงที่รอบันทึก')}</p>
          </>}
        </section>

        <aside className="panel config-rail" aria-label={tx('ผลกระทบและการตรวจสอบ')}>
          <h2 className="rail-title">{tx('ทดสอบการเชื่อมต่อ')}</h2>
          {tests[0] && <p><span className={`chip ${tests[0].result === 'passed' ? 'ok' : 'danger'}`}>{passedLabel(tests[0].result === 'passed')}</span> {tests[0].at}{tests[0].code && ` · ${tests[0].code}`}</p>}
          <p className="notice info">{tx('ผลนี้ยืนยันเฉพาะการเชื่อมต่อ')}</p>
          <UiButton size="sm" type="button" onClick={() => backofficeActions.testAdapter()}>{tx('ทดสอบการเชื่อมต่อ')}</UiButton>
          <ol className="test-log">
            {tests.slice(0, 5).map(t => (
              <li key={t.id}><b>{t.id}</b> {`${t.at} · ${passedLabel(t.result === 'passed')}`}{t.ms !== undefined && ` · ${t.ms} ms`}<div className="secondary">{tx(t.by)}</div></li>
            ))}
          </ol>
          <h2 className="rail-title">{tx('action ที่ยังไม่เปิด (GATED)')}</h2>
          <ul className="plain">{ADAPTER.gated.map(g => <li key={g}>{tx(g)}</li>)}</ul>
        </aside>
      </div>
    </bo-adapter-config>
  );
}
