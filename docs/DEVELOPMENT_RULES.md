# DEVELOPMENT_RULES.md

# Hua Saphan Care — Development Rules

เอกสารนี้ใช้เป็นกติกาหลักในการพัฒนาเว็บแอป `Hua Saphan Care` เพื่อให้การเขียนโค้ดด้วยตนเองหรือสั่งงาน AI Coding เช่น Codex ใน VS Code เป็นไปตามแผน ไม่หลุดขอบเขต ไม่ทำระบบซับซ้อนเกินจำเป็น และสามารถดูแลต่อได้จริง

> ใช้คู่กับ `README.md`, `APP_SPEC.md`, `UI_FLOW.md`, `DATA_SCHEMA.md`, และ `API_SPEC.md`

---

## 1. หลักการพัฒนาหลัก

แนวทางหลักของโครงการนี้คือ:

```txt
เริ่มง่าย ใช้จริงก่อน ขยายทีหลัง
```

ต้องยึดหลักต่อไปนี้เสมอ:

- ทำระบบ MVP ให้ใช้งานจริงได้ก่อน
- ใช้โครงสร้าง Cloudflare Pages + Pages Functions + D1 + R2
- ใช้ HTML/CSS/JavaScript ธรรมดาในช่วงเริ่มต้น
- ไม่เริ่มด้วย React, Vue, Svelte, Next.js หรือ framework หนัก
- ไม่แยก backend เป็นโปรเจกต์ใหม่ถ้ายังไม่จำเป็น
- ไม่ทำฟีเจอร์เกิน Roadmap ที่กำหนด
- ไม่เพิ่มระบบซับซ้อนเพียงเพราะทำได้
- ต้องเขียนโค้ดให้อ่านง่าย แก้ต่อได้ และอธิบายได้

---

## 2. ขอบเขตเทคโนโลยีที่อนุญาตใน MVP

### Frontend

อนุญาต:

- HTML
- CSS
- JavaScript แบบ Vanilla
- Fetch API
- Browser image compression ด้วย Canvas
- LocalStorage เฉพาะข้อมูลชั่วคราวที่ไม่อ่อนไหว
- PWA manifest หลัง MVP หลักทำงานแล้ว

ไม่ควรใช้ใน MVP:

- React
- Vue
- Angular
- Next.js
- Nuxt
- SvelteKit
- jQuery
- Bootstrap ถ้าไม่จำเป็น
- UI library หนัก
- State management library
- TypeScript ถ้าทำให้ผู้พัฒนาดูแลยากขึ้น

### Backend / API

อนุญาต:

- Cloudflare Pages Functions
- D1 binding ชื่อ `DB`
- R2 binding ชื่อ `BUCKET`
- JavaScript module export สำหรับ Pages Functions
- Cookie-based session สำหรับ Admin

ไม่ควรใช้ใน MVP:

- Node.js server แยก
- Express
- Hono เว้นแต่มีเหตุผลชัดเจน
- Prisma / ORM หนัก
- External paid API
- Real-time websocket
- Queue / Cron ที่ยังไม่จำเป็น

### Database / Storage

อนุญาต:

- Cloudflare D1 สำหรับข้อมูลตาราง
- Cloudflare R2 สำหรับไฟล์แนบ
- CSV export แบบง่าย

ไม่ควรใช้ใน MVP:

- เก็บรูปใน D1
- เก็บ binary/base64 image ใน database
- ใช้หลายฐานข้อมูลพร้อมกัน
- ใช้ Supabase/Neon ปนกับ D1 ในโปรเจกต์เดียว
- สร้าง schema ซับซ้อนเกินจำเป็น

---

## 3. โครงสร้างไฟล์ที่ต้องรักษา

ต้องรักษาโครงสร้างหลักให้ใกล้เคียงนี้:

