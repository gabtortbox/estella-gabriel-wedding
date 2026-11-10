const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const start = html.indexOf('    function normaliseReplyMembers(');
const featureSource = html.slice(start, html.indexOf('    (async function initInvite()', start));
const escapeSource = html.match(/    function escapeHtml\(s\) \{[\s\S]*?\n    \}/)[0];
const submitStart = html.indexOf("    document.getElementById('rsvpForm')?.addEventListener('submit'");
const submitSource = html.slice(submitStart, html.indexOf('    // One banner doing three jobs', submitStart));

const friend = {code: 'fictional-friends', revision: 'initial', rosterVersion: 'fictional-roster', events: ['ceremony'], members: [{id: 'alex-id', name: 'Alex Tan'}, {id: 'jamie-id', name: 'Jamie Lim'}]};
const family = {...friend, events: ['solem', 'tea', 'ceremony']};
const stamp = '2026-10-31T02:15:00.000Z';
const prior = {submittedAt: stamp, members: [{name: 'Alex Tan', attending: 'yes', dietary: 'Vegetarian'}, {name: 'Jamie Lim', attending: 'no'}]};

function harness(household = friend, saved = null, values = {}) {
  saved?.members.forEach(member => { member.id ||= household.members.find(guest => guest.name === member.name)?.id; });
  const nodes = {};
  for (const id of ['rsvpSavedReply', 'savedReplyMembers', 'savedReplyTime', 'savedReplySummary', 'savedReplyUnsaved', 'rsvpForm', 'rsvpSubmit', 'rsvpReturningNote', 'rsvpChangeRequest', 'rsvpRequestMessage', 'rsvpRequestMembers', 'rsvpReload']) {
    nodes[id] = {
      hidden: true, innerHTML: '', textContent: '', style: {}, values: {}, listeners: {},
      addEventListener(type, handler) { (this.listeners[type] ||= []).push(handler); },
      removeAttribute(name) { if (name === 'datetime') this.dateTime = ''; },
      scrollIntoView() {}
    };
  }
  nodes.rsvpForm.values = values;
  nodes.rsvpSubmit.textContent = 'Send Our RSVP';
  nodes.rsvpSubmit.disabled = false;
  const banners = [], calendars = [], requests = [];
  const context = vm.createContext({
    CURRENT_HOUSEHOLD: {...household}, CURRENT_PRIOR: saved, CURRENT_PENDING: null, RSVP_ATTEMPT: null, RSVP_ENDPOINT: 'test-gateway',
    crypto: require('node:crypto').webcrypto,
    document: {getElementById: id => nodes[id] || null, querySelector: () => null},
    FormData: class { constructor(form) { this.values = {...form.values}; } get(name) { return this.values[name] ?? null; } },
    showBanner: (...args) => banners.push(args), revealCalendar: value => calendars.push(value),
    fetch: async (url, options) => { const request = JSON.parse(options.body); requests.push(request); return {ok: true, json: async () => ({ok: true, protocol: 2, status: 'saved', revision: request.payload.requestId, prior: {members: request.payload.members, submittedAt: stamp}})}; },
    console: {error() {}}, setTimeout() {}
  });
  vm.runInContext(escapeSource + '\n' + featureSource + '\n' + submitSource, context);
  return {context, nodes, banners, calendars, requests, submit: () => nodes.rsvpForm.listeners.submit[0]({preventDefault() {}, target: nodes.rsvpForm})};
}

test('new and anonymous invitations never display an invented saved reply', () => {
  const {context, nodes} = harness();
  context.renderSavedReply(null);
  assert.equal(nodes.rsvpSavedReply.hidden, true);
  context.renderSavedReply({members: []});
  assert.equal(nodes.rsvpSavedReply.hidden, true);
  assert.match(html, /id="rsvpSavedReply"[^>]*hidden/);
  assert.ok(html.indexOf('id="rsvpSavedReply"') < html.indexOf('<form id="rsvpForm"'));
});

