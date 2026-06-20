import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

function loadLoginScript(search) {
  const source = readFileSync("public/js/admin-login.js", "utf8");
  const context = {
    URL,
    URLSearchParams,
    document: {
      addEventListener() {},
    },
    window: {
      location: {
        origin: "https://huasaphan-care.pages.dev",
        search,
      },
    },
  };

  vm.runInNewContext(source, context);

  return context;
}

test("admin login accepts safe internal return path", () => {
  const context = loadLoginScript("?return=%2Fadmin%2Freports.html");

  assert.equal(context.getSafeReturnPath(), "/admin/reports.html");
});

test("admin login preserves query string for safe internal return path", () => {
  const context = loadLoginScript("?return=%2Fadmin%2Freport-detail.html%3Fid%3D12");

  assert.equal(context.getSafeReturnPath(), "/admin/report-detail.html?id=12");
});

test("admin login rejects external return path", () => {
  const context = loadLoginScript("?return=https%3A%2F%2Fevil.example%2F");

  assert.equal(context.getSafeReturnPath(), "/admin/dashboard.html");
});

test("admin login rejects protocol-relative external return path", () => {
  const context = loadLoginScript("?return=%2F%2Fevil.example");

  assert.equal(context.getSafeReturnPath(), "/admin/dashboard.html");
});

test("admin login rejects backslash return path", () => {
  const context = loadLoginScript("?return=%2F%5Cevil.example");

  assert.equal(context.getSafeReturnPath(), "/admin/dashboard.html");
});

test("admin login rejects /admin/login return path", () => {
  const context = loadLoginScript("?return=%2Fadmin%2Flogin");

  assert.equal(context.getSafeReturnPath(), "/admin/dashboard.html");
});

test("admin login rejects login page return path", () => {
  const context = loadLoginScript("?return=%2Fadmin%2Flogin.html");

  assert.equal(context.getSafeReturnPath(), "/admin/dashboard.html");
});

test("admin login rejects login page return path with nested return query", () => {
  const context = loadLoginScript("?return=%2Fadmin%2Flogin.html%3Freturn%3D%252Fadmin%252Freports.html");

  assert.equal(context.getSafeReturnPath(), "/admin/dashboard.html");
});

test("admin login rejects same-origin URL with username", () => {
  const context = loadLoginScript(
    "?return=https%3A%2F%2Fuser%40huasaphan-care.pages.dev%2Fadmin%2Freports.html"
  );

  assert.equal(context.getSafeReturnPath(), "/admin/dashboard.html");
});

test("admin login rejects same-origin URL with password", () => {
  const context = loadLoginScript(
    "?return=https%3A%2F%2Fuser%3Apass%40huasaphan-care.pages.dev%2Fadmin%2Freports.html"
  );

  assert.equal(context.getSafeReturnPath(), "/admin/dashboard.html");
});

test("admin login rejects path outside admin", () => {
  const context = loadLoginScript("?return=%2Ftrack.html%3Fcode%3DHSC-2026-0001");

  assert.equal(context.getSafeReturnPath(), "/admin/dashboard.html");
});

test("admin login rejects unparseable return path", () => {
  const context = loadLoginScript("?return=http%3A%2F%2F%5B%3A%3A1");

  assert.equal(context.getSafeReturnPath(), "/admin/dashboard.html");
});
