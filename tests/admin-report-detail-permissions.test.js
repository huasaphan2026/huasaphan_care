import assert from "node:assert/strict";
import test from "node:test";

import { onRequest } from "../functions/api/admin/reports/[id].js";

const FULL_REPORT = {
  id: 7,
  tracking_code: "HSC-2026-0007",
  category_id: 2,
  title: "Broken light near private home",
  detail: "Caller says the light is out in front of house 12/3.",
  location_text: "House 12/3, private lane",
  location_lat: 8.123456,
  location_lng: 99.654321,
  priority: "urgent",
  status: "in_progress",
  anonymous: 1,
  reporter_name: "Private Reporter",
  reporter_phone: "0812345678",
  assigned_to: 4,
  public_visible: 0,
  public_summary: "Light repair is being coordinated.",
  public_location_label: "Main community road",
  public_image_allowed: 0,
  created_at: "2026-06-20T08:00:00.000Z",
  updated_at: "2026-06-20T09:00:00.000Z",
  closed_at: null,
  category_code: "lighting",
  category_name: "Lighting",
  category_description: "Street and public lighting",
  category_default_priority: "normal",
  category_active: 1,
  category_sort_order: 2,
  assigned_name: "Assigned Staff",
};

const VIEWER_REPORT = {
  id: 7,
  tracking_code: FULL_REPORT.tracking_code,
  priority: FULL_REPORT.priority,
  status: FULL_REPORT.status,
  public_summary: FULL_REPORT.public_summary,
  public_location_label: FULL_REPORT.public_location_label,
  created_at: FULL_REPORT.created_at,
  updated_at: FULL_REPORT.updated_at,
  closed_at: FULL_REPORT.closed_at,
  category_name: FULL_REPORT.category_name,
};

const PRIVATE_TIMELINE = [
  {
    id: 1,
    status: "new",
    update_note: "Initial public update",
    updated_by: 1,
    is_public: 1,
    created_at: "2026-06-20T08:01:00.000Z",
    updated_by_name: "Admin User",
    updated_by_role: "admin",
  },
  {
    id: 2,
    status: "checking",
    update_note: "Internal note with house 12/3 and phone 0812345678",
    updated_by: 1,
    is_public: 0,
    created_at: "2026-06-20T08:30:00.000Z",
    updated_by_name: "Admin User",
    updated_by_role: "admin",
  },
];

const VIEWER_TIMELINE = [
  {
    status: "new",
    update_note: "Initial public update",
    created_at: "2026-06-20T08:01:00.000Z",
  },
];

