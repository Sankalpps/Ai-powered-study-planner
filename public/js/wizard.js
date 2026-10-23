/**
 * @fileoverview Modal Dialogs Initialization and Vendor RFP Modal Handler
 * @module wizard
 */

/**
 * Initializes all accessible dialog modals with focus management and event bindings.
 */
function initModals() {
  function openAccessibleModal(modal) {
    if (!modal) return;
    modal.showModal();
    const firstInput = modal.querySelector(
      'input:not([type="hidden"]), select, textarea, button:not([data-close-modal])'
    );
    if (firstInput) {
      setTimeout(() => firstInput.focus(), 50);
    }
  }

  // Wizard Modal
  const modalWizard = document.getElementById('modal-wizard');
  document.getElementById('btn-new-event').addEventListener('click', () => {
    openAccessibleModal(modalWizard);
  });

  // Settings Modal
  const modalSettings = document.getElementById('modal-settings');
  document.getElementById('btn-open-settings').addEventListener('click', () => {
    document.getElementById('settings-api-key').value = AIService.getCustomApiKey();
    document.getElementById('settings-model').value = AIService.getSelectedModel();
    openAccessibleModal(modalSettings);
  });

  // Close modals on backdrop click or close button
  document.querySelectorAll('dialog.custom-modal').forEach((modal) => {
    modal.addEventListener('click', (e) => {
      const rect = modal.getBoundingClientRect();
      const isInDialog =
        rect.top <= e.clientY &&
        e.clientY <= rect.top + rect.height &&
        rect.left <= e.clientX &&
        e.clientX <= rect.left + rect.width;
      if (!isInDialog) {
        modal.close();
      }
    });
  });

  document.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const modalId = btn.getAttribute('data-close-modal');
      const modal = document.getElementById(modalId);
      if (modal) modal.close();
    });
  });

  // Settings Form Submit
  document.getElementById('form-settings').addEventListener('submit', (e) => {
    e.preventDefault();
    const key = document.getElementById('settings-api-key').value;
    const model = document.getElementById('settings-model').value;
    AIService.setCustomApiKey(key);
    AIService.setSelectedModel(model);
    modalSettings.close();
    showToast('Settings saved successfully!');
  });

  // Reset sample data
  document.getElementById('btn-reset-sample-data').addEventListener('click', () => {
    if (
      confirm(
        'Reset all events back to default showcase templates? Any unsaved plans will be cleared.'
      )
    ) {
      allEvents = [...SAMPLE_EVENTS];
      activeEvent = allEvents[0];
      saveEventsToStorage();
      renderApp();
      modalSettings.close();
      showToast('Restored default showcase templates!');
    }
  });

  // Wizard Form Submit (GenAI Event Plan Generation)
  document.getElementById('form-wizard').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('wiz-submit-btn');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>⏳</span> Synthesizing Plan with Gemini...';

    const formData = {
      eventType: document.getElementById('wiz-event-type').value,
      eventTitle: document.getElementById('wiz-event-title').value,
      eventDate: document.getElementById('wiz-event-date').value,
      location: document.getElementById('wiz-location').value,
      guestCount: parseInt(document.getElementById('wiz-guest-count').value, 10),
      currency: document.getElementById('wiz-currency').value,
      budgetTotal: parseFloat(document.getElementById('wiz-budget').value),
      themeVibe: document.getElementById('wiz-vibe').value,
      specialNotes: document.getElementById('wiz-notes').value
    };

    try {
      const plan = await AIService.generateEventPlan(formData);
      plan.id = 'event_' + Date.now();
      // Ensure summary has date & location
      plan.summary.eventDate = formData.eventDate;
      plan.summary.location = formData.location;

      allEvents.unshift(plan);
      activeEvent = plan;
      saveEventsToStorage();

      renderApp();
      modalWizard.close();
      document.querySelector('[data-tab="tab-overview"]').click();
      showToast(`✨ Generated full plan for "${plan.summary.title}"!`);
    } catch (err) {
      alert('Event generation failed: ' + err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  });

  // Vendor RFP AI Generation
  document.getElementById('btn-generate-rfp-ai').addEventListener('click', async () => {
    const btn = document.getElementById('btn-generate-rfp-ai');
    btn.disabled = true;
    btn.innerHTML = '<span>⏳</span> Drafting inquiry with Gemini...';

    const vendorId = document.getElementById('rfp-vendor-id').value;
    const vendor = activeEvent.vendors[vendorId];

    const params = {
      vendorCategory: document.getElementById('rfp-category').value,
      vendorName: document.getElementById('rfp-vendor-name').value,
      eventDetails: `${activeEvent.summary.title} on ${formatDate(activeEvent.summary.eventDate)} for ${activeEvent.summary.guestCount} guests at ${activeEvent.summary.location}`,
      budgetRange: `${activeEvent.summary.currency}${vendor ? vendor.estimatedCost : 'Negotiable'}`,
      specificQuestions: document.getElementById('rfp-specifics').value
    };

    try {
      const inquiry = await AIService.generateVendorRFP(params);
      document.getElementById('rfp-result-text').value = inquiry;
      document.getElementById('rfp-result-wrap').style.display = 'block';
      showToast('AI Inquiry letter generated!');
    } catch (err) {
      alert('RFP generation failed: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<span>✨</span> Draft Inquiry Letter with Gemini';
    }
  });

  // Copy RFP
  const copyRfpBtn = document.getElementById('btn-copy-rfp');
  if (copyRfpBtn) {
    copyRfpBtn.addEventListener('click', () => {
      const text = document.getElementById('rfp-result-text').value;
      copyWithFeedback(copyRfpBtn, text, 'Inquiry letter copied to clipboard!');
    });
  }
}

