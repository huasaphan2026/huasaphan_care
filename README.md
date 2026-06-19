# Hua Saphan Care

ระบบรับเรื่องและแก้ปัญหาชุมชนหัวสะพาน  
บ้านหัวสะพาน หมู่ที่ 1 ตำบลเวียงสระ อำเภอเวียงสระ จังหวัดสุราษฎร์ธานี

> เอกสาร README.md ฉบับนี้ใช้เป็นเอกสารกลางสำหรับกำกับ ควบคุม วาง Roadmap และลงมือสร้างเว็บแอพ `Hua Saphan Care` อย่างเป็นระบบ เป็นลำดับ และสามารถนำไปวางใน GitHub repository ได้โดยตรง

---

## 1. สรุปการตัดสินใจโครงสร้างระบบ

โครงการนี้เลือกใช้แนวทาง **ทางเลือก A: เรียบง่ายที่สุด เหมาะกับเริ่มทำจริง**

```txt
Cloudflare Pages + Pages Functions + D1 + R2
Frontend และ Backend อยู่ใน GitHub repo เดียวกัน
เริ่มด้วย HTML/CSS/JavaScript ธรรมดา
ยังไม่เริ่มด้วย React/Vite จนกว่าระบบจะใหญ่และซับซ้อนจริง
```

### เหตุผลที่เลือกแนวทางนี้

- เหมาะกับผู้พัฒนาคนเดียวหรือทีมขนาดเล็ก
- ลดความซับซ้อนจากการแยก frontend/backend เป็นหลายโปรเจกต์
- ใช้ GitHub repo เดียวควบคุมทั้งหน้าเว็บ, API, schema ฐานข้อมูล และเอกสาร
- Deploy ง่ายผ่าน Cloudflare Pages
- Pages Functions ทำหน้าที่เป็น API หลังบ้านได้โดยไม่ต้องมี Server/VPS
- D1 ใช้เก็บข้อมูลตาราง เช่น users, reports, categories, updates, feedback
- R2 ใช้เก็บรูปภาพและไฟล์แนบ ไม่เก็บไฟล์ใหญ่ไว้ในฐานข้อมูล
- สามารถขยายไปเป็น Workers แยก หรือ React/Vite ภายหลังได้

---

## 2. ข้อมูลยืนยันโครงการ

| รายการ | ค่าที่ใช้ |
|---|---|
| ชื่อระบบ | `Hua Saphan Care` |
| URL ที่ต้องการใช้จริง | `https://huasaphan-care.pages.dev` |
| อีเมลโครงการ | `huasaphan2026@gmail.com` |
| สถาปัตยกรรม | Cloudflare Pages + Pages Functions + D1 + R2 |
| Frontend เริ่มต้น | HTML/CSS/JavaScript |
| Backend/API เริ่มต้น | Cloudflare Pages Functions |
| ฐานข้อมูล | Cloudflare D1 |
| ที่เก็บไฟล์ | Cloudflare R2 |
| Admin ชุดแรก | นายธราธิป ระวังสุข |
| เบอร์ติดต่อฉุกเฉินหน้าแรก | `0629617942` |
| แนวทาง Login Admin | ทำระบบ Login เองแบบง่ายก่อน |

---

## 3. ข้อสรุปด้านเทคนิคหลังทบทวน

โครงสร้างนี้ **เหมาะสมและสร้างได้จริง** สำหรับเว็บแอพระดับหมู่บ้าน เพราะงานหลักของระบบคือรับเรื่อง แจ้งปัญหา แนบภาพ ติดตามสถานะ มอบหมายงาน และสรุปรายงาน ซึ่งไม่จำเป็นต้องเริ่มด้วย framework หนักหรือ server แยก

### สิ่งที่ควรทำ

- เริ่มด้วย MVP ที่ใช้งานจริงได้ก่อน
- ใช้ HTML/CSS/JS ธรรมดา เพื่อลดความซับซ้อน
- ใช้ Pages Functions สำหรับ API
- ใช้ D1 เป็นฐานข้อมูลหลัก
- ใช้ R2 เก็บไฟล์แนบและรูปภาพ
- ทำระบบ Login เองแบบง่ายสำหรับ Admin
- ใช้ session token / cookie แทนการเปิดหน้า Admin แบบสาธารณะ
- ควบคุมปริมาณรูปภาพตั้งแต่แรก
- ทำระบบรายงานแบบ CSV ก่อน PDF

### สิ่งที่ยังไม่ควรทำในช่วงแรก

- ยังไม่ควรเริ่มด้วย React/Vite
- ยังไม่ควรแยก Workers เป็น backend โปรเจกต์ใหม่
- ยังไม่ควรทำ real-time notification
- ยังไม่ควรทำ PDF generation หนัก ๆ บน API
- ยังไม่ควรทำระบบ permission ซับซ้อนเกินจำเป็น
- ยังไม่ควรเปิดไฟล์ R2 เป็น public ทั้งหมด
- ยังไม่ควรเก็บข้อมูลส่วนบุคคลเกินความจำเป็น

---

## 4. หมวดปัญหาเริ่มต้น

เพื่อให้ระบบใช้งานง่าย ไม่ซับซ้อน และเหมาะกับชาวบ้าน ควรเริ่มด้วยหมวดหลัก 8 หมวดก่อน

| รหัส | หมวดปัญหา | คำอธิบาย | ความเร่งด่วนเริ่มต้น |
|---|---|---|---|
| `electric` | ไฟฟ้า / ไฟทาง | ไฟทางเสีย ไฟกะพริบ จุดมืด เสาไฟมีปัญหา | ปกติ |
| `road` | ถนน / ทางเดิน | ถนนชำรุด หลุมบ่อ ทางเดินเสีย ป้ายจราจร | ปกติ |
| `water` | น้ำ / ท่อระบายน้ำ | น้ำประปาไม่ไหล ท่ออุดตัน น้ำท่วมขัง | ปกติ |
| `waste` | ขยะ / ความสะอาด | ขยะตกค้าง จุดทิ้งขยะ กลิ่นเหม็น สิ่งสกปรก | ปกติ |
| `safety` | ความปลอดภัย | จุดเสี่ยง อุบัติเหตุ สิ่งกีดขวาง เหตุเสี่ยงในชุมชน | เร่งด่วน |
| `nuisance` | เหตุรำคาญ | เสียงดัง กลิ่น ควัน สัตว์รบกวน ความเดือดร้อนทั่วไป | ปกติ |
| `health` | สุขภาพ / ผู้เปราะบาง | ผู้สูงอายุ ผู้ป่วย ผู้พิการ ผู้ต้องการความช่วยเหลือ | เร่งด่วน |
| `suggestion` | ข้อเสนอแนะ | ข้อเสนอเพื่อพัฒนาหมู่บ้าน กิจกรรม หรือบริการชุมชน | ปกติ |

