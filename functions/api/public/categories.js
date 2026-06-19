function jsonResponse(body, status = 200, extraHeaders = {}) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

export async function onRequest({ request, env }) {
  if (request.method !== "GET") {
    return jsonResponse(
      {
        ok: false,
        error: {
          code: "METHOD_NOT_ALLOWED",
          message: "Method not allowed",
        },
      },
      405,
      {
        Allow: "GET",
      }
    );
  }

  try {
    const { results } = await env.DB.prepare(
      `SELECT id, code, name, description, default_priority
       FROM categories
       WHERE active = ?
       ORDER BY sort_order ASC, id ASC`
    )
      .bind(1)
      .all();

    return jsonResponse({
      ok: true,
      data: {
        categories: results ?? [],
      },
      message: "success",
    });
  } catch {
    return jsonResponse(
      {
        ok: false,
        error: {
          code: "SERVER_ERROR",
          message: "ระบบผิดพลาด กรุณาลองใหม่อีกครั้ง",
        },
      },
      500
    );
  }
}
