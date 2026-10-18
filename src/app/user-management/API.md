# API ของส่วนจัดการผู้ใช้

`HttpAdminApi` (`data/http-admin-api.ts`) เรียก endpoint เหล่านี้ เซิร์ฟเวอร์ที่ทำตามนี้ใช้กับทุกหน้าได้ทันทีโดยไม่ต้องแก้หน้าใด เปิดใช้ใน `main.tsx`:

```ts
configureUserManagement({ api: new HttpAdminApi({ url: '/api' }) });
```

body ทุกตัวเป็น JSON type อยู่ใน `data/models.ts` วันที่เป็นข้อความแบบ ISO 8601 path ด้านล่างเริ่มต่อจาก `url` เอกสารนี้เป็นสัญญาเดียวกับฝั่ง Angular (`../admin-ng-starter`) ทุกข้อ `admin-api-starter` ที่อยู่ข้างโปรเจกต์นี้เป็นเซิร์ฟเวอร์ Spring Boot ที่ทำครบทั้งหมด

## ลองก่อนมีเซิร์ฟเวอร์

`localBackend` (`data/local-backend.ts`) เป็นเซิร์ฟเวอร์จำลองในเบราว์เซอร์ ตอบ request เหล่านี้ด้วยข้อมูลตัวอย่าง รวมถึง access token และ `401` ที่ทำให้ `HttpAdminApi` ขอ token ใหม่ เป็น response และ error จริงด้วย status code ตามหัวข้อ Error ด้านล่าง แอปจึงทำงานผ่าน `HttpAdminApi` เหมือนตอนต่อกับเซิร์ฟเวอร์จริงทุกอย่าง:

```ts
configureUserManagement({ api: new HttpAdminApi({ fetch: localBackend() }) });
```

เมื่อเซิร์ฟเวอร์พร้อมแล้วให้เอา `fetch: localBackend()` ออก

## การเข้าสู่ระบบ: access token และ refresh cookie

เข้าสู่ระบบแล้วได้สองอย่าง:

- **access token**: JWT อายุสั้น (15 นาที) อยู่ใน body ของคำตอบ `HttpAdminApi` เก็บไว้ในหน่วยความจำเท่านั้น ไม่เคยเก็บใน `localStorage` หรือ `sessionStorage` และส่งเป็น `Authorization: Bearer <token>` ไปกับทุก request ยกเว้นที่อยู่ใต้ `/auth`
- **refresh cookie**: ค่าสุ่มที่อ่านความหมายไม่ได้ เซิร์ฟเวอร์ตั้งเป็น cookie แบบ `HttpOnly`, `SameSite=Strict` (และ `Secure` บน production) ส่งกลับเฉพาะ request ใต้ `/auth` JavaScript มองไม่เห็น ทุกครั้งที่ refresh จะได้ cookie ใหม่แทนตัวเดิม

การเข้าสู่ระบบแต่ละครั้งคือหนึ่ง **session** อยู่จนกว่าจะมีคนจบมัน หรือ refresh cookie หมดอายุ ถ้าไม่เลือก `remember` cookie จะหายเมื่อปิดเบราว์เซอร์ และ session จบหลังไม่มีการ refresh 12 ชั่วโมง ถ้าเลือก `remember` อยู่ได้ 30 วัน

| Request | Body | คำตอบ |
| --- | --- | --- |
| `POST /auth/login` | `{ email, password, remember, code? }` | `{ accessToken, expiresIn, user }` (`expiresIn` เป็นวินาที) และ refresh cookie ถ้าเปิดการยืนยันตัวตน 2 ขั้นตอนแต่ไม่มี `code` ให้ปฏิเสธด้วย `two_factor_required` รหัสผิดเป็น `invalid_code` |
| `POST /auth/refresh` | | `{ accessToken, expiresIn, user }` ชุดใหม่และ refresh cookie ใหม่ ตอบ `401` `unauthenticated` เมื่อไม่มี cookie, cookie หมดอายุหรือถูกใช้ไปแล้ว, session จบแล้ว หรือบัญชีไม่ active แล้ว |
| `POST /auth/logout` | | ไม่มี จบ session ของ refresh cookie และล้าง cookie ใช้ได้แม้ access token หมดอายุแล้ว และตอบเหมือนกันเมื่อไม่มี cookie |
| `GET /me` | | `User` ที่เข้าสู่ระบบอยู่ |
| `POST /me/password` | `{ currentPassword, newPassword }` | ไม่มี `invalid_credentials` เมื่อรหัสผ่านปัจจุบันผิด ซึ่งนับรวมใน lockout เหมือนตอนเข้าสู่ระบบ (ระหว่างล็อกตอบแบบเดียวกัน) `weak_password` หรือ `password_reused` เมื่อรหัสใหม่ผิดกฎรหัสผ่านด้านล่าง |

การปฏิเสธตอนเข้าสู่ระบบ: `invalid_credentials`, `account_suspended` (สถานะ `suspended`), `invite_pending` (สถานะ `invited`), `two_factor_required`, `invalid_code` รหัสผ่านผิดถูกนับ: ผิดติดกัน 5 ครั้ง บัญชีถูกล็อก 1 นาที แล้วนานขึ้นเท่าตัวทุกครั้ง (สูงสุด 30 นาที) ระหว่างนั้นตอบ `invalid_credentials` ตลอด เพื่อไม่ให้ใครรู้ว่าบัญชีไหนมีอยู่ request จาก address เดียวมากเกินไปให้ปฏิเสธด้วย `429` `too_many_requests` เมื่อสำเร็จ ให้บันทึก session (เบราว์เซอร์ ระบบปฏิบัติการ IP) สำหรับรายการอุปกรณ์ เขียน `auth.sign_in` ลงประวัติการใช้งาน และอัปเดต `lastActiveAt` ซึ่งการ refresh แต่ละครั้งก็อัปเดตด้วย: คือเวลาที่คนนั้นใช้แอปครั้งล่าสุด

การเข้าสู่ระบบที่ล้มเหลวก็ต้องบันทึก ตามที่การตรวจสอบกำหนด (ISO 27001, เกณฑ์การกำกับความเสี่ยงด้าน IT ของธนาคารแห่งประเทศไทย): การปฏิเสธบัญชีที่มีอยู่จริงเขียน `auth.sign_in_failed` โดยคนนั้นเป็นทั้ง actor และ target พร้อม IP เบราว์เซอร์และระบบปฏิบัติการของความพยายามนั้น และ `cause` ใน changes: `password` (ผิด), `code` (ผิด), `locked` (ถูกปฏิเสธระหว่างล็อก ไม่ว่ารหัสผ่านจะเป็นอะไร), `suspended` หรือ `invited` รหัสผ่านหรือรหัสผิดที่ `POST /me/reauthenticate` ก็เขียนเหมือนกัน ครั้งที่ผิดแล้วทำให้บัญชีถูกล็อกเขียน `auth.account_locked` พร้อม `lockMinutes` อีเมลที่ไม่ใช่ของใครไม่ต้องบันทึก ประวัติจึงไม่มีข้อมูลที่พิมพ์ผิดหลงเข้าไป

`HttpAdminApi` ใช้ endpoint เหล่านี้อย่างไร:

1. **ตอนเริ่ม** เรียก `POST /auth/refresh` ถ้าได้คำตอบแปลว่ามีคนเข้าสู่ระบบอยู่ `401` แปลว่าไม่มี
2. **เมื่อ request ได้ `401` `unauthenticated`** (หรือ `401` ที่ไม่มี code ที่รู้จัก) จะ refresh หนึ่งครั้งแล้วส่ง request เดิมซ้ำ request ที่ล้มเหลวระหว่างที่กำลัง refresh อยู่จะรอการ refresh ครั้งเดียวกันนั้น ไม่เริ่มของตัวเอง ถ้าเซิร์ฟเวอร์ปฏิเสธการ refresh ด้วย คนนั้นจะถูกพาออกจากระบบ `401` ที่มี code อื่น (`invalid_credentials`, `two_factor_required`, `invalid_code`) เป็นคำตอบ ไม่ใช่ token หมดอายุ: ส่งต่อไปตามนั้น
3. **ตอนออกจากระบบ** เรียก `POST /auth/logout` แล้วลืม token

