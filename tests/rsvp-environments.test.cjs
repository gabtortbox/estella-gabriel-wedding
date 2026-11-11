const {test} = require('node:test');
const assert = require('node:assert/strict');
const {gateway, sheet} = require('./helpers/rsvp-gateway.cjs');
test('retired test-tab routes cannot submit to the live guest list', () => {
  const g = gateway(), before = JSON.stringify(g.get('Guestlist').rows);
  const extra = sheet('Guestlist [Test]', [['Leave this archived tab alone']]); g.tabs.set(extra.name, extra);
  assert.equal(g.api({action: 'submit', environment: 'test', payload: g.payload()}).errorCode, 'upgrade_required');
  assert.equal(g.history().length, 0); assert.equal(JSON.stringify(g.get('Guestlist').rows), before);
  assert.deepEqual(extra.rows, [['Leave this archived tab alone']]);
});
