const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../server');
const { cleanAndParseJSON, validatePlanOutput } = require('../src/services/geminiService');
const { escapeHTML, sanitizeInput } = require('../src/middleware/validator');
const {
  getCacheKey,
  getFromCache,
  setInCache,
  responseCache
} = require('../src/services/cacheService');

// ─── cleanAndParseJSON edge cases ────────────────────────────────────────────

test('Parser: Handles JSON with leading/trailing whitespace', () => {
  const result = cleanAndParseJSON('   {"name": "test"}   ');
  assert.deepEqual(result, { name: 'test' });
});

test('Parser: Extracts JSON from text with multiple braces', () => {
  const raw = 'Here is your plan: {"a":1, "nested": {"b":2}} end.';
  const result = cleanAndParseJSON(raw);
  assert.equal(result.a, 1);
  assert.equal(result.nested.b, 2);
});

test('Parser: Handles markdown code fence with json label', () => {
  const raw = 'Sure!\n```json\n{"key": "value"}\n```\nDone.';
  const result = cleanAndParseJSON(raw);
  assert.deepEqual(result, { key: 'value' });
});

test('Parser: Handles markdown code fence without json label', () => {
  const raw = '```\n{"x": 42}\n```';
  const result = cleanAndParseJSON(raw);
  assert.deepEqual(result, { x: 42 });
});

test('Parser: Throws on completely invalid input', () => {
  assert.throws(() => cleanAndParseJSON('no json here at all'), /Malformed JSON/);
});

test('Parser: Throws on empty string', () => {
  assert.throws(() => cleanAndParseJSON(''), /Malformed JSON|Unexpected end/);
});

// ─── validatePlanOutput detailed tests ───────────────────────────────────────

test('Validator: Reports non-number guestCount', () => {
  const plan = {
    summary: { guestCount: 'fifty', budgetTotal: 10000 },
    theme: {},
    budget: { total: 10000, categories: [{ name: 'A', allocated: 10000 }] },
    timelineMilestones: [],
    runOfShow: [],
    vendors: [],
    personalizedIdeas: {}
  };
  const result = validatePlanOutput(plan);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('guestCount must be a number')));
});

test('Validator: Reports non-number budgetTotal in summary', () => {
  const plan = {
    summary: { guestCount: 100, budgetTotal: 'ten thousand' },
    theme: {},
    budget: { total: 10000, categories: [{ name: 'A', allocated: 10000 }] },
    timelineMilestones: [],
    runOfShow: [],
    vendors: [],
    personalizedIdeas: {}
  };
  const result = validatePlanOutput(plan);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('budgetTotal must be a number')));
});

test('Validator: Reports non-number budget.total', () => {
  const plan = {
    summary: { guestCount: 100, budgetTotal: 10000 },
    theme: {},
    budget: { total: 'not a number', categories: [{ name: 'A', allocated: 10000 }] },
    timelineMilestones: [],
    runOfShow: [],
    vendors: [],
    personalizedIdeas: {}
  };
  const result = validatePlanOutput(plan);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('budget.total must be a number')));
});

test('Validator: Reports empty categories array', () => {
  const plan = {
    summary: { guestCount: 100, budgetTotal: 10000 },
    theme: {},
    budget: { total: 10000, categories: [] },
    timelineMilestones: [],
    runOfShow: [],
    vendors: [],
    personalizedIdeas: {}
  };
  const result = validatePlanOutput(plan);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('non-empty array')));
});

test('Validator: Reports category with non-string name', () => {
  const plan = {
    summary: { guestCount: 100, budgetTotal: 10000 },
    theme: {},
    budget: { total: 10000, categories: [{ name: 123, allocated: 10000 }] },
    timelineMilestones: [],
    runOfShow: [],
    vendors: [],
    personalizedIdeas: {}
  };
  const result = validatePlanOutput(plan);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('name must be a string')));
});

test('Validator: Reports category with non-number allocated', () => {
  const plan = {
    summary: { guestCount: 100, budgetTotal: 10000 },
    theme: {},
    budget: { total: 10000, categories: [{ name: 'A', allocated: 'lots' }] },
    timelineMilestones: [],
    runOfShow: [],
    vendors: [],
    personalizedIdeas: {}
  };
  const result = validatePlanOutput(plan);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('allocated must be a number')));
});

test('Validator: Passes when categories sum within 10% of total', () => {
  const plan = {
    summary: { guestCount: 100, budgetTotal: 10000 },
    theme: {},
    budget: {
      total: 10000,
      categories: [
        { name: 'A', allocated: 5000 },
        { name: 'B', allocated: 4500 }
      ]
    },
    timelineMilestones: [],
    runOfShow: [],
    vendors: [],
    personalizedIdeas: {}
  };
  const result = validatePlanOutput(plan);
  assert.equal(result.valid, true);
});

