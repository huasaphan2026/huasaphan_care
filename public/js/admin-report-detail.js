(function () {
  "use strict";

  var STATUS_LABELS = {
    new: "เรื่องใหม่",
    accepted: "รับเรื่องแล้ว",
    checking: "กำลังตรวจสอบ",
    in_progress: "กำลังดำเนินการ",
    forwarded: "ส่งต่อหน่วยงาน",
    waiting_info: "รอข้อมูลเพิ่มเติม",
    resolved: "แก้ไขแล้ว",
    closed: "ปิดเรื่อง",
    rejected: "ไม่รับดำเนินการ"
  };

  var PRIORITY_LABELS = {
    low: "ไม่เร่งด่วน",
    normal: "ปกติ",
    high: "สำคัญ",
    urgent: "เร่งด่วน"
  };

  var state = {
    reportId: null,
    detail: null,
    isBusy: false
  };

  var els = {};

  document.addEventListener("DOMContentLoaded", function () {
    cacheElements();
    state.reportId = getReportId();
    bindForms();

    if (!state.reportId) {
      showStatus("ไม่พบรหัสเรื่องที่ต้องการเปิด", "error");
      setFormsDisabled(true);
      return;
    }

    loadReport();
  });

  function cacheElements() {
    els.title = document.getElementById("report-title");
    els.trackingCode = document.getElementById("tracking-code");
    els.summaryChips = document.getElementById("summary-chips");
    els.detailStatus = document.getElementById("detail-status");
    els.reportDetailList = document.getElementById("report-detail-list");
    els.reportDetailText = document.getElementById("report-detail-text");
    els.reporterList = document.getElementById("reporter-list");
    els.reporterNote = document.getElementById("reporter-note");
    els.timelineEmpty = document.getElementById("timeline-empty");
    els.timelineList = document.getElementById("timeline-list");
    els.attachmentsEmpty = document.getElementById("attachments-empty");
    els.attachmentsList = document.getElementById("attachments-list");
    els.assignmentsEmpty = document.getElementById("assignments-empty");
    els.assignmentsList = document.getElementById("assignments-list");
    els.publicAttachments = document.getElementById("public-attachments");
    els.statusForm = document.getElementById("status-form");
    els.updateForm = document.getElementById("update-form");
    els.assignmentForm = document.getElementById("assignment-form");
    els.publicForm = document.getElementById("public-form");
    els.statusInput = document.getElementById("status-input");
    els.statusNote = document.getElementById("status-note");
    els.statusPublic = document.getElementById("status-public");
    els.updateStatus = document.getElementById("update-status");
    els.updateNote = document.getElementById("update-note");
    els.updatePublic = document.getElementById("update-public");
    els.assigneeId = document.getElementById("assignee-id");
    els.assignmentDue = document.getElementById("assignment-due");
    els.assignmentNote = document.getElementById("assignment-note");
    els.publicVisible = document.getElementById("public-visible");
    els.publicSummary = document.getElementById("public-summary");
    els.publicLocation = document.getElementById("public-location");
    els.publicImageAllowed = document.getElementById("public-image-allowed");
  }

  function getReportId() {
    var params = new URLSearchParams(window.location.search);
    var id = Number(params.get("id"));
    if (!Number.isInteger(id) || id < 1) {
      return null;
    }
    return id;
  }

  function bindForms() {
    els.statusForm.addEventListener("submit", handleStatusSubmit);
    els.updateForm.addEventListener("submit", handleUpdateSubmit);
    els.assignmentForm.addEventListener("submit", handleAssignmentSubmit);
    els.publicForm.addEventListener("submit", handlePublicSubmit);
  }

  async function loadReport() {
    showStatus("กำลังโหลดข้อมูล...", "info");
    setFormsDisabled(true);

    try {
      var result = await fetchJson("/api/admin/reports/" + state.reportId);
      if (!result) {
        return;
      }
      state.detail = result.data;
      renderReport(state.detail);
      setFormsDisabled(!canManage(state.detail));
      showStatus(canManage(state.detail) ? "โหลดข้อมูลสำเร็จ" : "โหลดข้อมูลสำเร็จ คุณมีสิทธิ์ดูข้อมูลเท่านั้น", "success");
    } catch (error) {
      showStatus(error.message || "โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่", "error");
      setFormsDisabled(true);
    }
  }

  function renderReport(data) {
    var report = data.report || {};
    var category = data.category || {};
    var canViewPrivate = Boolean(data.permissions && data.permissions.can_view_private);

    setText(els.title, report.title || report.public_summary || "รายละเอียดเรื่อง");
    setText(els.trackingCode, report.tracking_code || "-");

    clear(els.summaryChips);
    els.summaryChips.appendChild(createChip(getStatusLabel(report.status), getStatusClass(report.status)));
    els.summaryChips.appendChild(createChip(getPriorityLabel(report.priority), getPriorityClass(report.priority)));

    renderDetailList(report, category, canViewPrivate);
    renderReporter(data.reporter || {}, canViewPrivate);
    renderTimeline(data.timeline || []);
    renderAttachments(data.attachments || [], canViewPrivate);
    renderAssignments(data.assignments || [], canViewPrivate);
    renderPublicSettings(data.public_settings || {}, canViewPrivate ? data.attachments || [] : []);

    if (report.status) {
      els.statusInput.value = report.status;
      els.updateStatus.value = report.status;
    }
  }

  function renderDetailList(report, category, canViewPrivate) {
    clear(els.reportDetailList);
    appendDetail(els.reportDetailList, "หมวด", category.name || "-");
    appendDetail(els.reportDetailList, "สถานะ", getStatusLabel(report.status));
    appendDetail(els.reportDetailList, "ความเร่งด่วน", getPriorityLabel(report.priority));
    appendDetail(
      els.reportDetailList,
      canViewPrivate ? "จุดเกิดเหตุ" : "พื้นที่เผยแพร่",
      canViewPrivate ? report.location_text || "-" : report.public_location_label || "ไม่มีสิทธิ์ดูข้อมูลนี้"
    );
    appendDetail(els.reportDetailList, "วันที่แจ้ง", formatThaiDate(report.created_at));
    appendDetail(els.reportDetailList, "อัปเดตล่าสุด", formatThaiDate(report.updated_at));
    if (report.closed_at) {
      appendDetail(els.reportDetailList, "วันที่ปิดเรื่อง", formatThaiDate(report.closed_at));
    }
    if (canViewPrivate && report.assigned_name) {
      appendDetail(els.reportDetailList, "ผู้รับผิดชอบปัจจุบัน", report.assigned_name);
    }
    setText(els.reportDetailText, canViewPrivate ? report.detail || "-" : report.public_summary || "ไม่มีสิทธิ์ดูข้อมูลนี้");
  }

  function renderReporter(reporter, canViewPrivate) {
    clear(els.reporterList);
    setText(els.reporterNote, "");

    if (!canViewPrivate || reporter.masked) {
      setText(els.reporterNote, "ไม่มีสิทธิ์ดูข้อมูลนี้");
      return;
    }

    appendDetail(els.reporterList, "ไม่ประสงค์เปิดเผยชื่อ", reporter.anonymous ? "ใช่" : "ไม่ใช่");

    if (reporter.name) {
      appendDetail(els.reporterList, "ชื่อผู้แจ้ง", reporter.name);
    }
    if (reporter.phone) {
      appendDetail(els.reporterList, "เบอร์โทร", reporter.phone);
    }
    if (!reporter.name && !reporter.phone) {
      setText(els.reporterNote, "ไม่มีข้อมูลผู้แจ้งเพิ่มเติม");
    }
  }

  function renderTimeline(items) {
    clear(els.timelineList);
    els.timelineEmpty.hidden = items.length > 0;

    items.forEach(function (item) {
      var li = document.createElement("li");
      li.className = "timeline-item";

      var title = document.createElement("strong");
      title.appendChild(createChip(getStatusLabel(item.status), getStatusClass(item.status)));
      li.appendChild(title);

      var note = document.createElement("p");
      note.textContent = item.update_note || "-";
      li.appendChild(note);

      var meta = document.createElement("small");
      meta.textContent = [
        item.is_public ? "เผยแพร่" : "ภายใน",
        item.updated_by_name ? "โดย " + item.updated_by_name : "",
        formatThaiDate(item.created_at)
      ].filter(Boolean).join(" | ");
      li.appendChild(meta);

      els.timelineList.appendChild(li);
    });
  }

  function renderAttachments(items, canViewPrivate) {
    clear(els.attachmentsList);

    if (!canViewPrivate) {
      els.attachmentsEmpty.hidden = false;
      setText(els.attachmentsEmpty, "ไม่มีสิทธิ์ดูข้อมูลนี้");
      return;
    }

    els.attachmentsEmpty.hidden = items.length > 0;

    items.forEach(function (item) {
      var li = document.createElement("li");
      li.className = "attachment-item";

      var name = document.createElement("strong");
      name.textContent = item.file_name || "ไฟล์แนบ";
      li.appendChild(name);

      var meta = document.createElement("p");
      meta.textContent = [
        item.file_type || "ไม่ระบุชนิดไฟล์",
        formatFileSize(item.file_size),
        item.purpose ? "ประเภท " + item.purpose : "",
        item.public_allowed ? "อนุญาตเผยแพร่" : "ไม่เผยแพร่",
        formatThaiDate(item.uploaded_at)
      ].filter(Boolean).join(" | ");
      li.appendChild(meta);

      els.attachmentsList.appendChild(li);
    });
  }

  function renderAssignments(items, canViewPrivate) {
    clear(els.assignmentsList);

    if (!canViewPrivate) {
      els.assignmentsEmpty.hidden = false;
      setText(els.assignmentsEmpty, "ไม่มีสิทธิ์ดูข้อมูลนี้");
      return;
    }

    els.assignmentsEmpty.hidden = items.length > 0;

    items.forEach(function (item) {
      var li = document.createElement("li");
      li.className = "attachment-item";

      var title = document.createElement("strong");
      title.textContent = item.assigned_name || "ผู้รับผิดชอบ #" + item.user_id;
      li.appendChild(title);

      var meta = document.createElement("p");
      meta.textContent = [
        item.assigned_role ? "บทบาท " + item.assigned_role : "",
        item.assigned_by_name ? "มอบหมายโดย " + item.assigned_by_name : "",
        item.due_date ? "กำหนดเสร็จ " + item.due_date : "",
        formatThaiDate(item.created_at)
      ].filter(Boolean).join(" | ");
      li.appendChild(meta);

      if (item.note) {
        var note = document.createElement("p");
        note.textContent = item.note;
        li.appendChild(note);
      }

      els.assignmentsList.appendChild(li);
    });
  }

  function renderPublicSettings(settings, attachments) {
    els.publicVisible.checked = Boolean(settings.public_visible);
    els.publicSummary.value = settings.public_summary || "";
    els.publicLocation.value = settings.public_location_label || "";
    els.publicImageAllowed.checked = Boolean(settings.public_image_allowed);

    clear(els.publicAttachments);

    if (!attachments.length) {
      var empty = document.createElement("p");
      empty.className = "muted-text";
      empty.textContent = "ยังไม่มีภาพหรือไฟล์แนบให้เลือกเผยแพร่";
      els.publicAttachments.appendChild(empty);
      return;
    }

    attachments.forEach(function (item) {
      var label = document.createElement("label");
      label.className = "attachment-public-option";

      var input = document.createElement("input");
      input.type = "checkbox";
      input.name = "allowed_attachment_ids";
      input.value = String(item.id);
      input.checked = Boolean(item.public_allowed);

      var span = document.createElement("span");
      var strong = document.createElement("strong");
      strong.textContent = item.file_name || "ไฟล์แนบ #" + item.id;
      var small = document.createElement("small");
      small.textContent = [item.file_type, formatFileSize(item.file_size)].filter(Boolean).join(" | ");
      span.appendChild(strong);
      span.appendChild(document.createElement("br"));
      span.appendChild(small);

      label.appendChild(input);
      label.appendChild(span);
      els.publicAttachments.appendChild(label);
    });
  }

  async function handleStatusSubmit(event) {
    event.preventDefault();
    if (state.isBusy || !canManage(state.detail)) {
      return;
    }

    if (!window.confirm("ยืนยันเปลี่ยนสถานะเรื่องนี้?")) {
      return;
    }

    await submitAction(
      els.statusForm,
      "/api/admin/reports/" + state.reportId + "/status",
      "PATCH",
      {
        status: els.statusInput.value,
        note: els.statusNote.value.trim(),
        is_public: els.statusPublic.checked ? 1 : 0
      },
      "บันทึกสถานะสำเร็จ"
    );
    els.statusNote.value = "";
  }

  async function handleUpdateSubmit(event) {
    event.preventDefault();
    if (state.isBusy || !canManage(state.detail)) {
      return;
    }

    var note = els.updateNote.value.trim();
    if (!note) {
      showStatus("กรุณากรอกข้อความ update", "error");
      els.updateNote.focus();
      return;
    }

    if (!window.confirm("ยืนยันเพิ่ม update ให้เรื่องนี้?")) {
      return;
    }

    await submitAction(
      els.updateForm,
      "/api/admin/reports/" + state.reportId + "/updates",
      "POST",
      {
        status: els.updateStatus.value,
        update_note: note,
        is_public: els.updatePublic.checked ? 1 : 0
      },
      "เพิ่ม update สำเร็จ"
    );
    els.updateNote.value = "";
  }

  async function handleAssignmentSubmit(event) {
    event.preventDefault();
    if (state.isBusy || !canManage(state.detail)) {
      return;
    }

    var userId = Number(els.assigneeId.value);
    if (!Number.isInteger(userId) || userId < 1) {
      showStatus("กรุณาระบุรหัสผู้รับผิดชอบให้ถูกต้อง", "error");
      els.assigneeId.focus();
      return;
    }

    if (!window.confirm("ยืนยันมอบหมายงานให้ผู้รับผิดชอบนี้?")) {
      return;
    }

    await submitAction(
      els.assignmentForm,
      "/api/admin/reports/" + state.reportId + "/assignments",
      "POST",
      {
        user_id: userId,
        due_date: els.assignmentDue.value || null,
        note: els.assignmentNote.value.trim()
      },
      "มอบหมายงานสำเร็จ"
    );
    els.assignmentForm.reset();
  }

  async function handlePublicSubmit(event) {
    event.preventDefault();
    if (state.isBusy || !canManage(state.detail)) {
      return;
    }

    var confirmMessage = els.publicVisible.checked
      ? "ยืนยันเผยแพร่เรื่องนี้ในหน้าสาธารณะ? กรุณาตรวจว่าไม่มีข้อมูลส่วนตัวก่อนบันทึก"
      : "ยืนยันบันทึกการตั้งค่าเผยแพร่?";

    if (!window.confirm(confirmMessage)) {
      return;
    }

    var allowedIds = Array.prototype.slice.call(
      els.publicAttachments.querySelectorAll("input[name='allowed_attachment_ids']:checked")
    ).map(function (input) {
      return Number(input.value);
    }).filter(function (id) {
      return Number.isInteger(id) && id > 0;
    });

    await submitAction(
      els.publicForm,
      "/api/admin/reports/" + state.reportId + "/public",
      "PATCH",
      {
        public_visible: els.publicVisible.checked ? 1 : 0,
        public_summary: els.publicSummary.value.trim(),
        public_location_label: els.publicLocation.value.trim(),
        public_image_allowed: els.publicImageAllowed.checked ? 1 : 0,
        allowed_attachment_ids: allowedIds
      },
      "บันทึกการเผยแพร่สำเร็จ"
    );
  }

  async function submitAction(form, url, method, body, successMessage) {
    state.isBusy = true;
    setFormBusy(form, true);
    showStatus("กำลังบันทึกข้อมูล...", "info");

    try {
      await fetchJson(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      showStatus(successMessage, "success");
      await loadReport();
    } catch (error) {
      showStatus(error.message || "บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่", "error");
    } finally {
      state.isBusy = false;
      setFormBusy(form, false);
    }
  }

  async function fetchJson(url, options) {
    var requestOptions = Object.assign({
      credentials: "include",
      headers: { Accept: "application/json" }
    }, options || {});

    requestOptions.headers = Object.assign(
      { Accept: "application/json" },
      (options && options.headers) || {}
    );

    var response = await fetch(url, requestOptions);

    if (response.status === 401) {
      window.location.replace("login.html");
      return null;
    }

    var payload = null;
    try {
      payload = await response.json();
    } catch (error) {
      payload = null;
    }

    if (!response.ok || !payload || payload.ok === false) {
      throw new Error(getFriendlyError(response.status, payload));
    }

    return payload;
  }

  function getFriendlyError(status, payload) {
    if (status === 403) {
      return "บัญชีนี้ไม่มีสิทธิ์ทำรายการนี้";
    }
    if (status === 404) {
      return "ไม่พบเรื่องที่ต้องการ";
    }
    if (payload && payload.message) {
      return payload.message;
    }
    return "ระบบไม่สามารถทำรายการได้ กรุณาลองใหม่";
  }

  function canManage(data) {
    return Boolean(data && data.permissions && data.permissions.can_view_private);
  }

  function setFormsDisabled(disabled) {
    [els.statusForm, els.updateForm, els.assignmentForm, els.publicForm].forEach(function (form) {
      Array.prototype.forEach.call(form.elements, function (element) {
        element.disabled = disabled;
      });
    });
  }

  function setFormBusy(form, busy) {
    Array.prototype.forEach.call(form.elements, function (element) {
      element.disabled = busy || !canManage(state.detail);
    });
  }

  function showStatus(message, type) {
    els.detailStatus.textContent = message;
    els.detailStatus.hidden = false;
    if (type === "error" || type === "success") {
      els.detailStatus.dataset.type = type;
    } else {
      delete els.detailStatus.dataset.type;
    }
  }

  function appendDetail(list, label, value) {
    var row = document.createElement("div");
    var dt = document.createElement("dt");
    dt.textContent = label;
    var dd = document.createElement("dd");
    dd.textContent = value || "-";
    row.appendChild(dt);
    row.appendChild(dd);
    list.appendChild(row);
  }

  function createChip(text, className) {
    var chip = document.createElement("span");
    chip.className = "status-chip " + className;
    chip.textContent = text || "-";
    return chip;
  }

  function getStatusLabel(status) {
    return STATUS_LABELS[status] || status || "-";
  }

  function getPriorityLabel(priority) {
    return PRIORITY_LABELS[priority] || priority || "-";
  }

  function getStatusClass(status) {
    return "status-" + String(status || "new").replace(/_/g, "_");
  }

  function getPriorityClass(priority) {
    if (priority === "urgent") {
      return "status-rejected";
    }
    if (priority === "high") {
      return "status-checking";
    }
    return "status-new";
  }

  function formatThaiDate(value) {
    if (!value) {
      return "-";
    }
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return new Intl.DateTimeFormat("th-TH", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date);
  }

  function formatFileSize(size) {
    var bytes = Number(size);
    if (!Number.isFinite(bytes) || bytes < 0) {
      return "";
    }
    if (bytes < 1024) {
      return bytes + " B";
    }
    if (bytes < 1024 * 1024) {
      return Math.round(bytes / 1024) + " KB";
    }
    return (bytes / 1024 / 1024).toFixed(1) + " MB";
  }

  function clear(element) {
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  }

  function setText(element, value) {
    element.textContent = value;
  }
})();
