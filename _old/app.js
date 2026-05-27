/* =========================================================
   Paper Manager CS — Application Logic
   Form handling, table rendering, animations, sample data
   ========================================================= */

// ── Sample Data (from reference image) ────────────────────
const SAMPLE_PAPERS = [
  {
    id: 1,
    title: "CAD-DA: Controllable Anomaly Detection after Domain Adaptation by Statistical Inference",
    year: 2024,
    venue: "AISTATS",
    authors: "Vo Nguyen Le Duy, Hsuan-Tien Lin, Ichiro Takeuchi"
  },
  {
    id: 2,
    title: "Bounded p values in parametric programming-based selective inference",
    year: 2024,
    venue: "JJSD",
    authors: "Tomohiro Shiraishi, Daiki Miwa, Vo Nguyen Le Duy & Ichiro Takeuchi"
  },
  {
    id: 3,
    title: "Intelligent Problem Solver in Database Systems based on Ontology Integration through Text-to-SQL",
    year: 2024,
    venue: "FPA",
    authors: "Duc Truong, Hung Nguyen, Nha P. Tran, Sang Vu, Hien D. Nguyen"
  },
  {
    id: 4,
    title: "Thiết Kế Trò Chơi Giáo Dục Hỗ Trợ Việc Đào Tạo Kĩ Năng Sống cho Trẻ Mầm Non",
    year: 2024,
    venue: "UTEJS",
    authors: "Viet Hung Nguyen, Thi Vuong Pham, Phuong Thao Nguyen, Nguyen Anh Dung Dinh, Dinh Hien Nguyen"
  },
  {
    id: 5,
    title: "Tích hợp biểu diễn tri thức ontology và đồ thị tri thức cho hệ thống chatbot hỗ trợ truy vấn kiến thức trong giáo dục",
    year: 2024,
    venue: "HCMUE-JS",
    authors: "Nguyễn Viết Hưng, Lê Thị Ngọc Thảo, Nguyễn Văn Hậu, Nguyễn Đắc Long, Trần Phong Nhã, Nguyễn Đình Hiển"
  },
  {
    id: 6,
    title: "Statistical Test for Attention Maps in Vision Transformers",
    year: 2024,
    venue: "ICML",
    authors: "Tomohiro Shiraishi, Daiki Miwa, Teruyuki Katsuoka, Vo Nguyen Le Duy, Ichiro Takeuchi"
  },
  {
    id: 7,
    title: "Deep Learning Approaches for Vietnamese Sentiment Analysis on Social Media",
    year: 2023,
    venue: "RIVF",
    authors: "Tran Bao Gia, Nguyen Van Hieu, Le Thi Mai, Pham Duc Anh"
  },
  {
    id: 8,
    title: "Knowledge Graph Embedding for Question Answering in Education Domain",
    year: 2023,
    venue: "KSE",
    authors: "Nguyen Dinh Hien, Truong Duc, Vo Le Duy, Phan Thanh Son"
  },
  {
    id: 9,
    title: "Efficient Student Performance Prediction using Ensemble Learning Methods",
    year: 2023,
    venue: "NICS",
    authors: "Le Minh Tuan, Nguyen Viet Hung, Pham Thi Thu, Tran Van Duc"
  },
  {
    id: 10,
    title: "A Novel Approach to Vietnamese Text Summarization using Transformer Models",
    year: 2022,
    venue: "SOICT",
    authors: "Nguyen Van Hau, Tran Phong Nha, Le Dac Long, Pham Quoc Viet"
  },
  {
    id: 11,
    title: "Real-time Object Detection for Autonomous Driving in Vietnamese Traffic",
    year: 2022,
    venue: "ICCE",
    authors: "Vo Le Duy, Nguyen Anh Dung, Tran Bao Gia, Le Thi Ngoc Thao"
  },
  {
    id: 12,
    title: "Blockchain-based Academic Credential Verification System",
    year: 2022,
    venue: "FAIR",
    authors: "Phan Thanh Son, Nguyen Dinh Hien, Le Minh Tuan, Vo Hung"
  },
  {
    id: 13,
    title: "Multi-modal Learning for Vietnamese Medical Image Analysis",
    year: 2021,
    venue: "RIVF",
    authors: "Truong Duc, Nguyen Van Hieu, Pham Duc Anh, Le Thi Mai"
  },
  {
    id: 14,
    title: "Adaptive E-learning Platform with Personalized Content Recommendation",
    year: 2021,
    venue: "ICCASA",
    authors: "Nguyen Viet Hung, Tran Van Duc, Pham Thi Thu, Le Dac Long"
  }
];

// ── State ─────────────────────────────────────────────────
const ITEMS_PER_PAGE = 5;
let state = {
  papers: [],
  currentPage: 1,
  searchQuery: '',
  sortField: 'year',
  sortDir: 'desc'
};

// ── Initialize ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadPapers();
  initNavbar();
  initForm();
  initTable();
  initScrollAnimations();
  initCounters();
  renderStats();
});

