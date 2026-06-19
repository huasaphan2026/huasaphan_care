# DATA_SCHEMA.md — Hua Saphan Care

ระบบรับเรื่องและแก้ปัญหาชุมชนหัวสะพาน  
บ้านหัวสะพาน หมู่ที่ 1 ตำบลเวียงสระ อำเภอเวียงสระ จังหวัดสุราษฎร์ธานี

เอกสารนี้เป็นเอกสารควบคุมโครงสร้างข้อมูลของเว็บแอป `Hua Saphan Care` ใช้สำหรับกำกับการสร้าง `schema.sql`, `seed.sql`, API, หน้า Admin และการจัดเก็บไฟล์ใน Cloudflare R2 ให้ตรงตามแผนใน `README.md`

---

## 1. เป้าหมายของเอกสารนี้

`DATA_SCHEMA.md` ใช้เพื่อกำหนดว่าเว็บแอปต้องเก็บข้อมูลอะไร เก็บไว้ที่ไหน มีความสัมพันธ์กันอย่างไร และมีข้อจำกัดใดบ้าง เพื่อป้องกันไม่ให้ AI Coding หรือผู้พัฒนาเพิ่ม field / ตาราง / ข้อมูลส่วนตัว เกินความจำเป็น

เอกสารนี้ครอบคลุม:

- โครงสร้างฐานข้อมูล Cloudflare D1
- ตารางหลักและความสัมพันธ์
- ค่า enum ที่ใช้ร่วมกันทั้งระบบ
- index ที่จำเป็น
- seed data เริ่มต้น
- นโยบายเก็บ metadata ของไฟล์แนบ
- โครงสร้าง key สำหรับ Cloudflare R2
- ข้อห้ามด้านข้อมูลส่วนบุคคล
- กติกาการ migration ในอนาคต

---

## 2. หลักการออกแบบข้อมูล

ระบบนี้ต้องยึดหลักดังนี้:

```txt
เก็บเท่าที่จำเป็น
ค้นหาได้เร็วพอสำหรับระดับหมู่บ้าน
ไม่เก็บไฟล์ใหญ่ในฐานข้อมูล
ไม่เปิดข้อมูลส่วนตัวในหน้าสาธารณะ
แก้ไขต่อได้ง่ายในอนาคต
```

### 2.1 ฐานข้อมูลหลัก

ใช้ Cloudflare D1 เป็นฐานข้อมูลหลักสำหรับข้อมูลแบบตาราง เช่น:

- ผู้ดูแลระบบ
- หมวดปัญหา
- เรื่องร้องเรียน / แจ้งปัญหา
- timeline ความคืบหน้า
- การมอบหมายงาน
- metadata ไฟล์แนบ
- feedback
- ข่าว / ประกาศ
- settings
- audit logs

### 2.2 ที่เก็บไฟล์

ใช้ Cloudflare R2 สำหรับเก็บไฟล์แนบและรูปภาพ เช่น:

- ภาพก่อนดำเนินการ
- ภาพระหว่างตรวจสอบ
- ภาพหลังดำเนินการ
- ไฟล์ export ในอนาคต

ห้ามเก็บ binary รูปภาพลงใน D1 โดยตรง

---

## 3. ภาพรวมตารางทั้งหมด

| ตาราง | หน้าที่ | ใช้ใน Phase |
|---|---|---:|
| `users` | ผู้ใช้ฝั่ง Admin / Staff / Viewer | 3 |
| `categories` | หมวดปัญหา | 1 |
| `reports` | เรื่องที่ชาวบ้านแจ้งเข้ามา | 1 |
| `report_updates` | timeline ความคืบหน้าของแต่ละเรื่อง | 2, 4 |
| `assignments` | การมอบหมายงานให้ผู้รับผิดชอบ | 4 |
| `attachments` | metadata ไฟล์แนบที่เก็บใน R2 | 1, 4, 5 |
| `feedback` | คะแนน / ความเห็นหลังปิดเรื่อง | 5 |
| `news` | ข่าว / ประกาศชุมชน | หลัง MVP หรือ Phase เสริม |
| `settings` | ค่าตั้งค่าระบบ | 0, 1 |
| `audit_logs` | บันทึก action สำคัญของ Admin | 4 |

---

## 4. Entity Relationship แบบย่อ

```txt
users
  ├─ reports.assigned_to
  ├─ report_updates.updated_by
  ├─ assignments.user_id
  ├─ assignments.assigned_by
  ├─ attachments.uploaded_by
  ├─ news.created_by
  └─ audit_logs.user_id

categories
  └─ reports.category_id

reports
  ├─ report_updates.report_id
  ├─ assignments.report_id
  ├─ attachments.report_id
  └─ feedback.report_id
```

### ความสัมพันธ์สำคัญ

