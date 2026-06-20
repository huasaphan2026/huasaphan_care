import { jsonError, jsonOk } from "../_utils/response.js";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 30;

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

function normalizeCategory(value) {
  const category = String(value || "").trim().toLowerCase();
  return /^[a-z0-9_]{1,40}$/.test(category) ? category : "";
}

function buildFilters(searchParams) {
  const page = parsePositiveInteger(searchParams.get("page"), DEFAULT_PAGE);
  const pageSize = parsePositiveInteger(
    searchParams.get("pageSize") || searchParams.get("page_size"),
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE
  );
  const category = normalizeCategory(searchParams.get("category"));

  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
    category,
  };
}

function buildWhereClause(filters) {
  const clauses = [
    "r.public_visible = ?",
    "r.status IN (?, ?)",
    "r.public_summary IS NOT NULL",
    "TRIM(r.public_summary) != ''",
    "r.public_location_label IS NOT NULL",
    "TRIM(r.public_location_label) != ''",
  ];
  const bindings = [1, "resolved", "closed"];

  if (filters.category) {
    clauses.push("c.code = ?");
    bindings.push(filters.category);
  }

  return {
    sql: `WHERE ${clauses.join(" AND ")}`,
    bindings,
  };
}

function bindStatement(statement, bindings) {
  return bindings.length ? statement.bind(...bindings) : statement;
}

function toNumber(value) {
  const numberValue = Number(value || 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function normalizeWorkRows(rows = []) {
  return rows.map((row) => ({
    id: row.id,
    tracking_code: row.tracking_code,
    category_name: row.category_name,
    public_summary: row.public_summary,
    public_location_label: row.public_location_label,
    created_at: row.created_at,
    closed_at: row.closed_at,
    images: [],
  }));
}

export async function onRequest({ request, env }) {
  if (request.method !== "GET") {
    return methodNotAllowed();
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

    const worksStatement = env.DB.prepare(
      `SELECT
        r.id,
        r.tracking_code,
        r.public_summary,
        r.public_location_label,
        r.created_at,
        r.closed_at,
        c.name AS category_name
      FROM reports r
      JOIN categories c ON c.id = r.category_id
      ${where.sql}
      ORDER BY COALESCE(r.closed_at, r.updated_at, r.created_at) DESC, r.id DESC
      LIMIT ? OFFSET ?`
    );
    const { results } = await bindStatement(worksStatement, [
      ...where.bindings,
      filters.pageSize,
      filters.offset,
    ]).all();

    const works = normalizeWorkRows(results || []);
    const data = works.map((work) => {
      const { id, ...publicWork } = work;

      return publicWork;
    });
    const total = toNumber(totalRow?.total);
    const totalPages = Math.max(1, Math.ceil(total / filters.pageSize));

    return jsonOk(
      {
        works: data,
        meta: {
          page: filters.page,
          pageSize: filters.pageSize,
          total,
          totalPages,
        },
      },
      "success"
    );
  } catch {
    return jsonError("SERVER_ERROR", "ไม่สามารถโหลดรายการผลงานได้ในขณะนี้", 500);
  }
}
