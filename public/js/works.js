(function () {
  const pageSize = 12;
  let currentPage = 1;
  let totalPages = 1;
  let isLoading = false;

  const statusEl = document.getElementById('works-status');
  const emptyEl = document.getElementById('works-empty');
  const listEl = document.getElementById('works-list');
  const countEl = document.getElementById('works-count');
  const pageSummaryEl = document.getElementById('page-summary');
  const prevButton = document.getElementById('prev-page');
  const nextButton = document.getElementById('next-page');

  function setStatus(message, type) {
    statusEl.textContent = message;
    statusEl.dataset.type = type || 'info';
    statusEl.hidden = !message;
  }

  function formatDate(value) {
    if (!value) {
      return 'ยังไม่ระบุ';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'ยังไม่ระบุ';
    }

    return new Intl.DateTimeFormat('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
  }

  function createMetaItem(label, value) {
    const wrapper = document.createElement('div');
    const term = document.createElement('dt');
    const detail = document.createElement('dd');

    term.textContent = label;
    detail.textContent = value || 'ไม่ระบุ';

    wrapper.append(term, detail);
    return wrapper;
  }

  function createWorkCard(work) {
    const card = document.createElement('article');
    card.className = 'work-card';

    const header = document.createElement('div');
    header.className = 'work-card-header';

    const category = document.createElement('span');
    category.className = 'status-chip status-resolved';
    category.textContent = work.category_name || 'หมวดทั่วไป';

    const title = document.createElement('h2');
    title.className = 'work-card-title';
    title.textContent = work.tracking_code || 'ผลงานที่แก้ไขแล้ว';

    header.append(category, title);

    const summary = document.createElement('p');
    summary.className = 'work-summary';
    summary.textContent = work.public_summary || 'มีการแก้ไขเรื่องนี้เรียบร้อยแล้ว';

    const meta = document.createElement('dl');
    meta.className = 'work-meta';
    meta.append(
      createMetaItem('พื้นที่', work.public_location_label),
      createMetaItem('วันที่แจ้ง', formatDate(work.created_at)),
      createMetaItem('วันที่แก้ไข', formatDate(work.closed_at))
    );

    card.append(header, summary, meta);
    return card;
  }

  function normalizePayload(payload) {
    const data = payload && payload.data;

    if (Array.isArray(data)) {
      return {
        works: data,
        meta: payload.meta || {}
      };
    }

    return {
      works: Array.isArray(data && data.works) ? data.works : [],
      meta: data && data.meta ? data.meta : {}
    };
  }

  function updatePagination(meta, worksCount) {
    const total = Number(meta.total || worksCount || 0);
    totalPages = Math.max(1, Number(meta.totalPages || Math.ceil(total / pageSize) || 1));
    currentPage = Math.min(Math.max(1, Number(meta.page || currentPage)), totalPages);

    countEl.textContent = total > 0 ? `พบ ${total} รายการ` : '';
    pageSummaryEl.textContent = total > 0 ? `หน้า ${currentPage} จาก ${totalPages}` : '';
    prevButton.disabled = isLoading || currentPage <= 1;
    nextButton.disabled = isLoading || currentPage >= totalPages;
  }

  function renderWorks(works, meta) {
    listEl.replaceChildren();
    emptyEl.hidden = works.length > 0;

    const fragment = document.createDocumentFragment();
    works.forEach((work) => {
      fragment.appendChild(createWorkCard(work));
    });
    listEl.appendChild(fragment);

    updatePagination(meta, works.length);
  }

  async function loadWorks(page) {
    if (isLoading) {
      return;
    }

    isLoading = true;
    currentPage = page;
    updatePagination({ page: currentPage, totalPages }, 0);
    setStatus('กำลังโหลดข้อมูล...', 'info');

    try {
      const response = await fetch(`/api/public/works?page=${currentPage}&pageSize=${pageSize}`, {
        headers: {
          Accept: 'application/json'
        }
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload || payload.ok !== true) {
        throw new Error('LOAD_FAILED');
      }

      const normalized = normalizePayload(payload);
      renderWorks(normalized.works, normalized.meta);
      setStatus('', 'info');
    } catch (error) {
      listEl.replaceChildren();
      emptyEl.hidden = true;
      countEl.textContent = '';
      pageSummaryEl.textContent = '';
      totalPages = 1;
      setStatus('ไม่สามารถโหลดผลงานได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง', 'error');
      updatePagination({ page: 1, totalPages: 1 }, 0);
    } finally {
      isLoading = false;
      updatePagination({ page: currentPage, totalPages }, listEl.children.length);
    }
  }

  prevButton.addEventListener('click', () => {
    if (currentPage > 1) {
      loadWorks(currentPage - 1);
    }
  });

  nextButton.addEventListener('click', () => {
    if (currentPage < totalPages) {
      loadWorks(currentPage + 1);
    }
  });

  loadWorks(currentPage);
})();
