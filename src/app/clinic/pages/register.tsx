import { useState } from 'react';
import { useNavigate } from 'react-router';

import {
  lucideArrowRight, lucideCheck, lucideCopy, lucidePawPrint, lucideSearch, lucideTrash2, lucideTriangleAlert, lucideUserRound, lucideX,
} from '../../icons';
import { session } from '../../user-management/access/session';
import { cx, NgIcon, UiButton, UiSegmented } from '../../user-management/ui';
import { clinicUi } from '../clinic-ui';
import { clinicStore, useClinicStore } from '../clinic.store';
import { REASON_MIN, TODAY } from '../data/model';
import {
  ADDRESS_TABS, type Address, type AddressKind, addressSummary, ageFromIso, BREEDS, draftFromOwner, draftFromRecord, emptyAddresses, findDuplicates,
  missingFields, OTHER_TITLE, ownerFullName, type PetRecord, PROVINCES, type RegistrationDraft, ROUTES, savedAddressKind, searchOwners, searchPets,
  type Sex, SPECIES, speciesLabel, TITLES,
} from '../data/registration';
import type { Owner, PetKind } from '../data/types';
import { useClinicI18n } from '../i18n/clinic-i18n';
import { registrationForm, useRegistrationForm } from '../registration-form';
import { PET_ICONS } from '../shared/icons';
import { PetIcon } from '../shared/parts';

/** A list that lost focus closes, once a click inside it has landed */
const closeLater = (clear: () => void) => () => setTimeout(() => {
  if (!document.activeElement?.closest('.reg-lookup, .reg-owner-find')) {
    clear();
  }
});

/**
 * Registering a pet and its owner at the front desk, as SEPH1's registration screen (seph1-fe, screens/Register.tsx):
 *
 *   title         who is on the form; an HN search that pulls a pet on file into it (read-only), and the page's actions
 *   two panels    the pet | its owner (one owner, many pets): an owner on file is picked from a search, else typed
 *   the address   on the owner's panel, current or registered; province and title are picked, not typed
 *   footer        what will be saved and what is missing, where the pet goes, then save, or save and send to the queue
 *
 * The same microchip, or the same Thai ID and pet name, is the same animal: no new record, only the way to the one on
 * file. The same name and kind with the same owner or phone asks first; only an administrator creates past that, with
 * a reason.
 */
