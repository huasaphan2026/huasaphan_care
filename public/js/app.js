function setStatusMessage(element, message, type = "info") {
  if (!element) {
    return;
  }

  element.hidden = !message;
  element.textContent = message;
  element.dataset.type = type;
}

function ensurePwaMetadata() {
  if (!document.querySelector('link[rel="manifest"]')) {
    const manifest = document.createElement("link");
    manifest.rel = "manifest";
    manifest.href = "/manifest.webmanifest";
    document.head.appendChild(manifest);
  }

  if (!document.querySelector('meta[name="theme-color"]')) {
    const themeColor = document.createElement("meta");
    themeColor.name = "theme-color";
    themeColor.content = "#1C8C87";
    document.head.appendChild(themeColor);
  }
}

function getStoredTrackingCode() {
  try {
    return (sessionStorage.getItem("hsc_tracking_code") || "").trim();
  } catch {
    return "";
  }
}

function storeTrackingCode(code) {
  try {
    sessionStorage.setItem("hsc_tracking_code", code);
  } catch {
    // The code remains visible from the URL even if temporary storage is blocked.
  }
}

function getStoredUploadWarning() {
  try {
    const warning = (sessionStorage.getItem("hsc_upload_warning") || "").trim();
    sessionStorage.removeItem("hsc_upload_warning");
    return warning;
  } catch {
    return "";
  }
}

function disableCodeActions() {
  document.querySelectorAll("[data-requires-code]").forEach((action) => {
    if ("disabled" in action) {
      action.disabled = true;
      return;
    }

    action.setAttribute("aria-disabled", "true");
    action.removeAttribute("href");
  });
}

function initSuccessPage() {
  const codeElement = document.querySelector("[data-tracking-code]");

  if (!codeElement) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const codeFromUrl = (params.get("code") || "").trim();
  const trackingCode = codeFromUrl || getStoredTrackingCode();
  const hasUploadWarning = params.get("upload_warning") === "1";
  const statusElement = document.querySelector("#success-status");
  const copyButton = document.querySelector("#copy-tracking-code");
  const trackLink = document.querySelector("#track-link");
  const uploadWarning =
    getStoredUploadWarning() ||
    (hasUploadWarning ? "แจ้งเรื่องสำเร็จ แต่อัปโหลดรูปไม่ครบ" : "");

  if (!trackingCode) {
    codeElement.textContent = "ไม่พบรหัสติดตาม";
    setStatusMessage(
      statusElement,
      "ไม่พบรหัสติดตาม กรุณาตรวจสอบลิงก์หรือกลับไปแจ้งเรื่องใหม่อีกครั้ง",
      "error"
    );
    disableCodeActions();
    return;
  }

  codeElement.textContent = trackingCode;
  storeTrackingCode(trackingCode);

  if (uploadWarning) {
    setStatusMessage(statusElement, uploadWarning, "error");
  }

  if (trackLink) {
    trackLink.href = `track.html?code=${encodeURIComponent(trackingCode)}`;
  }

  if (copyButton) {
    copyButton.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(trackingCode);
        setStatusMessage(statusElement, "คัดลอกรหัสติดตามแล้ว", "success");
      } catch {
        setStatusMessage(
          statusElement,
          "คัดลอกอัตโนมัติไม่ได้ กรุณาจดรหัสติดตามไว้",
          "error"
        );
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  ensurePwaMetadata();
  initSuccessPage();
});
