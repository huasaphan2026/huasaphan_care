(function () {
  "use strict";

  var form = document.getElementById("export-form");
  var dateFromInput = document.getElementById("date-from");
  var dateToInput = document.getElementById("date-to");
  var statusFilter = document.getElementById("status-filter");
  var categoryFilter = document.getElementById("category-filter");
  var downloadButton = document.getElementById("download-button");
  var clearButton = document.getElementById("clear-button");
  var statusBox = document.getElementById("export-status");

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

  function setLoading(isLoading) {
    if (!downloadButton) {
      return;
    }

    downloadButton.disabled = isLoading;
    downloadButton.textContent = isLoading ? "กำลังเตรียมไฟล์..." : "ดาวน์โหลด CSV";
  }

  function normalizeCategories(payload) {
    if (!payload || !payload.ok || !payload.data) {
      return [];
    }

    if (Array.isArray(payload.data.categories)) {
      return payload.data.categories;
    }

    if (Array.isArray(payload.data)) {
      return payload.data;
    }

    return [];
  }

  async function loadCategories() {
    if (!categoryFilter) {
      return;
    }

    try {
      var response = await fetch("/api/public/categories", {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "application/json"
        }
      });

      if (response.status === 401) {
        redirectToLogin();
        return;
      }

      if (!response.ok) {
        throw new Error("CATEGORY_REQUEST_FAILED");
      }

      var payload = await response.json();
      var categories = normalizeCategories(payload);

      categories.forEach(function (category) {
        var option = document.createElement("option");
        option.value = String(category.id);
        option.textContent = category.name || category.code || ("หมวด " + category.id);
        categoryFilter.appendChild(option);
      });
    } catch {
      setStatus("โหลดหมวดปัญหาไม่สำเร็จ แต่ยังสามารถส่งออกโดยไม่เลือกหมวดได้", "error");
    }
  }

  function isValidDateRange() {
    if (!dateFromInput || !dateToInput || !dateFromInput.value || !dateToInput.value) {
      return true;
    }

    return dateFromInput.value <= dateToInput.value;
  }

  function buildExportUrl() {
    var params = new URLSearchParams();

    if (dateFromInput && dateFromInput.value) {
      params.set("date_from", dateFromInput.value);
    }

    if (dateToInput && dateToInput.value) {
      params.set("date_to", dateToInput.value);
    }

    if (statusFilter && statusFilter.value) {
      params.set("status", statusFilter.value);
    }

    if (categoryFilter && categoryFilter.value) {
      params.set("category_id", categoryFilter.value);
    }

    var query = params.toString();
    return "/api/admin/export-csv" + (query ? "?" + query : "");
  }

  function getFilename(response) {
    var disposition = response.headers.get("Content-Disposition") || "";
    var match = disposition.match(/filename="?([^";]+)"?/i);

    if (match && match[1]) {
      return match[1];
    }

    return "hua-saphan-care-reports.csv";
  }

  async function getErrorMessage(response) {
    if (response.status === 403) {
      return "บัญชีนี้ไม่มีสิทธิ์ส่งออกรายงาน";
    }

    try {
      var payload = await response.json();

      if (payload && payload.message) {
        return payload.message;
      }
    } catch {
      return "ดาวน์โหลดไฟล์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
    }

    return "ดาวน์โหลดไฟล์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function handleExport(event) {
    event.preventDefault();

    if (!isValidDateRange()) {
      setStatus("วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด", "error");
      return;
    }

    setLoading(true);
    setStatus("กำลังเตรียมไฟล์ CSV...", "");

    try {
      var response = await fetch(buildExportUrl(), {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "text/csv"
        }
      });

      if (response.status === 401) {
        redirectToLogin();
        return;
      }

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      var blob = await response.blob();
      downloadBlob(blob, getFilename(response));
      setStatus("ดาวน์โหลดไฟล์ CSV สำเร็จ ไฟล์นี้ไม่มีข้อมูลส่วนตัวของผู้แจ้งโดยค่าเริ่มต้น", "success");
    } catch (error) {
      setStatus(error.message || "ดาวน์โหลดไฟล์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง", "error");
    } finally {
      setLoading(false);
    }
  }

  function clearFilters() {
    if (dateFromInput) {
      dateFromInput.value = "";
    }

    if (dateToInput) {
      dateToInput.value = "";
    }

    if (statusFilter) {
      statusFilter.value = "";
    }

    if (categoryFilter) {
      categoryFilter.value = "";
    }

    setStatus("", "");
  }

  function initEvents() {
    if (form) {
      form.addEventListener("submit", handleExport);
    }

    if (clearButton) {
      clearButton.addEventListener("click", clearFilters);
    }
  }

  initEvents();
  loadCategories();
}());