// ─── escapeHTML edge cases ───────────────────────────────────────────────────

test('escapeHTML: Handles empty string', () => {
  assert.equal(escapeHTML(''), '');
});

test('escapeHTML: Handles string with no special chars', () => {
  assert.equal(escapeHTML('Hello World'), 'Hello World');
});

test('escapeHTML: Escapes all five special characters', () => {
  assert.equal(escapeHTML('&<>"\''), '&amp;&lt;&gt;&quot;&#39;');
});

test('escapeHTML: Handles img onerror XSS vector', () => {
  const input = '<img src=x onerror=alert(1)>';
  const output = escapeHTML(input);
  assert.ok(!output.includes('<'));
  assert.ok(!output.includes('>'));
});

// ─── sanitizeInput edge cases ────────────────────────────────────────────────

test('sanitizeInput: Returns numbers unchanged', () => {
  assert.equal(sanitizeInput(42), 42);
});

test('sanitizeInput: Returns null unchanged', () => {
  assert.equal(sanitizeInput(null), null);
});

test('sanitizeInput: Returns boolean unchanged', () => {
  assert.equal(sanitizeInput(true), true);
});

test('sanitizeInput: Trims and escapes combined', () => {
  const result = sanitizeInput('  <b>test</b>  ');
  assert.equal(result, '&lt;b&gt;test&lt;/b&gt;');
});

// ─── Cache Service tests ────────────────────────────────────────────────────

test('Cache: getCacheKey produces different keys for different inputs', () => {
  const key1 = getCacheKey('plan', { title: 'A' });
  const key2 = getCacheKey('plan', { title: 'B' });
  assert.notEqual(key1, key2);
});

test('Cache: getCacheKey produces different keys for different prefixes', () => {
  const key1 = getCacheKey('plan', { title: 'A' });
  const key2 = getCacheKey('speech', { title: 'A' });
  assert.notEqual(key1, key2);
});

test('Cache: setInCache and getFromCache round-trip', () => {
  const key = 'test:roundtrip:' + Date.now();
  const data = { result: 'hello' };
  setInCache(key, data);
  const retrieved = getFromCache(key);
  assert.deepEqual(retrieved, data);
  responseCache.delete(key);
});

test('Cache: getFromCache returns null for non-existent key', () => {
  assert.equal(getFromCache('nonexistent:key:' + Date.now()), null);
});

// ─── API Route integration tests ────────────────────────────────────────────

test('API: Health endpoint returns valid JSON with expected fields', async () => {
  const server = app.listen(0);
  const port = server.address().port;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'ok');
    assert.equal(typeof data.uptimeSeconds, 'number');
    assert.equal(typeof data.timestamp, 'string');
    assert.equal(typeof data.hasApiKey, 'boolean');
  } finally {
    server.close();
  }
});

test('API: POST /api/generate-plan rejects non-string location', async () => {
  const server = app.listen(0);
  const port = server.address().port;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/generate-plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location: ['array', 'not', 'string'] })
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('Location must be a string'));
  } finally {
    server.close();
  }
});

test('API: POST /api/generate-plan rejects oversized specialNotes', async () => {
  const server = app.listen(0);
  const port = server.address().port;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/generate-plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ specialNotes: 'X'.repeat(501) })
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('Special notes exceeds'));
  } finally {
    server.close();
  }
});

test('API: POST /api/generate-plan rejects oversized themeVibe', async () => {
  const server = app.listen(0);
  const port = server.address().port;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/generate-plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ themeVibe: 'T'.repeat(201) })
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('Theme/vibe exceeds'));
  } finally {
    server.close();
  }
});

test('API: POST /api/chat rejects non-string message', async () => {
  const server = app.listen(0);
  const port = server.address().port;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 123 })
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test('API: GET /api/nonexistent returns 404 or default', async () => {
  const server = app.listen(0);
  const port = server.address().port;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/nonexistent`);
    // Express returns 404 for unknown routes
    assert.ok([200, 404].includes(res.status));
  } finally {
    server.close();
  }
});

test('API: Security headers are present on health endpoint', async () => {
  const server = app.listen(0);
  const port = server.address().port;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`);
    // Helmet sets various security headers
    assert.ok(res.headers.has('x-content-type-options'));
    assert.ok(res.headers.has('x-frame-options'));
    // x-powered-by should NOT be present
    assert.equal(res.headers.has('x-powered-by'), false);
  } finally {
    server.close();
  }
});