// ── Data Persistence ──────────────────────────────────────
function loadPapers() {
  const stored = localStorage.getItem('paperManagerCS_papers');
  if (stored) {
    state.papers = JSON.parse(stored);
  } else {
    state.papers = [...SAMPLE_PAPERS];
    savePapers();
  }
}

function savePapers() {
  localStorage.setItem('paperManagerCS_papers', JSON.stringify(state.papers));
}

// ── Navbar ────────────────────────────────────────────────
function initNavbar() {
  const navbar = document.getElementById('navbar');
  const toggle = document.getElementById('navbar-toggle');
  const links = document.getElementById('navbar-links');

  // Scroll effect
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 20);
  }, { passive: true });

  // Mobile toggle
  if (toggle) {
    toggle.addEventListener('click', () => {
      links.classList.toggle('open');
      const isOpen = links.classList.contains('open');
      toggle.setAttribute('aria-expanded', isOpen);
    });

    // Close on link click
    links.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        links.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }
}

// ── Form ──────────────────────────────────────────────────
function initForm() {
  const form = document.getElementById('paper-form');
  const formContent = document.getElementById('form-content');
  const formSuccess = document.getElementById('form-success');

  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const title = document.getElementById('paper-title').value.trim();
    const year = parseInt(document.getElementById('paper-year').value, 10);
    const venue = document.getElementById('paper-venue').value.trim();
    const authors = document.getElementById('paper-authors').value.trim();

    if (!title || !year || !venue || !authors) return;

    const newPaper = {
      id: Date.now(),
      title,
      year,
      venue,
      authors
    };

    state.papers.unshift(newPaper);
    savePapers();

    // Show success
    formContent.style.display = 'none';
    formSuccess.classList.add('show');

    // Re-render table + stats
    renderTable();
    renderStats();
    updateHeroStats();

    // Show toast
    showToast('Bài báo đã được thêm thành công!');
  });

  // "Add another" button
  const addAnotherBtn = document.getElementById('add-another-btn');
  if (addAnotherBtn) {
    addAnotherBtn.addEventListener('click', () => {
      form.reset();
      formContent.style.display = 'block';
      formSuccess.classList.remove('show');
    });
  }

  // Reset button
  const resetBtn = document.getElementById('reset-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      form.reset();
    });
  }
}

// ── Table ─────────────────────────────────────────────────
function initTable() {
  const searchInput = document.getElementById('table-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value.toLowerCase();
      state.currentPage = 1;
      renderTable();
    });
  }

  // Sort headers
  document.querySelectorAll('[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const field = th.dataset.sort;
      if (state.sortField === field) {
        state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortField = field;
        state.sortDir = field === 'year' ? 'desc' : 'asc';
      }
      state.currentPage = 1;
      renderTable();
    });
  });

  renderTable();
}

function getFilteredPapers() {
  let papers = [...state.papers];

  // Search filter
  if (state.searchQuery) {
    papers = papers.filter(p =>
      p.title.toLowerCase().includes(state.searchQuery) ||
      p.venue.toLowerCase().includes(state.searchQuery) ||
      p.authors.toLowerCase().includes(state.searchQuery) ||
      String(p.year).includes(state.searchQuery)
    );
  }

  // Sort
  papers.sort((a, b) => {
    let valA = a[state.sortField];
    let valB = b[state.sortField];
    if (typeof valA === 'string') {
      valA = valA.toLowerCase();
      valB = valB.toLowerCase();
    }
    if (valA < valB) return state.sortDir === 'asc' ? -1 : 1;
    if (valA > valB) return state.sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  return papers;
}

function renderTable() {
  const tbody = document.getElementById('papers-tbody');
  const paginationInfo = document.getElementById('pagination-info');
  const paginationButtons = document.getElementById('pagination-buttons');
  const tableMeta = document.getElementById('table-total');

  if (!tbody) return;

  const filtered = getFilteredPapers();
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));

  // Clamp page
  if (state.currentPage > totalPages) state.currentPage = totalPages;

  const start = (state.currentPage - 1) * ITEMS_PER_PAGE;
  const end = Math.min(start + ITEMS_PER_PAGE, filtered.length);
  const pageItems = filtered.slice(start, end);

  // Update total
  if (tableMeta) {
    tableMeta.textContent = `${filtered.length} bài báo`;
  }

  // Update sort icons
  document.querySelectorAll('[data-sort]').forEach(th => {
    const icon = th.querySelector('.sort-icon');
    if (icon) {
      const isActive = th.dataset.sort === state.sortField;
      icon.classList.toggle('active', isActive);
      icon.innerHTML = isActive
        ? (state.sortDir === 'asc'
          ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>'
          : '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>')
        : '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 15l5 5 5-5M7 9l5-5 5 5"/></svg>';
    }
  });

  // Render rows
  if (pageItems.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="table-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zm3.75 11.625a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/>
          </svg>
          <p>Không tìm thấy bài báo nào</p>
        </td>
      </tr>`;
  } else {
    tbody.innerHTML = pageItems.map((paper, idx) => `
      <tr style="animation: fadeSlideUp 0.3s ease ${idx * 50}ms both">
        <td class="td-title">${escapeHtml(paper.title)}</td>
        <td class="td-year">${paper.year}</td>
        <td class="td-venue"><span class="venue-badge">${escapeHtml(paper.venue)}</span></td>
        <td class="td-authors">${escapeHtml(paper.authors)}</td>
      </tr>
    `).join('');
  }

  // Pagination info
  if (paginationInfo) {
    paginationInfo.textContent = filtered.length > 0
      ? `Hiển thị ${start + 1}–${end} trong ${filtered.length} bài báo`
      : 'Không có kết quả';
  }

  // Pagination buttons
  if (paginationButtons) {
    let btns = '';
    btns += `<button class="pagination-btn" onclick="goToPage(${state.currentPage - 1})" ${state.currentPage === 1 ? 'disabled' : ''}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 19l-7-7 7-7"/></svg>
    </button>`;

    const maxVisible = 5;
    let startPage = Math.max(1, state.currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    if (endPage - startPage < maxVisible - 1) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      btns += `<button class="pagination-btn ${i === state.currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
    }

    btns += `<button class="pagination-btn" onclick="goToPage(${state.currentPage + 1})" ${state.currentPage === totalPages ? 'disabled' : ''}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5l7 7-7 7"/></svg>
    </button>`;

    paginationButtons.innerHTML = btns;
  }
}

