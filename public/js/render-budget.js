/**
 * @fileoverview Budget Tab Renderer and What-If Simulator
 * @module render-budget
 */

// TAB 2: Budget & Expenses
function renderBudgetTab() {
  const budget = activeEvent.budget || {};
  const categories = budget.categories || [];
  const currency = activeEvent.summary?.currency || '$';
  const totalBudget = budget.total || activeEvent.summary?.budgetTotal || 0;

  // Render What-If Simulator with active event values
  renderSimulator();

  // Visual Multi-segment Progress Bar
  const progressBar = document.getElementById('budget-progress-bar');
  progressBar.innerHTML = '';

  const paletteColors = [
    '#6366f1',
    '#ec4899',
    '#10b981',
    '#f59e0b',
    '#06b6d4',
    '#8b5cf6',
    '#f97316',
    '#14b8a6',
    '#e11d48',
    '#84cc16'
  ];

  categories.forEach((cat, idx) => {
    const pct = totalBudget > 0 ? ((cat.allocated / totalBudget) * 100).toFixed(1) : 0;
    const seg = document.createElement('div');
    seg.className = 'budget-bar-segment';
    seg.style.width = `${pct}%`;
    seg.style.backgroundColor = paletteColors[idx % paletteColors.length];
    seg.title = `${cat.name}: ${currency}${formatNumber(cat.allocated)} (${pct}%)`;
    progressBar.appendChild(seg);
  });

  // Budget Table
  const tbody = document.getElementById('budget-table-body');
  tbody.innerHTML = '';

  categories.forEach((cat, idx) => {
    const tr = document.createElement('tr');
    const spent = cat.spent !== undefined ? cat.spent : cat.allocated;
    const sharePct = totalBudget > 0 ? Math.round((cat.allocated / totalBudget) * 100) : 0;

    tr.innerHTML = `
      <td>
        <div class="budget-category-name">${cat.name}</div>
        <div class="budget-category-notes">${cat.notes || ''}</div>
      </td>
      <td><strong>${currency}${formatNumber(cat.allocated)}</strong></td>
      <td>
        <input type="number" class="form-input budget-spent-input" style="width: 110px; padding: 0.35rem 0.6rem; font-size: 0.85rem;" 
               value="${spent}" data-cat-idx="${idx}">
      </td>
      <td><span class="badge" style="background: var(--bg-card-subtle); color: var(--text-main);">${sharePct}%</span></td>
      <td>
        <div>${cat.notes || 'Allocated fund'}</div>
        ${cat.savingTip ? `<span class="budget-tip-pill">💡 ${cat.savingTip}</span>` : ''}
      </td>
      <td>
        <button class="btn btn-outline btn-sm btn-remove-cat" data-cat-idx="${idx}" title="Remove Category">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function updateCategorySpent(idx, value) {
  if (activeEvent?.budget?.categories?.[idx]) {
    activeEvent.budget.categories[idx].spent = parseFloat(value) || 0;
    saveEventsToStorage();
    renderHeroAndMetrics();
    showToast('Updated actual spent amount.');
  }
}

function removeBudgetCategory(idx) {
  if (confirm('Are you sure you want to remove this budget category?')) {
    activeEvent.budget.categories.splice(idx, 1);
    saveEventsToStorage();
    renderBudgetTab();
    renderHeroAndMetrics();
    showToast('Removed budget category.');
  }
}

/**
 * What-If Live Budget & Guest Scale Simulator
 */
function initSimulator() {
  const guestsSlider = document.getElementById('sim-guests');
  const budgetSlider = document.getElementById('sim-budget');
  const applyBtn = document.getElementById('btn-apply-simulation');

  if (guestsSlider) {
    guestsSlider.addEventListener('input', () => {
      updateSimulationFromControls();
    });
  }

  if (budgetSlider) {
    budgetSlider.addEventListener('input', () => {
      updateSimulationFromControls();
    });
  }

  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      applySimulationToPlan();
    });
  }
}

function renderSimulator() {
  if (!activeEvent) return;
  const summary = activeEvent.summary || {};
  const budget = activeEvent.budget || {};
  const guests = summary.guestCount || 50;
  const total = budget.total || summary.budgetTotal || 10000;

  const guestsSlider = document.getElementById('sim-guests');
  const budgetSlider = document.getElementById('sim-budget');

  if (guestsSlider) {
    guestsSlider.max = Math.max(1000, guests * 2);
    guestsSlider.value = guests;
  }

  if (budgetSlider) {
    budgetSlider.max = Math.max(250000, total * 2);
    budgetSlider.value = total;
  }

  updateSimulationDisplay(guests, total);
}

function updateSimulationFromControls() {
  const guestsSlider = document.getElementById('sim-guests');
  const budgetSlider = document.getElementById('sim-budget');
  if (!guestsSlider || !budgetSlider) return;

  const simGuests = parseInt(guestsSlider.value, 10) || 1;
  const simBudget = parseFloat(budgetSlider.value) || 0;

  updateSimulationDisplay(simGuests, simBudget);
}

function updateSimulationDisplay(simGuests, simBudget) {
  const currency = activeEvent?.summary?.currency || '$';
  const activeBudget = activeEvent?.budget?.total || activeEvent?.summary?.budgetTotal || 0;

  const guestsDisplay = document.getElementById('sim-guests-display');
  const budgetDisplay = document.getElementById('sim-budget-display');
  const costPerGuest = document.getElementById('sim-cost-per-guest');
  const budgetDelta = document.getElementById('sim-budget-delta');

  if (guestsDisplay) {
    guestsDisplay.textContent = `${formatNumber(simGuests)} Guests`;
  }

  if (budgetDisplay) {
    budgetDisplay.textContent = `${currency}${formatNumber(simBudget)}`;
  }

  if (costPerGuest) {
    const cpg = simGuests > 0 ? simBudget / simGuests : 0;
    costPerGuest.textContent = `${currency}${cpg.toFixed(2)}`;
  }

  if (budgetDelta) {
    const delta = simBudget - activeBudget;
    if (delta > 0) {
      budgetDelta.textContent = `+${currency}${formatNumber(delta)}`;
      budgetDelta.style.color = 'var(--warning)';
    } else if (delta < 0) {
      budgetDelta.textContent = `-${currency}${formatNumber(Math.abs(delta))}`;
      budgetDelta.style.color = 'var(--success)';
    } else {
      budgetDelta.textContent = `${currency}0`;
      budgetDelta.style.color = 'var(--text-main)';
    }
  }
}

function applySimulationToPlan() {
  if (!activeEvent) return;
  const guestsSlider = document.getElementById('sim-guests');
  const budgetSlider = document.getElementById('sim-budget');
  if (!guestsSlider || !budgetSlider) return;

  const newGuests = parseInt(guestsSlider.value, 10);
  const newBudget = parseFloat(budgetSlider.value);
  const oldBudget = activeEvent.budget?.total || activeEvent.summary?.budgetTotal || 1;

  if (isNaN(newGuests) || newGuests <= 0 || isNaN(newBudget) || newBudget <= 0) return;

  const scaleRatio = newBudget / oldBudget;

  // Pro-rate category allocations
  if (activeEvent.budget?.categories?.length) {
    activeEvent.budget.categories.forEach((cat) => {
      cat.allocated = Math.round((cat.allocated || 0) * scaleRatio);
      if (cat.spent) {
        cat.spent = Math.round(cat.spent * scaleRatio);
      }
    });
  }

  activeEvent.summary.guestCount = newGuests;
  activeEvent.summary.budgetTotal = newBudget;
  if (activeEvent.budget) {
    activeEvent.budget.total = newBudget;
  }

  saveEventsToStorage();
  renderApp();
  showToast('Simulation applied: Budget and guest metrics updated!');
}

/**
 * Initializes button click listeners for budget optimizer and new expense category.
 */
function initBudgetListeners() {
  const optimizeBtn = document.getElementById('btn-ai-optimize-budget');
  if (optimizeBtn) {
    optimizeBtn.addEventListener('click', async () => {
      optimizeBtn.disabled = true;
      optimizeBtn.textContent = 'Analyzing budget...';

      const categories = (activeEvent.budget?.categories || []).map((c) => ({
        name: c.name,
        allocated: c.allocated
      }));
      const prompt = `Review my current event budget breakdown for "${activeEvent.summary.title}" (${activeEvent.summary.currency}${activeEvent.summary.budgetTotal} for ${activeEvent.summary.guestCount} guests). Current categories: ${JSON.stringify(categories)}. Provide 3 concrete, high-impact suggestions to reduce costs or reallocate funds strategically without hurting the guest experience. Keep it concise with bullet points.`;

      try {
        const copilotTab = document.querySelector('[data-tab="tab-copilot"]');
        if (copilotTab) copilotTab.click();
        await handleCopilotMessage(prompt);
        showToast('Budget analysis generated in Celebo Co-Pilot!');
      } catch (err) {
        showToast('Budget analysis error: ' + err.message);
      } finally {
        optimizeBtn.disabled = false;
        optimizeBtn.textContent = '🤖 AI Budget Optimizer';
      }
    });
  }

  const addCatBtn = document.getElementById('btn-add-expense-category');
  if (addCatBtn) {
    addCatBtn.addEventListener('click', () => {
      const name = prompt('Enter new budget category name:');
      if (!name) return;
      const allocated = parseFloat(prompt('Target allocated amount:', '1000')) || 0;

      activeEvent.budget.categories.push({
        id: 'cat_' + Date.now(),
        name,
        allocated,
        spent: 0,
        notes: 'Custom allocation',
        savingTip: 'Monitor quotes from at least 3 vendors'
      });
      saveEventsToStorage();
      renderBudgetTab();
      renderHeroAndMetrics();
      showToast('Added category!');
    });
  }
}