`/auth/login`, `/auth/refresh` และ `/auth/logout` ส่งพร้อม credentials (`credentials: 'include'`) เพื่อให้เบราว์เซอร์เก็บ ส่ง และล้าง cookie เซิร์ฟเวอร์ไม่สนใจ header `Authorization` ใต้ `/auth` token เก่าที่ส่งไปจึงไม่มีผลเสีย ให้ API อยู่ origin เดียวกับแอป (`url: '/api'`; `npm run dev` ส่งต่อ `/api/…` ไปที่ `http://localhost:8080/api/…` โดยไม่แก้ path ด้วย `server.proxy` ใน `vite.config.ts`) API ที่อยู่คนละ origin ต้องตอบ request เหล่านั้นด้วย `Access-Control-Allow-Credentials: true` และ `Access-Control-Allow-Origin` ที่ระบุชัด และทั้งสองต้องเป็น site เดียวกัน cookie แบบ `SameSite=Strict` จึงจะถูกส่ง

เซิร์ฟเวอร์ตรวจทุก request ว่า session ของ token ยังเปิดอยู่และบัญชียัง active การจบ session หรือระงับใครจึงมีผลทันที ไม่ต้องรอ token หมดอายุ การเปลี่ยนรหัสผ่านจบ session อื่นๆ ของผู้ใช้คนนั้น การระงับ ลบ หรือรีเซ็ตรหัสผ่านของใครจบ session ทั้งหมดของเขา

## ลิงก์ในอีเมล

ผู้ใช้ที่ถูกเชิญได้อีเมลพร้อมลิงก์ตั้งรหัสผ่าน การรีเซ็ตรหัสผ่านของใครทำให้รหัสเดิมใช้ไม่ได้และส่งอีเมลพร้อมลิงก์ตั้งรหัสใหม่ ลิงก์เปิด `{mail.base-url}/activate?token=…` และ `{mail.base-url}/reset-password?token=…` ซึ่งเป็นหน้าตั้งรหัสผ่านจากลิงก์ของแอป ส่วน "ลืมรหัสผ่าน?" ในหน้า sign-in เปิด `/forgot-password` ที่ขอลิงก์รีเซ็ต ผ่าน `AdminApi.acceptInvitation()`, `requestPasswordReset()` และ `confirmPasswordReset()` เรียก:

| Request | Body | คำตอบ |
| --- | --- | --- |
| `POST /auth/activate` | `{ token, password }` | ไม่มี ตั้งรหัสผ่านและทำให้บัญชีเป็น `active` `invalid_token` (`400`) เมื่อลิงก์หมดอายุหรือถูกใช้แล้ว; `weak_password`, `password_reused` |
| `POST /auth/password-reset/request` | `{ email }` | `202` เสมอ ไม่ว่าอีเมลจะเป็นของใครหรือไม่ คำตอบจึงไม่เปิดเผยอะไร ส่งอีเมลพร้อมลิงก์เมื่อเป็นของใครสักคน |
| `POST /auth/password-reset/confirm` | `{ token, password }` | ไม่มี ตั้งรหัสผ่านใหม่และจบ session ของผู้ใช้คนนั้น `invalid_token`; `weak_password`, `password_reused` |

ลิงก์คำเชิญใช้ได้ `inviteExpiryDays` วันตามการตั้งค่า ลิงก์รีเซ็ตใช้ได้หนึ่งชั่วโมง แต่ละลิงก์ใช้ได้ครั้งเดียว และลิงก์ใหม่ประเภทเดียวกันแทนที่ลิงก์เก่า request เหล่านี้ไม่ส่งทั้ง access token และ cookie

กับข้อมูลตัวอย่าง (`LocalAdminApi` หรือ `localBackend`) ไม่มี mail server: อีเมลแต่ละฉบับเขียนลง console ของเบราว์เซอร์เป็น `[sample email] To ann@example.com: … http://…/activate?token=…` จึงลองลิงก์ได้ระหว่างพัฒนา

### อีเมลแจ้งเรื่องบัญชีของคุณ

เหมือน Google และ Microsoft เซิร์ฟเวอร์แจ้งทางอีเมลเมื่อมีอะไรเกิดกับบัญชี การเข้าสู่ระบบหรือการเปลี่ยนแปลงโดยคนแปลกหน้าจึงไม่หลุดสายตา แต่ละฉบับส่งหลังการเปลี่ยนแปลง commit แล้ว และไม่มีฉบับไหนทำให้ request ล้มเหลว:

| เมื่อ | ถึง |
| --- | --- |
| เข้าสู่ระบบจากเบราว์เซอร์และระบบ (เช่น Chrome บน Windows) ที่คนนั้นไม่เคยใช้มาก่อน ไม่นับการเข้าสู่ระบบครั้งแรก | คนนั้น พร้อมอุปกรณ์ IP และเวลา |
| มีการมอบบทบาทให้คนที่ active (`role_assignment.added`) | คนนั้น พร้อมบทบาท ขอบเขต และวันที่ |
| มีคนเปลี่ยนอีเมลของคนนั้น | อีเมลเดิม |
| รหัสผ่านของคนนั้นเปลี่ยน (`POST /me/password` หรือลิงก์รีเซ็ต) เมื่อเคยเข้าสู่ระบบมาก่อน | คนนั้น |
| เซิร์ฟเวอร์ระงับบัญชีที่ไม่มีใครใช้นาน `suspendInactiveDays` วันตามการตั้งค่า | คนนั้น |
| รอบทบทวนสิทธิ์เริ่ม โดยมีการมอบบทบาทที่คนนั้นตัดสินได้ | คนนั้น พร้อมจำนวน รอบทบทวน และวันปิด |

ตอนนี้มีแค่ช่องทางอีเมล LINE หรือช่องทางอื่นเพิ่มควบคู่ได้ภายหลัง

### ภาษาของอีเมล

อีเมลทุกฉบับเป็นภาษาของผู้รับ: `User.language` ของเขา `th` (ไทย) หรือ `en` (อังกฤษ) หรือถ้ายังเป็น `null` ใช้ `defaultLanguage` ของการตั้งค่า แอปเก็บ `language` ให้ตรงกับภาษาที่คนนั้นใช้แอปครั้งล่าสุด: หลังเข้าสู่ระบบ และทุกครั้งที่สลับภาษา จะส่ง `PATCH /users/:id` พร้อม `{ language }` ถ้าสองค่าไม่ตรงกัน (`session` ใน `access/session.ts`) ฟอร์มผู้ใช้ใหม่ก็ตั้งได้ คำเชิญจึงมาในภาษานั้น วันที่และเวลาในอีเมลเป็นเขตเวลาขององค์กรที่ตั้งไว้ในเซิร์ฟเวอร์ (`access-control.time-zone` ค่าเริ่มต้น `Asia/Bangkok` งานกลางคืนของเซิร์ฟเวอร์ก็รันตามนี้) และใช้ปีพุทธศักราชในภาษาไทย (2569 สำหรับ 2026)

## กฎรหัสผ่าน

การตั้งค่ากำหนดว่ารหัสผ่านใหม่ต้องยาวเท่าไร (`passwordMinLength` 8 ถึง 64) และรหัสผ่านล่าสุดของผู้ใช้กี่ตัว รวมตัวปัจจุบัน ที่ห้ามใช้ซ้ำ (`passwordHistory` 0 ถึง 24; 0 ไม่ตรวจ) ใช้ทุกที่ที่มีการตั้งรหัสผ่าน: `POST /me/password`, `POST /auth/activate` และ `POST /auth/password-reset/confirm` รหัสที่สั้นกว่าให้ปฏิเสธด้วย `weak_password` และรหัสที่เพิ่งใช้ด้วย `password_reused` (ทั้งคู่ `422`) การรีเซ็ตรหัสผ่านของใครเก็บรหัสเดิมไว้ในประวัติของเขา

| Request | คำตอบ | สิทธิ์ |
| --- | --- | --- |
| `GET /auth/password-policy` | `{ minLength, history }` | ทุกคน เข้าสู่ระบบหรือไม่ก็ได้ หน้าของลิงก์ในอีเมลจึงแสดงกฎได้ |

## อุปกรณ์ที่เข้าสู่ระบบและการยืนยันตัวตน 2 ขั้นตอน

ทุกคนดูและจบ session ของตัวเอง และเปิดปิดการยืนยันตัวตน 2 ขั้นตอนของตัวเองได้ คนที่มี `users.edit` ทำแบบเดียวกันให้คนที่ตัวเองดูแลได้ (ดูกฎด้านล่าง) ยกเว้นการเปิด 2 ขั้นตอนให้คนอื่น

