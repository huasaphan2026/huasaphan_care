const MAX_IMAGE_SIZE_BYTES = 1024 * 1024;
const MAX_BEFORE_IMAGES_PER_REPORT = 3;
const REQUIRED_PURPOSE = "before";

const ALLOWED_IMAGE_TYPES = new Map([
  ["image/jpeg", new Set(["jpg", "jpeg"])],
  ["image/png", new Set(["png"])],
  ["image/webp", new Set(["webp"])],
]);
const MAX_SIGNATURE_BYTES = 12;
const IMAGE_SIGNATURES = {
  "image/jpeg": {
    minBytes: 3,
    matches(bytes) {
      return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    },
  },
  "image/png": {
    minBytes: 8,
    matches(bytes) {
      const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
      return signature.every((byte, index) => bytes[index] === byte);
    },
  },
  "image/webp": {
    minBytes: 12,
    matches(bytes) {
      return (
        bytes[0] === 0x52 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x46 &&
        bytes[8] === 0x57 &&
        bytes[9] === 0x45 &&
        bytes[10] === 0x42 &&
        bytes[11] === 0x50
      );
    },
  },
};

function jsonResponse(body, status = 200, headers = {}) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

function errorResponse(code, message, status = 400, fields) {
  return jsonResponse(
    {
      ok: false,
      error: {
        code,
        message,
        ...(fields ? { fields } : {}),
      },
    },
    status
  );
}

function successResponse(data, status = 200, message = "success") {
  return jsonResponse(
    {
      ok: true,
      data,
      message,
    },
    status
  );
}

function trimText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parseReportId(value) {
  const reportId = Number(value);
  return Number.isInteger(reportId) && reportId > 0 ? reportId : null;
}

function sanitizeOriginalFilename(filename) {
  const basename = String(filename || "upload")
    .split(/[\\/]/)
    .pop()
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 80);

  return basename || "upload";
}

function getExtension(filename) {
  const match = sanitizeOriginalFilename(filename).match(/\.([a-z0-9]+)$/);
  return match ? match[1] : "";
}

function isUploadedFile(value) {
  return (
    value &&
    typeof value === "object" &&
    typeof value.name === "string" &&
    typeof value.type === "string" &&
    typeof value.size === "number" &&
    typeof value.slice === "function" &&
    typeof value.arrayBuffer === "function"
  );
}

function invalidImageContentError() {
  return {
    code: "INVALID_IMAGE_CONTENT",
    status: 415,
    fields: {
      file: "Invalid image file content",
    },
    message: "Image file content does not match the declared type",
  };
}

async function readImageHeader(file) {
  const header = await file.slice(0, MAX_SIGNATURE_BYTES).arrayBuffer();
  return new Uint8Array(header);
}

async function validateImageFile(file) {
  if (!isUploadedFile(file)) {
    return {
      code: "VALIDATION_ERROR",
      status: 400,
      fields: {
        file: "กรุณาแนบไฟล์รูปภาพ",
      },
      message: "กรุณาตรวจสอบข้อมูลที่ส่งมา",
    };
  }

  if (file.size <= 0) {
    return {
      code: "VALIDATION_ERROR",
      status: 400,
      fields: {
        file: "ไฟล์รูปภาพไม่ถูกต้อง",
      },
      message: "กรุณาตรวจสอบข้อมูลที่ส่งมา",
    };
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return {
      code: "FILE_TOO_LARGE",
      status: 413,
      fields: {
        file: "รูปภาพหลังบีบอัดต้องไม่เกิน 1MB",
      },
      message: "ไฟล์รูปภาพใหญ่เกินกำหนด",
    };
  }

  const allowedExtensions = ALLOWED_IMAGE_TYPES.get(file.type);
  const extension = getExtension(file.name);

  if (!allowedExtensions || !extension || !allowedExtensions.has(extension)) {
    return {
      code: "UNSUPPORTED_FILE_TYPE",
      status: 415,
      fields: {
        file: "รองรับเฉพาะไฟล์ jpg, jpeg, png หรือ webp",
      },
      message: "ชนิดไฟล์ไม่รองรับ",
    };
  }

  const signature = IMAGE_SIGNATURES[file.type];
  const headerBytes = await readImageHeader(file);

  if (headerBytes.length < signature.minBytes || !signature.matches(headerBytes)) {
    return invalidImageContentError();
  }

  return {
    contentType: file.type,
  };
}

function getYearFromTrackingCode(trackingCode) {
  const match = trackingCode.match(/^HSC-(\d{4})-\d{4,}$/);

  if (match) {
    return match[1];
  }

  return new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
  }).format(new Date());
}

function randomHex(byteLength = 6) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);

  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
}

function buildR2Key({ trackingCode, sequence }) {
  const year = getYearFromTrackingCode(trackingCode);
  const safeFilename = `${REQUIRED_PURPOSE}-${String(sequence).padStart(
    2,
    "0"
  )}-${randomHex()}.webp`;

  return {
    fileName: safeFilename,
    r2Key: `reports/${year}/${trackingCode}/compressed/${safeFilename}`,
  };
}

async function findReport(db, reportId, trackingCode) {
  return db
    .prepare(
      `SELECT id, tracking_code
       FROM reports
       WHERE id = ? AND tracking_code = ?
       LIMIT 1`
    )
    .bind(reportId, trackingCode)
    .first();
}