function goToPage(page) {
  const totalPages = Math.ceil(getFilteredPapers().length / ITEMS_PER_PAGE);
  if (page < 1 || page > totalPages) return;
  state.currentPage = page;
  renderTable();
  // Scroll to table top
  document.getElementById('publications').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Statistics ────────────────────────────────────────────
function renderStats() {
  renderYearChart();
  renderVenueChart();
}

function renderYearChart() {
  const container = document.getElementById('year-chart');
  if (!container) return;

  // Count papers per year
  const yearCounts = {};
  state.papers.forEach(p => {
    yearCounts[p.year] = (yearCounts[p.year] || 0) + 1;
  });

  const years = Object.keys(yearCounts).sort();
  const maxCount = Math.max(...Object.values(yearCounts), 1);

  container.innerHTML = years.map(year => {
    const count = yearCounts[year];
    const heightPct = (count / maxCount) * 100;
    return `
      <div class="chart-bar-group">
        <div class="chart-bar" style="height: ${heightPct}%" title="${year}: ${count} bài báo">
          <span class="chart-bar-value">${count}</span>
        </div>
        <span class="chart-bar-label">${year}</span>
      </div>
    `;
  }).join('');
}

function renderVenueChart() {
  const container = document.getElementById('venue-chart');
  if (!container) return;

  // Count papers per venue
  const venueCounts = {};
  state.papers.forEach(p => {
    venueCounts[p.venue] = (venueCounts[p.venue] || 0) + 1;
  });

  // Sort by count, top 6
  const sorted = Object.entries(venueCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6);

  const maxCount = sorted.length > 0 ? sorted[0][1] : 1;

  container.innerHTML = sorted.map(([venue, count]) => {
    const pct = (count / maxCount) * 100;
    return `
      <div class="h-bar-item">
        <div class="h-bar-header">
          <span class="h-bar-label">${escapeHtml(venue)}</span>
          <span class="h-bar-count">${count}</span>
        </div>
        <div class="h-bar-track">
          <div class="h-bar-fill" style="width: ${pct}%"></div>
        </div>
      </div>
    `;
  }).join('');
}

// ── Counters ──────────────────────────────────────────────
function initCounters() {
  updateHeroStats();
}

function updateHeroStats() {
  const totalPapers = state.papers.length;
  const uniqueVenues = new Set(state.papers.map(p => p.venue)).size;
  const uniqueAuthors = new Set(
    state.papers.flatMap(p => p.authors.split(/[,&]/).map(a => a.trim()).filter(Boolean))
  ).size;

  animateCounter('stat-papers', totalPapers);
  animateCounter('stat-venues', uniqueVenues);
  animateCounter('stat-authors', uniqueAuthors);
}

function animateCounter(elementId, target) {
  const el = document.getElementById(elementId);
  if (!el) return;

  const duration = 1200;
  const start = performance.now();
  const from = parseInt(el.textContent, 10) || 0;

  // Skip animation if prefers-reduced-motion
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.textContent = target;
    return;
  }

  function update(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    el.textContent = Math.round(from + (target - from) * eased);
    if (progress < 1) requestAnimationFrame(update);
  }

  requestAnimationFrame(update);
}

// ── Scroll Animations ─────────────────────────────────────
function initScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.animate-on-scroll').forEach(el => observer.observe(el));
}

// ── Toast ─────────────────────────────────────────────────
function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;

  toast.querySelector('.toast-message').textContent = message;
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// ── Utilities ─────────────────────────────────────────────
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