function createDbMock({ report = FULL_REPORT, viewerReport = VIEWER_REPORT } = {}) {
  const queries = [];

  return {
    queries,
    prepare(sql) {
      queries.push(sql);

      return {
        bind() {
          return {
            async first() {
              if (!sql.includes("FROM reports r")) {
                return null;
              }

              if (sql.includes("r.detail")) {
                return report;
              }

              return viewerReport;
            },
            async all() {
              if (sql.includes("FROM report_updates")) {
                if (sql.includes("updated_by")) {
                  return { results: PRIVATE_TIMELINE };
                }
                return { results: VIEWER_TIMELINE };
              }

              if (sql.includes("FROM assignments")) {
                return {
                  results: [
                    {
                      id: 3,
                      report_id: 7,
                      user_id: 4,
                      assigned_by: 1,
                      due_date: "2026-06-25",
                      note: "Assignment note",
                      created_at: "2026-06-20T08:20:00.000Z",
                      assigned_name: "Assigned Staff",
                      assigned_role: "staff",
                      assigned_by_name: "Admin User",
                    },
                  ],
                };
              }

              if (sql.includes("FROM attachments")) {
                return {
                  results: [
                    {
                      id: 9,
                      report_id: 7,
                      r2_key: "reports/2026/HSC-2026-0007/private.webp",
                      file_name: "private-photo.webp",
                      file_type: "image/webp",
                      file_size: 500000,
                      purpose: "before",
                      public_allowed: 0,
                      uploaded_by: 1,
                      uploaded_at: "2026-06-20T08:10:00.000Z",
                      uploaded_by_name: "Admin User",
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

async function requestDetail(user, db = createDbMock()) {
  const response = await onRequest({
    request: new Request("https://example.test/api/admin/reports/7"),
    env: { DB: db },
    params: { id: "7" },
    data: user ? { user } : {},
  });
  const body = await response.json();

  return {
    status: response.status,
    body,
    db,
  };
}

test("admin sees full report fields needed for case handling", async () => {
  const result = await requestDetail({ id: 1, role: "admin", name: "Admin" });

  assert.equal(result.status, 200);
  assert.equal(result.body.data.report.detail, FULL_REPORT.detail);
  assert.equal(result.body.data.report.location_text, FULL_REPORT.location_text);
  assert.equal(result.body.data.report.location_lat, FULL_REPORT.location_lat);
  assert.equal(result.body.data.report.assigned_to, FULL_REPORT.assigned_to);
  assert.equal(result.body.data.reporter.phone, FULL_REPORT.reporter_phone);
  assert.equal(result.body.data.timeline[1].updated_by_name, "Admin User");
  assert.equal(result.body.data.assignments[0].user_id, 4);
  assert.equal(result.body.data.attachments[0].r2_key.includes("private.webp"), true);
});

test("viewer sees only summary fields", async () => {
  const result = await requestDetail({ id: 2, role: "viewer", name: "Viewer" });

  assert.equal(result.status, 200);
  assert.deepEqual(result.body.data.report, {
    tracking_code: FULL_REPORT.tracking_code,
    priority: FULL_REPORT.priority,
    status: FULL_REPORT.status,
    public_summary: FULL_REPORT.public_summary,
    public_location_label: FULL_REPORT.public_location_label,
    created_at: FULL_REPORT.created_at,
    updated_at: FULL_REPORT.updated_at,
    closed_at: FULL_REPORT.closed_at,
  });
  assert.deepEqual(result.body.data.category, { name: FULL_REPORT.category_name });
  assert.deepEqual(result.body.data.reporter, { masked: true });
  assert.deepEqual(result.body.data.assignments, []);
  assert.deepEqual(result.body.data.attachments, []);
  assert.deepEqual(result.body.data.timeline, [
    {
      status: "new",
      update_note: "Initial public update",
      is_public: true,
      created_at: "2026-06-20T08:01:00.000Z",
    },
  ]);
});

test("viewer JSON does not contain sensitive keys or values", async () => {
  const result = await requestDetail({ id: 2, role: "viewer", name: "Viewer" });
  const text = JSON.stringify(result.body);
  const forbiddenTokens = [
    "reporter_name",
    "reporter_phone",
    "Private Reporter",
    "0812345678",
    "location_lat",
    "location_lng",
    "location_text",
    "House 12/3",
    "\"detail\"",
    "Caller says",
    "\"anonymous\"",
    "assigned_to",
    "assigned_name",
    "updated_by",
    "updated_by_name",
    "updated_by_role",
    "Internal note",
    "r2_key",
    "private-photo.webp",
    "\"user_id\"",
    "assigned_by",
  ];

  forbiddenTokens.forEach((token) => {
    assert.equal(text.includes(token), false, `viewer response leaked ${token}`);
  });
});

test("viewer query does not select forbidden report columns", async () => {
  const result = await requestDetail({ id: 2, role: "viewer", name: "Viewer" });
  const reportQueries = result.db.queries.filter((query) => query.includes("FROM reports r"));
  const combinedReportSql = reportQueries.join("\n");

  assert.equal(result.status, 200);
  assert.equal(combinedReportSql.includes("r.detail"), false);
  assert.equal(combinedReportSql.includes("r.location_text"), false);
  assert.equal(combinedReportSql.includes("r.reporter_name"), false);
  assert.equal(combinedReportSql.includes("r.reporter_phone"), false);
  assert.equal(combinedReportSql.includes("r.anonymous"), false);
  assert.equal(combinedReportSql.includes("r.assigned_to"), false);
});

test("unknown role is rejected", async () => {
  const db = createDbMock();
  const result = await requestDetail({ id: 3, role: "auditor", name: "Auditor" }, db);

  assert.equal(result.status, 403);
  assert.equal(result.body.error.code, "FORBIDDEN");
  assert.equal(db.queries.length, 0);
});

test("unauthenticated request returns 401", async () => {
  const db = createDbMock();
  const result = await requestDetail(null, db);

  assert.equal(result.status, 401);
  assert.equal(result.body.error.code, "UNAUTHORIZED");
  assert.equal(db.queries.length, 0);
});
