# API_SPEC.md

# Hua Saphan Care — API Specification

เอกสารนี้ใช้กำกับการสร้าง API ของเว็บแอป `Hua Saphan Care` ให้ตรงตามแผนใน `README.md`, `APP_SPEC.md`, `UI_FLOW.md` และ `DATA_SCHEMA.md`

API ทั้งหมดในเวอร์ชันเริ่มต้นให้สร้างด้วย **Cloudflare Pages Functions** ภายใต้โฟลเดอร์ `functions/api/` โดยเชื่อมต่อฐานข้อมูลผ่าน D1 binding ชื่อ `DB` และเชื่อมต่อไฟล์แนบผ่าน R2 binding ชื่อ `BUCKET`

---

## 1. เป้าหมายของเอกสาร

เอกสารนี้ใช้เพื่อควบคุมว่า AI Coding / Codex / ผู้พัฒนา ต้องสร้าง API ตามแนวทางเดียวกัน ไม่เพิ่ม endpoint เกินจำเป็น และไม่ทำระบบซับซ้อนเกิน MVP

API ต้องรองรับงานหลัก 6 กลุ่ม

1. ตรวจสถานะระบบ
2. ดึงข้อมูลสาธารณะ เช่น หมวดปัญหา เบอร์ฉุกเฉิน ผลงานชุมชน
3. รับเรื่องแจ้งปัญหาจากชาวบ้าน
4. อัปโหลดและจัดการรูปภาพแนบ
5. ติดตามสถานะด้วยรหัสติดตาม
6. ระบบ Admin สำหรับ login, dashboard, จัดการเรื่อง, ผู้ใช้, หมวด, รายงาน

---

## 2. หลักการออกแบบ API

### 2.1 รูปแบบ API

ใช้รูปแบบ REST-like API ที่เรียบง่าย

```txt
GET     อ่านข้อมูล
POST    สร้างข้อมูลใหม่ / ส่งคำสั่ง
PATCH   แก้ไขข้อมูลบางส่วน
DELETE  ปิดใช้งานหรือลบเฉพาะกรณีจำเป็น
```

### 2.2 Base Path

```txt
/api
```

ตัวอย่าง

```txt
/api/health
/api/public/categories
/api/reports
/api/auth/login
/api/admin/dashboard
```

### 2.3 Content Type

สำหรับข้อมูลทั่วไป

```http
Content-Type: application/json
```

สำหรับ upload รูปภาพ

```http
Content-Type: multipart/form-data
```

หรือใช้ signed upload flow หากพัฒนาในอนาคต

---

## 3. Response Format มาตรฐาน

ทุก API ต้องตอบกลับ JSON ในรูปแบบเดียวกัน

### 3.1 Success Response

```json
{
  "ok": true,
  "data": {},
  "message": "success"
}
```

กรณีเป็นรายการข้อมูล

```json
{
  "ok": true,
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### 3.2 Error Response

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "กรุณากรอกข้อมูลให้ครบถ้วน",
    "fields": {
      "title": "กรุณากรอกหัวข้อเรื่อง"
    }
  }
}
```

---

## 4. HTTP Status Code ที่ใช้

| Status | ใช้เมื่อ |
|---:|---|
| 200 | สำเร็จ |
| 201 | สร้างข้อมูลสำเร็จ |
| 400 | ข้อมูลที่ส่งมาไม่ถูกต้อง |
| 401 | ยังไม่ได้เข้าสู่ระบบ |
| 403 | ไม่มีสิทธิ์ทำรายการนี้ |
| 404 | ไม่พบข้อมูล |
| 409 | ข้อมูลซ้ำหรือสถานะขัดกัน |
| 413 | ไฟล์ใหญ่เกินกำหนด |
| 415 | ชนิดไฟล์ไม่รองรับ |
| 429 | ส่งคำขอถี่เกินไป |
| 500 | ระบบผิดพลาด |

---

## 5. Error Code มาตรฐาน

| Code | ความหมาย |
|---|---|
| `VALIDATION_ERROR` | ข้อมูลไม่ครบหรือรูปแบบไม่ถูกต้อง |
| `UNAUTHORIZED` | ยังไม่ได้ login |
| `FORBIDDEN` | ไม่มีสิทธิ์ |
| `NOT_FOUND` | ไม่พบข้อมูล |
| `DUPLICATE_DATA` | ข้อมูลซ้ำ |
| `INVALID_STATUS` | สถานะไม่ถูกต้อง |
| `UPLOAD_LIMIT_EXCEEDED` | จำนวนไฟล์เกินกำหนด |
| `FILE_TOO_LARGE` | ไฟล์ใหญ่เกินกำหนด |
| `UNSUPPORTED_FILE_TYPE` | ประเภทไฟล์ไม่รองรับ |
| `TRACKING_CODE_INVALID` | รหัสติดตามไม่ถูกต้อง |
| `LOGIN_FAILED` | username หรือ password ไม่ถูกต้อง |
| `SERVER_ERROR` | ระบบผิดพลาด |

---

## 6. Authentication และ Session

### 6.1 แนวทาง MVP

ระบบ Admin ใช้ login เองแบบง่าย

- username/password
- password ต้อง hash เท่านั้น
- ใช้ session cookie แบบ `HttpOnly`
- API ฝั่ง Admin ต้องตรวจ session ทุกครั้ง
- ห้ามส่งข้อมูล password hash กลับไปที่ frontend

### 6.2 Cookie ที่แนะนำ

```http
Set-Cookie: hsc_session=SESSION_TOKEN; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800
```

ค่าเริ่มต้น session

```txt
อายุ session: 7 วัน
```

