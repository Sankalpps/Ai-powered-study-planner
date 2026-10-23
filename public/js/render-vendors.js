/**
 * @fileoverview Vendor Hub Tab Renderer
 * @module render-vendors
 */

// TAB 4: Vendor Hub
function renderVendorTab() {
  const vendors = activeEvent.vendors || [];
  const container = document.getElementById('vendors-container');
  const currency = activeEvent.summary?.currency || '$';
  container.innerHTML = '';

  vendors.forEach((v, idx) => {
    const card = document.createElement('div');
    card.className = 'vendor-card';

    let badgeClass = 'badge-researching';
    if (v.status === 'Contracted' || v.status === 'Paid') badgeClass = 'badge-contracted';
    else if (v.status === 'Inquired' || v.status === 'Contacted') badgeClass = 'badge-inquired';

    card.innerHTML = `
      <div class="vendor-header">
        <div>
          <span style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: var(--primary);">${v.category}</span>
          <h4 class="vendor-name">${v.name || v.role}</h4>
          <span class="vendor-role">${v.role}</span>
        </div>
        <span class="badge ${badgeClass}">${v.status || 'Researching'}</span>
      </div>

      <div style="font-size: 0.85rem; color: var(--text-muted); display: flex; flex-direction: column; gap: 0.25rem;">
        <div>💰 Est. Cost: <strong>${currency}${formatNumber(v.estimatedCost || 0)}</strong></div>
        ${v.contact ? `<div>✉️ Contact: <a href="mailto:${v.contact}" style="color: var(--primary); text-decoration: none;">${v.contact}</a></div>` : ''}
      </div>

      ${
        v.keyQuestions
          ? `
        <div style="background: var(--bg-card-subtle); padding: 0.75rem; border-radius: var(--radius-sm); font-size: 0.8rem; color: var(--text-main);">
          <strong>Key Questions / Deliverables:</strong>
          <div>${v.keyQuestions}</div>
        </div>
      `
          : ''
      }

      <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; margin-top: auto; padding-top: 0.5rem; border-top: 1px solid var(--border);">
        <select class="form-select vendor-status-select" style="font-size: 0.78rem; padding: 0.3rem 0.5rem; width: auto;" data-vendor-idx="${idx}">
          <option value="Researching" ${v.status === 'Researching' ? 'selected' : ''}>Researching</option>
          <option value="Inquired" ${v.status === 'Inquired' || v.status === 'Contacted' ? 'selected' : ''}>Inquired / Contacted</option>
          <option value="Contracted" ${v.status === 'Contracted' ? 'selected' : ''}>Contracted</option>
          <option value="Paid" ${v.status === 'Paid' ? 'selected' : ''}>Paid in Full</option>
        </select>

        <button class="btn btn-outline btn-sm btn-open-rfp" data-vendor-idx="${idx}">
          <span>✉️</span> Draft AI RFP
        </button>
      </div>
    `;
    container.appendChild(card);
  });
}

function updateVendorStatus(idx, status) {
  if (activeEvent?.vendors?.[idx]) {
    activeEvent.vendors[idx].status = status;
    saveEventsToStorage();
    renderVendorTab();
    renderHeroAndMetrics();
    showToast(`Updated status to ${status}!`);
  }
}

/**
 * Initializes button listener for adding new vendors.
 */
function initVendorListeners() {
  const addVendorBtn = document.getElementById('btn-add-vendor');
  if (addVendorBtn) {
    addVendorBtn.addEventListener('click', () => {
      const name = prompt('Vendor Name / Business:');
      if (!name) return;
      const category = prompt('Category (e.g. Photography, Catering, Florals):', 'Service');
      const estimatedCost = parseFloat(prompt('Estimated Cost:', '1000')) || 0;

      activeEvent.vendors.push({
        id: 'v_' + Date.now(),
        name,
        category,
        role: category,
        estimatedCost,
        status: 'Researching',
        contact: '',
        keyQuestions: 'Inquire for package pricing and contract terms.'
      });
      saveEventsToStorage();
      renderVendorTab();
      renderHeroAndMetrics();
      showToast('Added vendor!');
    });
  }
}
