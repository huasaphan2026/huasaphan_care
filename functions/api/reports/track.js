const TRACKING_CODE_PATTERN = /^HSC-\d{4}-\d{4,}$/;
const DEFAULT_PUBLIC_LOCATION = "พื้นที่บ้านหัวสะพาน";

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

function normalizeTrackingCode(value) {
  return String(value || "").trim().toUpperCase();
}

function toPublicLocation(report) {
  const source = report.public_location_label || "";
  const compact = String(source).replace(/\s+/g, " ").trim();

  if (!compact) {
    return DEFAULT_PUBLIC_LOCATION;
  }

  if (compact.length <= 120) {
    return compact;
  }

  return `${compact.slice(0, 117).trim()}...`;
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
      { Allow: "GET" }
    );
  }

  const url = new URL(request.url);
  const trackingCode = normalizeTrackingCode(url.searchParams.get("code"));

  if (!TRACKING_CODE_PATTERN.test(trackingCode)) {
    return jsonResponse(
      {
        ok: false,
        error: {
          code: "TRACKING_CODE_INVALID",
          message: "รูปแบบรหัสติดตามไม่ถูกต้อง",
        },
      },
      400
    );
  }

  try {
    const report = await env.DB.prepare(
      `SELECT
        r.id,
        r.tracking_code,
        r.title,
        r.status,
        r.priority,
        r.public_location_label,
        r.created_at,
        r.updated_at,
        c.name AS category_name
      FROM reports r
      JOIN categories c ON c.id = r.category_id
      WHERE r.tracking_code = ?
      LIMIT 1`
    )
      .bind(trackingCode)
      .first();

    if (!report) {
      return jsonResponse(
        {
          ok: false,
          error: {
            code: "TRACKING_NOT_FOUND",
            message: "ไม่พบรหัสติดตามนี้",
          },
        },
        404
      );
    }

    const { results } = await env.DB.prepare(
      `SELECT status, update_note, created_at
      FROM report_updates
      WHERE report_id = ?
        AND is_public = ?
      ORDER BY created_at ASC, id ASC`
    )
      .bind(report.id, 1)
      .all();

    const timeline = (results || []).map((item) => ({
      status: item.status,
      update_note: item.update_note,
      created_at: item.created_at,
    }));

    return jsonResponse({
      ok: true,
      data: {
        tracking_code: report.tracking_code,
        title: report.title,
        category_name: report.category_name,
        status: report.status,
        priority: report.priority,
        location_text: toPublicLocation(report),
        created_at: report.created_at,
        updated_at: report.updated_at,
        timeline,
      },
      message: "success",
    });
  } catch {
    return jsonResponse(
      {
        ok: false,
        error: {
          code: "SERVER_ERROR",
          message: "ไม่สามารถดึงข้อมูลติดตามสถานะได้ในขณะนี้",
        },
      },
      500
    );
  }
}