export function RegisterComponent() {
  const store = useClinicStore();
  const { tx } = useClinicI18n();
  const navigate = useNavigate();
  const d = useRegistrationForm(state => state.draft);
  const r = useRegistrationForm(state => state.record);
  const route = useRegistrationForm(state => state.route);
  const block = useRegistrationForm(state => state.block);

  const [hnQuery, setHnQuery] = useState('');
  const [ownerQuery, setOwnerQuery] = useState('');
  /** Clearing an owner picked from the search takes two presses */
  const [clearArm, setClearArm] = useState(false);
  /** Text typed into the breed box that matches no breed yet */
  const [breedTyped, setBreedTyped] = useState<string | null>(null);
  /** "อื่นๆ" picked as the title, before anything is typed in its box */
  const [titleOther, setTitleOther] = useState(false);
  /** The address the fields show: current or registered */
  const [addressKind, setAddressKind] = useState<AddressKind>('current');

  const set = <K extends keyof RegistrationDraft>(key: K, value: RegistrationDraft[K]) => registrationForm.set(key, value);
  const hits = searchPets(store.data, hnQuery);
  const owners = searchOwners(store.data, ownerQuery);
  const fullName = ownerFullName(d);
  const breeds = BREEDS[d.kind];
  const breedText = breedTyped ?? d.breed;
  const breedUnmatched = !!breedTyped?.trim();
  const age = ageFromIso(d.dob);
  /** The title's pick: one of the list, "อื่นๆ" for anything else typed, or none */
  const title = d.title.trim();
  const titleChoice = TITLES.includes(title) ? title : title || titleOther ? OTHER_TITLE : '';
  const typedAddress = addressSummary(d.addresses);
  /** The address of an owner on file, while nothing new is typed over it */
  const onFileAddress = !typedAddress && d.ownerKey ? (store.data.owners[d.ownerKey]?.address ?? '').replace(/^—$/, '') : '';
  const savedKind = savedAddressKind(d.addresses);
  /** Something typed into the address, but not enough to save it */
  const addressIncomplete = !!typedAddress && !savedKind;
  const addressNote = !typedAddress
    ? 'บันทึกเมื่อกรอกตำบล อำเภอ จังหวัด และรหัสไปรษณีย์ครบ'
    : savedKind === 'current' ? 'จะบันทึกที่อยู่ปัจจุบัน' : savedKind === 'house' ? 'จะบันทึกที่อยู่ตามทะเบียนบ้าน' : 'ที่อยู่ยังไม่ครบ (ตำบล อำเภอ จังหวัด รหัสไปรษณีย์) จึงยังไม่บันทึก';
  const missing = missingFields(d);
  const ready = !missing.length;
  const missingText = missing.map(m => tx(m)).join(' · ');
  const idWarn = !!r && !d.thaiId.trim();
  const canQueue = r ? !r.patient : ready;
  const sexText = d.sex === 'm' ? '♂ ' + tx('ผู้') : d.sex === 'f' ? '♀ ' + tx('เมีย') : tx('ไม่ทราบเพศ');
  const identity = [d.breed || tx(speciesLabel(d.kind)), `${sexText} ${tx(d.neutered ? 'ทำหมันแล้ว' : 'ยังไม่ทำหมัน')}`, `${tx('เจ้าของ')} ${fullName || '—'}`].join(' · ');
  const sexes = [
    { value: 'm' as Sex, label: '♂ ' + tx('ผู้') },
    { value: 'f' as Sex, label: '♀ ' + tx('เมีย') },
    { value: 'u' as Sex, label: tx('ไม่ทราบ') },
  ];
  const neuters = [{ value: false, label: tx('ยังไม่ทำ') }, { value: true, label: tx('ทำแล้ว') }];
  const addressTabs = ADDRESS_TABS.map(t => ({ value: t.id, label: tx(t.label) }));

  const pickTitle = (value: string) => {
    setTitleOther(value === OTHER_TITLE);
    set('title', value === OTHER_TITLE ? '' : value);
  };

  const addr = (key: keyof Address) => d.addresses[addressKind][key];
  const writeAddr = (key: keyof Address, value: string) => registrationForm.setAddress(addressKind, key, value);

  const pickSpecies = (kind: PetKind) => {
    if (kind !== d.kind) {
      // A breed belongs to one kind
      registrationForm.setDraft({ ...d, kind, breed: '' });
      setBreedTyped(null);
    }
  };

  /** A breed is kept only when it is one of the catalogue's; anything else stays typed, and the form says it will not save */
  const typeBreed = (text: string) => {
    const match = breeds.find(b => b.toLowerCase() === text.trim().toLowerCase() || tx(b).toLowerCase() === text.trim().toLowerCase());
    set('breed', match ?? '');
    setBreedTyped(match ? null : text);
  };

  const ownerOf = (record: PetRecord) => {
    const o: Owner | undefined = store.data.owners[record.ownerKey];
    return o ? `${o.name} · ${o.phone}` : '—';
  };

  const load = (record: PetRecord) => {
    registrationForm.load(record, draftFromRecord(clinicStore.data, record));
    // A pet in today's clinic: the context rail follows it
    if (record.patient) {
      clinicStore.select(record.patient);
    }
    setHnQuery('');
    setBreedTyped(null);
    setClearArm(false);
    setTitleOther(false);
    setAddressKind('current');
  };

  /** The first hit, as the desk's "receive the file" */
  const receive = () => {
    if (hits[0]) {
      load(hits[0]);
    }
  };

  const pickOwner = (key: string, owner: Owner) => {
    registrationForm.setDraft(draftFromOwner(registrationForm.draft, key, owner));
    setOwnerQuery('');
    setTitleOther(false);
  };

  const clearOwner = () => {
    registrationForm.setDraft({ ...registrationForm.draft, ownerKey: null, title: '', first: '', last: '', phone: '', mobile: '', email: '', thaiId: '', addresses: emptyAddresses() });
    setClearArm(false);
    setTitleOther(false);
  };

  const reset = () => {
    registrationForm.reset();
    setHnQuery('');
    setOwnerQuery('');
    setBreedTyped(null);
    setClearArm(false);
    setTitleOther(false);
    setAddressKind('current');
  };

  const openPatient = () => {
    const p = r?.patient;
    if (p) {
      clinicStore.select(p);
      clinicUi.openSheet('patient', { tab: 'overview' });
    }
  };

  const queued = (pet: string, hn: string) => {
    clinicUi.toast('ส่ง {pet} เข้าคิวแล้ว · {hn}', { pet, hn });
    reset();
    void navigate('/clinic/queue');
  };

  const commit = (queue: boolean, forceReason?: string) => {
    const draft = registrationForm.draft;
    const result = clinicStore.register(draft, queue ? useRegistrationForm.getState().route : null, forceReason);
    if (result.patient) {
      queued(draft.pet.trim(), result.hn);
      return;
    }
    clinicUi.toast('ลงทะเบียน {pet} แล้ว · {code}', { pet: draft.pet.trim(), code: result.code });
    const record = searchPets(clinicStore.data, result.code)[0];
    if (record) {
      load(record);
    }
  };

  /** Save, or save and send to the queue; a pet on file only goes to the queue */
  const save = (queue: boolean) => {
    if (r) {
      if (queue && !r.patient) {
        const p = clinicStore.queuePet(r, route);
        queued(p.pet, p.hn);
      }
      return;
    }
    if (!ready) {
      return;
    }
    const found = findDuplicates(clinicStore.data, d);
    if (found.exact) {
      registrationForm.setBlock(found.exact);
      return;
    }
    registrationForm.setBlock(null);
    if (!found.probable.length) {
      commit(queue);
      return;
    }
    const facts = found.probable.map(c => [`${c.record.pet} · ${c.record.hn !== '—' ? c.record.hn : c.record.code}`, `${c.owner} · ${c.reasons.map(x => tx(x)).join(', ')}`] as [string, string]);
    if (session.view.can('settings.manage')) {
      clinicUi.ask({
        title: 'อาจเป็นข้อมูลซ้ำ — โปรดตรวจสอบ',
        intro: ['พบสัตว์ที่ข้อมูลคล้ายกันมาก อาจเป็นตัวเดียวกัน ตรวจสอบก่อนสร้างระเบียนใหม่'],
        facts,
        fields: [{
          name: 'reason', label: 'เหตุผลที่สร้างใหม่ (บันทึกไว้ในระเบียน)', type: 'input', placeholder: 'เช่น เป็นคนละตัวกัน ชื่อซ้ำกันโดยบังเอิญ',
          validate: v => (v.trim().length >= REASON_MIN ? null : `อย่างน้อย ${REASON_MIN} ตัวอักษร — ข้อความนี้คือหลักฐานตรวจสอบ`),
        }],
        tone: 'danger',
        confirmLabel: 'ยืนยันสร้างใหม่',
        onConfirm: values => commit(queue, values['reason'].trim()),
      });
    } else {
      clinicUi.ask({
        title: 'อาจเป็นข้อมูลซ้ำ — โปรดตรวจสอบ',
        intro: ['พบสัตว์ที่ข้อมูลคล้ายกันมาก อาจเป็นตัวเดียวกัน', 'การสร้างระเบียนใหม่ทั้งที่อาจซ้ำทำได้เฉพาะผู้ดูแลระบบ'],
        facts,
        confirmLabel: 'เปิดระเบียนเดิม',
        onConfirm: () => load(found.probable[0].record),
      });
    }
  };

  return (
    <app-clinic-register className="workspace reg-page">
      <div className="reg-title">
        <div className="reg-id">
          {r ? <PetIcon kind={r.kind} size="lg" /> : <span className="reg-id-ph" aria-hidden="true"><NgIcon svg={lucidePawPrint} /></span>}
          <div className="reg-id-text">
            <h1>
              {` ${r ? r.pet : tx('ผู้ป่วยใหม่')} `}
              {r && <span className="hn">{`· ${r.hn !== '—' ? r.hn : r.code}`}</span>}
            </h1>
            <div className="secondary">{` ${r ? identity : tx('ค้นหา HN เพื่อดึงข้อมูลเดิม หรือกรอกด้านล่างเพื่อลงทะเบียนใหม่')} `}</div>
          </div>
        </div>

        <div className="reg-lookup" onBlur={closeLater(() => setHnQuery(''))}>
          <label htmlFor="reg-hn">HN</label>
          <input id="reg-hn" className="ui-input" type="search" autoComplete="off" placeholder={tx('HN / ชื่อสัตว์ / เจ้าของ')} value={hnQuery}
            onChange={event => setHnQuery(event.target.value)}
            onKeyDown={event => { if (event.key === 'Enter') { receive(); } else if (event.key === 'Escape') { setHnQuery(''); } }} />
          {hnQuery && (
            <div className="reg-pop">
              {hnQuery.trim().length < 2 ? (
                <p className="reg-pop-empty">{tx('พิมพ์อย่างน้อย 2 ตัวอักษร')}</p>
              ) : (
                <>
                  <ul aria-label={tx('ผลการค้นหา HN')}>
                    {hits.map(hit => (
                      <li key={hit.code}>
                        <button type="button" className="reg-hit" onMouseDown={event => event.preventDefault()} onClick={() => load(hit)}>
                          <PetIcon kind={hit.kind} />
                          <span className="grow">
                            <b>{hit.pet}</b><span className="tnum muted">{hit.hn !== '—' ? hit.hn : hit.code}</span>
                            <span className="secondary">{ownerOf(hit)}</span>
                          </span>
                          {hit.patient && <span className="chip info">{tx('ในคิววันนี้')}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                  {!hits.length && <p className="reg-pop-empty">{tx('ไม่พบ HN นี้ — ลงทะเบียนใหม่ด้านล่าง')}</p>}
                </>
              )}
            </div>
          )}
        </div>

        <div className="reg-actions">
          <UiButton variant="ghost" size="sm" type="button" disabled={!hits.length} onClick={receive}>{tx('รับแฟ้ม')}</UiButton>
          {r?.patient && <UiButton variant="ghost" size="sm" type="button" onClick={openPatient}>{tx('เปิดเวชระเบียน')}</UiButton>}
          <UiButton variant="ghost" size="sm" type="button" onClick={reset}>{tx('ล้างฟอร์ม')}</UiButton>
        </div>
      </div>

      {r && (
        <div className="reg-objstat">
          <span className="os good"><span className="dot"></span>{tx('ดึงข้อมูลเดิมแล้ว · ดูอย่างเดียว')}</span>
          {fullName && <span className="os">{`${tx('เจ้าของ')} `}<b>{fullName}</b></span>}
          {d.phone && <span className="os tnum">{d.phone}</span>}
          {r.patient && <span className="os">{`${tx('ในคิววันนี้')} `}<b>{tx(r.patient.reason)}</b></span>}
          {d.caution && <span className="os warn"><span className="dot"></span>{d.caution}</span>}
        </div>
      )}

      {block && (
        <div className="reg-block" role="alert">
          <NgIcon svg={lucideTriangleAlert} aria-hidden="true" />
          <div className="grow">
            <b className="reg-block-title">{tx('ข้อมูลซ้ำแน่นอน — สร้างระเบียนใหม่ไม่ได้')}</b>
            <div>{`${tx('ตรงกันที่')} `}<b>{block.field}</b>{` · ${block.record.hn !== '—' ? block.record.hn : block.record.code} · ${block.record.pet} · ${tx('เจ้าของ')} ${block.owner}`}</div>
          </div>
          <UiButton size="sm" type="button" onClick={() => load(block.record)}><NgIcon svg={lucideArrowRight} aria-hidden="true" />{tx('เปิดระเบียนเดิม')}</UiButton>
          <UiButton variant="ghost" size="sm" iconOnly type="button" aria-label={tx('ปิด')} onClick={() => registrationForm.setBlock(null)}><NgIcon svg={lucideX} aria-hidden="true" /></UiButton>
        </div>
      )}

      <fieldset className="plain reg-body" disabled={!!r}>
        <legend className="visually-hidden">{tx('ลงทะเบียนผู้ป่วย')}</legend>

        {/* The pet */}
        <section className="reg-panel" aria-labelledby="reg-pet-title">
          <div className="reg-panel-head">
            <NgIcon svg={lucidePawPrint} aria-hidden="true" />
            <h2 id="reg-pet-title">{tx('สัตว์ป่วย')}</h2>
            <span className="hint">{tx('ชนิด · สายพันธุ์ · ไมโครชิป')}</span>
          </div>
          <div className="rf pet-grid">
            <label className="rf-lbl" htmlFor="reg-pet">{tx('ชื่อสัตว์')}<span className="rq"> *</span></label>
            <div className="rf-ctl"><input id="reg-pet" className="ui-input" value={d.pet} onChange={event => set('pet', event.target.value)} placeholder="ลัคกี้" aria-required="true" /></div>
            <label className="rf-lbl" htmlFor="reg-chip">{tx('ไมโครชิป')}</label>
            <div className="rf-ctl"><input id="reg-chip" className="ui-input tnum" inputMode="numeric" value={d.microchip} onChange={event => set('microchip', event.target.value)} placeholder="900-xxx…" /></div>

            <span className="rf-lbl" id="reg-species">{tx('ชนิดสัตว์')}<span className="rq"> *</span></span>
            <div className="rf-ctl wide">
              <div className="sp-pick" role="group" aria-labelledby="reg-species">
                {SPECIES.map(s => (
                  <button key={s.value} type="button" className={cx('sp-btn', `sp-${s.value}`, d.kind === s.value && 'on')} aria-pressed={d.kind === s.value} onClick={() => pickSpecies(s.value)}>
                    <NgIcon svg={PET_ICONS[s.value]} aria-hidden="true" />{tx(s.label)}
                  </button>
                ))}
              </div>
            </div>

            <label className="rf-lbl" htmlFor="reg-breed">{tx('สายพันธุ์')}</label>
            <div className="rf-ctl">
              <input id="reg-breed" className="ui-input" list="reg-breeds" autoComplete="off" placeholder={tx('พิมพ์เพื่อค้นสายพันธุ์')} value={breedText}
                onChange={event => typeBreed(event.target.value)} aria-describedby={breedUnmatched ? 'reg-breed-note' : undefined} />
              <datalist id="reg-breeds">
                {breeds.map(b => <option key={b} value={b}>{tx(b)}</option>)}
              </datalist>
              {breedUnmatched && <p className="vmsg warn" id="reg-breed-note"><NgIcon svg={lucideTriangleAlert} aria-hidden="true" />{tx('เลือกจากรายการ ไม่อย่างนั้นจะไม่บันทึกสายพันธุ์')}</p>}
            </div>
            <label className="rf-lbl" htmlFor="reg-color">{tx('สี')}</label>
            <div className="rf-ctl"><input id="reg-color" className="ui-input" value={d.color} onChange={event => set('color', event.target.value)} placeholder={tx('น้ำตาล-ขาว')} /></div>

            <span className="rf-lbl">{tx('เพศ')}</span>
            <div className="rf-ctl wide"><UiSegmented size="sm" options={sexes} value={d.sex} onValueChange={value => set('sex', value ?? 'u')} ariaLabel={tx('เพศ')} /></div>
            <span className="rf-lbl">{tx('ทำหมัน')}</span>
            <div className="rf-ctl wide"><UiSegmented size="sm" options={neuters} value={d.neutered} onValueChange={value => set('neutered', !!value)} ariaLabel={tx('ทำหมัน')} /></div>

            <label className="rf-lbl" htmlFor="reg-dob">{tx('วันเกิด')}</label>
            <div className="rf-ctl wide inline">
              <input id="reg-dob" className="ui-input reg-date" type="date" max={TODAY} value={d.dob} onChange={event => set('dob', event.target.value)} />
              <label className="reg-known"><input type="checkbox" checked={d.dobKnown} onChange={event => set('dobKnown', event.target.checked)} />{tx('ทราบวันเกิดแน่นอน')}</label>
              {age && <span className="tnum muted">{d.dobKnown ? '' : tx('ประมาณ') + ' '}{tx('{y} ปี {m} เดือน {d} วัน', { y: age.y, m: age.m, d: age.d })}</span>}
            </div>

            <label className="rf-lbl top" htmlFor="reg-caution">{tx('ข้อควรระวัง')}</label>
            <div className="rf-ctl wide">
              <textarea id="reg-caution" className="ui-input" rows={3} maxLength={500} value={d.caution} onChange={event => set('caution', event.target.value)}
                placeholder={tx('นิสัย ข้อควรระวังในการจับบังคับ เช่น กัด ต้องใส่ปลอกปาก')}></textarea>
            </div>
          </div>
        </section>

        {/* The owner */}
        <section className="reg-panel" aria-labelledby="reg-owner-title">
          <div className="reg-panel-head">
            <NgIcon svg={lucideUserRound} aria-hidden="true" />
            <h2 id="reg-owner-title">{tx('เจ้าของ')}</h2>
            <span className="hint">{tx('เจ้าของ 1 คน มีสัตว์ได้หลายตัว')}</span>
          </div>

          <div className="reg-owner-find" onBlur={closeLater(() => setOwnerQuery(''))}>
            {d.ownerKey && !r ? (
              <div className="reg-owner-bar on">
                <NgIcon svg={lucideCheck} aria-hidden="true" />
                <span className="grow">{`${tx('ดึงข้อมูลแล้ว')} · ${fullName}`}</span>
                {clearArm ? (
                  <>
                    <UiButton variant="danger" size="sm" type="button" onClick={clearOwner}><NgIcon svg={lucideTrash2} aria-hidden="true" />{tx('ล้าง')}</UiButton>
                    <UiButton variant="ghost" size="sm" iconOnly type="button" aria-label={tx('ยกเลิก')} onClick={() => setClearArm(false)}><NgIcon svg={lucideX} aria-hidden="true" /></UiButton>
                  </>
                ) : (
                  <UiButton variant="ghost" size="sm" type="button" onClick={() => setClearArm(true)}><NgIcon svg={lucideX} aria-hidden="true" />{tx('ล้าง / เจ้าของใหม่')}</UiButton>
                )}
              </div>
            ) : (
              <>
                <div className="reg-owner-bar">
                  <NgIcon svg={lucideSearch} aria-hidden="true" />
                  <input className="grow" type="search" autoComplete="off" aria-label={tx('ค้นหาเจ้าของ')} placeholder={tx('ค้นเจ้าของ: ชื่อ · เบอร์โทร · เลขบัตร · ชื่อสัตว์')}
                    value={ownerQuery} onChange={event => setOwnerQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') { setOwnerQuery(''); } }} />
                  {ownerQuery && <span className="muted tnum">{tx('{n} ราย', { n: owners.length })}</span>}
                </div>
                {ownerQuery && (
                  <div className="reg-pop">
                    <ul aria-label={tx('เจ้าของที่พบ')}>
                      {owners.map(([key, o]) => (
                        <li key={key}>
                          <button type="button" className="reg-hit" onMouseDown={event => event.preventDefault()} onClick={() => pickOwner(key, o)}>
                            <span className="reg-initial" aria-hidden="true">{o.name.slice(0, 2)}</span>
                            <span className="grow">
                              <b>{o.name}</b>
                              {o.pdpa.startsWith('ยินยอม') && <span className="chip ok">PDPA</span>}
                              <span className="secondary tnum">{`${o.phone} · ${tx('{n} ตัว', { n: o.pets.length })}`}</span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                    {!owners.length && <p className="reg-pop-empty">{tx('ไม่พบ — กรอกฟอร์มด้านล่างเพื่อเพิ่มเจ้าของใหม่')}</p>}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="rf owner-grid">
            <label className="rf-lbl" htmlFor="reg-first">{tx('ชื่อ-นามสกุล')}<span className="rq"> *</span></label>
            <div className={cx('rf-ctl wide reg-name', titleChoice === OTHER_TITLE && 'other')}>
              <select id="reg-honorific" className="ui-input" aria-label={tx('คำนำหน้า')} value={titleChoice} onChange={event => pickTitle(event.target.value)}>
                <option value="">{tx('คำนำหน้า')}</option>
                {TITLES.map(t => <option key={t} value={t}>{tx(t)}</option>)}
                <option value={OTHER_TITLE}>{tx(OTHER_TITLE)}</option>
              </select>
              {titleChoice === OTHER_TITLE && (
                <input id="reg-honorific-other" className="ui-input" aria-label={tx('คำนำหน้าอื่น')} placeholder={tx('เช่น ดร.')} value={d.title}
                  onChange={event => set('title', event.target.value)} />
              )}
              <input id="reg-first" className="ui-input" placeholder={tx('ชื่อ')} value={d.first} onChange={event => set('first', event.target.value)} aria-required="true" />
              <input id="reg-last" className="ui-input" aria-label={tx('นามสกุล')} placeholder={tx('นามสกุล')} value={d.last} onChange={event => set('last', event.target.value)} />
            </div>

            <label className="rf-lbl" htmlFor="reg-phone">{tx('เบอร์โทร')}<span className="rq"> *</span></label>
            <div className="rf-ctl"><input id="reg-phone" className="ui-input tnum" type="tel" placeholder="08x-…" value={d.phone} onChange={event => set('phone', event.target.value)} aria-required="true" /></div>
            <label className="rf-lbl" htmlFor="reg-mobile">{tx('มือถือ')}</label>
            <div className="rf-ctl"><input id="reg-mobile" className="ui-input tnum" type="tel" placeholder="—" value={d.mobile} onChange={event => set('mobile', event.target.value)} /></div>

            <label className="rf-lbl" htmlFor="reg-email">{tx('อีเมล')}</label>
            <div className="rf-ctl"><input id="reg-email" className="ui-input" type="email" placeholder="name@email.com" value={d.email} onChange={event => set('email', event.target.value)} /></div>
            <label className="rf-lbl top" htmlFor="reg-id">{tx('เลขบัตรประชาชน')}</label>
            <div className="rf-ctl">
              <input id="reg-id" className={cx('ui-input tnum', idWarn && 'vs-warn')} inputMode="numeric" placeholder="x-xxxx-xxxxx-xx-x" value={d.thaiId}
                onChange={event => set('thaiId', event.target.value)} aria-describedby={idWarn ? 'reg-id-note' : undefined} />
              {idWarn && <p className="vmsg warn" id="reg-id-note"><NgIcon svg={lucideTriangleAlert} aria-hidden="true" />{tx('แนะนำให้กรอก สำหรับออกใบกำกับภาษี')}</p>}
            </div>

            <span className="rf-lbl" id="reg-address">{tx('ที่อยู่')}</span>
            <div className="rf-ctl wide reg-addr-head">
              <UiSegmented size="sm" options={addressTabs} value={addressKind} onValueChange={value => setAddressKind(value ?? 'current')} ariaLabel={tx('ที่อยู่')} />
              {addressKind === 'house' && (
                <UiButton variant="ghost" size="sm" type="button" onClick={() => registrationForm.copyCurrent('house')}>
                  <NgIcon svg={lucideCopy} aria-hidden="true" />{tx('เหมือนที่อยู่ปัจจุบัน')}
                </UiButton>
              )}
              <span className={cx('reg-addr-note', addressIncomplete && 'warn')}>
                {onFileAddress ? tx('ที่อยู่ในระบบ: {a}', { a: onFileAddress }) : tx(addressNote)}
              </span>
            </div>

            <label className="rf-lbl" htmlFor="addr-no">{tx('เลขที่')}</label>
            <div className="rf-ctl addr-no">
              <input id="addr-no" className="ui-input" placeholder={tx('เลขที่')} value={addr('no')} onChange={event => writeAddr('no', event.target.value)} />
              <input className="ui-input" aria-label={tx('หมู่')} placeholder={tx('หมู่')} value={addr('moo')} onChange={event => writeAddr('moo', event.target.value)} />
              <input className="ui-input" aria-label={tx('ซอย')} placeholder={tx('ซอย')} value={addr('soi')} onChange={event => writeAddr('soi', event.target.value)} />
            </div>
            <label className="rf-lbl" htmlFor="addr-road">{tx('ถนน')}</label>
            <div className="rf-ctl"><input id="addr-road" className="ui-input" value={addr('road')} onChange={event => writeAddr('road', event.target.value)} /></div>

            <label className="rf-lbl" htmlFor="addr-place">{tx('อาคาร / หมู่บ้าน')}</label>
            <div className="rf-ctl"><input id="addr-place" className="ui-input" placeholder={tx('บ้าน คอนโด อาคาร')} value={addr('place')} onChange={event => writeAddr('place', event.target.value)} /></div>
            <label className="rf-lbl" htmlFor="addr-landmark">{tx('จุดสังเกต')}</label>
            <div className="rf-ctl"><input id="addr-landmark" className="ui-input" placeholder={tx('ใกล้…')} value={addr('landmark')} onChange={event => writeAddr('landmark', event.target.value)} /></div>

            <label className="rf-lbl" htmlFor="addr-tambon">{tx('ตำบล / แขวง')}</label>
            <div className="rf-ctl"><input id="addr-tambon" className="ui-input" value={addr('tambon')} onChange={event => writeAddr('tambon', event.target.value)} /></div>
            <label className="rf-lbl" htmlFor="addr-amphoe">{tx('อำเภอ / เขต')}</label>
            <div className="rf-ctl"><input id="addr-amphoe" className="ui-input" value={addr('amphoe')} onChange={event => writeAddr('amphoe', event.target.value)} /></div>

            <label className="rf-lbl" htmlFor="addr-province">{tx('จังหวัด')}</label>
            <div className="rf-ctl">
              <select id="addr-province" className="ui-input" value={addr('province')} onChange={event => writeAddr('province', event.target.value)}>
                <option value="">{tx('เลือกจังหวัด')}</option>
                {PROVINCES.map(([th]) => <option key={th} value={th}>{tx(th)}</option>)}
              </select>
            </div>
            <label className="rf-lbl" htmlFor="addr-zip">{tx('รหัสไปรษณีย์')}</label>
            <div className="rf-ctl">
              <input id="addr-zip" className="ui-input tnum" inputMode="numeric" maxLength={5} value={addr('zip')} onChange={event => writeAddr('zip', event.target.value)} />
            </div>

            <label className="reg-consent rf-all">
              <input type="checkbox" checked={d.pdpa} onChange={event => set('pdpa', event.target.checked)} />
              {` ${tx('ยินยอมให้ใช้ข้อมูลเพื่อการรักษา (จำเป็น)')} `}
            </label>
          </div>
        </section>
      </fieldset>

      <div className="reg-foot">
        <div className="reg-summary">
          <span className="reg-summary-text">
            {`${tx('สัตว์')} `}<b>{`${d.pet || '—'} · ${tx(speciesLabel(d.kind))}`}</b>{` · ${tx('เจ้าของ')} `}<b>{fullName || '—'}</b>
            {d.phone && <>{' · '}<span className="tnum">{d.phone}</span></>}
          </span>
          {r ? (
            <span className="reg-state ok"><NgIcon svg={lucideCheck} aria-hidden="true" />{tx(r.patient ? 'อยู่ในคิววันนี้แล้ว' : 'ลงทะเบียนไว้แล้ว')}</span>
          ) : ready ? (
            <span className="reg-state ok"><NgIcon svg={lucideCheck} aria-hidden="true" />{tx('พร้อมบันทึก')}</span>
          ) : (
            <span className="reg-state warn"><NgIcon svg={lucideTriangleAlert} aria-hidden="true" />{`${tx('ต้องกรอก:')} ${missingText}`}</span>
          )}
        </div>
        <label className="reg-route-label" htmlFor="reg-route">{tx('ส่งต่อ')}</label>
        <select id="reg-route" className="ui-input reg-route" value={route} onChange={event => registrationForm.setRoute(event.target.value)}>
          {ROUTES.map(item => <option key={item} value={item}>{tx(item)}</option>)}
        </select>
        <UiButton variant="secondary" type="button" disabled={!!r || !ready} onClick={() => save(false)}>{tx('ลงทะเบียน')}</UiButton>
        <UiButton type="button" disabled={!canQueue} onClick={() => save(true)}>
          <NgIcon svg={lucideArrowRight} aria-hidden="true" />{tx('ส่งเข้าคิว')}
        </UiButton>
      </div>
    </app-clinic-register>
  );
}
