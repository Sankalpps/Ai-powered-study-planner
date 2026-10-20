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
    // Strip <script> tags first to prevent executable script blocks
    const stripped = val.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    return escapeHTML(stripped.trim());
  }
  return val;
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

  // Validate optional text fields are strings and within length limits
  if (specialNotes !== undefined) {
    if (typeof specialNotes !== 'string') {
      return res.status(400).json({ error: 'Special notes must be a string.' });
    }
    if (specialNotes.length > 500) {
      return res
        .status(400)
        .json({ error: 'Special notes exceeds maximum allowed length of 500 characters.' });
    }
  }

  if (location !== undefined) {
    if (typeof location !== 'string') {
      return res.status(400).json({ error: 'Location must be a string.' });
    }
    if (location.length > 200) {
      return res
        .status(400)
        .json({ error: 'Location exceeds maximum allowed length of 200 characters.' });
    }
  }

  if (themeVibe !== undefined) {
    if (typeof themeVibe !== 'string') {
      return res.status(400).json({ error: 'Theme/vibe must be a string.' });
    }
    if (themeVibe.length > 200) {
      return res
        .status(400)
        .json({ error: 'Theme/vibe exceeds maximum allowed length of 200 characters.' });
    }
  }

  if (guestCount !== undefined) {
    const count = parseInt(guestCount, 10);
    if (isNaN(count) || count < 1 || count > 50000) {
      return res
        .status(400)
        .json({ error: 'Guest count must be a positive number between 1 and 50,000.' });
    }
    req.body.guestCount = count;
  }

  if (budgetTotal !== undefined) {
    const budget = parseFloat(budgetTotal);
    if (isNaN(budget) || budget <= 0 || budget > 100000000) {
      return res.status(400).json({ error: 'Budget must be a positive number up to 100,000,000.' });
    }
    req.body.budgetTotal = budget;
  }

  // Sanitize all text fields in request body
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