test('saved summaries show named guests, escape text and omit uninvited people and events', () => {
  const record = {members: [{name: 'Alex Tan', attending: 'yes', dietary: '<img src=x onerror=alert(1)>', notes: 'A & B', tea: 'yes'}, {name: 'Jamie Lim', attending: 'no'}, {name: 'Uninvited Person', attending: 'yes'}]};
  const {context, nodes} = harness(friend, record);
  context.renderSavedReply(record);
  const output = nodes.savedReplyMembers.innerHTML;
  assert.match(output, /Alex Tan/);
  assert.match(output, /Jamie Lim/);
  assert.match(output, /Not attending/);
  assert.match(output, /&lt;img/);
  assert.match(output, /A &amp; B/);
  assert.ok(!output.includes('<img'));
  assert.ok(!output.includes('Uninvited Person'));
  assert.ok(!output.includes('Tea ceremony'));
});

test('family summaries keep tea answers separate from dinner and omit the retired ceremony', () => {
  const record = {members: [{name: 'Alex Tan', attending: 'yes', tea: 'no', solem: 'yes'}, {name: 'Jamie Lim', attending: 'no', tea: 'yes', solem: 'no'}]};
  const {context, nodes} = harness(family, record);
  context.renderSavedReply(record);
  const output = nodes.savedReplyMembers.innerHTML;
  assert.doesNotMatch(output, /Solemnisation/);
  assert.match(output, /Tea ceremony<\/dt><dd>Not attending/);
  assert.match(output, /Dinner reception<\/dt><dd>Not attending/);
});

test('retired ceremony answers do not mark a reply unsaved and are not editable in client payloads', async () => {
  const record = {members: [{name: 'Alex Tan', attending: 'yes', tea: 'no', solem: 'yes'}, {name: 'Jamie Lim', attending: 'no', tea: 'yes', solem: 'no'}]};
  const h = harness(family, record, {attend_0: 'yes', tea_0: 'no', attend_1: 'no', tea_1: 'yes'});
  h.context.renderSavedReply(record);
  assert.equal(h.nodes.savedReplyUnsaved.hidden, true);
  await h.submit();
  assert.equal(h.requests[0].payload.members[0].solem, undefined);
  assert.equal(h.requests[0].payload.members[1].solem, undefined);
  assert.doesNotMatch(h.nodes.savedReplyMembers.innerHTML, /Solemnisation/);
});

