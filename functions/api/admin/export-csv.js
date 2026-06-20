import { jsonError } from "../_utils/response.js";

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
const EXPORT_ROLES = new Set(["super_admin", "admin"]);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CSV_COLUMNS = [
  "tracking_code",
  "category_name",
  "title",
  "location_text",
  "priority",
  "status",
  "created_at",
  "updated_at",
  "closed_at",
];

function methodNotAllowed() {
  const response = jsonError("METHOD_NOT_ALLOWED", "Method not allowed", 405);
  response.headers.set("Allow", "GET");
  return response;
}

function trimText(value, maxLength = 80) {
  return String(value || "").trim().slice(0, maxLength);
}

function normalizeDate(value) {
  const date = trimText(value, 10);
  if (!DATE_PATTERN.test(date)) {
    return "";
  }

  const parsedDate = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  return parsedDate.toISOString().slice(0, 10) === date ? date : "";
}

function normalizeStatus(value) {
  const status = trimText(value, 40);
  return VALID_STATUSES.has(status) ? status : "";
}

function normalizeCategoryId(value) {
  const categoryId = Number.parseInt(String(value || ""), 10);
  return Number.isInteger(categoryId) && categoryId > 0 ? categoryId : null;
}

function buildFilters(searchParams) {
  return {
    dateFrom: normalizeDate(searchParams.get("date_from")),
    dateTo: normalizeDate(searchParams.get("date_to")),
    rawDateFrom: trimText(searchParams.get("date_from"), 20),
    rawDateTo: trimText(searchParams.get("date_to"), 20),
    status: normalizeStatus(searchParams.get("status")),
    rawStatus: trimText(searchParams.get("status"), 40),
    categoryId: normalizeCategoryId(searchParams.get("category_id")),
    rawCategoryId: trimText(searchParams.get("category_id"), 20),
  };
}

function validateFilters(filters) {
  if (filters.rawDateFrom && !filters.dateFrom) {
    return "รูปแบบ date_from ไม่ถูกต้อง";
  }

  if (filters.rawDateTo && !filters.dateTo) {
    return "รูปแบบ date_to ไม่ถูกต้อง";
  }

  if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
    return "ช่วงวันที่ไม่ถูกต้อง";
  }

  if (filters.rawStatus && !filters.status) {
    return "สถานะไม่ถูกต้อง";
  }

  if (filters.rawCategoryId && !filters.categoryId) {
    return "หมวดไม่ถูกต้อง";
  }

  return "";
}

function buildWhereClause(filters) {
  const clauses = [];
  const bindings = [];

  if (filters.dateFrom) {
    clauses.push("date(r.created_at) >= date(?)");
    bindings.push(filters.dateFrom);
  }

  if (filters.dateTo) {
    clauses.push("date(r.created_at) <= date(?)");
    bindings.push(filters.dateTo);
  }

  if (filters.status) {
    clauses.push("r.status = ?");
    bindings.push(filters.status);
  }

  if (filters.categoryId) {
    clauses.push("r.category_id = ?");
    bindings.push(filters.categoryId);
  }

  return {
    sql: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
    bindings,
  };
}

function bindStatement(statement, bindings) {
  return bindings.length ? statement.bind(...bindings) : statement;
}

function neutralizeSpreadsheetFormula(value) {
  const text = String(value ?? "");
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

function escapeCsvValue(value) {
  const safeValue = neutralizeSpreadsheetFormula(value);
  const escaped = safeValue.replace(/"/g, '""');
  return /[",\r\n]/.test(escaped) ? `"${escaped}"` : escaped;
}

function toCsv(rows) {
  const lines = [
    CSV_COLUMNS.join(","),
    ...rows.map((row) =>
      CSV_COLUMNS.map((column) => escapeCsvValue(row[column] || "")).join(",")
    ),
  ];

  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

function buildFilename(filters) {
  const datePart = filters.dateFrom && filters.dateTo
    ? `${filters.dateFrom}-to-${filters.dateTo}`
    : new Date().toISOString().slice(0, 10);

  return `hua-saphan-care-reports-${datePart}.csv`;
}

function getClientIp(request) {
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For") ||
    ""
  ).split(",")[0].trim();
}

async function insertAuditLog(env, request, user, filters, rowCount) {
  const detail = JSON.stringify({
    filters: {
      date_from: filters.dateFrom || null,
      date_to: filters.dateTo || null,
      status: filters.status || null,
      category_id: filters.categoryId,
    },
    row_count: rowCount,
  });

  await env.DB.prepare(
    `INSERT INTO audit_logs (
      user_id,
      action,
      target_type,
      target_id,
      detail,
      ip_address,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      user.id,
      "CSV_EXPORTED",
      "report",
      "csv",
      detail,
      getClientIp(request) || null,
      new Date().toISOString()
    )
    .run();
}

export async function onRequest({ request, env, data = {} }) {
  if (request.method !== "GET") {
    return methodNotAllowed();
  }

  const user = data.user;
  if (!user) {
    return jsonError("UNAUTHORIZED", "กรุณาเข้าสู่ระบบ", 401);
  }

  if (!EXPORT_ROLES.has(user.role)) {
    return jsonError("FORBIDDEN", "ไม่มีสิทธิ์ส่งออกรายงาน", 403);
  }

  const url = new URL(request.url);
  const filters = buildFilters(url.searchParams);
  const validationError = validateFilters(filters);

  if (validationError) {
    return jsonError("VALIDATION_ERROR", validationError, 400);
  }

  const where = buildWhereClause(filters);

  try {
    const statement = env.DB.prepare(
      `SELECT
        r.tracking_code,
        c.name AS category_name,
        r.title,
        r.location_text,
        r.priority,
        r.status,
        r.created_at,
        r.updated_at,
        r.closed_at
      FROM reports r
      JOIN categories c ON c.id = r.category_id
      ${where.sql}
      ORDER BY r.created_at DESC, r.id DESC`
    );
    const { results } = await bindStatement(statement, where.bindings).all();
    const rows = results || [];

    await insertAuditLog(env, request, user, filters, rows.length);

    return new Response(toCsv(rows), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${buildFilename(filters)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return jsonError("SERVER_ERROR", "ไม่สามารถส่งออก CSV ได้ในขณะนี้", 500);
  }
}
