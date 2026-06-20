import { jsonError, jsonOk } from "../../../_utils/response.js";

const PUBLISH_ROLES = new Set(["super_admin", "admin"]);
const PUBLISHABLE_STATUSES = new Set(["resolved", "closed"]);
const MAX_PUBLIC_SUMMARY_LENGTH = 1000;
const MAX_PUBLIC_LOCATION_LENGTH = 160;

function methodNotAllowed() {
  const response = jsonError("METHOD_NOT_ALLOWED", "Method not allowed", 405);
  response.headers.set("Allow", "PATCH");
  return response;
}

function parseReportId(params = {}) {
  const reportId = Number.parseInt(String(params.id || ""), 10);
  return Number.isInteger(reportId) && reportId > 0 ? reportId : null;
}

function trimText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === 1 || value === "1" || value === "true") {
    return true;
  }

  if (value === 0 || value === "0" || value === "false") {
    return false;
  }

  return fallback;
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function getReport(db, reportId) {
  return db
    .prepare(
      `SELECT
        id,
        tracking_code,
        title,
        detail,
        location_text,
        status,
        public_visible
      FROM reports
      WHERE id = ?
      LIMIT 1`
    )
    .bind(reportId)
    .first();
}

function canPublish(user) {
  return PUBLISH_ROLES.has(String(user?.role || ""));
}

function isSameText(left, right) {
  return String(left || "").trim() === String(right || "").trim();
}

function mayContainSensitivePublicData(text) {
  const normalized = String(text || "");
  const compactDigits = normalized.replace(/[^\d]/g, "");
  const phonePattern = /(?:\+?66|0)\d[\d\s-]{7,12}\d/;
  const datePattern = /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/;
  const houseNumberPattern = /(บ้านเลขที่|เลขที่)\s*\d+/i;
  const sensitiveWords =
    /(เลขบัตร|บัตรประชาชน|เลขประจำตัว|วันเกิด|เกิดวันที่|ทะเบียนรถ|เบอร์โทร|โทรศัพท์|ชื่อผู้แจ้ง|ชื่อ-สกุล|ผู้ป่วย|โรคประจำตัว)/i;

  return (
    phonePattern.test(normalized) ||
    datePattern.test(normalized) ||
    houseNumberPattern.test(normalized) ||
    sensitiveWords.test(normalized) ||
    compactDigits.length >= 13
  );
}

function normalizeAttachmentIds(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) => Number.parseInt(String(item || ""), 10))
        .filter((item) => Number.isInteger(item) && item > 0)
    )
  ).slice(0, 20);
}

function getClientIp(request) {
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For") ||
    ""
  )
    .split(",")[0]
    .trim()
    .slice(0, 80);
}

function buildAttachmentStatements(db, reportId, publicImageAllowed, allowedAttachmentIds) {
  const statements = [
    db
      .prepare(
        `UPDATE attachments
        SET public_allowed = ?
        WHERE report_id = ?`
      )
      .bind(0, reportId),
  ];

  if (publicImageAllowed && allowedAttachmentIds.length > 0) {
    const placeholders = allowedAttachmentIds.map(() => "?").join(", ");

    statements.push(
      db
        .prepare(
          `UPDATE attachments
          SET public_allowed = ?
          WHERE report_id = ?
            AND id IN (${placeholders})`
        )
        .bind(1, reportId, ...allowedAttachmentIds)
    );
  }

  return statements;
}

