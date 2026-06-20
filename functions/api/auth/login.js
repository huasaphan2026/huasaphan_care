import { createSessionToken, verifyPassword } from "../_utils/auth.js";
import { jsonError, jsonOk } from "../_utils/response.js";

const SESSION_COOKIE_NAME = "hsc_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const SESSION_SECRET_MIN_LENGTH = 32;

const textEncoder = new TextEncoder();

function bytesToBase64Url(bytes) {
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
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

  return bytesToBase64Url(new Uint8Array(signature));
}

async function createSignedSession(user, env) {
  const secret = getSessionSecret(env);

  if (!secret) {
    throw new Error("SESSION_SECRET is not configured");
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    uid: user.id,
    sid: createSessionToken(),
    iat: now,
    exp: now + SESSION_MAX_AGE_SECONDS,
  };
  const payloadText = bytesToBase64Url(textEncoder.encode(JSON.stringify(payload)));
  const signature = await signPayload(payloadText, secret);

  return `${payloadText}.${signature}`;
}

function sessionCookie(token) {
  return [
    `${SESSION_COOKIE_NAME}=${token}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
  ].join("; ");
}

function methodNotAllowed() {
  const response = jsonError("METHOD_NOT_ALLOWED", "Method not allowed", 405);
  response.headers.set("Allow", "POST");
  return response;
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function onRequest({ request, env }) {
  if (request.method !== "POST") {
    return methodNotAllowed();
  }

  const body = await readJson(request);
  const username = String(body?.username || "").trim();
  const password = typeof body?.password === "string" ? body.password : "";

  if (!username || !password) {
    return jsonError(
      "VALIDATION_ERROR",
      "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน",
      400
    );
  }

  try {
    const user = await env.DB.prepare(
      `SELECT id, name, username, role, password_hash
      FROM users
      WHERE username = ?
        AND active = ?
      LIMIT 1`
    )
      .bind(username, 1)
      .first();

    if (!user) {
      return jsonError("LOGIN_FAILED", "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง", 401);
    }

    const passwordValid = await verifyPassword(password, user.password_hash);

    if (!passwordValid) {
      return jsonError("LOGIN_FAILED", "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง", 401);
    }

    const token = await createSignedSession(user, env);
    const response = jsonOk(
      {
        user: {
          id: user.id,
          name: user.name,
          role: user.role,
        },
      },
      "เข้าสู่ระบบสำเร็จ"
    );

    response.headers.set("Set-Cookie", sessionCookie(token));
    return response;
  } catch {
    return jsonError("SERVER_ERROR", "ไม่สามารถเข้าสู่ระบบได้ในขณะนี้", 500);
  }
}
