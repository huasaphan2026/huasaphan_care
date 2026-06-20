import assert from "node:assert/strict";
import test from "node:test";

import { onRequest } from "../functions/_middleware.js";

const SESSION_COOKIE_NAME = "hsc_session";
const SESSION_SECRET = "0123456789abcdef0123456789abcdef";
const textEncoder = new TextEncoder();

function bytesToBase64Url(bytes) {
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function signPayload(payloadText, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    textEncoder.encode(payloadText)
  );

  return bytesToBase64Url(new Uint8Array(signature));
}

async function createSessionToken(userId = 1) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    uid: userId,
    sid: "test-session",
    iat: now,
    exp: now + 3600,
  };
  const payloadText = bytesToBase64Url(textEncoder.encode(JSON.stringify(payload)));
  const signature = await signPayload(payloadText, SESSION_SECRET);

  return `${payloadText}.${signature}`;
}

function createDbMock(user = { id: 1, name: "Admin", role: "admin" }) {
  return {
    prepare() {
      return {
        bind() {
          return {
            async first() {
              return user;
            },
          };
        },
      };
    },
  };
}

function createContext(url, options = {}) {
  const headers = new Headers(options.headers || {});
  const request = new Request(url, {
    method: options.method || "GET",
    headers,
  });

  return {
    request,
    env: {
      SESSION_SECRET,
      DB: createDbMock(options.user),
    },
    data: {},
    nextCalled: false,
    next() {
      this.nextCalled = true;
      return new Response("next", { status: 299 });
    },
  };
}

async function runMiddleware(url, options) {
  const context = createContext(url, options);
  const response = await onRequest(context);

  return {
    context,
    response,
  };
}

test("guest can access admin login page", async () => {
  const { context, response } = await runMiddleware(
    "https://example.test/admin/login.html"
  );

  assert.equal(context.nextCalled, true);
  assert.equal(response.status, 299);
});

test("guest admin page request redirects to login", async () => {
  const { context, response } = await runMiddleware(
    "https://example.test/admin/dashboard.html"
  );
  const location = response.headers.get("Location");

  assert.equal(context.nextCalled, false);
  assert.equal(response.status, 303);
  assert.ok(location.startsWith("https://example.test/admin/login.html?"));
  assert.equal(new URL(location).searchParams.get("return"), "/admin/dashboard.html");
});

test("guest admin API request returns JSON 401", async () => {
  const { context, response } = await runMiddleware(
    "https://example.test/api/admin/dashboard"
  );
  const body = await response.json();

  assert.equal(context.nextCalled, false);
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("Content-Type").includes("application/json"), true);
  assert.equal(body.ok, false);
  assert.equal(body.error.code, "UNAUTHORIZED");
});

test("invalid session redirects admin page to login", async () => {
  const { response } = await runMiddleware(
    "https://example.test/admin/reports.html",
    {
      headers: {
        Cookie: `${SESSION_COOKIE_NAME}=invalid-token`,
      },
    }
  );

  assert.equal(response.status, 303);
  assert.ok(response.headers.get("Location").includes("/admin/login.html"));
});

test("valid session can access admin page", async () => {
  const token = await createSessionToken();
  const { context, response } = await runMiddleware(
    "https://example.test/admin/reports.html",
    {
      headers: {
        Cookie: `${SESSION_COOKIE_NAME}=${token}`,
      },
    }
  );

  assert.equal(context.nextCalled, true);
  assert.equal(response.status, 299);
  assert.deepEqual(context.data.user, {
    id: 1,
    name: "Admin",
    role: "admin",
  });
});

test("login assets outside /admin are not blocked", async () => {
  const css = await runMiddleware("https://example.test/css/style.css");
  const js = await runMiddleware("https://example.test/js/admin-login.js");

  assert.equal(css.context.nextCalled, true);
  assert.equal(css.response.status, 299);
  assert.equal(js.context.nextCalled, true);
  assert.equal(js.response.status, 299);
});

test("external return values on login page do not cause middleware redirect loop", async () => {
  const { context, response } = await runMiddleware(
    "https://example.test/admin/login.html?return=https://evil.test/admin"
  );

  assert.equal(context.nextCalled, true);
  assert.equal(response.status, 299);
});