| Request | Body | คำตอบ |
| --- | --- | --- |
| `GET /users/:id/sessions` | | `UserSession[]` ใช้ล่าสุดก่อน session ของ request นี้มี `current: true` |
| `DELETE /sessions/:id` | `{ reason? }` สำหรับของคนอื่น (ดูเหตุผล) | ไม่มี |
| `POST /users/:id/sessions/end` | `{ reason? }` สำหรับคนอื่น (ดูเหตุผล) | ไม่มี จบทุก session ของผู้ใช้ ถ้าเป็นของตัวเอง จบทั้งหมดยกเว้นอันปัจจุบัน |
| `POST /me/two-factor` | | `TwoFactorSetup`: `secret` แบบ base32 ชุดใหม่และ `uri` แบบ `otpauth://` เก็บรอไว้จนกว่าจะยืนยัน ตอบ `invalid_request` ระหว่างที่เปิด 2 ขั้นตอนอยู่ จะเปลี่ยนแอป authenticator ต้องปิดก่อนด้วยรหัส แล้วจึงเปิดใหม่ |
| `POST /me/two-factor/confirm` | `{ code }` | `TwoFactorConfirmation`: `{ user, recoveryCodes }` คือ `User` ที่ `twoFactor: true` และรหัสกู้คืนชุดแรก `invalid_code` ถ้ารหัสไม่ตรงกับ secret ที่รอไว้ |
| `POST /me/two-factor/disable` | `{ code }` | `User` ที่ `twoFactor: false` `invalid_code` ถ้ารหัสผิด ซึ่งนับรวมใน lockout เหมือนตอนเข้าสู่ระบบ (ระหว่างล็อกตอบแบบเดียวกัน) |
| `POST /users/:id/two-factor/reset` | `{ reason? }` (ดูเหตุผล) | `User` ที่ `twoFactor: false` ต้องมี `users.edit` ทำกับตัวเองเป็น `self_change` |
| `GET /me/recovery-codes` | | `{ remaining }`: รหัสกู้คืนของคุณที่ยังไม่ได้ใช้เหลือกี่ตัว |
| `POST /me/recovery-codes` | | `{ codes }`: รหัสกู้คืนใหม่สิบตัวแทนชุดเดิม `invalid_request` ระหว่างที่ปิด 2 ขั้นตอนอยู่ |

รหัสเป็น TOTP (RFC 6238): SHA-1 ช่วงละ 30 วินาที 6 หลัก ยอมรับเผื่อหนึ่งช่วงทั้งก่อนและหลังสำหรับนาฬิกาคลาดเคลื่อน `data/totp.ts` เป็นตัวอย่างที่ใช้งานได้ บันทึก `auth.sessions_ended`, `auth.two_factor_on` และ `auth.two_factor_off`

### รหัสกู้คืน

เหมือน backup code ของ Google และ GitHub การเปิด 2 ขั้นตอนให้รหัสกู้คืนสิบตัว สำหรับตอนโทรศัพท์หาย แต่ละตัวเป็นตัวพิมพ์เล็กและตัวเลขสิบตัว ไม่มีตัวที่สับสนง่าย (`0`, `1`, `i`, `l`, `o`) แสดงเป็นสองกลุ่มกลุ่มละห้า: `abcde-fghjk` แสดงเพียงครั้งเดียวตอนสร้าง: เซิร์ฟเวอร์เก็บแค่ hash ของแต่ละตัวเหมือนรหัสผ่าน ทุกที่ที่ถามรหัสจากแอป (`POST /auth/login`, `POST /me/reauthenticate`, `POST /me/two-factor/disable`) ใช้รหัสกู้คืนที่ยังไม่ใช้แทนได้ครั้งเดียว ไม่สนตัวพิมพ์เล็กใหญ่ ช่องว่าง และขีด ตัวที่ผิดเป็น `invalid_code` และนับเหมือนรหัสผิด การปิด 2 ขั้นตอน หรือผู้ดูแลรีเซ็ตให้ ลบรหัสกู้คืนทิ้ง บันทึก `auth.recovery_code_used` (คนนั้นเป็นทั้ง actor และ target พร้อม `recoveryCodesLeft` ใน changes) และ `auth.recovery_codes_created` เมื่อมีคนสร้างชุดใหม่

### บทบาทที่ต้องใช้การยืนยันตัวตน 2 ขั้นตอน

การตั้งค่าบังคับใช้กับบางบทบาทได้ (`twoFactorRoleIds`) คนที่ถือบทบาทเหล่านั้นอยู่ตอนนี้ (ดูการมอบบทบาท) และยังไม่เปิดยังเข้าสู่ระบบได้ แต่จนกว่าจะเปิด เซิร์ฟเวอร์ตอบทุก request ด้วย `403` `two_factor_mandatory` รวม `GET /events` ยกเว้นที่ต้องใช้เพื่อเปิด: `GET /me`, `GET /settings`, `GET /roles`, `POST /me/reauthenticate` (การเปิดอาจถามรหัสผ่านอีกครั้ง), `POST /me/two-factor` และ `POST /me/two-factor/confirm` (และ `/auth/*` ซึ่งไม่ต้องใช้ access token) มีผลทันทีตั้งแต่ request ถัดไป: ผู้ดูแลที่เพิ่มบทบาทของตัวเองเข้ารายการระหว่างที่ตัวเองปิด 2 ขั้นตอนอยู่ก็ถูกกันไว้ด้วย `POST /me/two-factor/disable` ถูกปฏิเสธด้วย `two_factor_mandatory` ระหว่างที่บทบาทบังคับอยู่ ผู้ดูแลยังปิดให้ได้ด้วย `POST /users/:id/two-factor/reset` แล้วคนนั้นต้องเปิดใหม่ก่อนทำอย่างอื่น

แอปตรวจสิ่งเดียวกันหลังเข้าสู่ระบบ และทุกครั้งที่ request ตอบ `two_factor_mandatory` แล้วพาคนนั้นไปที่ `/setup-two-factor` จนกว่าจะเปิด หน้าการตั้งค่าเตือนผู้ดูแลที่กำลังจะเพิ่มบทบาทของตัวเองเข้ารายการ

## ยืนยันว่าเป็นคุณ

เหมือน sudo mode ของ GitHub และ reauthentication ของ Microsoft Entra ที่ถามรหัสผ่านอีกครั้ง การเปลี่ยนแปลงที่อาจยึดระบบหรือกันคนออกจะผ่านเฉพาะเมื่อคนนั้นเข้าสู่ระบบ หรือยืนยันรหัสผ่าน ภายใน `reauthMinutes` ของการตั้งค่า (10 บนการติดตั้งใหม่; `0` ไม่ถามเลย) การ refresh token ไม่นับ ไม่อย่างนั้นปฏิเสธด้วย `403` `reauth_required` เมื่อรู้แล้วว่า request ได้รับอนุญาต (สิทธิ์ และคนที่ดูแลได้) และก่อนมีอะไรเปลี่ยน:

| การเปลี่ยนแปลง | Request |
| --- | --- |
| มอบ เปลี่ยน หรือถอดบทบาท | `POST /users` และ `POST /users/import` ซึ่งมอบบทบาทให้ผู้ใช้ใหม่; `POST /role-assignments`, `PATCH /role-assignments/:id`, `DELETE /role-assignments/:id`, `POST /role-assignments/batch` |
| สิ่งที่บทบาทอนุญาต | `PATCH /roles/:id` เมื่อ `permissions` เปลี่ยน, `DELETE /roles/:id` |
| ลบคน | `POST /users/delete` |
| การเข้าสู่ระบบของคนอื่น | `POST /users/:id/reset-password`, `POST /users/:id/two-factor/reset`, และ `DELETE /sessions/:id` กับ `POST /users/:id/sessions/end` ที่ทำกับคนอื่น |
| สิ่งที่ใช้กู้บัญชี | `PATCH /users/:id` เมื่อ `email` เปลี่ยน เพราะลิงก์รีเซ็ตรหัสผ่านถูกส่งไปที่นั่น และ `POST /me/two-factor` ซึ่งผูกบัญชีกับแอป authenticator |
| รหัสกู้คืนของตัวเอง | `POST /me/recovery-codes` |
| ปิดรอบทบทวนสิทธิ์ ซึ่งถอดบทบาทที่ตัดสินว่า `remove` | `POST /access-reviews/:id/close` |
| การตั้งค่า | `PATCH /settings` |

รายการนี้ตายตัว คนที่แก้การตั้งค่าจึงเอาข้อไหนออกไม่ได้ การตั้งค่ากำหนดได้แค่ว่าการยืนยันอยู่นานเท่าไร

| Request | Body | คำตอบ |
| --- | --- | --- |
| `POST /me/reauthenticate` | `{ password, code? }` | ไม่มี จดเวลาไว้ที่ session ของ access token รหัสผ่านผิดเป็น `invalid_credentials` ถ้าเปิด 2 ขั้นตอน ไม่มี `code` เป็น `two_factor_required` และรหัสผิดเป็น `invalid_code` |

