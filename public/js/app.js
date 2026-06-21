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

const bottomNavItems = [
  {
    id: "home",
    label: "หน้าแรก",
    href: "/index.html",
    paths: ["/", "/index.html"],
    icon:
      '<path d="m3 11 9-8 9 8"></path><path d="M5 10v10h14V10"></path><path d="M9 20v-6h6v6"></path>',
  },
  {
    id: "report",
    label: "แจ้งปัญหา",
    href: "/report.html",
    paths: ["/report.html"],
    icon:
      '<path d="M6 3h9l3 3v15H6z"></path><path d="M14 3v4h4"></path><path d="M12 11v6"></path><path d="M9 14h6"></path>',
  },
  {
    id: "emergency",
    label: "ฉุกเฉิน",
    href: "/emergency.html",
    paths: ["/emergency.html"],
    icon:
      '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"></path>',
  },
  {
    id: "track",
    label: "ติดตามเรื่อง",
    href: "/track.html",
    paths: ["/track.html"],
    icon:
      '<circle cx="11" cy="11" r="7"></circle><path d="m21 21-4.3-4.3"></path><path d="M11 8v6"></path><path d="M8 11h6"></path>',
  },
  {
    id: "works",
    label: "ผลงาน",
    href: "/works.html",
    paths: ["/works.html"],
    icon:
      '<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"></path>',
  },
];

function normalizePathname(pathname) {
  if (!pathname || pathname === "/") {
    return "/";
  }

  return pathname.endsWith("/") && pathname.length > 1
    ? pathname.slice(0, -1)
    : pathname;
}

function createBottomNavIcon(item) {
  const icon = document.createElement("span");
  icon.className =
    item.id === "emergency"
      ? "bottom-nav__emergency-icon"
      : "bottom-nav__icon";
  icon.setAttribute("aria-hidden", "true");
  icon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${item.icon}</svg>`;

  return icon;
}

function createBottomNavItem(item, currentPath) {
  const link = document.createElement("a");
  const isActive = item.paths.includes(currentPath);

  link.className = "bottom-nav__item";
  if (item.id === "emergency") {
    link.classList.add("bottom-nav__item--emergency");
  }
  if (isActive) {
    link.classList.add("is-active");
    link.setAttribute("aria-current", "page");
  }

  link.href = item.href;
  link.append(createBottomNavIcon(item));

  const label = document.createElement("span");
  label.className = "bottom-nav__label";
  label.textContent = item.label;
  link.append(label);

  return link;
}

function initBottomNav() {
  if (!document.body?.hasAttribute("data-bottom-nav")) {
    return;
  }

  if (document.querySelector(".bottom-nav")) {
    return;
  }

  const nav = document.createElement("nav");
  const currentPath = normalizePathname(window.location.pathname);

  nav.className = "bottom-nav";
  nav.setAttribute("aria-label", "เมนูหลัก");
  bottomNavItems.forEach((item) => {
    nav.append(createBottomNavItem(item, currentPath));
  });

  document.body.classList.add("has-bottom-nav");
  document.body.append(nav);
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
  initBottomNav();
  initSuccessPage();
});
