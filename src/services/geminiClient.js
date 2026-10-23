/**
 * @fileoverview Gemini API HTTP Client with Model Cascading and Retry Logic
 * @module services/geminiClient
 */

const {
  DEFAULT_GEMINI_KEY,
  DEFAULT_MODEL,
  FALLBACK_MODEL,
  normalizeModel,
  NON_RETRYABLE_STATUSES,
  RETRYABLE_STATUSES,
  MODEL_ATTEMPT_TIMEOUT_MS,
  RETRY_DELAY_MS
} = require('../config/constants');

/**
 * Returns a promise that resolves after `ms` milliseconds.
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Attempts to extract an HTTP status code from an error message.
 * @param {Error} err - Error to parse
 * @returns {number|null} HTTP status code or null
 */
function parseStatusFromError(err) {
  const match = err?.message?.match(/\((\d{3})\)/);
  return match ? Number(match[1]) : null;
}

/**
 * Builds the request payload for the Gemini API call.
 * @param {string} prompt - Prompt text
 * @param {string} systemInstruction - System instruction
 * @param {boolean} jsonMode - Whether to constrain output to JSON
 * @param {Object|null} responseSchema - Optional JSON schema
 * @returns {Object} Request body object
 */
function buildRequestBody(prompt, systemInstruction, jsonMode, responseSchema) {
  const generationConfig = { temperature: 0.7, topP: 0.95 };
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
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }
  return body;
}

/**
 * Handles non-OK HTTP response by throwing non-retryable errors or returning retry directive.
 * @param {Response} response - Fetch Response
 * @param {number} attempt - Current attempt index
 * @returns {Promise<{ shouldRetry: boolean, error: Error }>}
 */
async function handleResponseError(response, attempt) {
  const status = response.status;
  if (NON_RETRYABLE_STATUSES.has(status)) {
    throw new Error(`Upstream model error (${status}): request is invalid or key is unauthorised.`);
  }

  const err = new Error(`Upstream model error (${status})`);
  if (RETRYABLE_STATUSES.has(status) && attempt === 0) {
    await delay(RETRY_DELAY_MS);
    return { shouldRetry: true, error: err };
  }
  return { shouldRetry: false, error: err };
}

/**
 * Executes a single attempt against a specific model with AbortController timeout.
 * @param {string} model - Model identifier
 * @param {string} apiKey - Gemini API key
 * @param {Object} body - Serialized request body
 * @returns {Promise<{ text: string, modelUsed: string, usage: Object|null }>}
 */
async function executeAttempt(model, apiKey, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MODEL_ATTEMPT_TIMEOUT_MS);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
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
      return { response, error: null };
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('Empty response received from AI model.');
    }

    return {
      success: true,
      result: { text, modelUsed: model, usage: data.usageMetadata || null }
    };
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      return {
        timeout: true,
        error: new Error(`Model ${model} timed out after ${MODEL_ATTEMPT_TIMEOUT_MS}ms`)
      };
    }
    return { error: err };
  }
}

/**
 * Invokes Google Gemini API with automatic model cascading on traffic spikes.
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

  const modelsToTry = [
    normalizeModel(requestedModel || DEFAULT_MODEL),
    FALLBACK_MODEL,
    'gemini-3.5-flash'
  ];
  const uniqueModels = [...new Set(modelsToTry)];
  const body = buildRequestBody(prompt, systemInstruction, jsonMode, responseSchema);

  let lastError = null;

  for (const model of uniqueModels) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const outcome = await executeAttempt(model, apiKey, body);

      if (outcome.success) {
        return outcome.result;
      }

      if (outcome.response) {
        const errorResult = await handleResponseError(outcome.response, attempt);
        lastError = errorResult.error;
        if (errorResult.shouldRetry) continue;
        break;
      }

      if (outcome.timeout) {
        lastError = outcome.error;
        break;
      }

      lastError = outcome.error;
      if (NON_RETRYABLE_STATUSES.has(parseStatusFromError(lastError))) {
        throw lastError;
      }
      if (attempt > 0) break;
    }
  }

  throw lastError || new Error('All model attempts failed.');
}

module.exports = {
  callGeminiAPI,
  NON_RETRYABLE_STATUSES,
  RETRYABLE_STATUSES,
  MODEL_ATTEMPT_TIMEOUT_MS,
  RETRY_DELAY_MS
};
