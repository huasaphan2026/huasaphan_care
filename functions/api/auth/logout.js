import { jsonError, jsonOk } from "../_utils/response.js";

const SESSION_COOKIE_NAME = "hsc_session";

function clearSessionCookie() {
  return [
    `${SESSION_COOKIE_NAME}=`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Path=/",
    "Max-Age=0",
  ].join("; ");
}

function methodNotAllowed() {
  const response = jsonError("METHOD_NOT_ALLOWED", "Method not allowed", 405);
  response.headers.set("Allow", "POST");
  return response;
}

export async function onRequest({ request }) {
  if (request.method !== "POST") {
    return methodNotAllowed();
  }

  const response = jsonOk({}, "ออกจากระบบสำเร็จ");
  response.headers.set("Set-Cookie", clearSessionCookie());
  return response;
}