async function countBeforeImages(db, reportId) {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS total
       FROM attachments
       WHERE report_id = ? AND purpose = ?`
    )
    .bind(reportId, REQUIRED_PURPOSE)
    .first();

  return Number(row?.total || 0);
}

async function insertAttachment(db, data) {
  const result = await db
    .prepare(
      `INSERT INTO attachments (
        report_id,
        r2_key,
        file_name,
        file_type,
        file_size,
        purpose,
        public_allowed,
        uploaded_by
      )
      SELECT ?, ?, ?, ?, ?, ?, 0, NULL
      WHERE (
        SELECT COUNT(*)
        FROM attachments
        WHERE report_id = ? AND purpose = ?
      ) < ?`
    )
    .bind(
      data.reportId,
      data.r2Key,
      data.fileName,
      data.fileType,
      data.fileSize,
      REQUIRED_PURPOSE,
      data.reportId,
      REQUIRED_PURPOSE,
      MAX_BEFORE_IMAGES_PER_REPORT
    )
    .run();

  if (result.meta?.changes !== 1) {
    return null;
  }

  const attachment = await db
    .prepare(
      `SELECT id
       FROM attachments
       WHERE r2_key = ?
       LIMIT 1`
    )
    .bind(data.r2Key)
    .first();

  return attachment?.id || null;
}

export async function onRequest({ request, env }) {
  if (request.method !== "POST") {
    return jsonResponse(
      {
        ok: false,
        error: {
          code: "METHOD_NOT_ALLOWED",
          message: "Method not allowed",
        },
      },
      405,
      { Allow: "POST" }
    );
  }

  const contentType = request.headers.get("Content-Type") || "";

  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return errorResponse(
      "VALIDATION_ERROR",
      "กรุณาส่งข้อมูลแบบ multipart/form-data",
      400,
      {
        content_type: "Content-Type ต้องเป็น multipart/form-data",
      }
    );
  }

  let formData;

  try {
    formData = await request.formData();
  } catch {
    return errorResponse(
      "VALIDATION_ERROR",
      "รูปแบบข้อมูลอัปโหลดไม่ถูกต้อง",
      400
    );
  }

  const reportId = parseReportId(formData.get("report_id"));
  const trackingCode = trimText(formData.get("tracking_code"));
  const purpose = trimText(formData.get("purpose"));
  const file = formData.get("file");
  const errors = {};

  if (!reportId) {
    errors.report_id = "กรุณาระบุ report_id ให้ถูกต้อง";
  }

  if (!trackingCode) {
    errors.tracking_code = "กรุณาระบุรหัสติดตาม";
  }

  if (purpose !== REQUIRED_PURPOSE) {
    errors.purpose = "การอัปโหลดจากชาวบ้านต้องใช้ purpose เป็น before เท่านั้น";
  }

  if (Object.keys(errors).length > 0) {
    return errorResponse(
      "VALIDATION_ERROR",
      "กรุณาตรวจสอบข้อมูลที่ส่งมา",
      400,
      errors
    );
  }

  const fileValidation = await validateImageFile(file);

  if (fileValidation?.code) {
    return errorResponse(
      fileValidation.code,
      fileValidation.message,
      fileValidation.status,
      fileValidation.fields
    );
  }

  let r2Key;

  try {
    const report = await findReport(env.DB, reportId, trackingCode);

    if (!report) {
      return errorResponse(
        "TRACKING_CODE_INVALID",
        "ไม่พบเรื่องแจ้งที่ตรงกับรหัสติดตามนี้",
        404
      );
    }

    const existingBeforeImages = await countBeforeImages(env.DB, reportId);

    if (existingBeforeImages >= MAX_BEFORE_IMAGES_PER_REPORT) {
      return errorResponse(
        "UPLOAD_LIMIT_EXCEEDED",
        "อัปโหลดรูปก่อนดำเนินการได้ไม่เกิน 3 ภาพต่อเรื่อง",
        409
      );
    }

    const keyData = buildR2Key({
      trackingCode,
      sequence: existingBeforeImages + 1,
    });

    r2Key = keyData.r2Key;

    await env.BUCKET.put(r2Key, await file.arrayBuffer(), {
      httpMetadata: {
        contentType: fileValidation.contentType,
      },
      customMetadata: {
        report_id: String(reportId),
        tracking_code: trackingCode,
        purpose: REQUIRED_PURPOSE,
        original_name: sanitizeOriginalFilename(file.name),
      },
    });

    const attachmentId = await insertAttachment(env.DB, {
      reportId,
      r2Key,
      fileName: keyData.fileName,
      fileType: fileValidation.contentType,
      fileSize: file.size,
    });

    if (!attachmentId) {
      await env.BUCKET.delete(r2Key).catch(() => {});

      return errorResponse(
        "UPLOAD_LIMIT_EXCEEDED",
        "อัปโหลดรูปก่อนดำเนินการได้ไม่เกิน 3 ภาพต่อเรื่อง",
        409
      );
    }

    return successResponse(
      {
        attachment_id: attachmentId,
        r2_key: r2Key,
      },
      201,
      "อัปโหลดรูปภาพสำเร็จ"
    );
  } catch {
    if (r2Key) {
      await env.BUCKET.delete(r2Key).catch(() => {});
    }

    return errorResponse(
      "SERVER_ERROR",
      "ระบบผิดพลาด กรุณาลองใหม่อีกครั้ง",
      500
    );
  }
}
