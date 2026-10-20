const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../server');

test('Efficiency: Health endpoint executes under 100ms', async () => {
  const server = app.listen(0);
  const port = server.address().port;

  try {
    // Warm up connection to avoid cold-start socket resolution jitter
    await fetch(`http://127.0.0.1:${port}/api/health`);

    const start = Date.now();
    const res = await fetch(`http://127.0.0.1:${port}/api/health`);
    assert.equal(res.status, 200);
    const duration = Date.now() - start;
    assert.ok(duration < 100, `Health check took ${duration}ms, expected < 100ms`);
  } finally {
    server.close();
  }
});
