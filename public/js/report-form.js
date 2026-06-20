const MAX_IMAGES = 3;

const form = document.querySelector("#report-form");
const categorySelect = document.querySelector("#category");
const retryButton = document.querySelector("#retry-categories");
const imageInput = document.querySelector("#images");
const imagePreview = document.querySelector("#image-preview");
const statusBox = document.querySelector("#form-status");
const submitButton = document.querySelector("#submit-button");

let selectedImages = [];
let selectedImageItems = [];
let previewUrls = [];
let imageErrorMessage = "";
let imageChangeToken = 0;
let isSubmitting = false;

function setStatus(message, type = "info") {
  if (!statusBox) {
    return;
  }

  statusBox.hidden = !message;
  statusBox.textContent = message;
  statusBox.dataset.type = type;
}

function setFieldError(name, message) {
  const error = document.querySelector(`[data-error-for="${name}"]`);

  if (error) {
    error.textContent = message || "";
  }
}

function clearFieldErrors() {
  document.querySelectorAll("[data-error-for]").forEach((error) => {
    error.textContent = "";
  });
}

function setSubmitting(submitting) {
  submitButton.disabled = submitting;
  submitButton.textContent = submitting ? "กำลังส่งเรื่อง..." : "ส่งเรื่อง";
}

function storeUploadWarning(message) {
  try {
    if (message) {
      sessionStorage.setItem("hsc_upload_warning", message);
    } else {
      sessionStorage.removeItem("hsc_upload_warning");
    }
  } catch {
    // This warning is non-sensitive and can be skipped if sessionStorage is unavailable.
  }
}

