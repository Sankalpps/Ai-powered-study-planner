const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../server');

test('Rate Limiting: aiGenerationLimiter is mounted on /api/generate-plan and limits to 40 req/5min', async () => {
  const server = app.listen(0);
  const port = server.address().port;

  try {
    // Send 1st request to check rate limit headers
    const firstRes = await fetch(`http://127.0.0.1:${port}/api/generate-plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guestCount: 'invalid' })
    });

    // RateLimit-Limit header should reflect the AI limiter threshold of 40 (not general 120)
    const limitHeader = firstRes.headers.get('ratelimit-limit');
    assert.equal(limitHeader, '40', 'Expected AI rate limit to be 40');

    // Send requests to consume the remaining allowance (already sent 1, need 40 more to trigger 429)
    let lastRes = firstRes;
    for (let i = 0; i < 40; i++) {
      lastRes = await fetch(`http://127.0.0.1:${port}/api/generate-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestCount: 'invalid' })
      });
    }

    // The 41st request must trigger 429 Too Many Requests
    assert.equal(lastRes.status, 429, 'Expected 429 Too Many Requests');
    const data = await lastRes.json();
    assert.ok(
      data.error.includes('AI generation rate limit reached'),
      'Expected rate limit error message'
    );
  } finally {
    server.close();
  }
});
