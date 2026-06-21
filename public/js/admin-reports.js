(function () {
  "use strict";

  var DEFAULT_LIMIT = 20;

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

  var state = {
    page: 1,
    limit: DEFAULT_LIMIT,
    q: "",
    status: "",
    categoryId: "",
    priority: "",
    totalPages: 1,
    isLoading: false
  };

  var form = document.getElementById("reports-filter-form");
  var searchInput = document.getElementById("report-search");
  var statusFilter = document.getElementById("status-filter");
  var categoryFilter = document.getElementById("category-filter");
  var priorityFilter = document.getElementById("priority-filter");
  var clearButton = document.getElementById("clear-button");
  var searchButton = document.getElementById("search-button");
  var statusBox = document.getElementById("reports-status");
  var emptyBox = document.getElementById("reports-empty");
  var countText = document.getElementById("reports-count");
  var cardList = document.getElementById("reports-card-list");
  var tableBody = document.getElementById("reports-table-body");
  var paginationSummary = document.getElementById("pagination-summary");
  var prevButton = document.getElementById("prev-page");
  var nextButton = document.getElementById("next-page");

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
    state.isLoading = isLoading;

    if (searchButton) {
      searchButton.disabled = isLoading;
      searchButton.textContent = isLoading ? "กำลังโหลด..." : "ค้นหา";
    }

    if (prevButton) {
      prevButton.disabled = isLoading || state.page <= 1;
    }

    if (nextButton) {
      nextButton.disabled = isLoading || state.page >= state.totalPages;
    }
  }

  function formatNumber(value) {
    var number = Number(value);
    return Number.isFinite(number) ? number.toLocaleString("th-TH") : "0";
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

  function createTextElement(tagName, text, className) {
    var element = document.createElement(tagName);
    element.textContent = text;

    if (className) {
      element.className = className;
    }

    return element;
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

  function createDetailLink(report) {
    var link = document.createElement("a");
    link.className = "button button-secondary";
    link.href = "/admin/report-detail.html?id=" + encodeURIComponent(report.id);
    link.textContent = "เปิดรายละเอียด";
    return link;
  }

  function getReportSummary(report) {
    return report.title || report.public_summary || report.tracking_code || "-";
  }

  function getReportLocationLabel(report) {
    return report.location_text || report.public_location_label || "-";
  }

  function appendDetailLink(container, report) {
    if (report && report.id) {
      container.appendChild(createDetailLink(report));
    }
  }

  function clearElement(element) {
    if (element) {
      element.textContent = "";
    }
  }

  function getQueryParams() {
    var params = new URLSearchParams();

    params.set("page", String(state.page));
    params.set("limit", String(state.limit));

    if (state.q) {
      params.set("q", state.q);
    }

    if (state.status) {
      params.set("status", state.status);
    }

    if (state.categoryId) {
      params.set("category_id", state.categoryId);
    }

    if (state.priority) {
      params.set("priority", state.priority);
    }

    return params;
  }

  function syncFormFromState() {
    if (searchInput) {
      searchInput.value = state.q;
    }

    if (statusFilter) {
      statusFilter.value = state.status;
    }

    if (categoryFilter) {
      categoryFilter.value = state.categoryId;
    }

    if (priorityFilter) {
      priorityFilter.value = state.priority;
    }
  }

  function syncStateFromUrl() {
    var params = new URLSearchParams(window.location.search);
    var page = Number.parseInt(params.get("page") || "1", 10);

    state.page = Number.isInteger(page) && page > 0 ? page : 1;
    state.q = String(params.get("q") || "").trim().slice(0, 100);
    state.status = params.get("status") || "";
    state.categoryId = params.get("category_id") || "";
    state.priority = params.get("priority") || "";
  }

  function updateUrl() {
    var params = getQueryParams();
    var nextUrl = window.location.pathname + "?" + params.toString();
    window.history.replaceState(null, "", nextUrl);
  }

  function getReportsData(payload) {
    if (!payload || !payload.ok || !payload.data) {
      throw new Error("REPORTS_RESPONSE_INVALID");
    }

    return payload.data;
  }

  async function fetchJson(url) {
    var response = await fetch(url, {
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
      throw new Error("REQUEST_FAILED");
    }

    return response.json();
  }

  async function loadCategories() {
    if (!categoryFilter) {
      return;
    }

    try {
      var payload = await fetchJson("/api/public/categories");

      if (!payload) {
        return;
      }

      var categories = payload.data && Array.isArray(payload.data.categories)
        ? payload.data.categories
        : [];

      categories.forEach(function (category) {
        var option = document.createElement("option");
        option.value = String(category.id);
        option.textContent = category.name || category.code || ("หมวด " + category.id);
        categoryFilter.appendChild(option);
      });

      categoryFilter.value = state.categoryId;
    } catch {
      setStatus("โหลดหมวดปัญหาไม่สำเร็จ แต่ยังค้นหารายการเรื่องได้", "error");
    }
  }

  async function loadReports() {
    setLoading(true);
    setStatus("กำลังโหลดข้อมูล...", "");
    updateUrl();

    try {
      var payload = await fetchJson("/api/admin/reports?" + getQueryParams().toString());

      if (!payload) {
        return;
      }

      var data = getReportsData(payload);
      renderReports(data.reports || []);
      renderPagination(data.pagination || {});
      setStatus("", "");
    } catch {
      renderReports([]);
      renderPagination({ page: state.page, total_pages: 1, total: 0 });
      setStatus("โหลดรายการเรื่องไม่สำเร็จ กรุณาลองใหม่อีกครั้ง", "error");
    } finally {
      setLoading(false);
    }
  }

  function renderReports(reports) {
    clearElement(cardList);
    clearElement(tableBody);

    var hasReports = Array.isArray(reports) && reports.length > 0;

    if (emptyBox) {
      emptyBox.hidden = hasReports;
    }

    if (!hasReports) {
      return;
    }

    reports.forEach(function (report) {
      renderReportCard(report);
      renderReportRow(report);
    });
  }

  function renderReportCard(report) {
    if (!cardList) {
      return;
    }

    var card = document.createElement("article");
    card.className = "report-card";

    var header = document.createElement("div");
    header.appendChild(createTextElement("p", report.tracking_code || "-", "tracking-code-text"));
    header.appendChild(createTextElement("h2", getReportSummary(report)));
    card.appendChild(header);

    var meta = document.createElement("div");
    meta.className = "report-card-meta";
    meta.appendChild(createChip(getStatusLabel(report.status), report.status));
    meta.appendChild(createChip(getPriorityLabel(report.priority), report.priority === "urgent" ? "urgent" : ""));
    card.appendChild(meta);

    card.appendChild(createTextElement("p", "หมวด: " + (report.category_name || "-")));
    card.appendChild(createTextElement("p", "จุดเกิดเหตุ: " + getReportLocationLabel(report)));
    card.appendChild(createTextElement("p", "วันที่แจ้ง: " + formatThaiDate(report.created_at)));
    appendDetailLink(card, report);

    cardList.appendChild(card);
  }

  function renderReportRow(report) {
    if (!tableBody) {
      return;
    }

    var row = document.createElement("tr");
    var codeCell = document.createElement("td");
    var titleCell = document.createElement("td");
    var categoryCell = document.createElement("td");
    var statusCell = document.createElement("td");
    var priorityCell = document.createElement("td");
    var dateCell = document.createElement("td");
    var actionCell = document.createElement("td");

    codeCell.textContent = report.tracking_code || "-";

    titleCell.appendChild(createTextElement("strong", getReportSummary(report)));
    titleCell.appendChild(createTextElement("div", getReportLocationLabel(report), "muted"));

    categoryCell.textContent = report.category_name || "-";
    statusCell.appendChild(createChip(getStatusLabel(report.status), report.status));
    priorityCell.textContent = getPriorityLabel(report.priority);
    dateCell.textContent = formatThaiDate(report.created_at);
    appendDetailLink(actionCell, report);

    row.appendChild(codeCell);
    row.appendChild(titleCell);
    row.appendChild(categoryCell);
    row.appendChild(statusCell);
    row.appendChild(priorityCell);
    row.appendChild(dateCell);
    row.appendChild(actionCell);
    tableBody.appendChild(row);
  }

  function renderPagination(pagination) {
    var total = Number(pagination.total || 0);
    var page = Number(pagination.page || state.page || 1);
    var totalPages = Number(pagination.total_pages || 1);

    state.page = page;
    state.totalPages = Math.max(1, totalPages);

    if (countText) {
      countText.textContent = "พบ " + formatNumber(total) + " รายการ";
    }

    if (paginationSummary) {
      paginationSummary.textContent =
        "หน้า " + formatNumber(state.page) + " จาก " + formatNumber(state.totalPages);
    }

    if (prevButton) {
      prevButton.disabled = state.isLoading || state.page <= 1;
    }

    if (nextButton) {
      nextButton.disabled = state.isLoading || state.page >= state.totalPages;
    }
  }

  function applyFormFilters() {
    state.page = 1;
    state.q = searchInput ? searchInput.value.trim().slice(0, 100) : "";
    state.status = statusFilter ? statusFilter.value : "";
    state.categoryId = categoryFilter ? categoryFilter.value : "";
    state.priority = priorityFilter ? priorityFilter.value : "";
    loadReports();
  }

  function clearFilters() {
    state.page = 1;
    state.q = "";
    state.status = "";
    state.categoryId = "";
    state.priority = "";
    syncFormFromState();
    loadReports();
  }

  function goToPage(nextPage) {
    if (state.isLoading || nextPage < 1 || nextPage > state.totalPages) {
      return;
    }

    state.page = nextPage;
    loadReports();
  }

  function initEvents() {
    if (form) {
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        applyFormFilters();
      });
    }

    if (clearButton) {
      clearButton.addEventListener("click", clearFilters);
    }

    if (prevButton) {
      prevButton.addEventListener("click", function () {
        goToPage(state.page - 1);
      });
    }

    if (nextButton) {
      nextButton.addEventListener("click", function () {
        goToPage(state.page + 1);
      });
    }
  }

  async function initReportsPage() {
    syncStateFromUrl();
    syncFormFromState();
    initEvents();
    await loadCategories();
    await loadReports();
  }

  initReportsPage();
}());
