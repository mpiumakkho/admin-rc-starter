/* Insurance adapters: no contract yet, so no adapter, only what one needs and where claims are made by hand today (INT-INS-01, M16 P4 · HIDDEN/GATED) */
import { Link } from 'react-router';

import { useBackofficeStore } from '../../backoffice.store';
import { INSURANCE_PREREQS, payers } from '../../data/integrations';
import { useBoI18n } from '../../i18n/bo-i18n';
import { PageHead } from '../../shared/parts';

export function InsuranceAdaptersComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();

  return (
    <bo-insurance-adapters className="page">
      <PageHead heading="การเชื่อมต่อบริษัทประกัน" source="INT-INS-01 · M16 P4 · ไม่มี endpoint และไม่มีสัญญา adapter · การกระทบยอดประกันอยู่ที่การเงิน · สัญญาการออกแบบ (GATED)" freshness="ข้อมูล ณ วันนี้ 11:32" />
      <p className="notice warn">{tx('ยังไม่มีสัญญาการเชื่อมต่อประกัน หน้านี้ยังไม่เปิดใช้งาน ไม่มีการตั้งค่า ส่งเคลม หรือดู EOB')}</p>

      <div className="panel">
        <div className="filter-bar"><b>{tx('สิ่งที่ต้องมีก่อนเปิดใช้')}</b></div>
        <div className="table-wrap">
          <table className="bo-table">
            <thead><tr><th scope="col">{tx('ข้อกำหนด')}</th><th scope="col">{tx('เหตุผล')}</th><th scope="col" className="w-status">{tx('สถานะ')}</th></tr></thead>
            <tbody>
              {INSURANCE_PREREQS.map(p => (
                <tr key={p[0]} className="static"><td>{tx(p[0])}</td><td className="secondary">{tx(p[1])}</td><td><span className="chip quiet">{tx('ยังไม่มี')}</span></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="filter-bar"><b>{tx('เคลมที่ทำด้วยมือวันนี้')}</b><span className="secondary grow">{tx('ส่งเอกสารเองที่หน้าเคลมประกัน ไม่ผ่าน adapter')}</span></div>
        <div className="table-wrap">
          <table className="bo-table">
            <thead><tr><th scope="col">{tx('บริษัทประกัน')}</th><th scope="col" className="num">{tx('เคลมทั้งหมด')}</th><th scope="col" className="num">{tx('ยังไม่ปิด')}</th></tr></thead>
            <tbody>
              {payers(store.data).map(p => (
                <tr key={p.insurer} className="static"><td>{p.insurer}</td><td className="num">{p.claims}</td><td className="num">{p.open}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="secondary foot-note"><Link className="link" to="/backoffice/sales/claims">{tx('เปิดเคลมประกัน')}</Link></p>
      </div>
    </bo-insurance-adapters>
  );
}
