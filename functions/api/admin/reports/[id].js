import { jsonError, jsonOk } from "../../_utils/response.js";

const PRIVATE_REPORT_ROLES = new Set(["super_admin", "admin", "staff"]);
const KNOWN_REPORT_ROLES = new Set(["super_admin", "admin", "staff", "viewer"]);
const MANAGER_ROLES = new Set(["super_admin", "admin"]);
const STAFF_ROLE = "staff";

function methodNotAllowed() {
  const response = jsonError("METHOD_NOT_ALLOWED", "Method not allowed", 405);
  response.headers.set("Allow", "GET");
  return response;
}

function parseReportId(params = {}) {
  const reportId = Number.parseInt(String(params.id || ""), 10);
  return Number.isInteger(reportId) && reportId > 0 ? reportId : null;
}

function canViewPrivateReport(user) {
  return PRIVATE_REPORT_ROLES.has(String(user?.role || ""));
}

function hasKnownReportRole(user) {
  return KNOWN_REPORT_ROLES.has(String(user?.role || ""));
}

function isStaff(user) {
  return String(user?.role || "") === STAFF_ROLE;
}

function isManager(user) {
  return MANAGER_ROLES.has(String(user?.role || ""));
}

function normalizeUserId(value) {
  const userId = Number.parseInt(String(value || ""), 10);
  return Number.isInteger(userId) && userId > 0 ? userId : null;
}

function hasAssignedReportAccess(report, user) {
  const assignedTo = normalizeUserId(report?.assigned_to);
  const userId = normalizeUserId(user?.id);

  return Boolean(assignedTo && userId && assignedTo === userId);
}

function toBoolean(value) {
  return value === 1;
}

function normalizePrivateReport(row) {
  return {
    id: row.id,
    tracking_code: row.tracking_code,
    category_id: row.category_id,
    title: row.title,
    detail: row.detail,
    location_text: row.location_text,
    location_lat: row.location_lat,
    location_lng: row.location_lng,
    priority: row.priority,
    status: row.status,
    anonymous: toBoolean(row.anonymous),
    assigned_to: row.assigned_to,
    assigned_name: row.assigned_name,
    public_visible: toBoolean(row.public_visible),
    public_summary: row.public_summary,
    public_location_label: row.public_location_label,
    public_image_allowed: toBoolean(row.public_image_allowed),
    created_at: row.created_at,
    updated_at: row.updated_at,
    closed_at: row.closed_at,
  };
}

function normalizeViewerReport(row) {
  return {
    tracking_code: row.tracking_code,
    priority: row.priority,
    status: row.status,
    public_summary: row.public_summary,
    public_location_label: row.public_location_label,
    created_at: row.created_at,
    updated_at: row.updated_at,
    closed_at: row.closed_at,
  };
}

function normalizePrivateCategory(row) {
  return {
    id: row.category_id,
    code: row.category_code,
    name: row.category_name,
    description: row.category_description,
    default_priority: row.category_default_priority,
    active: toBoolean(row.category_active),
    sort_order: row.category_sort_order,
  };
}

function normalizeViewerCategory(row) {
  return {
    name: row.category_name,
  };
}

function normalizePrivateReporter(row) {
  return {
    anonymous: toBoolean(row.anonymous),
    name: row.reporter_name || null,
    phone: row.reporter_phone || null,
    masked: false,
  };
}

function normalizeViewerReporter() {
  return {
    masked: true,
  };
}

function normalizePrivateTimeline(rows = []) {
  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    update_note: row.update_note,
    is_public: toBoolean(row.is_public),
    updated_by: row.updated_by,
    updated_by_name: row.updated_by_name,
    updated_by_role: row.updated_by_role,
    created_at: row.created_at,
  }));
}

function normalizeViewerTimeline(rows = []) {
  return rows.map((row) => ({
    status: row.status,
    update_note: row.update_note,
    is_public: true,
    created_at: row.created_at,
  }));
}

function normalizePrivateAssignments(rows = []) {
  return rows.map((row) => ({
    id: row.id,
    report_id: row.report_id,
    user_id: row.user_id,
    assigned_name: row.assigned_name,
    assigned_role: row.assigned_role,
    assigned_by: row.assigned_by,
    assigned_by_name: row.assigned_by_name,
    due_date: row.due_date,
    note: row.note,
    created_at: row.created_at,
  }));
}

