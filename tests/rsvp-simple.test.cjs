const {test} = require('node:test');
const assert = require('node:assert/strict');
const {gateway, sheet, headers, guests} = require('./helpers/rsvp-gateway.cjs');
const clone = value => JSON.parse(JSON.stringify(value));
const untouched = g => g.get('Guestlist').rows.slice(1).map(row => row.slice(2));

test('one simple menu, seven-character group codes and no extra master columns', () => {
  const g = gateway(); g.context.onOpen();
  assert.deepEqual(g.menu, ['Wedding RSVP', ['Update invitation codes', 'updateInvitationCodes']]);
  assert.match(g.code(10), /^[a-z2-9]{7}$/);
  assert.equal(g.get('Guestlist').rows[1][0], g.get('Guestlist').rows[2][0]);
  assert.notEqual(g.code(10), g.code(20));
  assert.deepEqual(g.get('Guestlist').rows[0], headers);
  assert.equal(g.context.doGet().protocol, 3);
});
test('No clears only A/B, never deletes rows or changes C onward', () => {
  const g = gateway({setup: false}), before = untouched(g), count = g.get('Guestlist').rows.length;
  g.setup();
  assert.deepEqual(untouched(g), before);
  assert.equal(g.get('Guestlist').rows.length, count);
  assert.deepEqual(g.get('Guestlist').rows[4].slice(0, 2), ['', '']);
  assert.ok(g.get('Guestlist').writes.every(write => write.column <= 2));
});
test('initial cleanup separates duplicate old codes and replaces old long codes', () => {
  const rows = clone([headers, ...guests]); rows[3][0] = rows[1][0]; rows[2][0] = 'a'.repeat(32);
  const g = gateway({guestRows: rows});
  assert.notEqual(g.code(10), g.code(20)); assert.equal(g.get('Guestlist').rows[1][0], g.get('Guestlist').rows[2][0]);
});
test('refresh, sorting, accidental A edits and adding group members preserve codes', () => {
  const g = gateway(), code = g.code(10), group20 = g.code(20);
  g.get('Guestlist').rows = [headers, ...g.get('Guestlist').rows.slice(1).reverse()];
  g.get('Guestlist').rows.find(row => row[5] === 'Alex Tan')[0] = 'mistake';
  g.get('Guestlist').rows.push(['', 10, '', 'Friends', '', 'New Guest', 'Yes', '', '', '', '', '']);
  g.setup(); assert.equal(g.code(10), code); assert.equal(g.code(20), group20);
  assert.equal(g.lookup(code).household.members.length, 3);
});
test('No then Yes requires re-entering B, which restores the original group code', () => {
  const g = gateway(), code = g.code(10);
  g.master(2, 'Invite Intent', 'No'); g.edit(2, 7);
  assert.deepEqual(g.get('Guestlist').rows[1].slice(0, 2), ['', '']);
  g.master(2, 'Invite Intent', 'Yes'); g.edit(2, 7);
  assert.equal(g.get('Guestlist').rows[1][0], '');
  g.master(2, 'RSVP Group', 10); g.edit(2, 2);
  assert.equal(g.get('Guestlist').rows[1][0], code);
});
test('retired groups reserve their codes and a new household gets a separate unused link', () => {
  const g = gateway(), old = g.code(10);
  g.master(2, 'Invite Intent', 'No'); g.master(3, 'Invite Intent', 'No'); g.edit(2, 7, 2);
  g.get('Guestlist').rows.push(['', 99, '', 'Friends', '', 'New Household', 'Yes', '', 'No', '', '', '']);
  g.edit(6, 2); assert.notEqual(g.code(99), old);
  assert.equal(g.lookup(old).errorCode, 'unknown_invitation');
});
test('the update command handles a 500-person guest list without altering manual fields', () => {
  const rows = [headers, ...Array.from({length: 500}, (_, i) => ['', Math.floor(i / 2), '', 'Friends', '', 'Fictional Guest ' + i, 'Yes', 'H', 'No', 'J', 'K', ''])];
  const g = gateway({guestRows: rows}); const codes = new Set(g.get('Guestlist').rows.slice(1).map(row => row[0]));
  assert.equal(codes.size, 250); assert.ok(g.get('Guestlist').rows.slice(1).every(row => row[7] === 'H' && row[9] === 'J' && row[10] === 'K'));
  assert.equal(g.submit(g.payload(g.code(0))).ok, true);
});
test('blank G prepares a code but is not invited, blank B clears A without blocking other groups', () => {
  const rows = clone([headers, ...guests]); rows[1][6] = ''; rows[3][1] = '';
  const g = gateway({guestRows: rows});
  assert.match(g.code(10), /^[a-z2-9]{7}$/); assert.equal(g.get('Guestlist').rows[3][0], '');
  assert.deepEqual(g.lookup(g.code(10)).household.members.map(m => m.name), ['Jamie Lim']);
  assert.match(g.toasts[0][0], /1 invited guests need a group/);
  g.master(3, 'Invite Intent', ''); g.edit(3, 7);
  assert.equal(g.lookup(g.code(10)).errorCode, 'unknown_invitation');
});
test('only B/G source edits trigger synchronization, including multi-column pastes', () => {
  const g = gateway(); const master = g.get('Guestlist'); master.writes = [];
  g.edit(2, 10); g.edit(2, 8); g.edit(2, 6); assert.equal(master.writes.length, 0);
  const other = sheet('Guestlist [Test]', clone(master.rows)); g.edit(2, 2, 1, 1, other); assert.equal(master.writes.length, 0);
  g.edit(2, 1, 3, 7); assert.ok(master.writes.length);
});
test('stable links survive a failed A write because the register commits first', () => {
  const g = gateway({setup: false}); g.get('Guestlist').fail = 'write';
  assert.throws(g.setup); const registered = [...g.properties.values()].filter(v => v.startsWith('{')).map(JSON.parse);
  g.get('Guestlist').fail = null; g.setup(); assert.equal(g.code(10), registered.find(item => item.group === '10').code);
});
test('already-sent unambiguous short links are retained but conflicting sent links stop safely', () => {
  const rows = clone([headers, ...guests]); rows[1][0] = rows[2][0] = 'abc789'; rows[1][8] = rows[2][8] = 'Yes';
  assert.equal(gateway({guestRows: rows}).code(10), 'abc789');
  rows[3][0] = 'abc789'; const g = gateway({setup: false, guestRows: rows});
  assert.throws(g.setup, /ambiguous/); assert.equal(g.get('Guestlist').writes.length, 0);
});
test('wrong source headers stop before writing the guest list', () => {
  const rows = clone([headers, ...guests]); rows[0][5] = 'Table'; const g = gateway({setup: false, guestRows: rows});
  assert.throws(g.setup, /positions/); assert.equal(g.get('Guestlist').writes.length, 0);
});
test('only named eligible guests are returned and family events differ from friends', () => {
  const g = gateway(); assert.deepEqual(g.lookup(g.code(10)).household.events, ['dinner']);
  assert.deepEqual(g.lookup(g.code(20)).household.events, ['tea', 'dinner']);
  assert.equal(g.lookup(g.code(10)).household.members.length, 2);
  assert.equal(g.lookup('unknown').errorCode, 'unknown_invitation');
});
test('mixed schedules, missing names, duplicate names and shared codes fail only the affected invitation', () => {
  for (const mutate of [g => g.master(3, 'Category', 'Family'), g => g.master(3, 'Name', ''), g => g.master(3, 'Name', 'Alex Tan'), g => g.master(4, headers[0], g.code(10))]) {
    const g = gateway(); mutate(g); assert.equal(g.lookup(g.code(10)).ok, false);
    if (g.get('Guestlist').rows[3][0] !== g.code(10)) assert.equal(g.lookup(g.code(20)).ok, true);
  }
});
test('the single update command flags invalid invitations before sending, without changing manual columns', () => {
  const g = gateway(); g.master(3, 'Category', 'Family'); const before = untouched(g);
  assert.throws(g.setup, /Group 10/); assert.deepEqual(untouched(g), before);
  g.master(3, 'Category', 'Friends'); g.setup(); assert.equal(g.lookup(g.code(10)).ok, true);
});
test('first save, mixed attendance, reopening and updating retain the latest reply and full history', () => {
  const g = gateway(), before = clone(g.get('Guestlist').rows), p = g.payload(); p.members[0].dietary = 'Vegetarian'; p.members[1].attending = 'no';
  assert.equal(g.submit(p).status, 'saved');
  let result = g.lookup(g.code(10)); assert.equal(result.prior.members[0].dietary, 'Vegetarian'); assert.equal(result.prior.members[1].attending, 'no');
  const update = g.payload(); update.members[0].notes = 'Updated'; assert.equal(g.submit(update).ok, true);
  result = g.lookup(g.code(10)); assert.equal(result.prior.members[0].notes, 'Updated'); assert.equal(g.history().length, 2);
  assert.deepEqual(g.get('Guestlist').rows, before);
  assert.equal(g.get('RSVP Responses').rows[1][0], 'Alex Tan');
});
test('guest No never changes host Invite Intent, codes or manual RSVP cells', () => {
  const g = gateway(), before = clone(g.get('Guestlist').rows);
  assert.equal(g.submit(g.payload(g.code(10), 'no')).ok, true); assert.deepEqual(g.get('Guestlist').rows, before);
});
test('family tea attendance is independent, mandatory and saved separately', () => {
  const g = gateway(), p = g.payload(g.code(20)); p.members[0].tea = '';
  assert.equal(g.submit(p).errorCode, 'incomplete_reply'); p.members[0].tea = 'no';
  const result = g.submit(p); assert.equal(result.prior.members[0].tea, 'no'); assert.equal(result.prior.members[0].attending, 'yes');
});
test('incomplete, added, omitted, repeated, renamed or oversized guest answers cannot corrupt a save', () => {
  const g = gateway();
  for (const mutate of [p => p.members[0].attending = '', p => p.members.pop(), p => p.members.push({...p.members[0], id: 'uninvited'}), p => p.members[1].id = p.members[0].id, p => p.members[0].dietary = 'a'.repeat(301), p => p.members[0].notes = 'a'.repeat(1001)]) {
    const p = g.payload(); mutate(p); assert.equal(g.submit(p).ok, false); assert.equal(g.history().length, 0);
  }
  const p = g.payload(); p.members[0].name = 'Spoof'; assert.equal(g.submit(p).prior.members[0].name, 'Alex Tan');
});
test('friends cannot inject tea attendance and declining guests have no stale dietary claim', () => {
  const g = gateway(), p = g.payload(g.code(10), 'no'); p.members[0].tea = 'yes'; p.members[0].dietary = 'Old diet';
  const result = g.submit(p); assert.equal(result.prior.members[0].tea, ''); assert.equal(result.prior.members[0].dietary, '');
});
test('safe retries do not duplicate writes; request IDs cannot be reused for changed answers', () => {
  const g = gateway(), p = g.payload(); const first = g.submit(p); assert.deepEqual(g.submit(p), first);
  assert.equal(g.history().length, 1); p.members[0].attending = 'no'; assert.equal(g.submit(p).errorCode, 'invalid_request');
});
test('two open forms cannot silently overwrite each other', () => {
  const g = gateway(), a = g.payload(), b = g.payload(); g.submit(a);
  assert.equal(g.submit(b).errorCode, 'conflict'); assert.equal(g.history().length, 1);
  const c = g.payload(); g.submit(c); assert.equal(g.submit(a).errorCode, 'conflict');
});
test('failed writes preserve the prior reply and uncertain committed writes retry once', () => {
  const g = gateway(); g.submit(g.payload()); const prior = g.lookup(g.code(10)).prior;
  const p = g.payload(g.code(10), 'no'); g.get('RSVP Responses').fail = 'write';
  assert.equal(g.submit(p).ok, false); assert.deepEqual(g.lookup(g.code(10)).prior, prior);
  g.get('RSVP Responses').fail = 'after-write'; assert.equal(g.submit(p).ok, false);
  assert.equal(g.submit(p).ok, true); assert.equal(g.history().length, 2);
  assert.equal(g.get('RSVP Responses').rows[1][2], 'No');
});
test('visible cache failure does not destroy a durable saved reply, refresh repairs it', () => {
  const g = gateway(); g.get('RSVP Responses').fail = 'cache';
  assert.equal(g.submit(g.payload()).ok, true); assert.equal(g.lookup(g.code(10)).prior.members[0].attending, 'yes');
  g.get('RSVP Responses').fail = null; g.setup(); assert.equal(g.get('RSVP Responses').rows[1][2], 'Yes');
});
test('new members invalidate stale forms but preserve existing members saved replies', () => {
  const g = gateway(); g.submit(g.payload()); const stale = g.payload(), old = g.code(10);
  g.get('Guestlist').rows.push(['', 10, '', 'Friends', '', 'New Guest', 'Yes', '', '', '', '', '']); g.edit(6, 2);
  assert.equal(g.code(10), old); assert.equal(g.submit(stale).errorCode, 'roster_changed');
  const result = g.lookup(old); assert.equal(result.household.members.length, 3); assert.equal(result.prior.members.length, 2);
  assert.equal(g.submit(g.payload()).ok, true); assert.equal(g.lookup(old).prior.members.length, 3);
});
test('host withdrawals remove only that guest; all withdrawn invalidates the link, not its history', () => {
  const g = gateway(); g.submit(g.payload()); const code = g.code(10), p = g.payload();
  g.master(2, 'Invite Intent', 'No'); g.edit(2, 7); assert.equal(g.lookup(code).household.members.length, 1);
  assert.equal(g.submit(p).errorCode, 'roster_changed');
  g.master(3, 'Invite Intent', 'No'); g.edit(3, 7); assert.equal(g.lookup(code).errorCode, 'unknown_invitation'); assert.equal(g.history().length, 1);
});
test('sorting does not change IDs, roster version or assign someone else saved answers', () => {
  const g = gateway(); g.submit(g.payload()); const before = g.lookup(g.code(10));
  g.get('Guestlist').rows = [headers, ...g.get('Guestlist').rows.slice(1).reverse()]; g.setup();
  const after = g.lookup(g.code(10)); assert.equal(after.household.rosterVersion, before.household.rosterVersion);
  assert.deepEqual(after.prior.members.map(m => m.id).sort(), before.prior.members.map(m => m.id).sort());
});
test('existing stable Guest IDs support name corrections and duplicate IDs are rejected', () => {
  const rows = clone([headers, ...guests]); rows[0].push('Guest ID (do not edit)'); rows.slice(1).forEach((row, i) => row.push('id-' + i));
  const g = gateway({guestRows: rows}); g.submit(g.payload()); g.master(2, 'Name', 'Alex Corrected');
  assert.equal(g.lookup(g.code(10)).prior.members[0].name, 'Alex Corrected');
  g.master(3, 'Guest ID (do not edit)', 'id-0'); assert.equal(g.lookup(g.code(10)).ok, false);
});
test('people with the same name in different groups have independent IDs and replies', () => {
  const rows = clone([headers, ...guests]); rows[3][5] = 'Alex Tan';
  const g = gateway({guestRows: rows});
  const friend = g.lookup(g.code(10)), family = g.lookup(g.code(20));
  assert.equal(friend.ok, true); assert.equal(family.ok, true);
  assert.notEqual(friend.household.members[0].id, family.household.members[0].id);
  g.submit(g.payload(g.code(10))); assert.equal(g.lookup(g.code(20)).prior, null);
});
test('legacy response tab is archived intact; unrelated Test, History and Dashboard tabs stay untouched', () => {
  const old = [['URL Code (do not edit)', 'Name'], ['old123', 'Fictional Guest']];
  const g = gateway({setup: false, responseRows: old});
  const other = sheet('Guestlist [Test]', [['reference']]); g.tabs.set(other.name, other); g.setup();
  assert.deepEqual(g.get('RSVP Responses (Previous)').rows, old); assert.deepEqual(other.rows, [['reference']]);
  assert.equal(g.get('RSVP Responses').rows[0][0], 'Name');
});
test('corrupt new headers or history stop saves without replacing or clearing old records', () => {
  const g = gateway(); g.submit(g.payload()); const p = g.payload();
  g.get('RSVP Responses').rows[1][16] = '{broken'; assert.equal(g.submit(p).ok, false);
  assert.equal(g.get('RSVP Responses').rows[1][16], '{broken');
  g.get('RSVP Responses').rows[0][0] = 'Changed'; assert.throws(g.setup, /headers/);
});
test('sheet formulas in guest text stay literal and raw log remains valid JSON', () => {
  const g = gateway(), p = g.payload(); p.members[0].dietary = '=IMPORTXML("x")'; p.members[0].notes = '+SUM(1,2)';
  assert.equal(g.submit(p).ok, true); const row = g.get('RSVP Responses').rows[1];
  assert.equal(row[4], "'=IMPORTXML(\"x\")"); assert.equal(row[5], "'+SUM(1,2)"); assert.equal(JSON.parse(row[16]).members[0].notes, '+SUM(1,2)');
});
test('busy, malformed, unknown, unconfigured and old-protocol requests never write replies', () => {
  const g = gateway(); g.context.busy = true; assert.equal(g.lookup(g.code(10)).errorCode, 'busy'); g.context.busy = false;
  assert.equal(g.api({action: 'lookup', code: g.code(10), protocol: 2}).errorCode, 'upgrade_required');
  assert.equal(g.api({action: 'lookup', code: g.code(10), environment: 'test'}).errorCode, 'upgrade_required');
  assert.equal(g.api({action: 'other'}).ok, false); assert.equal(g.context.doPost({postData: {contents: '{'}}).ok, false);
  assert.equal(g.context.doPost({postData: {contents: 'x'.repeat(100001)}}).ok, false); assert.equal(g.history().length, 0);
  const fresh = gateway({setup: false}); assert.equal(fresh.lookup('abcdefg').errorCode, 'setup_required');
});
