/* The consent registry: coverage per purpose, every grant and withdrawal by owner, LINE's read from its link (GOV-CNS-01, M31 · GATED) */
import { useState } from 'react';

import { lucidePlus } from '../../../icons';
import { cx, NgIcon, UiButton } from '../../../user-management/ui';
import { backofficeActions } from '../../backoffice-actions';
import { useBackofficeStore } from '../../backoffice.store';
import { CONSENT_PURPOSE, CONSENT_STATUS, CONSENT_VERSION, consentLedger, coverage, PURPOSES, withdrawBlock } from '../../data/governance';
import type { ConsentGrant, ConsentPurpose } from '../../data/types';
import { useBoI18n } from '../../i18n/bo-i18n';
import { Drawer, PageHead } from '../../shared/parts';
import { PagerFoot } from '../../shared/pager';
import { usePager } from '../../shared/use-pager';

const CHANNELS = ['แบบฟอร์มที่โรงพยาบาล', 'LINE', 'อีเมล'];
const OWN_PURPOSES: ('insurance' | 'case-study')[] = ['insurance', 'case-study'];
const STATUSES = Object.keys(CONSENT_STATUS) as ConsentGrant['status'][];

export function ConsentComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const [query, setQuery] = useState('');
  const [purpose, setPurpose] = useState<ConsentPurpose | ''>('');
  const [status, setStatus] = useState<ConsentGrant['status'] | ''>('');
  const [recording, setRecording] = useState(false);
  const [owner, setOwner] = useState('');
  const [own, setOwn] = useState<'insurance' | 'case-study'>('insurance');
  const [granted, setGranted] = useState(true);
  const [channel, setChannel] = useState(CHANNELS[0]);

  const d = store.data;
  const cover = coverage(d);
  const q = query.trim().toLowerCase();
  const rows = consentLedger(d).filter(g => (!q || g.ownerKey.toLowerCase().includes(q)) && (!purpose || g.purpose === purpose) && (!status || g.status === status));
  const owners = Object.keys(store.clinic.data.owners).sort();
  const record = () => backofficeActions.recordConsent(owner, own, granted, channel, () => { setRecording(false); setOwner(''); });

  /** The table's pages */
  const pager = usePager(rows);
  return (
    <bo-consent className="page">
      <PageHead heading="ทะเบียนความยินยอม" source="GOV-CNS-01 · M31 · consent_grant ต่อเจ้าของและวัตถุประสงค์ · ความยินยอมของ LINE อ่านจาก LINE CRM (M15) · แก้แบบฟอร์มที่ settings/10 · สัญญาการออกแบบ (GATED)" freshness="ข้อมูล ณ วันนี้ 11:32">
        <UiButton size="sm" type="button" onClick={() => setRecording(true)}><NgIcon svg={lucidePlus} aria-hidden="true" />{tx('บันทึกความยินยอม')}</UiButton>
      </PageHead>
      <p className="notice warn">{tx('ระบบ PDPA (M31) ยังไม่พร้อม ความครอบคลุมนับจากข้อมูลตัวอย่างในเครื่อง ไม่ใช่ /consent/summary')}</p>

      <div className="panel">
        <div className="filter-bar"><b>{tx('ความครอบคลุมตามวัตถุประสงค์')}</b><span className="secondary grow">{tx('แบบฟอร์มฉบับใช้งาน {v}', { v: CONSENT_VERSION })}</span></div>
        <div className="table-wrap">
          <table className="bo-table coverage">
            <thead><tr>
              <th scope="col">{tx('วัตถุประสงค์')}</th>
              <th scope="col" className="num w-kind">{tx('ให้ความยินยอม')}</th>
              <th scope="col" className="num w-kind">{tx('ทั้งหมด')}</th>
              <th scope="col" className="w-owner">{tx('ความครอบคลุม')}</th>
              <th scope="col" className="w-kind">{tx('บังคับ')}</th>
              <th scope="col" className="w-kind">{tx('เวอร์ชัน')}</th>
            </tr></thead>
            <tbody>
              {cover.map(c => (
                <tr key={c.purpose} className="static">
                  <td>{tx(CONSENT_PURPOSE[c.purpose].label)}<div className="secondary">{tx(CONSENT_PURPOSE[c.purpose].source)}{c.withdrawn > 0 && <> · {tx('ถอนแล้ว {n}', { n: c.withdrawn })}</>}</div></td>
                  <td className="num">{c.granted}</td>
                  <td className="num">{c.total}</td>
                  <td><div className="sum-row"><b>{c.percent}%</b></div><div className="bar" role="img" aria-label={`${c.percent}%`}><span style={{ width: `${c.percent}%` }}></span></div></td>
                  <td>{tx(CONSENT_PURPOSE[c.purpose].required ? 'บังคับเมื่อเชื่อม LINE' : 'ไม่บังคับ')}</td>
                  <td>{c.versions.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className={cx('split', recording && 'with-drawer')}>
        <div className="panel">
          <div className="filter-bar">
            <input className="ui-input search" type="search" aria-label={tx('ค้นหาเจ้าของ')} placeholder={tx('ค้นหาเจ้าของ')} value={query} onChange={event => setQuery(event.target.value)} />
            <select className="ui-input" aria-label={tx('วัตถุประสงค์')} value={purpose} onChange={event => setPurpose(event.target.value as ConsentPurpose | '')}>
              <option value="">{tx('ทุกวัตถุประสงค์')}</option>
              {PURPOSES.map(p => <option key={p} value={p}>{tx(CONSENT_PURPOSE[p].label)}</option>)}
            </select>
            <select className="ui-input" aria-label={tx('สถานะ')} value={status} onChange={event => setStatus(event.target.value as ConsentGrant['status'] | '')}>
              <option value="">{tx('ทุกสถานะ')}</option>
              {STATUSES.map(s => <option key={s} value={s}>{tx(CONSENT_STATUS[s].label)}</option>)}
            </select>
            <span className="secondary grow">{tx('{n} รายการ', { n: rows.length })}</span>
          </div>
          <div className="table-wrap">
            <table className="bo-table consents-ledger">
              <thead><tr>
                <th scope="col">{tx('เจ้าของข้อมูล')}</th>
                <th scope="col">{tx('วัตถุประสงค์')}</th>
                <th scope="col" className="w-status">{tx('สถานะ')}</th>
                <th scope="col" className="w-kind">{tx('เวอร์ชัน')}</th>
                <th scope="col" className="w-at">{tx('ให้เมื่อ / ถอนเมื่อ')}</th>
                <th scope="col" className="w-send"><span className="visually-hidden">{tx('การดำเนินการ')}</span></th>
              </tr></thead>
              <tbody>
                {pager.rows.map(g => (
                  <tr key={g.id} className="static">
                    <td><b>{g.ownerKey}</b><div className="secondary">{tx(g.channel)}</div></td>
                    <td>{tx(CONSENT_PURPOSE[g.purpose].label)}</td>
                    <td><span className={`chip ${CONSENT_STATUS[g.status].cls}`}>{tx(CONSENT_STATUS[g.status].label)}</span></td>
                    <td>{g.version}</td>
                    <td className="num">{g.withdrawnAt ?? g.at}</td>
                    <td>{g.status === 'granted' && !withdrawBlock(g) && <UiButton variant="secondary" size="sm" type="button" onClick={() => backofficeActions.withdrawConsent(g)}>{tx('ถอนความยินยอม')}</UiButton>}</td>
                  </tr>
                ))}
                {!rows.length && <tr className="static"><td colSpan={6} className="empty">{tx('ไม่มีความยินยอมที่ตรงกับตัวกรอง')}</td></tr>}
              </tbody>
            </table>
          </div>
          <PagerFoot pager={pager} />
        </div>

        {recording && (
          <Drawer heading="บันทึกความยินยอม" sub="ความยินยอมที่ M31 เก็บเอง · LINE บันทึกที่ LINE CRM" onClosed={() => setRecording(false)} foot={<>
            <UiButton variant="secondary" size="sm" type="button" onClick={() => setRecording(false)}>{tx('ยกเลิก')}</UiButton>
            <span className="grow"></span>
            <UiButton size="sm" type="button" disabled={!owner} onClick={record}>{tx('บันทึก')}</UiButton>
          </>}>
            <div className="form-grid">
              <label className="full">{tx('เจ้าของข้อมูล')}
                <select className="ui-input" value={owner} onChange={event => setOwner(event.target.value)}>
                  <option value="">{tx('เลือก')}</option>
                  {owners.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </label>
              <label className="full">{tx('วัตถุประสงค์')}
                <select className="ui-input" value={own} onChange={event => setOwn(event.target.value as 'insurance' | 'case-study')}>
                  {OWN_PURPOSES.map(p => <option key={p} value={p}>{tx(CONSENT_PURPOSE[p].label)}</option>)}
                </select>
              </label>
              <label>{tx('การตัดสินใจ')}
                <select className="ui-input" value={granted ? 'yes' : 'no'} onChange={event => setGranted(event.target.value === 'yes')}>
                  <option value="yes">{tx('ยินยอม')}</option>
                  <option value="no">{tx('ไม่ยินยอม')}</option>
                </select>
              </label>
              <label>{tx('ช่องทาง')}
                <select className="ui-input" value={channel} onChange={event => setChannel(event.target.value)}>
                  {CHANNELS.map(c => <option key={c} value={c}>{tx(c)}</option>)}
                </select>
              </label>
            </div>
          </Drawer>
        )}
      </div>
    </bo-consent>
  );
}
