/**
 * @fileoverview Google Gemini AI Client Service with Automated Model Cascading
 * @module services/geminiService
 */

const {
  DEFAULT_GEMINI_KEY,
  DEFAULT_MODEL,
  FALLBACK_MODEL,
  normalizeModel
} = require('../config/constants');

/** HTTP status codes that should NOT be retried or cascaded — the request itself is invalid. */
const NON_RETRYABLE_STATUSES = new Set([400, 401, 403, 404]);

/** HTTP status codes eligible for a single retry before cascading. */
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503]);

/** Per-model-attempt timeout in milliseconds (AbortController). */
const MODEL_ATTEMPT_TIMEOUT_MS = 10_000;

/** Delay before a retry on the same model (ms). */
const RETRY_DELAY_MS = 1_000;

/**
 * Invokes Google Gemini API with automatic model cascading on traffic spikes.
 *
 * **Cascade behaviour (Item 3):**
 * - 400 / 401 / 403 / 404 → throw immediately (bad request or invalid key).
 * - 429 / 5xx → retry ONCE on the same model after 1 s, then cascade.
 * - Timeout (10 s per attempt via AbortController) → cascade to next model.
 *
 * **Structured-JSON mode (Item 1):**
 * Pass `options.jsonMode = true` to add `responseMimeType: "application/json"`
 * to `generationConfig`. Optionally include `options.responseSchema` for
 * constrained decoding.
 *
 * @param {string} prompt - User or system prompt text
 * @param {string} [systemInstruction=''] - Optional system persona instruction
 * @param {string} [requestedModel=null] - Preferred model identifier
 * @param {string} [customKey=null] - Optional user-provided API key override
 * @param {Object} [options={}] - Additional generation options
 * @param {boolean} [options.jsonMode=false] - Enable structured JSON output
 * @param {Object|null} [options.responseSchema=null] - JSON schema for constrained decoding
 * @returns {Promise<{ text: string, modelUsed: string, usage: Object|null }>}
 * @throws {Error} If all cascade attempts fail or key is missing
 */
async function callGeminiAPI(
  prompt,
  systemInstruction = '',
  requestedModel = null,
  customKey = null,
  options = {}
) {
  const { jsonMode = false, responseSchema = null } = options;

  const apiKey = customKey || DEFAULT_GEMINI_KEY;
  if (!apiKey) {
    throw new Error('No Gemini API key configured. Please enter your API key in Settings.');
  }

  // Model cascade: primary first, followed by fallbacks
  const modelsToTry = [
    normalizeModel(requestedModel || DEFAULT_MODEL),
    FALLBACK_MODEL,
    'gemini-3.5-flash'
  ];
  const uniqueModels = [...new Set(modelsToTry)];

  let lastError = null;

  for (const model of uniqueModels) {
    // Each model gets up to 2 attempts (initial + 1 retry for retryable errors).
    const maxAttempts = 2;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), MODEL_ATTEMPT_TIMEOUT_MS);

      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

        const generationConfig = {
          temperature: 0.7,
          topP: 0.95
        };

        if (jsonMode) {
          generationConfig.responseMimeType = 'application/json';
          if (responseSchema) {
            generationConfig.responseSchema = responseSchema;
          }
        }

        const body = {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig
        };

        if (systemInstruction) {
          body.systemInstruction = {
            parts: [{ text: systemInstruction }]
          };
        }

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
          },
          body: JSON.stringify(body),
          signal: controller.signal
        });

        clearTimeout(timer);

        if (!response.ok) {
          const status = response.status;

          // Non-retryable: throw immediately, do NOT cascade
          if (NON_RETRYABLE_STATUSES.has(status)) {
            throw new Error(
              `Upstream model error (${status}): request is invalid or key is unauthorised.`
            );
          }

          // Retryable: retry once on this model, then cascade
          if (RETRYABLE_STATUSES.has(status)) {
            lastError = new Error(`Upstream model error (${status})`);
            if (attempt === 0) {
              await delay(RETRY_DELAY_MS);
              continue; // retry same model
            }
            break; // cascade to next model
          }

          // Any other non-ok status: cascade
          lastError = new Error(`Upstream model error (${status})`);
          break;
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
          throw new Error('Empty response received from AI model.');
        }

        return {
          text,
          modelUsed: model,
          usage: data.usageMetadata || null
        };
      } catch (err) {
        clearTimeout(timer);

        // AbortError means timeout — cascade to the next model immediately.
        if (err.name === 'AbortError') {
          lastError = new Error(`Model ${model} timed out after ${MODEL_ATTEMPT_TIMEOUT_MS}ms`);
          break; // cascade to next model
        }

        lastError = err;

        // Non-retryable errors thrown explicitly above should propagate.
        if (NON_RETRYABLE_STATUSES.has(parseStatusFromError(err))) {
          throw err;
        }

        // For any other error on attempt 0, allow the retry loop to continue.
        // On attempt 1 (or non-retryable), break to cascade.
        if (attempt > 0) break;
      }
    }
  }

  throw lastError || new Error('All model attempts failed.');
}