- 1 หมวดปัญหา มีได้หลายเรื่องร้องเรียน
- 1 เรื่องร้องเรียน มีได้หลาย timeline update
- 1 เรื่องร้องเรียน มีได้หลายไฟล์แนบ
- 1 เรื่องร้องเรียน สามารถมอบหมายได้หลายครั้ง
- 1 เรื่องร้องเรียน ควรมี feedback ได้ 1 ครั้งหลังปิดเรื่อง แต่ระบบอาจยอมให้หลายครั้งในช่วง MVP แล้วค่อยปรับภายหลัง

---

## 5. ตาราง `users`

ใช้เก็บผู้ใช้งานฝั่ง Admin เท่านั้น ไม่ใช่บัญชีชาวบ้านทั่วไป

### 5.1 โครงสร้างตาราง

```sql
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
```

### 5.2 คำอธิบาย field

| Field | Type | Required | คำอธิบาย |
|---|---|---:|---|
| `id` | INTEGER | yes | Primary key |
| `name` | TEXT | yes | ชื่อผู้ใช้งาน เช่น ผู้ใหญ่บ้าน / ผู้ดูแลระบบ |
| `username` | TEXT | yes | ชื่อสำหรับ login ต้องไม่ซ้ำ |
| `email` | TEXT | no | อีเมลผู้ใช้งาน ถ้ามี |
| `phone` | TEXT | no | เบอร์โทรผู้ใช้งาน ถ้ามี |
| `role` | TEXT | yes | สิทธิ์ผู้ใช้: `super_admin`, `admin`, `staff`, `viewer` |
| `password_hash` | TEXT | yes | รหัสผ่านที่ hash แล้วเท่านั้น |
| `active` | INTEGER | yes | 1 = ใช้งาน, 0 = ปิดใช้งาน |
| `created_at` | TEXT | yes | วันที่สร้างข้อมูล |
| `updated_at` | TEXT | no | วันที่แก้ไขล่าสุด |

### 5.3 ข้อกำหนด

- ห้ามเก็บ password แบบ plain text
- ห้ามใส่ password จริงใน `seed.sql` ที่ push ขึ้น GitHub
- ผู้ใช้ที่ `active = 0` ต้อง login ไม่ได้
- `super_admin` เท่านั้นที่ควรเพิ่ม / ปิดผู้ใช้รายอื่นได้

---

## 6. ตาราง `categories`

ใช้เก็บหมวดปัญหาสำหรับแบบฟอร์มแจ้งเรื่องและการกรองข้อมูลใน Admin

### 6.1 โครงสร้างตาราง

```sql
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  default_priority TEXT NOT NULL DEFAULT 'normal',
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0
);
```

### 6.2 คำอธิบาย field

| Field | Type | Required | คำอธิบาย |
|---|---|---:|---|
| `id` | INTEGER | yes | Primary key |
| `code` | TEXT | yes | รหัสหมวด ใช้ในระบบ เช่น `electric` |
| `name` | TEXT | yes | ชื่อหมวดภาษาไทย |
| `description` | TEXT | no | คำอธิบายสั้น ๆ |
| `default_priority` | TEXT | yes | ความเร่งด่วนเริ่มต้นของหมวด |
| `active` | INTEGER | yes | 1 = แสดงใช้งาน, 0 = ซ่อน |
| `sort_order` | INTEGER | yes | ลำดับแสดงผล |

### 6.3 หมวดเริ่มต้น

| code | name | default_priority |
|---|---|---|
| `electric` | ไฟฟ้า / ไฟทาง | `normal` |
| `road` | ถนน / ทางเดิน | `normal` |
| `water` | น้ำ / ท่อระบายน้ำ | `normal` |
| `waste` | ขยะ / ความสะอาด | `normal` |
| `safety` | ความปลอดภัย | `urgent` |
| `nuisance` | เหตุรำคาญ | `normal` |
| `health` | สุขภาพ / ผู้เปราะบาง | `urgent` |
| `suggestion` | ข้อเสนอแนะ | `normal` |

### 6.4 ข้อกำหนด

- ห้ามลบหมวดที่เคยมีรายงานผูกอยู่ ให้ใช้ `active = 0` แทน
- `code` ต้องเป็นภาษาอังกฤษตัวเล็ก ไม่มีช่องว่าง
- API public ต้องแสดงเฉพาะ `active = 1`

---

## 7. ตาราง `reports`

เป็นตารางหลักของระบบ ใช้เก็บเรื่องที่ชาวบ้านแจ้งเข้ามา

### 7.1 โครงสร้างตาราง

```sql
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
```

### 7.2 คำอธิบาย field