function normalizeCategories(payload) {
  if (Array.isArray(payload?.data?.categories)) {
    return payload.data.categories;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  return [];
}

function setCategoryLoading() {
  categorySelect.disabled = true;
  categorySelect.replaceChildren(new Option("กำลังโหลดหมวดปัญหา...", ""));
  retryButton.hidden = true;
  setFieldError("category", "");
}

function setCategoryError() {
  categorySelect.disabled = true;
  categorySelect.replaceChildren(new Option("โหลดหมวดปัญหาไม่ได้", ""));
  retryButton.hidden = false;
  setFieldError(
    "category",
    "ไม่สามารถโหลดหมวดปัญหาได้ กรุณาลองใหม่อีกครั้ง"
  );
}

async function loadCategories() {
  setCategoryLoading();

  try {
    const response = await fetch("/api/public/categories", {
      headers: {
        Accept: "application/json",
      },
    });
    const payload = await response.json();

    if (!response.ok || !payload.ok) {
      throw new Error("Category request failed");
    }

    const categories = normalizeCategories(payload);
    categorySelect.replaceChildren(new Option("เลือกหมวดปัญหา", ""));

    categories.forEach((category) => {
      const option = new Option(category.name, String(category.id));
      option.dataset.priority = category.default_priority || "";
      categorySelect.append(option);
    });

    categorySelect.disabled = categories.length === 0;
    retryButton.hidden = true;

    if (categories.length === 0) {
      setFieldError(
        "category",
        "ยังไม่มีหมวดปัญหาที่เปิดใช้งานในขณะนี้"
      );
    }
  } catch {
    setCategoryError();
  }
}

function revokePreviewUrls() {
  previewUrls.forEach((url) => URL.revokeObjectURL(url));
  previewUrls = [];
}

function renderImagePreview() {
  revokePreviewUrls();
  imagePreview.replaceChildren();

  selectedImageItems.forEach((previewItem, index) => {
    const file = previewItem.file;
    const url = URL.createObjectURL(file);
    previewUrls.push(url);

    const figure = document.createElement("figure");
    figure.className = "preview-item";

    const image = document.createElement("img");
    image.src = url;
    image.alt = `ตัวอย่างรูปภาพที่ ${index + 1}`;

    const caption = document.createElement("figcaption");
    const sizeText = window.HSCImageCompress
      ? window.HSCImageCompress.formatFileSize(previewItem.compressedSize)
      : "";
    caption.textContent = sizeText
      ? `${file.name} (${sizeText})`
      : file.name;

    figure.append(image, caption);
    imagePreview.append(figure);
  });
}

async function compressSelectedImages({ showStatus = true } = {}) {
  const files = Array.from(imageInput.files || []);

  selectedImages = [];
  selectedImageItems = [];
  imageErrorMessage = "";
  renderImagePreview();

  if (files.length === 0) {
    setFieldError("images", "");
    return true;
  }

  if (files.length > MAX_IMAGES) {
    imageInput.value = "";
    imageErrorMessage = "แนบรูปภาพได้สูงสุด 3 ภาพ";
    setFieldError("images", imageErrorMessage);
    return false;
  }

  const compressor = window.HSCImageCompress;

  if (!compressor) {
    imageErrorMessage =
      "ไม่สามารถเตรียมรูปภาพได้ กรุณาลองใหม่อีกครั้ง";
    setFieldError("images", imageErrorMessage);
    return false;
  }

  if (showStatus) {
    setFieldError("images", "กำลังเตรียมรูปภาพ...");
  }

  const result = await compressor.compressImages(files, {
    maxCount: MAX_IMAGES,
  });

  if (result.errors.length > 0) {
    imageInput.value = "";
    imageErrorMessage = result.errors[0];
    setFieldError("images", imageErrorMessage);
    return false;
  }

  selectedImageItems = result.items;
  selectedImages = result.files;
  imageErrorMessage = "";
  setFieldError("images", "");
  renderImagePreview();
  return true;
}

async function handleImageChange() {
  const token = imageChangeToken + 1;
  imageChangeToken = token;

  const compressed = await compressSelectedImages({ showStatus: true });

  if (token !== imageChangeToken || !compressed) {
    return;
  }
}

function trimValue(name) {
  return String(form.elements[name]?.value || "").trim();
}

function validateForm() {
  clearFieldErrors();
  setStatus("");

  let valid = true;
  const categoryId = trimValue("category_id");
  const title = trimValue("title");
  const detail = trimValue("detail");
  const locationText = trimValue("location_text");
  const lat = trimValue("location_lat");
  const lng = trimValue("location_lng");
  const phone = trimValue("reporter_phone");

  if (!categoryId) {
    setFieldError("category", "กรุณาเลือกหมวดปัญหา");
    valid = false;
  }

  if (title.length < 5) {
    setFieldError("title", "กรุณากรอกหัวข้ออย่างน้อย 5 ตัวอักษร");
    valid = false;
  }

  if (detail.length < 10) {
    setFieldError("detail", "กรุณากรอกรายละเอียดอย่างน้อย 10 ตัวอักษร");
    valid = false;
  }

  if (locationText.length < 3) {
    setFieldError(
      "location_text",
      "กรุณากรอกจุดเกิดเหตุหรือจุดสังเกต"
    );
    valid = false;
  }

  if ((lat && !lng) || (!lat && lng)) {
    setFieldError(
      "location",
      "ถ้ากรอกพิกัด กรุณากรอกทั้งละติจูดและลองจิจูด"
    );
    valid = false;
  }

  if (lat && (Number.isNaN(Number(lat)) || Number(lat) < -90 || Number(lat) > 90)) {
    setFieldError("location", "ละติจูดต้องอยู่ระหว่าง -90 ถึง 90");
    valid = false;
  }

  if (lng && (Number.isNaN(Number(lng)) || Number(lng) < -180 || Number(lng) > 180)) {
    setFieldError("location", "ลองจิจูดต้องอยู่ระหว่าง -180 ถึง 180");
    valid = false;
  }

  if (phone && !/^[0-9+\-\s()]{9,30}$/.test(phone)) {
    setFieldError(
      "reporter_phone",
      "กรุณากรอกเบอร์โทรเป็นตัวเลข 9-10 หลัก"
    );
    valid = false;
  }

  if (imageErrorMessage) {
    setFieldError("images", imageErrorMessage);
    valid = false;
  } else if (Array.from(imageInput.files || []).length > MAX_IMAGES) {
    setFieldError("images", "แนบรูปภาพได้สูงสุด 3 ภาพ");
    valid = false;
  }

  if (!valid) {
    setStatus("กรุณาตรวจสอบข้อมูลที่ต้องกรอกให้ครบ", "error");
  }

  return valid;
}

function buildPayload() {
  const lat = trimValue("location_lat");
  const lng = trimValue("location_lng");

  return {
    category_id: Number(trimValue("category_id")),
    title: trimValue("title"),
    detail: trimValue("detail"),
    location_text: trimValue("location_text"),
    location_lat: lat ? Number(lat) : null,
    location_lng: lng ? Number(lng) : null,
    anonymous: Boolean(form.elements.anonymous.checked),
    reporter_name: trimValue("reporter_name"),
    reporter_phone: trimValue("reporter_phone"),
  };
}

function getApiErrorMessage(payload) {
  if (payload?.error?.message) {
    return payload.error.message;
  }

  if (payload?.message) {
    return payload.message;
  }

  return "ส่งเรื่องไม่สำเร็จ กรุณาตรวจสอบข้อมูลและลองใหม่อีกครั้ง";
}

async function createReport() {
  const response = await fetch("/api/reports", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildPayload()),
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.ok) {
    throw new Error(getApiErrorMessage(payload));
  }

  const trackingCode = payload?.data?.tracking_code;
  const reportId = payload?.data?.report_id;

  if (!trackingCode || !reportId) {
    throw new Error(
      "ส่งเรื่องสำเร็จ แต่ไม่พบรหัสติดตามหรือเลขอ้างอิง กรุณาลองใหม่อีกครั้ง"
    );
  }

  return {
    trackingCode,
    reportId,
  };
}

