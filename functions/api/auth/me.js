import { getCookie, SESSION_COOKIE_NAME, verifySessionToken } from "../_utils/auth.js";
import { jsonError, jsonOk } from "../_utils/response.js";

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
