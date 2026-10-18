# Admin Dashboard (React)

ระบบหลังบ้านสำหรับจัดการผู้ใช้ ที่พอร์ตมาจาก [admin-ng-starter](../admin-ng-starter) (Angular 22) เป็น React 19 โดยตั้งใจให้ **หน้าตาและการทำงานเหมือนกันทุกอย่าง**: ทุกหน้า ทุก dialog เมนู และสถานะของฟอร์ม เทียบกับฝั่ง Angular แบบพิกเซลต่อพิกเซลแล้วได้ภาพเดียวกัน และใช้ชุดทดสอบ e2e ชุดเดียวกัน (`e2e/` คัดลอกมาจากฝั่ง Angular โดยไม่แก้)

มีหน้าภาพรวม ผู้ใช้ บทบาทและสิทธิ์ บทบาทที่ห้ามถือร่วมกัน ทบทวนสิทธิ์ สาขา ประวัติการใช้งาน การตั้งค่า แกลเลอรีคอมโพเนนต์ และหน้างานตรวจรักษา (`/clinic`) ส่วนจัดการผู้ใช้ทั้งหมดอยู่ในโฟลเดอร์เดียว `src/app/user-management` ([README ของโฟลเดอร์](src/app/user-management/README.md) บอกวิธีนำไปใช้ในแอปอื่น)