```txt
hua-saphan-care/
├─ README.md
├─ wrangler.toml
├─ package.json
├─ schema.sql
├─ seed.sql
├─ public/
│  ├─ index.html
│  ├─ report.html
│  ├─ success.html
│  ├─ track.html
│  ├─ works.html
│  ├─ emergency.html
│  ├─ offline.html
│  ├─ manifest.webmanifest
│  ├─ css/
│  │  ├─ style.css
│  │  ├─ components.css
│  │  └─ admin.css
│  ├─ js/
│  │  ├─ app.js
│  │  ├─ api.js
│  │  ├─ report-form.js
│  │  ├─ image-compress.js
│  │  ├─ track.js
│  │  └─ works.js
│  └─ admin/
│     ├─ login.html
│     ├─ dashboard.html
│     ├─ reports.html
│     ├─ report-detail.html
│     ├─ categories.html
│     ├─ users.html
│     ├─ news.html
│     ├─ settings.html
│     └─ reports-export.html
├─ functions/
│  ├─ _middleware.js
│  └─ api/
│     ├─ health.js
│     ├─ auth/
│     ├─ public/
│     ├─ reports/
│     ├─ uploads/
│     └─ admin/
└─ docs/
   ├─ APP_SPEC.md
   ├─ UI_FLOW.md
   ├─ DATA_SCHEMA.md
   ├─ API_SPEC.md
   └─ DEVELOPMENT_RULES.md
```

ห้ามย้ายไฟล์หลักโดยไม่มีเหตุผล เพราะจะทำให้ README และ Prompt Pack คุมงานไม่ได้

---

## 4. ลำดับการพัฒนาที่ต้องทำตาม

ห้ามสั่ง AI Coding สร้างทั้งระบบครั้งเดียว ให้ทำเป็นลำดับเท่านั้น

### Phase 0: Project Setup

ต้องทำให้เสร็จก่อน:

- สร้างโครงสร้างไฟล์
- สร้าง `wrangler.toml`
- สร้าง `schema.sql`
- สร้าง `seed.sql`
- สร้าง `/api/health`
- ทดสอบ D1/R2 bindings

ห้ามข้ามไปทำ Admin Dashboard ถ้า `/api/health` ยังไม่ผ่าน

### Phase 1: Public Report MVP

ต้องทำให้เสร็จก่อน:

- หน้าแรก
- หน้าแจ้งเรื่อง
- ดึงหมวดจาก D1
- validation แบบฟอร์ม
- ส่งเรื่องใหม่
- สร้าง tracking code
- บันทึก D1
- อัปโหลดภาพไป R2
- หน้า success

### Phase 2: Tracking

ต้องทำให้เสร็จก่อน:

- หน้า track
- ค้นหาด้วย tracking code
- แสดงสถานะล่าสุด
- แสดง timeline แบบ public
- ซ่อนข้อมูลส่วนตัว

### Phase 3: Admin Login

ต้องทำให้เสร็จก่อน:

- login page
- password hash
- session cookie
- logout
- auth middleware
- ป้องกันหน้า `/admin/*`

### Phase 4: Admin Report Management

ทำหลังจาก login ใช้งานได้แล้ว:

- dashboard
- reports list
- report detail
- change status
- update timeline
- assignment
- audit log

### Phase 5: Public Works / Feedback

ทำหลังจาก Admin ปิดเรื่องได้แล้ว:

- เลือกเรื่องเผยแพร่
- works page
- feedback form
- ซ่อนข้อมูลส่วนตัวเสมอ

### Phase 6: Export / Report

ทำหลังจากข้อมูลจริงเริ่มครบ:

- CSV export
- filter รายงาน
- summary รายเดือน

### Phase 7: PWA / Polish

ทำท้ายสุด:

- manifest
- icon
- offline page
- mobile polish
- empty/loading/error state

---

## 5. กติกาการสั่งงาน AI Coding

เวลาสั่ง Codex หรือ AI Coding ต้องใช้หลักนี้:

```txt
สั่งทีละงานเล็ก
ระบุไฟล์ที่ต้องแก้
ระบุไฟล์ที่ห้ามแตะ
ระบุผลลัพธ์ที่ต้องได้
ให้ทดสอบหลังแก้
```

### รูปแบบ Prompt ที่แนะนำ

```txt
ให้แก้เฉพาะไฟล์ต่อไปนี้:
- public/report.html
- public/js/report-form.js

ห้ามแก้ไฟล์:
- schema.sql
- seed.sql
- functions/api/auth/*

เป้าหมาย:
ทำให้ฟอร์มแจ้งเรื่องดึงหมวดจาก /api/public/categories และส่งข้อมูลไป /api/reports

เงื่อนไข:
- ใช้ Vanilla JavaScript เท่านั้น
- ไม่เพิ่ม library
- ต้องแสดง loading state
- ต้องแสดง error message ภาษาไทย
- ห้ามแสดงข้อมูลส่วนตัวใน console
```

### ห้ามสั่งแบบนี้

```txt
ช่วยสร้างระบบ Hua Saphan Care ให้ครบทั้งหมด
```

เพราะจะทำให้ AI สร้างไฟล์เกินแผน แก้หลายส่วนพร้อมกัน และตรวจสอบยาก

---

## 6. Coding Standard ฝั่ง Frontend

### HTML

- ใช้ semantic HTML เท่าที่ทำได้
- มี `<meta name="viewport">` ทุกหน้า
- ทุกหน้าใช้ภาษาไทยเป็นหลัก
- ปุ่มหลักต้องเป็น `<button>` หรือ `<a>` ที่กดง่าย
- form field ต้องมี `label`
- input สำคัญต้องมี validation
- ห้ามใช้ inline event เช่น `onclick="..."` ถ้าไม่จำเป็น
- ห้ามฝังข้อมูลลับใน HTML

### CSS

- ใช้ไฟล์กลาง:
  - `style.css` สำหรับ layout หลัก
  - `components.css` สำหรับ card, button, chip, form
  - `admin.css` สำหรับ admin
- ใช้ CSS variables สำหรับสีหลัก
- mobile-first เสมอ
- ไม่ใช้สีแบบสุ่มนอก Style Guide
- ปุ่มต้องมีขนาดแตะง่ายบนมือถือ
- ต้องมี state:
  - default
  - hover/focus
  - disabled
  - loading

ตัวอย่าง CSS variable:

```css
:root {
  --color-primary: #1C8C87;
  --color-bg: #F8FAF9;
  --color-card: #FFFFFF;
  --color-text: #1F2A2A;
  --color-muted: #6B7776;
  --color-mint: #EAF7F4;
  --color-blue: #EAF2FF;
  --color-yellow: #FDF3D8;
  --color-green: #E7F5E9;
  --color-coral: #FCE8E3;
  --color-lavender: #F1ECFB;
}
```

### JavaScript

- ใช้ Vanilla JavaScript
- แยกไฟล์ตามหน้าที่
- ห้ามเขียน JS ทั้งหมดรวมใน HTML
- ใช้ `async/await`
- ต้องมี `try/catch` เวลาเรียก API
- ต้องแสดง error message ที่ผู้ใช้เข้าใจได้
- ห้าม log ข้อมูลส่วนตัวลง console
- ห้ามเก็บ token หรือข้อมูลอ่อนไหวใน LocalStorage
- ใช้ `textContent` แทน `innerHTML` เมื่อแสดงข้อความจากผู้ใช้
- ถ้าจำเป็นต้องใช้ `innerHTML` ต้อง sanitize ก่อน

ตัวอย่างรูปแบบเรียก API:

```js
async function apiGet(url) {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Accept": "application/json"
    }
  });

  const data = await res.json().catch(() => null);

  if (!res.ok || !data?.ok) {
    throw new Error(data?.message || "ไม่สามารถเชื่อมต่อระบบได้");
  }

  return data;
}
```