### หมวดที่ยังไม่ควรแยกในเวอร์ชันแรก

ยังไม่ควรแยกหมวดละเอียดเกินไป เช่น ยาเสพติด ความขัดแย้งครอบครัว เด็กและเยาวชน สัตว์จรจัด สิ่งแวดล้อมเฉพาะทาง เพราะจะทำให้แบบฟอร์มยากและผู้ใช้ลังเล ควรให้แจ้งในหมวด `ความปลอดภัย`, `เหตุรำคาญ`, หรือ `ข้อเสนอแนะ` ก่อน แล้วให้ Admin ปรับหมวดภายหลังได้

---

## 5. บทบาทผู้ใช้งาน

เริ่มต้นควรมี 4 บทบาท เพื่อให้ระบบไม่ซับซ้อนเกินไป

| Role | ชื่อบทบาท | สิทธิ์หลัก | เหมาะกับ |
|---|---|---|---|
| `super_admin` | ผู้ดูแลหลัก | จัดการทุกอย่าง ผู้ใช้ หมวด รายงาน ตั้งค่า ลบ/แก้ไขข้อมูลสำคัญ | นายธราธิป ระวังสุข หรือผู้ดูแลหลัก |
| `admin` | ผู้ดูแลระบบ | ดูทุกเรื่อง รับเรื่อง เปลี่ยนสถานะ มอบหมายงาน เพิ่มข่าว/ประกาศ | ผู้ใหญ่บ้าน / ผู้ช่วย / ผู้ดูแลระบบ |
| `staff` | ผู้รับผิดชอบงาน | ดูเรื่องที่ได้รับมอบหมาย อัปเดตความคืบหน้า แนบภาพหลังดำเนินการ | กรรมการหมู่บ้าน อสม. จิตอาสา |
| `viewer` | ผู้ดูรายงาน | ดู Dashboard และรายงาน ไม่เห็นข้อมูลอ่อนไหวเต็มรูปแบบ | กรรมการประเมิน / ผู้เกี่ยวข้อง |

### Admin ชุดแรก

```txt
name: นายธราธิป ระวังสุข
role: super_admin
status: active
```

> หมายเหตุ: ในไฟล์ seed จริง ยังไม่ควรใส่รหัสผ่านจริงลง GitHub ให้สร้างรหัสผ่านผ่านหน้า setup หรือคำสั่ง seed เฉพาะเครื่อง

---

## 6. นโยบายรูปภาพและไฟล์แนบ

### จำนวนภาพสูงสุดต่อเรื่อง

แนะนำให้เริ่มต้นที่:

```txt
สูงสุด 3 ภาพต่อเรื่องสำหรับฝั่งชาวบ้าน
สูงสุด 5 ภาพต่อเรื่องเมื่อรวมภาพจาก Admin/ผู้รับผิดชอบ
```

เหตุผล:

- เพียงพอสำหรับหลักฐานปัญหาทั่วไป
- ลดพื้นที่ R2
- ลดเวลาอัปโหลดสำหรับผู้ใช้มือถือ
- ลดโอกาสระบบช้า
- เหมาะกับ Free tier

### ขนาดภาพก่อนบีบอัด

```txt
ไฟล์ต้นฉบับที่ยอมรับ: ไม่เกิน 8 MB ต่อไฟล์
ชนิดไฟล์: jpg, jpeg, png, webp
```

### ขนาดภาพหลังบีบอัด

```txt
ความกว้างสูงสุด: 1280 px
คุณภาพ JPEG/WebP: 75-82%
ขนาดเป้าหมายต่อภาพ: ไม่เกิน 500 KB
ขนาดสูงสุดหลังบีบอัด: ไม่เกิน 1 MB ต่อภาพ
```

### วิธีจัดเก็บไฟล์ใน R2

```txt
reports/{year}/{tracking_code}/original/{filename}
reports/{year}/{tracking_code}/compressed/{filename}
reports/{year}/{tracking_code}/admin/{filename}
reports/{year}/{tracking_code}/after/{filename}
```

ตัวอย่าง:

```txt
reports/2026/HSC-2026-0001/compressed/before-01.webp
reports/2026/HSC-2026-0001/after/after-01.webp
```

### หลักการสำคัญ

- ไม่เก็บ binary รูปภาพใน D1
- D1 เก็บเฉพาะ `r2_key`, `file_name`, `file_type`, `file_size`, `purpose`
- ภาพที่อาจมีข้อมูลอ่อนไหวไม่ควรเปิด public โดยตรง
- การดูภาพใน Admin ควรผ่าน API ที่ตรวจสิทธิ์ก่อน

---

## 7. นโยบายเก็บข้อมูล

### ระยะเวลาเก็บข้อมูล

แนะนำให้ใช้:

```txt
ข้อมูลเรื่องร้องเรียน: 3 ปี
ไฟล์ภาพแนบ: 3 ปี หรือสั้นกว่านั้นหากไม่มีความจำเป็น
Audit logs: 3 ปี
ข้อมูล session/login: 30-90 วัน
ข้อมูล draft/temp upload: ลบทิ้งภายใน 24 ชั่วโมง
```

เหตุผล:

- เพียงพอสำหรับการประชุมหมู่บ้าน รายงานประจำปี และการประเมินผลงาน
- ไม่เก็บข้อมูลนานเกินความจำเป็น
- ลดพื้นที่ R2/D1
- ลดความเสี่ยงด้านข้อมูลส่วนบุคคล

