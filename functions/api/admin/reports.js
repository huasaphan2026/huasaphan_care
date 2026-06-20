import { jsonError, jsonOk } from "../_utils/response.js";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const VALID_STATUSES = new Set([
  "new",
  "accepted",
  "checking",
  "in_progress",
  "resolved",
  "closed",
  "rejected",
  "waiting_info",
  "forwarded",
]);
const VALID_PRIORITIES = new Set(["low", "normal", "high", "urgent"]);

function methodNotAllowed() {
  const response = jsonError("METHOD_NOT_ALLOWED", "Method not allowed", 405);
  response.headers.set("Allow", "GET");
  return response;
}

function parsePositiveInteger(value, fallback, maxValue) {
  const numberValue = Number.parseInt(String(value || ""), 10);

  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    return fallback;
  }

  if (maxValue && numberValue > maxValue) {
    return maxValue;
  }

  return numberValue;
}

function trimText(value, maxLength = 120) {
  return String(value || "").trim().slice(0, maxLength);
}

function normalizeStatus(value) {
  const status = trimText(value, 40);
  return VALID_STATUSES.has(status) ? status : "";
}

function normalizePriority(value) {
  const priority = trimText(value, 40);
  return VALID_PRIORITIES.has(priority) ? priority : "";
}

function normalizeCategoryId(value) {
  const categoryId = Number.parseInt(String(value || ""), 10);
  return Number.isInteger(categoryId) && categoryId > 0 ? categoryId : null;
}

function escapeLike(value) {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function toNumber(value) {
  const numberValue = Number(value || 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function buildFilters(searchParams) {
  const page = parsePositiveInteger(searchParams.get("page"), 1);
  const limit = parsePositiveInteger(
    searchParams.get("limit") || searchParams.get("pageSize"),
    DEFAULT_LIMIT,
    MAX_LIMIT
  );
  const status = normalizeStatus(searchParams.get("status"));
  const priority = normalizePriority(searchParams.get("priority"));
  const categoryId = normalizeCategoryId(searchParams.get("category_id"));
  const q = trimText(searchParams.get("q"), 100);

  return {
    page,
    limit,
    offset: (page - 1) * limit,
    status,
    priority,
    categoryId,
    q,
  };
}

function buildWhereClause(filters) {
  const clauses = [];
  const bindings = [];

  if (filters.status) {
    clauses.push("r.status = ?");
    bindings.push(filters.status);
  }

  if (filters.categoryId) {
    clauses.push("r.category_id = ?");
    bindings.push(filters.categoryId);
  }

  if (filters.priority) {
    clauses.push("r.priority = ?");
    bindings.push(filters.priority);
  }

  if (filters.q) {
    const query = `%${escapeLike(filters.q)}%`;
    clauses.push(
      "(r.tracking_code LIKE ? ESCAPE '\\' OR r.title LIKE ? ESCAPE '\\' OR r.location_text LIKE ? ESCAPE '\\')"
    );
    bindings.push(query, query, query);
  }

  return {
    sql: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
    bindings,
  };
}

function bindStatement(statement, bindings) {
  return bindings.length ? statement.bind(...bindings) : statement;
}

function normalizeReportRows(rows = []) {
  return rows.map((row) => ({
    id: row.id,
    tracking_code: row.tracking_code,
    title: row.title,
    category_id: row.category_id,
    category_name: row.category_name,
    location_text: row.location_text,
    priority: row.priority,
    status: row.status,
    anonymous: row.anonymous === 1,
    public_visible: row.public_visible === 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
    closed_at: row.closed_at,
  }));
}

function normalizeStatusSummary(rows = []) {
  return rows.map((row) => ({
    status: row.status,
    total: toNumber(row.total),
  }));
}

function normalizeCategorySummary(rows = []) {
  return rows.map((row) => ({
    category_id: row.category_id,
    category_code: row.category_code,
    category_name: row.category_name,
    total: toNumber(row.total),
  }));
}

function normalizePrioritySummary(rows = []) {
  return rows.map((row) => ({
    priority: row.priority,
    total: toNumber(row.total),
  }));
}

export async function onRequest({ request, env, data = {} }) {
  if (request.method !== "GET") {
    return methodNotAllowed();
  }

  if (!data.user) {
    return jsonError("UNAUTHORIZED", "กรุณาเข้าสู่ระบบ", 401);
  }

  const url = new URL(request.url);
  const filters = buildFilters(url.searchParams);
  const where = buildWhereClause(filters);

  try {
    const totalStatement = env.DB.prepare(
      `SELECT COUNT(*) AS total
      FROM reports r
      JOIN categories c ON c.id = r.category_id
      ${where.sql}`
    );
    const totalRow = await bindStatement(totalStatement, where.bindings).first();

    const reportsStatement = env.DB.prepare(
      `SELECT
        r.id,
        r.tracking_code,
        r.title,
        r.category_id,
        r.location_text,
        r.priority,
        r.status,
        r.anonymous,
        r.public_visible,
        r.created_at,
        r.updated_at,
        r.closed_at,
        c.name AS category_name
      FROM reports r
      JOIN categories c ON c.id = r.category_id
      ${where.sql}
      ORDER BY r.created_at DESC, r.id DESC
      LIMIT ? OFFSET ?`
    );
    const { results: reportRows } = await bindStatement(reportsStatement, [
      ...where.bindings,
      filters.limit,
      filters.offset,
    ]).all();

    const { results: statusRows } = await env.DB.prepare(
      `SELECT status, COUNT(*) AS total
      FROM reports
      GROUP BY status
      ORDER BY total DESC, status ASC`
    ).all();

    const { results: categoryRows } = await env.DB.prepare(
      `SELECT
        c.id AS category_id,
        c.code AS category_code,
        c.name AS category_name,
        COUNT(r.id) AS total
      FROM categories c
      LEFT JOIN reports r ON r.category_id = c.id
      GROUP BY c.id, c.code, c.name, c.sort_order
      ORDER BY c.sort_order ASC, c.id ASC`
    ).all();

    const { results: priorityRows } = await env.DB.prepare(
      `SELECT priority, COUNT(*) AS total
      FROM reports
      GROUP BY priority
      ORDER BY total DESC, priority ASC`
    ).all();

    const total = toNumber(totalRow?.total);
    const totalPages = Math.max(1, Math.ceil(total / filters.limit));

    return jsonOk(
      {
        reports: normalizeReportRows(reportRows),
        pagination: {
          page: filters.page,
          limit: filters.limit,
          total,
          total_pages: totalPages,
          has_next: filters.page < totalPages,
          has_prev: filters.page > 1,
        },
        filters: {
          applied: {
            status: filters.status || null,
            category_id: filters.categoryId,
            priority: filters.priority || null,
            q: filters.q || null,
          },
          status_summary: normalizeStatusSummary(statusRows),
          category_summary: normalizeCategorySummary(categoryRows),
          priority_summary: normalizePrioritySummary(priorityRows),
        },
      },
      "success"
    );
  } catch {
    return jsonError("SERVER_ERROR", "ไม่สามารถโหลดรายการเรื่องได้ในขณะนี้", 500);
  }
}
