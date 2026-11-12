const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
const featureSource = html.slice(html.indexOf('    function normaliseReplyMembers('), html.indexOf('    (async function initInvite()'));
const escapeSource = html.match(/    function escapeHtml\(s\) \{[\s\S]*?\n    \}/)[0];
const submitStart = html.indexOf("    document.getElementById('rsvpForm')?.addEventListener('submit'");
const submitSource = html.slice(submitStart, html.indexOf('    // One banner doing three jobs', submitStart));
const initSource = html.slice(html.indexOf('    (async function initInvite()'), html.indexOf('    // Unknown code,'));
const friend = {code: 'abcdefg', household: 'Alex Tan & Jamie Lim', revision: 'initial', rosterVersion: 'fictional-roster', events: ['dinner'], members: [{id: 'alex-id', name: 'Alex Tan'}, {id: 'jamie-id', name: 'Jamie Lim'}]};
const family = {...friend, events: ['tea', 'dinner']};
const stamp = '2026-10-31T02:15:00.000Z';
const prior = {submittedAt: stamp, members: [{id: 'alex-id', name: 'Alex Tan', attending: 'yes', dietary: 'Vegetarian'}, {id: 'jamie-id', name: 'Jamie Lim', attending: 'no'}]};

function harness(household = friend, saved = null, values = {}) {
  const nodes = {};
  for (const id of ['rsvpSaveStatus', 'rsvpLastSaved', 'rsvpUnsaved', 'rsvpForm', 'rsvpSubmit', 'rsvpReturningNote', 'rsvpReload', 'rsvpPublic', 'rsvpLoading', 'inviteGreeting', 'inviteWho']) {
    nodes[id] = {hidden: true, innerHTML: '', textContent: '', style: {}, values: {}, listeners: {}, classList: {add() {}},
      addEventListener(type, handler) { (this.listeners[type] ||= []).push(handler); },
      removeAttribute(name) { if (name === 'datetime') this.dateTime = ''; }, scrollIntoView() {}};
  }
  nodes.rsvpForm.values = values;
  nodes.rsvpSubmit.textContent = 'Send Our RSVP'; nodes.rsvpSubmit.disabled = false;
  nodes.rsvpReturningNote.style.display = 'none';
  const banners = [], calendars = [], requests = [];
  const context = vm.createContext({
    CURRENT_HOUSEHOLD: structuredClone(household), CURRENT_PRIOR: saved, RSVP_ATTEMPT: null, RSVP_ENDPOINT: 'fictional-gateway',
    crypto: require('node:crypto').webcrypto,
    document: {getElementById: id => nodes[id] || null, querySelector: () => null, querySelectorAll: () => [], body: {classList: {add() {}}}},
    window: {location: {search: '?inv=abcdefg'}}, URLSearchParams,
    FormData: class { constructor(form) { this.values = {...form.values}; } get(name) { return this.values[name] ?? null; } },
    showBanner: (...args) => banners.push(args), revealCalendar: value => calendars.push(value),
    fetch: async (url, options) => { const request = JSON.parse(options.body); requests.push(request); return {ok: true, json: async () => ({ok: true, protocol: 3, status: 'saved', revision: request.payload.requestId, prior: {members: request.payload.members, submittedAt: stamp}})}; },
    console: {error() {}, warn() {}}, setTimeout() {}, clearTimeout() {}, AbortController
  });
  vm.runInContext(escapeSource + '\n' + featureSource + '\n' + submitSource, context);
  return {context, nodes, banners, calendars, requests,
    submit: () => nodes.rsvpForm.listeners.submit[0]({preventDefault() {}, target: nodes.rsvpForm}),
    async init(result = {ok: true, household, prior: saved}) {
      context.fetchHousehold = async () => structuredClone(result);
      context.personaliseEnvelope = () => {}; context.renderRsvpForm = () => {}; context.applyPrior = () => {}; context.showLookupError = () => {};
      await vm.runInContext(initSource, context);
    }};
}

