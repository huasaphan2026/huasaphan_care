import { jsonError } from "./api/_utils/response.js";

const SESSION_COOKIE_NAME = "hsc_session";
const SESSION_SECRET_MIN_LENGTH = 32;
const ADMIN_API_PREFIX = "/api/admin/";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function base64UrlToBytes(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function constantTimeEqual(left, right) {
  const maxLength = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;

  for (let index = 0; index < maxLength; index += 1) {
    diff |= (left[index] || 0) ^ (right[index] || 0);
  }

  return diff === 0;
}

function getCookie(request, name) {
  const cookieHeader = request.headers.get("Cookie") || "";
  const cookies = cookieHeader.split(";");

  for (const cookie of cookies) {
    const [rawName, ...rawValue] = cookie.trim().split("=");

    if (rawName === name) {
      return rawValue.join("=");
    }
  }

  return "";
}

function getSessionSecret(env) {
  const secret = String(env.SESSION_SECRET || "");

  if (secret.length < SESSION_SECRET_MIN_LENGTH) {
    return "";
  }

  return secret;
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

  return new Uint8Array(signature);
}

async function verifySessionToken(token, env) {
  const secret = getSessionSecret(env);

  if (!secret) {
    return null;
  }

  const parts = String(token || "").split(".");

  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return null;
  }

  try {
    const [payloadText, signatureText] = parts;
    const expectedSignature = await signPayload(payloadText, secret);
    const actualSignature = base64UrlToBytes(signatureText);

    if (!constantTimeEqual(expectedSignature, actualSignature)) {
      return null;
    }

    const payload = JSON.parse(textDecoder.decode(base64UrlToBytes(payloadText)));
    const now = Math.floor(Date.now() / 1000);

    if (!Number.isInteger(payload.uid) || !Number.isInteger(payload.exp)) {
      return null;
    }

    if (payload.exp <= now) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function getAllowedRoles(pathname, method) {
  const normalizedMethod = method.toUpperCase();

  if (
    pathname.startsWith("/api/admin/users") ||
    pathname.startsWith("/api/admin/categories") ||
    pathname.startsWith("/api/admin/news") ||
    pathname.startsWith("/api/admin/settings") ||
    pathname.startsWith("/api/admin/export-csv") ||
    pathname.startsWith("/api/admin/reports-export")
  ) {
    return ["super_admin", "admin"];
  }

  if (normalizedMethod !== "GET") {
    return ["super_admin", "admin", "staff"];
  }

  return ["super_admin", "admin", "staff", "viewer"];
}

function isRoleAllowed(role, allowedRoles) {
  return allowedRoles.includes(String(role || ""));
}

async function getActiveUser(env, userId) {
  if (!env.DB) {
    return null;
  }

  return env.DB.prepare(
    `SELECT id, name, role
    FROM users
    WHERE id = ?
      AND active = ?
    LIMIT 1`
  )
    .bind(userId, 1)
    .first();
}

async function requireAdminSession(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (!url.pathname.startsWith(ADMIN_API_PREFIX)) {
    return context.next();
  }

  try {
    const sessionToken = getCookie(request, SESSION_COOKIE_NAME);
    const session = await verifySessionToken(sessionToken, env);

    if (!session) {
      return jsonError("UNAUTHORIZED", "กรุณาเข้าสู่ระบบ", 401);
    }

    const user = await getActiveUser(env, session.uid);

    if (!user) {
      return jsonError("UNAUTHORIZED", "กรุณาเข้าสู่ระบบ", 401);
    }

    const allowedRoles = getAllowedRoles(url.pathname, request.method);

    if (!isRoleAllowed(user.role, allowedRoles)) {
      return jsonError("FORBIDDEN", "ไม่มีสิทธิ์ทำรายการนี้", 403);
    }

    context.data.user = {
      id: user.id,
      name: user.name,
      role: user.role,
    };

    return context.next();
  } catch {
    return jsonError("SERVER_ERROR", "ไม่สามารถตรวจสอบสิทธิ์ได้ในขณะนี้", 500);
  }
}

export async function onRequest(context) {
  return requireAdminSession(context);
}
