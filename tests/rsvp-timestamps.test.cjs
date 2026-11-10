const {test} = require('node:test');
const assert = require('node:assert/strict');
const {gateway, headers, guests} = require('./helpers/rsvp-gateway.cjs');

test('setup retains existing codes, excludes No and blank intent, and returns only public guest details', () => {
  const h = gateway();
  assert.equal(h.get('Guestlist').rows[1][0], 'old123');
  const result = h.lookup('old123');
  assert.equal(result.protocol, 2);
  assert.equal(result.household.members.length, 2);
  assert.ok(result.household.members.every(m => m.id));
  assert.equal(result.household.household, 'Alex Tan & Jamie Lim');
  assert.doesNotMatch(JSON.stringify(result), /Uni friend|Not invited|Pat Teo|relationship|side/);
  h.master(3, 'Invite Intent', '');
  assert.equal(h.lookup('old123').household.members.length, 1);
  const family = h.lookup('fam123');
  assert.deepEqual(family.household.events, ['tea', 'ceremony']);
});

test('a save returns the exact timestamp and refreshes master tracking and cache', () => {
  const h = gateway(), result = h.submit(h.payload());
  assert.equal(result.ok, true);
  assert.equal(result.status, 'saved');
  assert.equal(result.submittedAt, h.lookup('old123').prior.submittedAt);
  const tab = h.get('Guestlist');
  assert.equal(tab.rows[1][tab.rows[0].indexOf('RSVP')], 'Yes');
  assert.equal(h.history().length, 1);
  assert.equal(h.get('RSVP Responses').rows.length, 3);
  assert.ok(h.get('RSVP Dashboard'));
});

test('unknown codes, unlisted guest IDs, duplicate IDs and missing guests cannot submit', () => {
  for (const alter of [p => {p.code = 'unknown123';}, p => {p.members.push({...p.members[0], id: 'unlisted'});},
    p => {p.members[1].id = p.members[0].id;}, p => {p.members.pop();}]) {
    const h = gateway(), payload = h.payload(); alter(payload);
    assert.equal(h.submit(payload).ok, false);
    assert.equal(h.history().length, 0);
  }
});

test('server uses canonical guest names rather than trusting posted names', () => {
  const h = gateway(), payload = h.payload(); payload.members[0].name = 'Fictional intruder';
  assert.equal(h.submit(payload).ok, true);
  assert.equal(h.lookup('old123').prior.members[0].name, 'Alex Tan');
});

test('exclusion, waitlist and retirement invalidate previously opened forms', () => {
  for (const [field, value] of [['Invite Intent', 'No'], ['Invitation Status', 'Waitlist'], ['Invitation Status', 'Retired']]) {
    const h = gateway(), payload = h.payload(); h.master(2, field, value);
    assert.equal(h.submit(payload).errorCode, 'roster_changed');
    assert.equal(h.history().length, 0);
  }
});

test('every dinner and family tea answer is checked by the server', () => {
  for (const code of ['old123', 'fam123']) {
    const h = gateway(), payload = h.payload(code);
    payload.members[0][code === 'fam123' ? 'tea' : 'attending'] = 'pending';
    assert.equal(h.submit(payload).errorCode, 'missing_answers');
  }
  const h = gateway(), payload = h.payload(); payload.members[0].tea = 'yes';
  assert.equal(h.submit(payload).errorCode, 'invalid_answers');
});

test('retries are idempotent and reusing a request ID for different answers is rejected', () => {
  const h = gateway(), payload = h.payload(), first = h.submit(payload), retry = h.submit(payload);
  assert.equal(retry.revision, first.revision); assert.equal(h.history().length, 1);
  payload.members[0].attending = 'no';
  assert.equal(h.submit(payload).errorCode, 'invalid_request');
});

test('two open forms cannot silently overwrite one another', () => {
  const h = gateway(), first = h.payload(), second = h.payload();
  assert.equal(h.submit(first).ok, true);
  assert.equal(h.submit(second).errorCode, 'conflict');
  assert.equal(h.history().length, 1);
});

test('a retry of a superseded request asks for a reload instead of showing an old acknowledgement', () => {
  const h = gateway(), first = h.payload(); h.submit(first); h.submit(h.payload('old123', 'no'));
  assert.equal(h.submit(first).errorCode, 'conflict');
  assert.equal(h.history().length, 2);
});