### แนวทางลบ/ซ่อนข้อมูล

- เรื่องทั่วไปเก็บได้ 3 ปี
- เรื่องอ่อนไหวให้ซ่อนจากหน้าสาธารณะทันที
- เมื่อครบกำหนด ให้เก็บเฉพาะข้อมูลสถิติ เช่น หมวด, เดือน, สถานะ, ผลการแก้ไข
- ลบหรือปิดบังชื่อ เบอร์โทร รายละเอียดระบุตัวบุคคล และภาพที่ไม่จำเป็น

---

## 8. ข้อมูลส่วนตัวที่อนุญาตให้เก็บ

ระบบนี้ควรยึดหลัก “เก็บเท่าที่จำเป็น”

### ฝั่งชาวบ้าน / ผู้แจ้งเรื่อง

| ข้อมูล | เก็บหรือไม่ | หมายเหตุ |
|---|---:|---|
| ชื่อผู้แจ้ง | เลือกเก็บ | เฉพาะกรณีผู้แจ้งยินยอมระบุชื่อ |
| เบอร์โทร | เลือกเก็บ | ใช้สำหรับติดต่อกลับ ไม่แสดงสาธารณะ |
| หมู่/ซอย/จุดสังเกต | เก็บ | จำเป็นต่อการแก้ปัญหา |
| พิกัดตำแหน่ง | เลือกเก็บ | เก็บเมื่อผู้ใช้อนุญาตเท่านั้น |
| รูปภาพปัญหา | เก็บ | ต้องมีคำเตือนเรื่องไม่ถ่ายติดหน้าบุคคลโดยไม่จำเป็น |
| รายละเอียดปัญหา | เก็บ | ตรวจคำหยาบ/ข้อมูลอ่อนไหวก่อนแสดงสาธารณะ |
| เลขบัตรประชาชน | ไม่เก็บ | ไม่จำเป็นและเสี่ยงเกินไป |
| วันเดือนปีเกิด | ไม่เก็บ | ไม่จำเป็น |
| ที่อยู่เต็ม | ไม่ควรเก็บ | ใช้จุดสังเกตแทน เว้นแต่จำเป็นจริง |
| ข้อมูลสุขภาพละเอียด | ไม่ควรเก็บ | หากเป็นเคสสุขภาพ ให้เก็บแบบสรุปเท่าที่จำเป็น |

### การแจ้งแบบไม่ระบุชื่อ

เมื่อผู้ใช้เลือก “ไม่ประสงค์เปิดเผยชื่อ”:

- ไม่บังคับกรอกชื่อ
- ไม่บังคับกรอกเบอร์โทร
- แสดงผลด้วยรหัสติดตามเท่านั้น
- Admin เห็นเฉพาะรายละเอียดปัญหาและข้อมูลพื้นที่
- ถ้าเรื่องฉุกเฉิน ต้องแจ้งให้โทรเบอร์ติดต่อฉุกเฉินโดยตรงร่วมด้วย

---

## 9. นโยบายการแสดงเรื่องที่แก้ไขแล้วต่อสาธารณะ

แนะนำให้ใช้แนวทาง **แสดงแบบคัดกรองแล้วเท่านั้น**

### ค่าเริ่มต้น

```txt
ไม่แสดงเรื่องทั้งหมดต่อสาธารณะโดยอัตโนมัติ
แสดงเฉพาะเรื่องที่ Admin เลือกให้เผยแพร่เป็นผลงานชุมชน
```

### แสดงต่อสาธารณะได้

- หมวดปัญหา
- หัวข้อสรุปแบบไม่ระบุตัวบุคคล
- พื้นที่โดยประมาณ เช่น “ซอย 3” หรือ “บริเวณหน้าศาลาหมู่บ้าน”
- สถานะ “แก้ไขแล้ว”
- ภาพก่อน-หลัง เฉพาะภาพที่ไม่เห็นใบหน้าหรือข้อมูลส่วนตัว
- วันที่แจ้งและวันที่แก้ไขแบบเดือน/ปี หรือวันที่ทั่วไป
- ข้อความสรุปผลการแก้ไข

### ไม่ควรแสดงต่อสาธารณะ

- ชื่อผู้แจ้ง
- เบอร์โทร
- บ้านเลขที่
- พิกัดละเอียด
- ชื่อผู้ถูกร้องเรียน
- รายละเอียดข้อขัดแย้งส่วนบุคคล
- ภาพที่ติดใบหน้า ทะเบียนรถ บ้านเลขที่ หรือข้อมูลระบุตัวบุคคล
- เรื่องเกี่ยวกับยาเสพติด ความรุนแรง ครอบครัว หรือสุขภาพส่วนบุคคล

### สถานะการเผยแพร่

ในตาราง `reports` ควรมี field:

```sql
public_visible INTEGER DEFAULT 0
public_summary TEXT
public_location_label TEXT
public_image_allowed INTEGER DEFAULT 0
```

---

## 10. แนวทาง Login Admin

เลือกใช้:

```txt
ทำระบบ Login เองแบบง่ายก่อน
```

### เหตุผล

- สร้างง่ายกว่า Cloudflare Access สำหรับบริบทผู้ใช้ทั่วไป
- ไม่ผูกกับอีเมล domain หรือ identity provider ซับซ้อน
- Admin ชุมชนสามารถใช้ username/password ได้
- ควบคุมบทบาทใน D1 ได้โดยตรง
- เหมาะกับ MVP

### โครงสร้าง Login ที่แนะนำ

- ตาราง `users` เก็บผู้ใช้ Admin
- เก็บ password แบบ hash เท่านั้น ห้ามเก็บ plain text
- ใช้ `session_token` หรือ signed token ผ่าน cookie
- ตั้งอายุ session เช่น 7 วัน
- มีปุ่ม logout
- จำกัดการเข้าหน้า `/admin/*`
- API ฝั่ง Admin ทุกเส้นต้องตรวจ session

### สิ่งที่ควรเพิ่มหลัง MVP

