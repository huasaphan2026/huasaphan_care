import { jsonError, jsonOk } from "../../../_utils/response.js";

const VALID_STATUSES = new Set([
  "new",
  "accepted",
  "checking",
  "in_progress",
  "forwarded",
  "waiting_info",
  "resolved",
  "closed",
  "rejected",
]);

const MANAGER_ROLES = new Set(["super_admin", "admin"]);
const STAFF_ROLE = "staff";
const MIN_UPDATE_NOTE_LENGTH = 3;
const MAX_UPDATE_NOTE_LENGTH = 2000;

function methodNotAllowed() {
  const response = jsonError("METHOD_NOT_ALLOWED", "Method not allowed", 405);
  response.headers.set("Allow", "POST");
  return response;
}

function parseReportId(params = {}) {
  const reportId = Number.parseInt(String(params.id || ""), 10);
  return Number.isInteger(reportId) && reportId > 0 ? reportId : null;
}

function trimText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function normalizeStatus(value) {
  const status = trimText(value, 40);
  return VALID_STATUSES.has(status) ? status : "";
}

function normalizeBoolean(value, fallback = true) {
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
      `SELECT id, tracking_code, status, assigned_to
      FROM reports
      WHERE id = ?
      LIMIT 1`
    )
    .bind(reportId)
    .first();
}

async function isAssignedStaff(db, reportId, userId) {
  const assignment = await db
    .prepare(
      `SELECT id
      FROM assignments
      WHERE report_id = ?
        AND user_id = ?
      LIMIT 1`
    )
    .bind(reportId, userId)
    .first();

  return Boolean(assignment);
}

async function canAddUpdate(db, report, user) {
  const role = String(user?.role || "");

  if (MANAGER_ROLES.has(role)) {
    return true;
  }

  if (role !== STAFF_ROLE) {
    return false;
  }

  if (report.assigned_to === user.id) {
    return true;
  }

  return isAssignedStaff(db, report.id, user.id);
}

function mayContainSensitivePublicData(text) {
  const normalized = String(text || "");
  const compactDigits = normalized.replace(/[^\d]/g, "");
  const phonePattern = /(?:\+?66|0)\d[\d\s-]{7,12}\d/;
  const datePattern = /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/;
  const sensitiveWords =
    /(เลขบัตร|บัตรประชาชน|เลขประจำตัว|วันเกิด|เกิดวันที่|บ้านเลขที่|ทะเบียนรถ|เบอร์โทร|โทรศัพท์|ชื่อผู้แจ้ง|ชื่อ-สกุล)/i;

  return (
    phonePattern.test(normalized) ||
    datePattern.test(normalized) ||
    sensitiveWords.test(normalized) ||
    compactDigits.length >= 13
  );
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

async function getCreatedUpdate(db, reportId, userId, createdAt) {
  return db
    .prepare(
      `SELECT id, report_id, status, update_note, is_public, created_at
      FROM report_updates
      WHERE report_id = ?
        AND updated_by = ?
        AND created_at = ?
      ORDER BY id DESC
      LIMIT 1`
    )
    .bind(reportId, userId, createdAt)
    .first();
}

export async function onRequest({ request, env, params, data = {} }) {
  if (request.method !== "POST") {
    return methodNotAllowed();
  }

  const user = data.user;

  if (!user) {
    return jsonError("UNAUTHORIZED", "กรุณาเข้าสู่ระบบ", 401);
  }

  const reportId = parseReportId(params);

  if (!reportId) {
    return jsonError("VALIDATION_ERROR", "รหัสรายการไม่ถูกต้อง", 400);
  }

  const body = await readJson(request);

  if (!body) {
    return jsonError("VALIDATION_ERROR", "รูปแบบข้อมูลไม่ถูกต้อง", 400);
  }

  const status = normalizeStatus(body.status);
  const updateNote = trimText(body.update_note, MAX_UPDATE_NOTE_LENGTH);
  const isPublic = normalizeBoolean(body.is_public, true);

  if (!status) {
    return jsonError("INVALID_STATUS", "สถานะไม่ถูกต้อง", 400);
  }

  if (updateNote.length < MIN_UPDATE_NOTE_LENGTH) {
    return jsonError("VALIDATION_ERROR", "กรุณากรอกข้อความอัปเดตอย่างน้อย 3 ตัวอักษร", 400);
  }

  if (isPublic && mayContainSensitivePublicData(updateNote)) {
    return jsonError(
      "PUBLIC_UPDATE_REVIEW_REQUIRED",
      "ข้อความอัปเดตสาธารณะอาจมีข้อมูลส่วนตัว กรุณาลบข้อมูลส่วนตัวออกก่อน หรือปิดการเผยแพร่ update นี้",
      400
    );
  }

  try {
    const report = await getReport(env.DB, reportId);

    if (!report) {
      return jsonError("NOT_FOUND", "ไม่พบรายการเรื่อง", 404);
    }

    const allowed = await canAddUpdate(env.DB, report, user);

    if (!allowed) {
      return jsonError("FORBIDDEN", "ไม่มีสิทธิ์ทำรายการนี้", 403);
    }

    const now = new Date().toISOString();
    const auditDetail = JSON.stringify({
      tracking_code: report.tracking_code,
      report_status: report.status,
      update_status: status,
      is_public: isPublic,
    });

    await env.DB.batch([
      env.DB
        .prepare(
          `INSERT INTO report_updates (
            report_id,
            status,
            update_note,
            updated_by,
            is_public,
            created_at
          )
          VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(reportId, status, updateNote, user.id, isPublic ? 1 : 0, now),
      env.DB
        .prepare(
          `UPDATE reports
          SET updated_at = ?
          WHERE id = ?`
        )
        .bind(now, reportId),
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
          "REPORT_UPDATE_CREATED",
          "report",
          String(reportId),
          auditDetail,
          getClientIp(request)
        ),
    ]);

    const update = await getCreatedUpdate(env.DB, reportId, user.id, now);

    return jsonOk(
      {
        id: update?.id || null,
        report_id: reportId,
        status,
        update_note: updateNote,
        is_public: isPublic,
        created_at: now,
      },
      "เพิ่ม update สำเร็จ"
    );
  } catch {
    return jsonError("SERVER_ERROR", "ไม่สามารถเพิ่ม update ได้ในขณะนี้", 500);
  }
}