รหัสผ่านและรหัสที่ผิดนับรวมไปสู่การล็อกบัญชีเหมือนตอนเข้าสู่ระบบ และความพยายามจาก address เดียวมากเกินไปถูกปฏิเสธด้วย `429` `too_many_requests` เมื่อการเปลี่ยนแปลงถูกปฏิเสธด้วย `reauth_required` แอปถามรหัสผ่าน (และรหัส ถ้าเปิด 2 ขั้นตอน) ทับบนหน้าเดิมแล้วส่ง request เดิมอีกครั้ง สิ่งที่พิมพ์ไว้จึงไม่หาย ปิด dialog นั้นแล้วการเปลี่ยนแปลงไม่ถูกส่ง

## อัปเดตแบบสด

ด้วย `new HttpAdminApi({ url: '/api', events: true })` แอปอ่าน event stream ที่ `GET /events` และโหลดข้อมูลใหม่ทุกครั้งที่มีข้อความเข้ามา การเปลี่ยนแปลงของคนอื่นจึงแสดงโดยไม่ต้อง reload `EventSource` ส่ง header `Authorization` ไม่ได้ `HttpAdminApi` จึงอ่าน stream ผ่าน `fetch` (`response.body` ทีละส่วน) พร้อม access token และเชื่อมต่อใหม่ (refresh token ก่อนถ้าจำเป็น) เมื่อ stream ปิด

เซิร์ฟเวอร์ส่ง `data: changed` หลังการเปลี่ยนแปลงแต่ละครั้ง และ comment `: ping` ทุก 25 วินาที และปิด stream เมื่อ access token ที่ใช้เปิดหมดอายุ จึงไม่มีใครได้ยินการเปลี่ยนแปลงต่อด้วย token ที่หมดอายุหรือ session ที่จบแล้ว `HttpAdminApi` จึง refresh token แล้วเชื่อมต่อใหม่ทันที ไม่อ่านเนื้อหาของข้อความ ถ้าไม่เปิด `events` แอปโหลดข้อมูลเมื่อมีคนเข้าสู่ระบบและหลังการเปลี่ยนแปลงของตัวเอง

## ผู้ใช้

| Request | Body | คำตอบ | สิทธิ์ |
| --- | --- | --- | --- |
| `GET /users` | | `User[]` | `users.view`; ผ่านสาขา ได้คนของสาขานั้นและตัวเอง (ดูผู้ดูแลสาขา); ถ้าไม่มี ได้แค่ผู้ใช้ที่เข้าสู่ระบบอยู่ |
| `POST /users` | `UserDraft` | `User` ใหม่ | `users.create` |
| `POST /users/import` | `{ users: UserDraft[] }` | `User` ใหม่ทั้งหมด ได้ทั้งหมดหรือไม่ได้เลย: ปฏิเสธทั้ง request เมื่อมีตัวไหนถูกปฏิเสธ | `users.create` |
| `PATCH /users/:id` | `UserChanges`: `Partial<UserDraft>` ที่ไม่มี `roles` | `User` | `users.edit`; ถ้าไม่มี แก้ได้แค่ `firstName`, `lastName`, `phone`, `avatar` และ `language` ของตัวเอง |
| `POST /users/status` | `{ ids, status, reason? }` | `User` ที่เปลี่ยน | `users.edit` |
| `POST /users/delete` | `{ ids, reason? }` | ไม่มี | `users.delete` |
| `POST /users/:id/reset-password` | `{ reason? }` | ไม่มี | `users.edit` |
| `POST /users/:id/resend-invite` | | ไม่มี; `not_invited` ถ้าสถานะไม่ใช่ `invited` | `users.create` |

`UserDraft.branchId` คือสาขาที่คนนั้นสังกัด (ดูสาขา) หรือ `null` ถ้าไม่มี: สาขาที่ไม่รู้จักเป็น `not_found` สาขาที่ปิดแล้วเป็น `branch_closed` (`409`) เว้นแต่เขาสังกัดอยู่แล้ว

`UserDraft.roles` มอบบทบาทแรกให้ผู้ใช้ใหม่ แต่ละตัวเป็น `RoleGrant` ที่ตรวจแบบเดียวกับ `POST /role-assignments` ถ้าไม่มี ได้ `defaultRoleId` ของการตั้งค่าแบบถาวร บันทึก `role_assignment.added` หนึ่งรายการต่อหนึ่งบทบาท ต่อจาก `user.created` หรือ `user.invited` หลังจากนั้นบทบาทเปลี่ยนได้ทางการมอบบทบาทเท่านั้น: `PATCH /users/:id` ปฏิเสธ `roles` ด้วย `invalid_request`

`language` เป็น `th`, `en` หรือ `null` สำหรับ `defaultLanguage` ของการตั้งค่า: ภาษาของอีเมลถึงคนนั้น (ดูภาษาของอีเมล) ค่าอื่นเป็น `invalid_request` การเปลี่ยน `language` อย่างเดียวไม่เขียน `user.updated` เพราะเป็นค่าที่ชอบส่วนตัว เหมือนธีม และ `PATCH` ที่ไม่ได้เปลี่ยนอะไรที่ประวัติเก็บก็ไม่เขียนเช่นกัน

เซิร์ฟเวอร์กำหนด `id`, `createdAt` และ `lastActiveAt` เอง ผู้ใช้ใหม่สถานะ `invited` ได้อีเมลคำเชิญ อีเมลที่คนอื่นใช้อยู่ให้ปฏิเสธด้วย `email_taken` เมื่อการตั้งค่ามีรายการโดเมนที่อนุญาต อีเมลใหม่หรือที่เปลี่ยนนอกโดเมนเหล่านั้นให้ปฏิเสธด้วย `email_domain`

## การมอบบทบาท

บทบาทของแต่ละคนคือ `RoleAssignment` ใน `User.roles` ตาม NIST RBAC: คนหนึ่งถือได้หลายบทบาท และสิทธิ์ของเขาคือสิทธิ์ของทุกบทบาทที่ถืออยู่ตอนนี้รวมกัน การมอบแต่ละครั้งให้หนึ่งบทบาทตั้งแต่ `startsAt` จนถึง `endsAt` หรือถาวรเมื่อ `endsAt` เป็น `null` นับว่ามีผลระหว่าง `startsAt <= now < endsAt`: ก่อนหน้านั้นคือ *รอเริ่ม* หลังจากนั้นคือ *หมดอายุ* คนที่ไม่ได้ถือบทบาทใดอยู่ตอนนี้ยังเข้าสู่ระบบได้ และเห็นแค่โปรไฟล์ของตัวเอง

**ขอบเขต** เหมือนที่ Azure RBAC กำหนด scope ให้ role assignment: `branchId` `null` ให้บทบาทครอบคลุมทั้งองค์กร สาขาจำกัดไว้ที่สาขานั้น (ต้องเปิดอยู่: `not_found`, `branch_closed`) สิทธิ์ของส่วนจัดการผู้ใช้เอง (`users.*`, `roles.*`, `activity.*`, `settings.*`, `branches.*`, `reviews.*`) มาจากการมอบสำหรับทั้งองค์กร ยกเว้นสี่ตัวที่การมอบที่จำกัดไว้ที่สาขาให้สิทธิ์เหนือคนของสาขานั้น (ดูผู้ดูแลสาขา) นอกจากนั้น การมอบที่จำกัดไว้ที่สาขาให้สิทธิ์ในสาขานั้น ให้โมดูลของแอปเองตรวจ (`session.can(permission, branchId)` ในแอป, `Actor.can(permission, branchId)` บนเซิร์ฟเวอร์)

| Request | Body | คำตอบ | สิทธิ์ |
| --- | --- | --- | --- |
| `POST /role-assignments` | `RoleAssignmentDraft`: `{ userId, roleId, startsAt?, endsAt, reason? }` | `User` | `users.edit` |
| `PATCH /role-assignments/:id` | `{ endsAt?, reason? }` | `User` | `users.edit` |
| `DELETE /role-assignments/:id` | `{ reason? }` | `User` | `users.edit` |
| `POST /role-assignments/batch` | `{ userIds, add: RoleGrant }` หรือ `{ userIds, removeRoleId, reason? }` | `User` ที่เปลี่ยน | `users.edit` |

