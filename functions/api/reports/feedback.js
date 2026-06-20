import { jsonError, jsonOk } from "../_utils/response.js";

const TRACKING_CODE_PATTERN = /^HSC-\d{4}-\d{4,}$/;
const FEEDBACK_ALLOWED_STATUSES = new Set(["resolved", "closed"]);
const MAX_COMMENT_LENGTH = 500;

function methodNotAllowed() {
  const response = jsonError("METHOD_NOT_ALLOWED", "Method not allowed", 405);
  response.headers.set("Allow", "POST");
  return response;
}

function normalizeTrackingCode(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeComment(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeScore(value) {
  const score = Number(value);
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    return null;
  }

  return score;
}

export async function onRequest({ request, env }) {
  if (request.method !== "POST") {
    return methodNotAllowed();
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError("VALIDATION_ERROR", "รูปแบบข้อมูลไม่ถูกต้อง", 400);
  }

  const trackingCode = normalizeTrackingCode(body?.tracking_code);
  const score = normalizeScore(body?.score);
  const comment = normalizeComment(body?.comment);

  if (!TRACKING_CODE_PATTERN.test(trackingCode)) {
    return jsonError("TRACKING_CODE_INVALID", "รูปแบบรหัสติดตามไม่ถูกต้อง", 400);
  }

  if (!score) {
    return jsonError("VALIDATION_ERROR", "กรุณาเลือกคะแนน 1 ถึง 5", 400);
  }

  if (comment.length > MAX_COMMENT_LENGTH) {
    return jsonError("VALIDATION_ERROR", "ความคิดเห็นยาวเกินไป", 400);
  }

  try {
    const report = await env.DB.prepare(
      `SELECT id, status
      FROM reports
      WHERE tracking_code = ?
      LIMIT 1`
    )
      .bind(trackingCode)
      .first();

    if (!report) {
      return jsonError("TRACKING_NOT_FOUND", "ไม่พบรหัสติดตามนี้", 404);
    }

    if (!FEEDBACK_ALLOWED_STATUSES.has(report.status)) {
      return jsonError(
        "FEEDBACK_NOT_ALLOWED",
        "ส่งความคิดเห็นได้เฉพาะเรื่องที่แก้ไขแล้วหรือปิดเรื่องแล้ว",
        409
      );
    }

    const now = new Date().toISOString();
    const result = await env.DB.prepare(
      `INSERT INTO feedback (
        report_id,
        score,
        comment,
        created_at
      ) VALUES (?, ?, ?, ?)`
    )
      .bind(report.id, score, comment || null, now)
      .run();

    return jsonOk(
      {
        feedback_id: result.meta?.last_row_id || null,
      },
      "ขอบคุณสำหรับความคิดเห็น",
      201
    );
  } catch {
    return jsonError("SERVER_ERROR", "ไม่สามารถบันทึกความคิดเห็นได้ในขณะนี้", 500);
  }
}
