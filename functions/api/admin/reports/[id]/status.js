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
      `SELECT id, tracking_code, status, assigned_to, closed_at
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

async function canUpdateReport(db, report, user) {
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

function buildReportUpdateStatement(db, reportId, status, now, shouldClose) {
  if (shouldClose) {
    return db
      .prepare(
        `UPDATE reports
        SET status = ?,
            updated_at = ?,
            closed_at = COALESCE(closed_at, ?)
        WHERE id = ?`
      )
      .bind(status, now, now, reportId);
  }

  return db
    .prepare(
      `UPDATE reports
      SET status = ?,
          updated_at = ?
      WHERE id = ?`
    )
    .bind(status, now, reportId);
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

export async function onRequest({ request, env, params, data = {} }) {
  if (request.method !== "PATCH") {
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
  const updateNote = trimText(body.update_note ?? body.note, 2000);
  const isPublic = normalizeBoolean(body.is_public, true);

  if (!status) {
    return jsonError("INVALID_STATUS", "สถานะไม่ถูกต้อง", 400);
  }

  if (updateNote.length < 3) {
    return jsonError("VALIDATION_ERROR", "กรุณากรอกข้อความอัปเดตอย่างน้อย 3 ตัวอักษร", 400);
  }

  try {
    const report = await getReport(env.DB, reportId);

    if (!report) {
      return jsonError("NOT_FOUND", "ไม่พบรายการเรื่อง", 404);
    }

    const allowed = await canUpdateReport(env.DB, report, user);

    if (!allowed) {
      return jsonError("FORBIDDEN", "ไม่มีสิทธิ์ทำรายการนี้", 403);
    }

    const now = new Date().toISOString();
    const shouldClose = status === "resolved" || status === "closed";
    const closedAt = shouldClose ? report.closed_at || now : report.closed_at || null;
    const auditDetail = JSON.stringify({
      tracking_code: report.tracking_code,
      old_status: report.status,
      new_status: status,
      is_public: isPublic,
    });

    await env.DB.batch([
      buildReportUpdateStatement(env.DB, reportId, status, now, shouldClose),
      env.DB
        .prepare(
          `INSERT INTO report_updates (
            report_id,
            status,
            update_note,
            updated_by,
            is_public
          )
          VALUES (?, ?, ?, ?, ?)`
        )
        .bind(reportId, status, updateNote, user.id, isPublic ? 1 : 0),
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
          "REPORT_STATUS_UPDATED",
          "report",
          String(reportId),
          auditDetail,
          getClientIp(request)
        ),
    ]);

    return jsonOk(
      {
        id: report.id,
        tracking_code: report.tracking_code,
        status,
        updated_at: now,
        closed_at: closedAt,
      },
      "บันทึกสถานะสำเร็จ"
    );
  } catch {
    return jsonError("SERVER_ERROR", "ไม่สามารถบันทึกสถานะได้ในขณะนี้", 500);
  }
}
