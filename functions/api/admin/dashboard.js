import { jsonError, jsonOk } from "../_utils/response.js";

const LATEST_REPORTS_LIMIT = 10;
const MANAGER_ROLES = new Set(["super_admin", "admin"]);
const KNOWN_DASHBOARD_ROLES = new Set(["super_admin", "admin", "staff", "viewer"]);
const STAFF_ROLE = "staff";
const VIEWER_ROLE = "viewer";

function methodNotAllowed() {
  const response = jsonError("METHOD_NOT_ALLOWED", "Method not allowed", 405);
  response.headers.set("Allow", "GET");
  return response;
}

function toNumber(value) {
  const numberValue = Number(value || 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function normalizeUserId(value) {
  const userId = Number.parseInt(String(value || ""), 10);
  return Number.isInteger(userId) && userId > 0 ? userId : null;
}

function getDashboardRole(user) {
  const role = String(user?.role || "");
  return KNOWN_DASHBOARD_ROLES.has(role) ? role : "";
}

function isManager(user) {
  return MANAGER_ROLES.has(String(user?.role || ""));
}

function isStaff(user) {
  return String(user?.role || "") === STAFF_ROLE;
}

function isViewer(user) {
  return String(user?.role || "") === VIEWER_ROLE;
}

function normalizeStatusRows(rows = []) {
  return rows.map((row) => ({
    status: row.status,
    total: toNumber(row.total),
  }));
}

function normalizeCategoryRows(rows = []) {
  return rows.map((row) => ({
    category_id: row.category_id,
    category_code: row.category_code,
    category_name: row.category_name,
    total: toNumber(row.total),
  }));
}

function normalizeLatestReports(rows = []) {
  return rows.slice(0, LATEST_REPORTS_LIMIT).map((row) => ({
    id: row.id,
    tracking_code: row.tracking_code,
    title: row.title,
    category_name: row.category_name,
    priority: row.priority,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

function bindStatement(statement, bindings) {
  return bindings.length ? statement.bind(...bindings) : statement;
}

function getDashboardScope(user) {
  if (isManager(user)) {
    return {
      name: "all",
      whereSql: "",
      whereBindings: [],
      categoryJoinSql: "LEFT JOIN reports r ON r.category_id = c.id",
      categoryBindings: [],
      latestSql: `SELECT
        r.id,
        r.tracking_code,
        r.title,
        r.priority,
        r.status,
        r.created_at,
        r.updated_at,
        c.name AS category_name
      FROM reports r
      JOIN categories c ON c.id = r.category_id
      ORDER BY r.created_at DESC, r.id DESC
      LIMIT ?`,
      latestBindings: [LATEST_REPORTS_LIMIT],
      canViewLatestReports: true,
    };
  }

  if (isStaff(user)) {
    const userId = normalizeUserId(user.id) || -1;

    return {
      name: "assigned",
      whereSql: "WHERE assigned_to = ?",
      whereBindings: [userId],
      categoryJoinSql: "LEFT JOIN reports r ON r.category_id = c.id AND r.assigned_to = ?",
      categoryBindings: [userId],
      latestSql: `SELECT
        r.id,
        r.tracking_code,
        r.title,
        r.priority,
        r.status,
        r.created_at,
        r.updated_at,
        c.name AS category_name
      FROM reports r
      JOIN categories c ON c.id = r.category_id
      WHERE r.assigned_to = ?
      ORDER BY r.created_at DESC, r.id DESC
      LIMIT ?`,
      latestBindings: [userId, LATEST_REPORTS_LIMIT],
      canViewLatestReports: true,
    };
  }

  if (isViewer(user)) {
    return {
      name: "public",
      whereSql: "WHERE public_visible = ?",
      whereBindings: [1],
      categoryJoinSql: "LEFT JOIN reports r ON r.category_id = c.id AND r.public_visible = ?",
      categoryBindings: [1],
      latestSql: "",
      latestBindings: [],
      canViewLatestReports: false,
    };
  }

  return null;
}

async function getSummary(db, scope) {
  return db
    .prepare(
      `SELECT
        COUNT(*) AS total_reports,
        SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) AS new_reports,
        SUM(CASE WHEN priority = ? THEN 1 ELSE 0 END) AS urgent_reports,
        SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) AS in_progress_reports,
        SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) AS resolved_reports,
        SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) AS closed_reports
      FROM reports
      ${scope.whereSql}`
    )
    .bind("new", "urgent", "in_progress", "resolved", "closed", ...scope.whereBindings)
    .first();
}

async function getStatusRows(db, scope) {
  const statement = db.prepare(
    `SELECT status, COUNT(*) AS total
      FROM reports
      ${scope.whereSql}
      GROUP BY status
      ORDER BY total DESC, status ASC`
  );
  const { results } = await bindStatement(statement, scope.whereBindings).all();
  return results || [];
}

async function getCategoryRows(db, scope) {
  const statement = db.prepare(
    `SELECT
        c.id AS category_id,
        c.code AS category_code,
        c.name AS category_name,
        COUNT(r.id) AS total
      FROM categories c
      ${scope.categoryJoinSql}
      GROUP BY c.id, c.code, c.name, c.sort_order
      ORDER BY total DESC, c.sort_order ASC, c.id ASC`
  );
  const { results } = await bindStatement(statement, scope.categoryBindings).all();
  return results || [];
}

async function getLatestRows(db, scope) {
  if (!scope.canViewLatestReports) {
    return [];
  }

  const statement = db.prepare(scope.latestSql);
  const { results } = await bindStatement(statement, scope.latestBindings).all();
  return results || [];
}

export async function onRequest({ request, env, data = {} }) {
  if (request.method !== "GET") {
    return methodNotAllowed();
  }

  if (!data.user) {
    return jsonError("UNAUTHORIZED", "Please sign in", 401);
  }

  const role = getDashboardRole(data.user);
  const scope = getDashboardScope(data.user);

  if (!role || !scope) {
    return jsonError("FORBIDDEN", "This account cannot view dashboard", 403);
  }

  try {
    const [summary, statusRows, categoryRows, latestRows] = await Promise.all([
      getSummary(env.DB, scope),
      getStatusRows(env.DB, scope),
      getCategoryRows(env.DB, scope),
      getLatestRows(env.DB, scope),
    ]);

    return jsonOk(
      {
        total_reports: toNumber(summary?.total_reports),
        new_reports: toNumber(summary?.new_reports),
        urgent_reports: toNumber(summary?.urgent_reports),
        in_progress_reports: toNumber(summary?.in_progress_reports),
        resolved_reports: toNumber(summary?.resolved_reports),
        closed_reports: toNumber(summary?.closed_reports),
        reports_by_status: normalizeStatusRows(statusRows),
        reports_by_category: normalizeCategoryRows(categoryRows),
        latest_reports: normalizeLatestReports(latestRows),
        permissions: {
          role,
          scope: scope.name,
          can_view_latest_reports: scope.canViewLatestReports,
          latest_reports_masked: !scope.canViewLatestReports,
        },
      },
      "success"
    );
  } catch {
    return jsonError("SERVER_ERROR", "Unable to load dashboard right now", 500);
  }
}