- เปลี่ยนรหัสผ่าน
- reset password โดย super_admin
- บันทึก login logs
- rate limit หน้า login
- lock account ชั่วคราวเมื่อใส่รหัสผิดหลายครั้ง
- พิจารณา Cloudflare Access ในอนาคต ถ้าต้องการความปลอดภัยระดับสูงขึ้น

---

## 11. สถาปัตยกรรมระบบ

```txt
User Browser / Mobile
        |
        v
Cloudflare Pages
Static Frontend: HTML, CSS, JS
        |
        v
Pages Functions (/functions/api/*)
Server-side API on Workers Runtime
        |
        |---- D1 Database
        |       users
        |       reports
        |       report_updates
        |       categories
        |       assignments
        |       attachments
        |       feedback
        |       audit_logs
        |       news
        |       settings
        |
        |---- R2 Bucket
                report images
                after images
                documents
                exports
```

---

## 12. โครงสร้าง Repository

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
│  ├─ track.html
│  ├─ success.html
│  ├─ works.html
│  ├─ emergency.html
│  ├─ offline.html
│  ├─ manifest.webmanifest
│  ├─ assets/
│  │  ├─ icons/
│  │  ├─ images/
│  │  └─ logo/
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
│     │  ├─ login.js
│     │  ├─ logout.js
│     │  └─ me.js
│     ├─ public/
│     │  ├─ categories.js
│     │  ├─ emergency.js
│     │  └─ works.js
│     ├─ reports/
│     │  ├─ index.js
│     │  ├─ track.js
│     │  └─ [id].js
│     ├─ uploads/
│     │  ├─ image.js
│     │  └─ signed-url.js
│     └─ admin/
│        ├─ dashboard.js
│        ├─ reports.js
│        ├─ report-status.js
│        ├─ report-update.js
│        ├─ assignments.js
│        ├─ categories.js
│        ├─ users.js
│        ├─ news.js
│        ├─ feedback.js
│        └─ export-csv.js
└─ docs/
   ├─ STYLE_GUIDE.md
   ├─ API_SPEC.md
   ├─ DATABASE.md
   ├─ SECURITY.md
   └─ ROADMAP.md
```

---

## 13. wrangler.toml ตัวอย่าง

> ต้องแก้ `database_id` หลังจากสร้าง D1 จริงใน Cloudflare

```toml
name = "hua-saphan-care"
compatibility_date = "2026-06-08"
pages_build_output_dir = "public"

[[d1_databases]]
binding = "DB"
database_name = "hua_saphan_care_db"
database_id = "REPLACE_WITH_D1_DATABASE_ID"

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "hua-saphan-care-files"
```

---

## 14. D1 Database Schema เริ่มต้น

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  email TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'staff',
  password_hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  default_priority TEXT NOT NULL DEFAULT 'normal',
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tracking_code TEXT NOT NULL UNIQUE,
  category_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  location_text TEXT NOT NULL,
  location_lat REAL,
  location_lng REAL,
  priority TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'new',
  anonymous INTEGER NOT NULL DEFAULT 1,
  reporter_name TEXT,
  reporter_phone TEXT,
  assigned_to INTEGER,
  public_visible INTEGER NOT NULL DEFAULT 0,
  public_summary TEXT,
  public_location_label TEXT,
  public_image_allowed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT,
  closed_at TEXT,
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (assigned_to) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS report_updates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL,
  status TEXT NOT NULL,
  update_note TEXT NOT NULL,
  updated_by INTEGER,
  is_public INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (report_id) REFERENCES reports(id),
  FOREIGN KEY (updated_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  assigned_by INTEGER,
  due_date TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (report_id) REFERENCES reports(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (assigned_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL,
  r2_key TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  purpose TEXT NOT NULL DEFAULT 'before',
  public_allowed INTEGER NOT NULL DEFAULT 0,
  uploaded_by INTEGER,
  uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (report_id) REFERENCES reports(id),
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL,
  score INTEGER NOT NULL,
  comment TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (report_id) REFERENCES reports(id)
);

CREATE TABLE IF NOT EXISTS news (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  detail TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_reports_tracking_code ON reports(tracking_code);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_category ON reports(category_id);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at);
CREATE INDEX IF NOT EXISTS idx_report_updates_report_id ON report_updates(report_id);
CREATE INDEX IF NOT EXISTS idx_attachments_report_id ON attachments(report_id);
```

---

## 15. Seed Data เริ่มต้น

```sql
INSERT INTO categories (code, name, description, default_priority, sort_order) VALUES
('electric', 'ไฟฟ้า / ไฟทาง', 'ไฟทางเสีย ไฟกะพริบ จุดมืด เสาไฟมีปัญหา', 'normal', 1),
('road', 'ถนน / ทางเดิน', 'ถนนชำรุด หลุมบ่อ ทางเดินเสีย ป้ายจราจร', 'normal', 2),
('water', 'น้ำ / ท่อระบายน้ำ', 'น้ำประปาไม่ไหล ท่ออุดตัน น้ำท่วมขัง', 'normal', 3),
('waste', 'ขยะ / ความสะอาด', 'ขยะตกค้าง จุดทิ้งขยะ กลิ่นเหม็น สิ่งสกปรก', 'normal', 4),
('safety', 'ความปลอดภัย', 'จุดเสี่ยง อุบัติเหตุ สิ่งกีดขวาง เหตุเสี่ยงในชุมชน', 'urgent', 5),
('nuisance', 'เหตุรำคาญ', 'เสียงดัง กลิ่น ควัน สัตว์รบกวน ความเดือดร้อนทั่วไป', 'normal', 6),
('health', 'สุขภาพ / ผู้เปราะบาง', 'ผู้สูงอายุ ผู้ป่วย ผู้พิการ ผู้ต้องการความช่วยเหลือ', 'urgent', 7),
('suggestion', 'ข้อเสนอแนะ', 'ข้อเสนอเพื่อพัฒนาหมู่บ้าน กิจกรรม หรือบริการชุมชน', 'normal', 8);

INSERT INTO settings (key, value) VALUES
('app_name', 'Hua Saphan Care'),
('app_url', 'https://huasaphan-care.pages.dev'),
('project_email', 'huasaphan2026@gmail.com'),
('emergency_phone', '0629617942'),
('max_public_images_per_report', '3'),
('max_total_images_per_report', '5'),
('image_max_original_mb', '8'),
('image_max_width_px', '1280'),
('image_target_kb', '500'),
('data_retention_years', '3'),
('public_resolved_default', 'false');
```

