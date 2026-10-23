/**
 * @fileoverview Input Sanitization and Schema Validation Middleware
 * @module middleware/validator
 */

/**
 * Escapes HTML special characters to prevent XSS vulnerabilities.
 * @param {string} str - String to escape
 * @returns {string} Escaped string with HTML entities
 */
function escapeHTML(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Sanitizes input value by stripping script blocks, trimming, and escaping HTML entities.
 * @param {any} val - Value to sanitize
 * @returns {any} Sanitized value
 */
function sanitizeInput(val) {
  if (typeof val === 'string') {
    const stripped = val.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    return escapeHTML(stripped.trim());
  }
  return val;
}

/**
 * Validates a text field type and maximum length.
 * @param {any} val - Value to check
 * @param {string} name - Display name for error message
 * @param {number} max - Maximum character length
 * @returns {string|null} Error string or null if valid
 */
function checkTextField(val, name, max) {
  if (val === undefined) return null;
  if (typeof val !== 'string') {
    return `${name} must be a string.`;
  }
  if (val.length > max) {
    return `${name} exceeds maximum allowed length of ${max} characters.`;
  }
  return null;
}

/**
 * Validates guest count bounds.
 * @param {any} val - Raw guest count
 * @returns {{ count?: number, error?: string }}
 */
function checkGuestCount(val) {
  if (val === undefined) return {};
  const count = parseInt(val, 10);
  if (isNaN(count) || count < 1 || count > 50000) {
    return { error: 'Guest count must be a positive number between 1 and 50,000.' };
  }
  return { count };
}

/**
 * Validates budget total bounds.
 * @param {any} val - Raw budget total
 * @returns {{ budget?: number, error?: string }}
 */
function checkBudgetTotal(val) {
  if (val === undefined) return {};
  const budget = parseFloat(val);
  if (isNaN(budget) || budget <= 0 || budget > 100000000) {
    return { error: 'Budget must be a positive number up to 100,000,000.' };
  }
  return { budget };
}

/**
 * Express middleware validating event plan generation request payloads.
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Next handler
 */
function validatePlanInput(req, res, next) {
  const { eventTitle, guestCount, budgetTotal, specialNotes, location, themeVibe } = req.body;

  if (eventTitle && typeof eventTitle === 'string' && eventTitle.length > 200) {
    return res
      .status(400)
      .json({ error: 'Event title exceeds maximum allowed length of 200 characters.' });
  }

  const textChecks = [
    checkTextField(specialNotes, 'Special notes', 500),
    checkTextField(location, 'Location', 200),
    checkTextField(themeVibe, 'Theme/vibe', 200)
  ];
  for (const err of textChecks) {
    if (err) return res.status(400).json({ error: err });
  }

  const guestResult = checkGuestCount(guestCount);
  if (guestResult.error) return res.status(400).json({ error: guestResult.error });
  if (guestResult.count !== undefined) req.body.guestCount = guestResult.count;

  const budgetResult = checkBudgetTotal(budgetTotal);
  if (budgetResult.error) return res.status(400).json({ error: budgetResult.error });
  if (budgetResult.budget !== undefined) req.body.budgetTotal = budgetResult.budget;

  for (const key of Object.keys(req.body)) {
    req.body[key] = sanitizeInput(req.body[key]);
  }

  next();
}

module.exports = {
  escapeHTML,
  sanitizeInput,
  validatePlanInput
};
