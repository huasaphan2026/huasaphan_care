import { jsonError, jsonOk } from "../_utils/response.js";

const LATEST_REPORTS_LIMIT = 10;

function methodNotAllowed() {
  const response = jsonError("METHOD_NOT_ALLOWED", "Method not allowed", 405);
  response.headers.set("Allow", "GET");
  return response;
}

function toNumber(value) {
  const numberValue = Number(value || 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
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

export async function onRequest({ request, env, data = {} }) {
  if (request.method !== "GET") {
    return methodNotAllowed();
  }

  if (!data.user) {
    return jsonError("UNAUTHORIZED", "กรุณาเข้าสู่ระบบ", 401);
  }

  try {
    const summary = await env.DB.prepare(
      `SELECT
        COUNT(*) AS total_reports,
        SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) AS new_reports,
        SUM(CASE WHEN priority = ? THEN 1 ELSE 0 END) AS urgent_reports,
        SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) AS in_progress_reports,
        SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) AS resolved_reports,
        SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) AS closed_reports
      FROM reports`
    )
      .bind("new", "urgent", "in_progress", "resolved", "closed")
      .first();

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
      ORDER BY total DESC, c.sort_order ASC, c.id ASC`
    ).all();

    const { results: latestRows } = await env.DB.prepare(
      `SELECT
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
      LIMIT ?`
    )
      .bind(LATEST_REPORTS_LIMIT)
      .all();

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
      },
      "success"
    );
  } catch {
    return jsonError("SERVER_ERROR", "ไม่สามารถโหลดข้อมูลแดชบอร์ดได้ในขณะนี้", 500);
  }
}