/**
 * Opens the Vendor RFP modal pre-populated with vendor details.
 * @param {number} idx - Index of the vendor in activeEvent.vendors
 */
function openVendorRFPModal(idx) {
  const vendor = activeEvent?.vendors?.[idx];
  if (!vendor) return;

  document.getElementById('rfp-vendor-id').value = idx;
  document.getElementById('rfp-category').value = vendor.category || 'Vendor';
  document.getElementById('rfp-vendor-name').value =
    vendor.name || vendor.role || 'Prospective Vendor';
  document.getElementById('rfp-specifics').value = vendor.keyQuestions || '';
  document.getElementById('rfp-result-wrap').style.display = 'none';

  const modalRfp = document.getElementById('modal-rfp');
  modalRfp.showModal();
  setTimeout(() => document.getElementById('rfp-specifics').focus(), 50);
}

/**
 * Prompts user to edit active event core metadata and updates state.
 */
function handleEditActiveEvent() {
  if (!activeEvent) return;
  const newTitle = prompt('Edit Event Title:', activeEvent.summary.title);
  if (newTitle === null) return;
  const newDate = prompt('Edit Event Date (YYYY-MM-DD):', activeEvent.summary.eventDate);
  if (newDate === null) return;
  const newLocation = prompt('Edit Location:', activeEvent.summary.location || '');
  if (newLocation === null) return;
  const newGuests = parseInt(prompt('Edit Guest Count:', activeEvent.summary.guestCount || 50), 10);
  const newBudget = parseFloat(
    prompt(
      'Edit Total Budget:',
      activeEvent.summary.budgetTotal || activeEvent.budget?.total || 10000
    )
  );

  if (newTitle.trim()) activeEvent.summary.title = newTitle.trim();
  if (newDate.trim()) activeEvent.summary.eventDate = newDate.trim();
  if (newLocation.trim()) activeEvent.summary.location = newLocation.trim();
  if (!isNaN(newGuests) && newGuests > 0) activeEvent.summary.guestCount = newGuests;
  if (!isNaN(newBudget) && newBudget > 0) {
    activeEvent.summary.budgetTotal = newBudget;
    if (activeEvent.budget) activeEvent.budget.total = newBudget;
  }

  saveEventsToStorage();
  renderApp();
  showToast('Event details updated successfully!');
}
