const {test} = require('node:test');
const assert = require('node:assert/strict');
const {gateway} = require('./helpers/rsvp-gateway.cjs');
test('saved timestamps come from the server and remain stable on retries', () => {
  const g = gateway(), p = g.payload(); p.submittedAt = 'fake';
  const first = g.submit(p); assert.equal(first.prior.submittedAt, '2026-11-11T12:00:00.000Z');
  assert.equal(g.submit(p).prior.submittedAt, first.prior.submittedAt);
  assert.equal(g.lookup(g.code(10)).prior.submittedAt, first.prior.submittedAt);
});