### 6.3 Role ที่ใช้

| Role | สิทธิ์หลัก |
|---|---|
| `super_admin` | จัดการทุกอย่าง |
| `admin` | จัดการเรื่อง หมวด ข่าว รายงาน |
| `staff` | ดูและอัปเดตเรื่องที่ได้รับมอบหมาย |
| `viewer` | ดู dashboard/report เท่านั้น |

---

## 7. Public API

Public API คือ API ที่ผู้ใช้ทั่วไปเรียกได้โดยไม่ต้อง login แต่ต้องระวังไม่เปิดเผยข้อมูลส่วนตัว

---

### 7.1 GET /api/health

ใช้ตรวจสอบว่า API ทำงาน

#### Request

```http
GET /api/health
```

#### Success Response

```json
{
  "ok": true,
  "data": {
    "app": "Hua Saphan Care",
    "status": "ok",
    "time": "2026-06-14T12:00:00.000Z"
  }
}
```

#### หมายเหตุ

- ต้องไม่ query ข้อมูลหนัก
- ใช้ทดสอบ Cloudflare Pages Functions และ deployment

---

### 7.2 GET /api/public/categories

ดึงหมวดปัญหาที่ active เพื่อแสดงในแบบฟอร์มแจ้งเรื่อง

#### Request

```http
GET /api/public/categories
```

#### Query Parameters

ไม่มี

#### Success Response

```json
{
  "ok": true,
  "data": [
    {
      "id": 1,
      "code": "electric",
      "name": "ไฟฟ้า / ไฟทาง",
      "description": "ไฟทางเสีย ไฟกะพริบ จุดมืด เสาไฟมีปัญหา",
      "default_priority": "normal",
      "sort_order": 1
    }
  ]
}
```

#### SQL แนวทาง

```sql
SELECT id, code, name, description, default_priority, sort_order
FROM categories
WHERE active = 1
ORDER BY sort_order ASC, id ASC;
```

---

### 7.3 GET /api/public/emergency

ดึงเบอร์ติดต่อฉุกเฉินและข้อความเตือนหน้าแรก

#### Request

```http
GET /api/public/emergency
```

#### Success Response

```json
{
  "ok": true,
  "data": {
    "phone": "0629617942",
    "message": "หากเป็นเหตุฉุกเฉินที่ต้องการความช่วยเหลือทันที กรุณาโทรติดต่อผู้นำชุมชนหรือหน่วยงานฉุกเฉินโดยตรง"
  }
}
```

#### หมายเหตุ

- อ่านค่าจากตาราง `settings`
- ไม่ hardcode ในหน้าเว็บ หากเป็นไปได้

---

### 7.4 GET /api/public/works

ดึงเรื่องที่แก้ไขแล้วและ Admin อนุญาตให้เผยแพร่สาธารณะ

#### Request

```http
GET /api/public/works?page=1&pageSize=12&category=electric
```

#### Query Parameters

| Parameter | Type | Required | รายละเอียด |
|---|---|---:|---|
| `page` | number | no | ค่าเริ่มต้น 1 |
| `pageSize` | number | no | ค่าเริ่มต้น 12, สูงสุด 30 |
| `category` | string | no | code หมวดปัญหา |

#### Success Response

```json
{
  "ok": true,
  "data": [
    {
      "tracking_code": "HSC-2026-0001",
      "category_name": "ไฟฟ้า / ไฟทาง",
      "public_summary": "ซ่อมไฟทางบริเวณซอย 3 เรียบร้อยแล้ว",
      "public_location_label": "ซอย 3",
      "created_at": "2026-06-10T09:00:00.000Z",
      "closed_at": "2026-06-12T15:00:00.000Z",
      "images": [
        {
          "url": "/api/public/works/HSC-2026-0001/images/1",
          "purpose": "after"
        }
      ]
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 12,
    "total": 1,
    "totalPages": 1
  }
}
```

#### ข้อห้าม

ห้ามส่งข้อมูลต่อไปนี้ใน API นี้

- reporter_name
- reporter_phone
- location_lat/location_lng แบบละเอียด
- รายละเอียดปัญหาดิบที่ยังไม่คัดกรอง
- ภาพที่ยังไม่ได้อนุญาตให้เผยแพร่

---

## 8. Reports API ฝั่งชาวบ้าน

---

### 8.1 POST /api/reports

รับเรื่องแจ้งปัญหาใหม่จากชาวบ้าน

#### Request

```http
POST /api/reports
Content-Type: application/json
```

#### Request Body

```json
{
  "category_id": 1,
  "title": "ไฟทางเสียหน้าซอย",
  "detail": "ไฟทางบริเวณหน้าซอย 3 ดับมา 2 คืนแล้ว",
  "location_text": "ซอย 3 ใกล้ศาลาหมู่บ้าน",
  "location_lat": 8.123456,
  "location_lng": 99.123456,
  "anonymous": true,
  "reporter_name": "",
  "reporter_phone": "",
  "temp_upload_ids": ["tmp_abc123", "tmp_def456"]
}
```

#### Required Fields

| Field | Required | เงื่อนไข |
|---|---:|---|
| `category_id` | yes | ต้องมีอยู่จริงและ active |
| `title` | yes | 5-120 ตัวอักษร |
| `detail` | yes | 10-2000 ตัวอักษร |
| `location_text` | yes | 3-300 ตัวอักษร |
| `anonymous` | yes | boolean |
| `reporter_name` | no | กรอกเฉพาะ anonymous = false |
| `reporter_phone` | no | กรอกเฉพาะ anonymous = false |
| `location_lat` | no | ต้องเป็นตัวเลขถ้ามี |
| `location_lng` | no | ต้องเป็นตัวเลขถ้ามี |

