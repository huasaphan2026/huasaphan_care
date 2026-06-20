import assert from "node:assert/strict";
import test from "node:test";

import { onRequest as onReportDetail } from "../functions/api/admin/reports/[id].js";
import { onRequest as onReportsList } from "../functions/api/admin/reports.js";
import { onRequest as onStatusUpdate } from "../functions/api/admin/reports/[id]/status.js";
import { onRequest as onUpdateCreate } from "../functions/api/admin/reports/[id]/updates.js";
import { onRequest as onAssignmentCreate } from "../functions/api/admin/reports/[id]/assignments.js";

const STAFF_A = { id: 11, name: "Staff A", role: "staff" };
const STAFF_B = { id: 22, name: "Staff B", role: "staff" };
const ADMIN = { id: 1, name: "Admin", role: "admin" };
const VIEWER = { id: 33, name: "Viewer", role: "viewer" };

function createReportRow(assignedTo) {
  return {
    id: 7,
    tracking_code: "HSC-2026-0007",
    category_id: 2,
    title: "Assigned report",
    detail: "Private report detail",
    location_text: "Private location",
    location_lat: 8.1,
    location_lng: 99.1,
    priority: "normal",
    status: "in_progress",
    anonymous: 0,
    reporter_name: "Reporter",
    reporter_phone: "0812345678",
    assigned_to: assignedTo,
    public_visible: 0,
    public_summary: "Public summary",
    public_location_label: "Public area",
    public_image_allowed: 0,
    created_at: "2026-06-20T08:00:00.000Z",
    updated_at: "2026-06-20T09:00:00.000Z",
    closed_at: null,
    category_code: "road",
    category_name: "Road",
    category_description: "Road problems",
    category_default_priority: "normal",
    category_active: 1,
    category_sort_order: 1,
    assigned_name: assignedTo === STAFF_A.id ? STAFF_A.name : STAFF_B.name,
  };
}

function createDetailDbMock({ assignedTo = STAFF_A.id } = {}) {
  const queries = [];
  const binds = [];

  return {
    queries,
    binds,
    prepare(sql) {
      queries.push(sql);

      return {
        async first() {
          return { total: 1 };
        },
        async all() {
          return { results: [] };
        },
        bind(...args) {
          binds.push(args);

          return {
            async first() {
              if (sql.includes("SELECT id, assigned_to")) {
                return { id: 7, assigned_to: assignedTo };
              }

              if (sql.includes("FROM reports r") && sql.includes("r.detail")) {
                return createReportRow(assignedTo);
              }

              if (sql.includes("FROM reports r")) {
                return {
                  id: 7,
                  tracking_code: "HSC-2026-0007",
                  priority: "normal",
                  status: "in_progress",
                  public_summary: "Public summary",
                  public_location_label: "Public area",
                  created_at: "2026-06-20T08:00:00.000Z",
                  updated_at: "2026-06-20T09:00:00.000Z",
                  closed_at: null,
                  category_name: "Road",
                };
              }

              return null;
            },
            async all() {
              if (sql.includes("FROM report_updates")) {
                return { results: [] };
              }

              return { results: [] };
            },
          };
        },
      };
    },
  };
}

function createListDbMock() {
  const queries = [];
  const binds = [];

  return {
    queries,
    binds,
    prepare(sql) {
      queries.push(sql);

      return {
        async first() {
          return { total: 1 };
        },
        async all() {
          return { results: [] };
        },
        bind(...args) {
          binds.push(args);

          return {
            async first() {
              return { total: 1 };
            },
            async all() {
              if (sql.includes("FROM reports r") && sql.includes("LIMIT ? OFFSET ?")) {
                return {
                  results: [
                    {
                      id: 7,
                      tracking_code: "HSC-2026-0007",
                      title: "Assigned report",
                      category_id: 2,
                      location_text: "Assigned location",
                      priority: "normal",
                      status: "in_progress",
                      anonymous: 0,
                      public_visible: 0,
                      created_at: "2026-06-20T08:00:00.000Z",
                      updated_at: "2026-06-20T09:00:00.000Z",
                      closed_at: null,
                      category_name: "Road",
                    },
                  ],
                };
              }

              return { results: [] };
            },
          };
        },
      };
    },
  };
}

function createStatusDbMock({ assignedTo = STAFF_A.id } = {}) {
  const batches = [];

  return {
    batches,
    prepare(sql) {
      return {
        bind() {
          return {
            async first() {
              if (sql.includes("FROM reports")) {
                return {
                  id: 7,
                  tracking_code: "HSC-2026-0007",
                  status: "in_progress",
                  assigned_to: assignedTo,
                  closed_at: null,
                };
              }

              return null;
            },
          };
        },
      };
    },
    async batch(statements) {
      batches.push(statements);
      return [];
    },
  };
}

async function requestDetail(user, assignedTo) {
  const db = createDetailDbMock({ assignedTo });
  const response = await onReportDetail({
    request: new Request("https://example.test/api/admin/reports/7"),
    env: { DB: db },
    params: { id: "7" },
    data: user ? { user } : {},
  });
  const body = await response.json();

  return { status: response.status, body, db };
}

async function requestList(user) {
  const db = createListDbMock();
  const response = await onReportsList({
    request: new Request("https://example.test/api/admin/reports?page=1"),
    env: { DB: db },
    data: user ? { user } : {},
  });
  const body = await response.json();

  return { status: response.status, body, db };
}

