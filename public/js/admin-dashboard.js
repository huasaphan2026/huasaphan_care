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

  var statusBox = document.getElementById("dashboard-status");
  var latestList = document.getElementById("latest-reports");
  var latestEmpty = document.getElementById("latest-empty");
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

  function renderLatest(reports) {
    if (!latestList || !latestEmpty) {
      return;
    }

    latestList.textContent = "";

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

      renderSummary(data);
      renderLatest(data.latest_reports);
      setStatus("", "");
    } catch (error) {
      setStatus("โหลดข้อมูลแดชบอร์ดไม่สำเร็จ กรุณาลองใหม่อีกครั้ง", "error");
    }
  }

  if (logoutButton) {
    logoutButton.addEventListener("click", handleLogout);
  }

  initDashboard();
}());
