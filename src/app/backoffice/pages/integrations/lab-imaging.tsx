/* Lab and imaging connections: HL7 to the analyzers, DICOM to the PACS, each tied to its device in the asset register, and the message flow as metadata only (INT-LAB-01, M05 · GATED) */
import { Link } from 'react-router';

import { useBackofficeStore } from '../../backoffice.store';
import { HEALTH, LAB_CONNECTIONS, LAB_MESSAGES, labHealth, MESSAGE_STATUS } from '../../data/integrations';
import { useBoI18n } from '../../i18n/bo-i18n';
import { PageHead } from '../../shared/parts';

export function LabImagingComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const equipment = store.data.equipment;
  const connections = LAB_CONNECTIONS.map(c => ({
    ...c, health: labHealth(c, equipment),
    devices: c.equipment.map(id => ({ id, name: equipment.find(e => e.id === id)?.name ?? '' })),
  }));

  return (
    <bo-lab-imaging className="page">
      <PageHead heading="การเชื่อมต่อ Lab และ Imaging" source="INT-LAB-01 · M05 · HL7 OML/ORM และ DICOM MWL ผ่าน Mirth · Orthanc · งานแล็บในคลินิกอยู่ที่ M05 ไม่ใช่หน้านี้ · สัญญาการออกแบบ (GATED)" freshness="ข้อมูล ณ วันนี้ 11:32" />
      <p className="notice warn">{tx('การเชื่อมต่อ HL7/PACS ยังไม่อยู่ในระบบ (spec-gap) ข้อมูลด้านล่างเป็นตัวอย่าง ไม่มีการตั้งค่าหรือทดสอบจนกว่าสัญญาจะพร้อม')}</p>

      <div className="panel">
        <div className="filter-bar"><b>{tx('การเชื่อมต่อ')}</b><span className="secondary grow">{tx('ติดต่อไม่ได้เมื่ออุปกรณ์ขัดข้องในทะเบียนอุปกรณ์ · ทดสอบผ่านไม่ได้แปลว่าการจับคู่ข้อความถูกต้อง')}</span></div>
        <div className="table-wrap">
          <table className="bo-table lab-connections">
            <thead><tr>
              <th scope="col">Connector</th>
              <th scope="col" className="w-kind">{tx('ประเภท')}</th>
              <th scope="col" className="w-status">{tx('สถานะ')}</th>
              <th scope="col">{tx('อุปกรณ์')}</th>
              <th scope="col" className="w-kind">{tx('ชนิดข้อความ')}</th>
              <th scope="col" className="w-at">{tx('ข้อความล่าสุด')}</th>
            </tr></thead>
            <tbody>
              {connections.map(c => (
                <tr key={c.id} className="static">
                  <td><b>{c.name}</b><div className="secondary">{c.id}</div></td>
                  <td>{c.kind === 'HL7' ? 'HL7' : 'DICOM/PACS'}</td>
                  <td><span className={`chip ${HEALTH[c.health].cls}`}>{tx(HEALTH[c.health].label)}</span></td>
                  <td>{c.devices.map(e => <div key={e.id} className="device"><Link className="link" to={`/backoffice/assets/equipment/${e.id}`}>{e.id}</Link><span className="secondary">{tx(e.name)}</span></div>)}</td>
                  <td>{tx(c.flow)}</td>
                  <td className="num">{c.lastMessage ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="filter-bar"><b>{tx('การไหลของข้อความ')}</b><span className="secondary grow">{tx('แสดงเฉพาะข้อมูลกำกับและเลข accession ไม่แสดงข้อมูลผู้ป่วย')}</span></div>
        <div className="table-wrap">
          <table className="bo-table">
            <thead><tr>
              <th scope="col" className="w-at">{tx('เวลา')}</th>
              <th scope="col" className="w-kind">{tx('ทิศทาง')}</th>
              <th scope="col">{tx('ประเภท')}</th>
              <th scope="col" className="w-status">{tx('สถานะข้อความ')}</th>
              <th scope="col">{tx('ข้อผิดพลาด')}</th>
              <th scope="col" className="w-ref">Accession</th>
            </tr></thead>
            <tbody>
              {LAB_MESSAGES.map(m => (
                <tr key={m.at + m.ref} className="static">
                  <td className="num">{m.at}</td>
                  <td>{`${tx(m.direction === 'in' ? 'ขาเข้า' : 'ขาออก')} · ${m.connection}`}</td>
                  <td>{tx(m.type)}</td>
                  <td><span className={`chip ${MESSAGE_STATUS[m.status].cls}`}>{tx(MESSAGE_STATUS[m.status].label)}</span></td>
                  <td>{m.error ? <span className="text-danger">{tx(m.error)}</span> : <span className="secondary">—</span>}</td>
                  <td>{m.ref}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </bo-lab-imaging>
  );
}