---

## 7. Coding Standard ฝั่ง Pages Functions

### รูปแบบ response มาตรฐาน

ทุก API ต้องตอบกลับ JSON รูปแบบนี้:

```json
{
  "ok": true,
  "data": {},
  "message": "success"
}
```

ถ้า error:

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "กรุณากรอกข้อมูลให้ครบถ้วน"
  }
}
```

### HTTP Status ที่ใช้

| Status | ใช้เมื่อ |
|---|---|
| 200 | สำเร็จ |
| 201 | สร้างข้อมูลใหม่สำเร็จ |
| 400 | validation ไม่ผ่าน |
| 401 | ยังไม่ login |
| 403 | ไม่มีสิทธิ์ |
| 404 | ไม่พบข้อมูล |
| 405 | method ไม่ถูกต้อง |
| 413 | ไฟล์ใหญ่เกิน |
| 429 | request มากเกินไป |
| 500 | server error |

### กติกา API

- ทุก endpoint ต้องตรวจ method
- ทุก endpoint ต้อง validate input
- ทุก query ไป D1 ต้องใช้ prepared statement
- ห้ามต่อ SQL string จาก input โดยตรง
- ห้ามคืนข้อมูลส่วนตัวใน Public API
- Admin API ทุก endpoint ต้องตรวจ session
- Admin API ที่แก้ข้อมูลต้องบันทึก audit log
- Error message ฝั่งผู้ใช้ควรเป็นภาษาไทย
- Error detail ทางเทคนิคไม่ควรส่งให้ผู้ใช้ทั่วไป

ตัวอย่างห้ามทำ:

```js
const sql = `SELECT * FROM reports WHERE tracking_code = '${code}'`;
```

ตัวอย่างที่ควรทำ:

```js
const row = await env.DB
  .prepare("SELECT * FROM reports WHERE tracking_code = ?")
  .bind(code)
  .first();
