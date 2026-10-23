/**
 * @fileoverview Shared Route Helper Utilities
 * @module utils/routeHelpers
 */

const { getFromCache, setInCache } = require('../services/cacheService');

/**
 * Sends a standardised JSON error response.
 * @param {import('express').Response} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Error message
 * @returns {import('express').Response}
 */
function sendErrorResponse(res, statusCode, message) {
  return res.status(statusCode).json({ error: message });
}

/**
 * Executes a cached AI generation flow.
 * Checks cache first, calls generator function on miss, stores payload in cache, and sends JSON response.
 *
 * @param {import('express').Response} res - Express response object
 * @param {string} cacheKey - Deterministic cache key
 * @param {() => Promise<Object>} generateFn - Async generator function returning response payload
 * @returns {Promise<void>}
 */
async function handleCachedGeneration(res, cacheKey, generateFn) {
  const cached = getFromCache(cacheKey);
  if (cached) {
    return res.json({ ...cached, fromCache: true });
  }

  const payload = await generateFn();
  setInCache(cacheKey, payload);
  res.json(payload);
}

module.exports = {
  sendErrorResponse,
  handleCachedGeneration
};
