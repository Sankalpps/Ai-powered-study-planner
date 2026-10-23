const test = require('node:test');
const assert = require('node:assert/strict');
const { cleanAndParseJSON } = require('../src/services/jsonParser');
const { validatePlanOutput } = require('../src/services/planValidator');
const { callGeminiAPI } = require('../src/services/geminiClient');
const { sendErrorResponse, handleCachedGeneration } = require('../src/utils/routeHelpers');
const { responseCache } = require('../src/services/cacheService');

// ─── jsonParser unit tests ───────────────────────────────────────────────────

test('jsonParser: cleanAndParseJSON parses direct JSON objects', () => {
  const input = '{"title": "Gala Dinner", "budget": 5000}';
  const parsed = cleanAndParseJSON(input);
  assert.equal(parsed.title, 'Gala Dinner');
  assert.equal(parsed.budget, 5000);
});

test('jsonParser: cleanAndParseJSON extracts JSON wrapped in markdown code fence', () => {
  const input = '```json\n{"theme": "Retro", "count": 42}\n```';
  const parsed = cleanAndParseJSON(input);
  assert.equal(parsed.theme, 'Retro');
  assert.equal(parsed.count, 42);
});

test('jsonParser: cleanAndParseJSON throws descriptive error on invalid string', () => {
  assert.throws(
    () => cleanAndParseJSON('Not a JSON string at all'),
    /Malformed JSON received from AI engine/
  );
});

// ─── planValidator unit tests ────────────────────────────────────────────────

test('planValidator: validatePlanOutput validates complete valid plan', () => {
  const validPlan = {
    summary: { guestCount: 50, budgetTotal: 10000 },
    theme: { conceptName: 'Rustic Chic' },
    budget: {
      total: 10000,
      categories: [
        { name: 'Catering', allocated: 6000 },
        { name: 'Venue', allocated: 4000 }
      ]
    },
    timelineMilestones: [{ id: '1', timeframe: '1 month', task: 'Book DJ' }],
    runOfShow: [{ time: '10:00 AM', activity: 'Setup' }],
    vendors: [{ id: 'v1', category: 'Music', role: 'DJ' }],
    personalizedIdeas: { invitationCopy: { headline: 'Welcome' } }
  };

  const result = validatePlanOutput(validPlan, 10000);
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test('planValidator: validatePlanOutput flags missing top-level keys', () => {
  const incompletePlan = {
    summary: { guestCount: 50, budgetTotal: 10000 }
  };

  const result = validatePlanOutput(incompletePlan);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('Missing required top-level key: "theme"')));
});

test('planValidator: validatePlanOutput flags significant budget deviation (> 25%)', () => {
  const plan = {
    summary: { guestCount: 50, budgetTotal: 20000 },
    theme: {},
    budget: { total: 20000, categories: [{ name: 'All', allocated: 20000 }] },
    timelineMilestones: [],
    runOfShow: [],
    vendors: [],
    personalizedIdeas: {}
  };

  const result = validatePlanOutput(plan, 10000);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('deviates significantly')));
});

// ─── geminiClient unit tests with mocked fetch ──────────────────────────────

test('geminiClient: callGeminiAPI returns parsed text on successful mock response', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'Generated event response' }] } }],
        usageMetadata: { promptTokenCount: 15, candidatesTokenCount: 20 }
      })
    };
  };

  try {
    const result = await callGeminiAPI('Test prompt', '', null, 'fake-api-key');
    assert.equal(result.text, 'Generated event response');
    assert.ok(result.modelUsed);
    assert.equal(result.usage.promptTokenCount, 15);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('geminiClient: callGeminiAPI immediately throws on non-retryable 400 error', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    return {
      ok: false,
      status: 400,
      json: async () => ({ error: { message: 'Invalid API argument' } })
    };
  };

  try {
    await assert.rejects(async () => {
      await callGeminiAPI('Test prompt', '', null, 'fake-api-key');
    }, /Upstream model error \(400\)/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('geminiClient: callGeminiAPI cascades when first model attempt times out', async () => {
  const originalFetch = globalThis.fetch;
  const modelsTried = [];

  globalThis.fetch = async (url) => {
    const match = url.match(/models\/([^:]+):/);
    if (match) modelsTried.push(match[1]);

    if (modelsTried.length === 1) {
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      throw err;
    }

    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'Cascaded model response' }] } }]
      })
    };
  };

  try {
    const result = await callGeminiAPI('Prompt', '', 'gemini-3.5-flash', 'test-key');
    assert.equal(result.text, 'Cascaded model response');
    assert.ok(modelsTried.length >= 2, 'Should have cascaded to second model');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ─── routeHelpers unit tests ────────────────────────────────────────────────

test('routeHelpers: sendErrorResponse sets status and returns JSON error object', () => {
  let capturedStatus = null;
  let capturedJson = null;

  const mockRes = {
    status(code) {
      capturedStatus = code;
      return this;
    },
    json(data) {
      capturedJson = data;
      return this;
    }
  };

  sendErrorResponse(mockRes, 403, 'Forbidden action');
  assert.equal(capturedStatus, 403);
  assert.deepEqual(capturedJson, { error: 'Forbidden action' });
});

test('routeHelpers: handleCachedGeneration executes generator on cache miss and serves cached on hit', async () => {
  const testKey = 'test:routehelper:' + Date.now();
  responseCache.delete(testKey);

  let generatorCallCount = 0;
  const mockGenerate = async () => {
    generatorCallCount++;
    return { success: true, message: 'fresh data' };
  };

  let responseData = null;
  const mockRes = {
    json(data) {
      responseData = data;
      return this;
    }
  };

  // 1. Cache Miss
  await handleCachedGeneration(mockRes, testKey, mockGenerate);
  assert.equal(generatorCallCount, 1);
  assert.equal(responseData.message, 'fresh data');
  assert.equal(responseData.fromCache, undefined);

  // 2. Cache Hit
  await handleCachedGeneration(mockRes, testKey, mockGenerate);
  assert.equal(generatorCallCount, 1, 'Generator should not be called on cache hit');
  assert.equal(responseData.fromCache, true);

  responseCache.delete(testKey);
});