**สัญญา API:** [`src/app/user-management/API.md`](src/app/user-management/API.md) บอกว่าเซิร์ฟเวอร์ต้องทำอะไรบ้าง ทุก request สิทธิ์ที่ต้องมี และ error ที่ตอบได้ เป็นสัญญาเดียวกับฝั่ง Angular เซิร์ฟเวอร์ [admin-api-starter](https://github.com/mpiumakkho/admin-api-starter) ทำครบทุกข้อ

## สิ่งที่ต้องมี

- Node.js `^22.22.3`, `^24.15.0` หรือ `>=26.0.0`
- npm
- Google Chrome (สำหรับ `npm run e2e`)

## เริ่มใช้งาน

```bash
npm install
npm run dev
```

แล้วเปิด `http://localhost:4300/` (พอร์ต 4300 จะได้เปิดคู่กับฝั่ง Angular ที่ 4200 ได้) แอปโหลดใหม่เองเมื่อแก้ไฟล์

แอปใช้ข้อมูลตัวอย่างที่เก็บในเบราว์เซอร์ เพิ่ม แก้ ลบได้ตามสบาย ถ้าอยากเริ่มใหม่ให้ลบ key `admin-data-v8` ใน `localStorage`

เข้าสู่ระบบด้วยบัญชีตัวอย่างที่หน้า sign-in มีให้ หนึ่งบัญชีต่อหนึ่งบทบาท แต่ละบทบาทเห็นเฉพาะสิ่งที่บทบาทนั้นอนุญาต:

| บทบาท | ทำอะไรได้ |
| --- | --- |
| Administrator | ทุกอย่าง ยกเว้นแก้สิทธิ์ของบทบาท Administrator ที่ตัวเองถืออยู่ |
| Manager | เพิ่ม เชิญ และแก้ไขคนที่บทบาทเป็น Manager หรือต่ำกว่า อ่านบทบาท ประวัติการใช้งาน (และ export) และการตั้งค่า |
| Support | แก้ไขคนที่บทบาทเป็น Support หรือ Viewer อ่านบทบาทและประวัติการใช้งาน |
| Viewer | อ่านรายชื่อผู้ใช้และบทบาท |
| Branch manager | เป็น Viewer สำหรับทุกคน และเป็น Manager เฉพาะสาขาเชียงใหม่ |

อีเมลของผู้ใช้ที่ active คนอื่นก็ใช้ได้ กับรหัสผ่านอะไรก็ได้ที่ยาว 6 ตัวอักษรขึ้นไป จนกว่าผู้ใช้คนนั้นจะตั้งรหัสผ่านเองหรือเปิดการยืนยันตัวตน 2 ขั้นตอน

## คำสั่ง

| คำสั่ง | ทำอะไร |
| --- | --- |
| `npm run dev` | รัน dev server (Vite) ที่พอร์ต 4300 ส่งต่อ `/api` ไปที่ `http://localhost:8080` สำหรับ API จริง |
| `npm run build` | ตรวจ type แล้ว build สำหรับ production ลง `dist/` |
| `npm run preview` | เปิด build ใน `dist/` ที่พอร์ต 4300 |
| `npm test` | รัน unit test ด้วย Vitest (jsdom) |
| `npm run e2e` | รัน e2e ใน `e2e/` ด้วย Playwright บน Google Chrome กับ dev server (เปิดให้เองถ้ายังไม่ได้รัน) |
| `npm run lint` | ตรวจโค้ดด้วย oxlint |

## หน้าต่างๆ

| Route | หน้า |
| --- | --- |
| `/overview` | ยอดรวม ผู้ใช้ใหม่รายเดือน ผู้ใช้ตามบทบาท แผนกและสถานะ กิจกรรมล่าสุด |
| `/users` | ค้นหา กรอง เรียง และแบ่งหน้ารายชื่อผู้ใช้ เลือกหลายคนเพื่อเปิดใช้งาน ระงับ ลบ มอบหรือถอดบทบาท export สิ่งที่รายการแสดง (คัดลอก Excel CSV พิมพ์) หรือนำเข้าผู้ใช้จากไฟล์ CSV โดยตรวจทุกแถวก่อนบันทึก |
| `/users/new`, `/users/:id/edit` | เพิ่มหรือแก้ไขผู้ใช้ ออกจากหน้าโดยยังไม่บันทึกจะถามก่อน |
| `/users/:id` | โปรไฟล์ บทบาทและสิทธิ์ กิจกรรม และความปลอดภัย (การยืนยันตัวตน 2 ขั้นตอน รหัสผ่าน อุปกรณ์ที่เข้าสู่ระบบ) |
| `/roles` | สร้างบทบาทและเลือกสิทธิ์ บทบาทในตัวระบบและบทบาทที่ยังมีคนถือลบไม่ได้ |
| `/roles/conflicts` | บทบาทที่ห้ามถือพร้อมกัน และคนที่ถือไว้ก่อนมีกฎ ที่ต้องแก้ |
| `/access-reviews`, `/access-reviews/:id` | รอบทบทวนว่าแต่ละคนยังต้องใช้บทบาทที่ถืออยู่หรือไม่ |
| `/branches` | สาขา แสดงเมื่อเปิดใช้สาขาในการตั้งค่า |
| `/activity` | ทุกการเปลี่ยนแปลงเป็นตาราง กรองตามช่วงเวลา คน และประเภท เปิดแถวเพื่อดูรายละเอียด export ได้ `?user=<id>` ดูเฉพาะของคนหนึ่ง |
| `/settings` | บทบาทเริ่มต้น โดเมนอีเมลที่อนุญาต อายุคำเชิญ ออกจากระบบเมื่อไม่ได้ใช้งาน บทบาทที่ต้องใช้ 2 ขั้นตอน กฎรหัสผ่าน การเก็บประวัติ เหตุผลที่ต้องระบุ และสาขา |
| `/setup-two-factor` | หน้าที่คนซึ่งบทบาทบังคับให้ใช้ 2 ขั้นตอนจะถูกพาไป จนกว่าจะเปิดใช้ |
| `/login`, `/forgot-password`, `/activate`, `/reset-password` | เข้าสู่ระบบ ลืมรหัสผ่าน และหน้าตั้งรหัสผ่านจากลิงก์ในอีเมล (ข้อมูลตัวอย่างเขียนอีเมลลง console ของเบราว์เซอร์) |
| `/ui-kit` | แกลเลอรีคอมโพเนนต์ใน `user-management/ui` เปิดจากเมนูบัญชี |
| `/clinic` | ตัวอย่างหน้างานตรวจรักษาของโรงพยาบาลสัตว์ เปิดเต็มหน้าจอจากเมนูบัญชี มี 6 แท็บ: คิว นัดหมาย การตรวจรักษา คำสั่งตรวจ ผลตรวจ และจ่ายยา โค้ดอยู่ใน `src/app/clinic` |

## โครงสร้างโปรเจกต์

- `src/main.tsx` ตั้งค่าส่วนจัดการผู้ใช้ (`configureUserManagement()`) ภาษา session และ router แล้ว render ลงใน `<app-root>` ของ `index.html`
- `src/app/app.tsx` คือเปลือกแอป (navbar, sidebar, footer, spinner, toaster, dialog ยืนยันตัวตน) และ `src/app/app.routes.tsx` คือ route ทั้งหมด หน้าต่างๆ โหลดแบบ lazy และ guard เป็น loader ของ React Router
- `src/app/user-management` คือส่วนจัดการผู้ใช้ทั้งหมด:
  - หน้า: `overview`, `users`, `roles`, `access-reviews`, `branches`, `activity`, `settings`
  - `access`: `session` (ใครเข้าสู่ระบบและบทบาทอนุญาตอะไร), guard, หน้า no-access และ dialog ที่เกี่ยวกับการเข้าสู่ระบบ
  - `data`: type, `AdminApi` (สัญญากับเซิร์ฟเวอร์), `LocalAdminApi` (ข้อมูลตัวอย่างในเบราว์เซอร์), `HttpAdminApi` (เซิร์ฟเวอร์จริงผ่าน `fetch`), `adminStore` (state ที่หน้าต่างๆ อ่าน ด้วย Zustand) และกฎสิทธิ์
  - `shared`: badge, ประโยคกิจกรรม, รูปแบบวันที่, ข้อความ error, CSV, เมนู Export, `forms.ts` (ตัวช่วย react-hook-form), `leave-guard.ts` (ถามก่อนออกจากหน้า)
  - `ui`: คอมโพเนนต์พื้นฐาน ดู [ui/README.md](src/app/user-management/ui/README.md)
- `src/app/layout`: navbar, sidebar, footer, spinner และภาษา (`language.service.ts`)
- `src/app/auth`: หน้าเข้าสู่ระบบและตั้งรหัสผ่าน, `src/app/error-pages`: หน้า 404 และ 500, `src/app/ui-kit`: แกลเลอรี
- `src/app/clinic`: หน้างานตรวจรักษา ข้อมูล (`data/`) เหมือนฝั่ง Angular ทุกตัวอักษร store เป็นคลาสเดิมที่แจ้ง component ผ่าน Zustand
- `build/`: plugin ของ Vite ที่ทำให้ style ของ component ทำงานแบบ Angular (ดูหัวข้อถัดไป)
- `e2e/`: ชุดทดสอบ e2e ของฝั่ง Angular ไม่ได้แก้ ส่วน unit test อยู่ข้างโค้ด (`*.spec.ts`, `*.spec.tsx`)

## ทำให้ UI เหมือนฝั่ง Angular ได้อย่างไร

- **ชื่อ element เดิม** component render element ที่ชื่อเหมือน selector ของ Angular (`<app-users-list>`, `<ui-card>`, `<ng-icon>`) และใส่ class/attribute เหมือนกัน CSS และ selector ของ e2e จึงใช้ร่วมกันได้ ชนิดของ element เหล่านี้ประกาศไว้ใน `src/custom-elements.d.ts`
- **SCSS ไฟล์เดียวกัน** style ของแต่ละ component คัดลอกจากฝั่ง Angular ไฟล์ที่ขึ้นต้นด้วย `/* @host app-users-list */` จะถูก `build/emulated-styles.ts` (PostCSS) แปลงให้ทำงานแบบ emulated encapsulation ของ Angular รวมถึง `:host`, `:host-context()` และ `::ng-deep` ด้วยน้ำหนัก (specificity) เท่าเดิม ส่วน `build/emulated-hosts.ts` ใส่ `data-emulated` ให้ element ของ component เหล่านั้น เพื่อให้ style ของ component หนึ่งไม่ล้นเข้าไปใน component ลูกที่มี style ของตัวเอง เหมือน Angular
- **ช่องว่างในข้อความ** Angular ตัด text node ที่มีแต่ช่องว่างทิ้งและยุบช่องว่างที่ติดกัน ฝั่ง React จึงเขียนข้อความเป็น template literal ให้ได้ text node ชุดเดียวกัน (การแยก text node ทำให้ kerning ต่างกันได้)
- **เมนูแบบ CDK** `ui/menu` ทำตาม Angular CDK menu ทั้งโครงสร้าง DOM การวางตำแหน่ง (fit/push) คีย์บอร์ด typeahead และ focus
- **ฟอร์ม** ใช้ react-hook-form ตั้งให้ตรวจเหมือน reactive form ของ Angular (`FORM_BEHAVIOUR`) ช่องที่ผิดได้ class `ng-invalid ng-touched` (กรอบแดง) และ control ที่ฝั่ง Angular ผูกด้วย `formControlName` มี attribute `formcontrolname` เหมือนกัน

## เชื่อมต่อ API จริง

`HttpAdminApi` เรียก endpoint ใน [API.md](src/app/user-management/API.md) รัน `../admin-api-starter` (Spring Boot) ที่ `http://localhost:8080` แล้วเปลี่ยนใน `src/main.tsx`:

```ts
configureUserManagement({ api: new HttpAdminApi({ url: '/api', events: true }) });
```

`npm run dev` ส่งต่อ `/api` ไปที่ `http://localhost:8080` (`vite.config.ts`) API จึงอยู่ origin เดียวกับแอปและ cookie ไม่ต้องตั้ง CORS เข้าสู่ระบบแล้วได้ access token อายุสั้น ซึ่ง `HttpAdminApi` เก็บไว้ในหน่วยความจำเท่านั้นและส่งเป็น `Authorization: Bearer …` กับ refresh cookie แบบ HttpOnly ที่ขอ token ใหม่หลัง reload หรือเมื่อ token หมดอายุ

อยากลองเส้นทาง HTTP ก่อนมีเซิร์ฟเวอร์ ใช้ `localBackend()` ซึ่งเป็นเซิร์ฟเวอร์จำลองในเบราว์เซอร์:

```ts
configureUserManagement({ api: new HttpAdminApi({ fetch: localBackend() }) });
```

## ภาษา

UI มีภาษาไทย (`th` ค่าเริ่มต้น) และอังกฤษ (`en`) ผ่าน i18next ไฟล์แปลเป็นชุดเดียวกับฝั่ง Angular:

- `src/assets/i18n/th.json` และ `en.json` สำหรับแอปรอบนอก
- `src/app/user-management/i18n/th.json` และ `en.json` สำหรับส่วนจัดการผู้ใช้
- หน้างานตรวจรักษามีตัวแปลของตัวเอง (`src/app/clinic/i18n`) ใช้ข้อความต้นฉบับภาษาไทยเป็น key

key คือข้อความภาษาอังกฤษ ในคอมโพเนนต์ใช้ `useFormat()` (หรือ `useTranslation()`):

```tsx
const { t } = useFormat();
<span>{t('Users')}</span>
```

คอมโพเนนต์ใน `ui` ไม่แปลเอง ให้ส่งข้อความที่แปลแล้วเข้าไปทาง prop จะเพิ่มภาษาให้เพิ่มไฟล์ JSON และรายการใน `LANGUAGES` ใน `src/app/layout/language.service.ts`

## การเข้าถึง (Accessibility)

แอปผ่าน WCAG 2.2 AA ในมุมมองปกติ และ AAA ใน **มุมมองเข้าถึงง่าย** (เปิดจากสวิตช์มุมขวาบนของหน้า sign-in หรือเมนูบัญชี) เหมือนฝั่ง Angular ทุกข้อ: ปุ่มและช่องกรอกอย่างน้อย 44×44 พิกเซล ความต่างของสีอย่างน้อย 7:1 ไม่มีการเคลื่อนไหว ข้อความแจ้งเตือนอยู่จนกว่าจะปิด การเปลี่ยนแปลงจากแท็บอื่นรอจนกว่าจะกด "แสดงการเปลี่ยนแปลง" และ session ที่หมดอายุให้เข้าสู่ระบบใหม่บนหน้าเดิมโดยไม่เสียสิ่งที่พิมพ์ไว้

`e2e/accessibility.spec.ts` ตรวจทุกหน้า เมนู และ dialog ด้วย axe ทั้งธีมสว่างและมืด และ `e2e/accessible-view.spec.ts` ตรวจกฎ AAA

### ขนาดการแสดงผล (Aa)

ปุ่ม A↑/A↓ ที่ header ถัดจากปุ่มธีม ขยาย UI ทั้งหมด 100% → 110% → 125% แล้วกลับเป็น 100% ระบบจำค่าที่เลือกไว้ และ `index.html` ใส่ค่าให้ก่อนแอปเริ่มทำงาน เมื่อกดด้วยเมาส์ ไอคอนในแถบคงขนาดเดิมไว้ (`useUiScale.getState().step({ hold: true })`) จนเมาส์ออกจากปุ่ม ปุ่มจึงอยู่ใต้เมาส์ให้กดซ้ำได้ ส่วนที่ต้องเต็มหน้าต่างให้ใช้ `var(--ui-100vh)`, `var(--ui-100dvh)` และ `var(--ui-100vw)` แทน `100vh` และ `100vw`

## ฟอนต์และธีม

- ใช้ฟอนต์ Sarabun ที่เก็บไว้ในโปรเจกต์ (`src/assets/fonts/sarabun`, ประกาศใน `src/assets/scss/_fonts.scss`) ไม่ต้องพึ่งบริการฟอนต์
- มีธีมสว่างและมืด สลับด้วยปุ่มพระอาทิตย์/พระจันทร์ จำค่าไว้ใน `localStorage` ถ้ายังไม่เคยเลือกจะตามการตั้งค่าของระบบ สคริปต์ใน `index.html` ใส่ class ของธีมก่อนแอปเริ่ม หน้าจึงไม่กะพริบเป็นธีมผิด
- สีทั้งหมดมาจากตัวแปร `--ui-*` ใน `src/app/user-management/ui/ui.scss`

## การทดสอบ

- `npm test`: unit test ของตรรกะที่พอร์ตมา (store, session และกฎสิทธิ์, `HttpAdminApi`, เซิร์ฟเวอร์จำลอง, import CSV, export, ตาราง) และ test ของคอมโพเนนต์ ด้วย Vitest + Testing Library เคสเดียวกับฝั่ง Angular
- `npm run e2e`: ชุด e2e ของฝั่ง Angular ทั้งชุด ใช้ `@playwright/test` และ `@axe-core/playwright` เวอร์ชันเดียวกับฝั่ง Angular (ตรึงไว้) ผลของ axe จึงเทียบกันได้ตรงๆ