test('a renamed or newly added guest invalidates stale forms without losing saved replies', () => {
  const h = gateway(); h.submit(h.payload()); const stale = h.payload();
  h.master(2, 'Name', 'Alex Tan Updated');
  assert.equal(h.submit(stale).errorCode, 'roster_changed');
  assert.equal(h.lookup('old123').prior.members[0].attending, 'yes');
  const tab = h.get('Guestlist');
  const row = Array(tab.rows[0].length).fill('');
  row[1] = 10; row[3] = 'Friends'; row[5] = 'Taylor Koh'; row[6] = 'Yes'; tab.rows.push(row); h.setup();
  const current = h.lookup('old123');
  assert.equal(current.household.members.length, 3);
  assert.equal(current.prior.members.find(m => m.name === 'Taylor Koh').attending, 'pending');
  assert.equal(current.prior.members[0].attending, 'yes');
});

test('failed history writes preserve the previous reply; retries recover a lost acknowledgement', () => {
  const h = gateway(); h.submit(h.payload()); const previous = h.lookup('old123').prior;
  const change = h.payload('old123', 'no'); h.get('Reply History').fail = 'write';
  assert.equal(h.submit(change).ok, false);
  assert.deepEqual(h.lookup('old123').prior, previous);
  h.get('Reply History').fail = 'after-write';
  assert.equal(h.submit(change).ok, false);
  assert.equal(h.submit(change).ok, true);
  assert.equal(h.history().length, 2);
  assert.equal(h.lookup('old123').prior.members[0].attending, 'no');
});

test('tracking cache failure cannot erase or falsely reject a durably saved reply', () => {
  const h = gateway(); h.get('RSVP Responses').fail = 'write';
  const result = h.submit(h.payload());
  assert.equal(result.ok, true);
  assert.equal(h.lookup('old123').prior.members[0].attending, 'yes');
  h.get('RSVP Responses').fail = null; h.context.refreshRsvpTracking();
  assert.equal(h.get('RSVP Responses').rows.length, 3);
});

test('busy locks reject safely and are released even when validation fails', () => {
  const h = gateway(), payload = h.payload(); h.context.busy = true;
  assert.equal(h.submit(payload).errorCode, 'busy'); h.context.busy = false;
  payload.members = []; assert.equal(h.submit(payload).ok, false);
  assert.equal(h.locked(), false);
});

test('post-deadline increases become requests, not confirmed attendance; hosts can approve', () => {
  const h = gateway(); h.submit(h.payload('old123', 'no')); h.config.DEADLINE = '2026-01-01T00:00:00+08:00';
  const result = h.submit(h.payload());
  assert.equal(result.status, 'requested');
  assert.equal(result.prior.members[0].attending, 'no');
  assert.equal(result.pending.members[0].attending, 'yes');
  h.select('Reply History', h.get('Reply History').rows.length); h.context.approveSelectedRequest();
  assert.match(h.alerts.at(-1), /^Change confirmed/);
  assert.equal(h.lookup('old123').prior.members[0].attending, 'yes');
  assert.equal(h.lookup('old123').pending, null);
});

test('declining a request preserves confirmed answers and exposes a clear decision state', () => {
  const h = gateway(); h.submit(h.payload('old123', 'no')); h.config.REVIEW_ALL_CHANGES = true;
  h.submit(h.payload()); h.select('Reply History', h.get('Reply History').rows.length); h.context.declineSelectedRequest();
  const result = h.lookup('old123');
  assert.equal(result.pending, null); assert.ok(result.declinedRequest);
  assert.equal(result.prior.members[0].attending, 'no');
});

test('hosts can close stale requests after an invitation is retired', () => {
  const h = gateway(); h.config.REVIEW_ALL_CHANGES = true; h.submit(h.payload());
  const row = h.get('Reply History').rows.length;
  h.select('Guestlist', 2); h.context.retireSelectedInvitation();
  h.select('Reply History', row); h.context.declineSelectedRequest();
  assert.match(h.alerts.at(-1), /^Request declined/);
  assert.equal(h.history().at(-1).kind, 'declined');
});

