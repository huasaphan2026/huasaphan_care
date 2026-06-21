import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

import { onRequest } from "../functions/api/admin/dashboard.js";

const ADMIN = { id: 1, name: "Admin", role: "admin" };
const STAFF_A = { id: 11, name: "Staff A", role: "staff" };
const VIEWER = { id: 22, name: "Viewer", role: "viewer" };

function createDbMock() {
  const queries = [];
  const binds = [];

  return {
    queries,
    binds,
    prepare(sql) {
      queries.push(sql);

      return {
        bind(...args) {
          binds.push(args);
          return createStatementResult(sql);
        },
        ...createStatementResult(sql),
      };
    },
  };
}

function createStatementResult(sql) {
  return {
    async first() {
      if (!sql.includes("COUNT(*) AS total_reports")) {
        return null;
      }

      if (sql.includes("assigned_to = ?")) {
        return {
          total_reports: 2,
          new_reports: 1,
          urgent_reports: 1,
          in_progress_reports: 1,
          resolved_reports: 0,
          closed_reports: 0,
        };
      }

      if (sql.includes("public_visible = ?")) {
        return {
          total_reports: 1,
          new_reports: 0,
          urgent_reports: 0,
          in_progress_reports: 0,
          resolved_reports: 1,
          closed_reports: 0,
        };
      }

      return {
        total_reports: 4,
        new_reports: 1,
        urgent_reports: 2,
        in_progress_reports: 2,
        resolved_reports: 1,
        closed_reports: 0,
      };
    },
    async all() {
      if (sql.includes("SELECT status, COUNT(*) AS total")) {
        return {
          results: sql.includes("assigned_to = ?")
            ? [{ status: "in_progress", total: 1 }, { status: "new", total: 1 }]
            : [{ status: "in_progress", total: 2 }, { status: "resolved", total: 1 }],
        };
      }

      if (sql.includes("FROM categories c")) {
        return {
          results: [
            {
              category_id: 2,
              category_code: "lighting",
              category_name: "Lighting",
              total: sql.includes("assigned_to = ?") || sql.includes("public_visible = ?") ? 1 : 3,
            },
          ],
        };
      }

      if (sql.includes("FROM reports r") && sql.includes("LIMIT ?")) {
        return {
          results: [
            {
              id: 7,
              tracking_code: "HSC-2026-0007",
              title: "Staff A assigned report",
              category_name: "Lighting",
              priority: "urgent",
              status: "in_progress",
              created_at: "2026-06-20T08:00:00.000Z",
              updated_at: "2026-06-20T09:00:00.000Z",
            },
          ],
        };
      }

      return { results: [] };
    },
  };
}

async function requestDashboard(user) {
  const db = createDbMock();
  const response = await onRequest({
    request: new Request("https://example.test/api/admin/dashboard"),
    env: { DB: db },
    data: user ? { user } : {},
  });
  const body = await response.json();

  return { status: response.status, body, db };
}

test("admin dashboard aggregate uses all reports", async () => {
  const result = await requestDashboard(ADMIN);
  const sql = result.db.queries.join("\n");

  assert.equal(result.status, 200);
  assert.equal(result.body.data.total_reports, 4);
  assert.equal(result.body.data.urgent_reports, 2);
  assert.equal(result.body.data.permissions.scope, "all");
  assert.equal(sql.includes("assigned_to = ?"), false);
  assert.equal(sql.includes("public_visible = ?"), false);
});

test("staff dashboard aggregate is scoped to assigned reports", async () => {
  const result = await requestDashboard(STAFF_A);
  const sql = result.db.queries.join("\n");
  const flattenedBinds = result.db.binds.flat();

  assert.equal(result.status, 200);
  assert.equal(result.body.data.total_reports, 2);
  assert.equal(result.body.data.permissions.scope, "assigned");
  assert.equal(sql.includes("WHERE assigned_to = ?"), true);
  assert.equal(sql.includes("r.assigned_to = ?"), true);
  assert.equal(flattenedBinds.includes(STAFF_A.id), true);
});

test("staff latest reports are scoped to the session user", async () => {
  const result = await requestDashboard(STAFF_A);
  const latestSql = result.db.queries.find((query) => query.includes("FROM reports r") && query.includes("LIMIT ?"));

  assert.equal(result.status, 200);
  assert.equal(latestSql.includes("WHERE r.assigned_to = ?"), true);
  assert.equal(result.body.data.latest_reports.length, 1);
  assert.equal(result.body.data.latest_reports[0].title, "Staff A assigned report");
});

test("staff dashboard does not query unassigned reports or staff B reports", async () => {
  const result = await requestDashboard(STAFF_A);
  const sql = result.db.queries.join("\n");
  const text = JSON.stringify(result.body);

  assert.equal(result.status, 200);
  assert.equal(sql.includes("assigned_to IS NULL"), false);
  assert.equal(sql.includes("assigned_to != ?"), false);
  assert.equal(text.includes("Staff B"), false);
  assert.equal(text.includes("unassigned"), false);
});

test("viewer dashboard returns public aggregate without personal data", async () => {
  const result = await requestDashboard(VIEWER);

  assert.equal(result.status, 200);
  assert.equal(result.body.data.total_reports, 1);
  assert.equal(result.body.data.permissions.scope, "public");
  assert.equal(result.body.data.permissions.can_view_latest_reports, false);
  assert.deepEqual(result.body.data.latest_reports, []);
});

