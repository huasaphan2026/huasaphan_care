import { jsonError, jsonOk } from "../_utils/response.js";

const SESSION_COOKIE_NAME = "hsc_session";
const SESSION_SECRET_MIN_LENGTH = 32;

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

function getSessionSecret(env) {
  const secret = String(env.SESSION_SECRET || "");

  if (secret.length < SESSION_SECRET_MIN_LENGTH) {
    return "";
  }

  return secret;
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

function methodNotAllowed() {
  const response = jsonError("METHOD_NOT_ALLOWED", "Method not allowed", 405);
  response.headers.set("Allow", "GET");
  return response;
}

export async function onRequest({ request, env }) {
  if (request.method !== "GET") {
    return methodNotAllowed();
  }

  const sessionToken = getCookie(request, SESSION_COOKIE_NAME);
  const session = await verifySessionToken(sessionToken, env);

  if (!session) {
    return jsonError("UNAUTHORIZED", "กรุณาเข้าสู่ระบบ", 401);
  }

  try {
    const user = await env.DB.prepare(
      `SELECT id, name, role
      FROM users
      WHERE id = ?
        AND active = ?
      LIMIT 1`
    )
      .bind(session.uid, 1)
      .first();

    if (!user) {
      return jsonError("UNAUTHORIZED", "กรุณาเข้าสู่ระบบ", 401);
    }

    return jsonOk(
      {
        user: {
          id: user.id,
          name: user.name,
          role: user.role,
        },
      },
      "success"
    );
  } catch {
    return jsonError("SERVER_ERROR", "ไม่สามารถตรวจสอบผู้ใช้ได้ในขณะนี้", 500);
  }
}
