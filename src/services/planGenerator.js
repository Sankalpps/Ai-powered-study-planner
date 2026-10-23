/**
 * @fileoverview High-Level Plan Generation with Validation and Repair Retry
 * @module services/planGenerator
 */

const { callGeminiAPI } = require('./geminiClient');
const { cleanAndParseJSON } = require('./jsonParser');
const { validatePlanOutput } = require('./planValidator');

/**
 * High-level helper that generates an event-plan via Gemini with structured
 * JSON output, validates the result, and optionally performs ONE automatic
 * repair retry when validation fails.
 *
 * @param {string} prompt - The generation prompt
 * @param {string} [systemInstruction=''] - System persona instruction
 * @param {string} [requestedModel=null] - Preferred model identifier
 * @param {string} [customKey=null] - Optional API key override
 * @param {number} [expectedBudget] - Optional expected total budget for validation
 * @returns {Promise<{ data: Object, modelUsed: string, usage: Object|null, repaired: boolean, warnings: string[] }>}
 */
async function generatePlanWithRetry(
  prompt,
  systemInstruction = '',
  requestedModel = null,
  customKey = null,
  expectedBudget
) {
  const warnings = [];

  // --- First attempt ---
  const firstResult = await callGeminiAPI(prompt, systemInstruction, requestedModel, customKey, {
    jsonMode: true
  });
  let parsed = cleanAndParseJSON(firstResult.text);
  let validation = validatePlanOutput(parsed, expectedBudget);

  if (validation.valid) {
    return {
      data: parsed,
      modelUsed: firstResult.modelUsed,
      usage: firstResult.usage,
      repaired: false,
      warnings: []
    };
  }

  // --- Repair retry: append errors to prompt and call again ---
  const repairSuffix =
    '\n\n[VALIDATION ERRORS — please fix these in your response]\n' +
    validation.errors.map((e, i) => `${i + 1}. ${e}`).join('\n');

  const retryResult = await callGeminiAPI(
    prompt + repairSuffix,
    systemInstruction,
    requestedModel,
    customKey,
    { jsonMode: true }
  );
  parsed = cleanAndParseJSON(retryResult.text);
  validation = validatePlanOutput(parsed, expectedBudget);

  if (validation.valid) {
    return {
      data: parsed,
      modelUsed: retryResult.modelUsed,
      usage: retryResult.usage,
      repaired: true,
      warnings: []
    };
  }

  // --- Still invalid — return best-effort result with warnings ---
  warnings.push(...validation.errors);

  return {
    data: parsed,
    modelUsed: retryResult.modelUsed,
    usage: retryResult.usage,
    repaired: true,
    warnings
  };
}

module.exports = { generatePlanWithRetry };
