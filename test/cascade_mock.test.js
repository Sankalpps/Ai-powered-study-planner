const test = require('node:test');
const assert = require('node:assert/strict');
const { callGeminiAPI, generatePlanWithRetry } = require('../src/services/geminiService');
const app = require('../server');

test('Cascade: 400 Bad Request throws immediately without retrying/cascading', async () => {
  const originalFetch = global.fetch;
  let callCount = 0;
  global.fetch = async () => {
    callCount++;
    return {
      ok: false,
      status: 400,
      json: async () => ({ error: { message: 'Invalid prompt argument' } })
    };
  };

  try {
    await assert.rejects(
      async () => {
        await callGeminiAPI('Test prompt', '', 'gemini-2.0-flash', 'fake-key');
      },
      /Upstream model error \(400\)/
    );
    // Crucial: 400 is NON_RETRYABLE, so exactly 1 call was made
    assert.equal(callCount, 1);
  } finally {
    global.fetch = originalFetch;
  }
});

test('Cascade: 429 Rate Limit triggers 1 retry on same model then cascades', async () => {
  const originalFetch = global.fetch;
  const attemptedModels = [];

  global.fetch = async (url) => {
    const match = url.match(/models\/([^:]+):/);
    if (match) attemptedModels.push(match[1]);

    if (attemptedModels.length < 3) {
      // First 2 calls (initial + retry) return 429
      return {
        ok: false,
        status: 429,
        json: async () => ({ error: { message: 'Resource exhausted' } })
      };
    }

    // Third call (cascaded model) succeeds
    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '{"success": true}' }] } }]
      })
    };
  };

  try {
    const result = await callGeminiAPI('Test prompt', '', 'gemini-2.0-flash', 'fake-key');
    assert.ok(result.text.includes('success'));
    // The first model was tried twice (attempt 0, then attempt 1), then cascaded to fallback model
    assert.equal(attemptedModels[0], 'gemini-3.5-flash');
    assert.equal(attemptedModels[1], 'gemini-3.5-flash');
    assert.equal(attemptedModels[2], 'gemini-3.5-flash-lite');
  } finally {
    global.fetch = originalFetch;
  }
});

test('Cascade: AbortError timeout cascades to next model', async () => {
  const originalFetch = global.fetch;
  const attemptedModels = [];

  global.fetch = async (url) => {
    const match = url.match(/models\/([^:]+):/);
    if (match) attemptedModels.push(match[1]);

    if (attemptedModels.length === 1) {
      // Simulate timeout abort
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
    const result = await callGeminiAPI('Test prompt', '', 'gemini-2.0-flash', 'fake-key');
    assert.equal(result.text, 'Cascaded model response');
    assert.equal(attemptedModels[0], 'gemini-3.5-flash');
    assert.equal(attemptedModels[1], 'gemini-3.5-flash-lite');
  } finally {
    global.fetch = originalFetch;
  }
});

test('generatePlanWithRetry: Performs automatic repair retry when initial JSON fails validation', async () => {
  const originalFetch = global.fetch;
  let attempts = 0;

  // 1st response has missing required keys
  const invalidPlanJSON = JSON.stringify({
    summary: { title: 'Incomplete' }
  });

  // 2nd response (repair retry) is complete and valid
  const validPlanJSON = JSON.stringify({
    summary: { title: 'Repaired Gala', guestCount: 100, budgetTotal: 10000, currency: '$', eventType: 'celebration' },
    theme: { conceptName: 'Gold' },
    budget: { total: 10000, categories: [{ name: 'Venue', allocated: 10000 }] },
    timelineMilestones: [{ id: 'm1', timeframe: '1 month', phase: 'Prep', task: 'Book', priority: 'High', done: false }],
    runOfShow: [{ time: '09:00 AM', activity: 'Start', lead: 'Host' }],
    vendors: [{ id: 'v1', category: 'Venue', role: 'Host', estimatedCost: 10000, status: 'Contracted' }],
    personalizedIdeas: { signatureActivities: [], invitationCopy: { headline: 'Welcome', opening: 'Join us', details: 'Venue', rsvpNote: 'RSVP' } }
  });

  global.fetch = async (url, options) => {
    attempts++;
    const isRetry = options && options.body && options.body.includes('[VALIDATION ERRORS');
    const returnText = isRetry ? validPlanJSON : invalidPlanJSON;

    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: returnText }] } }],
        usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 100 }
      })
    };
  };

  try {
    const result = await generatePlanWithRetry('Generate plan', '', 'gemini-2.0-flash', 'fake-key', 10000);
    assert.equal(result.repaired, true);
    assert.equal(result.data.summary.title, 'Repaired Gala');
    assert.equal(attempts, 2);
  } finally {
    global.fetch = originalFetch;
  }
});

