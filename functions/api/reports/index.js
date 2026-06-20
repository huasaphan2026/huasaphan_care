const INITIAL_STATUS = "new";
const INITIAL_UPDATE_NOTE = "รับเรื่องใหม่เข้าสู่ระบบ";
const MAX_CREATE_ATTEMPTS = 5;

const FORBIDDEN_PERSONAL_FIELDS = [
  "citizen_id",
  "national_id",
  "id_card",
  "id_card_number",
  "birth_date",
  "date_of_birth",
  "dob",
  "birthday",
  "full_address",
  "address",
  "house_number",
];

const IMAGE_UPLOAD_FIELDS = ["attachments", "files", "images", "photos"];

function jsonResponse(body, status = 200, headers = {}) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function trimText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeAnonymous(value) {
  if (value === true || value === 1 || value === "1" || value === "true") {
    return { value: true };
  }

  if (value === false || value === 0 || value === "0" || value === "false") {
    return { value: false };
  }

  return { error: "กรุณาระบุการเปิดเผยชื่อให้ถูกต้อง" };
}

function parseOptionalNumber(value, fieldName, label, min, max) {
  if (value === undefined || value === null || value === "") {
    return { value: null };
  }

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return { error: `${label}ต้องเป็นตัวเลข`, fieldName };
  }

  if (numberValue < min || numberValue > max) {
    return { error: `${label}อยู่นอกช่วงที่ถูกต้อง`, fieldName };
  }

  return { value: numberValue };
}

function validatePayload(body) {
  const errors = {};

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {
      ok: false,
      errors: {
        body: "รูปแบบข้อมูลไม่ถูกต้อง",
      },
    };
  }

  for (const field of FORBIDDEN_PERSONAL_FIELDS) {
    if (hasOwn(body, field) && body[field] !== null && body[field] !== "") {
      errors[field] = "ไม่รับข้อมูลเลขบัตรประชาชน วันเกิด หรือที่อยู่เต็ม";
    }
  }

  for (const field of IMAGE_UPLOAD_FIELDS) {
    if (hasOwn(body, field)) {
      errors[field] = "endpoint นี้ยังไม่รับรูปภาพ กรุณาส่งเฉพาะข้อมูลแจ้งเรื่อง";
    }
  }

  const categoryId = Number(body.category_id);
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    errors.category_id = "กรุณาเลือกหมวดปัญหา";
  }

  const title = trimText(body.title);
  if (!title) {
    errors.title = "กรุณาระบุหัวข้อเรื่อง";
  } else if (title.length > 120) {
    errors.title = "หัวข้อเรื่องต้องไม่เกิน 120 ตัวอักษร";
  }

  const detail = trimText(body.detail);
  if (!detail) {
    errors.detail = "กรุณาระบุรายละเอียด";
  } else if (detail.length > 2000) {
    errors.detail = "รายละเอียดต้องไม่เกิน 2,000 ตัวอักษร";
  }

  const locationText = trimText(body.location_text);
  if (!locationText) {
    errors.location_text = "กรุณาระบุจุดเกิดเหตุหรือจุดสังเกต";
  } else if (locationText.length > 300) {
    errors.location_text = "จุดเกิดเหตุต้องไม่เกิน 300 ตัวอักษร";
  }

  let anonymous = true;
  if (!hasOwn(body, "anonymous")) {
    errors.anonymous = "กรุณาระบุว่าต้องการเปิดเผยชื่อหรือไม่";
  } else {
    const anonymousResult = normalizeAnonymous(body.anonymous);
    if (anonymousResult.error) {
      errors.anonymous = anonymousResult.error;
    } else {
      anonymous = anonymousResult.value;
    }
  }

  const reporterName = trimText(body.reporter_name);
  if (reporterName.length > 120) {
    errors.reporter_name = "ชื่อผู้แจ้งต้องไม่เกิน 120 ตัวอักษร";
  }

  const reporterPhone = trimText(body.reporter_phone);
  if (reporterPhone.length > 30) {
    errors.reporter_phone = "เบอร์โทรต้องไม่เกิน 30 ตัวอักษร";
  } else if (reporterPhone && !/^[0-9+\-\s()]+$/.test(reporterPhone)) {
    errors.reporter_phone = "เบอร์โทรใช้ได้เฉพาะตัวเลขและสัญลักษณ์โทรศัพท์พื้นฐาน";
  }

  const latResult = parseOptionalNumber(
    body.location_lat,
    "location_lat",
    "ละติจูด",
    -90,
    90
  );
  const lngResult = parseOptionalNumber(
    body.location_lng,
    "location_lng",
    "ลองจิจูด",
    -180,
    180
  );

  if (latResult.error) {
    errors[latResult.fieldName] = latResult.error;
  }

  if (lngResult.error) {
    errors[lngResult.fieldName] = lngResult.error;
  }

  if (
    !latResult.error &&
    !lngResult.error &&
    ((latResult.value === null && lngResult.value !== null) ||
      (latResult.value !== null && lngResult.value === null))
  ) {
    errors.location = "หากระบุพิกัด กรุณาระบุทั้งละติจูดและลองจิจูด";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      categoryId,
      title,
      detail,
      locationText,
      locationLat: latResult.value,
      locationLng: lngResult.value,
      anonymous,
      reporterName: anonymous ? null : reporterName || null,
      reporterPhone: anonymous ? null : reporterPhone || null,
    },
  };
}