test('late cancellations and a first all-declined reply are recorded immediately', () => {
  const h = gateway(); h.submit(h.payload()); h.config.DEADLINE = '2026-01-01T00:00:00+08:00';
  assert.equal(h.submit(h.payload('old123', 'no')).status, 'saved');
  assert.equal(h.submit(h.payload('fam123', 'no')).status, 'saved');
});

test('released seats require approval even before the deadline and capacity blocks host overbooking', () => {
  const h = gateway(); h.submit(h.payload('old123', 'no')); h.select('Guestlist', 2, 2); h.context.releaseSelectedSeats();
  assert.match(h.alerts.at(-1), /^Seats released/);
  const result = h.submit(h.payload()); assert.equal(result.status, 'requested');
  h.config.DINNER_CAPACITY = 1; h.select('Reply History', h.get('Reply History').rows.length); h.context.approveSelectedRequest();
  assert.match(h.alerts.at(-1), /exceed DINNER_CAPACITY/);
  assert.equal(h.lookup('old123').prior.members[0].attending, 'no');
});

test('host-entered replies preserve other members and follow permanent IDs through regrouping', () => {
  const h = gateway(); h.submit(h.payload('old123', 'no'));
  h.select('Guestlist', 2); h.prompts.push('Yes', 'Vegetarian'); h.context.recordSelectedGuestReply();
  assert.match(h.alerts.at(-1), /^Reply recorded/);
  assert.equal(h.lookup('old123').prior.members[1].attending, 'no');
  h.prompts.push('30'); h.context.moveSelectedGuests();
  assert.match(h.alerts.at(-1), /^Guests moved/);
  const newCode = h.get('Guestlist').rows[1][0];
  assert.notEqual(newCode, 'old123'); assert.equal(h.lookup(newCode).prior.members[0].attending, 'yes');
  assert.equal(h.lookup('old123').household.members[0].name, 'Jamie Lim');
});

test('host entry cannot silently dismiss a group change request', () => {
  const h = gateway(); h.config.REVIEW_ALL_CHANGES = true; h.submit(h.payload());
  h.select('Guestlist', 2); h.prompts.push('Yes', 'Vegetarian'); h.context.recordSelectedGuestReply();
  assert.match(h.alerts.at(-1), /pending change request/);
  assert.equal(h.history().length, 1);
  assert.ok(h.lookup('old123').pending);
});

test('missing codes are propagated within a group and new groups get long codes', () => {
  const rows = [headers, ...guests.map(row => [...row])]; rows[2][0] = '';
  rows.push(['', 40, 'Estella', 'Friends', '', 'Quinn Ong', 'Yes', '', '', '', '', '']);
  const h = gateway({guestRows: rows}), master = h.get('Guestlist').rows;
  assert.equal(master[1][0], 'old123'); assert.equal(master[2][0], 'old123');
  assert.match(master.at(-1)[0], /^[a-f0-9]{32}$/);
});

test('ungrouped uninvited planning rows do not block setup or receive invitation identities', () => {
  const rows = [headers, ...guests.map(row => [...row]),
    ['', '', 'Gabriel', 'Friends', 'Planning only', 'Quinn Ong', 'No', '', '', '', '', ''],
    ['', '', 'Estella', 'Family', 'Undecided', 'Taylor Ng', '', '', '', '', '', '']];
  const h = gateway({guestRows: rows}), master = h.get('Guestlist').rows;
  assert.equal(h.lookup('old123').ok, true);
  for (const row of master.slice(-2)) {
    assert.equal(row[0], '');
    assert.equal(row[master[0].indexOf('Guest ID (do not edit)')], '');
    assert.equal(row[master[0].indexOf('Invitation ID (do not edit)')], '');
    assert.equal(row[master[0].indexOf('Invitation Link')], '');
  }
  assert.equal(h.get('RSVP Dashboard').rows.find(r => r[0] === 'Invited guests')[1], 3);
});

test('an invited or previously coded row still requires a group, even when not currently invited', () => {
  for (const [code, intent] of [['', 'Yes'], ['coded123', 'No']]) {
    const rows = [headers, ...guests.map(row => [...row]), [code, '', '', 'Friends', '', 'Quinn Ong', intent, '', '', '', '', '']];
    const h = gateway({guestRows: rows, setup: false}); h.context.setupRsvp();
    assert.match(h.alerts.at(-1), /needs both a Name and RSVP Group/);
    assert.equal(h.lookup('old123').errorCode, 'setup_required');
    assert.equal(h.get('Guestlist').rows.at(-1)[0], code);
  }
});

