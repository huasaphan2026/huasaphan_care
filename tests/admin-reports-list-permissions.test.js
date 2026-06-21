import assert from "node:assert/strict";
import test from "node:test";

import { onRequest } from "../functions/api/admin/reports.js";

const ADMIN = { id: 1, name: "Admin", role: "admin" };
const STAFF = { id: 11, name: "Staff", role: "staff" };
const VIEWER = { id: 22, name: "Viewer", role: "viewer" };

const PRIVATE_ROW = {
  id: 7,
  tracking_code: "HSC-2026-0007",
  title: "Broken light near private home",
  category_id: 2,
  category_name: "Lighting",
  location_text: "House 12/3, private lane",
  priority: "urgent",
  status: "in_progress",
  anonymous: 1,
  public_visible: 0,
  created_at: "2026-06-20T08:00:00.000Z",
  updated_at: "2026-06-20T09:00:00.000Z",
  closed_at: null,
};

const VIEWER_ROW = {
  id: 7,
  tracking_code: "HSC-2026-0007",
  category_name: "Lighting",
  priority: "urgent",
  status: "in_progress",
  public_summary: "Light repair is being coordinated.",
  public_location_label: "Main community road",
  created_at: "2026-06-20T08:00:00.000Z",
  updated_at: "2026-06-20T09:00:00.000Z",
  closed_at: null,
  detail: "Private detail should not be normalized",
  location_text: "House 12/3, private lane",
  location_lat: 8.123456,
  location_lng: 99.654321,
  reporter_name: "Private Reporter",
  reporter_phone: "0812345678",
  anonymous: 1,
  assigned_to: 11,
  internal_note: "Internal note",
  private_update: "Private update",
  r2_key: "reports/2026/HSC-2026-0007/private.webp",
};

function createDbMock() {
  const queries = [];
  const binds = [];

  return {
    queries,
    binds,
    prepare(sql) {
      queries.push(sql);

      return {
        async all() {
          return rowsForSql(sql);
        },
        async first() {
          return firstForSql(sql);
        },
        bind(...args) {
          binds.push(args);

          return {
            async all() {
              return rowsForSql(sql);
            },
            async first() {
              return firstForSql(sql);
            },
          };
        },
      };
    },
  };
}

function firstForSql(sql) {
  if (sql.includes("COUNT(*) AS total")) {
    return { total: 1 };
  }

  return null;
}

function rowsForSql(sql) {
  if (sql.includes("FROM reports r") && sql.includes("LIMIT ? OFFSET ?")) {
    return {
      results: sql.includes("r.public_summary") ? [VIEWER_ROW] : [PRIVATE_ROW],
    };
  }

  if (sql.includes("SELECT status, COUNT(*) AS total")) {
    return { results: [{ status: "in_progress", total: 1 }] };
  }

  if (sql.includes("FROM categories c")) {
    return {
      results: [
        {
          category_id: 2,
          category_code: "lighting",
          category_name: "Lighting",
          total: 1,
        },
      ],
    };
  }

  if (sql.includes("SELECT priority, COUNT(*) AS total")) {
    return { results: [{ priority: "urgent", total: 1 }] };
  }

  return { results: [] };
}

async function requestList(user, query = "") {
  const db = createDbMock();
  const response = await onRequest({
    request: new Request(`https://example.test/api/admin/reports${query}`),
    env: { DB: db },
    data: user ? { user } : {},
  });
  const body = await response.json();

  return { status: response.status, body, db };
}

test("admin list still returns private fields needed by the existing list UI", async () => {
  const result = await requestList(ADMIN);
  const report = result.body.data.reports[0];

  assert.equal(result.status, 200);
  assert.equal(report.id, PRIVATE_ROW.id);
  assert.equal(report.title, PRIVATE_ROW.title);
  assert.equal(report.category_id, PRIVATE_ROW.category_id);
  assert.equal(report.location_text, PRIVATE_ROW.location_text);
  assert.equal(report.priority, PRIVATE_ROW.priority);
  assert.equal(report.status, PRIVATE_ROW.status);
  assert.equal(report.anonymous, true);
  assert.equal(report.public_visible, false);
});

test("staff list is filtered by assigned_to on the server", async () => {
  const result = await requestList(STAFF);
  const sql = result.db.queries.join("\n");
  const flattenedBinds = result.db.binds.flat();

  assert.equal(result.status, 200);
  assert.equal(sql.includes("r.assigned_to = ?"), true);
  assert.equal(flattenedBinds.includes(STAFF.id), true);
});

