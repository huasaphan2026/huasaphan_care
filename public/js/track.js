const TRACKING_CODE_PATTERN = /^HSC-\d{4}-\d{4,}$/;
const FEEDBACK_ALLOWED_STATUSES = new Set(["resolved", "closed"]);

const STATUS_TEXT = {
  new: "รับเรื่องแล้ว",
  accepted: "เจ้าหน้าที่รับเรื่องแล้ว",
  checking: "กำลังตรวจสอบ",
  waiting_info: "รอข้อมูลเพิ่มเติม",
  forwarded: "ส่งต่อหน่วยงานที่เกี่ยวข้อง",
  in_progress: "กำลังดำเนินการ",
  resolved: "แก้ไขแล้ว",
  closed: "ปิดเรื่องแล้ว",
  rejected: "ไม่อยู่ในขอบเขตการดำเนินการ",
};

const STATUS_DESCRIPTION = {
  new: "ระบบรับเรื่องไว้แล้ว และรอเจ้าหน้าที่ตรวจสอบรายละเอียดเบื้องต้น",
  accepted: "เจ้าหน้าที่รับเรื่องเข้าสู่กระบวนการดูแลแล้ว",
  checking: "ทีมงานกำลังตรวจสอบพื้นที่หรือข้อมูลที่เกี่ยวข้อง",
  waiting_info: "ทีมงานอาจต้องการข้อมูลเพิ่มเติมก่อนดำเนินการต่อ",
  forwarded: "เรื่องถูกส่งต่อให้ผู้เกี่ยวข้องช่วยดำเนินการ",
  in_progress: "ทีมงานกำลังแก้ไขหรือประสานงานตามขั้นตอน",
  resolved: "ดำเนินการแก้ไขเสร็จแล้ว และรอปิดเรื่องตามกระบวนการ",
  closed: "เรื่องนี้จบกระบวนการแล้ว",
  rejected: "เรื่องนี้ไม่อยู่ในขอบเขตที่ระบบสามารถดำเนินการได้",
};

const form = document.querySelector("#track-form");
const codeInput = document.querySelector("#tracking-code");
const submitButton = document.querySelector("#track-submit");
const statusBox = document.querySelector("#track-status");
const emptyState = document.querySelector("#empty-state");
const resultCard = document.querySelector("#result-card");
const codeError = document.querySelector('[data-error-for="code"]');
const resultTitle = document.querySelector("#result-title");
const resultCode = document.querySelector("#result-code");
const statusChip = document.querySelector("#status-chip");
const statusDescription = document.querySelector("#status-description");
const categoryName = document.querySelector("#category-name");
const createdAt = document.querySelector("#created-at");
const updatedAt = document.querySelector("#updated-at");
const locationText = document.querySelector("#location-text");
const timelineList = document.querySelector("#timeline-list");
const feedbackSection = document.querySelector("#feedback-section");
const feedbackForm = document.querySelector("#feedback-form");
const feedbackSubmit = document.querySelector("#feedback-submit");
const feedbackComment = document.querySelector("#feedback-comment");
const feedbackStatus = document.querySelector("#feedback-status");
const feedbackScoreError = document.querySelector('[data-error-for="feedback-score"]');

let isSearching = false;
let isSubmittingFeedback = false;
let currentReport = null;

function normalizeTrackingCode(value) {
  return String(value || "").trim().toUpperCase();
}

function setStatus(message, type = "info") {
  statusBox.hidden = !message;
  statusBox.textContent = message;
  statusBox.dataset.type = type;
}

function setCodeError(message) {
  codeError.textContent = message || "";
}

function setLoading(loading) {
  isSearching = loading;
  submitButton.disabled = loading;
  submitButton.textContent = loading ? "กำลังค้นหา..." : "ค้นหา";
}

function setViewState(state) {
  emptyState.hidden = state !== "empty";
  resultCard.hidden = state !== "result";
}

function setFeedbackStatus(message, type = "info") {
  feedbackStatus.hidden = !message;
  feedbackStatus.textContent = message;
  feedbackStatus.dataset.type = type;
}

