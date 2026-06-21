import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  clearSessionCookie,
  createSignedSession,
  hashPassword,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  sessionCookie,
  verifyPassword,
  verifySessionToken,
} from "../functions/api/_utils/auth.js";
import { onRequest as onLogin } from "../functions/api/auth/login.js";
import { onRequest as onLogout } from "../functions/api/auth/logout.js";
import { onRequest as onMe } from "../functions/api/auth/me.js";

const SESSION_SECRET = "0123456789abcdef0123456789abcdef";
const WRONG_SESSION_SECRET = "abcdef0123456789abcdef0123456789";
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

async function createTokenFromPayload(payload, secret = SESSION_SECRET) {
  const payloadText = bytesToBase64Url(textEncoder.encode(JSON.stringify(payload)));
  const signature = await signPayload(payloadText, secret);

  return `${payloadText}.${signature}`;
}

function parseCookieParts(cookieValue) {
  return String(cookieValue || "").split(";").map((part) => part.trim());
}

function createAuthDbMock(user) {
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

function createEnv(user, secret = SESSION_SECRET, db = createAuthDbMock(user)) {
  return {
    SESSION_SECRET: secret,
    DB: db,
  };
}

async function loginRequest(body, user, env = createEnv(user)) {
  const response = await onLogin({
    request: new Request("https://example.test/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    env,
  });
  const payload = await response.json();

  return { response, payload };
}

async function meRequest(cookieHeader, user, secret = SESSION_SECRET) {
  const response = await onMe({
    request: new Request("https://example.test/api/auth/me", {
      method: "GET",
      headers: cookieHeader ? { Cookie: cookieHeader } : {},
    }),
    env: createEnv(user, secret),
  });
  const payload = await response.json();

  return { response, payload };
}

test("session helper creates and verifies current token format", async () => {
  const user = { id: 1 };
  const token = await createSignedSession(user, createEnv(null));
  const parts = token.split(".");
  const session = await verifySessionToken(token, createEnv(null));

  assert.equal(parts.length, 2);
  assert.equal(session.uid, user.id);
  assert.equal(typeof session.sid, "string");
  assert.equal(Number.isInteger(session.iat), true);
  assert.equal(session.exp - session.iat, SESSION_MAX_AGE_SECONDS);
});

test("session helper rejects tampered token", async () => {
  const token = await createSignedSession({ id: 1 }, createEnv(null));
  const tampered = `${token.slice(0, -1)}x`;

  assert.equal(await verifySessionToken(tampered, createEnv(null)), null);
});

test("session helper rejects token signed with wrong secret", async () => {
  const now = Math.floor(Date.now() / 1000);
  const token = await createTokenFromPayload({
    uid: 1,
    sid: "test-session",
    iat: now,
    exp: now + SESSION_MAX_AGE_SECONDS,
  });

  assert.equal(
    await verifySessionToken(token, createEnv(null, WRONG_SESSION_SECRET)),
    null
  );
});

test("session helper rejects expired token", async () => {
  const now = Math.floor(Date.now() / 1000);
  const token = await createTokenFromPayload({
    uid: 1,
    sid: "test-session",
    iat: now - SESSION_MAX_AGE_SECONDS - 10,
    exp: now - 1,
  });

  assert.equal(await verifySessionToken(token, createEnv(null)), null);
});

test("session helper rejects malformed token", async () => {
  assert.equal(await verifySessionToken("not-a-session-token", createEnv(null)), null);
  assert.equal(await verifySessionToken("a.b.c", createEnv(null)), null);
  assert.equal(await verifySessionToken("", createEnv(null)), null);
});

test("hashPassword creates PBKDF2-SHA256 hash with 100000 iterations", async () => {
  const storedHash = await hashPassword("correct-password");
  const parts = storedHash.split("$");

  assert.equal(parts.length, 4);
  assert.equal(parts[0], "pbkdf2-sha256");
  assert.equal(parts[1], "100000");
});

test("verifyPassword accepts a valid 100000 iteration hash", async () => {
  const storedHash = await hashPassword("correct-password");

  assert.equal(await verifyPassword("correct-password", storedHash), true);
});

test("verifyPassword returns false for a wrong password", async () => {
  const storedHash = await hashPassword("correct-password");

  assert.equal(await verifyPassword("wrong-password", storedHash), false);
});

test("verifyPassword returns false for malformed stored hashes", async () => {
  assert.equal(await verifyPassword("correct-password", "not-a-valid-hash"), false);
  assert.equal(
    await verifyPassword("correct-password", "pbkdf2-sha256$99999$abc$def"),
    false
  );
});

test("temporary login diagnostics are removed from source", () => {
  const authSource = readFileSync("functions/api/_utils/auth.js", "utf8");
  const loginSource = readFileSync("functions/api/auth/login.js", "utf8");
  const combinedSource = `${authSource}\n${loginSource}`;

  assert.equal(combinedSource.includes("LOGIN_DIAG"), false);
  assert.equal(combinedSource.includes("diagnosePasswordVerification"), false);
  assert.equal(loginSource.includes("console.log("), false);
  assert.equal(loginSource.includes("console.error("), false);
});

test("session cookie preserves existing login attributes", async () => {
  const cookie = sessionCookie("token-value");
  const parts = parseCookieParts(cookie);

  assert.equal(parts[0], `${SESSION_COOKIE_NAME}=token-value`);
  assert.ok(parts.includes("HttpOnly"));
  assert.ok(parts.includes("Secure"));
  assert.ok(parts.includes("SameSite=Lax"));
  assert.ok(parts.includes("Path=/"));
  assert.ok(parts.includes(`Max-Age=${SESSION_MAX_AGE_SECONDS}`));
});

test("clear session cookie preserves existing logout attributes", async () => {
  const cookie = clearSessionCookie();
  const parts = parseCookieParts(cookie);

  assert.equal(parts[0], `${SESSION_COOKIE_NAME}=`);
  assert.ok(parts.includes("HttpOnly"));
  assert.ok(parts.includes("Secure"));
  assert.ok(parts.includes("SameSite=Lax"));
  assert.ok(parts.includes("Path=/"));
  assert.ok(parts.includes("Max-Age=0"));
});

test("login succeeds and returns current response shape and cookie", async () => {
  const storedHash = await hashPassword("correct-password");
  const user = {
    id: 1,
    name: "Admin",
    username: "admin",
    role: "admin",
    password_hash: storedHash,
  };
  const { response, payload } = await loginRequest(
    { username: "admin", password: "correct-password" },
    user
  );
  const cookie = response.headers.get("Set-Cookie");
  const session = await verifySessionToken(
    cookie.split(";")[0].slice(`${SESSION_COOKIE_NAME}=`.length),
    createEnv(null)
  );

  assert.equal(response.status, 200);
  assert.deepEqual(payload, {
    ok: true,
    data: {
      user: {
        id: 1,
        name: "Admin",
        role: "admin",
      },
    },
    message: "เข้าสู่ระบบสำเร็จ",
  });
  assert.ok(cookie.includes(`${SESSION_COOKIE_NAME}=`));
  assert.ok(cookie.includes("HttpOnly"));
  assert.ok(cookie.includes("Secure"));
  assert.ok(cookie.includes("SameSite=Lax"));
  assert.ok(cookie.includes("Path=/"));
  assert.ok(cookie.includes("Max-Age=604800"));
  assert.equal(session.uid, 1);
});

test("login rejects wrong username or password with current status and code", async () => {
  const storedHash = await hashPassword("correct-password");
  const user = {
    id: 1,
    name: "Admin",
    username: "admin",
    role: "admin",
    password_hash: storedHash,
  };
  const wrongPassword = await loginRequest(
    { username: "admin", password: "wrong-password" },
    user
  );
  const missingUser = await loginRequest(
    { username: "missing", password: "correct-password" },
    null
  );

  assert.equal(wrongPassword.response.status, 401);
  assert.equal(wrongPassword.payload.error.code, "LOGIN_FAILED");
  assert.equal(missingUser.response.status, 401);
  assert.equal(missingUser.payload.error.code, "LOGIN_FAILED");
});

test("login treats inactive user lookup miss as login failure", async () => {
  const result = await loginRequest(
    { username: "inactive", password: "password" },
    null
  );

  assert.equal(result.response.status, 401);
  assert.equal(result.payload.error.code, "LOGIN_FAILED");
});

test("login exception returns 500 with current response shape", async () => {
  const db = {
    prepare() {
      throw new TypeError("D1 prepare failed");
    },
  };
  const result = await loginRequest(
    { username: "admin", password: "correct-password" },
    null,
    createEnv(null, SESSION_SECRET, db)
  );

  assert.equal(result.response.status, 500);
  assert.equal(result.payload.error.code, "SERVER_ERROR");
});

test("super_admin can log in and receives existing session cookie shape", async () => {
  const storedHash = await hashPassword("correct-password");
  const user = {
    id: 2,
    name: "Super Admin",
    username: "admin",
    role: "super_admin",
    password_hash: storedHash,
  };
  const result = await loginRequest(
    { username: "admin", password: "correct-password" },
    user
  );
  const cookie = result.response.headers.get("Set-Cookie");

  assert.equal(result.response.status, 200);
  assert.equal(result.payload.data.user.role, "super_admin");
  assert.ok(cookie.includes(`${SESSION_COOKIE_NAME}=`));
  assert.ok(cookie.includes("HttpOnly"));
  assert.ok(cookie.includes("Secure"));
  assert.ok(cookie.includes("SameSite=Lax"));
  assert.ok(cookie.includes("Path=/"));
  assert.ok(cookie.includes("Max-Age=604800"));
});

test("me returns current user shape when session is valid", async () => {
  const token = await createSignedSession({ id: 1 }, createEnv(null));
  const user = { id: 1, name: "Admin", role: "admin" };
  const { response, payload } = await meRequest(
    `${SESSION_COOKIE_NAME}=${token}`,
    user
  );

  assert.equal(response.status, 200);
  assert.deepEqual(payload, {
    ok: true,
    data: {
      user,
    },
    message: "success",
  });
});

test("me returns 401 when cookie is missing or expired", async () => {
  const now = Math.floor(Date.now() / 1000);
  const expiredToken = await createTokenFromPayload({
    uid: 1,
    sid: "test-session",
    iat: now - SESSION_MAX_AGE_SECONDS - 10,
    exp: now - 1,
  });
  const missingCookie = await meRequest("", null);
  const expiredCookie = await meRequest(`${SESSION_COOKIE_NAME}=${expiredToken}`, null);

  assert.equal(missingCookie.response.status, 401);
  assert.equal(missingCookie.payload.error.code, "UNAUTHORIZED");
  assert.equal(expiredCookie.response.status, 401);
  assert.equal(expiredCookie.payload.error.code, "UNAUTHORIZED");
});

test("logout returns current response shape and clear cookie", async () => {
  const response = await onLogout({
    request: new Request("https://example.test/api/auth/logout", {
      method: "POST",
    }),
  });
  const payload = await response.json();
  const cookie = response.headers.get("Set-Cookie");

  assert.equal(response.status, 200);
  assert.deepEqual(payload, {
    ok: true,
    data: {},
    message: "ออกจากระบบสำเร็จ",
  });
  assert.equal(cookie, clearSessionCookie());
});