function getTrackingYear() {
  return Number(
    new Intl.DateTimeFormat("en", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
    }).format(new Date())
  );
}

async function getNextTrackingCode(db, year) {
  const prefix = `HSC-${year}-`;
  const latest = await db
    .prepare(
      `SELECT tracking_code
       FROM reports
       WHERE tracking_code LIKE ?
       ORDER BY tracking_code DESC
       LIMIT 1`
    )
    .bind(`${prefix}%`)
    .first();

  const latestSequence = latest?.tracking_code?.slice(prefix.length);
  const nextSequence = Number.parseInt(latestSequence, 10) + 1 || 1;

  return `${prefix}${String(nextSequence).padStart(4, "0")}`;
}

function isUniqueTrackingCodeError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return message.includes("unique") && message.includes("tracking_code");
}

async function createReport(db, data, category) {
  const year = getTrackingYear();
  const priority = category.default_priority === "urgent" ? "urgent" : "normal";

  for (let attempt = 0; attempt < MAX_CREATE_ATTEMPTS; attempt += 1) {
    const trackingCode = await getNextTrackingCode(db, year);

    try {
      await db.batch([
        db
          .prepare(
            `INSERT INTO reports (
              tracking_code,
              category_id,
              title,
              detail,
              location_text,
              location_lat,
              location_lng,
              priority,
              status,
              anonymous,
              reporter_name,
              reporter_phone
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            trackingCode,
            data.categoryId,
            data.title,
            data.detail,
            data.locationText,
            data.locationLat,
            data.locationLng,
            priority,
            INITIAL_STATUS,
            data.anonymous ? 1 : 0,
            data.reporterName,
            data.reporterPhone
          ),
        db
          .prepare(
            `INSERT INTO report_updates (
              report_id,
              status,
              update_note,
              updated_by,
              is_public
            )
            SELECT id, ?, ?, NULL, ?
            FROM reports
            WHERE tracking_code = ?`
          )
          .bind(INITIAL_STATUS, INITIAL_UPDATE_NOTE, 1, trackingCode),
      ]);

      const report = await db
        .prepare(
          `SELECT id
           FROM reports
           WHERE tracking_code = ?
           LIMIT 1`
        )
        .bind(trackingCode)
        .first();

      return {
        trackingCode,
        reportId: report.id,
      };
    } catch (error) {
      if (
        attempt < MAX_CREATE_ATTEMPTS - 1 &&
        isUniqueTrackingCodeError(error)
      ) {
        continue;
      }

      throw error;
    }
  }

  throw new Error("Unable to create tracking code");
}

export async function onRequest({ request, env }) {
  if (request.method !== "POST") {
    return jsonResponse(
      {
        ok: false,
        data: null,
        message: "Method Not Allowed",
      },
      405,
      { Allow: "POST" }
    );
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return jsonResponse(
      {
        ok: false,
        data: null,
        message: "รูปแบบ JSON ไม่ถูกต้อง",
      },
      400
    );
  }

  const validation = validatePayload(body);

  if (!validation.ok) {
    return jsonResponse(
      {
        ok: false,
        data: {
          errors: validation.errors,
        },
        message: "กรุณาตรวจสอบข้อมูลที่กรอก",
      },
      400
    );
  }

  try {
    const category = await env.DB
      .prepare(
        `SELECT id, default_priority
         FROM categories
         WHERE id = ? AND active = ?
         LIMIT 1`
      )
      .bind(validation.data.categoryId, 1)
      .first();

    if (!category) {
      return jsonResponse(
        {
          ok: false,
          data: {
            errors: {
              category_id: "ไม่พบหมวดปัญหาที่ใช้งานอยู่",
            },
          },
          message: "กรุณาตรวจสอบข้อมูลที่กรอก",
        },
        400
      );
    }

    const result = await createReport(env.DB, validation.data, category);

    return jsonResponse(
      {
        ok: true,
        data: {
          tracking_code: result.trackingCode,
          report_id: result.reportId,
        },
        message: "ส่งเรื่องสำเร็จ",
      },
      201
    );
  } catch {
    return jsonResponse(
      {
        ok: false,
        data: null,
        message: "เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง",
      },
      500
    );
  }
}
