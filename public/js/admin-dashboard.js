(function () {
  "use strict";

  var STATUS_LABELS = {
    new: "เรื่องใหม่",
    accepted: "รับเรื่องแล้ว",
    checking: "กำลังตรวจสอบ",
    in_progress: "กำลังดำเนินการ",
    resolved: "แก้ไขแล้ว",
    closed: "ปิดเรื่อง",
    rejected: "ไม่รับดำเนินการ",
    waiting_info: "รอข้อมูลเพิ่มเติม",
    forwarded: "ส่งต่อหน่วยงาน"
  };

  var PRIORITY_LABELS = {
    urgent: "เร่งด่วน",
    high: "สำคัญ",
    normal: "ปกติ",
    low: "ทั่วไป"
  };

  var SCOPE_TEXT = {
    all: {
      label: "ภาพรวมทั้งระบบ",
      copy: "ติดตามจำนวนเรื่องและรายการล่าสุดของระบบรับเรื่องชุมชนหัวสะพาน",
      latestLabel: "รวมทั้งหมด",
      latestCopy: "แสดงเฉพาะข้อมูลที่จำเป็นสำหรับเจ้าหน้าที่ ไม่มีเบอร์โทรหรือข้อมูลส่วนตัวของผู้แจ้ง",
      empty: "ยังไม่มีรายการแจ้งเรื่องในระบบ"
    },
    assigned: {
      label: "ภาพรวมงานที่ได้รับมอบหมาย",
      copy: "ติดตามจำนวนเรื่องและรายการล่าสุดเฉพาะงานที่มอบหมายให้คุณ",
      latestLabel: "งานที่ได้รับมอบหมาย",
      latestCopy: "แสดงเฉพาะรายการล่าสุดของงานที่มอบหมายให้คุณ",
      empty: "ยังไม่มีงานที่มอบหมายให้คุณ"
    },
    public: {
      label: "ภาพรวมรายงานสาธารณะ",
      copy: "แสดงเฉพาะสถิติสรุปที่เผยแพร่ได้และไม่มีข้อมูลส่วนบุคคล",
      latestLabel: "รายงานสาธารณะ",
      latestCopy: "รายการรายชิ้นถูกซ่อนไว้เพื่อป้องกันข้อมูลส่วนบุคคล",
      empty: "ไม่มีรายการรายชิ้นที่เปิดให้ดูในแดชบอร์ดนี้"
    }
  };

  var statusBox = document.getElementById("dashboard-status");
  var latestSection = document.getElementById("latest-section");
  var latestList = document.getElementById("latest-reports");
  var latestEmpty = document.getElementById("latest-empty");
  var dashboardScopeLabel = document.getElementById("dashboard-scope-label");
  var dashboardScopeCopy = document.getElementById("dashboard-scope-copy");
  var latestScopeLabel = document.getElementById("latest-scope-label");
  var latestScopeCopy = document.getElementById("latest-scope-copy");
  var logoutButton = document.getElementById("logout-button");

  function redirectToLogin() {
    window.location.replace("login.html");
  }

  function setStatus(message, type) {
    if (!statusBox) {
      return;
    }

    statusBox.textContent = message;
    statusBox.hidden = !message;

    if (type) {
      statusBox.dataset.type = type;
    } else {
      delete statusBox.dataset.type;
    }
  }

  function formatNumber(value) {
    var number = Number(value);

    if (!Number.isFinite(number)) {
      return "0";
    }

    return number.toLocaleString("th-TH");
  }

  function formatThaiDate(value) {
    if (!value) {
      return "-";
    }

    var date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "-";
    }

    return new Intl.DateTimeFormat("th-TH", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date);
  }

  function getStatusLabel(status) {
    return STATUS_LABELS[status] || "ไม่ทราบสถานะ";
  }

  function getPriorityLabel(priority) {
    return PRIORITY_LABELS[priority] || "ปกติ";
  }

  function setSummaryValue(key, value) {
    var element = document.querySelector('[data-summary="' + key + '"]');

    if (element) {
      element.textContent = formatNumber(value);
    }
  }

  function renderSummary(data) {
    setSummaryValue("new_reports", data.new_reports);
    setSummaryValue("urgent_reports", data.urgent_reports);
    setSummaryValue("in_progress_reports", data.in_progress_reports);
    setSummaryValue("resolved_reports", data.resolved_reports);

    var total = document.querySelector("[data-total-reports]");

    if (total) {
      total.textContent = formatNumber(data.total_reports);
    }
  }

  function renderScope(permissions, totalReports) {
    var scope = permissions && permissions.scope ? permissions.scope : "all";
    var text = SCOPE_TEXT[scope] || SCOPE_TEXT.all;

    if (dashboardScopeLabel) {
      dashboardScopeLabel.textContent = text.label;
    }

    if (dashboardScopeCopy) {
      dashboardScopeCopy.textContent = text.copy;
    }

    if (latestScopeLabel) {
      latestScopeLabel.textContent = text.latestLabel + " " + formatNumber(totalReports) + " เรื่อง";
    }

    if (latestScopeCopy) {
      latestScopeCopy.textContent = text.latestCopy;
    }

    if (latestEmpty) {
      latestEmpty.textContent = text.empty;
    }

    if (latestSection) {
      latestSection.hidden = permissions && permissions.can_view_latest_reports === false;
    }
  }

  function resetDashboard() {
    renderSummary({
      total_reports: 0,
      new_reports: 0,
      urgent_reports: 0,
      in_progress_reports: 0,
      resolved_reports: 0
    });

    if (latestList) {
      latestList.textContent = "";
    }

    if (latestEmpty) {
      latestEmpty.hidden = false;
    }
  }

  function createChip(text, status) {
    var chip = document.createElement("span");
    chip.className = "status-chip";
    chip.textContent = text;

    if (status) {
      chip.classList.add("status-" + status.replace(/_/g, "-"));
    }

    return chip;
  }

  function appendTextLine(parent, text) {
    var paragraph = document.createElement("p");
    paragraph.textContent = text;
    parent.appendChild(paragraph);
  }

  function renderLatest(reports, permissions) {
    if (!latestList || !latestEmpty) {
      return;
    }

    latestList.textContent = "";

    if (permissions && permissions.can_view_latest_reports === false) {
      latestEmpty.hidden = false;
      return;
    }

    if (!Array.isArray(reports) || reports.length === 0) {
      latestEmpty.hidden = false;
      return;
    }

    latestEmpty.hidden = true;

    reports.slice(0, 10).forEach(function (report) {
      var item = document.createElement("li");
      item.className = "timeline-item";

      var title = document.createElement("strong");
      title.textContent = report.title || "ไม่มีหัวข้อ";
      item.appendChild(title);

      appendTextLine(item, "รหัสติดตาม: " + (report.tracking_code || "-"));
      appendTextLine(item, "หมวด: " + (report.category_name || "-"));
      appendTextLine(item, "แจ้งเมื่อ: " + formatThaiDate(report.created_at));

      var chipRow = document.createElement("div");
      chipRow.className = "hero-actions";
      chipRow.appendChild(createChip(getStatusLabel(report.status), report.status));
      chipRow.appendChild(createChip(getPriorityLabel(report.priority), report.priority === "urgent" ? "urgent" : ""));
      item.appendChild(chipRow);

      latestList.appendChild(item);
    });
  }

  async function fetchDashboard() {
    var response = await fetch("/api/admin/dashboard", {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json"
      }
    });

    if (response.status === 401) {
      redirectToLogin();
      return null;
    }

    if (response.status === 403) {
      throw new Error("DASHBOARD_FORBIDDEN");
    }

    if (!response.ok) {
      throw new Error("DASHBOARD_REQUEST_FAILED");
    }

    var payload = await response.json();

    if (!payload.ok || !payload.data) {
      throw new Error("DASHBOARD_RESPONSE_INVALID");
    }

    return payload.data;
  }

  async function handleLogout() {
    if (logoutButton) {
      logoutButton.disabled = true;
      logoutButton.textContent = "กำลังออกจากระบบ...";
    }

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json"
        }
      });
    } finally {
      redirectToLogin();
    }
  }

  async function initDashboard() {
    setStatus("กำลังโหลดข้อมูล...", "");

    try {
      var data = await fetchDashboard();

      if (!data) {
        return;
      }

      renderScope(data.permissions, data.total_reports);
      renderSummary(data);
      renderLatest(data.latest_reports, data.permissions);
      setStatus("", "");
    } catch (error) {
      resetDashboard();
      setStatus(
        error && error.message === "DASHBOARD_FORBIDDEN"
          ? "บัญชีนี้ไม่มีสิทธิ์ดูแดชบอร์ด"
          : "โหลดข้อมูลแดชบอร์ดไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
        "error"
      );
    }
  }

  if (logoutButton) {
    logoutButton.addEventListener("click", handleLogout);
  }

  initDashboard();
}());