test("viewer dashboard does not query private latest reports", async () => {
  const result = await requestDashboard(VIEWER);
  const sql = result.db.queries.join("\n");

  assert.equal(result.status, 200);
  assert.equal(sql.includes("r.title"), false);
  assert.equal(sql.includes("FROM reports r") && sql.includes("LIMIT ?"), false);
  assert.equal(sql.includes("public_visible = ?"), true);
});

test("viewer dashboard response has no forbidden keys", async () => {
  const result = await requestDashboard(VIEWER);
  const text = JSON.stringify(result.body);
  const forbiddenTokens = [
    "location_text",
    "location_lat",
    "location_lng",
    "reporter_name",
    "reporter_phone",
    "\"detail\"",
    "assigned_to",
    "assigned_name",
    "internal",
    "private",
    "r2_key",
    "Staff A assigned report",
  ];

  forbiddenTokens.forEach((token) => {
    assert.equal(text.includes(token), false, `viewer dashboard leaked ${token}`);
  });
});

test("unknown dashboard role is rejected before queries", async () => {
  const result = await requestDashboard({ id: 99, name: "Auditor", role: "auditor" });

  assert.equal(result.status, 403);
  assert.equal(result.body.error.code, "FORBIDDEN");
  assert.equal(result.db.queries.length, 0);
});

test("guest dashboard request returns 401 before queries", async () => {
  const result = await requestDashboard(null);

  assert.equal(result.status, 401);
  assert.equal(result.body.error.code, "UNAUTHORIZED");
  assert.equal(result.db.queries.length, 0);
});

class FakeElement {
  constructor(tagName = "div") {
    this.tagName = tagName;
    this.children = [];
    this.dataset = {};
    this.hidden = false;
    this.disabled = false;
    this.attributes = {};
    this.className = "";
    this.textContent = "";
    this.classList = {
      values: [],
      add: (value) => {
        this.classList.values.push(value);
      },
    };
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  addEventListener() {}
}

function createDashboardDom() {
  const elements = {
    "dashboard-status": new FakeElement(),
    "latest-section": new FakeElement("section"),
    "latest-reports": new FakeElement("ul"),
    "latest-empty": new FakeElement(),
    "dashboard-scope-label": new FakeElement(),
    "dashboard-scope-copy": new FakeElement(),
    "latest-scope-label": new FakeElement(),
    "latest-scope-copy": new FakeElement(),
    "logout-button": new FakeElement("button"),
  };
  const summaries = {
    new_reports: new FakeElement("h2"),
    urgent_reports: new FakeElement("h2"),
    in_progress_reports: new FakeElement("h2"),
    resolved_reports: new FakeElement("h2"),
  };
  const total = new FakeElement("span");

  return {
    elements,
    summaries,
    total,
    document: {
      getElementById(id) {
        return elements[id] || null;
      },
      createElement(tagName) {
        return new FakeElement(tagName);
      },
      querySelector(selector) {
        const summaryMatch = selector.match(/^\[data-summary="([^"]+)"\]$/);
        if (summaryMatch) {
          return summaries[summaryMatch[1]] || null;
        }

        if (selector === "[data-total-reports]") {
          return total;
        }

        return null;
      },
    },
  };
}

async function runDashboardScript(data, status = 200) {
  const dom = createDashboardDom();
  const source = readFileSync("public/js/admin-dashboard.js", "utf8");
  const context = {
    Intl,
    console,
    document: dom.document,
    window: {
      location: {
        replacedWith: "",
        replace(value) {
          this.replacedWith = value;
        },
      },
    },
    fetch: async () => ({
      status,
      ok: status >= 200 && status < 300,
      async json() {
        return status >= 200 && status < 300 ? { ok: true, data } : { ok: false };
      },
    }),
  };

  vm.runInNewContext(source, context);
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));

  return dom;
}

test("frontend labels staff dashboard as assigned scope", async () => {
  const dom = await runDashboardScript({
    total_reports: 2,
    new_reports: 1,
    urgent_reports: 1,
    in_progress_reports: 1,
    resolved_reports: 0,
    latest_reports: [
      {
        title: "Staff work",
        tracking_code: "HSC-2026-0007",
        category_name: "Lighting",
        priority: "urgent",
        status: "in_progress",
        created_at: "2026-06-20T08:00:00.000Z",
      },
    ],
    permissions: {
      scope: "assigned",
      can_view_latest_reports: true,
    },
  });

  assert.match(dom.elements["dashboard-scope-label"].textContent, /งานที่ได้รับมอบหมาย/);
  assert.match(dom.elements["latest-scope-label"].textContent, /งานที่ได้รับมอบหมาย 2 เรื่อง/);
  assert.equal(dom.elements["latest-section"].hidden, false);
  assert.equal(dom.elements["latest-reports"].children.length, 1);
});

test("frontend hides latest reports for viewer public scope", async () => {
  const dom = await runDashboardScript({
    total_reports: 1,
    new_reports: 0,
    urgent_reports: 0,
    in_progress_reports: 0,
    resolved_reports: 1,
    latest_reports: [],
    permissions: {
      scope: "public",
      can_view_latest_reports: false,
    },
  });

  assert.match(dom.elements["dashboard-scope-label"].textContent, /รายงานสาธารณะ/);
  assert.equal(dom.elements["latest-section"].hidden, true);
  assert.equal(dom.elements["latest-reports"].children.length, 0);
  assert.equal(dom.elements["dashboard-status"].textContent, "");
});