| Field | Type | Required | คำอธิบาย |
|---|---|---:|---|
| `id` | INTEGER | yes | Primary key |
| `tracking_code` | TEXT | yes | รหัสติดตาม เช่น `HSC-2026-0001` |
| `category_id` | INTEGER | yes | อ้างอิง `categories.id` |
| `title` | TEXT | yes | หัวข้อปัญหาแบบสั้น |
| `detail` | TEXT | yes | รายละเอียดปัญหา |
| `location_text` | TEXT | yes | จุดเกิดเหตุ / จุดสังเกต |
| `location_lat` | REAL | no | พิกัดละติจูด ถ้าผู้ใช้อนุญาต |
| `location_lng` | REAL | no | พิกัดลองจิจูด ถ้าผู้ใช้อนุญาต |
| `priority` | TEXT | yes | `normal` หรือ `urgent` |
| `status` | TEXT | yes | สถานะเรื่อง |
| `anonymous` | INTEGER | yes | 1 = ไม่ระบุชื่อ, 0 = ระบุชื่อ |
| `reporter_name` | TEXT | no | ชื่อผู้แจ้ง เฉพาะกรณียินยอม |
| `reporter_phone` | TEXT | no | เบอร์ติดต่อ เฉพาะกรณียินยอม |
| `assigned_to` | INTEGER | no | ผู้รับผิดชอบหลักล่าสุด |
| `public_visible` | INTEGER | yes | 1 = เผยแพร่ในหน้า works ได้ |
| `public_summary` | TEXT | no | สรุปสำหรับเผยแพร่แบบคัดกรอง |
| `public_location_label` | TEXT | no | ตำแหน่งแบบกว้าง เช่น “ซอย 3” |
| `public_image_allowed` | INTEGER | yes | 1 = อนุญาตแสดงภาพที่ public_allowed |
| `created_at` | TEXT | yes | วันที่แจ้งเรื่อง |
| `updated_at` | TEXT | no | วันที่แก้ไขล่าสุด |
| `closed_at` | TEXT | no | วันที่ปิดเรื่อง |

### 7.3 กติกา `tracking_code`

รูปแบบ:

```txt
HSC-{YYYY}-{running_number_4_digits}
```

ตัวอย่าง:

```txt
HSC-2026-0001
HSC-2026-0002
HSC-2026-0003
```

ข้อกำหนด:

- ต้อง unique
- running number นับตามปี
- สร้างฝั่ง API เท่านั้น ห้ามรับจาก client
- ถ้าเกิดชนกัน ให้ API retry ด้วยเลขถัดไป

### 7.4 ข้อกำหนดด้านข้อมูลส่วนตัว

ถ้า `anonymous = 1`:

- `reporter_name` ต้องเป็น `NULL` หรือ string ว่าง
- `reporter_phone` ต้องเป็น `NULL` หรือ string ว่าง
- หน้า public และ track ห้ามแสดงข้อมูลระบุตัวผู้แจ้ง

ถ้า `anonymous = 0`:

- อนุญาตให้เก็บชื่อ / เบอร์โทรได้เท่าที่จำเป็น
- ชื่อ / เบอร์โทรต้องแสดงเฉพาะฝั่ง Admin
- ห้ามนำไปแสดงใน `works.html`

---

## 8. ตาราง `report_updates`

ใช้เก็บ timeline ความคืบหน้าของเรื่อง

### 8.1 โครงสร้างตาราง

```sql
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
```

### 8.2 คำอธิบาย field

| Field | Type | Required | คำอธิบาย |
|---|---|---:|---|
| `id` | INTEGER | yes | Primary key |
| `report_id` | INTEGER | yes | อ้างอิง `reports.id` |
| `status` | TEXT | yes | สถานะ ณ ตอนอัปเดต |
| `update_note` | TEXT | yes | ข้อความความคืบหน้า |
| `updated_by` | INTEGER | no | ผู้เพิ่ม update ถ้าเป็น Admin |
| `is_public` | INTEGER | yes | 1 = แสดงในหน้าติดตามได้ |
| `created_at` | TEXT | yes | วันที่เพิ่ม timeline |

### 8.3 ข้อกำหนด

- เมื่อสร้าง report ใหม่ ควรสร้าง update แรกอัตโนมัติ เช่น `รับเรื่องเข้าสู่ระบบแล้ว`
- timeline ที่มีข้อมูลอ่อนไหวให้ตั้ง `is_public = 0`
- หน้า `track.html` แสดงเฉพาะ `is_public = 1`
- หน้า Admin แสดงได้ทั้งหมด

---

## 9. ตาราง `assignments`

ใช้เก็บประวัติการมอบหมายงาน

### 9.1 โครงสร้างตาราง

```sql
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
```

### 9.2 คำอธิบาย field