test('saved reply summary is removed; only timestamp and unsaved status sit beneath the save button', () => {
  assert.doesNotMatch(html, /rsvpSavedReply|savedReplyMembers|savedReplySummary|Your saved reply|saved-reply-details/);
  assert.match(html, /id="rsvpSaveStatus"[^>]*hidden/);
  assert.ok(html.indexOf('id="rsvpSubmit"') < html.indexOf('id="rsvpSaveStatus"'));
  assert.ok(html.indexOf('id="rsvpSaveStatus"') < html.indexOf('id="rsvpCalendar"'));
});
test('new and anonymous invitations never display an invented last-saved time', () => {
  const h = harness(); h.context.renderSaveStatus(null); assert.equal(h.nodes.rsvpSaveStatus.hidden, true);
  h.context.renderSaveStatus({members: []}); assert.equal(h.nodes.rsvpSaveStatus.hidden, true);
});
test('first-time guests never see Welcome back, including immediately after their first save', async () => {
  const h = harness(friend, null, {attend_0: 'yes', attend_1: 'no'});
  await h.init(); assert.equal(h.nodes.rsvpReturningNote.style.display, 'none');
  await h.submit(); assert.equal(h.nodes.rsvpReturningNote.style.display, 'none');
  assert.match(h.nodes.rsvpLastSaved.textContent, /Last saved/);
  assert.equal(h.nodes.rsvpSaveStatus.hidden, false);
});
test('Welcome back is shown only when a previous response is loaded and disappears after updating', async () => {
  const h = harness(friend, prior, {attend_0: 'yes', diet_0: 'Vegetarian', attend_1: 'no'});
  await h.init(); assert.equal(h.nodes.rsvpReturningNote.style.display, 'block');
  assert.equal(h.nodes.rsvpSubmit.textContent, 'Update Our RSVP');
  await h.submit(); assert.equal(h.nodes.rsvpReturningNote.style.display, 'none');
});
test('server timestamps display in Singapore time and invalid timestamps remain hidden', () => {
  const h = harness(friend, prior, {attend_0: 'yes', diet_0: 'Vegetarian', attend_1: 'no'});
  h.context.renderSaveStatus(prior);
  assert.equal(h.nodes.rsvpLastSaved.hidden, false); assert.equal(h.nodes.rsvpLastSaved.dateTime, stamp);
  assert.match(h.nodes.rsvpLastSaved.textContent, /31 Oct 2026, 10:15 am \(SGT\)/);
  for (const submittedAt of [null, '', 'not-a-date']) {
    h.context.renderSaveStatus({...prior, submittedAt});
    assert.equal(h.nodes.rsvpLastSaved.hidden, true); assert.equal(h.nodes.rsvpLastSaved.textContent, '');
    assert.equal(h.nodes.rsvpSaveStatus.hidden, true);
  }
});
test('unsaved edits preserve the saved timestamp, and reverting clears the warning', () => {
  const h = harness(friend, prior, {attend_0: 'yes', diet_0: 'Vegetarian', attend_1: 'no'});
  h.context.renderSaveStatus(prior); const time = h.nodes.rsvpLastSaved.textContent;
  assert.equal(h.nodes.rsvpUnsaved.hidden, true);
  h.nodes.rsvpForm.values.diet_0 = 'New preference'; h.context.updateSavedReplyDirtyState();
  assert.equal(h.nodes.rsvpUnsaved.hidden, false); assert.equal(h.nodes.rsvpLastSaved.textContent, time);
  h.nodes.rsvpForm.values.diet_0 = 'Vegetarian'; h.context.updateSavedReplyDirtyState(); assert.equal(h.nodes.rsvpUnsaved.hidden, true);
});
test('only a successful current server acknowledgement creates a last-saved timestamp', async () => {
  const h = harness(friend, null, {attend_0: 'yes', attend_1: 'no'}); await h.submit();
  assert.equal(h.requests.length, 1); assert.equal(h.context.CURRENT_PRIOR.submittedAt, stamp);
  assert.equal(h.nodes.rsvpSaveStatus.hidden, false); assert.equal(h.nodes.rsvpUnsaved.hidden, true);
  assert.equal(h.nodes.rsvpSubmit.disabled, false); assert.equal(h.nodes.rsvpSubmit.textContent, 'Update Our RSVP');
});
test('an all-declined reply gets the timestamp and a warm confirmation without a calendar invitation', async () => {
  const h = harness(friend, null, {attend_0: 'no', attend_1: 'no'}); await h.submit();
  assert.equal(h.nodes.rsvpSaveStatus.hidden, false); assert.equal(h.calendars.at(-1), false);
  assert.match(h.banners.at(-1)[0], /We'll miss you/);
});
test('rejected, failed and unconfigured saves never change the confirmed timestamp or returning state', async () => {
  const h = harness(friend, prior, {attend_0: 'yes', diet_0: 'Vegetarian', attend_1: 'no'});
  await h.init(); const time = h.nodes.rsvpLastSaved.textContent; h.nodes.rsvpForm.values.attend_1 = 'yes';
  for (const fetch of [async () => ({ok: true, json: async () => ({ok: false, error: 'Rejected'})}), async () => ({ok: true, json: async () => ({ok: 'true'})}), async () => ({ok: false, status: 503}), async () => {throw new Error('Offline');}]) {
    h.context.fetch = fetch; await h.submit();
    assert.equal(h.nodes.rsvpLastSaved.textContent, time); assert.equal(h.context.CURRENT_PRIOR.submittedAt, stamp);
    assert.equal(h.nodes.rsvpReturningNote.style.display, 'block'); assert.equal(h.nodes.rsvpSubmit.disabled, false); assert.equal(h.banners.at(-1)[1], 'error');
  }
  h.context.RSVP_ENDPOINT = ''; await h.submit(); assert.equal(h.nodes.rsvpLastSaved.textContent, time);
});
test('edits made during a save remain unsaved and duplicate submissions are blocked', async () => {
  const h = harness(friend, prior, {attend_0: 'yes', diet_0: 'Submitted value', attend_1: 'no'});
  let acknowledge, sent, count = 0;
  h.context.fetch = (url, options) => {count++; sent = JSON.parse(options.body).payload; return new Promise(resolve => {acknowledge = resolve;});};
  const saving = h.submit(); await h.submit(); assert.equal(count, 1);
  h.nodes.rsvpForm.values.diet_0 = 'Later edit';
  acknowledge({ok: true, json: async () => ({ok: true, protocol: 3, status: 'saved', revision: sent.requestId, prior: {members: sent.members, submittedAt: stamp}})});
  await saving; assert.equal(h.context.CURRENT_PRIOR.members[0].dietary, 'Submitted value'); assert.equal(h.nodes.rsvpUnsaved.hidden, false);
});
test('missing dinner answers prevent sending and leave timestamp hidden', async () => {
  const h = harness(friend, null, {attend_0: 'yes'}); await h.submit();
  assert.equal(h.requests.length, 0); assert.equal(h.nodes.rsvpSaveStatus.hidden, true); assert.equal(h.banners.at(-1)[1], 'error');
});
test('family tea answers remain independent and mandatory; retired ceremony is not submitted', async () => {
  const h = harness(family, null, {attend_0: 'yes', attend_1: 'no'}); await h.submit(); assert.equal(h.requests.length, 0);
  h.nodes.rsvpForm.values.tea_0 = 'no'; h.nodes.rsvpForm.values.tea_1 = 'yes'; await h.submit();
  assert.equal(h.requests[0].payload.members[0].tea, 'no'); assert.equal(h.requests[0].payload.members[1].tea, 'yes');
  assert.equal(h.requests[0].payload.members[0].solem, undefined);
});
test('family forms retain tea and dinner and escape guest names without creating another reply summary', () => {
  const list = {innerHTML: '', querySelectorAll: () => []}, form = {classList: {add() {}}};
  const context = vm.createContext({document: {getElementById: id => id === 'memberList' ? list : form}});
  vm.runInContext(escapeSource + '\n' + html.slice(html.indexOf('    function renderRsvpForm('), html.indexOf('    // Form submission')), context);
  context.renderRsvpForm({...family, events: ['tea', 'dinner', 'solem'], members: [{id: 'safe', name: '<img src=x onerror=alert(1)>'}]});
  assert.match(list.innerHTML, /Tea Ceremony/); assert.match(list.innerHTML, /Dinner Reception/); assert.match(list.innerHTML, /&lt;img/);
  assert.doesNotMatch(list.innerHTML, /<img|Solemnisation|solem_/);
  context.renderRsvpForm(friend); assert.doesNotMatch(list.innerHTML, /Tea Ceremony|tea_/);
});
test('an obsolete pending-only acknowledgement does not replace the saved response', async () => {
  const h = harness(friend, prior, {attend_0: 'yes', attend_1: 'yes'}); h.context.renderSaveStatus(prior);
  const time = h.nodes.rsvpLastSaved.textContent;
  h.context.fetch = async () => ({ok: true, json: async () => ({ok: true, protocol: 3, status: 'requested', revision: 'old', prior})});
  await h.submit(); assert.equal(h.nodes.rsvpLastSaved.textContent, time); assert.equal(h.context.CURRENT_PRIOR, prior); assert.equal(h.banners.at(-1)[1], 'error');
});
test('uncertain network retries reuse the request ID while edited drafts use a fresh ID', async () => {
  const h = harness(friend, null, {attend_0: 'yes', attend_1: 'no'}), attempts = [];
  h.context.fetch = async (url, options) => {attempts.push(JSON.parse(options.body).payload); throw new Error('Network interrupted');};
  await h.submit(); await h.submit(); assert.equal(attempts[0].requestId, attempts[1].requestId);
  h.nodes.rsvpForm.values.attend_1 = 'yes'; await h.submit(); assert.notEqual(attempts[1].requestId, attempts[2].requestId);
  assert.match(h.banners[0][0], /answers are still here/); assert.equal(h.nodes.rsvpSaveStatus.hidden, true);
});
test('conflicts keep the draft and offer an explicit reload without changing the saved timestamp', async () => {
  const h = harness(friend, prior, {attend_0: 'no', attend_1: 'no'}); h.context.renderSaveStatus(prior);
  const time = h.nodes.rsvpLastSaved.textContent;
  h.context.fetch = async () => ({ok: true, json: async () => ({ok: false, protocol: 3, errorCode: 'conflict', error: 'Someone updated this invitation.'})});
  await h.submit(); assert.equal(h.nodes.rsvpReload.hidden, false); assert.equal(h.nodes.rsvpForm.values.attend_0, 'no');
  assert.equal(h.context.CURRENT_PRIOR, prior); assert.equal(h.nodes.rsvpLastSaved.textContent, time);
});
test('saved answer comparisons use guest IDs across name corrections', () => {
  const h = harness(friend, prior, {attend_0: 'yes', diet_0: 'Vegetarian', attend_1: 'no'});
  h.context.CURRENT_HOUSEHOLD.members[0].name = 'Alex Corrected'; h.context.renderSaveStatus(prior);
  assert.equal(h.nodes.rsvpUnsaved.hidden, true);
});
test('saves explicitly require protocol 3 and reject older acknowledgements', async () => {
  const h = harness(friend, null, {attend_0: 'yes', attend_1: 'no'}); let body;
  h.context.fetch = async (url, options) => {body = JSON.parse(options.body); return {ok: true, json: async () => ({ok: true, protocol: 2, status: 'saved', revision: 'wrong', prior})};};
  await h.submit(); assert.equal(body.protocol, 3); assert.equal(body.environment, undefined);
  assert.equal(h.context.CURRENT_PRIOR, null); assert.equal(h.nodes.rsvpSaveStatus.hidden, true);
});
test('lookups reject older gateways before displaying guest controls', async () => {
  const h = harness(); vm.runInContext(html.slice(html.indexOf('    async function fetchHousehold('), html.indexOf('    function applyPrior(')), h.context);
  let body; h.context.fetch = async (url, options) => {body = JSON.parse(options.body); return {ok: true, json: async () => ({ok: true, protocol: 2, household: friend})};};
  const result = await h.context.fetchHousehold('abcdefg'); assert.equal(body.protocol, 3); assert.equal(result.ok, false); assert.equal(result.household, undefined);
});
test('declining dinner does not send hidden stale dietary information or show a false unsaved warning', async () => {
  const h = harness(friend, null, {attend_0: 'no', diet_0: 'Old diet', attend_1: 'no'}); await h.submit();
  assert.equal(h.requests[0].payload.members[0].dietary, ''); assert.equal(h.nodes.rsvpUnsaved.hidden, true);
});
test('tea-only guests can still save dietary information', async () => {
  const h = harness(family, null, {attend_0: 'no', tea_0: 'yes', diet_0: '  No peanuts  ', attend_1: 'no', tea_1: 'no'}); await h.submit();
  assert.equal(h.requests[0].payload.members[0].dietary, 'No peanuts'); assert.equal(h.context.CURRENT_PRIOR.members[0].dietary, 'No peanuts'); assert.equal(h.nodes.rsvpUnsaved.hidden, true);
});
test('attendance controls remain accessible and save messages and timestamps are announced', () => {
  assert.doesNotMatch(html, /\.attend-toggle input \{ display: none/); assert.match(html, /input:focus-visible/);
  assert.match(html, /for="diet_\$\{i\}"/); assert.match(html, /for="notes_\$\{i\}"/);
  assert.match(html, /id="rsvpSavedBanner"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /id="rsvpSaveStatus"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /controller\.abort\(\), 30000/); assert.match(html, /clearTimeout\(saveTimer\)/);
});
test('hero reserves a flexible photo row and fixed countdown space to keep RSVP in the first viewport', () => {
  const blocks = [...html.matchAll(/#hero \{([\s\S]*?)\n\s*\}/g)].map(match => match[1]);
  const main = blocks.find(block => block.includes('grid-template-rows'));
  assert.match(main, /grid-template-rows: auto minmax\(0, 1fr\) auto/);
  const fullBlocks = blocks.filter(block => block.includes('min-height: var(--hero-height)'));
  assert.equal(fullBlocks.length, 2); fullBlocks.forEach(block => assert.match(block, /\n\s*height: var\(--hero-height\)/));
  assert.match(html, /\.hero-photo \{[^}]*max-height: 100%/);
  assert.match(html, /\.countdown \{[^}]*height: 3\.5rem/);
  assert.match(html, /\.hero-cta \.btn \{[^}]*min-height: 44px/);
  assert.ok(html.indexOf('id="hero"') < html.indexOf('id="vision"'));
  assert.doesNotMatch(html, /For the day|day-details|dayDetails|dayArrival|WEDDING_DAY_EXTRAS|updateDayDetails/);
});
test('RSVP cards stay neutral without coloured edges or attendance-dependent card styling', () => {
  const card = html.match(/\.member-card \{([^}]+)\}/)[1];
  assert.match(card, /border: 1px solid var\(--sand-light\)/);
  assert.doesNotMatch(card, /border-left/);
  assert.doesNotMatch(html, /\.member-card\.(?:attending|declining)\s*\{/);
  assert.match(html, /\.member-card\.attending \.member-fields/);
});