/**
 * Extracts and parses valid JSON from raw or markdown-fenced AI output.
 * @param {string} rawText - Model output string
 * @returns {Object} Parsed JavaScript object
 * @throws {Error} If no valid JSON can be extracted
 */
function cleanAndParseJSON(rawText) {
  try {
    return JSON.parse(rawText);
  } catch {
    const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch {}
    }
    const firstBrace = rawText.indexOf('{');
    const lastBrace = rawText.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(rawText.substring(firstBrace, lastBrace + 1));
      } catch {}
    }
    throw new Error('Malformed JSON received from AI engine.');
  }
}

/**
 * Validates that a parsed plan object contains the required structure and
 * internally-consistent budget figures.
 *
 * @param {Object} parsed - The parsed plan object from AI output
 * @param {number} [_expectedBudget] - Optional expected total budget for cross-check
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validatePlanOutput(parsed, _expectedBudget) {
  const errors = [];

  // Optional expected budget cross-check
  if (typeof _expectedBudget === 'number' && typeof parsed?.budget?.total === 'number') {
    const diff = Math.abs(parsed.budget.total - _expectedBudget);
    if (diff > _expectedBudget * 0.25) {
      errors.push(
        `Budget total (${parsed.budget.total}) deviates significantly from expected budget (${_expectedBudget}).`
      );
    }
  }

  // --- Required top-level keys ---
  const requiredKeys = [
    'summary',
    'theme',
    'budget',
    'timelineMilestones',
    'runOfShow',
    'vendors',
    'personalizedIdeas'
  ];
  for (const key of requiredKeys) {
    if (parsed[key] === undefined || parsed[key] === null) {
      errors.push(`Missing required top-level key: "${key}".`);
    }
  }

  // --- summary checks ---
  if (parsed.summary) {
    if (typeof parsed.summary.guestCount !== 'number') {
      errors.push('summary.guestCount must be a number.');
    }
    if (typeof parsed.summary.budgetTotal !== 'number') {
      errors.push('summary.budgetTotal must be a number.');
    }
  }

  // --- budget checks ---
  if (parsed.budget) {
    if (typeof parsed.budget.total !== 'number') {
      errors.push('budget.total must be a number.');
    }

    if (!Array.isArray(parsed.budget.categories) || parsed.budget.categories.length === 0) {
      errors.push('budget.categories must be a non-empty array.');
    } else {
      let allocatedSum = 0;
      for (let i = 0; i < parsed.budget.categories.length; i++) {
        const cat = parsed.budget.categories[i];
        if (typeof cat.name !== 'string') {
          errors.push(`budget.categories[${i}].name must be a string.`);
        }
        if (typeof cat.allocated !== 'number') {
          errors.push(`budget.categories[${i}].allocated must be a number.`);
        } else {
          allocatedSum += cat.allocated;
        }
      }

      // Sum-to-total consistency (within 10%)
      if (typeof parsed.budget.total === 'number' && allocatedSum > 0) {
        const diff = Math.abs(allocatedSum - parsed.budget.total);
        const tolerance = parsed.budget.total * 0.1;
        if (diff > tolerance) {
          errors.push(
            `Budget categories sum (${allocatedSum}) differs from budget.total (${parsed.budget.total}) by more than 10%.`
          );
        }
      }
    }
  }

  return errors.length === 0 ? { valid: true, errors: [] } : { valid: false, errors };
}

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

// ─── Internal helpers ────────────────────────────────────────────────────────

/**
 * Returns a promise that resolves after `ms` milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Attempts to extract an HTTP status code from an error message (best-effort).
 * @param {Error} err
 * @returns {number|null}
 */
function parseStatusFromError(err) {
  const match = err?.message?.match(/\((\d{3})\)/);
  return match ? Number(match[1]) : null;
}

module.exports = {
  callGeminiAPI,
  cleanAndParseJSON,
  validatePlanOutput,
  generatePlanWithRetry
};
