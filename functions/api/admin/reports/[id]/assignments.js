import { jsonError, jsonOk } from "../../../_utils/response.js";

const ASSIGNABLE_ROLES = new Set(["super_admin", "admin", "staff"]);
const ASSIGNMENT_MANAGER_ROLES = new Set(["super_admin", "admin"]);
const MAX_NOTE_LENGTH = 1000;
const ASSIGNMENT_TIMELINE_STATUS_FALLBACK = "accepted";

function methodNotAllowed() {
  const response = jsonError("METHOD_NOT_ALLOWED", "Method not allowed", 405);
  response.headers.set("Allow", "POST");
  return response;
}

function parseReportId(params = {}) {
  const reportId = Number.parseInt(String(params.id || ""), 10);
  return Number.isInteger(reportId) && reportId > 0 ? reportId : null;
}

function parseUserId(value) {
  const userId = Number.parseInt(String(value || ""), 10);
  return Number.isInteger(userId) && userId > 0 ? userId : null;
}

function trimText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function normalizeDueDate(value) {
  const dueDate = trimText(value, 10);

  if (!dueDate) {
    return null;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(dueDate) ? dueDate : "";
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

async function getAssignableUser(db, userId) {
  return db
    .prepare(
      `SELECT id, name, role
      FROM users
      WHERE id = ?
        AND active = ?
      LIMIT 1`
    )
    .bind(userId, 1)
    .first();
}

function canAssign(actor) {
  const role = String(actor?.role || "");
  return ASSIGNMENT_MANAGER_ROLES.has(role);
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

async function getCreatedAssignment(db, reportId, userId, assignedBy, createdAt) {
  return db
    .prepare(
      `SELECT id, report_id, user_id, assigned_by, due_date, note, created_at
      FROM assignments
      WHERE report_id = ?
        AND user_id = ?
        AND assigned_by = ?
        AND created_at = ?
      ORDER BY id DESC
      LIMIT 1`
    )
    .bind(reportId, userId, assignedBy, createdAt)
    .first();
}

export async function onRequest({ request, env, params, data = {} }) {
  if (request.method !== "POST") {
    return methodNotAllowed();
  }

  const actor = data.user;

  if (!actor) {
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

  const assigneeId = parseUserId(body.user_id);
  const dueDate = normalizeDueDate(body.due_date);
  const note = trimText(body.note, MAX_NOTE_LENGTH);

  if (!assigneeId) {
    return jsonError("VALIDATION_ERROR", "กรุณาระบุผู้รับผิดชอบให้ถูกต้อง", 400);
  }

  if (dueDate === "") {
    return jsonError("VALIDATION_ERROR", "รูปแบบวันที่กำหนดเสร็จไม่ถูกต้อง", 400);
  }

  if (!canAssign(actor)) {
    return jsonError("FORBIDDEN", "ไม่มีสิทธิ์มอบหมายงานให้ผู้อื่น", 403);
  }

  try {
    const report = await getReport(env.DB, reportId);

    if (!report) {
      return jsonError("NOT_FOUND", "ไม่พบรายการเรื่อง", 404);
    }

    const assignee = await getAssignableUser(env.DB, assigneeId);

    if (!assignee || !ASSIGNABLE_ROLES.has(String(assignee.role || ""))) {
      return jsonError("VALIDATION_ERROR", "ไม่พบผู้รับผิดชอบที่ใช้งานได้", 400);
    }

    const now = new Date().toISOString();
    const timelineStatus = report.status || ASSIGNMENT_TIMELINE_STATUS_FALLBACK;
    const timelineNote = `มอบหมายงานให้ ${assignee.name} แล้ว`;
    const auditDetail = JSON.stringify({
      tracking_code: report.tracking_code,
      assigned_to: assignee.id,
      assigned_role: assignee.role,
      due_date: dueDate,
    });

    await env.DB.batch([
      env.DB
        .prepare(
          `INSERT INTO assignments (
            report_id,
            user_id,
            assigned_by,
            due_date,
            note,
            created_at
          )
          VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(reportId, assignee.id, actor.id, dueDate, note || null, now),
      env.DB
        .prepare(
          `UPDATE reports
          SET assigned_to = ?,
              updated_at = ?
          WHERE id = ?`
        )
        .bind(assignee.id, now, reportId),
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
        .bind(reportId, timelineStatus, timelineNote, actor.id, 0, now),
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
          actor.id,
          "REPORT_ASSIGNED",
          "report",
          String(reportId),
          auditDetail,
          getClientIp(request)
        ),
    ]);

    const assignment = await getCreatedAssignment(
      env.DB,
      reportId,
      assignee.id,
      actor.id,
      now
    );

    return jsonOk(
      {
        id: assignment?.id || null,
        report_id: reportId,
        assigned_to: assignee.id,
        assigned_name: assignee.name,
        due_date: dueDate,
        created_at: now,
      },
      "มอบหมายงานสำเร็จ"
    );
  } catch {
    return jsonError("SERVER_ERROR", "ไม่สามารถมอบหมายงานได้ในขณะนี้", 500);
  }
}