- **วันที่** ไม่ใส่ `startsAt` หรือใส่ก่อนตอนนี้ แปลว่าตอนนี้ `endsAt` ต้องหลังทั้ง `startsAt` และตอนนี้ ไม่อย่างนั้นเป็น `invalid_request`
- **กฎของแต่ละบทบาท** (`Role.assignment`) ถ้ามี `maxDays` การมอบบทบาทนั้นต้องมีวันจบ ไม่เกินจำนวนวันนั้นหลังเริ่ม: ที่นานกว่า หรือไม่มีวันจบ ปฏิเสธด้วย `assignment_too_long` (`422`) เมื่อ `PATCH` ย้ายวันจบ ให้นับจากวันเริ่มหรือจากตอนนี้ แล้วแต่อันไหนช้ากว่า ถ้ามี `reasonRequired` เหตุผลที่ว่างเป็น `reason_required` (`422`) เหตุผลยาวไม่เกิน 500 ตัวอักษร
- **ทีละครั้ง** การมอบใหม่ที่ทับเวลากับการมอบบทบาทเดียวกันในขอบเขตเดียวกันที่คนนั้นมีอยู่ ปฏิเสธด้วย `already_assigned` (`409`) บทบาทเดียวกันในสองสาขาคือการมอบสองครั้ง จะต่ออายุหรือต่ออันที่หมดอายุแล้ว ให้ `PATCH` `endsAt` ของมัน
- **ใครทำได้** ใช้กฎด้านล่าง: ผู้ทำต้องมี `users.edit` และทุกสิทธิ์ของบทบาทนั้นในขอบเขตของการมอบ (กฎข้อ 2; ดูผู้ดูแลสาขา) และต้องดูแลคนนั้นได้ (กฎข้อ 3) และไม่มีใครเปลี่ยนการมอบบทบาทของตัวเอง (กฎข้อ 4)
- **บทบาทที่ห้ามถือร่วมกัน** บทบาทที่กฎบอกว่าถือร่วมกับบทบาทที่คนนั้นถืออยู่ ตอนนี้หรือภายหลัง ไม่ได้ ในช่วงเวลาที่ทับกัน ปฏิเสธด้วย `role_conflict` (`409`); ดูบทบาทที่ห้ามถือร่วมกัน
- **อันที่หมดอายุยังอยู่** บนผู้ใช้ เพื่อต่ออายุได้ จนกว่าจะเก่ากว่า `activityRetentionDays` ของการตั้งค่า อันที่ถูกถอดหายไปทันที ประวัติการใช้งานเก็บไว้ว่าเคยเป็นอะไร
- **หลายคนพร้อมกัน** `add` มอบบทบาทให้ทุกคนใน `userIds` ที่ยังไม่ได้ถือตอนนี้หรือภายหลัง `removeRoleId` ถอดการมอบบทบาทนั้นทั้งที่มีผลอยู่และที่รอเริ่ม ส่งอย่างใดอย่างหนึ่ง ได้ทั้งหมดหรือไม่ได้เลย: ปฏิเสธทั้ง request เมื่อมีการเปลี่ยนแปลงไหนถูกปฏิเสธ id ที่ซ้ำนับครั้งเดียว และคนที่ไม่มีอะไรต้องเปลี่ยนไม่อยู่ในคำตอบและประวัติ

บันทึกการเปลี่ยนแปลงแต่ละครั้งโดยคนนั้นเป็น target: `role_assignment.added` (changes `roleId`, `branchId`, `startsAt`, `endsAt` โดยเหตุผลของการมอบเป็น `reason` ของรายการ), `role_assignment.updated` (ฟิลด์ที่เปลี่ยน รวม `reason`), `role_assignment.removed` (`roleId` พร้อมเหตุผลของ request) และที่เซิร์ฟเวอร์เขียนเองเมื่อการมอบสิ้นสุด `role_assignment.expired` ด้วย `actorId: null` รอบทบทวนที่ถอดบทบาทเขียน `role_assignment.removed` ด้วย `actorId: null` (ดูการทบทวนสิทธิ์) การลบผู้ใช้ลบการมอบบทบาทของเขาโดยไม่มีรายการของตัวเอง

## สาขา

สาขา (สถานที่ สำนักงาน) มีหรือไม่มีก็ได้: `branchesEnabled` ของการตั้งค่าแสดงหน้าสาขาและช่องสาขา แต่ละคนสังกัดหนึ่งสาขาหรือไม่สังกัดเลย เหมือนที่ Google Workspace ให้ผู้ใช้แต่ละคนอยู่ใน organizational unit เดียว บทบาทจำกัดไว้ที่สาขาได้ (ดูการมอบบทบาท) ปิดสาขาแล้วซ่อนไว้แต่ข้อมูลยังอยู่

| Request | Body | คำตอบ | สิทธิ์ |
| --- | --- | --- | --- |
| `GET /branches` | | `Branch[]` | ทุกคนที่เข้าสู่ระบบ เพื่อแสดงชื่อสาขา |
| `POST /branches` | `BranchDraft`: `{ code, name }` | `Branch` ใหม่ | `branches.manage` |
| `PATCH /branches/:id` | `Partial<BranchDraft>` และ `active` | `Branch` | `branches.manage` |
| `DELETE /branches/:id` | | ไม่มี; `branch_in_use` ระหว่างที่มีคนสังกัด หรือถือบทบาทที่นั่นอยู่ตอนนี้หรือภายหลัง | `branches.manage` |

`code` สั้น (ตัวอักษร ตัวเลข หรือขีด 1 ถึง 10 ตัว เก็บเป็นตัวพิมพ์ใหญ่) และไม่ซ้ำ ไม่สนตัวพิมพ์: `code_taken` (`409`) `name` ยาว 1 ถึง 100 ตัวอักษร สาขาที่ปิด (`active: false`) เก็บคนและบทบาทของเขาไว้ แต่ไม่มีใครใหม่เข้าสังกัดหรือได้บทบาทที่นั่น การลบสาขาลบการมอบบทบาทที่จบแล้วซึ่งจำกัดไว้ที่สาขานั้น บันทึก `branch.created`, `branch.updated` (ฟิลด์ที่เปลี่ยน) และ `branch.deleted`

## ผู้ดูแลสาขา

เหมือน administrative unit ของ Microsoft Entra และ organizational unit ของ Google Workspace ที่ให้คนดูแลส่วนหนึ่งขององค์กร บทบาทที่จำกัดไว้ที่สาขาให้สิทธิ์ของส่วนจัดการผู้ใช้สี่ตัวเหนือคนที่สังกัดสาขานั้น (`User.branchId`) ผู้จัดการสาขาจึงดูแลพนักงานของสาขาตัวเองและไม่ใช่ใครอื่น การลบคน บทบาท การตั้งค่า สาขา การทบทวนสิทธิ์ และการ export ประวัติ (`users.delete`, `roles.*`, `settings.*`, `branches.*`, `reviews.*`, `activity.export`) ยังต้องมีบทบาทสำหรับทั้งองค์กร คนที่มีสิทธิ์ใดในสี่ตัวนี้ผ่านสาขาเท่านั้นได้:

| สิทธิ์ | ผ่านสาขา |
| --- | --- |
| `users.view` | `GET /users` ตอบคนของสาขาเหล่านั้น และตัวเอง |
| `users.create` | `POST /users` และ `POST /users/import` ที่ `branchId` เป็นหนึ่งในสาขาเหล่านั้น และ `POST /users/:id/resend-invite` สำหรับคนของเขา ผู้ใช้ใหม่ที่ไม่ได้มอบบทบาทได้บทบาทเริ่มต้นของการตั้งค่าจำกัดไว้ที่สาขาของตัวเอง |
| `users.edit` | การเปลี่ยนแปลงกับคนของสาขาเหล่านั้น: `PATCH /users/:id` (ย้ายได้แค่ไปอีกสาขาในกลุ่มนั้น) สถานะ รหัสผ่าน 2 ขั้นตอน อุปกรณ์ และการมอบบทบาท |
| `activity.view` | `GET /activity` ตอบรายการที่ `targetId` เป็นคนของสาขาเหล่านั้น |

บทบาทว่าไปตามขอบเขต การมอบสำหรับทั้งองค์กรต้องมี `users.edit` (`users.create` สำหรับบทบาทของผู้ใช้ใหม่) สำหรับทั้งองค์กร การมอบที่จำกัดไว้ที่สาขาต้องมีที่สาขานั้น กฎข้อ 2 และ 3 นับแบบเดียวกัน: สิ่งที่ใครมีในสาขา คือสิ่งที่บทบาทสำหรับทั้งองค์กรของเขาอนุญาต รวมกับสิ่งที่บทบาทที่จำกัดไว้ที่สาขานั้นอนุญาต มอบบทบาทที่จำกัดไว้ที่สาขาได้ก็ต่อเมื่อมีทุกสิทธิ์ของบทบาทนั้นที่นั่น และดูแลคนได้ก็ต่อเมื่อมี สำหรับทุกบทบาทที่คนนั้นถือตอนนี้หรือภายหลัง ทุกสิทธิ์ของบทบาทนั้นในขอบเขตของมัน จึงไม่มีใครดูแลผ่านสาขาได้กับคนที่บทบาทสำหรับทั้งองค์กรอนุญาตมากกว่าบทบาทสำหรับทั้งองค์กรของตัวเอง นอกนั้นเป็น `forbidden`

