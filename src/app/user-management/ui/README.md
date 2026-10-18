# ui

ชิ้นส่วนพื้นฐานที่ส่วนจัดการผู้ใช้สร้างขึ้นมา สำหรับ React 19 มีธีมสว่างและมืด พอร์ตมาจาก `user-management/ui` ของฝั่ง Angular: DOM, class และ CSS ชุดเดียวกัน หน้าตาจึงเหมือนกันทุกพิกเซล ไม่ต้องใช้ CSS framework หรือ library แปลภาษา: ข้อความทุกชิ้นเข้ามาทาง prop แอปจึงเป็นคนเลือกภาษา

มากับส่วนจัดการผู้ใช้ (ดู [../README.md](../README.md)) ไม่มีอะไรในนี้ build หรือติดตั้งแยก เปิด `/ui-kit` เพื่อดูทุกชิ้นพร้อมตัวอย่างการใช้

element ของ component ใช้ชื่อเดียวกับ selector ของ Angular (`<ui-card>`, `<ui-pagination>`) component ขึ้นต้นด้วย `Ui` (`UiCard`) และตัวแปร CSS ขึ้นต้นด้วย `--ui-` import ทุกอย่างจาก `index.ts`:

```ts
import { UiButton, UiCard, useUiTableState } from './user-management/ui';
```

โฟลเดอร์นี้ใช้เดี่ยวๆ ได้ด้วย สำหรับ dashboard ที่ต้องการ component แต่ไม่ต้องการส่วนจัดการผู้ใช้: คัดลอกไป ติดตั้ง `lucide-react`, `zustand`, `@floating-ui/dom` และ `react-router` (และ `chart.js` สำหรับ `charts/`) ใส่ plugin ใน `build/` ใน `vite.config.ts` และ import `ui.scss` เป็นอย่างแรกใน `main.tsx`

## ธีม

`ui.scss` กำหนดตัวแปรสี รัศมีมุม เงา และฟอนต์ `--ui-*` และ class ที่ใช้ร่วมกัน `.ui-input` กับ `.ui-table` ใส่ `theme-dark` บน `<body>` (หรือ `data-theme="dark"` บน element ใดก็ได้) สำหรับธีมมืด `useUiTheme` ทำให้และจำค่าที่เลือกไว้:

```ts
const theme = useUiTheme();
// theme.toggle(), theme.set('dark'), theme.isDark
```

เปลี่ยนหน้าตาด้วยการ override ตัวแปร เช่น `--ui-primary`, `--ui-radius` หรือ `--ui-font` `--ui-font` เริ่มด้วย Sarabun ที่โปรเจกต์นี้เก็บไว้ใน `src/assets/fonts/sarabun` แอปที่ไม่มีจะได้ฟอนต์ของระบบแทน

ไอคอนเป็น component ของ `lucide-react` ส่งผ่าน prop เป็น `UiIcon` `src/app/icons.ts` export ไว้ในชื่อเดียวกับฝั่ง Angular (`lucideUsers` และอื่นๆ) และวาดเหมือนกัน import เฉพาะตัวที่ใช้:

```tsx
import { lucideUsers } from '../../icons';

<UiStatCard label="Users" value={1284} icon={lucideUsers} tone="primary" trend={4.2} hint="vs last month" />
```

## Component