function normalizePrivateAttachments(rows = []) {
  return rows.map((row) => ({
    id: row.id,
    report_id: row.report_id,
    r2_key: row.r2_key,
    file_name: row.file_name,
    file_type: row.file_type,
    file_size: row.file_size,
    purpose: row.purpose,
    public_allowed: toBoolean(row.public_allowed),
    uploaded_by: row.uploaded_by,
    uploaded_by_name: row.uploaded_by_name,
    uploaded_at: row.uploaded_at,
  }));
}

function normalizePrivatePublicSettings(row) {
  return {
    public_visible: toBoolean(row.public_visible),
    public_summary: row.public_summary,
    public_location_label: row.public_location_label,
    public_image_allowed: toBoolean(row.public_image_allowed),
  };
}

function normalizeViewerPublicSettings(row) {
  return {
    public_summary: row.public_summary,
    public_location_label: row.public_location_label,
  };
}

async function getPrivateReport(db, reportId) {
  return db
    .prepare(
      `SELECT
        r.id,
        r.tracking_code,
        r.category_id,
        r.title,
        r.detail,
        r.location_text,
        r.location_lat,
        r.location_lng,
        r.priority,
        r.status,
        r.anonymous,
        r.reporter_name,
        r.reporter_phone,
        r.assigned_to,
        r.public_visible,
        r.public_summary,
        r.public_location_label,
        r.public_image_allowed,
        r.created_at,
        r.updated_at,
        r.closed_at,
        c.code AS category_code,
        c.name AS category_name,
        c.description AS category_description,
        c.default_priority AS category_default_priority,
        c.active AS category_active,
        c.sort_order AS category_sort_order,
        assignee.name AS assigned_name
      FROM reports r
      JOIN categories c ON c.id = r.category_id
      LEFT JOIN users assignee ON assignee.id = r.assigned_to
      WHERE r.id = ?
      LIMIT 1`
    )
    .bind(reportId)
    .first();
}

async function getViewerReport(db, reportId) {
  return db
    .prepare(
      `SELECT
        r.id,
        r.tracking_code,
        r.priority,
        r.status,
        r.public_summary,
        r.public_location_label,
        r.created_at,
        r.updated_at,
        r.closed_at,
        c.name AS category_name
      FROM reports r
      JOIN categories c ON c.id = r.category_id
      WHERE r.id = ?
      LIMIT 1`
    )
    .bind(reportId)
    .first();
}

async function getReportAccess(db, reportId) {
  return db
    .prepare(
      `SELECT id, assigned_to
      FROM reports
      WHERE id = ?
      LIMIT 1`
    )
    .bind(reportId)
    .first();
}

async function getPrivateTimeline(db, reportId) {
  const { results } = await db
    .prepare(
      `SELECT
        ru.id,
        ru.status,
        ru.update_note,
        ru.updated_by,
        ru.is_public,
        ru.created_at,
        u.name AS updated_by_name,
        u.role AS updated_by_role
      FROM report_updates ru
      LEFT JOIN users u ON u.id = ru.updated_by
      WHERE ru.report_id = ?
      ORDER BY ru.created_at ASC, ru.id ASC`
    )
    .bind(reportId)
    .all();

  return results || [];
}

async function getViewerTimeline(db, reportId) {
  const { results } = await db
    .prepare(
      `SELECT
        ru.status,
        ru.update_note,
        ru.created_at
      FROM report_updates ru
      WHERE ru.report_id = ?
        AND ru.is_public = ?
      ORDER BY ru.created_at ASC, ru.id ASC`
    )
    .bind(reportId, 1)
    .all();

  return results || [];
}

async function getAssignments(db, reportId) {
  const { results } = await db
    .prepare(
      `SELECT
        a.id,
        a.report_id,
        a.user_id,
        a.assigned_by,
        a.due_date,
        a.note,
        a.created_at,
        assigned_user.name AS assigned_name,
        assigned_user.role AS assigned_role,
        assigned_by_user.name AS assigned_by_name
      FROM assignments a
      JOIN users assigned_user ON assigned_user.id = a.user_id
      LEFT JOIN users assigned_by_user ON assigned_by_user.id = a.assigned_by
      WHERE a.report_id = ?
      ORDER BY a.created_at DESC, a.id DESC`
    )
    .bind(reportId)
    .all();

  return results || [];
}