async function requestStatus(user, assignedTo, body = {}) {
  const db = createStatusDbMock({ assignedTo });
  const response = await onStatusUpdate({
    request: new Request("https://example.test/api/admin/reports/7/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "resolved",
        update_note: "Work completed",
        is_public: 0,
        assigned_to: STAFF_A.id,
        ...body,
      }),
    }),
    env: { DB: db },
    params: { id: "7" },
    data: user ? { user } : {},
  });
  const responseBody = await response.json();

  return { status: response.status, body: responseBody, db };
}

async function requestUpdate(user, assignedTo, body = {}) {
  const db = createStatusDbMock({ assignedTo });
  const response = await onUpdateCreate({
    request: new Request("https://example.test/api/admin/reports/7/updates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "in_progress",
        update_note: "Working on it",
        is_public: 0,
        assigned_to: STAFF_A.id,
        ...body,
      }),
    }),
    env: { DB: db },
    params: { id: "7" },
    data: user ? { user } : {},
  });
  const responseBody = await response.json();

  return { status: response.status, body: responseBody, db };
}

test("staff A sees report detail assigned to staff A", async () => {
  const result = await requestDetail(STAFF_A, STAFF_A.id);

  assert.equal(result.status, 200);
  assert.equal(result.body.data.report.assigned_to, STAFF_A.id);
  assert.equal(result.body.data.permissions.can_update_status, true);
  assert.equal(result.body.data.permissions.can_add_update, true);
  assert.equal(result.body.data.permissions.can_assign, false);
  assert.equal(result.body.data.permissions.can_publish, false);
});

test("staff A cannot see report detail assigned to staff B", async () => {
  const result = await requestDetail(STAFF_A, STAFF_B.id);
  const loadedPrivateReport = result.db.queries.some((query) => query.includes("r.detail"));

  assert.equal(result.status, 403);
  assert.equal(result.body.error.code, "FORBIDDEN");
  assert.equal(loadedPrivateReport, false);
});

test("staff A cannot see unassigned report detail", async () => {
  const result = await requestDetail(STAFF_A, null);

  assert.equal(result.status, 403);
  assert.equal(result.body.error.code, "FORBIDDEN");
});

test("staff report list is filtered by session user id", async () => {
  const result = await requestList(STAFF_A);
  const sql = result.db.queries.join("\n");
  const flattenedBinds = result.db.binds.flat();

  assert.equal(result.status, 200);
  assert.equal(sql.includes("r.assigned_to = ?"), true);
  assert.equal(flattenedBinds.includes(STAFF_A.id), true);
});

test("admin report list is not filtered by assigned_to", async () => {
  const result = await requestList(ADMIN);
  const sql = result.db.queries.join("\n");

  assert.equal(result.status, 200);
  assert.equal(sql.includes("r.assigned_to = ?"), false);
});

test("staff A cannot update status for staff B report", async () => {
  const result = await requestStatus(STAFF_A, STAFF_B.id);

  assert.equal(result.status, 403);
  assert.equal(result.body.error.code, "FORBIDDEN");
  assert.equal(result.db.batches.length, 0);
});

test("staff cannot spoof assigned_to in request body", async () => {
  const result = await requestStatus(STAFF_A, STAFF_B.id, {
    assigned_to: STAFF_A.id,
    user_id: STAFF_A.id,
  });

  assert.equal(result.status, 403);
  assert.equal(result.body.error.code, "FORBIDDEN");
  assert.equal(result.db.batches.length, 0);
});

test("staff A cannot add update for staff B report", async () => {
  const result = await requestUpdate(STAFF_A, STAFF_B.id);

  assert.equal(result.status, 403);
  assert.equal(result.body.error.code, "FORBIDDEN");
  assert.equal(result.db.batches.length, 0);
});

test("admin can see report detail assigned to staff A, staff B, and unassigned", async () => {
  const staffAReport = await requestDetail(ADMIN, STAFF_A.id);
  const staffBReport = await requestDetail(ADMIN, STAFF_B.id);
  const unassignedReport = await requestDetail(ADMIN, null);

  assert.equal(staffAReport.status, 200);
  assert.equal(staffBReport.status, 200);
  assert.equal(unassignedReport.status, 200);
});

test("viewer does not receive staff permissions", async () => {
  const result = await requestDetail(VIEWER, STAFF_A.id);

  assert.equal(result.status, 200);
  assert.equal(result.body.data.permissions.can_view_private, false);
  assert.equal(result.body.data.permissions.can_update_status, false);
  assert.equal(result.body.data.permissions.can_add_update, false);
  assert.equal(result.body.data.permissions.can_assign, false);
  assert.equal(result.body.data.permissions.can_publish, false);
});

test("guest receives 401", async () => {
  const detail = await requestDetail(null, STAFF_A.id);
  const list = await requestList(null);
  const status = await requestStatus(null, STAFF_A.id);

  assert.equal(detail.status, 401);
  assert.equal(list.status, 401);
  assert.equal(status.status, 401);
});

test("staff cannot assign reports to themselves or others", async () => {
  const response = await onAssignmentCreate({
    request: new Request("https://example.test/api/admin/reports/7/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: STAFF_A.id }),
    }),
    env: { DB: createDetailDbMock({ assignedTo: STAFF_A.id }) },
    params: { id: "7" },
    data: { user: STAFF_A },
  });
  const body = await response.json();

  assert.equal(response.status, 403);
  assert.equal(body.error.code, "FORBIDDEN");
});