test("viewer list returns only safe summary fields", async () => {
  const result = await requestList(VIEWER);
  const report = result.body.data.reports[0];

  assert.equal(result.status, 200);
  assert.deepEqual(report, {
    id: VIEWER_ROW.id,
    tracking_code: VIEWER_ROW.tracking_code,
    category_name: VIEWER_ROW.category_name,
    priority: VIEWER_ROW.priority,
    status: VIEWER_ROW.status,
    public_summary: VIEWER_ROW.public_summary,
    public_location_label: VIEWER_ROW.public_location_label,
    created_at: VIEWER_ROW.created_at,
    updated_at: VIEWER_ROW.updated_at,
    closed_at: VIEWER_ROW.closed_at,
  });
});

test("viewer list JSON does not include sensitive report keys or values", async () => {
  const result = await requestList(VIEWER);
  const text = JSON.stringify(result.body);
  const forbiddenTokens = [
    "location_text",
    "location_lat",
    "location_lng",
    "reporter_name",
    "reporter_phone",
    "Private Reporter",
    "0812345678",
    "\"detail\"",
    "Private detail",
    "\"anonymous\"",
    "assigned_to",
    "internal_note",
    "Internal note",
    "private_update",
    "Private update",
    "r2_key",
    "private.webp",
    "House 12/3",
  ];

  forbiddenTokens.forEach((token) => {
    assert.equal(text.includes(token), false, `viewer response leaked ${token}`);
  });
});

test("viewer list query does not select forbidden columns", async () => {
  const result = await requestList(VIEWER);
  const reportSql = result.db.queries
    .filter((query) => query.includes("FROM reports r"))
    .join("\n");

  assert.equal(result.status, 200);
  assert.equal(reportSql.includes("SELECT *"), false);
  assert.equal(reportSql.includes("r.location_text"), false);
  assert.equal(reportSql.includes("r.location_lat"), false);
  assert.equal(reportSql.includes("r.location_lng"), false);
  assert.equal(reportSql.includes("r.reporter_name"), false);
  assert.equal(reportSql.includes("r.reporter_phone"), false);
  assert.equal(reportSql.includes("r.detail"), false);
  assert.equal(reportSql.includes("r.anonymous"), false);
  assert.equal(reportSql.includes("r.assigned_to"), false);
});

test("viewer search uses only safe searchable fields", async () => {
  const result = await requestList(VIEWER, "?q=private%20lane");
  const reportSql = result.db.queries
    .filter((query) => query.includes("FROM reports r"))
    .join("\n");

  assert.equal(result.status, 200);
  assert.equal(reportSql.includes("r.location_text"), false);
  assert.equal(reportSql.includes("r.title"), false);
  assert.equal(reportSql.includes("r.public_summary LIKE ?"), true);
  assert.equal(reportSql.includes("r.public_location_label LIKE ?"), true);
  assert.equal(reportSql.includes("c.name LIKE ?"), true);
});

test("unknown role is rejected before querying reports", async () => {
  const result = await requestList({ id: 99, name: "Auditor", role: "auditor" });

  assert.equal(result.status, 403);
  assert.equal(result.body.error.code, "FORBIDDEN");
  assert.equal(result.db.queries.length, 0);
});

test("guest list request returns 401 before querying reports", async () => {
  const result = await requestList(null);

  assert.equal(result.status, 401);
  assert.equal(result.body.error.code, "UNAUTHORIZED");
  assert.equal(result.db.queries.length, 0);
});

test("pagination and top-level response shape are preserved", async () => {
  const result = await requestList(VIEWER, "?page=1&limit=20");

  assert.equal(result.status, 200);
  assert.equal(result.body.ok, true);
  assert.equal(Array.isArray(result.body.data.reports), true);
  assert.deepEqual(result.body.data.pagination, {
    page: 1,
    limit: 20,
    total: 1,
    total_pages: 1,
    has_next: false,
    has_prev: false,
  });
  assert.equal(typeof result.body.data.filters, "object");
  assert.equal(Array.isArray(result.body.data.filters.status_summary), true);
  assert.equal(Array.isArray(result.body.data.filters.category_summary), true);
  assert.equal(Array.isArray(result.body.data.filters.priority_summary), true);
});