> หมายเหตุ: ไม่ควร seed password จริงในไฟล์ที่ push ขึ้น GitHub

---

## 16. สถานะของเรื่องร้องเรียน

| Status | ชื่อไทย | ใช้เมื่อ |
|---|---|---|
| `new` | เรื่องใหม่ | ผู้ใช้ส่งเรื่องเข้ามาใหม่ |
| `accepted` | รับเรื่องแล้ว | Admin ตรวจแล้วและรับเข้าระบบ |
| `checking` | ตรวจสอบข้อมูล | ต้องตรวจสอบพื้นที่หรือข้อมูลเพิ่ม |
| `in_progress` | กำลังดำเนินการ | มีผู้รับผิดชอบและเริ่มแก้ไขแล้ว |
| `forwarded` | ส่งต่อหน่วยงาน | ต้องส่งต่อ อบต. ไฟฟ้า ตำรวจ หรือหน่วยงานอื่น |
| `waiting_info` | รอข้อมูลเพิ่มเติม | ต้องการข้อมูลเพิ่มจากผู้แจ้งหรือพื้นที่ |
| `resolved` | แก้ไขแล้ว | ดำเนินการเสร็จแล้ว |
| `closed` | ปิดเรื่อง | ปิดงานและเก็บเข้าประวัติ |
| `rejected` | ไม่รับดำเนินการ | ไม่อยู่ในขอบเขต หรือข้อมูลไม่เพียงพอ |

---

## 17. API Routes ที่ต้องสร้าง

### Public API

| Method | Endpoint | หน้าที่ |
|---|---|---|
| GET | `/api/health` | ตรวจว่า API ทำงาน |
| GET | `/api/public/categories` | ดึงหมวดปัญหา |
| GET | `/api/public/emergency` | ดึงเบอร์ติดต่อฉุกเฉิน |
| GET | `/api/public/works` | ดึงเรื่องที่แก้ไขแล้วและอนุญาตเผยแพร่ |
| POST | `/api/reports` | ส่งเรื่องใหม่ |
| POST | `/api/uploads/image` | อัปโหลดรูปภาพ |
| GET | `/api/reports/track?code=HSC-2026-0001` | ติดตามสถานะด้วยรหัส |
| POST | `/api/reports/feedback` | ส่งความพึงพอใจหลังปิดเรื่อง |

### Auth API

| Method | Endpoint | หน้าที่ |
|---|---|---|
| POST | `/api/auth/login` | Admin login |
| POST | `/api/auth/logout` | ออกจากระบบ |
| GET | `/api/auth/me` | ตรวจ session ปัจจุบัน |

### Admin API

| Method | Endpoint | หน้าที่ |
|---|---|---|
| GET | `/api/admin/dashboard` | สรุป dashboard |
| GET | `/api/admin/reports` | รายการเรื่องทั้งหมดแบบแบ่งหน้า |
| GET | `/api/admin/reports/:id` | รายละเอียดเรื่อง |
| PATCH | `/api/admin/reports/:id/status` | เปลี่ยนสถานะ |
| POST | `/api/admin/reports/:id/updates` | เพิ่ม timeline |
| POST | `/api/admin/reports/:id/assignments` | มอบหมายงาน |
| PATCH | `/api/admin/reports/:id/public` | ตั้งค่าการเผยแพร่สาธารณะ |
| GET | `/api/admin/categories` | รายการหมวด |
| POST | `/api/admin/categories` | เพิ่มหมวด |
| PATCH | `/api/admin/categories/:id` | แก้ไขหมวด |
| GET | `/api/admin/users` | รายการผู้ใช้ |
| POST | `/api/admin/users` | เพิ่มผู้ใช้ |
| PATCH | `/api/admin/users/:id` | แก้ไขผู้ใช้ |
| GET | `/api/admin/export-csv` | ส่งออก CSV |

---

## 18. หน้าจอที่ต้องสร้าง

### ฝั่งชาวบ้าน

| ไฟล์ | หน้าที่ |
|---|---|
| `index.html` | หน้าแรก แนะนำระบบ ปุ่มแจ้งเรื่องใหม่ เบอร์ฉุกเฉิน |
| `report.html` | แบบฟอร์มแจ้งเรื่อง |
| `success.html` | แสดงรหัสติดตามหลังส่งเรื่อง |
| `track.html` | ติดตามสถานะด้วยรหัส |
| `works.html` | เรื่องที่แก้ไขแล้ว / ผลงานชุมชน |
| `emergency.html` | ช่องทางติดต่อฉุกเฉิน |
| `offline.html` | หน้า fallback กรณีออฟไลน์ |

### ฝั่ง Admin

| ไฟล์ | หน้าที่ |
|---|---|
| `admin/login.html` | เข้าสู่ระบบ |
| `admin/dashboard.html` | สรุปภาพรวม |
| `admin/reports.html` | รายการเรื่องทั้งหมด |
| `admin/report-detail.html` | รายละเอียดเรื่องและ timeline |
| `admin/categories.html` | จัดการหมวดปัญหา |
| `admin/users.html` | จัดการผู้ใช้และบทบาท |
| `admin/news.html` | ข่าว/ประกาศหน้าแรก |
| `admin/settings.html` | ตั้งค่าระบบ |
| `admin/reports-export.html` | ส่งออกรายงาน |

---

## 19. UI / UX Direction

ใช้แนวทางเดิมของ Hua Saphan Care:

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

### สีหลัก

```txt
Primary Teal: #1C8C87
Background: #F8FAF9
Card White: #FFFFFF
Mint Light: #EAF7F4
Soft Blue: #EAF2FF
Soft Yellow: #FDF3D8
Soft Green: #E7F5E9
Soft Coral: #FCE8E3
Lavender Soft: #F1ECFB
Text Dark: #1F2A2A
Text Gray: #6B7776
```