async function uploadReportImage({ file, reportId, trackingCode }) {
  const formData = new FormData();
  formData.append("file", file, file.name || "before.webp");
  formData.append("report_id", String(reportId));
  formData.append("tracking_code", trackingCode);
  formData.append("purpose", "before");

  const response = await fetch("/api/uploads/image", {
    method: "POST",
    headers: {
      Accept: "application/json",
    },
    body: formData,
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.ok) {
    throw new Error(getApiErrorMessage(payload));
  }

  return payload.data;
}

async function uploadReportImages({ reportId, trackingCode }) {
  let uploadedCount = 0;

  for (let index = 0; index < selectedImages.length; index += 1) {
    setStatus(`กำลังอัปโหลดรูป ${index + 1}/${selectedImages.length}`, "info");

    try {
      await uploadReportImage({
        file: selectedImages[index],
        reportId,
        trackingCode,
      });
      uploadedCount += 1;
    } catch {
      // Keep the report submitted even if an image fails to upload.
    }
  }

  return uploadedCount;
}

async function submitReport(event) {
  event.preventDefault();

  if (isSubmitting) {
    return;
  }

  if (!validateForm()) {
    return;
  }

  isSubmitting = true;
  setSubmitting(true);
  storeUploadWarning("");

  try {
    setStatus("กำลังเตรียมรูปภาพ...", "info");
    const compressed = await compressSelectedImages({ showStatus: false });

    if (!compressed) {
      throw new Error("กรุณาตรวจสอบรูปภาพที่แนบ");
    }

    setStatus("กำลังส่งเรื่อง", "info");
    const report = await createReport();
    const totalImages = selectedImages.length;
    let uploadWarningMessage = "";

    if (totalImages > 0) {
      const uploadedCount = await uploadReportImages(report);

      if (uploadedCount < totalImages) {
        uploadWarningMessage = `แจ้งเรื่องสำเร็จ แต่อัปโหลดรูปได้ ${uploadedCount}/${totalImages} ภาพ`;
        storeUploadWarning(uploadWarningMessage);
      }
    }

    try {
      sessionStorage.setItem("hsc_tracking_code", report.trackingCode);
    } catch {
      // Continue to the success page even when temporary storage is unavailable.
    }

    const warningQuery = uploadWarningMessage ? "&upload_warning=1" : "";
    window.location.assign(
      `success.html?code=${encodeURIComponent(report.trackingCode)}${warningQuery}`
    );
  } catch (error) {
    setStatus(
      error.message || "ส่งเรื่องไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
      "error"
    );
    isSubmitting = false;
    setSubmitting(false);
  }
}

retryButton.addEventListener("click", loadCategories);
imageInput.addEventListener("change", handleImageChange);
form.addEventListener("submit", submitReport);
window.addEventListener("beforeunload", revokePreviewUrls);

loadCategories();
