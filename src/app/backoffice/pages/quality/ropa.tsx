/* RoPA and cross-border transfers: the processing activities as recorded, generated as a document, and where data leaves the country (GOV-RET-01 quality.ropa, M31 · GATED) */
import { UiButton } from '../../../user-management/ui';
import { backofficeActions } from '../../backoffice-actions';
import { useBackofficeStore } from '../../backoffice.store';
import { ropaStale } from '../../data/governance';
import { useBoI18n } from '../../i18n/bo-i18n';
import { PagerFoot } from '../../shared/pager';
import { usePager } from '../../shared/use-pager';
import { PageHead } from '../../shared/parts';

export function RopaComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const d = store.data;
  const last = d.ropaExports[0];
  /** The table's pages */
  const pager = usePager(d.ropa);

  return (
    <bo-ropa className="page">
      <PageHead heading="RoPA และการโอนข้อมูลข้ามประเทศ" source="GOV-RET-01 · M31 · บันทึกกิจกรรมการประมวลผลจาก ropa_record · สร้างเอกสารภายใน 5 นาที · การโอนข้ามประเทศจาก cross_border_assessment · สัญญาการออกแบบ (GATED)" freshness="ข้อมูล ณ วันนี้ 11:32">
        <UiButton size="sm" type="button" onClick={() => backofficeActions.generateRopa()}>{tx('สร้าง/ส่งออก RoPA')}</UiButton>
      </PageHead>
      <p className="notice warn">{tx('ระบบ PDPA (M31) ยังไม่พร้อม หน้านี้เป็นสัญญาการออกแบบ')}</p>

      <div className="panel">
        <div className="filter-bar"><b>{tx('กิจกรรมการประมวลผล')}</b><span className="secondary grow">{tx('{n} กิจกรรม · ทบทวนอย่างน้อยปีละครั้ง', { n: d.ropa.length })}</span>
          {last && <span className="secondary">{tx('สร้างล่าสุด {file} · {at} · {s} วินาที', { file: last.artifact, at: last.at, s: last.seconds })}</span>}</div>
        <div className="table-wrap">
          <table className="bo-table ropa">
            <thead><tr>
              <th scope="col">{tx('กิจกรรม')}</th>
              <th scope="col">{tx('ประเภทข้อมูล')}</th>
              <th scope="col" className="w-owner">{tx('ผู้รับข้อมูล')}</th>
              <th scope="col" className="w-owner">{tx('ระยะเก็บ')}</th>
              <th scope="col" className="w-due">{tx('ทบทวนล่าสุด')}</th>
            </tr></thead>
            <tbody>
              {pager.rows.map(r => (
                <tr key={r.id} className="static">
                  <td><b>{tx(r.activity)}</b><div className="secondary">{r.id} · {tx(r.purpose)} · {tx('ฐาน: {b}', { b: tx(r.basis) })}</div></td>
                  <td>{tx(r.dataKinds)}<div className="secondary">{tx(r.subjects)}</div></td>
                  <td>{tx(r.recipients)}{r.crossBorder && <div className="secondary">{tx('ข้ามประเทศ {id}', { id: r.crossBorder })}</div>}</td>
                  <td>{tx(r.retention)}</td>
                  <td className="num">{r.reviewedAt}{ropaStale(r.reviewedAt) && <div className="secondary text-danger">{tx('เกิน 1 ปี ต้องทบทวน')}</div>}<div className="secondary">{tx(r.owner)}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PagerFoot pager={pager} />
      </div>

      <div className="panel">
        <div className="filter-bar"><b>{tx('การโอนข้อมูลข้ามประเทศ')}</b><span className="secondary grow">{tx('ไม่เดาความเพียงพอของประเทศปลายทาง ใช้ผลประเมินที่บันทึกไว้เท่านั้น')}</span></div>
        <div className="table-wrap">
          <table className="bo-table">
            <thead><tr>
              <th scope="col" className="w-ref">{tx('เลขที่')}</th>
              <th scope="col">{tx('ปลายทาง')}</th>
              <th scope="col">{tx('ข้อมูลที่โอน')}</th>
              <th scope="col">{tx('มาตรการคุ้มครอง')}</th>
              <th scope="col" className="w-status">{tx('การประเมิน')}</th>
            </tr></thead>
            <tbody>
              {d.crossBorder.map(c => (
                <tr key={c.id} className="static">
                  <td><b>{c.id}</b></td>
                  <td>{tx(c.destination)}<div className="secondary">{c.vendor}</div></td>
                  <td>{tx(c.data)}</td>
                  <td>{tx(c.safeguard)}</td>
                  <td><span className={`chip ${c.status === 'assessed' ? 'ok' : 'warn'}`}>{tx(c.status === 'assessed' ? 'ประเมินแล้ว' : 'รอประเมิน')}</span>{c.assessedAt && <div className="secondary">{c.assessedAt}</div>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </bo-ropa>
  );
}