test('family forms show tea and dinner only, even with a legacy solemnisation invite flag', () => {
  const memberList = {innerHTML: '', querySelectorAll: () => []};
  const form = {classList: {add() {}}};
  const context = vm.createContext({document: {getElementById: id => id === 'memberList' ? memberList : form}});
  const render = html.slice(html.indexOf('    function renderRsvpForm('), html.indexOf('    // Form submission'));
  vm.runInContext(escapeSource + '\n' + render, context);
  context.renderRsvpForm(family);
  assert.equal((memberList.innerHTML.match(/event-block-title">Tea Ceremony/g) || []).length, 2);
  assert.equal((memberList.innerHTML.match(/event-block-title">Dinner Reception/g) || []).length, 2);
  assert.doesNotMatch(memberList.innerHTML, /Solemnisation|solem_/);
  context.renderRsvpForm(friend);
  assert.doesNotMatch(memberList.innerHTML, /Tea Ceremony|tea_|Solemnisation|solem_/);
});

test('server timestamps display in Singapore time and legacy or invalid timestamps remain hidden', () => {
  const {context, nodes} = harness(friend, prior);
  context.renderSavedReply(prior);
  assert.equal(nodes.savedReplyTime.hidden, false);
  assert.equal(nodes.savedReplyTime.dateTime, stamp);
  assert.match(nodes.savedReplyTime.textContent, /31 Oct 2026/);
  assert.match(nodes.savedReplyTime.textContent, /10:15/);
  assert.match(nodes.savedReplyTime.textContent, /SGT/);
  for (const submittedAt of [null, '', 'not-a-date']) {
    context.renderSavedReply({...prior, submittedAt});
    assert.equal(nodes.savedReplyTime.hidden, true);
    assert.equal(nodes.savedReplyTime.textContent, '');
    assert.equal(nodes.rsvpSavedReply.hidden, false);
  }
});

test('unsaved edits mark the form without modifying the last saved summary, and reverting clears the marker', () => {
  const values = {attend_0: 'yes', diet_0: 'Vegetarian', attend_1: 'no'};
  const {context, nodes} = harness(friend, prior, values);
  context.renderSavedReply(prior);
  const original = nodes.savedReplyMembers.innerHTML;
  assert.equal(nodes.savedReplyUnsaved.hidden, true);
  nodes.rsvpForm.values.diet_0 = 'New preference';
  context.updateSavedReplyDirtyState();
  assert.equal(nodes.savedReplyUnsaved.hidden, false);
  assert.equal(nodes.savedReplyMembers.innerHTML, original);
  nodes.rsvpForm.values.diet_0 = 'Vegetarian';
  context.updateSavedReplyDirtyState();
  assert.equal(nodes.savedReplyUnsaved.hidden, true);
});

test('only a successful server acknowledgement creates a saved summary', async () => {
  const {context, nodes, submit, requests} = harness(friend, null, {attend_0: 'yes', attend_1: 'no'});
  await submit();
  assert.equal(requests.length, 1);
  assert.equal(context.CURRENT_PRIOR.submittedAt, stamp);
  assert.equal(nodes.rsvpSavedReply.hidden, false);
  assert.equal(nodes.savedReplyUnsaved.hidden, true);
  assert.equal(nodes.rsvpSubmit.disabled, false);
  assert.equal(nodes.rsvpSubmit.textContent, 'Update Our RSVP');
});

test('an all-declined reply is saved without dietary claims or a calendar invitation', async () => {
  const h = harness(friend, null, {attend_0: 'no', attend_1: 'no'});
  await h.submit();
  assert.equal(h.nodes.rsvpSavedReply.hidden, false);
  assert.equal((h.nodes.savedReplyMembers.innerHTML.match(/Not attending/g) || []).length, 2);
  assert.ok(!h.nodes.savedReplyMembers.innerHTML.includes('Dietary notes'));
  assert.equal(h.calendars.at(-1), false);
});

test('rejected, failed and unconfigured saves never replace the previous confirmed reply', async () => {
  const h = harness(friend, prior, {attend_0: 'yes', diet_0: 'Vegetarian', attend_1: 'no'});
  h.context.renderSavedReply(prior);
  const original = h.nodes.savedReplyMembers.innerHTML;
  h.nodes.rsvpForm.values.attend_1 = 'yes';
  const failures = [
    async () => ({ok: true, json: async () => ({ok: false, error: 'Rejected'})}),
    async () => ({ok: true, json: async () => ({ok: 'true'})}),
    async () => ({ok: false, status: 503}),
    async () => { throw new Error('Offline'); }
  ];
  for (const fetch of failures) {
    h.context.fetch = fetch;
    await h.submit();
    assert.equal(h.nodes.savedReplyMembers.innerHTML, original);
    assert.equal(h.context.CURRENT_PRIOR.submittedAt, stamp);
    assert.equal(h.nodes.rsvpSubmit.disabled, false);
    assert.equal(h.banners.at(-1)[1], 'error');
  }
  h.context.RSVP_ENDPOINT = '';
  await h.submit();
  assert.equal(h.nodes.savedReplyMembers.innerHTML, original);
  assert.equal(h.banners.at(-1)[1], 'error');
});

test('edits made during a save remain unsaved, and duplicate submissions are blocked', async () => {
  const h = harness(friend, prior, {attend_0: 'yes', diet_0: 'Submitted value', attend_1: 'no'});
  let acknowledge;
  let requestCount = 0;
  let sent;
  h.context.fetch = (url, options) => { requestCount++; sent = JSON.parse(options.body).payload; return new Promise(resolve => { acknowledge = resolve; }); };
  const saving = h.submit();
  await h.submit();
  assert.equal(requestCount, 1);
  h.nodes.rsvpForm.values.diet_0 = 'Later edit';
  acknowledge({ok: true, json: async () => ({ok: true, protocol: 2, status: 'saved', revision: sent.requestId, prior: {members: sent.members, submittedAt: stamp}})});
  await saving;
  assert.match(h.nodes.savedReplyMembers.innerHTML, /Submitted value/);
  assert.ok(!h.nodes.savedReplyMembers.innerHTML.includes('Later edit'));
  assert.equal(h.nodes.savedReplyUnsaved.hidden, false);
});

test('missing dinner answers prevent sending and leave the saved panel hidden', async () => {
  const h = harness(friend, null, {attend_0: 'yes'});
  await h.submit();
  assert.equal(h.requests.length, 0);
  assert.equal(h.nodes.rsvpSavedReply.hidden, true);
  assert.equal(h.banners.at(-1)[1], 'error');
});

test('pending approval does not replace a confirmed reply or create an unsaved warning', async () => {
  const h = harness(friend, prior, {attend_0: 'yes', attend_1: 'yes'});
  h.context.renderSavedReply(prior);
  const before = h.nodes.savedReplyMembers.innerHTML;
  h.context.fetch = async (url, options) => {
    const payload = JSON.parse(options.body).payload;
    return {ok: true, json: async () => ({ok: true, protocol: 2, status: 'requested', revision: payload.requestId,
      prior, pending: {requestId: payload.requestId, submittedAt: stamp, members: payload.members}})};
  };
  await h.submit();
  assert.equal(h.nodes.savedReplyMembers.innerHTML, before);
  assert.equal(h.nodes.rsvpChangeRequest.hidden, false);
  assert.match(h.nodes.rsvpRequestMessage.textContent, /isn't confirmed/);
  assert.equal(h.nodes.savedReplyUnsaved.hidden, true);
  assert.equal(h.banners.at(-1)[0].includes('Request received'), true);
});

test('uncertain network saves retry the same request ID while changed drafts use a fresh ID', async () => {
  const h = harness(friend, null, {attend_0: 'yes', attend_1: 'no'}), attempts = [];
  h.context.fetch = async (url, options) => { attempts.push(JSON.parse(options.body).payload); throw new Error('Network interrupted'); };
  await h.submit(); await h.submit();
  assert.equal(attempts[0].requestId, attempts[1].requestId);
  h.nodes.rsvpForm.values.attend_1 = 'yes'; await h.submit();
  assert.notEqual(attempts[1].requestId, attempts[2].requestId);
  assert.match(h.banners[0][0], /answers are still here/);
});

test('conflicts keep the draft and offer an explicit invitation reload', async () => {
  const h = harness(friend, prior, {attend_0: 'no', attend_1: 'no'});
  h.context.fetch = async () => ({ok: true, json: async () => ({ok: false, protocol: 2, errorCode: 'conflict', error: 'Someone updated this invitation.'})});
  await h.submit();
  assert.equal(h.nodes.rsvpReload.hidden, false);
  assert.equal(h.nodes.rsvpForm.values.attend_0, 'no');
  assert.equal(h.context.CURRENT_PRIOR, prior);
  assert.match(h.banners.at(-1)[0], /Someone updated/);
});

test('family tea answers are required and saved summaries follow IDs across a name correction', async () => {
  const h = harness(family, prior, {attend_0: 'yes', attend_1: 'no'});
  await h.submit(); assert.equal(h.requests.length, 0);
  h.context.CURRENT_HOUSEHOLD.members = [{id: 'alex-id', name: 'Alex Corrected'}, {id: 'jamie-id', name: 'Jamie Lim'}];
  h.context.renderSavedReply(prior);
  assert.match(h.nodes.savedReplyMembers.innerHTML, /Alex Corrected/);
  assert.match(h.nodes.savedReplyMembers.innerHTML, /Vegetarian/);
});

test('the hero flows into the vision statement without the removed day section or stale scripts', () => {
  assert.ok(html.indexOf('id="hero"') < html.indexOf('id="vision"'));
  assert.match(html, /<!-- VISION -->\s*<div id="vision"/);
  assert.doesNotMatch(html, /For the day|day-details|dayDetails|dayArrival|dayQrDownload|dayHelperContact|WEDDING_DAY_EXTRAS|updateDayDetails/);
});