| Field | Type | Required | คำอธิบาย |
|---|---|---:|---|
| `id` | INTEGER | yes | Primary key |
| `report_id` | INTEGER | yes | เรื่องที่ถูกมอบหมาย |
| `user_id` | INTEGER | yes | ผู้รับผิดชอบ |
| `assigned_by` | INTEGER | no | ผู้มอบหมาย |
| `due_date` | TEXT | no | วันที่ควรดำเนินการเสร็จ |
| `note` | TEXT | no | หมายเหตุการมอบหมาย |
| `created_at` | TEXT | yes | วันที่มอบหมาย |

### 9.3 ข้อกำหนด

- เมื่อมอบหมายงาน ให้ update `reports.assigned_to` เป็นผู้รับผิดชอบล่าสุดด้วย
- ทุกการมอบหมายควรสร้าง `audit_logs`
- ถ้ามีการมอบหมายซ้ำ ให้เก็บเป็น record ใหม่ ไม่ต้องลบ record เก่า

---

## 10. ตาราง `attachments`

ใช้เก็บ metadata ของไฟล์แนบที่เก็บจริงใน R2

### 10.1 โครงสร้างตาราง

```sql
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
```

### 10.2 คำอธิบาย field

| Field | Type | Required | คำอธิบาย |
|---|---|---:|---|
| `id` | INTEGER | yes | Primary key |
| `report_id` | INTEGER | yes | อ้างอิงเรื่อง |
| `r2_key` | TEXT | yes | path/key ของไฟล์ใน R2 |
| `file_name` | TEXT | yes | ชื่อไฟล์เดิมหรือชื่อไฟล์ที่ระบบตั้ง |
| `file_type` | TEXT | yes | MIME type เช่น `image/webp` |
| `file_size` | INTEGER | no | ขนาดไฟล์เป็น byte |
| `purpose` | TEXT | yes | ประเภทไฟล์ เช่น `before`, `after` |
| `public_allowed` | INTEGER | yes | 1 = อนุญาตให้เผยแพร่ได้ |
| `uploaded_by` | INTEGER | no | ผู้ upload ถ้าเป็น Admin |
| `uploaded_at` | TEXT | yes | วันที่ upload |

### 10.3 ค่า `purpose`

| ค่า | ใช้เมื่อ |
|---|---|
| `before` | ภาพปัญหาที่ชาวบ้านแนบตอนแจ้งเรื่อง |
| `admin` | ภาพที่ Admin หรือผู้รับผิดชอบแนบระหว่างตรวจสอบ |
| `after` | ภาพหลังดำเนินการแก้ไข |
| `document` | ไฟล์เอกสารในอนาคต |
| `export` | ไฟล์ export ในอนาคต |

### 10.4 ข้อกำหนด

- D1 เก็บเฉพาะ metadata ไม่เก็บ binary
- ไฟล์ที่มีข้อมูลอ่อนไหวต้อง `public_allowed = 0`
- หน้า public works แสดงได้เฉพาะกรณี:
  - `reports.public_visible = 1`
  - `reports.public_image_allowed = 1`
  - `attachments.public_allowed = 1`
- การเปิดดูภาพใน Admin ควรผ่าน API ที่ตรวจ session ก่อน

---

## 11. ตาราง `feedback`

ใช้เก็บคะแนนความพึงพอใจหลังปิดเรื่อง

### 11.1 โครงสร้างตาราง

```sql
CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL,
  score INTEGER NOT NULL,
  comment TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (report_id) REFERENCES reports(id)
);
```

### 11.2 คำอธิบาย field

| Field | Type | Required | คำอธิบาย |
|---|---|---:|---|
| `id` | INTEGER | yes | Primary key |
| `report_id` | INTEGER | yes | เรื่องที่ให้ feedback |
| `score` | INTEGER | yes | คะแนน เช่น 1-5 |
| `comment` | TEXT | no | ความเห็นเพิ่มเติม |
| `created_at` | TEXT | yes | วันที่ส่ง feedback |

### 11.3 ข้อกำหนด

- `score` ควรอยู่ระหว่าง 1-5
- ควรรับ feedback เฉพาะเรื่องที่ `status` เป็น `resolved` หรือ `closed`
- ข้อความ feedback ต้อง sanitize ก่อนแสดงผล

---

## 12. ตาราง `news`

ใช้เก็บข่าว / ประกาศของชุมชนในอนาคต

### 12.1 โครงสร้างตาราง

```sql
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
```

### 12.2 ข้อกำหนด

- Phase แรกยังไม่จำเป็นต้องทำระบบข่าวให้ซับซ้อน
- ถ้าสร้างหน้า Admin News ให้เก็บแค่ title/content/active ก่อน
- ห้ามฝัง HTML ที่ไม่ sanitize ลงในหน้า public

---

## 13. ตาราง `settings`