## บทบาท

| Request | Body | คำตอบ | สิทธิ์ |
| --- | --- | --- | --- |
| `GET /roles` | | `Role[]` | ทุกคนที่เข้าสู่ระบบ |
| `POST /roles` | `RoleDraft` | `Role` ใหม่ | `roles.manage` |
| `PATCH /roles/:id` | `Partial<RoleDraft>` | `Role` | `roles.manage` |
| `DELETE /roles/:id` | | ไม่มี; `system_role` สำหรับบทบาทในตัวระบบ, `role_in_use` ระหว่างที่มีคนถืออยู่ตอนนี้หรือภายหลัง, `default_role` ระหว่างที่การตั้งค่าให้บทบาทนี้กับผู้ใช้ใหม่ | `roles.manage` |

`Role.assignment` กำหนดว่าบทบาทมอบได้อย่างไร (ดูการมอบบทบาท): `maxDays` (1 ถึง 365 หรือ `null` ไม่จำกัด) และ `reasonRequired` บทบาทใหม่ที่ไม่มีค่านี้ได้ `{ maxDays: null, reasonRequired: false }` การลบบทบาทลบการมอบที่หมดอายุแล้วไปด้วย

**บทบาทในตัวระบบ** (`system: true`) มาจากโค้ดของเซิร์ฟเวอร์ เหมือน built-in role ของ Microsoft Entra และ AWS: `name`, `description` และ `permissions` เหมือนกันทุกการติดตั้ง และกลับมาเป็นค่าเดิมหลังอัปเกรด และบทบาท Administrator ในตัวระบบถือทุกสิทธิ์ รวมที่เพิ่มภายหลัง `PATCH` เปลี่ยนได้แค่ `tone` และ `assignment` อย่างอื่นเป็น `system_role` จะให้คนของบทบาทในตัวระบบได้สิ่งที่ต่างออกไป ให้คัดลอกเป็นบทบาทใหม่ (หน้าบทบาทมี "ทำสำเนา") แล้วมอบบทบาทนั้นแทน

## เหตุผล

เหมือนที่ Microsoft Entra ถาม justification การเปลี่ยนแปลงที่ถอนหรือรีเซ็ตสิทธิ์ของใครแนบเหตุผลได้: `reason` ตัดช่องว่างหัวท้าย ยาวไม่เกิน 500 ตัวอักษร ประวัติการใช้งานเก็บไว้เป็น `Activity.reason` ของรายการ `reasonsRequired` ของการตั้งค่าบอกว่ารายการไหนต้องมี ที่นั่นเหตุผลว่างเป็น `reason_required` (`422`) อย่างอื่นรับเหตุผลถ้ามีให้

| `reasonsRequired` | Request | รายการ |
| --- | --- | --- |
| `status` | `POST /users/status` | `user.suspended`, `user.activated` |
| `delete` | `POST /users/delete` | `user.deleted` |
| `removeRole` | `DELETE /role-assignments/:id`; `POST /role-assignments/batch` ที่มี `removeRoleId`; `remove` ใน `POST /access-reviews/:id/decisions` เป็น `note` ของมัน | `role_assignment.removed`, `access_review.decided` |
| `resetSignIn` | `POST /users/:id/reset-password`; `POST /users/:id/two-factor/reset` | `user.password_reset`, `auth.two_factor_off` |
| `endSessions` | `DELETE /sessions/:id`, `POST /users/:id/sessions/end` ที่ทำกับคนอื่น | `auth.sessions_ended` |

ไม่มีใครต้องใส่เหตุผลสำหรับ session หรือรหัสผ่านของตัวเอง `reason` ของการมอบบทบาทใหม่ (ดูการมอบบทบาท ที่ `Role.assignment.reasonRequired` เป็นตัวกำหนด) คือเหตุผลของรายการ `role_assignment.added`

## บทบาทที่ห้ามถือร่วมกัน

เหมือน static separation of duty ของ NIST RBAC กฎหนึ่งข้อระบุบทบาทที่ห้ามใครถือพร้อมกัน คนเดียวจึงไม่ทั้งทำและตรวจงานเดียวกัน

| Request | Body | คำตอบ | สิทธิ์ |
| --- | --- | --- | --- |
| `GET /role-conflicts` | | `RoleConflict[]` | ทุกคนที่เข้าสู่ระบบ |
| `POST /role-conflicts` | `RoleConflictDraft`: `{ name, description?, roleIds }` | `RoleConflict` ใหม่ | `roles.manage` |
| `PATCH /role-conflicts/:id` | `Partial<RoleConflictDraft>` | `RoleConflict` | `roles.manage` |
| `DELETE /role-conflicts/:id` | | ไม่มี | `roles.manage` |

`name` ยาว 1 ถึง 100 ตัวอักษร `description` ไม่เกิน 500 และ `roleIds` เป็นบทบาทที่มีอยู่จริงต่างกัน 2 ถึง 20 บทบาท (ไม่อย่างนั้น `not_found`) การมอบบทบาท (`POST /role-assignments`, `add` ใน `POST /role-assignments/batch`, บทบาทของผู้ใช้ใหม่หรือที่นำเข้า) ถูกปฏิเสธด้วย `role_conflict` (`409`) เมื่อคนนั้นถือ ตอนนี้หรือภายหลัง บทบาทอื่นของกฎที่มีบทบาทนั้น ในช่วงเวลาที่การมอบใหม่ทับ ขอบเขตไม่มีผล: บทบาทของสาขาเดียวก็ยังทำให้คนเดียวทำได้ทั้งสองอย่าง การย้ายวันจบของการมอบ (`PATCH /role-assignments/:id`) ก็ตรวจแบบเดียวกัน

กฎที่สร้างขึ้นระหว่างที่มีคนถือบทบาทของกฎอยู่แล้วยังเก็บไว้: หน้าบทบาทแสดงพวกเขาเป็นคนที่ต้องแก้ และกฎกันคนใหม่ การลบบทบาทเอาออกจากกฎ กฎที่เหลือไม่ถึงสองบทบาทถูกลบไปด้วย บันทึก `role_conflict.created`, `role_conflict.updated` (`name` และ `description` ที่เปลี่ยน และ `roles` เป็นรายการที่เพิ่มและเอาออก) และ `role_conflict.deleted`

## การทบทวนสิทธิ์

เหมือน access review ของ Microsoft Entra และการตรวจเป็นระยะว่าใครทำอะไรได้ที่ ISO 27001 (control 5.18) และเกณฑ์ความเสี่ยงด้าน IT ของธนาคารแห่งประเทศไทยกำหนด รอบทบทวนถามว่าแต่ละคนยังต้องใช้บทบาทที่ถืออยู่หรือไม่ คนที่มี `reviews.manage` เริ่มรอบ คนที่ดูแลแต่ละคนตัดสินก่อนวันกำหนดว่าบทบาทแต่ละตัวของเขาอยู่หรือไป เมื่อปิดรอบ บทบาทที่ตัดสินว่าไปถูกถอด และรอบทบทวนอยู่เป็นหลักฐานที่ผู้ตรวจสอบขอ

| Request | Body | คำตอบ | สิทธิ์ |
| --- | --- | --- | --- |
| `GET /access-reviews` | | `AccessReview[]` ใหม่สุดก่อน | `reviews.manage`: ทุกรอบ; ถ้าไม่มี รอบที่ตัวเองมีส่วนร่วม (ดูใครตัดสิน) |
| `POST /access-reviews` | `AccessReviewDraft`: `{ name, roleId?, branchId?, dueAt, reviewerIds? }` | `AccessReview` ใหม่ | `reviews.manage` |
| `GET /access-reviews/:id/items` | | `AccessReviewItem[]` เรียงตามคน | `reviews.manage` หรือคนที่รอบทบทวนระบุชื่อ: ทั้งหมด; ถ้าไม่มี รายการที่ตัวเองตัดสินได้ (หรือเคยตัดสิน เมื่อรอบปิดแล้ว) และ `not_found` สำหรับรอบที่ไม่ได้มีส่วนร่วม |
| `POST /access-reviews/:id/decisions` | `{ itemIds, decision, note? }` | `AccessReviewItem` ที่ตัดสิน | คนที่ตัดสินได้ทุกรายการนั้น |
| `POST /access-reviews/:id/close` | | `AccessReview` ที่ปิดแล้ว | `reviews.manage` |
| `DELETE /access-reviews/:id` | | ไม่มี | `reviews.manage`; เฉพาะรอบที่ยังเปิด |

