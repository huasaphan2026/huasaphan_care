import { getCookie, SESSION_COOKIE_NAME, verifySessionToken } from "./api/_utils/auth.js";
import { jsonError } from "./api/_utils/response.js";

const ADMIN_API_PREFIX = "/api/admin/";
const ADMIN_PAGE_PREFIX = "/admin/";
const ADMIN_LOGIN_PATH = "/admin/login";
const ADMIN_LOGIN_PATHS = new Set([ADMIN_LOGIN_PATH, "/admin/login.html"]);
const ADMIN_FALLBACK_PATH = "/admin/dashboard.html";

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

function isAdminApiPath(pathname) {
  return pathname.startsWith(ADMIN_API_PREFIX);
}

function isAdminPagePath(pathname) {
  return pathname === "/admin" || pathname.startsWith(ADMIN_PAGE_PREFIX);
}

function normalizePathname(pathname) {
  if (pathname !== "/" && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }

  return pathname;
}

function isAdminLoginPath(pathname) {
  return ADMIN_LOGIN_PATHS.has(normalizePathname(pathname));
}

function safeReturnPath(url) {
  const path = `${url.pathname}${url.search}`;
  const returnUrl = new URL(path, url.origin);

  if (
    path.startsWith("/") &&
    !path.startsWith("//") &&
    !path.includes("\\") &&
    returnUrl.origin === url.origin &&
    !isAdminLoginPath(returnUrl.pathname)
  ) {
    return path;
  }

  return ADMIN_FALLBACK_PATH;
}

function redirectToAdminLogin(url) {
  const loginUrl = new URL(ADMIN_LOGIN_PATH, url.origin);
  loginUrl.searchParams.set("return", safeReturnPath(url));

  return Response.redirect(loginUrl.toString(), 303);
}

async function getRequestUser(request, env) {
  const sessionToken = getCookie(request, SESSION_COOKIE_NAME);
  const session = await verifySessionToken(sessionToken, env);

  if (!session) {
    return null;
  }

  return getActiveUser(env, session.uid);
}

async function requireAdminAccess(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (!isAdminApiPath(url.pathname) && !isAdminPagePath(url.pathname)) {
    return context.next();
  }

  if (isAdminPagePath(url.pathname) && isAdminLoginPath(url.pathname)) {
    return context.next();
  }

  try {
    const user = await getRequestUser(request, env);

    if (!user && isAdminPagePath(url.pathname)) {
      return redirectToAdminLogin(url);
    }

    if (!user) {
      return jsonError("UNAUTHORIZED", "กรุณาเข้าสู่ระบบ", 401);
    }

    const allowedRoles = isAdminApiPath(url.pathname)
      ? getAllowedRoles(url.pathname, request.method)
      : ["super_admin", "admin", "staff", "viewer"];

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
  return requireAdminAccess(context);
}