test('Creative Routes: POST /api/generate-speech returns generated speech', async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url, opts) => {
    if (typeof url === 'string' && url.includes('127.0.0.1')) {
      return originalFetch(url, opts);
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'Here is your heartfelt speech with [pause] delivery cues.' }] } }]
      })
    };
  };

  const server = app.listen(0);
  const port = server.address().port;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/generate-speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-custom-api-key': 'test-mock-key' },
      body: JSON.stringify({
        speechType: 'toast',
        speakerName: 'Alex',
        honoreeName: 'Jordan',
        tone: 'Warm'
      })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.speech.includes('speech with [pause]'));
  } finally {
    global.fetch = originalFetch;
    server.close();
  }
});

test('Creative Routes: POST /api/generate-vendor-rfp returns drafted RFP inquiry', async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url, opts) => {
    if (typeof url === 'string' && url.includes('127.0.0.1')) {
      return originalFetch(url, opts);
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'Dear Vendor, We would love to request a quote for our upcoming celebration...' }] } }]
      })
    };
  };

  const server = app.listen(0);
  const port = server.address().port;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/generate-vendor-rfp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-custom-api-key': 'test-mock-key' },
      body: JSON.stringify({
        vendorCategory: 'Catering',
        vendorName: 'Gourmet Delights'
      })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.inquiry.includes('Dear Vendor'));
  } finally {
    global.fetch = originalFetch;
    server.close();
  }
});

test('Plan Routes: POST /api/generate-plan end-to-end plan generation with mock', async () => {
  const originalFetch = global.fetch;
  const mockPlan = {
    summary: { title: 'Tuscan Night', guestCount: 50, budgetTotal: 5000, currency: '$', eventType: 'wedding' },
    theme: { conceptName: 'Tuscan' },
    budget: { total: 5000, categories: [{ name: 'Venue', allocated: 5000 }] },
    timelineMilestones: [{ id: 'm1', timeframe: '6 months', phase: 'Planning', task: 'Book', priority: 'High', done: false }],
    runOfShow: [{ time: '10:00 AM', activity: 'Arrival', lead: 'Host' }],
    vendors: [{ id: 'v1', category: 'Venue', role: 'Host', estimatedCost: 5000, status: 'Contracted' }],
    personalizedIdeas: { signatureActivities: [], invitationCopy: { headline: 'Join us', opening: 'Cordially', details: 'Details', rsvpNote: 'RSVP' } }
  };

  global.fetch = async (url, opts) => {
    if (typeof url === 'string' && url.includes('127.0.0.1')) {
      return originalFetch(url, opts);
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: JSON.stringify(mockPlan) }] } }]
      })
    };
  };

  const server = app.listen(0);
  const port = server.address().port;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/generate-plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-custom-api-key': 'test-mock-key' },
      body: JSON.stringify({
        eventTitle: 'Tuscan Night',
        guestCount: 50,
        budgetTotal: 5000
      })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.data.summary.title, 'Tuscan Night');
  } finally {
    global.fetch = originalFetch;
    server.close();
  }
});