function setFeedbackScoreError(message) {
  feedbackScoreError.textContent = message || "";
}

function setFeedbackLoading(loading) {
  isSubmittingFeedback = loading;
  feedbackSubmit.disabled = loading;
  feedbackSubmit.textContent = loading ? "กำลังส่ง..." : "ส่งความคิดเห็น";
}

function resetFeedbackForm() {
  setFeedbackStatus("");
  setFeedbackScoreError("");
  feedbackForm.hidden = false;
  feedbackForm.reset();
}

function updateFeedbackVisibility(status) {
  const canSendFeedback = FEEDBACK_ALLOWED_STATUSES.has(status);
  feedbackSection.hidden = !canSendFeedback;

  if (canSendFeedback) {
    resetFeedbackForm();
    return;
  }

  setFeedbackStatus("");
  setFeedbackScoreError("");
}

function formatDate(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getStatusText(status) {
  return STATUS_TEXT[status] || "กำลังดำเนินการ";
}

function getStatusDescription(status) {
  return STATUS_DESCRIPTION[status] || "ทีมงานกำลังอัปเดตความคืบหน้าของเรื่องนี้";
}

function statusClassName(status) {
  const safeStatus = String(status || "new").replace(/[^a-z0-9_]/g, "");
  return `status-chip status-${safeStatus}`;
}

function getApiMessage(payload, fallback) {
  if (payload?.error?.code === "TRACKING_NOT_FOUND") {
    return "ไม่พบรหัสติดตามนี้ กรุณาตรวจสอบรหัสอีกครั้ง";
  }

  return payload?.error?.message || payload?.message || fallback;
}

function normalizeReport(payload) {
  if (payload?.data?.report) {
    return payload.data.report;
  }

  return payload?.data || null;
}

function renderTimeline(items) {
  timelineList.replaceChildren();

  if (!Array.isArray(items) || items.length === 0) {
    const item = document.createElement("li");
    item.className = "timeline-item";

    const title = document.createElement("strong");
    title.textContent = "ยังไม่มี timeline ที่เปิดเผยได้";

    const note = document.createElement("p");
    note.textContent = "เมื่อมีความคืบหน้าที่เผยแพร่ได้ ระบบจะแสดงรายการในส่วนนี้";

    item.append(title, note);
    timelineList.append(item);
    return;
  }

  items.forEach((entry) => {
    const item = document.createElement("li");
    item.className = "timeline-item";

    const title = document.createElement("strong");
    title.textContent = getStatusText(entry.status);

    const date = document.createElement("time");
    date.dateTime = entry.created_at || "";
    date.textContent = formatDate(entry.created_at);

    const note = document.createElement("p");
    note.textContent = entry.update_note || "อัปเดตสถานะ";

    item.append(title, date, note);
    timelineList.append(item);
  });
}

function renderReport(report) {
  const status = report.status || "new";
  currentReport = report;

  resultTitle.textContent = report.title || "เรื่องที่แจ้งไว้";
  resultCode.textContent = report.tracking_code || "";
  statusChip.textContent = getStatusText(status);
  statusChip.className = statusClassName(status);
  statusDescription.textContent = getStatusDescription(status);
  categoryName.textContent = report.category_name || "-";
  createdAt.textContent = formatDate(report.created_at);
  updatedAt.textContent = formatDate(report.updated_at || report.created_at);
  locationText.textContent = report.location_text || "-";

  renderTimeline(report.timeline);
  updateFeedbackVisibility(status);
  setViewState("result");
}

function getSelectedFeedbackScore() {
  const checked = feedbackForm.querySelector('input[name="score"]:checked');
  return checked ? Number(checked.value) : null;
}

function getFeedbackApiMessage(payload, fallback) {
  if (payload?.error?.code === "FEEDBACK_NOT_ALLOWED") {
    return "ส่งความคิดเห็นได้เฉพาะเรื่องที่แก้ไขแล้วหรือปิดเรื่องแล้ว";
  }

  if (payload?.error?.code === "TRACKING_NOT_FOUND") {
    return "ไม่พบรหัสติดตามนี้ กรุณาตรวจสอบอีกครั้ง";
  }

  return payload?.error?.message || payload?.message || fallback;
}

async function submitFeedback() {
  if (isSubmittingFeedback || !currentReport?.tracking_code) {
    return;
  }

  setFeedbackStatus("");
  setFeedbackScoreError("");

  const score = getSelectedFeedbackScore();
  const comment = feedbackComment.value.trim();

  if (!score || score < 1 || score > 5) {
    setFeedbackScoreError("กรุณาเลือกคะแนน 1 ถึง 5");
    setFeedbackStatus("กรุณาเลือกคะแนนก่อนส่งความคิดเห็น", "error");
    return;
  }

  setFeedbackLoading(true);
  setFeedbackStatus("กำลังส่งความคิดเห็น...", "info");

  try {
    const response = await fetch("/api/reports/feedback", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        tracking_code: currentReport.tracking_code,
        score,
        comment,
      }),
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload?.ok) {
      throw new Error(
        getFeedbackApiMessage(payload, "ไม่สามารถส่งความคิดเห็นได้ กรุณาลองใหม่อีกครั้ง")
      );
    }

    feedbackForm.hidden = true;
    setFeedbackStatus("ขอบคุณสำหรับความคิดเห็น ทีมงานจะนำไปปรับปรุงการดูแลชุมชน", "success");
  } catch (error) {
    setFeedbackStatus(
      error.message || "ไม่สามารถส่งความคิดเห็นได้ กรุณาลองใหม่อีกครั้ง",
      "error"
    );
  } finally {
    setFeedbackLoading(false);
  }
}