test('shared-code repair gives only the chosen group a new link before setup', () => {
  const rows = [headers, ...guests.map(row => [...row])]; rows[2][1] = 11;
  const h = gateway({guestRows: rows, setup: false});
  h.context.repairSharedGroupCode(h.ss, '11'); h.setup();
  const master = h.get('Guestlist').rows;
  assert.equal(master[1][0], 'old123'); assert.notEqual(master[2][0], 'old123');
  assert.equal(h.lookup('old123').household.members[0].name, 'Alex Tan');
  assert.equal(h.lookup(master[2][0]).household.members[0].name, 'Jamie Lim');
});

test('shared-code repair preserves legacy answers and timestamps by binding guest IDs first', () => {
  const rows = [headers, ...guests.map(row => [...row])]; rows[2][1] = 11;
  const h = gateway({guestRows: rows, setup: false, responseRows: [
    ['URL Code', 'Name', 'RSVP', 'Dietary', 'Submitted At'],
    ['old123', 'Alex Tan', 'Yes', 'Vegetarian', '2026-10-31T02:15:00Z'],
    ['old123', 'Jamie Lim', 'No', '', '2026-10-31T02:15:00Z']]});
  h.context.repairSharedGroupCode(h.ss, '11'); h.setup();
  assert.equal(h.lookup('old123').prior.members[0].attending, 'yes');
  const result = h.lookup(h.get('Guestlist').rows[2][0]);
  assert.equal(result.prior.members[0].attending, 'no');
  assert.equal(result.prior.submittedAt, '2026-10-31T02:15:00.000Z');
});

test('shared-code repair keeps existing guest IDs and confirmed history after accidental regrouping', () => {
  const h = gateway(); h.submit(h.payload());
  const before = h.lookup('old123').household.members[1].id;
  h.master(3, 'RSVP Group', 11); h.context.repairSharedGroupCode(h.ss, '11'); h.setup();
  const result = h.lookup(h.get('Guestlist').rows[2][0]);
  assert.equal(result.household.members[0].id, before);
  assert.equal(result.prior.members[0].attending, 'yes');
  assert.equal(h.history().length, 1);
});

test('shared-code repair stops before changing codes when legacy names are ambiguous', () => {
  const rows = [headers, ...guests.map(row => [...row])]; rows[2][1] = 11; rows[2][5] = 'Alex Tan';
  const h = gateway({guestRows: rows, setup: false, responseRows: [['URL Code', 'Name', 'RSVP'], ['old123', 'Alex Tan', 'Yes']]});
  assert.throws(() => h.context.repairSharedGroupCode(h.ss, '11'), /cannot be matched uniquely/);
  assert.equal(h.get('Guestlist').rows[1][0], 'old123'); assert.equal(h.get('Guestlist').rows[2][0], 'old123');
  assert.equal(h.get('RSVP Responses').rows[1][2], 'Yes');
});

test('reissue preserves replies but rejects the old link; retirement reveals no guest data', () => {
  const h = gateway(); h.submit(h.payload()); h.select('Guestlist', 2); h.context.reissueSelectedLink();
  const code = h.get('Guestlist').rows[1][0];
  assert.equal(h.lookup('old123').ok, false); assert.equal(h.lookup(code).prior.members[0].attending, 'yes');
  h.context.retireSelectedInvitation(); const result = h.lookup(code);
  assert.equal(result.ok, false); assert.equal(result.household, undefined); assert.equal(h.history().length, 1);
});

test('setup only writes managed columns and retains formulas, manual attendance and original times', () => {
  const data = [headers.concat('Budget Formula'), ...guests.map(r => r.concat('=SUM(1,2)'))];
  data[1][9] = 'Yes';
  const h = gateway({guestRows: data});
  assert.equal(h.get('Guestlist').rows[1][12], '=SUM(1,2)');
  assert.equal(h.lookup('old123').prior.members[0].attending, 'yes');
  assert.equal(h.lookup('old123').prior.submittedAt, null);
  const id = h.get('Guestlist').rows[1][h.get('Guestlist').rows[0].indexOf('Guest ID (do not edit)')];
  h.setup(); assert.equal(h.history().length, 1);
  assert.equal(h.get('Guestlist').rows[1][h.get('Guestlist').rows[0].indexOf('Guest ID (do not edit)')], id);
});

