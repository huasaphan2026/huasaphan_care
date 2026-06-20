import assert from "node:assert/strict";
import test from "node:test";

import { onRequest } from "../functions/api/reports/track.js";

const BASE_REPORT = {
  id: 1,
  tracking_code: "HSC-2026-0001",
  title: "ไฟทางเสีย",
  status: "new",
  priority: "normal",
  public_location_label: "ถนนหน้าศาลาชุมชน",
  created_at: "2026-06-20T10:00:00.000Z",
  updated_at: "2026-06-20T10:00:00.000Z",
  category_name: "ไฟฟ้า / ไฟทาง",
};

function createDbMock({ report = BASE_REPORT, updates = [] } = {}) {
  const queries = [];

  return {
    queries,
    prepare(sql) {
      queries.push(sql);

      return {
        bind() {
          return {
            async first() {
              if (sql.includes("FROM reports")) {
                return report;
              }

              return null;
            },
            async all() {
              if (sql.includes("FROM report_updates")) {
                return { results: updates };
              }

              return { results: [] };
            },
          };
        },
      };
    },
  };
}

async function requestTrack(code, db) {
  const request = new Request(`https://example.test/api/reports/track?code=${encodeURIComponent(code)}`);
  const response = await onRequest({
    request,
    env: {
      DB: db,
    },
  });
  const body = await response.json();

  return {
    status: response.status,
    body,
  };
}

test("uses non-empty public_location_label", async () => {
  const db = createDbMock();
  const result = await requestTrack("HSC-2026-0001", db);

  assert.equal(result.status, 200);
  assert.equal(result.body.data.location_text, "ถนนหน้าศาลาชุมชน");
});

test("uses default public location when public_location_label is missing", async () => {
  const db = createDbMock({
    report: {
      ...BASE_REPORT,
      public_location_label: null,
      location_text: "บ้านเลขที่ 12/3 ซอยส่วนตัว",
    },
  });
  const result = await requestTrack("HSC-2026-0001", db);

  assert.equal(result.status, 200);
  assert.equal(result.body.data.location_text, "พื้นที่บ้านหัวสะพาน");
});

test("uses default public location when public_location_label is blank", async () => {
  const db = createDbMock({
    report: {
      ...BASE_REPORT,
      public_location_label: "     ",
      location_text: "บ้านเลขที่ 99/1 ใกล้ประตูสีแดง",
    },
  });
  const result = await requestTrack("HSC-2026-0001", db);

  assert.equal(result.status, 200);
  assert.equal(result.body.data.location_text, "พื้นที่บ้านหัวสะพาน");
});

test("does not expose original location_text when it contains a house number", async () => {
  const db = createDbMock({
    report: {
      ...BASE_REPORT,
      public_location_label: "",
      location_text: "บ้านเลขที่ 88/8 หลังร้านค้า",
    },
  });
  const result = await requestTrack("HSC-2026-0001", db);

  assert.equal(result.status, 200);
  assert.equal(result.body.data.location_text, "พื้นที่บ้านหัวสะพาน");
  assert.ok(!JSON.stringify(result.body).includes("88/8"));
  assert.ok(db.queries.every((query) => !query.includes("r.location_text")));
});

test("rejects invalid tracking code", async () => {
  const db = createDbMock();
  const result = await requestTrack("bad-code", db);

  assert.equal(result.status, 400);
  assert.equal(result.body.error.code, "TRACKING_CODE_INVALID");
  assert.equal(db.queries.length, 0);
});

test("returns 404 when report is not found", async () => {
  const db = createDbMock({
    report: null,
  });
  const result = await requestTrack("HSC-2026-9999", db);

  assert.equal(result.status, 404);
  assert.equal(result.body.error.code, "TRACKING_NOT_FOUND");
});