export async function onRequest({ request, env, params, data = {} }) {
  if (request.method !== "PATCH") {
    return methodNotAllowed();
  }

  const user = data.user;

  if (!user) {
    return jsonError("UNAUTHORIZED", "กรุณาเข้าสู่ระบบ", 401);
  }

  if (!canPublish(user)) {
    return jsonError("FORBIDDEN", "ไม่มีสิทธิ์ตั้งค่าการเผยแพร่", 403);
  }

  const reportId = parseReportId(params);

  if (!reportId) {
    return jsonError("VALIDATION_ERROR", "รหัสรายการไม่ถูกต้อง", 400);
  }

  const body = await readJson(request);

  if (!body) {
    return jsonError("VALIDATION_ERROR", "รูปแบบข้อมูลไม่ถูกต้อง", 400);
  }

  const publicVisible = normalizeBoolean(body.public_visible, false);
  const publicSummary = trimText(body.public_summary, MAX_PUBLIC_SUMMARY_LENGTH);
  const publicLocationLabel = trimText(
    body.public_location_label,
    MAX_PUBLIC_LOCATION_LENGTH
  );
  const requestedPublicImageAllowed = normalizeBoolean(body.public_image_allowed, false);
  const publicImageAllowed = publicVisible && requestedPublicImageAllowed;
  const allowedAttachmentIds = normalizeAttachmentIds(body.allowed_attachment_ids);

  if (publicVisible && publicSummary.length < 10) {
    return jsonError("VALIDATION_ERROR", "กรุณากรอกสรุปสำหรับเผยแพร่อย่างน้อย 10 ตัวอักษร", 400);
  }

  if (publicVisible && publicLocationLabel.length < 2) {
    return jsonError("VALIDATION_ERROR", "กรุณากรอกพื้นที่เผยแพร่แบบคร่าว ๆ", 400);
  }

  if (
    publicVisible &&
    mayContainSensitivePublicData(`${publicSummary} ${publicLocationLabel}`)
  ) {
    return jsonError(
      "PUBLIC_REVIEW_REQUIRED",
      "ข้อมูลที่จะเผยแพร่อาจมีข้อมูลส่วนตัว กรุณาคัดกรองข้อความและพื้นที่ก่อนเผยแพร่",
      400
    );
  }

  try {
    const report = await getReport(env.DB, reportId);

    if (!report) {
      return jsonError("NOT_FOUND", "ไม่พบรายการเรื่อง", 404);
    }

    if (publicVisible && report.status === "rejected") {
      return jsonError("PUBLIC_STATUS_NOT_ALLOWED", "ไม่สามารถเผยแพร่เรื่องที่ไม่รับดำเนินการ", 400);
    }

    if (publicVisible && !PUBLISHABLE_STATUSES.has(report.status)) {
      return jsonError(
        "PUBLIC_STATUS_NOT_ALLOWED",
        "เผยแพร่ได้เฉพาะเรื่องที่แก้ไขแล้วหรือปิดเรื่องแล้ว",
        400
      );
    }

    if (publicVisible && isSameText(publicSummary, report.detail)) {
      return jsonError(
        "PUBLIC_REVIEW_REQUIRED",
        "ห้ามใช้รายละเอียดเดิมเป็นสรุปสาธารณะโดยไม่คัดกรอง กรุณาเขียนสรุปใหม่",
        400
      );
    }

    const now = new Date().toISOString();
    const safeSummary = publicVisible ? publicSummary : publicSummary || null;
    const safeLocationLabel = publicVisible
      ? publicLocationLabel
      : publicLocationLabel || null;
    const auditDetail = JSON.stringify({
      tracking_code: report.tracking_code,
      old_public_visible: report.public_visible === 1,
      public_visible: publicVisible,
      public_image_allowed: publicImageAllowed,
      allowed_attachment_ids: allowedAttachmentIds,
    });

    await env.DB.batch([
      env.DB
        .prepare(
          `UPDATE reports
          SET public_visible = ?,
              public_summary = ?,
              public_location_label = ?,
              public_image_allowed = ?,
              updated_at = ?
          WHERE id = ?`
        )
        .bind(
          publicVisible ? 1 : 0,
          safeSummary,
          safeLocationLabel,
          publicImageAllowed ? 1 : 0,
          now,
          reportId
        ),
      ...buildAttachmentStatements(
        env.DB,
        reportId,
        publicImageAllowed,
        allowedAttachmentIds
      ),
      env.DB
        .prepare(
          `INSERT INTO audit_logs (
            user_id,
            action,
            target_type,
            target_id,
            detail,
            ip_address
          )
          VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(
          user.id,
          "REPORT_PUBLIC_UPDATED",
          "report",
          String(reportId),
          auditDetail,
          getClientIp(request)
        ),
    ]);

    return jsonOk(
      {
        report_id: reportId,
        public_visible: publicVisible,
        public_summary: safeSummary,
        public_location_label: safeLocationLabel,
        public_image_allowed: publicImageAllowed,
        updated_at: now,
      },
      "บันทึกการเผยแพร่สำเร็จ"
    );
  } catch {
    return jsonError("SERVER_ERROR", "ไม่สามารถบันทึกการเผยแพร่ได้ในขณะนี้", 500);
  }
}