test('migration imports old responses, timestamps and retired ceremony answers without duplicating history', () => {
  const oldHeaders = ['URL Code (do not edit)', 'Name', 'RSVP', 'Tea Ceremony', 'Solemnisation', 'Dietary', 'Member Notes', 'Submitted At'];
  const h = gateway({responseRows: [oldHeaders, ['fam123', 'Sam Lee', 'Yes', 'No', 'Yes', 'Vegetarian', 'Hello', new Date('2026-10-31T02:15:00Z')]]});
  assert.equal(h.lookup('fam123').prior.submittedAt, '2026-10-31T02:15:00.000Z');
  assert.equal(h.lookup('fam123').prior.members[0].tea, 'no');
  assert.doesNotMatch(JSON.stringify(h.lookup('fam123')), /Solemnisation|solem/);
  h.submit(h.payload('fam123')); h.setup();
  const rows = h.get('RSVP Responses').rows;
  assert.equal(rows[1][rows[0].indexOf('Solemnisation')], 'Yes');
  assert.equal(h.history().length, 2);
});

test('ambiguous legacy records and conflicting codes stop migration without clearing responses', () => {
  const h = gateway({setup: false, responseRows: [['URL Code', 'Name', 'RSVP'], ['old123', 'Unknown Guest', 'Yes']]});
  h.context.setupRsvp(); assert.match(h.alerts.at(-1), /cannot be matched unambiguously/);
  assert.equal(h.get('RSVP Responses').rows[1][1], 'Unknown Guest');
  assert.equal(h.lookup('old123').errorCode, 'setup_required');
  const other = gateway({setup: false}); other.get('Guestlist').rows[2][0] = 'other123';
  other.context.setupRsvp(); assert.match(other.alerts.at(-1), /conflicting codes/);
  assert.equal(other.get('Guestlist').rows[1][0], 'old123');
});

test('history order is stable under whole-row sorting and does not depend on displayed row order', () => {
  const h = gateway(); h.submit(h.payload()); h.submit(h.payload('old123', 'no'));
  const tab = h.get('Reply History'); tab.rows = [tab.rows[0], ...tab.rows.slice(1).reverse()];
  assert.equal(h.lookup('old123').prior.members[0].attending, 'no');
  assert.equal(h.submit(h.payload()).ok, true);
  assert.equal(h.history().length, 3);
});

test('custom columns added to a cache are not silently erased', () => {
  const h = gateway(), tab = h.get('RSVP Responses'); tab.rows[0].push('Host custom notes'); tab.rows[1] = Array(21).fill(''); tab.rows[1][20] = 'Keep this';
  assert.equal(h.submit(h.payload()).ok, true);
  assert.equal(tab.rows[1][20], 'Keep this');
  assert.equal(h.lookup('old123').prior.members[0].attending, 'yes');
});

test('mixed schedule groups are rejected and public actions cannot invoke host tools', () => {
  const h = gateway(); h.master(3, 'Category', 'Family');
  assert.equal(h.lookup('old123').errorCode, 'configuration_error');
  assert.equal(h.api({action: 'approveSelectedRequest'}).errorCode, 'invalid_request');
});

test('free text stays literal in sheet cells, and oversized fields are rejected', () => {
  const h = gateway(), payload = h.payload(); payload.members[0].notes = '=SUM(1,2)'; payload.members[0].dietary = '+special';
  assert.equal(h.submit(payload).ok, true);
  const rows = h.get('RSVP Responses').rows;
  assert.equal(rows[1][rows[0].indexOf('Member Notes')], "'=SUM(1,2)");
  assert.equal(h.lookup('old123').prior.members[0].notes, '=SUM(1,2)');
  const long = h.payload(); long.members[0].notes = 'x'.repeat(1001);
  assert.equal(h.submit(long).errorCode, 'invalid_answers');
});