| กลุ่ม | ชิ้น |
| --- | --- |
| Action และพื้นผิว | `UiButton`, `UiLinkButton` (เป็น `<Link>` ของ router) และ `UiAnchorButton` (`variant`, `size`, `iconOnly`, `block`, `loading`), `UiCard` (`actions`, `footer`, `fit` ให้สูงเท่าพ่อแม่ ตารางยาวจึงเลื่อนข้างใน และ pagination ใต้ตารางสั้นอยู่ล่างสุด, `fill` ให้กินที่ทั้งหมด เนื้อหาเลื่อนได้ และระหว่างที่เลื่อนได้ก็ focus ด้วยคีย์บอร์ดได้), `UiPageHeader` (`breadcrumbLabel` ตั้งชื่อเส้นทางให้ screen reader), `UiDialog` (`dismissible={false}` สำหรับคำถามที่ต้องตอบ), `UiAlert` (ข้อความแต้มสีในหน้า), `uiConfirm` (`ask` สำหรับใช่หรือไม่, `prompt` สำหรับข้อความหนึ่งบรรทัด เช่นเหตุผล บังคับหรือไม่ก็ได้) กับ `<UiConfirmHost />`, `uiToast` กับ `<UiToaster />` (`inline` เพื่อแสดงในหน้า), `UiMenuTrigger` (`onOpened` และ `onClosed`) กับ `UiMenu`, `UiMenuItem`, `UiMenuItemRadio`, `UiMenuItemCheckbox`, `UiMenuHeading` และ `UiMenuDivider`, `UiTooltip` |
| แสดงข้อมูล | `UiBadge`, `UiAvatar`, `UiPerson`, `UiIconChip`, `UiTrend`, `UiStatCard` (`trendSuffix=""` สำหรับการเปลี่ยนแปลงเป็นจำนวน, children อยู่ใต้ตัวเลข ครอบด้วย `<Link>` ให้ทั้งการ์ดเป็นลิงก์), `UiSplitBar` (แท่งเดียวแบ่งตามสถานะหรือประเภท พร้อมคำอธิบาย), `UiEmptyState`, `UiTimeline` กับ `UiTimelineItem`, `UiDetailList` กับ `UiDetailItem` (`labelTitle` บอกว่าตัวย่อใน label ย่อมาจากอะไร), `UiProgress`, `UiChartLegend` (item ที่มี `link` และ `queryParams` เป็นลิงก์) |
| นำทางและตัวกรอง | `UiSegmented` (pill หรือแท็บขีดเส้นใต้; `ariaLabel` และ `lang` ของตัวเลือกให้ label สั้นๆ เช่น "EN" ถูกอ่านเป็น "EN · English" โดยขึ้นต้นด้วยสิ่งที่แสดง คนที่สั่งด้วยเสียงตามที่เห็นจึงยังกดได้ (2.5.3) และ `disabled` แสดงโดยเลือกไม่ได้), `UiSearchInput` (`size="sm"` สำหรับ toolbar), `UiFilterChips` (`scroll` ให้อยู่บรรทัดเดียวเลื่อนด้านข้าง สำหรับโทรศัพท์), `UiPagination` (เลขหน้าไม่เกินห้าหน้ารอบหน้าปัจจุบัน ถ้ามีมากกว่านั้นมีปุ่มหน้าแรกและหน้าสุดท้ายด้วย) |
| ตาราง | `useUiTableState` (ค้นหา กรอง เรียง แบ่งหน้า และเลือก; `selectable` จำกัดแถวที่ติ๊กได้, `pageSizeKey` จำจำนวนแถวต่อหน้าของผู้อ่านไว้ในเบราว์เซอร์, `initialSort` เรียงไว้ก่อน), `uiTableClass(dense)` สำหรับ `<table>` (`dense` ให้แถวแน่นขึ้น), `UiSortHeader`, `UiBulkBar`, `UiPageSize` (ปุ่ม "1–10 จาก 48" ที่เลือกจำนวนแถวต่อหน้า) `useUiTableMinRows(ref, rows)` บน `.ui-table-scroll` ให้หน้าสุดท้ายที่สั้นสูงเท่าหน้าเต็ม และ `useUiTableScrollReset(ref, table)` เลื่อนกลับขึ้นบนเมื่อหน้า จำนวนต่อหน้า การเรียง การค้นหา หรือตัวกรองเปลี่ยน หัวตารางอยู่ในสายตาเมื่อตารางเลื่อนใน `.ui-table-scroll` |
| ฟอร์ม | `UiFormField` (label, hint, error), `UI_INPUT` (class `ui-input`), `UiCheckbox`, `UiSwitch`, `UiChoiceCards` (ตัวเลือกที่ `disabled` แสดงแต่เลือกไม่ได้), `UiFileDropzone` (`compact` สำหรับหนึ่งแถว) |
| กราฟ (`charts/`) | `UiChart` วาดกราฟ Chart.js ที่ตามธีม ใส่ใน `DeferOnViewport` แล้ว Chart.js จะโหลดเมื่อกราฟเข้ามาในจอเท่านั้น (แบบ `@defer (on viewport)` ของ Angular) `UI_CHART_PALETTE` และ `areaFill()` (ใน `chart-colors.ts`) ไม่โหลด Chart.js |