### หลัก UX

- มือถือมาก่อน
- ปุ่มใหญ่ กดง่าย
- ข้อความไทยสั้น เข้าใจง่าย
- หลีกเลี่ยงศัพท์เทคนิค
- ใช้การ์ดแทนตารางในหน้ามือถือ
- แสดงสถานะด้วย chip สีพาสเทล
- หน้าแรกต้องมีปุ่ม “แจ้งเรื่องใหม่” ชัดเจน
- หน้า Admin ต้องแสดงเรื่องใหม่และเรื่องเร่งด่วนก่อน

---

## 20. Roadmap การสร้างระบบ

### Phase 0: Setup โครงการ

เป้าหมาย: เตรียม repo, Cloudflare, D1, R2 และโครงสร้างไฟล์ให้พร้อม

- [ ] สร้าง GitHub repo `hua-saphan-care`
- [ ] เปิดโปรเจกต์ใน VS Code
- [ ] สร้าง README.md
- [ ] สร้าง `public/`, `functions/`, `docs/`
- [ ] สร้าง `wrangler.toml`
- [ ] สร้าง Cloudflare Pages project
- [ ] เชื่อม GitHub repo กับ Cloudflare Pages
- [ ] สร้าง D1 database `hua_saphan_care_db`
- [ ] สร้าง R2 bucket `hua-saphan-care-files`
- [ ] ผูก D1/R2 bindings กับ Pages
- [ ] สร้าง `schema.sql`
- [ ] สร้าง `seed.sql`
- [ ] ทดสอบ `/api/health`

Definition of Done:

- เปิด `huasaphan-care.pages.dev` ได้
- `/api/health` ตอบกลับ JSON ได้
- D1/R2 bindings พร้อมใช้งาน

---

### Phase 1: Public MVP ฝั่งชาวบ้าน

เป้าหมาย: ชาวบ้านแจ้งเรื่องและได้รับรหัสติดตามได้

- [ ] สร้าง `index.html`
- [ ] สร้าง `report.html`
- [ ] ดึงหมวดปัญหาจาก D1
- [ ] ทำแบบฟอร์มแจ้งเรื่อง
- [ ] ทำ image compression ฝั่ง browser
- [ ] จำกัดภาพสูงสุด 3 ภาพ
- [ ] สร้าง API `POST /api/reports`
- [ ] สร้าง tracking code เช่น `HSC-2026-0001`
- [ ] บันทึกข้อมูลลง D1
- [ ] อัปโหลดรูปภาพไป R2
- [ ] บันทึก metadata ไฟล์ใน D1
- [ ] สร้าง `success.html`
- [ ] แสดงรหัสติดตามให้ผู้ใช้บันทึกไว้

Definition of Done:

- ผู้ใช้ส่งเรื่องจริงได้
- รูปภาพถูกเก็บใน R2
- ข้อมูลหลักถูกเก็บใน D1
- ระบบสร้าง tracking code ได้

---

### Phase 2: ระบบติดตามสถานะ

เป้าหมาย: ผู้แจ้งใช้รหัสติดตามดูความคืบหน้าได้

- [ ] สร้าง `track.html`
- [ ] สร้าง API `GET /api/reports/track?code=`
- [ ] แสดงสถานะล่าสุด
- [ ] แสดง timeline แบบ public
- [ ] ซ่อนข้อมูลส่วนตัว
- [ ] แสดงข้อความแนะนำหากกรอกรหัสผิด

Definition of Done:

- กรอกรหัสติดตามแล้วเห็นสถานะได้
- ข้อมูลส่วนตัวไม่หลุดในหน้าสาธารณะ

---

### Phase 3: Admin Login และ Dashboard

เป้าหมาย: Admin เข้าระบบและดูภาพรวมได้

- [ ] สร้าง `admin/login.html`
- [ ] สร้าง API `POST /api/auth/login`
- [ ] Hash password
- [ ] ใช้ session cookie
- [ ] สร้าง middleware ตรวจ session
- [ ] สร้าง `admin/dashboard.html`
- [ ] สร้าง API `GET /api/admin/dashboard`
- [ ] แสดงเรื่องใหม่
- [ ] แสดงเรื่องเร่งด่วน
- [ ] แสดงจำนวนตามสถานะ
- [ ] แสดงจำนวนตามหมวด

Definition of Done:

- Admin login ได้
- หน้า Admin ถูกป้องกัน
- Dashboard แสดงข้อมูลจาก D1 จริง

---

### Phase 4: Admin จัดการเรื่องร้องเรียน

เป้าหมาย: Admin รับเรื่อง เปลี่ยนสถานะ มอบหมาย และอัปเดต timeline ได้

- [ ] สร้าง `admin/reports.html`
- [ ] สร้าง pagination
- [ ] กรองตามสถานะ
- [ ] กรองตามหมวด
- [ ] ค้นหาด้วย tracking code / หัวข้อ / พื้นที่
- [ ] สร้าง `admin/report-detail.html`
- [ ] แสดงรายละเอียดเรื่อง
- [ ] แสดงภาพแนบ
- [ ] เปลี่ยนสถานะ
- [ ] เพิ่ม timeline
- [ ] มอบหมายผู้รับผิดชอบ
- [ ] แนบภาพหลังดำเนินการ
- [ ] บันทึก audit log ทุก action สำคัญ

Definition of Done:

- Admin จัดการเรื่องได้ครบ cycle ตั้งแต่รับเรื่องถึงปิดเรื่อง

---

### Phase 5: Public Works และ Feedback

เป้าหมาย: แสดงผลงานชุมชนแบบคัดกรองแล้ว และรับความพึงพอใจได้

- [ ] สร้าง `works.html`
- [ ] สร้าง API `GET /api/public/works`
- [ ] Admin เลือกเผยแพร่เรื่องที่แก้ไขแล้วได้
- [ ] ซ่อนข้อมูลส่วนตัว
- [ ] แสดงภาพก่อน-หลังเฉพาะที่อนุญาต
- [ ] สร้าง feedback form หลังปิดเรื่อง
- [ ] บันทึก feedback ลง D1

Definition of Done:

- ประชาชนเห็นตัวอย่างเรื่องที่แก้ไขแล้วได้โดยไม่เปิดเผยข้อมูลส่วนตัว
- เก็บคะแนนความพึงพอใจได้

---

### Phase 6: รายงานและส่งออกข้อมูล

เป้าหมาย: ใช้ข้อมูลประกอบการประชุมและประเมินผลงานได้

- [ ] สรุปรายงานรายเดือน
- [ ] สรุปตามหมวด
- [ ] สรุปตามสถานะ
- [ ] สรุปอัตราแก้ไขสำเร็จ
- [ ] สรุปเรื่องเร่งด่วน
- [ ] สร้าง `export-csv`
- [ ] เพิ่มปุ่มดาวน์โหลด CSV
- [ ] เตรียมข้อมูลสำหรับทำ PDF ภายหลัง

Definition of Done:

- Admin ดาวน์โหลด CSV เพื่อใช้ประกอบรายงานได้

---

### Phase 7: PWA และปรับประสบการณ์ใช้งาน

เป้าหมาย: ให้เว็บดูเหมือนแอพมือถือมากขึ้น

- [ ] สร้าง `manifest.webmanifest`
- [ ] เพิ่ม app icon
- [ ] เพิ่ม theme color
- [ ] เพิ่ม offline page
- [ ] เพิ่มปุ่มแนะนำ “เพิ่มไปยังหน้าจอหลัก”
- [ ] ตรวจ responsive mobile
- [ ] ปรับ loading / empty state / error state

Definition of Done:

- ผู้ใช้สามารถเพิ่มเว็บไว้บนหน้าจอมือถือได้
- ใช้งานมือถือได้ลื่นขึ้น

---

## 21. ลำดับการสั่ง AI Coding

ให้สั่ง AI ทีละขั้น ห้ามสั่งให้สร้างทั้งระบบรวดเดียว

### Prompt 1: สร้างโครงสร้างไฟล์

```txt
สร้างโครงสร้างโปรเจกต์ Hua Saphan Care ตาม README.md โดยใช้ Cloudflare Pages + Pages Functions + D1 + R2 เริ่มด้วย HTML/CSS/JavaScript ธรรมดา สร้างไฟล์ public, functions, schema.sql, seed.sql, wrangler.toml และไฟล์พื้นฐานที่จำเป็นก่อน ยังไม่ต้องทำระบบทั้งหมด
```

### Prompt 2: สร้าง schema และ seed

```txt
จาก README.md ให้สร้าง schema.sql และ seed.sql สำหรับ D1 ให้ครบตามตาราง users, categories, reports, report_updates, assignments, attachments, feedback, news, settings, audit_logs พร้อม index ที่จำเป็น
```

### Prompt 3: สร้าง API health และ public categories

```txt
สร้าง Pages Functions สำหรับ /api/health และ /api/public/categories โดยอ่านข้อมูลจาก D1 binding ชื่อ DB และตอบกลับ JSON พร้อม error handling
```

### Prompt 4: สร้างหน้าแรกและแบบฟอร์มแจ้งเรื่อง

```txt
สร้าง index.html และ report.html สำหรับ Hua Saphan Care สไตล์ mobile-first, clean, friendly, teal pastel โดยหน้า report.html ต้องดึงหมวดจาก /api/public/categories และเตรียมส่งข้อมูลไป /api/reports
```

### Prompt 5: สร้าง API ส่งเรื่อง

```txt
สร้าง /api/reports สำหรับรับเรื่องใหม่ ตรวจ validation สร้าง tracking_code รูปแบบ HSC-2026-0001 บันทึกลง D1 และคืน tracking_code ให้หน้าเว็บ
```

### Prompt 6: สร้างระบบอัปโหลดภาพ

```txt
เพิ่มระบบบีบอัดภาพฝั่ง browser ก่อนอัปโหลด จำกัด 3 ภาพต่อเรื่อง ขนาดต้นฉบับไม่เกิน 8MB และอัปโหลดไป R2 ผ่าน Pages Functions จากนั้นบันทึก r2_key ในตาราง attachments
```

### Prompt 7: สร้างระบบติดตามสถานะ

```txt
สร้าง track.html และ /api/reports/track?code= สำหรับให้ชาวบ้านกรอกรหัสติดตาม เห็นสถานะและ timeline แบบไม่เปิดเผยข้อมูลส่วนตัว
```

### Prompt 8: สร้าง Admin Login

```txt
สร้าง admin/login.html และ API /api/auth/login, /api/auth/logout, /api/auth/me โดยใช้ password hash และ session cookie ป้องกันหน้า /admin/*
```

### Prompt 9: สร้าง Admin Dashboard

```txt
สร้าง admin/dashboard.html และ /api/admin/dashboard แสดงจำนวนเรื่องใหม่ กำลังดำเนินการ แก้ไขแล้ว เร่งด่วน และรายการล่าสุด
```

### Prompt 10: สร้างหน้าจัดการเรื่อง

```txt
สร้าง admin/reports.html และ admin/report-detail.html พร้อม API ที่จำเป็นสำหรับค้นหา กรองสถานะ ดูรายละเอียด เปลี่ยนสถานะ เพิ่ม timeline มอบหมายงาน และบันทึก audit log
```

---

## 22. Security Checklist

- [ ] Admin ทุกหน้าต้องตรวจ session
- [ ] API ฝั่ง Admin ทุก endpoint ต้องตรวจ role
- [ ] Password ต้อง hash เท่านั้น
- [ ] ห้ามเก็บ password จริงใน GitHub
- [ ] ห้ามแสดงชื่อ/เบอร์ผู้แจ้งในหน้าสาธารณะ
- [ ] ห้ามเปิดไฟล์ R2 อ่อนไหวเป็น public
- [ ] จำกัดชนิดไฟล์อัปโหลด
- [ ] จำกัดขนาดไฟล์
- [ ] จำกัดจำนวนภาพต่อเรื่อง
- [ ] sanitize ข้อความจากผู้ใช้ก่อนแสดงผล
- [ ] ใช้ prepared statements กับ D1
- [ ] บันทึก audit logs สำหรับ action สำคัญ
- [ ] มี logout
- [ ] มี rate limit อย่างง่ายใน login หลัง MVP