#### Business Rules

- ถ้า `anonymous = true` ห้ามบังคับชื่อและเบอร์โทร
- ถ้า `anonymous = false` ควรให้กรอกชื่อหรือเบอร์โทรอย่างน้อย 1 อย่าง
- ต้องสร้าง `tracking_code` อัตโนมัติ
- สถานะแรกคือ `new`
- priority เริ่มต้นดึงจาก `categories.default_priority`
- ต้องสร้าง timeline แรกใน `report_updates`
- ถ้ามี temp upload ต้องผูกกับ report หลังสร้าง report สำเร็จ

#### Tracking Code Format

```txt
HSC-YYYY-0001
```

ตัวอย่าง

```txt
HSC-2026-0001
```

#### Success Response

```json
{
  "ok": true,
  "data": {
    "tracking_code": "HSC-2026-0001",
    "status": "new",
    "message": "ส่งเรื่องเรียบร้อยแล้ว กรุณาบันทึกรหัสติดตามนี้ไว้"
  }
}
```

#### Validation Error Response

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "กรุณาตรวจสอบข้อมูล",
    "fields": {
      "title": "กรุณากรอกหัวข้อเรื่อง",
      "detail": "กรุณากรอกรายละเอียดอย่างน้อย 10 ตัวอักษร"
    }
  }
}
```

---

### 8.2 GET /api/reports/track

ติดตามสถานะด้วยรหัสติดตาม

#### Request

```http
GET /api/reports/track?code=HSC-2026-0001
```

#### Query Parameters

| Parameter | Required | รายละเอียด |
|---|---:|---|
| `code` | yes | tracking_code |

#### Success Response

```json
{
  "ok": true,
  "data": {
    "tracking_code": "HSC-2026-0001",
    "category_name": "ไฟฟ้า / ไฟทาง",
    "title": "ไฟทางเสียหน้าซอย",
    "location_text": "ซอย 3 ใกล้ศาลาหมู่บ้าน",
    "status": "in_progress",
    "status_label": "กำลังดำเนินการ",
    "created_at": "2026-06-10T09:00:00.000Z",
    "updated_at": "2026-06-11T10:30:00.000Z",
    "timeline": [
      {
        "status": "new",
        "status_label": "เรื่องใหม่",
        "note": "ระบบได้รับเรื่องเรียบร้อยแล้ว",
        "created_at": "2026-06-10T09:00:00.000Z"
      },
      {
        "status": "in_progress",
        "status_label": "กำลังดำเนินการ",
        "note": "ผู้รับผิดชอบกำลังตรวจสอบพื้นที่",
        "created_at": "2026-06-11T10:30:00.000Z"
      }
    ]
  }
}
```

#### ข้อมูลที่ห้ามส่งออก

- reporter_name
- reporter_phone
- assigned_to name/phone หากไม่จำเป็น
- audit_logs
- ภาพภายในที่ยังไม่ได้อนุญาต
- update_note ที่ `is_public = 0`

#### Not Found Response

```json
{
  "ok": false,
  "error": {
    "code": "TRACKING_CODE_INVALID",
    "message": "ไม่พบรหัสติดตามนี้ กรุณาตรวจสอบอีกครั้ง"
  }
}
```

---

### 8.3 POST /api/reports/feedback

ส่งความพึงพอใจหลังเรื่องปิดหรือแก้ไขแล้ว

#### Request Body

```json
{
  "tracking_code": "HSC-2026-0001",
  "score": 5,
  "comment": "ดำเนินการรวดเร็วดีมาก"
}
```

#### Validation

| Field | Required | เงื่อนไข |
|---|---:|---|
| `tracking_code` | yes | ต้องมีอยู่จริง |
| `score` | yes | 1-5 |
| `comment` | no | ไม่เกิน 1000 ตัวอักษร |

#### Business Rules

- รับ feedback ได้เฉพาะเรื่องที่สถานะ `resolved` หรือ `closed`
- 1 tracking_code ควรส่ง feedback ได้ 1 ครั้งใน MVP

#### Success Response

```json
{
  "ok": true,
  "data": {
    "message": "ขอบคุณสำหรับความคิดเห็น"
  }
}
```

---

## 9. Upload API

---

### 9.1 POST /api/uploads/image

อัปโหลดรูปภาพแนบเรื่อง

#### แนวทาง MVP ที่แนะนำ

ให้ frontend บีบอัดภาพก่อนส่ง แล้วอัปโหลดผ่าน API นี้

#### Request

```http
POST /api/uploads/image
Content-Type: multipart/form-data
```

#### Form Data

| Field | Required | รายละเอียด |
|---|---:|---|
| `file` | yes | รูปภาพ jpg, jpeg, png, webp |
| `purpose` | yes | `before`, `after`, `admin` |
| `tracking_code` | no | ใช้หลังสร้าง report แล้ว |
| `temp_id` | no | ใช้กรณี upload ก่อนสร้าง report |

#### Upload Rules

| รายการ | ค่า |
|---|---|
| จำนวนภาพฝั่งชาวบ้าน | สูงสุด 3 ภาพต่อเรื่อง |
| จำนวนภาพรวมทั้งเรื่อง | สูงสุด 5 ภาพ |
| ขนาดไฟล์ต้นฉบับ | ไม่เกิน 8 MB |
| ขนาดหลังบีบอัดเป้าหมาย | ไม่เกิน 500 KB |
| ขนาดหลังบีบอัดสูงสุด | ไม่เกิน 1 MB |
| ความกว้างสูงสุด | 1280 px |
| ชนิดไฟล์ | jpg, jpeg, png, webp |

#### Success Response

```json
{
  "ok": true,
  "data": {
    "upload_id": "upl_abc123",
    "r2_key": "reports/2026/HSC-2026-0001/compressed/before-01.webp",
    "file_name": "before-01.webp",
    "file_type": "image/webp",
    "file_size": 420000,
    "purpose": "before"
  }
}
```

#### ข้อควรระวัง

- ห้ามเปิด R2 bucket เป็น public ทั้งหมด
- หากต้องแสดงภาพ Admin ให้ผ่าน API ที่ตรวจสิทธิ์
- หากต้องแสดงภาพ public works ให้ใช้เฉพาะภาพที่ `public_allowed = 1`

---

### 9.2 GET /api/uploads/image/:id

อ่านรูปภาพแบบมีการตรวจสิทธิ์

> Endpoint นี้ใช้ใน Admin หรือกรณีต้องควบคุมการเข้าถึงภาพ ไม่ใช่ public asset

#### Request

```http
GET /api/uploads/image/123
```

#### Access Rules

- ถ้าเป็น Admin ต้อง login
- ถ้าเป็น public works ต้องอนุญาตเฉพาะภาพที่ `public_allowed = 1`
- ห้ามคืนภาพที่เป็นข้อมูลอ่อนไหวโดยตรง

---

## 10. Auth API

---

### 10.1 POST /api/auth/login

เข้าสู่ระบบ Admin

#### Request Body

```json
{
  "username": "admin",
  "password": "password-input"
}
```

#### Validation

| Field | Required | เงื่อนไข |
|---|---:|---|
| `username` | yes | 3-50 ตัวอักษร |
| `password` | yes | 8-100 ตัวอักษร |

#### Business Rules

- ค้นหา user ที่ `active = 1`
- ตรวจ password ด้วย hash compare
- สร้าง session token
- ตั้ง cookie แบบ HttpOnly
- บันทึก audit log หรือ login log หลัง MVP

#### Success Response

```json
{
  "ok": true,
  "data": {
    "user": {
      "id": 1,
      "name": "นายธราธิป ระวังสุข",
      "username": "admin",
      "role": "super_admin"
    }
  }
}
```

#### Error Response

```json
{
  "ok": false,
  "error": {
    "code": "LOGIN_FAILED",
    "message": "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"
  }
}
```

---

### 10.2 POST /api/auth/logout

ออกจากระบบ

#### Request

```http
POST /api/auth/logout
```

#### Success Response

```json
{
  "ok": true,
  "data": {
    "message": "ออกจากระบบแล้ว"
  }
}
```

#### Business Rules

- ลบ session ฝั่ง server ถ้ามี session table
- clear cookie `hsc_session`

---

### 10.3 GET /api/auth/me

ตรวจ session ปัจจุบัน

#### Request

```http
GET /api/auth/me
```

#### Success Response

```json
{
  "ok": true,
  "data": {
    "user": {
      "id": 1,
      "name": "นายธราธิป ระวังสุข",
      "username": "admin",
      "role": "super_admin"
    }
  }
}
```

#### Unauthorized Response

```json
{
  "ok": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "กรุณาเข้าสู่ระบบ"
  }
}
```

---

## 11. Admin API

Admin API ทุก endpoint ต้องตรวจ session และ role ก่อนเสมอ

---

### 11.1 GET /api/admin/dashboard

ดึงข้อมูลสรุป Dashboard

#### Request

```http
GET /api/admin/dashboard
```

#### Success Response

```json
{
  "ok": true,
  "data": {
    "summary": {
      "new": 5,
      "urgent": 2,
      "in_progress": 8,
      "resolved": 15,
      "closed": 10,
      "total": 40
    },
    "by_category": [
      {
        "category_name": "ไฟฟ้า / ไฟทาง",
        "count": 12
      }
    ],
    "latest_reports": [
      {
        "id": 1,
        "tracking_code": "HSC-2026-0001",
        "title": "ไฟทางเสียหน้าซอย",
        "category_name": "ไฟฟ้า / ไฟทาง",
        "priority": "normal",
        "status": "new",
        "created_at": "2026-06-10T09:00:00.000Z"
      }
    ]
  }
}
```

#### Performance Rules

- ห้าม `SELECT *` ทั้งตาราง
- ต้องใช้ count query แยกตามจำเป็น
- latest_reports จำกัด 10 รายการ

---

### 11.2 GET /api/admin/reports

รายการเรื่องทั้งหมดแบบแบ่งหน้า ค้นหา และกรองข้อมูล

#### Request

```http
GET /api/admin/reports?page=1&pageSize=20&status=new&category=electric&q=ซอย%203
```

#### Query Parameters

| Parameter | Type | Required | รายละเอียด |
|---|---|---:|---|
| `page` | number | no | ค่าเริ่มต้น 1 |
| `pageSize` | number | no | ค่าเริ่มต้น 20, สูงสุด 50 |
| `status` | string | no | สถานะเรื่อง |
| `category` | string | no | code หมวด |
| `priority` | string | no | `normal`, `urgent` |
| `q` | string | no | ค้นหา tracking_code, title, location_text |
| `date_from` | string | no | YYYY-MM-DD |
| `date_to` | string | no | YYYY-MM-DD |

#### Success Response

```json
{
  "ok": true,
  "data": [
    {
      "id": 1,
      "tracking_code": "HSC-2026-0001",
      "title": "ไฟทางเสียหน้าซอย",
      "category_name": "ไฟฟ้า / ไฟทาง",
      "location_text": "ซอย 3 ใกล้ศาลาหมู่บ้าน",
      "priority": "normal",
      "status": "new",
      "anonymous": true,
      "created_at": "2026-06-10T09:00:00.000Z",
      "updated_at": null
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

---

### 11.3 GET /api/admin/reports/:id

รายละเอียดเรื่องสำหรับ Admin

#### Request

```http
GET /api/admin/reports/1
```

#### Success Response

```json
{
  "ok": true,
  "data": {
    "report": {
      "id": 1,
      "tracking_code": "HSC-2026-0001",
      "category_id": 1,
      "category_name": "ไฟฟ้า / ไฟทาง",
      "title": "ไฟทางเสียหน้าซอย",
      "detail": "ไฟทางบริเวณหน้าซอย 3 ดับมา 2 คืนแล้ว",
      "location_text": "ซอย 3 ใกล้ศาลาหมู่บ้าน",
      "location_lat": 8.123456,
      "location_lng": 99.123456,
      "priority": "normal",
      "status": "new",
      "anonymous": true,
      "reporter_name": null,
      "reporter_phone": null,
      "assigned_to": null,
      "public_visible": false,
      "created_at": "2026-06-10T09:00:00.000Z"
    },
    "timeline": [],
    "attachments": [],
    "assignments": []
  }
}
```

#### Access Rules

- `super_admin`, `admin` เห็นทุกเรื่อง
- `staff` เห็นเฉพาะเรื่องที่มอบหมายให้ตนเอง หรือจะกำหนดให้เห็นทุกเรื่องใน MVP ก็ได้ แต่แก้ได้เฉพาะที่ได้รับมอบหมาย
- `viewer` เห็นเฉพาะข้อมูลรายงาน ไม่ควรเห็นเบอร์โทรผู้แจ้ง

---

### 11.4 PATCH /api/admin/reports/:id/status

เปลี่ยนสถานะเรื่อง

#### Request Body

```json
{
  "status": "in_progress",
  "note": "ผู้รับผิดชอบเริ่มตรวจสอบพื้นที่แล้ว",
  "is_public": true
}
```

#### Allowed Status

```txt
new
accepted
checking
in_progress
forwarded
waiting_info
resolved
closed
rejected
```

#### Business Rules

- ต้องตรวจว่า status อยู่ในรายการที่อนุญาต
- เมื่อเปลี่ยน status ต้องเพิ่ม record ใน `report_updates`
- ถ้า status เป็น `resolved` หรือ `closed` ให้ set `closed_at` ตามเงื่อนไข
- ต้องบันทึก audit log

#### Success Response

```json
{
  "ok": true,
  "data": {
    "id": 1,
    "tracking_code": "HSC-2026-0001",
    "status": "in_progress",
    "updated_at": "2026-06-11T10:30:00.000Z"
  }
}
```

---

### 11.5 POST /api/admin/reports/:id/updates

เพิ่ม timeline โดยไม่จำเป็นต้องเปลี่ยน status

#### Request Body

```json
{
  "status": "checking",
  "update_note": "ลงพื้นที่ตรวจสอบแล้ว พบว่าไฟทางเสียจริง",
  "is_public": true
}
```

#### Validation

| Field | Required | เงื่อนไข |
|---|---:|---|
| `status` | yes | ต้องเป็น status ที่อนุญาต |
| `update_note` | yes | 3-2000 ตัวอักษร |
| `is_public` | no | default true |

#### Success Response

```json
{
  "ok": true,
  "data": {
    "id": 12,
    "report_id": 1,
    "status": "checking",
    "update_note": "ลงพื้นที่ตรวจสอบแล้ว พบว่าไฟทางเสียจริง",
    "is_public": true,
    "created_at": "2026-06-11T10:30:00.000Z"
  }
}
```

---

### 11.6 POST /api/admin/reports/:id/assignments

มอบหมายผู้รับผิดชอบ

#### Request Body

```json
{
  "user_id": 3,
  "due_date": "2026-06-15",
  "note": "มอบหมายให้ตรวจสอบไฟทางซอย 3"
}
```

#### Business Rules

- user_id ต้องเป็นผู้ใช้ active
- role ของผู้รับมอบหมายควรเป็น `staff`, `admin`, หรือ `super_admin`
- update `reports.assigned_to`
- เพิ่ม record ใน `assignments`
- เพิ่ม timeline อัตโนมัติได้ เช่น “มอบหมายผู้รับผิดชอบแล้ว”
- บันทึก audit log

#### Success Response

```json
{
  "ok": true,
  "data": {
    "report_id": 1,
    "assigned_to": 3,
    "assigned_name": "ผู้รับผิดชอบงาน",
    "due_date": "2026-06-15"
  }
}
```

---

### 11.7 PATCH /api/admin/reports/:id/public

ตั้งค่าการเผยแพร่เรื่องที่แก้ไขแล้วบนหน้า public works

#### Request Body

```json
{
  "public_visible": true,
  "public_summary": "ซ่อมไฟทางบริเวณซอย 3 เรียบร้อยแล้ว",
  "public_location_label": "ซอย 3",
  "public_image_allowed": true,
  "allowed_attachment_ids": [5, 6]
}
```

#### Business Rules

- เผยแพร่ได้เฉพาะเรื่องที่ `resolved` หรือ `closed`
- public_summary ต้องเป็นข้อความที่คัดกรองแล้ว
- public_location_label ต้องไม่ละเอียดเกินไป
- ห้ามเผยแพร่ภาพที่มีใบหน้า บ้านเลขที่ ทะเบียนรถ หรือข้อมูลส่วนตัว
- update `attachments.public_allowed` เฉพาะ id ที่อนุญาต
- บันทึก audit log

#### Success Response

```json
{
  "ok": true,
  "data": {
    "report_id": 1,
    "public_visible": true
  }
}
```

---

## 12. Admin Categories API

---

### 12.1 GET /api/admin/categories

ดึงรายการหมวดทั้งหมด รวม inactive

#### Success Response

```json
{
  "ok": true,
  "data": [
    {
      "id": 1,
      "code": "electric",
      "name": "ไฟฟ้า / ไฟทาง",
      "description": "ไฟทางเสีย ไฟกะพริบ จุดมืด เสาไฟมีปัญหา",
      "default_priority": "normal",
      "active": true,
      "sort_order": 1
    }
  ]
}
```

---

### 12.2 POST /api/admin/categories

เพิ่มหมวดใหม่

#### Request Body

```json
{
  "code": "environment",
  "name": "สิ่งแวดล้อม",
  "description": "ปัญหาด้านสิ่งแวดล้อมในชุมชน",
  "default_priority": "normal",
  "active": true,
  "sort_order": 9
}
```

#### Validation

- code ต้อง unique
- code ใช้ lowercase English, number, underscore เท่านั้น
- name ห้ามว่าง
- default_priority ต้องเป็น `normal` หรือ `urgent`

---

### 12.3 PATCH /api/admin/categories/:id

แก้ไขหมวด

#### Request Body

```json
{
  "name": "ไฟฟ้า / ไฟทาง",
  "description": "ไฟทางเสีย ไฟกะพริบ จุดมืด เสาไฟมีปัญหา",
  "default_priority": "normal",
  "active": true,
  "sort_order": 1
}
```

#### Business Rules

- ไม่ควรลบหมวดที่มี report แล้ว ให้ใช้ `active = false`
- บันทึก audit log เมื่อแก้ไข

---

## 13. Admin Users API

---

### 13.1 GET /api/admin/users

ดึงรายการผู้ใช้ Admin/Staff

#### Success Response

```json
{
  "ok": true,
  "data": [
    {
      "id": 1,
      "name": "นายธราธิป ระวังสุข",
      "username": "admin",
      "email": null,
      "phone": null,
      "role": "super_admin",
      "active": true,
      "created_at": "2026-06-10T09:00:00.000Z"
    }
  ]
}
```

#### ข้อห้าม

- ห้ามส่ง `password_hash` กลับ frontend

---

### 13.2 POST /api/admin/users

เพิ่มผู้ใช้ใหม่

#### Request Body

```json
{
  "name": "ผู้รับผิดชอบงาน",
  "username": "staff01",
  "email": "",
  "phone": "",
  "role": "staff",
  "password": "temporary-password"
}
```

#### Business Rules

- เฉพาะ `super_admin` หรือ `admin` ตามที่กำหนดเท่านั้น
- password ต้อง hash ก่อนบันทึก
- username ต้อง unique
- บันทึก audit log

---

### 13.3 PATCH /api/admin/users/:id

แก้ไขผู้ใช้

#### Request Body

```json
{
  "name": "ผู้รับผิดชอบงาน",
  "email": "",
  "phone": "",
  "role": "staff",
  "active": true
}
```

#### Business Rules

- ห้ามให้ผู้ใช้ลดสิทธิ์ตัวเองจนไม่มี `super_admin` เหลือในระบบ
- ถ้าเปลี่ยน password ให้ใช้ endpoint แยกในอนาคต หรือเพิ่ม field อย่างระมัดระวัง
- บันทึก audit log

---

## 14. Admin News API

---

### 14.1 GET /api/admin/news

ดึงข่าว/ประกาศทั้งหมด

```http
GET /api/admin/news
```

### 14.2 POST /api/admin/news

เพิ่มข่าว/ประกาศ

#### Request Body

```json
{
  "title": "ประกาศแจ้งซ่อมไฟทาง",
  "content": "ชุมชนจะดำเนินการซ่อมไฟทางในวันที่ ...",
  "active": true
}
```

### 14.3 PATCH /api/admin/news/:id

แก้ไขข่าว/ประกาศ

```json
{
  "title": "ประกาศแจ้งซ่อมไฟทาง",
  "content": "รายละเอียดประกาศ",
  "active": true
}
```

---

## 15. Export API

---

### 15.1 GET /api/admin/export-csv

ส่งออกข้อมูลรายงานเป็น CSV

#### Request

```http
GET /api/admin/export-csv?date_from=2026-06-01&date_to=2026-06-30&status=closed
```

#### Query Parameters

| Parameter | Required | รายละเอียด |
|---|---:|---|
| `date_from` | no | YYYY-MM-DD |
| `date_to` | no | YYYY-MM-DD |
| `status` | no | กรองสถานะ |
| `category` | no | กรองหมวด |

#### Response

```http
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="hua-saphan-care-reports-2026-06.csv"
```

#### CSV Columns

```txt
tracking_code,
category_name,
title,
location_text,
priority,
status,
anonymous,
assigned_name,
created_at,
updated_at,
closed_at
```

#### ข้อควรระวัง

- ไม่ควร export เบอร์โทรผู้แจ้งเป็นค่าเริ่มต้น
- ถ้าต้อง export ข้อมูลส่วนตัว ต้องจำกัดเฉพาะ super_admin
- CSV ต้องเปิดใน Excel ได้

---

## 16. Settings API

---

### 16.1 GET /api/admin/settings

ดึงค่าตั้งค่าระบบ

#### Success Response

```json
{
  "ok": true,
  "data": {
    "app_name": "Hua Saphan Care",
    "app_url": "https://huasaphan-care.pages.dev",
    "project_email": "huasaphan2026@gmail.com",
    "emergency_phone": "0629617942",
    "max_public_images_per_report": "3",
    "max_total_images_per_report": "5",
    "data_retention_years": "3"
  }
}
```

### 16.2 PATCH /api/admin/settings

แก้ไขค่าตั้งค่าระบบ

#### Request Body

```json
{
  "emergency_phone": "0629617942",
  "max_public_images_per_report": "3"
}
```

#### Business Rules

- เฉพาะ `super_admin` หรือ `admin`
- ตรวจ key ที่อนุญาตเท่านั้น ห้ามรับ key อิสระทั้งหมด
- บันทึก audit log

---

## 17. Middleware

### 17.1 functions/_middleware.js

ใช้สำหรับ

- ตั้ง CORS เฉพาะที่จำเป็น
- ตรวจ path `/api/admin/*` ต้องมี session
- ตรวจ path `/admin/*` ถ้าต้องการ redirect หน้า HTML
- เพิ่ม security headers
- ดัก error กลางถ้าทำได้

### 17.2 API Helper ที่ควรมี

ควรแยก helper ในโฟลเดอร์ `functions/lib/`

```txt
functions/lib/response.js
functions/lib/auth.js
functions/lib/validation.js
functions/lib/db.js
functions/lib/audit.js
functions/lib/upload.js
functions/lib/constants.js
```

---

## 18. Validation Rules รวม

### 18.1 Text Input

- trim ทุก field ที่เป็นข้อความ
- จำกัดความยาว
- ห้ามรับ HTML ที่ไม่จำเป็น
- escape ตอนแสดงผลบน frontend
- ใช้ prepared statements ทุกครั้ง

### 18.2 Phone

MVP ยังไม่ต้อง validation ซับซ้อน แต่ควรใช้กติกาเบื้องต้น

```txt
ตัวเลข 9-10 หลัก หรือมีขีด/ช่องว่างได้ แต่ต้อง normalize ก่อนบันทึกถ้าจำเป็น
```

### 18.3 Date

ใช้ ISO format

```txt
YYYY-MM-DD
```

หรือ timestamp

```txt
YYYY-MM-DDTHH:mm:ss.sssZ
```

### 18.4 Boolean ใน D1

บันทึกเป็น INTEGER

```txt
true  = 1
false = 0
```

---

## 19. Security Rules

### 19.1 Admin API

- ตรวจ session ทุกครั้ง
- ตรวจ role ทุกครั้งก่อนแก้ไขข้อมูล
- ห้ามส่ง password_hash กลับ frontend
- ใช้ prepared statements
- บันทึก audit log สำหรับ action สำคัญ

### 19.2 Public API

- ห้ามส่งข้อมูลส่วนตัว
- ห้ามเปิดเผยพิกัดละเอียดถ้าไม่จำเป็น
- ห้ามส่ง update ที่ `is_public = 0`
- จำกัดจำนวนข้อมูลต่อ page
- sanitize ข้อความก่อนแสดงผล

### 19.3 Upload API

- จำกัดชนิดไฟล์
- จำกัดขนาดไฟล์
- จำกัดจำนวนภาพต่อเรื่อง
- ตรวจ MIME type
- ตั้งชื่อไฟล์ใหม่ ไม่ใช้ชื่อไฟล์จาก user โดยตรง
- ห้ามเปิด R2 public ทั้ง bucket

---

## 20. Rate Limit เบื้องต้น

MVP อาจยังไม่ต้องทำระบบ rate limit ซับซ้อน แต่ควรวางไว้ในแผน

| Endpoint | แนวทาง |
|---|---|
| `/api/auth/login` | จำกัดความถี่ต่อ IP / username |
| `/api/reports` | จำกัดจำนวนการส่งต่อ IP ในช่วงเวลาสั้น |
| `/api/uploads/image` | จำกัดจำนวนและขนาดไฟล์ |
| `/api/reports/track` | จำกัดการเดารหัส tracking code |

---

## 21. Audit Log ที่ต้องบันทึก

บันทึกใน `audit_logs` เมื่อมี action สำคัญ

| Action | target_type | target_id |
|---|---|---|
| `LOGIN_SUCCESS` | user | user_id |
| `LOGIN_FAILED` | user | username |
| `REPORT_STATUS_UPDATED` | report | report_id |
| `REPORT_ASSIGNED` | report | report_id |
| `REPORT_PUBLIC_UPDATED` | report | report_id |
| `CATEGORY_CREATED` | category | category_id |
| `CATEGORY_UPDATED` | category | category_id |
| `USER_CREATED` | user | user_id |
| `USER_UPDATED` | user | user_id |
| `NEWS_CREATED` | news | news_id |
| `NEWS_UPDATED` | news | news_id |
| `SETTINGS_UPDATED` | settings | key |
| `CSV_EXPORTED` | report | filter_summary |

---

## 22. Route-to-File Mapping สำหรับ Pages Functions

แนะนำโครงสร้างไฟล์ดังนี้

```txt
functions/
├─ _middleware.js
├─ lib/
│  ├─ response.js
│  ├─ auth.js
│  ├─ validation.js
│  ├─ audit.js
│  ├─ upload.js
│  └─ constants.js
└─ api/
   ├─ health.js
   ├─ public/
   │  ├─ categories.js
   │  ├─ emergency.js
   │  └─ works.js
   ├─ reports/
   │  ├─ index.js
   │  ├─ track.js
   │  └─ feedback.js
   ├─ uploads/
   │  └─ image.js
   ├─ auth/
   │  ├─ login.js
   │  ├─ logout.js
   │  └─ me.js
   └─ admin/
      ├─ dashboard.js
      ├─ reports/
      │  ├─ index.js
      │  ├─ [id].js
      │  ├─ [id]/status.js
      │  ├─ [id]/updates.js
      │  ├─ [id]/assignments.js
      │  └─ [id]/public.js
      ├─ categories.js
      ├─ users.js
      ├─ news.js
      ├─ settings.js
      └─ export-csv.js
```

หมายเหตุ: ถ้า Cloudflare Pages Functions ไม่รองรับบางรูปแบบ nested dynamic route ตามที่ใช้งานจริง ให้ปรับโครงสร้างไฟล์ตามข้อจำกัดของ Cloudflare แต่ต้องคง path API ให้ตรงตามเอกสารนี้

---

## 23. API ที่ยังไม่ควรทำใน MVP

ยังไม่ควรทำ endpoint เหล่านี้ในช่วงแรก เว้นแต่ระบบหลักเสร็จแล้ว

- Real-time notification
- LINE Messaging API
- PDF generation
- Advanced map clustering
- SLA automation
- Auto backup scheduler
- Full-text search ขั้นสูง
- Multi-village tenant system
- OAuth / Cloudflare Access แบบเต็มรูปแบบ

---

## 24. Testing Checklist สำหรับ API

### Public API

- [ ] `/api/health` ตอบ JSON ได้
- [ ] `/api/public/categories` ดึงเฉพาะ active categories
- [ ] `/api/public/emergency` ดึงเบอร์จาก settings
- [ ] `/api/reports` validate ข้อมูลได้ถูกต้อง
- [ ] `/api/reports` สร้าง tracking_code ได้
- [ ] `/api/reports/track` ไม่เปิดเผยข้อมูลส่วนตัว
- [ ] `/api/public/works` แสดงเฉพาะเรื่องที่อนุญาต

### Upload API

- [ ] upload jpg ได้
- [ ] upload png ได้
- [ ] upload webp ได้
- [ ] ปฏิเสธไฟล์ที่ไม่ใช่รูปภาพ
- [ ] ปฏิเสธไฟล์ใหญ่เกินกำหนด
- [ ] จำกัดจำนวนภาพต่อเรื่อง
- [ ] บันทึก r2_key ใน D1 ถูกต้อง

### Auth API

- [ ] login สำเร็จด้วย user active
- [ ] login ไม่สำเร็จเมื่อ password ผิด
- [ ] cookie ถูกตั้งเป็น HttpOnly
- [ ] logout ลบ session/cookie
- [ ] `/api/auth/me` ตอบ user ปัจจุบัน

### Admin API

- [ ] ไม่ login เรียก admin API ไม่ได้
- [ ] dashboard แสดง count ถูกต้อง
- [ ] reports list แบ่งหน้าได้
- [ ] report detail แสดง timeline และ attachments
- [ ] เปลี่ยน status ได้
- [ ] เพิ่ม timeline ได้
- [ ] มอบหมายงานได้
- [ ] ตั้งค่า public works ได้
- [ ] export CSV ได้
- [ ] audit log ถูกบันทึก

---

## 25. Definition of Done ของ API_SPEC.md

ถือว่าสร้าง API ตามเอกสารนี้สำเร็จ เมื่อทำได้ครบเงื่อนไขต่อไปนี้

- [ ] API route หลักตรงตามเอกสาร
- [ ] response format เป็นมาตรฐานเดียวกัน
- [ ] validation ครบสำหรับข้อมูลสำคัญ
- [ ] public API ไม่เปิดเผยข้อมูลส่วนตัว
- [ ] admin API ตรวจ session และ role
- [ ] upload API จำกัดชนิด ขนาด และจำนวนไฟล์
- [ ] ทุก query สำคัญใช้ prepared statements
- [ ] เปลี่ยนสถานะแล้วมี timeline
- [ ] action สำคัญมี audit log
- [ ] export CSV ใช้งานได้จริง
- [ ] ไม่เพิ่ม endpoint ที่เกิน MVP โดยไม่จำเป็น

---

## 26. Prompt สำหรับสั่ง Codex สร้าง API ตามเอกสารนี้

ใช้ prompt นี้เมื่อจะเริ่มสร้าง API

```txt
จาก README.md, APP_SPEC.md, DATA_SCHEMA.md และ API_SPEC.md ให้สร้าง Cloudflare Pages Functions สำหรับ Hua Saphan Care ตามสเปก API โดยเริ่มจาก helper response/auth/validation ก่อน แล้วสร้าง /api/health, /api/public/categories, /api/reports ตามลำดับ ห้ามสร้าง endpoint เกินเอกสารนี้ และต้องใช้ D1 binding ชื่อ DB, R2 binding ชื่อ BUCKET, response JSON รูปแบบ { ok, data, error }
```

---

## 27. สรุป

API ของ `Hua Saphan Care` ต้องเรียบง่าย ใช้งานจริงได้ และควบคุมความปลอดภัยตั้งแต่ต้น

แนวทางหลักคือ

```txt
Public API: ใช้ง่าย ไม่เปิดเผยข้อมูลส่วนตัว
Reports API: รับเรื่องและติดตามสถานะได้จริง
Upload API: จำกัดไฟล์และเก็บ R2 อย่างเป็นระบบ
Auth API: Login เองแบบง่าย ใช้ session cookie
Admin API: จัดการเรื่องครบวงจร มี audit log
Export API: เริ่มด้วย CSV ก่อน PDF
```

ให้ยึดเอกสารนี้เป็นเกณฑ์หลักก่อนสร้าง API ทุก endpoint