```

---

## 8. Database Rules

### หลักการ

- D1 เก็บข้อมูลตารางเท่านั้น
- R2 เก็บไฟล์แนบเท่านั้น
- ห้ามเก็บรูปเป็น base64 ใน D1
- ทุกตารางหลักต้องมี `created_at`
- ข้อมูลที่แก้ไขได้ควรมี `updated_at`
- ความสัมพันธ์ต้องใช้ foreign key ถ้าเหมาะสม
- field ที่ใช้ค้นหาบ่อยต้องมี index
- ห้าม `SELECT *` ใน endpoint ที่แสดงรายการจำนวนมาก
- รายการทุกหน้าต้องมี pagination

### Naming

- ชื่อตารางใช้ plural snake_case เช่น `reports`, `report_updates`
- ชื่อ column ใช้ snake_case เช่น `tracking_code`, `created_at`
- ค่า enum ใช้ lower_snake_case เช่น `in_progress`, `waiting_info`

### Migration

ใน MVP ใช้ `schema.sql` เป็นฐานหลักได้ แต่ถ้าเริ่มมีข้อมูลจริงแล้ว:

- ห้ามลบ column โดยไม่ backup
- ห้ามแก้ schema บน production ทันที
- ต้องสร้างไฟล์ migration แยก
- ต้องทดสอบกับข้อมูลจำลองก่อน
- ต้อง export ข้อมูลก่อนแก้ schema สำคัญ

---

## 9. R2 Upload Rules

### ไฟล์ที่อนุญาต

```txt
jpg
jpeg
png
webp
```

### จำกัดขนาด

```txt
ไฟล์ต้นฉบับ: ไม่เกิน 8 MB ต่อไฟล์
หลังบีบอัด: ไม่เกิน 1 MB ต่อไฟล์
จำนวนภาพฝั่งชาวบ้าน: ไม่เกิน 3 ภาพต่อเรื่อง
จำนวนภาพรวมต่อเรื่อง: ไม่เกิน 5 ภาพ
```

### R2 Key Format

```txt
reports/{year}/{tracking_code}/compressed/{filename}
reports/{year}/{tracking_code}/admin/{filename}
reports/{year}/{tracking_code}/after/{filename}
```

ตัวอย่าง:

```txt
reports/2026/HSC-2026-0001/compressed/before-01.webp
```

### ข้อห้าม

- ห้ามเปิด bucket เป็น public ทั้งหมด
- ห้ามใช้ชื่อไฟล์เดิมจากผู้ใช้โดยตรงโดยไม่ sanitize
- ห้ามรับไฟล์นามสกุลแปลก
- ห้ามเชื่อ MIME type จาก browser อย่างเดียว
- ห้ามให้ Public API ดึงภาพที่ไม่ได้รับอนุญาตเผยแพร่

---

## 10. Security Rules

### Password / Login

- ห้ามเก็บ password plain text
- ต้อง hash password
- ห้าม commit password จริงลง GitHub
- session ต้องอยู่ใน cookie
- cookie ควรตั้งค่า `HttpOnly`, `Secure`, `SameSite=Lax`
- ต้องมี logout
- หลัง MVP ควรเพิ่ม rate limit หรือ lock ชั่วคราวเมื่อ login ผิดหลายครั้ง

### Admin Protection

- หน้า `/admin/*` ต้องถูกป้องกัน
- API `/api/admin/*` ต้องตรวจ session
- role ต้องตรวจทุก endpoint ที่สำคัญ
- `viewer` ห้ามแก้ข้อมูล
- `staff` เห็นเฉพาะงานที่ได้รับมอบหมาย หรือเท่าที่กำหนด
- Dashboard ต้องแยก scope ตาม role: admin เห็นทั้งระบบ, staff เห็นเฉพาะ `reports.assigned_to = session user.id`, viewer เห็นเฉพาะ aggregate สาธารณะและไม่เห็น latest reports รายชิ้น
- `super_admin` เท่านั้นที่จัดการผู้ใช้ระดับสูงได้

### Public Privacy

Public API ห้ามคืนข้อมูลต่อไปนี้:

- ชื่อผู้แจ้ง
- เบอร์โทร
- บ้านเลขที่
- พิกัดละเอียด
- ชื่อผู้ถูกร้องเรียน
- รายละเอียดข้อขัดแย้งส่วนบุคคล
- ภาพที่ยังไม่อนุญาตเผยแพร่
- ข้อมูลสุขภาพละเอียด
- log ภายในระบบ

### Input Safety

- ต้อง validate ความยาวข้อความ
- ต้อง trim input
- ต้อง reject input ว่าง
- ต้อง sanitize ก่อนแสดงผล
- ต้องป้องกัน XSS
- ต้องใช้ prepared statements ป้องกัน SQL injection

---

## 11. Privacy Rules

ระบบนี้ต้องยึดหลัก:

```txt
เก็บข้อมูลเท่าที่จำเป็น ใช้เพื่อแก้ปัญหาเท่านั้น ไม่เปิดเผยโดยไม่จำเป็น
```

### เรื่องแจ้งแบบไม่ระบุชื่อ

ถ้าผู้ใช้เลือก anonymous:

- ไม่บังคับกรอกชื่อ
- ไม่บังคับกรอกเบอร์
- tracking code คือช่องทางหลัก
- Public/API ห้ามแสดงข้อมูลผู้แจ้ง
- Admin ต้องเห็นเท่าที่จำเป็นต่อการแก้ปัญหา

### การเผยแพร่ผลงาน

ค่าเริ่มต้นต้องเป็น:

```txt
public_visible = 0
```

จะเผยแพร่ได้เมื่อ Admin เลือกเท่านั้น และต้องตรวจว่า:

- ไม่มีชื่อคน
- ไม่มีเบอร์โทร
- ไม่มีบ้านเลขที่
- ไม่มีทะเบียนรถ
- ไม่มีใบหน้าบุคคลที่ไม่เกี่ยวข้อง
- ไม่มีข้อมูลอ่อนไหว

---

## 12. UI / UX Rules

### ฝั่งชาวบ้าน

- มือถือมาก่อน
- ปุ่มใหญ่ กดง่าย
- ข้อความสั้น
- ภาษาไทยเข้าใจง่าย
- ไม่ใช้ศัพท์เทคนิค
- แจ้งเรื่องใหม่ต้องเห็นชัดในหน้าแรก
- เบอร์ฉุกเฉินต้องเห็นง่าย
- ทุกฟอร์มต้องมีคำแนะนำสั้น ๆ
- error ต้องบอกว่าต้องแก้อะไร
- success ต้องแสดง tracking code ชัดเจน

### ฝั่ง Admin

- เรื่องใหม่และเรื่องเร่งด่วนต้องเห็นก่อน
- ตารางบนมือถือควรเปลี่ยนเป็น card
- ต้องมี filter สถานะ
- ต้องมี search tracking code
- การเปลี่ยนสถานะต้องมี confirmation ถ้าส่งผลสำคัญ
- การเผยแพร่สาธารณะต้องมี checkbox/confirm ชัดเจน

### สีและสไตล์

ต้องใช้แนวทาง:

```txt
modern
clean
friendly
mobile-first
non-governmental
card-based
pastel
community app
easy for villagers
```

ห้ามออกแบบให้ดูเป็นระบบราชการหนักเกินไป

---

## 13. Error / Loading / Empty State Rules

ทุกหน้าที่เรียก API ต้องมี 3 state:

### Loading

ตัวอย่างข้อความ:

```txt
กำลังโหลดข้อมูล...
กำลังส่งเรื่อง...
กำลังบันทึก...
```

### Error

ตัวอย่างข้อความ:

```txt
ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง
ไม่พบรหัสติดตามนี้ กรุณาตรวจสอบรหัสอีกครั้ง
ส่งเรื่องไม่สำเร็จ กรุณาตรวจสอบข้อมูลและลองใหม่
```

### Empty

ตัวอย่างข้อความ:

```txt
ยังไม่มีเรื่องในหมวดนี้
ยังไม่มีรายการที่แก้ไขแล้ว
ยังไม่มีข้อมูลในช่วงเวลานี้
```

ห้ามปล่อยให้หน้าว่างโดยไม่มีคำอธิบาย

---

## 14. Accessibility Rules

- ปุ่มต้องกดง่ายบนมือถือ
- ขนาดตัวอักษรอ่านง่าย
- contrast ต้องเพียงพอ
- input ต้องมี label
- icon ต้องมีข้อความประกอบ
- image สำคัญควรมี alt text
- focus state ต้องเห็นได้
- ไม่ใช้สีอย่างเดียวในการบอกสถานะ ต้องมีข้อความด้วย

---

## 15. Testing Rules

ก่อนถือว่างานเสร็จ ต้องตรวจอย่างน้อยตามนี้

### Public

- เปิดหน้าแรกบนมือถือได้
- กดแจ้งเรื่องใหม่ได้
- ดึงหมวดจาก D1 ได้
- กรอกข้อมูลไม่ครบแล้วระบบเตือน
- แนบภาพได้ไม่เกิน 3 ภาพ
- ภาพใหญ่ถูกบีบอัด
- ส่งเรื่องแล้วได้ tracking code
- tracking code ใช้ติดตามสถานะได้
- แจ้งแบบไม่ระบุชื่อแล้วไม่แสดงชื่อ/เบอร์ใน public

### Admin

- login ได้
- logout ได้
- ไม่ login แล้วเข้าหน้า admin ไม่ได้
- dashboard โหลดข้อมูลจาก D1 จริง
- เปลี่ยนสถานะได้
- เพิ่ม timeline ได้
- มอบหมายงานได้
- เลือกเผยแพร่เรื่องที่แก้ไขแล้วได้
- audit log ถูกบันทึกเมื่อแก้ข้อมูลสำคัญ

### Data

- reports ถูกบันทึกใน D1
- report_updates ถูกบันทึกใน D1
- attachments มี r2_key ถูกต้อง
- R2 มีไฟล์จริง
- CSV export เปิดใน Excel ได้

---

## 16. Deployment Rules

### Cloudflare Pages

- production branch ควรเป็น `main`
- preview ใช้สำหรับตรวจงานก่อน merge
- build command สำหรับ HTML/CSS/JS ธรรมดาใช้ได้แบบง่าย เช่น:

```txt
exit 0
```

- output directory:

```txt
public
```

### Wrangler

`wrangler.toml` ต้องมี binding อย่างน้อย:

```toml
[[d1_databases]]
binding = "DB"
database_name = "hua_saphan_care_db"
database_id = "REPLACE_WITH_D1_DATABASE_ID"

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "hua-saphan-care-files"
```

### ก่อน Deploy Production

ต้องตรวจว่า:

- ไม่มี password จริงใน repo
- ไม่มี secret ใน JavaScript ฝั่ง browser
- `/api/health` ทำงาน
- DB binding ใช้งานได้
- R2 binding ใช้งานได้
- admin login ไม่เปิดสาธารณะ
- Public API ไม่คืนข้อมูลส่วนตัว
- ไม่มี console log ข้อมูลอ่อนไหว

---

## 17. Git / Commit Rules

ควร commit เป็นงานย่อย เช่น:

```txt
feat: add public report form
feat: add report tracking api
fix: hide reporter phone from public tracking
docs: add api spec
style: improve mobile card layout
```

ห้าม commit รวมหลายงานใหญ่ในครั้งเดียว เช่น:

```txt
update everything
final version
fix all
```

### ก่อน commit

ตรวจว่า:

- เปิดหน้าเว็บได้
- ไม่มี syntax error
- ไม่มีไฟล์ temp
- ไม่มี `.env`
- ไม่มี password
- ไม่มีข้อมูลจริงของชาวบ้าน
- ไม่มีภาพจริงที่ไม่ควรเผยแพร่

---

## 18. Cost Control Rules

ต้องควบคุมค่าใช้จ่ายตามหลักนี้:

- ใช้ `pages.dev` ก่อน ยังไม่ต้องซื้อโดเมน
- จำกัดภาพ 3 ภาพต่อเรื่องฝั่งผู้ใช้
- บีบอัดภาพก่อนอัปโหลด
- ไม่เก็บรูปใหญ่โดยไม่จำเป็น
- ใช้ pagination ทุกหน้ารายการ
- ไม่ query ข้อมูลทั้งตาราง
- ไม่สร้าง PDF บน API ใน MVP
- ตรวจ Cloudflare usage เป็นระยะ
- ลบ temp upload ภายใน 24 ชั่วโมง
- archive/lifecycle ไฟล์เก่าตามนโยบาย 3 ปี

---

## 19. สิ่งที่ห้ามทำใน MVP

ห้ามทำสิ่งต่อไปนี้ เว้นแต่มีการตัดสินใจใหม่ชัดเจน:

- เปลี่ยนเป็น React/Vite ทันที
- สร้าง backend server แยก
- ใช้ฐานข้อมูลอื่นแทน D1
- เก็บรูปใน database
- เปิด R2 public ทั้ง bucket
- ทำ notification real-time
- ทำ PDF generation หนัก
- ทำ permission ซับซ้อนเกินจำเป็น
- ทำระบบ chat
- ทำระบบแผนที่ขั้นสูง
- ทำระบบชำระเงิน
- เก็บเลขบัตรประชาชน
- เก็บวันเกิด
- เก็บที่อยู่เต็มโดยไม่จำเป็น
- แสดงเรื่องทั้งหมดต่อสาธารณะอัตโนมัติ

---

## 20. Definition of Done รวม

งานหนึ่งชิ้นจะถือว่าเสร็จเมื่อ:

- ทำงานได้จริงตาม flow
- ไม่ทำให้ flow เดิมเสีย
- mobile ใช้งานได้
- มี validation
- มี loading/error/empty state
- ไม่มีข้อมูลส่วนตัวหลุด public
- API response เป็นมาตรฐานเดียวกัน
- ใช้ prepared statements
- ไม่มี secret ใน repo
- ทดสอบอย่างน้อยตาม checklist ที่เกี่ยวข้อง
- โค้ดอ่านง่ายและแก้ต่อได้

---

## 21. กติกาเมื่อพบปัญหา

เมื่อเจอ bug ห้ามแก้มั่วทั้งระบบ ให้ทำตามลำดับนี้:

1. ระบุหน้า/endpoint ที่มีปัญหา
2. ระบุ error message
3. ตรวจ browser console
4. ตรวจ network response
5. ตรวจ API response
6. ตรวจ D1/R2 binding
7. แก้เฉพาะไฟล์ที่เกี่ยวข้อง
8. ทดสอบซ้ำเฉพาะ flow นั้น
9. ตรวจว่า flow อื่นไม่พัง

ตัวอย่าง Prompt แก้ bug:

```txt
ตอนนี้หน้า track.html กรอกรหัสแล้วขึ้น "ไม่สามารถโหลดข้อมูลได้"
ให้ตรวจเฉพาะไฟล์:
- public/track.html
- public/js/track.js
- functions/api/reports/track.js

ห้ามแก้ schema.sql และไฟล์ admin
เป้าหมายคือให้ /api/reports/track?code= ทำงาน และไม่คืนข้อมูลส่วนตัว
```

---

## 22. กติกาการขยายระบบหลัง MVP

หลัง MVP ใช้งานจริงแล้ว ค่อยพิจารณาเพิ่ม:

- ระบบแผนที่ปัญหา
- QR Code แจ้งเรื่อง
- LINE หรือ Email notification
- PDF report
- chart รายเดือน
- SLA ตามหมวด
- backup/export อัตโนมัติ
- Cloudflare Access สำหรับ Admin ระดับสูง
- React/Vite เฉพาะเมื่อ UI ซับซ้อนขึ้นจริง

การเพิ่มฟีเจอร์ใหม่ต้องตอบคำถาม 4 ข้อนี้ก่อน:

1. จำเป็นต่อการใช้งานจริงหรือไม่
2. เพิ่มภาระดูแลระบบหรือไม่
3. กระทบค่าใช้จ่ายหรือไม่
4. กระทบความปลอดภัยหรือข้อมูลส่วนตัวหรือไม่

ถ้าตอบไม่ได้ชัดเจน ให้ยังไม่เพิ่ม

---

## 23. สรุปกติกาสั้นที่สุด

```txt
ทำทีละขั้น
ใช้ Vanilla HTML/CSS/JS
ใช้ Pages Functions เป็น API
ใช้ D1 เก็บข้อมูล
ใช้ R2 เก็บไฟล์
ไม่เก็บข้อมูลเกินจำเป็น
ไม่เปิดข้อมูลส่วนตัว
ไม่ทำระบบใหญ่เกิน MVP
ทดสอบทุก flow ก่อนถือว่าเสร็จ
```

เอกสารนี้เป็นไฟล์ควบคุมการพัฒนา หาก Codex หรือ AI Coding เสนอวิธีที่ขัดกับเอกสารนี้ ให้ยึด `DEVELOPMENT_RULES.md` เป็นหลักก่อน เว้นแต่มีการตัดสินใจปรับแผนใหม่อย่างชัดเจน
