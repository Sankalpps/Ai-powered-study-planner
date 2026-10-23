/**
 * @fileoverview Celebo AI - Primary Frontend Application Controller
 * Handles initialization, theme management, hero view rendering, and master event wiring.
 * @module app
 */

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  loadEventsFromStorage();
  initEventListeners();
  initSimulator();
  initModals();
  renderApp();
});

/**
 * Theme Manager: Dark/Light Mode with localStorage persistence and system preference fallback.
 */
function initTheme() {
  const savedTheme =
    localStorage.getItem('celebo_theme') ||
    localStorage.getItem('celebrio_theme') ||
    (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light');

  applyTheme(savedTheme);

  const themeBtn = document.getElementById('btn-toggle-theme');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      localStorage.setItem('celebo_theme', next);
      localStorage.setItem('celebrio_theme', next);
      showToast(`Switched to ${next === 'dark' ? 'Dark' : 'Light'} Mode`);
    });
  }

  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem('celebo_theme') && !localStorage.getItem('celebrio_theme')) {
        applyTheme(e.matches ? 'dark' : 'light');
      }
    });
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const themeBtn = document.getElementById('btn-toggle-theme');
  if (themeBtn) {
    themeBtn.innerHTML =
      theme === 'dark'
        ? '<span aria-hidden="true">☀️</span> Light'
        : '<span aria-hidden="true">🌙</span> Dark';
    themeBtn.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`);
  }
}

// Master Render
function renderApp() {
  if (!activeEvent) return;

  renderEventSelector();
  renderHeroAndMetrics();
  renderOverviewTab();
  renderBudgetTab();
  renderTimelineTab();
  renderVendorTab();
  renderCreativeTab();
}

// Render Event Selector Dropdown in Header
function renderEventSelector() {
  const select = document.getElementById('event-select');
  select.innerHTML = '';

  allEvents.forEach((evt) => {
    const opt = document.createElement('option');
    opt.value = evt.id;
    opt.textContent = `${getEventTypeIcon(evt.summary.eventType)} ${evt.summary.title}`;
    if (evt.id === activeEvent.id) {
      opt.selected = true;
    }
    select.appendChild(opt);
  });
}

// Render Hero Banner & 4 Key Metrics
function renderHeroAndMetrics() {
  const summary = activeEvent.summary || {};
  const budget = activeEvent.budget || {};
  const milestones = activeEvent.timelineMilestones || [];
  const vendors = activeEvent.vendors || [];

  document.getElementById('hero-type').textContent =
    `${getEventTypeIcon(summary.eventType)} ${summary.eventType || 'Celebration'}`;
  document.getElementById('hero-title').textContent = summary.title || 'Untitled Event';
  document.getElementById('hero-tagline').textContent = summary.tagline || summary.aesthetic || '';
  document.getElementById('hero-date').textContent = formatDate(summary.eventDate);
  document.getElementById('hero-location').textContent = summary.location || 'Venue TBD';
  document.getElementById('hero-guests').textContent = `${summary.guestCount || 0} Guests`;
  document.getElementById('hero-budget').textContent =
    `${summary.currency || '$'}${formatNumber(summary.budgetTotal || budget.total || 0)} Total Budget`;

  const daysLeft = calculateDaysRemaining(summary.eventDate);
  const countdownText = daysLeft >= 0 ? `${daysLeft} Days` : 'Celebrated 🎉';
  document.getElementById('hero-countdown').textContent = countdownText;
  document.getElementById('metric-countdown').textContent = countdownText;
  document.getElementById('metric-date-sub').textContent = formatDate(summary.eventDate);

  const totalAllocated = budget.total || summary.budgetTotal || 0;
  const totalSpent = (budget.categories || []).reduce(
    (sum, c) => sum + (c.spent || c.allocated || 0),
    0
  );
  const spentPct = totalAllocated > 0 ? Math.round((totalSpent / totalAllocated) * 100) : 0;
  document.getElementById('metric-budget-spent').textContent =
    `${summary.currency || '$'}${formatNumber(totalSpent)}`;
  document.getElementById('metric-budget-percent').textContent =
    `${spentPct}% of ${summary.currency || '$'}${formatNumber(totalAllocated)} budget allocated`;

  const totalMilestones = milestones.length;
  const completedMilestones = milestones.filter((m) => m.done).length;
  const milestonePct =
    totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0;
  document.getElementById('metric-milestones-progress').textContent = `${milestonePct}%`;
  document.getElementById('metric-milestones-count').textContent =
    `${completedMilestones} of ${totalMilestones} tasks completed`;

  const confirmedVendors = vendors.filter(
    (v) => v.status === 'Contracted' || v.status === 'Paid'
  ).length;
  document.getElementById('metric-vendors-count').textContent =
    `${confirmedVendors} / ${vendors.length}`;
}

// Master Event Listeners Wiring
function initEventListeners() {
  document.addEventListener('change', (e) => {
    if (e.target.matches('.budget-spent-input')) {
      updateCategorySpent(parseInt(e.target.dataset.catIdx, 10), e.target.value);
    } else if (e.target.matches('.milestone-check')) {
      toggleMilestoneDone(parseInt(e.target.dataset.mIdx, 10), e.target.checked);
    } else if (e.target.matches('.vendor-status-select')) {
      updateVendorStatus(parseInt(e.target.dataset.vendorIdx, 10), e.target.value);
    }
  });

  document.addEventListener('click', (e) => {
    const removeCatBtn = e.target.closest('.btn-remove-cat');
    if (removeCatBtn) return removeBudgetCategory(parseInt(removeCatBtn.dataset.catIdx, 10));
    const delMilestoneBtn = e.target.closest('.btn-delete-milestone');
    if (delMilestoneBtn) return deleteMilestone(parseInt(delMilestoneBtn.dataset.mIdx, 10));
    const openRfpBtn = e.target.closest('.btn-open-rfp');
    if (openRfpBtn) return openVendorRFPModal(parseInt(openRfpBtn.dataset.vendorIdx, 10));
  });

  initTabs();

  document.getElementById('event-select').addEventListener('change', (e) => {
    const found = allEvents.find((ev) => ev.id === e.target.value);
    if (found) {
      activeEvent = found;
      saveEventsToStorage();
      renderApp();
      showToast(`Switched active plan to "${activeEvent.summary.title}"`);
    }
  });

  const editBtn = document.getElementById('btn-edit-active-event');
  if (editBtn) {
    editBtn.addEventListener('click', handleEditActiveEvent);
  }

  initExportPrintListener();
  initBudgetListeners();
  initTimelineListeners();
  initVendorListeners();
  initCreativeListeners();
  initCopilotListeners();
}
