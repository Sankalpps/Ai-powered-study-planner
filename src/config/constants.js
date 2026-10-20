/**
 * @fileoverview Application Constants and Configuration Defaults
 * @module config/constants
 */

require('dotenv').config();

const MODEL_ALIASES = {
  'gemini-1.5-flash': 'gemini-3.5-flash',
  'gemini-2.0-flash': 'gemini-3.5-flash',
  'gemini-2.0-flash-lite': 'gemini-3.5-flash-lite',
  'gemini-2.5-flash': 'gemini-3.5-flash',
  'gemini-2.5-flash-lite': 'gemini-3.5-flash-lite',
  'gemini-3.8-flash': 'gemini-3.5-flash',
  'gemini-3.8-flash-lite': 'gemini-3.5-flash-lite'
};

function normalizeModel(model) {
  return MODEL_ALIASES[model] || model;
}

module.exports = {
  PORT: process.env.PORT || 3000,
  DEFAULT_GEMINI_KEY: process.env.GEMINI_API_KEY || '',
  DEFAULT_MODEL: normalizeModel(process.env.DEFAULT_MODEL || 'gemini-3.5-flash'),
  FALLBACK_MODEL: normalizeModel(process.env.FALLBACK_MODEL || 'gemini-3.5-flash-lite'),
  normalizeModel,
  CACHE_TTL_MS: 30 * 60 * 1000, // 30 minutes in milliseconds
  MAX_CACHE_SIZE: 250,
  REQUEST_TIMEOUT_MS: 30000
};
