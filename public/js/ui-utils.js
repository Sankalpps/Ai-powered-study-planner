/**
 * @fileoverview UI Utility Helpers: formatting, toasts, clipboard, markdown rendering
 * @module ui-utils
 */

/**
 * Formats a date string to a locale-friendly short form.
 * @param {string} dateStr - ISO date string
 * @returns {string} Formatted date
 */
function formatDate(dateStr) {
  if (!dateStr) return 'Date TBD';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Calculates the number of days remaining until the given date.
 * @param {string} dateStr - ISO date string
 * @returns {number} Days remaining (negative if past)
 */
function calculateDaysRemaining(dateStr) {
  if (!dateStr) return 0;
  const target = new Date(dateStr);
  const now = new Date();
  const diffTime = target - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Formats a number with locale-aware thousand separators.
 * @param {number} num - Number to format
 * @returns {string} Formatted number string
 */
function formatNumber(num) {
  if (!num) return '0';
  return Math.round(num).toLocaleString('en-US');
}

/**
 * Displays a transient toast notification.
 * @param {string} msg - Message to display
 */
function showToast(msg) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>✨</span><span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

/**
 * Copies text to clipboard and updates button feedback.
 * @param {HTMLElement} buttonElement - Button element to update
 * @param {string} textToCopy - Text to copy
 * @param {string} successMessage - Toast message on success
 * @param {string} [defaultLabel] - Label to restore after feedback
 */
function copyWithFeedback(buttonElement, textToCopy, successMessage, defaultLabel) {
  if (!textToCopy) return;
  navigator.clipboard
    .writeText(textToCopy)
    .then(() => {
      if (buttonElement) {
        const prevHtml = buttonElement.innerHTML;
        buttonElement.innerHTML = '<span aria-hidden="true">✓</span> Copied!';
        setTimeout(() => {
          buttonElement.innerHTML = defaultLabel || prevHtml;
        }, 1500);
      }
      showToast(successMessage);
    })
    .catch(() => {
      showToast(successMessage);
    });
}

/**
 * Converts a markdown-like string to sanitized HTML for display.
 * @param {string} text - Markdown text
 * @returns {string} HTML string
 */
function formatMarkdown(text) {
  if (!text) return '';
  let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Headers
  html = html.replace(
    /^### (.*$)/gim,
    '<h4 style="margin: 0.5rem 0 0.25rem 0; font-size: 0.95rem; font-weight: 700; color: var(--text-main);">$1</h4>'
  );
  html = html.replace(
    /^## (.*$)/gim,
    '<h3 style="margin: 0.6rem 0 0.3rem 0; font-size: 1.05rem; font-weight: 800; color: var(--text-main);">$1</h3>'
  );
  html = html.replace(
    /^# (.*$)/gim,
    '<h2 style="margin: 0.75rem 0 0.35rem 0; font-size: 1.15rem; font-weight: 800; color: var(--text-main);">$1</h2>'
  );

  // Bold & Italic
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Bullet items
  html = html.replace(
    /^\s*[\*\-]\s+(.*$)/gim,
    '<li style="margin-left: 1.25rem; margin-bottom: 0.25rem;">$1</li>'
  );

  // Numbered list items
  html = html.replace(
    /^\s*(\d+)\.\s+(.*$)/gim,
    '<li style="margin-left: 1.25rem; margin-bottom: 0.25rem;"><strong>$1.</strong> $2</li>'
  );

  // Newlines
  html = html.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');
  return html;
}

/**
 * Returns an emoji icon representing the event type.
 * @param {string} type - Event type string
 * @returns {string} Emoji character
 */
function getEventTypeIcon(type) {
  switch (type?.toLowerCase()) {
    case 'wedding':
      return '💍';
    case 'birthday':
      return '🎂';
    case 'community':
      return '🌳';
    case 'corporate':
      return '💼';
    case 'anniversary':
      return '🥂';
    default:
      return '🎉';
  }
}

/**
 * Initializes tabs with full ARIA attributes and arrow-key navigation (WCAG).
 */
function initTabs() {
  const tabButtons = Array.from(document.querySelectorAll('.tab-btn'));
  tabButtons.forEach((btn, index) => {
    btn.addEventListener('click', () => {
      tabButtons.forEach((b) => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
        b.setAttribute('tabindex', '-1');
      });
      document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));

      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      btn.setAttribute('tabindex', '0');

      const targetId = btn.getAttribute('data-tab');
      const targetContent = document.getElementById(targetId);
      if (targetContent) {
        targetContent.classList.add('active');
        targetContent.focus();
      }
    });

    // Arrow Key Navigation across tabs (WCAG standard)
    btn.addEventListener('keydown', (e) => {
      let nextIndex = null;
      if (e.key === 'ArrowRight') {
        nextIndex = (index + 1) % tabButtons.length;
      } else if (e.key === 'ArrowLeft') {
        nextIndex = (index - 1 + tabButtons.length) % tabButtons.length;
      } else if (e.key === 'Home') {
        nextIndex = 0;
      } else if (e.key === 'End') {
        nextIndex = tabButtons.length - 1;
      }

      if (nextIndex !== null) {
        e.preventDefault();
        tabButtons[nextIndex].focus();
        tabButtons[nextIndex].click();
      }
    });
  });
}