---

## 23. Testing Checklist

### Public

- [ ] เปิดหน้าแรกบนมือถือได้
- [ ] กดแจ้งเรื่องใหม่ได้
- [ ] เลือกหมวดปัญหาได้
- [ ] กรอกรายละเอียดไม่ครบแล้วระบบเตือน
- [ ] แนบภาพได้ไม่เกิน 3 ภาพ
- [ ] ภาพใหญ่ถูกบีบอัดก่อนส่ง
- [ ] ส่งเรื่องแล้วได้ tracking code
- [ ] ใช้ tracking code ติดตามสถานะได้
- [ ] แจ้งแบบไม่ระบุชื่อแล้วไม่แสดงชื่อ/เบอร์

### Admin

- [ ] Login ได้
- [ ] Logout ได้
- [ ] ไม่ login แล้วเข้าหน้า admin ไม่ได้
- [ ] เห็น dashboard
- [ ] เห็นรายการเรื่อง
- [ ] เปลี่ยนสถานะได้
- [ ] เพิ่ม timeline ได้
- [ ] มอบหมายงานได้
- [ ] แนบภาพหลังดำเนินการได้
- [ ] เลือกเผยแพร่เรื่องที่แก้ไขแล้วได้

### Data

- [ ] reports ถูกบันทึกใน D1
- [ ] report_updates ถูกบันทึกใน D1
- [ ] attachments มี r2_key ถูกต้อง
- [ ] R2 มีไฟล์จริง
- [ ] audit_logs ถูกบันทึกเมื่อ Admin แก้ข้อมูลสำคัญ
- [ ] CSV export เปิดใน Excel ได้

---

## 24. ข้อควบคุมค่าใช้จ่าย

ระบบนี้ออกแบบให้ใช้ Cloudflare Free tier เป็นหลัก แต่ต้องระบุให้ชัดว่า:

```txt
0 บาท ภายใต้เงื่อนไขว่าใช้งานไม่เกินโควตาฟรี ไม่เปิดบริการเสียเงิน ไม่ซื้อโดเมนเพิ่ม และควบคุมปริมาณไฟล์/คำขอใช้งานตามที่กำหนด
```

### แนวทางคุมค่าใช้จ่าย

- ใช้ pages.dev ก่อน ยังไม่ต้องซื้อ domain
- จำกัดภาพ 3 ภาพต่อเรื่องฝั่งผู้ใช้
- บีบอัดภาพก่อนอัปโหลด
- ใช้ Standard storage ของ R2 เท่านั้นในช่วงแรก
- ไม่ใช้ Infrequent Access หากยังไม่เข้าใจ billing
- ใช้ pagination ทุกหน้ารายการ
- ใส่ index ใน D1 ตาม field ที่ค้นหาบ่อย
- ไม่ query `SELECT *` ทั้งตารางใน dashboard
- ตรวจ Cloudflare usage ทุกเดือน
- ลบ temp upload ภายใน 24 ชั่วโมง
- พิจารณาลบหรือ archive ไฟล์เกิน 3 ปี

---

## 25. เกณฑ์ความสำเร็จของ MVP

MVP ถือว่าสำเร็จเมื่อ:

- [ ] ชาวบ้านส่งเรื่องผ่านมือถือได้จริง
- [ ] ระบบสร้างรหัสติดตามได้
- [ ] ชาวบ้านติดตามสถานะได้
- [ ] Admin login ได้
- [ ] Admin เห็นเรื่องใหม่
- [ ] Admin เปลี่ยนสถานะได้
- [ ] Admin เพิ่ม timeline ได้
- [ ] รูปภาพถูกเก็บใน R2
- [ ] ข้อมูลถูกเก็บใน D1
- [ ] มี dashboard สรุปตัวเลขพื้นฐาน
- [ ] มีเรื่องที่แก้ไขแล้วแสดงสาธารณะแบบคัดกรองได้
- [ ] ส่งออก CSV ได้

---

## 26. ข้อเสนอแนะสำหรับการพัฒนาต่อ

หลัง MVP ใช้งานจริงแล้ว ค่อยพิจารณาเพิ่ม:

- ระบบแผนที่ปัญหา
- ระบบ QR Code สำหรับแจ้งเรื่อง
- ระบบ notification ผ่าน LINE หรือ Email
- ระบบ PDF report
- ระบบ chart รายเดือน
- ระบบ SLA ตามหมวดปัญหา
- ระบบ backup/export อัตโนมัติ
- ระบบ Cloudflare Access สำหรับ Admin ระดับสูง
- ย้าย frontend เป็น React/Vite หากหน้าเว็บซับซ้อนขึ้นจริง

---

## 27. คำเตือนสำคัญ

ระบบนี้เป็นระบบรับเรื่องและติดตามการแก้ปัญหาชุมชน ไม่ใช่ระบบแจ้งเหตุฉุกเฉินแทนตำรวจ โรงพยาบาล หน่วยกู้ชีพ หรือหน่วยงานด้านความปลอดภัยโดยตรง

หน้าแรกควรแสดงข้อความชัดเจนว่า:

```txt
หากเป็นเหตุฉุกเฉินที่ต้องการความช่วยเหลือทันที กรุณาโทรติดต่อผู้นำชุมชนหรือหน่วยงานฉุกเฉินโดยตรง โทร 0629617942
```

---

## 28. สรุปแนวทางสุดท้าย

```txt
เริ่มง่าย ใช้จริงก่อน ขยายทีหลัง

Frontend: Cloudflare Pages + HTML/CSS/JS
API: Cloudflare Pages Functions
Database: Cloudflare D1
Files: Cloudflare R2
Admin Auth: Login เองแบบง่าย
URL: https://huasaphan-care.pages.dev
App Name: Hua Saphan Care
```

แนวทางนี้เหมาะกับการสร้างเว็บแอพชุมชนที่ต้องการความเร็ว ความเป็นระบบ ค่าใช้จ่ายต่ำ และไม่ซับซ้อนเกินไปสำหรับการเริ่มต้นจริง