**ครอบคลุมอะไร** การเริ่มรอบเก็บ ณ ขณะนั้น ทุกการมอบบทบาทที่มีผลอยู่หรือภายหลัง (ยังไม่จบ) ของคนในขอบเขต: ของบทบาท `roleId` หรือทุกบทบาทเมื่อไม่ใส่หรือเป็น `null`; ของคนที่สังกัดสาขา `branchId` (`User.branchId`) หรือทุกคน แต่ละตัวเป็น `AccessReviewItem` ที่เก็บชื่อและอีเมลของคน ชื่อบทบาท ขอบเขตและวันที่ของการมอบเป็นข้อความ รายงานจึงอ่านได้เหมือนเดิมหลังสิ่งเหล่านั้นเปลี่ยนหรือถูกลบ `name` ยาว 1 ถึง 100 ตัวอักษร `dueAt` เป็นเวลาหลังตอนนี้และไม่เกิน 365 วันข้างหน้า `reviewerIds` ไม่เกิน 20 คนที่ต่างกัน บทบาท สาขา หรือคนที่ไม่รู้จักเป็น `not_found` ผิดอย่างอื่นเป็น `invalid_request`

**ใครตัดสิน** การมอบหนึ่งรายการตัดสินโดยคนที่ดูแลผู้ถือ: คนที่ดูแลเขาได้ด้วย `users.edit` (กฎข้อ 1, 3 และ 4 ผู้ดูแลสาขาจึงตัดสินให้คนของสาขาตัวเอง) และมีทุกสิทธิ์ของบทบาทนั้นในขอบเขตของการมอบ คนที่รอบทบทวนระบุใน `reviewerIds` ตัดสินได้ทั้งหมดด้วย ไม่มีใครตัดสินบทบาทของตัวเอง คนที่ไม่มี `reviews.manage` มีส่วนร่วมในรอบที่ระบุชื่อเขา ในรอบที่เปิดอยู่ซึ่งมีการมอบที่เขาตัดสินได้ และในรอบที่ปิดแล้วซึ่งเขาเคยตัดสิน: `GET /access-reviews` แสดงรอบเหล่านั้น และ `GET …/items` ตอบการมอบเหล่านั้น เฉพาะที่เขาตัดสินเมื่อรอบปิดแล้ว (ทั้งหมด สำหรับคนที่รอบระบุชื่อ) ใครตัดสินได้คำนวณตอนที่ถาม จากบทบาทที่แต่ละคนถืออยู่ตอนนั้น `canDecide` ทำเครื่องหมายแต่ละการมอบที่ผู้ใช้ที่เข้าสู่ระบบอยู่ตัดสินได้ตอนนี้ และแต่ละรอบบอกว่ามีกี่ตัวที่ยังรอการตัดสิน (`waitingCount`)

**การตัดสิน** `decision` เป็น `keep` หรือ `remove` `note` ไม่เกิน 500 ตัวอักษร บอกเหตุผล ถ้ามี `removeRole` ใน `reasonsRequired` ของการตั้งค่า (ดูเหตุผล) `remove` ที่ไม่มี note เป็น `reason_required` การตัดสินยังไม่เปลี่ยนอะไรและเปลี่ยนได้จนกว่ารอบจะปิด: อันสุดท้ายนับ พร้อมผู้ตัดสินและเวลา ได้ทั้งหมดหรือไม่ได้เลย: การมอบของรอบอื่นเป็น `not_found` อันที่คนนั้นตัดสินไม่ได้เป็น `forbidden` ของตัวเองเป็น `self_change` และไม่มีอะไรถูกตัดสิน ในรอบที่ปิดแล้วเป็น `review_closed` (`409`)

**การปิด** ที่ `dueAt` เซิร์ฟเวอร์ปิดรอบเอง `POST …/close` ปิดก่อนได้ ซึ่งเป็นการเปลี่ยนแปลงที่ถามรหัสผ่านอีกครั้ง (ดูยืนยันว่าเป็นคุณ) การปิดถอดทุกการมอบที่ตัดสินว่า `remove` โดยเขียน `role_assignment.removed` ด้วย `actorId: null` ชื่อรอบเป็น `accessReview` ใน changes และ note ของการตัดสินเป็นเหตุผล และให้ `outcome` กับทุกรายการ:

| `outcome` | เมื่อ |
| --- | --- |
| `kept` | ตัดสินว่า `keep` |
| `removed` | ตัดสินว่า `remove` และถูกถอดแล้ว |
| `not_reviewed` | ไม่มีใครตัดสิน: ยังอยู่ และรายงานบอกไว้ |
| `gone` | ตัดสินว่า `remove` แต่จบไปแล้วหรือถูกถอดไปก่อน |
| `last_administrator` | ตัดสินว่า `remove` แต่จะไม่เหลือใครดูแลระบบ (กฎข้อ 6): ยังอยู่ |

รอบที่ปิดแล้วเปลี่ยนหรือลบไม่ได้ (`review_closed`): เป็นหลักฐาน บันทึก `access_review.started` (`roleId` และ `branchId` ถ้าให้มา, `dueAt`, `reviewers` เป็นรายการที่เพิ่ม และจำนวน `assignments`), `access_review.decided` (`decision` และจำนวน `assignments` โดย note เป็นเหตุผล), `access_review.closed` (จำนวนที่ `kept`, `removed` และ `notReviewed`; `actorId: null` เมื่อเซิร์ฟเวอร์ปิดเอง) และ `access_review.deleted` แต่ละรายการมีรอบทบทวนเป็น target เมื่อรอบเริ่ม เซิร์ฟเวอร์ส่งอีเมลถึงคนที่ active ซึ่งตัดสินบางส่วนได้ บอกว่ากี่รายการและภายในเมื่อไร (ดูอีเมลแจ้งเรื่องบัญชีของคุณ)

## ประวัติการใช้งาน

| Request | คำตอบ | สิทธิ์ |
| --- | --- | --- |
| `GET /activity?from=&to=` | `Activity[]` ใหม่สุดก่อน ไม่เกิน 10,000 รายการ `from` และ `to` (ใส่หรือไม่ก็ได้ทั้งคู่) เก็บรายการตั้งแต่ `from` และก่อน `to` แต่ละตัวเป็นเวลาแบบ ISO 8601 ที่มี `Z` หรือ offset เช่น `2026-10-01T00:00:00.000Z` หรือ `2026-10-01T07:00:00+07:00` วันที่อย่างเดียวหรือเวลาที่ไม่มี offset เป็น `invalid_request` | `activity.view`; ผ่านสาขา รายการเกี่ยวกับคนของสาขานั้น; ถ้าไม่มี รายการว่าง |

เซิร์ฟเวอร์เขียนประวัติเอง หนึ่งรายการต่อหนึ่งการเปลี่ยนแปลง `actorId` จาก session และ `ip`, `browser` และ `os` จาก request สิ่งที่เซิร์ฟเวอร์ทำเอง เช่นจบการมอบตามเวลา มี `actorId: null` และ `ip`, `browser`, `os` ว่าง `changes` บอกฟิลด์ที่เปลี่ยน และ `reason` คือเหตุผลของ request ถ้ามี (ดูเหตุผล) ดู `Activity` ใน `data/models.ts` และวิธีที่ `data/local-admin-api.ts` เติมค่า รายการที่เก่ากว่า `activityRetentionDays` ของการตั้งค่าถูกลบทุกคืน

## การตั้งค่า

| Request | Body | คำตอบ | สิทธิ์ |
| --- | --- | --- | --- |
| `GET /settings` | | `AdminSettings` | ทุกคนที่เข้าสู่ระบบ |
| `PATCH /settings` | `Partial<AdminSettings>` | `AdminSettings` | `settings.manage` |