async function searchTrackingCode(rawCode) {
  const trackingCode = normalizeTrackingCode(rawCode);
  codeInput.value = trackingCode;
  setCodeError("");
  setStatus("");

  if (!TRACKING_CODE_PATTERN.test(trackingCode)) {
    setCodeError("กรุณากรอกรหัสติดตามให้ถูกต้อง เช่น HSC-2026-0001");
    setStatus("รูปแบบรหัสติดตามไม่ถูกต้อง", "error");
    setViewState("empty");
    return;
  }

  if (isSearching) {
    return;
  }

  setLoading(true);
  setStatus("กำลังค้นหาข้อมูล...", "info");

  try {
    const response = await fetch(
      `/api/reports/track?code=${encodeURIComponent(trackingCode)}`,
      {
        headers: {
          Accept: "application/json",
        },
      }
    );
    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload?.ok) {
      throw new Error(
        getApiMessage(payload, "ไม่สามารถค้นหาข้อมูลได้ กรุณาลองใหม่อีกครั้ง")
      );
    }

    const report = normalizeReport(payload);

    if (!report) {
      throw new Error("ไม่พบข้อมูลสถานะของรหัสนี้");
    }

    renderReport(report);
    setStatus("");

    const url = new URL(window.location.href);
    url.searchParams.set("code", trackingCode);
    window.history.replaceState({}, "", url);
  } catch (error) {
    setViewState("empty");
    setStatus(
      error.message || "ไม่สามารถค้นหาข้อมูลได้ กรุณาลองใหม่อีกครั้ง",
      "error"
    );
  } finally {
    setLoading(false);
  }
}

function initTrackPage() {
  setViewState("empty");
  feedbackSection.hidden = true;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    searchTrackingCode(codeInput.value);
  });

  feedbackForm.addEventListener("submit", (event) => {
    event.preventDefault();
    submitFeedback();
  });

  feedbackForm.addEventListener("change", () => {
    setFeedbackScoreError("");
    if (!isSubmittingFeedback) {
      setFeedbackStatus("");
    }
  });

  codeInput.addEventListener("input", () => {
    setCodeError("");
  });

  const params = new URLSearchParams(window.location.search);
  const codeFromUrl = normalizeTrackingCode(params.get("code"));

  if (codeFromUrl) {
    codeInput.value = codeFromUrl;
    searchTrackingCode(codeFromUrl);
  }
}

document.addEventListener("DOMContentLoaded", initTrackPage);