การเข้าถึงที่เกิน WCAG 2.2 AA สำหรับทุกอย่างที่สร้างจากชิ้นเหล่านี้: focus แสดงเป็นวงทึบ 2px สี `--ui-focus` ห่างขอบ 2px และช่องข้อความเปลี่ยนสีกรอบและวงด้านนอกเป็นสีนั้น (2.4.13) เมื่อ `prefers-reduced-motion` animation และ transition จบทันที และกราฟวาดโดยไม่เคลื่อนไหว ส่วน spinner ยังหมุน (2.3.3) `<abbr title>` มีเส้นประใต้ (3.1.4) แถวของตารางเลื่อนพ้นหัวตารางเมื่อได้ focus (2.4.12) และเมื่อใช้ forced colors (ธีม contrast ของ Windows) ตัวเลือกที่เลือก หน้าปัจจุบัน ช่องที่ติ๊ก และสวิตช์วาดด้วยสี highlight ของระบบ

`useUiAccessibleView` เปิดมุมมองเข้าถึงง่าย คือชิ้นเหล่านี้ตามเกณฑ์ WCAG 2.2 AAA: ใส่ `ui-aaa` บน `<body>` และ `ui.scss` ทำให้ทุก control อย่างน้อย 44 พิกเซลสี่เหลี่ยม ข้อความต่างจากพื้นหลัง 7:1 ระยะบรรทัด 1.5 และหยุดการเคลื่อนไหวทั้งหมด component ก็ตามด้วย: `uiToast` เก็บข้อความไว้จนกว่าจะปิด (แสดงในหน้าด้วย `<UiToaster inline />`) `UiAvatar` ใช้สีเข้มขึ้นหลังอักษรย่อ และ `UiChart` เขียนตัวเลขบนกราฟแท่งและวาดโดยไม่เคลื่อนไหว `UiMenuItemCheckbox` เป็นรายการเมนูที่เปิดปิดบางอย่างได้ เช่นมุมมองนี้ `UiDialog` ที่ `dismissible={false}` ปิดได้ด้วยปุ่มของตัวเองเท่านั้น: ไม่ใช่ Escape ปุ่มปิด หรือการคลิกนอก dialog

`useUiScale` ปรับขนาด UI ทั้งหมดตาม `UI_SCALES` (100% 110% 125%) โดยตั้ง `--ui-zoom` บน `<html>` ให้ `ui.scss` zoom ที่ `app-root` และเนื้อหาในเมนูของ overlay ส่วนที่ต้องเต็มหน้าต่างให้ใช้ `var(--ui-100vh)`, `var(--ui-100dvh)` และ `var(--ui-100vw)` แทน `100vh` และ `100vw` ที่ zoom ขยายเกินขอบจอ `step()` เลื่อนไปขนาดถัดไป (`next`) และจาก 125% กลับเป็น 100% ส่วน `atLargest` ใช้เลือกไอคอน ถ้ากดด้วยเมาส์ให้ใช้ `step({ hold: true })` ซึ่งตั้ง `--ui-zoom-hold` ให้ปุ่มต่างๆ ในแถบ (ใส่ `zoom: var(--ui-zoom-hold, 1)`) คงขนาดเดิมไว้ ปุ่มจะได้อยู่ใต้เมาส์ให้กดต่อได้ แล้วเรียก `release()` เมื่อเมาส์ออกจากปุ่มและเมื่อแถบถูกถอดออก (ดูรายละเอียดที่ README หลัก หัวข้อ "ขนาดการแสดงผล (Aa)")