ใช้เก็บค่าตั้งค่าระบบที่เปลี่ยนได้โดยไม่ต้องแก้โค้ด

### 13.1 โครงสร้างตาราง

```sql
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### 13.2 ค่าเริ่มต้นที่ต้องมี

| key | value |
|---|---|
| `app_name` | `Hua Saphan Care` |
| `app_url` | `https://huasaphan-care.pages.dev` |
| `project_email` | `huasaphan2026@gmail.com` |
| `emergency_phone` | `0629617942` |
| `max_public_images_per_report` | `3` |
| `max_total_images_per_report` | `5` |
| `image_max_original_mb` | `8` |
| `image_max_width_px` | `1280` |
| `image_target_kb` | `500` |
| `data_retention_years` | `3` |
| `public_resolved_default` | `false` |

### 13.3 ข้อกำหนด

- ค่าใน settings เป็น string ทั้งหมด ให้ API แปลง type เองเมื่อใช้งาน
- การแก้ settings สำคัญต้องสร้าง audit log
- ห้ามเก็บ secret / API key / password ใน settings

---

## 14. ตาราง `audit_logs`

ใช้เก็บประวัติการกระทำสำคัญของ Admin

### 14.1 โครงสร้างตาราง

```sql
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
```

### 14.2 action ที่ควรบันทึก

| action | ใช้เมื่อ |
|---|---|
| `auth.login` | Admin login สำเร็จ |
| `auth.logout` | Admin logout |
| `report.accept` | รับเรื่อง |
| `report.status_change` | เปลี่ยนสถานะ |
| `report.update_add` | เพิ่ม timeline |
| `report.assign` | มอบหมายงาน |
| `report.public_update` | ตั้งค่าเผยแพร่ public |
| `attachment.upload` | upload ไฟล์ |
| `category.create` | เพิ่มหมวด |
| `category.update` | แก้หมวด |
| `user.create` | เพิ่มผู้ใช้ |
| `user.update` | แก้ไขผู้ใช้ |
| `settings.update` | แก้ settings |
| `export.csv` | export CSV |

### 14.3 ข้อกำหนด

- ห้ามเก็บ password หรือ session token ใน audit log
- `detail` ควรเป็น JSON string แบบสั้น ไม่ใส่ข้อมูลส่วนตัวเกินจำเป็น
- action สำคัญใน Admin ทุกครั้งต้องบันทึก log

---

## 15. Enum กลางของระบบ

ค่าเหล่านี้ต้องใช้ตรงกันทั้ง Frontend, API, D1 และเอกสาร

### 15.1 Role

| ค่า | ชื่อไทย | สิทธิ์หลัก |
|---|---|---|
| `super_admin` | ผู้ดูแลหลัก | จัดการทุกอย่าง |
| `admin` | ผู้ดูแลระบบ | จัดการเรื่อง หมวด ข่าว Dashboard |
| `staff` | ผู้รับผิดชอบงาน | ดู / อัปเดตเรื่องที่ได้รับมอบหมาย |
| `viewer` | ผู้ดูรายงาน | ดู Dashboard / รายงานแบบจำกัด |

### 15.2 Priority

| ค่า | ชื่อไทย | ใช้เมื่อ |
|---|---|---|
| `normal` | ปกติ | เรื่องทั่วไป |
| `urgent` | เร่งด่วน | ความปลอดภัย สุขภาพ ผู้เปราะบาง หรือเหตุเสี่ยง |

### 15.3 Report Status

| ค่า | ชื่อไทย | ใช้เมื่อ |
|---|---|---|
| `new` | เรื่องใหม่ | ผู้ใช้ส่งเรื่องเข้ามาใหม่ |
| `accepted` | รับเรื่องแล้ว | Admin ตรวจแล้วและรับเข้าระบบ |
| `checking` | ตรวจสอบข้อมูล | ต้องตรวจพื้นที่หรือข้อมูลเพิ่มเติม |
| `in_progress` | กำลังดำเนินการ | เริ่มแก้ไขแล้ว |
| `forwarded` | ส่งต่อหน่วยงาน | ส่งต่อหน่วยงานอื่น |
| `waiting_info` | รอข้อมูลเพิ่มเติม | รอข้อมูลจากผู้แจ้งหรือพื้นที่ |
| `resolved` | แก้ไขแล้ว | ดำเนินการเสร็จแล้ว |
| `closed` | ปิดเรื่อง | ปิดงานและเก็บประวัติ |
| `rejected` | ไม่รับดำเนินการ | ไม่อยู่ในขอบเขตหรือข้อมูลไม่พอ |

### 15.4 Attachment Purpose

| ค่า | ชื่อไทย |
|---|---|
| `before` | ภาพก่อนดำเนินการ |
| `admin` | ภาพจากผู้ดูแล / ผู้รับผิดชอบ |
| `after` | ภาพหลังดำเนินการ |
| `document` | เอกสาร |
| `export` | ไฟล์ส่งออก |