`defaultRoleId` คือบทบาทที่ผู้ใช้ใหม่ได้แบบถาวรเมื่อ `POST /users` หรือแถวที่นำเข้าไม่ได้ให้บทบาท จำกัดไว้ที่สาขาของเขาเมื่อมีคนเพิ่มผ่านสาขา (ดูผู้ดูแลสาขา) `branchesEnabled` (`false` บนการติดตั้งใหม่) เปิดใช้สาขา `reasonsRequired` (ดูเหตุผล; `["status", "delete"]` บนการติดตั้งใหม่) บอกการเปลี่ยนแปลงที่ต้องมีเหตุผล รายการที่ไม่รู้จักเป็น `invalid_request` และเก็บโดยไม่ซ้ำ `reauthMinutes` (0 ถึง 1440; 10 บนการติดตั้งใหม่) คือการเข้าสู่ระบบหรือการยืนยันรหัสผ่านให้คนนั้นทำการเปลี่ยนแปลงในหัวข้อยืนยันว่าเป็นคุณได้นานเท่าไร `defaultLanguage` (`th` หรือ `en`; `th` บนการติดตั้งใหม่) คือภาษาของอีเมลถึงคนที่ `language` เป็น `null` เช่นคนที่เพิ่งถูกเชิญ (ดูภาษาของอีเมล) `suspendInactiveDays` (0 ถึง 3650; 0 คือปิด บนการติดตั้งใหม่): ทุกคืนเซิร์ฟเวอร์ระงับบัญชี active ที่ `lastActiveAt` (หรือ `createdAt` สำหรับคนที่ไม่เคยเข้าสู่ระบบ) เก่ากว่านั้น ตามที่การตรวจสอบ IT ขอสำหรับบัญชีที่ไม่มีใครใช้ และเขียน `user.suspended` ของแต่ละคนด้วย `actorId: null` และ `inactiveDays` ใน changes แล้วส่งอีเมลถึงพวกเขา; ไม่ระงับผู้ใช้ active คนสุดท้ายที่ดูแลระบบได้ (กฎข้อ 6) นอกจากบทบาทเริ่มต้น โดเมนที่อนุญาต อายุคำเชิญ และเวลาออกจากระบบเมื่อไม่ได้ใช้งาน `AdminSettings` ยังเก็บกฎของบัญชี: `twoFactorRoleIds` (บทบาทที่ต้องใช้ 2 ขั้นตอน), `passwordMinLength` (8 ถึง 64), `passwordHistory` (0 ถึง 24) และ `activityRetentionDays` (90 ถึง 3650: อย่างน้อย 90 วัน ตามที่ พ.ร.บ. ว่าด้วยการกระทำความผิดเกี่ยวกับคอมพิวเตอร์ มาตรา 26 ให้ผู้ให้บริการเก็บข้อมูลจราจรทางคอมพิวเตอร์ การติดตั้งที่เคยเก็บน้อยกว่าจะเก็บ 90) ค่านอกช่วงให้ปฏิเสธด้วย `invalid_request` และ id บทบาทที่ไม่รู้จักด้วย `not_found` เก็บ `allowedDomains` เป็นตัวพิมพ์เล็กไม่ซ้ำ และ `twoFactorRoleIds` ไม่ซ้ำ การลบบทบาทเอาออกจากรายการนั้น บันทึก `settings.updated` บอกฟิลด์ที่เปลี่ยน โดยสามรายการเป็นรายการที่เพิ่มและเอาออก `sessionTimeoutMinutes` บังคับโดยแอป และโดยเซิร์ฟเวอร์ด้วย: session ที่ไม่ได้ส่ง request นานขนาดนั้น (คลาดเคลื่อนได้ราวนาทีที่ `lastSeenAt` เก็บไว้) จบลง request หรือการ refresh ถัดไปจึงเป็น `401` `unauthenticated` เบราว์เซอร์ที่ถูกทิ้งไว้พร้อม refresh cookie ไม่ได้อะไรจากมัน

## กฎที่เซิร์ฟเวอร์ต้องตรวจ

หน้าต่างๆ ซ่อนสิ่งที่บทบาททำไม่ได้ แต่มีแค่เซิร์ฟเวอร์ที่บังคับได้จริง `data/local-admin-api.ts` ตรวจกฎเดียวกันและเป็นตัวอย่างที่ใช้งานได้ พร้อมตัวช่วยใน `data/access-rules.ts`:

1. แต่ละ request ต้องมีสิทธิ์ตามตารางด้านบน สำหรับทั้งองค์กร หรือ ในที่ที่หัวข้อผู้ดูแลสาขาบอกไว้ ในสาขา ปฏิเสธด้วย `403` และ `forbidden`
2. ไม่มีใครให้มากกว่าที่ตัวเองมี ปฏิเสธด้วย `forbidden` เมื่อใคร:
   - มอบบทบาท (การมอบใหม่ การเปลี่ยนการมอบ หรือบทบาทของผู้ใช้ใหม่) ที่ให้สิทธิ์ที่ตัวเองไม่มี
   - เพิ่มหรือเอาสิทธิ์ที่ตัวเองไม่มีออกจากบทบาท
3. ไม่มีใครดูแลคนที่ถือ ตอนนี้หรือภายหลัง บทบาทที่ให้สิทธิ์ที่ตัวเองไม่มีในขอบเขตของบทบาทนั้น (ดูผู้ดูแลสาขา) ปฏิเสธการแก้ไข ระงับ ลบ รีเซ็ต หรือเชิญคนนั้น หรือเปลี่ยนการมอบบทบาทของเขา ด้วย `forbidden` บทบาทก็เหมือนกัน: ไม่มีใครแก้หรือลบบทบาทที่ให้สิทธิ์ที่ตัวเองไม่มี
4. ไม่มีใครระงับหรือลบตัวเอง เปลี่ยนการมอบบทบาทของตัวเอง หรือเปลี่ยนสิทธิ์ของบทบาทที่ตัวเองถืออยู่ ปฏิเสธด้วย `self_change`
5. รับเฉพาะฟิลด์ที่แต่ละ request ตั้งได้ (ฟิลด์ของ `UserDraft`, `UserChanges`, `RoleAssignmentDraft`, `RoleDraft`, `AccessReviewDraft` และ `AdminSettings`) และปฏิเสธอย่างอื่นด้วย `invalid_request` จึงไม่มีใครตั้ง `id`, ธง `system` หรือวันที่ที่เซิร์ฟเวอร์เก็บได้
6. ต้องมีคนดูแลระบบได้เสมอ เหมือนที่ Google Workspace เก็บ super administrator คนสุดท้ายไว้: อย่างน้อยหนึ่งผู้ใช้ active ถือ แบบถาวรและสำหรับทั้งองค์กร บทบาทที่มีทุกสิทธิ์ ปฏิเสธการถอดการมอบนั้น การให้วันจบ หรือการระงับหรือลบผู้ถือ เมื่อเป็นคนสุดท้าย ด้วย `last_administrator` (`409`)

## Error

ปฏิเสธ request ด้วย status 4xx และ body เช่น `{ "code": "email_taken" }` body มีมากกว่านั้นได้ เช่นฟิลด์อื่นของ problem detail ตาม RFC 9457 code ทั้งหมดอยู่ใน `AdminApiErrorCode` ใน `data/admin-api.ts` และหน้าต่างๆ แสดงข้อความสำหรับแต่ละตัว status ที่ `localBackend` ใช้:

| Status | Code |
| --- | --- |
| `401` | `unauthenticated` (ไม่มี access token หรือหมดอายุ หรือ session ของมันจบแล้ว), `invalid_credentials`, `two_factor_required`, `invalid_code` |
| `403` | `forbidden`, `self_change`, `account_suspended`, `invite_pending`, `two_factor_mandatory`: บทบาทบังคับ 2 ขั้นตอนแต่ยังปิดอยู่; `reauth_required`: การเปลี่ยนแปลงต้องยืนยันรหัสผ่านอีกครั้ง |
| `404` | `not_found` |
| `400` | `invalid_request`: ฟิลด์ที่ request ตั้งไม่ได้ หรือค่าผิดชนิด; `invalid_token`: ลิงก์ในอีเมลที่หมดอายุหรือถูกใช้แล้ว |
| `409` | `email_taken`, `role_in_use`, `system_role`, `not_invited`, `default_role`, `already_assigned`, `last_administrator`, `code_taken`, `branch_in_use`, `branch_closed`, `role_conflict`, `review_closed` |
| `422` | `email_domain`, `weak_password`, `password_reused`, `assignment_too_long`, `reason_required` |
| `429` | `too_many_requests`: ความพยายามเข้าสู่ระบบ refresh หรือรีเซ็ตจาก address เดียวมากเกินไป หรือการตรวจรหัสผ่านหรือรหัส (`POST /me/reauthenticate`, `POST /me/password`, `POST /me/two-factor/disable`) มากเกินไป |

ถ้าไม่มี code ที่รู้จัก `401` นับเป็น `unauthenticated`, `403` เป็น `forbidden`, `404` เป็น `not_found` และ `429` เป็น `too_many_requests` เมื่อการ refresh แก้ `unauthenticated` ไม่ได้ แอปพาคนนั้นไปเข้าสู่ระบบ แล้วพากลับมาหน้าที่อยู่ก่อนหน้า ความล้มเหลวอื่น (ออฟไลน์, `5xx`) แสดง "Something went wrong"
