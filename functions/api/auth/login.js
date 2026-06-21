import {
  createSignedSession,
  diagnosePasswordVerification,
  sessionCookie,
  verifyPassword,
} from "../_utils/auth.js";
import { jsonError, jsonOk } from "../_utils/response.js";

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

    console.log("LOGIN_DIAG_USER", {
      userFound: Boolean(user),
      usernameLength: username.length,
      passwordLength: password.length,
      role: user?.role || null,
      activeUserIdPresent: Number.isInteger(Number(user?.id)),
      hashType: typeof user?.password_hash,
      hashLength:
        typeof user?.password_hash === "string"
          ? user.password_hash.length
          : 0,
    });

    if (!user) {
      return jsonError("LOGIN_FAILED", "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง", 401);
    }

    const passwordValid = await verifyPassword(password, user.password_hash);

    console.log("LOGIN_DIAG_PASSWORD", {
      passwordValid,
    });

    if (!passwordValid) {
      const passwordDiagnostic = await diagnosePasswordVerification(
        password,
        user.password_hash
      );

      console.log("LOGIN_DIAG_PBKDF2", passwordDiagnostic);

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
  } catch (error) {
    console.error("LOGIN_DIAG_ERROR", {
      name: error?.name || "UnknownError",
      message: error?.message || "Unknown error",
    });

    return jsonError("SERVER_ERROR", "ไม่สามารถเข้าสู่ระบบได้ในขณะนี้", 500);
  }
}