`UiPersonSelect` เลือกคนหนึ่งคน หรือ "ทุกคน" เป็นตัวกรอง จากคนกี่คนก็ได้ ใช้แทน `<select>` เมื่อรายชื่ออาจยาวถึงหลักพัน ปุ่มแสดง `label` ตามด้วยสิ่งที่เลือก เช่น "ทำโดย: ทุกคน" หรือ "ทำโดย: (รูป) Henry Klein" พร้อมปุ่ม × สำหรับล้างค่า (`clearLabel` เป็นชื่อของปุ่มนี้) กดแล้วเปิดแผงที่มีช่องค้นหาอยู่บนสุด ค้นจากชื่อหรือ `detail` (เช่นอีเมล) ขณะพิมพ์ โดยชื่อที่ขึ้นต้นด้วยคำที่พิมพ์จะขึ้นก่อน แผงแสดงทีละ `limit` คน (50) พร้อมข้อความจาก `moreText` ว่ายังมีอีกกี่คน และก่อนพิมพ์ คนที่เลือกไว้จะอยู่ในรายการเสมอแม้อยู่เกินลำดับที่ 50 ใช้คีย์บอร์ดได้แบบ combobox คือลูกศรขึ้นลงเลื่อน Enter เลือก Escape ปิดแล้วกลับไปที่ปุ่ม และ Tab ไปต่อตามปกติ แผงเปิดใน overlay ชุดเดียวกับเมนู (`OverlayPane` ใน `menu/menu.tsx` ซึ่งทำแบบ `cdkConnectedOverlay` ของฝั่ง Angular) จึงไม่ถูกขอบการ์ดตัด และขยายตาม `useUiScale` ในมุมมองเข้าถึงง่าย ปุ่มและรายการมีขนาดอย่างน้อย 44 พิกเซล ดูตัวอย่าง 1,200 คนได้ที่ `/ui-kit`

```tsx
<UiPersonSelect label={t('Done by')} people={people} value={actorId} onValueChange={setActorId} anyoneLabel={t('Anyone')}
  searchLabel={t('Search name or email')} clearLabel={t('clearPersonFilter', { label: t('Done by') })} moreText={morePeople} />
```

`UiTooltip` ครอบ control หนึ่งตัวเพื่อแสดงข้อความสั้นๆ ใต้ control เมื่อชี้เมาส์ (หน่วง 300ms) เมื่อ focus ด้วยคีย์บอร์ด และทันทีหลังคลิก ข้อความเปลี่ยนตาม prop ขณะเปิดอยู่ ใช้ `text` เป็นบรรทัดหลัก `detail` เป็นบรรทัดรอง และ `align="end"` จัดให้ชิดขอบขวาของ control สำหรับปุ่มที่อยู่ขวาสุดของหน้า tooltip เป็น `aria-hidden` จึงต้องใส่ข้อความเดียวกันไว้ใน `aria-label` ของ control ด้วย tooltip เป็นไปตาม WCAG 1.4.13 คือเลื่อนเมาส์ไปบน tooltip ได้โดยไม่หาย กด Escape ปิดได้โดยไม่ต้องย้าย focus หรือเมาส์ และอยู่จนกว่าเมาส์และ focus จะออกไป

control ของฟอร์มเป็น component แบบ controlled (`checked`/`value` กับ `onChange`) จึงใช้กับ state ธรรมดาหรือ `Controller` ของ react-hook-form ได้ ช่องข้อความเป็น `<input>` ปกติที่มี class `ui-input` จึงใช้ `register()` ได้ตรงๆ `UiFormField` แสดง error ของ control ข้างในเมื่อ control ถูก touch หรือเปลี่ยนแล้ว `fieldControl()` และ `invalidClass()` ใน `../shared/forms.ts` แปลงสถานะของ react-hook-form ให้ (กรอบแดงคือ class `ng-invalid ng-touched` เหมือนฝั่ง Angular):

```tsx
<UiFormField label="Email" for="email" required errors={{ required: 'Enter your email.', email: 'Check the address.' }} control={fieldControl(form, 'email')}>
  <input id="email" className={cx(UI_INPUT, invalidClass(form, 'email'))} {...form.register('email', { required: true })} />
</UiFormField>
```

ตารางเขียน markup ของตัวเอง `useUiTableState` ทำแค่งาน:

```tsx
const table = useUiTableState({
  rows: users,
  id: user => user.id,
  search: (user, query) => user.name.toLowerCase().includes(query),
  sorters: { name: (a, b) => a.name.localeCompare(b.name) },
  pageSize: 10,
});
```

```tsx
{table.pageRows.map(user => <tr key={user.id}>…</tr>)}
<UiPagination page={table.page} onPageChange={table.setPage} pageCount={table.pageCount} />
```

## การทดสอบ

unit test ของโฟลเดอร์นี้รันพร้อมของแอป: `npm test`
