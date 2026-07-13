const test = require('node:test');
const assert = require('node:assert');
const { resolveBrand, getBrand } = require('../netlify/functions/_brands');

test('resolves harveygreystone from its hostname', () => {
  assert.strictEqual(resolveBrand('app.harveygreystone.com'), 'harveygreystone');
});

test('unknown hostname falls back to default', () => {
  assert.strictEqual(resolveBrand('hgc-deal-platform-463556847516.us-central1.run.app'), 'harveygreystone');
  assert.strictEqual(resolveBrand(undefined), 'harveygreystone');
});

test('explicit override beats hostname', () => {
  assert.strictEqual(resolveBrand('app.harveygreystone.com', 'capitalstreams'), 'capitalstreams');
});

test('invalid override is ignored', () => {
  assert.strictEqual(resolveBrand('app.harveygreystone.com', 'nonsense'), 'harveygreystone');
});

test('hostname with port resolves', () => {
  assert.strictEqual(resolveBrand('app.harveygreystone.com:443'), 'harveygreystone');
});

test('getBrand returns full config with key', () => {
  const b = getBrand('capitalstreams');
  assert.strictEqual(b.key, 'capitalstreams');
  assert.strictEqual(b.wordmark, 'CAPITAL STREAMS');
  assert.ok(b.legalEntity.includes('Capital Streams LLC'));
});
