const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validatePlanOutput } = require('../src/services/geminiService');
const { escapeHTML, sanitizeInput } = require('../src/middleware/validator');

const sampleCode = fs.readFileSync(path.join(__dirname, '../public/js/sample-data.js'), 'utf8');
const SAMPLE_EVENTS = new Function(`${sampleCode}; return SAMPLE_EVENTS;`)();

test('validatePlanOutput: Passes valid event plan structure', () => {
  const validPlan = SAMPLE_EVENTS[0];
  const result = validatePlanOutput(validPlan, validPlan.budget.total);
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test('validatePlanOutput: Rejects missing required top-level keys', () => {
  const incomplete = { summary: { guestCount: 50, budgetTotal: 5000 } };
  const result = validatePlanOutput(incomplete);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('theme')));
  assert.ok(result.errors.some(e => e.includes('budget')));
  assert.ok(result.errors.some(e => e.includes('timelineMilestones')));
});

test('validatePlanOutput: Flags budget category sum mismatch > 10%', () => {
  const mismatchedPlan = {
    summary: { guestCount: 100, budgetTotal: 10000 },
    theme: { conceptName: 'Retro' },
    budget: {
      total: 10000,
      categories: [
        { name: 'Catering', allocated: 2000 } // only 2,000 out of 10,000 (diff is 8000 > 1000)
      ]
    },
    timelineMilestones: [],
    runOfShow: [],
    vendors: [],
    personalizedIdeas: {}
  };
  const result = validatePlanOutput(mismatchedPlan);
  assert.equal(result.valid, false);
  assert.ok(result.errors.length > 0);
  assert.ok(result.errors.some(e => e.includes('10%')), `Expected 10% error, got: ${JSON.stringify(result.errors)}`);
});

test('escapeHTML: Escapes dangerous HTML characters', () => {
  const dirty = '<img src=x onerror="alert(\'xss\')">&test';
  const clean = escapeHTML(dirty);
  assert.equal(clean, '&lt;img src=x onerror=&quot;alert(&#39;xss&#39;)&quot;&gt;&amp;test');
});

test('sanitizeInput: Sanitizes script tags and escapes special HTML entities', () => {
  const dirty = '<b>Party</b><script>alert(1)</script>';
  const clean = sanitizeInput(dirty);
  assert.equal(clean, '&lt;b&gt;Party&lt;/b&gt;');
});

test('validatePlanInput: Rejects specialNotes exceeding 500 characters', () => {
  const { validatePlanInput } = require('../src/middleware/validator');
  const req = {
    body: {
      specialNotes: 'A'.repeat(501)
    }
  };
  let statusCode = null;
  let responseData = null;
  const res = {
    status(code) {
      statusCode = code;
      return {
        json(data) {
          responseData = data;
        }
      };
    }
  };
  let nextCalled = false;
  validatePlanInput(req, res, () => { nextCalled = true; });

  assert.equal(statusCode, 400);
  assert.ok(responseData.error.includes('Special notes exceeds maximum allowed length'));
  assert.equal(nextCalled, false);
});

test('validatePlanInput: Rejects location exceeding 200 characters', () => {
  const { validatePlanInput } = require('../src/middleware/validator');
  const req = {
    body: {
      location: 'L'.repeat(201)
    }
  };
  let statusCode = null;
  let responseData = null;
  const res = {
    status(code) {
      statusCode = code;
      return {
        json(data) {
          responseData = data;
        }
      };
    }
  };
  let nextCalled = false;
  validatePlanInput(req, res, () => { nextCalled = true; });

  assert.equal(statusCode, 400);
  assert.ok(responseData.error.includes('Location exceeds maximum allowed length'));
  assert.equal(nextCalled, false);
});

test('validatePlanInput: Rejects themeVibe exceeding 200 characters', () => {
  const { validatePlanInput } = require('../src/middleware/validator');
  const req = {
    body: {
      themeVibe: 'T'.repeat(201)
    }
  };
  let statusCode = null;
  let responseData = null;
  const res = {
    status(code) {
      statusCode = code;
      return {
        json(data) {
          responseData = data;
        }
      };
    }
  };
  let nextCalled = false;
  validatePlanInput(req, res, () => { nextCalled = true; });

  assert.equal(statusCode, 400);
  assert.ok(responseData.error.includes('Theme/vibe exceeds maximum allowed length'));
  assert.equal(nextCalled, false);
});

test('validatePlanInput: Passes valid text and sanitizes inputs properly', () => {
  const { validatePlanInput } = require('../src/middleware/validator');
  const req = {
    body: {
      eventTitle: 'Galactic Gala',
      guestCount: '150',
      budgetTotal: '25000',
      location: 'Orbit Venue',
      themeVibe: 'Space Neo-Retro',
      specialNotes: 'No peanuts <script>alert(1)</script>'
    }
  };
  const res = {};
  let nextCalled = false;
  validatePlanInput(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, true);
  assert.equal(req.body.guestCount, 150);
  assert.equal(req.body.budgetTotal, 25000);
  assert.equal(req.body.specialNotes, 'No peanuts');
});