async function getAttachments(db, reportId) {
  const { results } = await db
    .prepare(
      `SELECT
        a.id,
        a.report_id,
        a.r2_key,
        a.file_name,
        a.file_type,
        a.file_size,
        a.purpose,
        a.public_allowed,
        a.uploaded_by,
        a.uploaded_at,
        u.name AS uploaded_by_name
      FROM attachments a
      LEFT JOIN users u ON u.id = a.uploaded_by
      WHERE a.report_id = ?
      ORDER BY a.uploaded_at ASC, a.id ASC`
    )
    .bind(reportId)
    .all();

  return results || [];
}

export async function onRequest({ request, env, params, data = {} }) {
  if (request.method !== "GET") {
    return methodNotAllowed();
  }

  if (!data.user) {
    return jsonError("UNAUTHORIZED", "กรุณาเข้าสู่ระบบ", 401);
  }

  if (!hasKnownReportRole(data.user)) {
    return jsonError("FORBIDDEN", "บัญชีนี้ไม่มีสิทธิ์ดูรายละเอียดเรื่อง", 403);
  }

  const reportId = parseReportId(params);

  if (!reportId) {
    return jsonError("VALIDATION_ERROR", "รหัสรายการไม่ถูกต้อง", 400);
  }

  const includePrivate = canViewPrivateReport(data.user);

  try {
    if (!includePrivate) {
      const report = await getViewerReport(env.DB, reportId);

      if (!report) {
        return jsonError("NOT_FOUND", "ไม่พบรายการเรื่อง", 404);
      }

      const timelineRows = await getViewerTimeline(env.DB, report.id);

      return jsonOk(
        {
          report: normalizeViewerReport(report),
          category: normalizeViewerCategory(report),
          reporter: normalizeViewerReporter(),
          timeline: normalizeViewerTimeline(timelineRows),
          assignments: [],
          attachments: [],
          public_settings: normalizeViewerPublicSettings(report),
          permissions: {
            can_view_private: false,
            private_data_masked: true,
            can_update_status: false,
            can_add_update: false,
            can_assign: false,
            can_publish: false,
          },
        },
        "success"
      );
    }

    if (isStaff(data.user)) {
      const reportAccess = await getReportAccess(env.DB, reportId);

      if (!reportAccess) {
        return jsonError("NOT_FOUND", "ไม่พบรายการเรื่อง", 404);
      }

      if (!hasAssignedReportAccess(reportAccess, data.user)) {
        return jsonError("FORBIDDEN", "ไม่มีสิทธิ์ดูรายละเอียดเรื่องนี้", 403);
      }
    }

    const report = await getPrivateReport(env.DB, reportId);

    if (!report) {
      return jsonError("NOT_FOUND", "ไม่พบรายการเรื่อง", 404);
    }

    const [timelineRows, assignmentRows, attachmentRows] = await Promise.all([
      getPrivateTimeline(env.DB, reportId),
      getAssignments(env.DB, reportId),
      getAttachments(env.DB, reportId),
    ]);

    return jsonOk(
      {
        report: normalizePrivateReport(report),
        category: normalizePrivateCategory(report),
        reporter: normalizePrivateReporter(report),
        timeline: normalizePrivateTimeline(timelineRows),
        assignments: normalizePrivateAssignments(assignmentRows),
        attachments: normalizePrivateAttachments(attachmentRows),
        public_settings: normalizePrivatePublicSettings(report),
        permissions: {
          can_view_private: true,
          private_data_masked: false,
          can_update_status: isManager(data.user) || isStaff(data.user),
          can_add_update: isManager(data.user) || isStaff(data.user),
          can_assign: isManager(data.user),
          can_publish: isManager(data.user),
        },
      },
      "success"
    );
  } catch {
    return jsonError("SERVER_ERROR", "ไม่สามารถโหลดรายละเอียดเรื่องได้ในขณะนี้", 500);
  }
}