---

## 16. Index ที่จำเป็น

ต้องมี index อย่างน้อยดังนี้:

```sql
CREATE INDEX IF NOT EXISTS idx_reports_tracking_code ON reports(tracking_code);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_category ON reports(category_id);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at);
CREATE INDEX IF NOT EXISTS idx_report_updates_report_id ON report_updates(report_id);
CREATE INDEX IF NOT EXISTS idx_attachments_report_id ON attachments(report_id);
```

### 16.1 Index เสริมที่แนะนำ

เมื่อระบบเริ่มมีข้อมูลมากขึ้น ค่อยพิจารณาเพิ่ม:

```sql
CREATE INDEX IF NOT EXISTS idx_reports_priority ON reports(priority);
CREATE INDEX IF NOT EXISTS idx_reports_assigned_to ON reports(assigned_to);
CREATE INDEX IF NOT EXISTS idx_reports_public_visible ON reports(public_visible);
CREATE INDEX IF NOT EXISTS idx_assignments_report_id ON assignments(report_id);
CREATE INDEX IF NOT EXISTS idx_assignments_user_id ON assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_report_id ON feedback(report_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
```

### 16.2 ข้อควรระวัง

- อย่าใส่ index ทุก field โดยไม่จำเป็น
- field ที่ค้นหาบ่อยควรมี index
- field ที่ใช้ filter รายการ Admin ควรมี index
- Dashboard ห้าม query ทั้งตารางด้วย `SELECT *`

---

## 17. Seed Data เริ่มต้น

### 17.1 Categories

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
```

### 17.2 Settings

```sql
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

### 17.3 Users

ไม่ควร seed password จริงลง GitHub

แนวทางที่ถูกต้อง:

- สร้าง user แรกผ่าน setup script เฉพาะเครื่อง
- หรือสร้างผ่าน Cloudflare D1 console โดยใส่ `password_hash` ที่สร้างแล้ว
- หรือทำหน้า setup ชั่วคราว แล้วลบทิ้งหลังสร้าง `super_admin`

ข้อมูล Admin ชุดแรก:

```txt
name: นายธราธิป ระวังสุข
role: super_admin
status: active
```

---

## 18. โครงสร้าง R2 Key

ใช้รูปแบบนี้เป็นมาตรฐาน:

```txt
reports/{year}/{tracking_code}/original/{filename}
reports/{year}/{tracking_code}/compressed/{filename}
reports/{year}/{tracking_code}/admin/{filename}
reports/{year}/{tracking_code}/after/{filename}
exports/{year}/{month}/{filename}
temp/{yyyyMMdd}/{random}/{filename}
```

ตัวอย่าง:

```txt
reports/2026/HSC-2026-0001/compressed/before-01.webp
reports/2026/HSC-2026-0001/after/after-01.webp
exports/2026/06/reports-2026-06.csv
temp/20260614/8f3a21/upload-01.webp
```

### 18.1 กติกาการตั้งชื่อไฟล์

- ห้ามใช้ชื่อไฟล์จากผู้ใช้โดยตรงเป็น key หลัก
- ควรสร้างชื่อไฟล์ใหม่ เช่น `before-01.webp`, `after-01.webp`
- ควรแปลงเป็น `.webp` หรือ `.jpg` หลังบีบอัด
- เก็บชื่อเดิมไว้ใน `attachments.file_name` ได้ แต่ต้อง sanitize

### 18.2 ข้อกำหนดไฟล์ภาพ

| รายการ | ค่า |
|---|---|
| จำนวนสูงสุดฝั่งชาวบ้าน | 3 ภาพต่อเรื่อง |
| จำนวนสูงสุดรวมทั้งเรื่อง | 5 ภาพต่อเรื่อง |
| ไฟล์ต้นฉบับ | ไม่เกิน 8 MB ต่อไฟล์ |
| ชนิดไฟล์ | `jpg`, `jpeg`, `png`, `webp` |
| ความกว้างหลังบีบอัด | ไม่เกิน 1280 px |
| ขนาดเป้าหมาย | ไม่เกิน 500 KB ต่อภาพ |
| ขนาดสูงสุดหลังบีบอัด | ไม่เกิน 1 MB ต่อภาพ |

---

## 19. ข้อมูลที่ห้ามเก็บ

ระบบนี้ไม่ควรเก็บข้อมูลต่อไปนี้:

- เลขบัตรประชาชน
- วันเดือนปีเกิด
- บ้านเลขที่แบบละเอียด เว้นแต่จำเป็นมาก
- ข้อมูลสุขภาพละเอียด
- ประวัติการรักษา
- ข้อมูลการเมือง / ศาสนา / เชื้อชาติ
- ข้อมูลความขัดแย้งส่วนบุคคลแบบระบุตัวบุคคลโดยไม่จำเป็น
- รูปภาพที่ตั้งใจถ่ายใบหน้าบุคคล ทะเบียนรถ บ้านเลขที่ หรือเอกสารส่วนตัว
- password แบบ plain text
- secret / token / API key ใน D1

---

## 20. กติกาการแสดงข้อมูล Public

หน้า public ได้แก่:

- `index.html`
- `report.html`
- `success.html`
- `track.html`
- `works.html`
- `emergency.html`

### 20.1 หน้า `track.html`

แสดงได้:

- tracking code
- หมวดปัญหา
- หัวข้อ
- สถานะล่าสุด
- timeline ที่ `is_public = 1`
- วันที่แจ้งเรื่อง
- ข้อความแนะนำทั่วไป

ห้ามแสดง:

- ชื่อผู้แจ้ง
- เบอร์โทร
- พิกัดละเอียด
- ชื่อผู้ถูกร้องเรียน
- timeline ที่ `is_public = 0`
- ภาพที่ไม่ได้รับอนุญาต

### 20.2 หน้า `works.html`

แสดงได้เฉพาะเรื่องที่:

```txt
reports.status IN ('resolved', 'closed')
reports.public_visible = 1
```

แสดงข้อมูลได้:

- หมวดปัญหา
- public summary
- public location label
- ภาพก่อน / หลังที่ผ่านการคัดกรอง
- เดือน / ปี หรือวันที่ทั่วไป
- สถานะแก้ไขแล้ว

ห้ามแสดง:

- รายละเอียดเต็มจาก `reports.detail`
- ชื่อ / เบอร์ผู้แจ้ง
- location_lat / location_lng แบบละเอียด
- ภาพที่ `attachments.public_allowed = 0`

---

## 21. Data Validation ฝั่ง API

API ต้องตรวจข้อมูลก่อนบันทึกลง D1

### 21.1 Reports

| Field | Rule |
|---|---|
| `category_id` | ต้องมีอยู่จริงและ active |
| `title` | required, ความยาวเหมาะสม เช่น 5-120 ตัวอักษร |
| `detail` | required, ความยาวเหมาะสม เช่น 10-2000 ตัวอักษร |
| `location_text` | required, ความยาวเหมาะสม เช่น 3-300 ตัวอักษร |
| `location_lat` | optional, ต้องเป็น number |
| `location_lng` | optional, ต้องเป็น number |
| `anonymous` | boolean-like 0/1 |
| `reporter_phone` | optional, ตรวจรูปแบบเบอร์พื้นฐาน |

### 21.2 Attachments

| Field | Rule |
|---|---|
| `file_type` | ต้องเป็น image ที่อนุญาต |
| `file_size` | ต้องไม่เกินค่าที่กำหนด |
| `purpose` | ต้องอยู่ใน enum |
| `public_allowed` | default = 0 |

### 21.3 Feedback

| Field | Rule |
|---|---|
| `score` | integer 1-5 |
| `comment` | optional, sanitize ก่อนเก็บ/แสดง |

---

## 22. Migration Rules

เมื่อมีการเปลี่ยน schema ในอนาคต ให้ทำตามกติกานี้:

1. ห้ามแก้ `schema.sql` แบบทำให้ข้อมูลเดิมพังโดยไม่วางแผน
2. ถ้าเพิ่ม field ใหม่ ต้องใส่ default หรือยอมให้ NULL ในช่วงแรก
3. ถ้าเปลี่ยน enum ต้องอัปเดต Frontend / API / เอกสารพร้อมกัน
4. ถ้าจะลบ field ต้องทำเป็นขั้นตอน:
   - หยุดใช้งาน field ในโค้ดก่อน
   - export backup
   - migrate ข้อมูล
   - ค่อยลบ field ในรอบถัดไป
5. ควรตั้งชื่อไฟล์ migration เช่น:

```txt
migrations/0001_init.sql
migrations/0002_add_sessions.sql
migrations/0003_add_sla_fields.sql
```

---

## 23. ตารางที่อาจเพิ่มหลัง MVP

ยังไม่ต้องสร้างใน Phase แรก แต่ควรเผื่อแนวคิดไว้

| ตาราง | ใช้เมื่อ |
|---|---|
| `sessions` | ถ้าต้องการเก็บ session ใน D1 แทน signed cookie อย่างเดียว |
| `login_attempts` | ถ้าจะทำ rate limit / lock account |
| `sla_rules` | ถ้าจะกำหนด SLA ตามหมวดปัญหา |
| `notifications` | ถ้าจะเพิ่มระบบแจ้งเตือน LINE / Email |
| `report_comments` | ถ้าจะให้ผู้แจ้งโต้ตอบเพิ่มเติมผ่าน tracking code |
| `map_points` | ถ้าจะทำแผนที่ปัญหาแยกเฉพาะ |
| `exports` | ถ้าต้องเก็บประวัติไฟล์ export |
| `backup_logs` | ถ้าทำ backup/export อัตโนมัติ |

