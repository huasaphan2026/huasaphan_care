import assert from "node:assert/strict";
import test from "node:test";

import { onRequest } from "../functions/api/uploads/image.js";

const REPORT_ID = 7;
const TRACKING_CODE = "HSC-2026-0007";

const VALID_JPEG_BYTES = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10];
const VALID_PNG_BYTES = [
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
];
const VALID_WEBP_BYTES = [
  0x52, 0x49, 0x46, 0x46, 0x04, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
];

function createDbMock({ existingBeforeImages = 0 } = {}) {
  const queries = [];

  return {
    queries,
    prepare(sql) {
      queries.push(sql);

      return {
        bind() {
          return {
            async first() {
              if (sql.includes("FROM reports")) {
                return {
                  id: REPORT_ID,
                  tracking_code: TRACKING_CODE,
                };
              }

              if (sql.includes("COUNT(*) AS total")) {
                return { total: existingBeforeImages };
              }

              if (sql.includes("WHERE r2_key = ?")) {
                return { id: 123 };
              }

              return null;
            },
            async run() {
              return { meta: { changes: 1 } };
            },
          };
        },
      };
    },
  };
}

function createBucketMock() {
  const puts = [];
  const deletes = [];

  return {
    puts,
    deletes,
    async put(key, body, options) {
      puts.push({ key, body, options });
    },
    async delete(key) {
      deletes.push(key);
    },
  };
}

function bytesFile(bytes, name, type) {
  return new Blob([new Uint8Array(bytes)], { type });
}

function createUploadRequest({ bytes, name, type }) {
  const formData = new FormData();
  formData.set("report_id", String(REPORT_ID));
  formData.set("tracking_code", TRACKING_CODE);
  formData.set("purpose", "before");
  formData.set("file", bytesFile(bytes, name, type), name);

  return new Request("https://example.test/api/uploads/image", {
    method: "POST",
    body: formData,
  });
}

async function uploadFile(fileData, dbOptions) {
  const bucket = createBucketMock();
  const db = createDbMock(dbOptions);
  const response = await onRequest({
    request: createUploadRequest(fileData),
    env: {
      DB: db,
      BUCKET: bucket,
    },
  });
  const body = await response.json();

  return { response, body, bucket, db };
}

async function assertRejectedBeforeR2(fileData) {
  const result = await uploadFile(fileData);

  assert.equal(result.response.status, 415);
  assert.equal(result.body.ok, false);
  assert.equal(result.bucket.puts.length, 0);

  return result;
}

test("valid JPEG upload passes magic byte validation", async () => {
  const result = await uploadFile({
    bytes: VALID_JPEG_BYTES,
    name: "photo.jpg",
    type: "image/jpeg",
  });

  assert.equal(result.response.status, 201);
  assert.equal(result.bucket.puts.length, 1);
  assert.equal(result.bucket.puts[0].options.httpMetadata.contentType, "image/jpeg");
});

test("valid PNG upload passes magic byte validation", async () => {
  const result = await uploadFile({
    bytes: VALID_PNG_BYTES,
    name: "photo.png",
    type: "image/png",
  });

  assert.equal(result.response.status, 201);
  assert.equal(result.bucket.puts.length, 1);
  assert.equal(result.bucket.puts[0].options.httpMetadata.contentType, "image/png");
});

test("valid WebP upload passes magic byte validation", async () => {
  const result = await uploadFile({
    bytes: VALID_WEBP_BYTES,
    name: "photo.webp",
    type: "image/webp",
  });

  assert.equal(result.response.status, 201);
  assert.equal(result.bucket.puts.length, 1);
  assert.equal(result.bucket.puts[0].options.httpMetadata.contentType, "image/webp");
});

test("JPEG extension with HTML content is rejected", async () => {
  const result = await assertRejectedBeforeR2({
    bytes: Array.from(new TextEncoder().encode("<html>not an image</html>")),
    name: "photo.jpg",
    type: "image/jpeg",
  });

  assert.equal(result.body.error.code, "INVALID_IMAGE_CONTENT");
});

test("PNG MIME with JPEG signature is rejected", async () => {
  const result = await assertRejectedBeforeR2({
    bytes: VALID_JPEG_BYTES,
    name: "photo.png",
    type: "image/png",
  });

  assert.equal(result.body.error.code, "INVALID_IMAGE_CONTENT");
});

test("WebP with incomplete RIFF WEBP signature is rejected", async () => {
  const result = await assertRejectedBeforeR2({
    bytes: [0x52, 0x49, 0x46, 0x46, 0x04, 0x00, 0x00, 0x00, 0x4e, 0x4f, 0x50, 0x45],
    name: "photo.webp",
    type: "image/webp",
  });

  assert.equal(result.body.error.code, "INVALID_IMAGE_CONTENT");
});

test("empty image file is rejected before R2 put", async () => {
  const result = await uploadFile({
    bytes: [],
    name: "photo.jpg",
    type: "image/jpeg",
  });

  assert.equal(result.response.status, 400);
  assert.equal(result.body.error.code, "VALIDATION_ERROR");
  assert.equal(result.bucket.puts.length, 0);
});

test("file shorter than required signature is rejected", async () => {
  const result = await assertRejectedBeforeR2({
    bytes: [0xff, 0xd8],
    name: "photo.jpg",
    type: "image/jpeg",
  });

  assert.equal(result.body.error.code, "INVALID_IMAGE_CONTENT");
});

test("SVG fake image is rejected", async () => {
  const result = await uploadFile({
    bytes: Array.from(new TextEncoder().encode("<svg></svg>")),
    name: "photo.svg",
    type: "image/svg+xml",
  });

  assert.equal(result.response.status, 415);
  assert.equal(result.body.error.code, "UNSUPPORTED_FILE_TYPE");
  assert.equal(result.bucket.puts.length, 0);
});

test("HTML fake image is rejected even with image extension", async () => {
  const result = await assertRejectedBeforeR2({
    bytes: Array.from(new TextEncoder().encode("<!doctype html><h1>x</h1>")),
    name: "photo.webp",
    type: "image/webp",
  });

  assert.equal(result.body.error.code, "INVALID_IMAGE_CONTENT");
});

test("R2 put receives the verified content type", async () => {
  const result = await uploadFile({
    bytes: VALID_PNG_BYTES,
    name: "photo.png",
    type: "image/png",
  });

  assert.equal(result.response.status, 201);
  assert.equal(result.bucket.puts[0].options.httpMetadata.contentType, "image/png");
});

test("upload count limit is preserved", async () => {
  const result = await uploadFile(
    {
      bytes: VALID_WEBP_BYTES,
      name: "photo.webp",
      type: "image/webp",
    },
    { existingBeforeImages: 3 }
  );

  assert.equal(result.response.status, 409);
  assert.equal(result.body.error.code, "UPLOAD_LIMIT_EXCEEDED");
  assert.equal(result.bucket.puts.length, 0);
});

test("upload size limit is preserved before R2 put", async () => {
  const oversized = new Uint8Array(1024 * 1024 + 1);
  oversized.set(VALID_JPEG_BYTES, 0);
  const result = await uploadFile({
    bytes: Array.from(oversized),
    name: "large.jpg",
    type: "image/jpeg",
  });

  assert.equal(result.response.status, 413);
  assert.equal(result.body.error.code, "FILE_TOO_LARGE");
  assert.equal(result.bucket.puts.length, 0);
});