### ข้อสรุป

สำหรับ MVP ยังไม่ต้องสร้างตารางเหล่านี้ เพื่อไม่ให้ระบบซับซ้อนเกินไป

---

## 24. ตัวอย่าง Query สำคัญ

### 24.1 ดึงหมวด active สำหรับฟอร์มแจ้งเรื่อง

```sql
SELECT id, code, name, description, default_priority
FROM categories
WHERE active = 1
ORDER BY sort_order ASC, id ASC;
```

### 24.2 ดึงเรื่องด้วย tracking code สำหรับ public track

```sql
SELECT
  r.tracking_code,
  r.title,
  r.status,
  r.created_at,
  c.name AS category_name
FROM reports r
JOIN categories c ON c.id = r.category_id
WHERE r.tracking_code = ?;
```

### 24.3 ดึง timeline public

```sql
SELECT status, update_note, created_at
FROM report_updates
WHERE report_id = ?
  AND is_public = 1
ORDER BY created_at ASC;
```

### 24.4 สรุป Dashboard Admin

```sql
SELECT status, COUNT(*) AS total
FROM reports
GROUP BY status;
```

### 24.5 ดึงเรื่องเผยแพร่ใน works

```sql
SELECT
  r.id,
  r.tracking_code,
  r.public_summary,
  r.public_location_label,
  r.created_at,
  r.closed_at,
  c.name AS category_name
FROM reports r
JOIN categories c ON c.id = r.category_id
WHERE r.public_visible = 1
  AND r.status IN ('resolved', 'closed')
ORDER BY r.closed_at DESC, r.created_at DESC
LIMIT ? OFFSET ?;
```

---

## 25. Definition of Done สำหรับ DATA_SCHEMA

ถือว่าโครงสร้างข้อมูลพร้อมใช้ เมื่อทำครบดังนี้:

- [ ] มี `schema.sql` สร้างตารางหลักครบ 10 ตาราง
- [ ] มี `seed.sql` สำหรับ categories และ settings
- [ ] เปิด `PRAGMA foreign_keys = ON;`
- [ ] มี index หลักครบ
- [ ] ไม่มี password จริงใน repo
- [ ] ไม่มี binary รูปภาพใน D1
- [ ] API ใช้ prepared statements ทุกครั้ง
- [ ] หน้า public ไม่ดึงข้อมูลส่วนตัว
- [ ] R2 key ใช้รูปแบบมาตรฐาน
- [ ] ส่งเรื่องใหม่แล้วสร้าง `reports`, `report_updates`, `attachments` ได้ถูกต้อง
- [ ] Admin เปลี่ยนสถานะแล้วสร้าง `report_updates` และ `audit_logs` ได้
- [ ] เผยแพร่ผลงานได้เฉพาะ record ที่ผ่านการคัดกรองแล้ว

---

## 26. ข้อควบคุมสำคัญสำหรับ AI Coding

เมื่อนำเอกสารนี้ไปให้ AI Coding หรือ Codex ใช้ ต้องกำชับว่า:

```txt
ให้ยึด DATA_SCHEMA.md เป็นแหล่งอ้างอิงหลักด้านฐานข้อมูล
ห้ามเพิ่มตารางใหม่เองโดยไม่จำเป็น
ห้ามเปลี่ยนชื่อ field เอง
ห้ามเก็บข้อมูลส่วนตัวเกินที่กำหนด
ห้ามเก็บไฟล์รูปใน D1
ห้ามแสดงข้อมูลส่วนตัวใน public API
ถ้าต้องเพิ่ม field ใหม่ ให้เสนอเหตุผลก่อน
```

---

## 27. สรุปแนวทางข้อมูล

```txt
D1 = เก็บข้อมูลตารางและ metadata
R2 = เก็บไฟล์แนบและรูปภาพ
Public = เห็นเฉพาะข้อมูลที่คัดกรองแล้ว
Admin = เห็นข้อมูลตามสิทธิ์และต้อง login
Reports = แกนหลักของระบบ
Tracking Code = เครื่องมือสำคัญสำหรับชาวบ้าน
Audit Logs = หลักฐานการทำงานของ Admin
```

ระบบข้อมูลของ `Hua Saphan Care` ต้องเรียบง่าย ตรวจสอบได้ ปลอดภัยพอเหมาะ และรองรับการใช้งานจริงของชุมชนโดยไม่เพิ่มภาระดูแลระบบเกินจำเป็น
