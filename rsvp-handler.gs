/**
 * Gabriel & Estella RSVP gateway, protocol 2.
 * Bound to the PRIVATE wedding spreadsheet. Run setupRsvp() on a COPY first.
 * Deploy as a web app (execute as Me, access Anyone). See RSVP-SETUP.md.
 * Existing codes are retained. Reply History is authoritative; other views rebuild from it.
 */
const RSVP_CONFIG = {
  WEBSITE_URL: 'https://gabtortbox.github.io/estella-gabriel-wedding/',
  DEADLINE: '2027-01-31T23:59:59+08:00',
  DINNER_CAPACITY: 0, // Set your actual limit. Zero disables the numerical limit.
  REVIEW_ALL_CHANGES: false,
  MAX_GROUP_SIZE: 40,
  MAX_BODY_LENGTH: 100000
};
const GUESTLIST_TAB = 'Guestlist';
const RESPONSES_TAB = 'RSVP Responses';
const HISTORY_TAB = 'Reply History';
const DASHBOARD_TAB = 'RSVP Dashboard';
const URL_CODE_HEADER = 'URL Code (do not edit)';
const GUEST_ID_HEADER = 'Guest ID (do not edit)';
const INVITE_ID_HEADER = 'Invitation ID (do not edit)';
const EXTRA_HEADERS = [GUEST_ID_HEADER, INVITE_ID_HEADER, 'Invitation Link', 'Invitation Status',
  'Seat Status', 'Invitation Name', 'Tea Ceremony', 'Last Reply At', 'Reply Source'];
const RESPONSE_HEADERS = [URL_CODE_HEADER, 'RSVP Group', 'Whose side?', 'Category', 'Relationship',
  'Name', 'Invite Intent', 'RSVP Sent Out?', 'RSVP', 'Table', 'Solemnisation', 'Tea Ceremony',
  'Dietary', 'Member Notes', 'Driving?', 'Vehicles', 'Submitted At', GUEST_ID_HEADER, INVITE_ID_HEADER, 'Reply Source'];
const HISTORY_HEADERS = ['Request ID', INVITE_ID_HEADER, URL_CODE_HEADER, 'Kind', 'Submitted At',
  'Source', 'Guests', 'Dinner Yes', 'Tea Yes', 'Details JSON'];

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Wedding RSVP')
    .addItem('Set up / add missing links', 'setupRsvp')
    .addItem('Validate guest list', 'validateGuestlist')
    .addItem('Repair shared code before setup', 'repairDuplicateGroupLink')
    .addItem('Refresh tracking and dashboard', 'refreshRsvpTracking').addSeparator()
    .addItem('Record a reply for selected guest', 'recordSelectedGuestReply')
    .addItem('Approve selected history request', 'approveSelectedRequest')
    .addItem('Decline selected history request', 'declineSelectedRequest').addSeparator()
    .addItem('Release selected declined seats', 'releaseSelectedSeats')
    .addItem('Move selected guests to another group', 'moveSelectedGuests')
    .addItem('Reissue link for selected group', 'reissueSelectedLink')
    .addItem('Retire selected invitation', 'retireSelectedInvitation').addToUi();
}
function doGet() { return jsonOut({ok: true, protocol: 2, message: 'Wedding RSVP gateway is live.'}); }
function doPost(e) {
  try {
    const text = e && e.postData && e.postData.contents;
    if (!text || text.length > RSVP_CONFIG.MAX_BODY_LENGTH) fail('invalid_request', 'Please refresh your invitation and try again.');
    const body = JSON.parse(text);
    if (body.action === 'lookup') return jsonOut(withLock(() => lookup(body.code)));
    if (body.action === 'submit') return jsonOut(withLock(() => submitReply(body.payload)));
    fail('invalid_request', 'Please refresh your invitation and try again.');
  } catch (error) {
    console.error(error && error.stack || error);
    return jsonOut({ok: false, protocol: 2, errorCode: error.rsvpCode || 'temporarily_unavailable',
      error: error.rsvpCode ? error.message : 'We could not reach the guest book. Your previous reply is safe. Please try again shortly.'});
  }
}
function withLock(action) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) fail('busy', 'The guest book is busy. Please try again in a moment.');
  try { return action(); } finally { lock.releaseLock(); }
}
function fail(code, message) { const error = new Error(message); error.rsvpCode = code; throw error; }
function asStr(value) { return value == null ? '' : String(value); }
function clean(value) { return asStr(value).trim(); }
function normCode(value) { return clean(value).toLowerCase(); }
function yes(value) { return normCode(value) === 'yes'; }
function answer(value) { const v = normCode(value); return v === 'yes' || v === 'no' ? v : 'pending'; }
function safeCell(value) { return typeof value === 'string' && /^[=+@\-\t\r\n]/.test(value) ? "'" + value : value; }
function literal(value) { return typeof value === 'string' && /^'[=+@\-\t\r\n]/.test(value) ? value.slice(1) : value; }
function uuid() { return Utilities.getUuid().toLowerCase(); }
function randomCode() { return uuid().replace(/-/g, ''); }
function stamp() { return new Date().toISOString(); }
function jsonOut(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
function hash(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(value), Utilities.Charset.UTF_8)
    .map(b => ('0' + ((b + 256) % 256).toString(16)).slice(-2)).join('');
}
function sheetData(tab) {
  const values = tab.getDataRange().getValues(), headers = (values[0] || []).map(clean);
  return {tab, values, headers, col: name => headers.findIndex(h => h.toLowerCase() === name.toLowerCase())};
}
function getValue(data, row, name) { const i = data.col(name); return i < 0 ? '' : literal(row[i]); }
function urlColumn(data) { return data.headers.findIndex(h => /^url code\b/i.test(h)); }
function historySheet(ss) {
  let tab = ss.getSheetByName(HISTORY_TAB);
  if (!tab) tab = ss.insertSheet(HISTORY_TAB);
  const data = sheetData(tab);
  if (!data.headers.some(Boolean)) {
    tab.getRange(1, 1, 1, HISTORY_HEADERS.length).setValues([HISTORY_HEADERS]); tab.setFrozenRows(1);
  } else if (HISTORY_HEADERS.some((h, i) => data.headers[i] !== h)) throw new Error('Reply History has unexpected columns. Do not rearrange or edit this tab.');
  return tab;
}
function requireReady(ss) {
  if (PropertiesService.getScriptProperties().getProperty('RSVP_READY_V2') !== ss.getId()) fail('setup_required', 'The invitation service is being prepared. Please contact Gabriel or Estella.');
}
function guestData(ss) {
  const tab = ss.getSheetByName(GUESTLIST_TAB);
  if (!tab) fail('setup_required', 'The invitation service is being prepared. Please contact Gabriel or Estella.');
  const data = sheetData(tab);
  const required = ['RSVP Group', 'Name', 'Category', 'Invite Intent', 'RSVP', GUEST_ID_HEADER, INVITE_ID_HEADER, 'Invitation Status', 'Seat Status'];
  if (urlColumn(data) < 0 || required.some(h => data.col(h) < 0) || !ss.getSheetByName(HISTORY_TAB)) fail('setup_required', 'The invitation service is being prepared. Please contact Gabriel or Estella.');
  data.guests = data.values.slice(1).map((row, i) => ({
    row: i + 2, raw: row, id: clean(getValue(data, row, GUEST_ID_HEADER)), inviteId: clean(getValue(data, row, INVITE_ID_HEADER)),
    code: normCode(row[urlColumn(data)]), group: clean(getValue(data, row, 'RSVP Group')), name: clean(getValue(data, row, 'Name')),
    category: normCode(getValue(data, row, 'Category')), intent: normCode(getValue(data, row, 'Invite Intent')),
    status: normCode(getValue(data, row, 'Invitation Status')), seat: normCode(getValue(data, row, 'Seat Status')),
    label: clean(getValue(data, row, 'Invitation Name'))
  })).filter(g => g.group || g.code || g.inviteId || g.intent === 'yes' || g.status === 'active');
  return data;
}
function activeGuest(g) { return g.intent === 'yes' && g.status === 'active'; }
function guestIssues(data) {
  const issues = [], ids = new Set(), groups = new Map(), codes = new Map(), invites = new Map();
  const add = (map, key, value) => { if (!map.has(key)) map.set(key, new Set()); map.get(key).add(value); };
  data.guests.forEach(g => {
    if (!g.name || !g.group || !g.code || !g.id || !g.inviteId || !g.category) issues.push('Row ' + g.row + ': missing name, group, category, code or permanent ID.');
    if (ids.has(g.id)) issues.push('Row ' + g.row + ': duplicate Guest ID.'); ids.add(g.id);
    if (g.code && !/^[a-z0-9_-]{6,96}$/.test(g.code)) issues.push('Row ' + g.row + ': invalid invitation code.');
    if (!['active', 'draft', 'waitlist', 'retired'].includes(g.status)) issues.push('Row ' + g.row + ': Invitation Status must be Active, Draft, Waitlist or Retired.');
    if (!['reserved', 'released'].includes(g.seat)) issues.push('Row ' + g.row + ': Seat Status must be Reserved or Released.');
    if (g.intent && !['yes', 'no'].includes(g.intent)) issues.push('Row ' + g.row + ': Invite Intent must be Yes, No or blank.');
    add(groups, g.group, g.code + '|' + g.inviteId); add(codes, g.code, g.group + '|' + g.inviteId); add(invites, g.inviteId, g.group + '|' + g.code);
  });
  for (const [group, links] of groups) if (links.size !== 1) issues.push('Group ' + group + ': conflicting codes/IDs. Use Move guests rather than changing Group alone.');
  for (const links of codes.values()) if (links.size !== 1) issues.push('A URL code is shared by different groups.');
  for (const links of invites.values()) if (links.size !== 1) issues.push('An Invitation ID is shared by different groups.');
  for (const group of groups.keys()) {
    const members = data.guests.filter(g => g.group === group && activeGuest(g));
    if (members.length > RSVP_CONFIG.MAX_GROUP_SIZE) issues.push('Group ' + group + ': split this invitation into smaller households.');
    if (new Set(members.map(g => g.category === 'family')).size > 1) issues.push('Group ' + group + ': mixes family and other guests. Split by schedule access.');
    if (new Set(members.map(g => g.label).filter(Boolean)).size > 1) issues.push('Group ' + group + ': conflicting Invitation Names.');
  }
  return issues;
}
function invitation(data, rawCode) {
  const code = normCode(rawCode);
  if (!/^[a-z0-9_-]{6,96}$/.test(code)) fail('not_found', 'This invitation link is not available. Please ask Gabriel or Estella for help.');
  const coded = data.guests.filter(g => g.code === code), guests = coded.filter(activeGuest);
  if (!coded.length) fail('not_found', 'This invitation link is not available. Please ask Gabriel or Estella for help.');
  if (!guests.length) fail('not_invited', 'This invitation link is not active. Please contact Gabriel or Estella.');
  if (guestIssues({...data, guests: coded}).length || data.guests.some(g => !coded.includes(g) && (g.inviteId === guests[0].inviteId || coded.some(c => c.id === g.id)))) fail('configuration_error', 'We need to check this invitation. Please contact Gabriel or Estella.');
  const family = guests[0].category === 'family', names = guests.map(g => g.name);
  const label = guests.find(g => g.label)?.label || (names.length === 1 ? names[0] : names.length <= 4 ? names.slice(0, -1).join(', ') + ' & ' + names[names.length - 1] : names.slice(0, 2).join(', ') + ' & guests');
  return {code, inviteId: guests[0].inviteId, guests, family, label,
    rosterVersion: hash(guests.map(g => [g.id, g.name, g.category === 'family', g.status, g.seat]).sort((a, b) => a[0].localeCompare(b[0])))};
}
function readHistory(ss) {
  const tab = ss.getSheetByName(HISTORY_TAB);
  if (!tab) fail('setup_required', 'The invitation service is being prepared. Please contact Gabriel or Estella.');
  const data = sheetData(tab);
  if (HISTORY_HEADERS.some((h, i) => data.headers[i] !== h)) throw new Error('Reply History headers changed.');
  const events = data.values.slice(1).map((r, i) => ({r, row: i + 2})).filter(entry => entry.r[0]).map(({r, row}) => {
    const event = JSON.parse(asStr(r[9]));
    if (event.requestId !== r[0] || event.inviteId !== r[1] || !Number.isSafeInteger(event.sequence) || event.sequence < 1) throw new Error('History integrity check failed.');
    return {...event, historyRow: row};
  });
  if (new Set(events.map(e => e.sequence)).size !== events.length || new Set(events.map(e => e.requestId)).size !== events.length) throw new Error('Duplicate history records. Restore from your backup.');
  return events.sort((a, b) => a.sequence - b.sequence);
}
function historyState(events) {
  const members = new Map(), latest = new Map();
  events.forEach(event => {
    latest.set(event.inviteId, event);
    if (event.kind === 'confirmed') event.members.forEach(m => members.set(m.id, {...members.get(m.id), ...m, submittedAt: m.submittedAt === undefined ? event.submittedAt : m.submittedAt, source: m.source || event.source}));
  });
  return {members, latest};
}
function publicMember(g, saved) {
  return {id: g.id, name: g.name, attending: answer(saved && saved.attending), tea: g.category === 'family' ? answer(saved && saved.tea) : '',
    dietary: asStr(saved && saved.dietary), notes: asStr(saved && saved.notes)};
}
function replyState(invite, events) {
  const state = historyState(events), latest = state.latest.get(invite.inviteId);
  const dates = invite.guests.map(g => state.members.get(g.id)?.submittedAt).filter(Boolean).sort();
  const pending = latest && latest.kind === 'requested' && latest.rosterVersion === invite.rosterVersion ? {
    requestId: latest.requestId, submittedAt: latest.submittedAt,
    members: invite.guests.map(g => publicMember(g, latest.members.find(m => m.id === g.id)))
  } : null;
  return {revision: latest ? latest.requestId : 'initial',
    prior: invite.guests.some(g => state.members.has(g.id)) ? {members: invite.guests.map(g => publicMember(g, state.members.get(g.id))), submittedAt: dates.length ? dates[dates.length - 1] : null} : null,
    pending, declinedRequest: latest && latest.kind === 'declined' ? latest.submittedAt : null};
}
function lookup(code) {
  const ss = SpreadsheetApp.getActiveSpreadsheet(); requireReady(ss);
  const data = guestData(ss), invite = invitation(data, code), state = replyState(invite, readHistory(ss));
  return {ok: true, protocol: 2, household: {code: invite.code, id: invite.inviteId, household: invite.label,
    type: invite.family ? 'family' : 'friend', events: invite.family ? ['tea', 'ceremony'] : ['ceremony'],
    members: invite.guests.map(g => ({id: g.id, name: g.name})), revision: state.revision, rosterVersion: invite.rosterVersion},
    prior: state.prior, pending: state.pending, declinedRequest: state.declinedRequest};
}
function textField(value, limit) {
  if (value != null && typeof value !== 'string') fail('invalid_answers', 'Please check the information in your reply.');
  const result = clean(value);
  if (result.length > limit) fail('invalid_answers', 'Please keep dietary notes under 300 characters and messages under 1000 characters.');
  return result;
}
function validateMembers(invite, input, allowPending) {
  if (!Array.isArray(input) || input.length !== invite.guests.length) fail('roster_changed', 'Your invitation has changed. Reload it to see the current guest names.');
  const ids = new Set(input.map(m => m && m.id));
  if (ids.size !== input.length || invite.guests.some(g => !ids.has(g.id))) fail('roster_changed', 'Please reply only for the guests named on your invitation. Reload it to check the names.');
  return invite.guests.map(g => {
    const m = input.find(m => m.id === g.id);
    if (!['yes', 'no'].includes(m.attending) && !(allowPending && m.attending === 'pending')) fail('missing_answers', 'Please choose an attendance answer for every guest.');
    if (invite.family && !['yes', 'no'].includes(m.tea) && !(allowPending && m.tea === 'pending')) fail('missing_answers', 'Please choose a tea ceremony answer for every family guest.');
    if (!invite.family && m.tea) fail('invalid_answers', 'This invitation is for the dinner reception. Please reload and try again.');
    return {id: g.id, name: g.name, attending: m.attending, tea: invite.family ? m.tea : '',
      dietary: m.attending === 'yes' ? textField(m.dietary, 300) : '', notes: textField(m.notes, 1000)};
  });
}
function capacityExceeded(data, events, members) {
  if (!RSVP_CONFIG.DINNER_CAPACITY) return false;
  const state = historyState(events), proposed = new Map(members.map(m => [m.id, m]));
  const active = data.guests.filter(activeGuest);
  const currentCount = active.filter(g => state.members.get(g.id)?.attending === 'yes').length;
  const proposedCount = active.filter(g => (proposed.get(g.id) || state.members.get(g.id) || {}).attending === 'yes').length;
  const heldCount = active.filter(g => g.seat === 'reserved' || (proposed.get(g.id) || state.members.get(g.id) || {}).attending === 'yes').length;
  const hasNewYes = members.some(m => m.attending === 'yes' && state.members.get(m.id)?.attending !== 'yes');
  return proposedCount > RSVP_CONFIG.DINNER_CAPACITY && proposedCount > currentCount || heldCount > RSVP_CONFIG.DINNER_CAPACITY && hasNewYes;
}
function needsReview(data, invite, events, members) {
  const state = historyState(events);
  const released = invite.guests.some(g => g.seat === 'released' && members.find(m => m.id === g.id).attending === 'yes');
  const cancellationOnly = members.every(m => {
    const saved = state.members.get(m.id);
    if (!saved) return m.attending === 'no' && (!m.tea || m.tea === 'no');
    return saved && (m.attending === saved.attending || m.attending === 'no') && (m.tea === saved.tea || m.tea === 'no' || !m.tea) &&
      m.notes === (saved.notes || '') && (m.attending === 'no' || m.dietary === (saved.dietary || ''));
  });
  return released || capacityExceeded(data, events, members) || ((new Date() > new Date(RSVP_CONFIG.DEADLINE) || RSVP_CONFIG.REVIEW_ALL_CHANGES) && !cancellationOnly);
}
function appendEvent(ss, event) {
  const tab = historySheet(ss);
  event.sequence = tab.getLastRow();
  const json = JSON.stringify(event);
  if (json.length > 45000) fail('invalid_answers', 'This reply is too long. Please shorten the messages or contact us.');
  const row = [event.requestId, event.inviteId, event.code, event.kind, event.submittedAt, event.source, event.members.length,
    event.members.filter(m => m.attending === 'yes').length, event.members.filter(m => m.tea === 'yes').length, json];
  // Commit the authoritative record before touching rebuildable tracking views.
  tab.getRange(tab.getLastRow() + 1, 1, 1, row.length).setValues([row.map(safeCell)]);
  SpreadsheetApp.flush();
}
function submitReply(payload) {
  if (!payload || typeof payload !== 'object' || !/^[a-z0-9_-]{16,96}$/i.test(payload.requestId || '')) fail('refresh_required', 'Please reload your invitation before replying.');
  const ss = SpreadsheetApp.getActiveSpreadsheet(); requireReady(ss);
  const data = guestData(ss), invite = invitation(data, payload.code), events = readHistory(ss);
  if (payload.rosterVersion !== invite.rosterVersion) fail('roster_changed', 'Your invitation has changed. Reload it to see the current guest names.');
  const fingerprint = hash({code: invite.code, revision: payload.revision, rosterVersion: payload.rosterVersion, members: payload.members});
  const existing = events.find(e => e.requestId === payload.requestId);
  if (existing) {
    if (existing.inviteId !== invite.inviteId || existing.fingerprint !== fingerprint) fail('invalid_request', 'Please reload your invitation before trying again.');
    if (replyState(invite, events).revision !== existing.requestId) fail('conflict', 'This reply has since been updated or reviewed. Reload to see the latest confirmed reply.');
    return submissionResult(invite, events, existing);
  }
  if (payload.revision !== replyState(invite, events).revision) fail('conflict', 'Someone has updated this invitation since you opened it. Reload to review the latest reply before making changes.');
  const members = validateMembers(invite, payload.members, false);
  const event = {requestId: payload.requestId, inviteId: invite.inviteId, code: invite.code,
    kind: needsReview(data, invite, events, members) ? 'requested' : 'confirmed', submittedAt: stamp(),
    source: 'Guest', rosterVersion: invite.rosterVersion, fingerprint, members};
  appendEvent(ss, event); events.push(event); refreshAfterCommit(ss, data, events);
  return submissionResult(invite, events, event);
}
function submissionResult(invite, events, event) {
  const state = replyState(invite, events);
  return {ok: true, protocol: 2, status: event.kind === 'requested' ? 'requested' : 'saved', requestId: event.requestId,
    submittedAt: event.submittedAt, revision: state.revision, prior: state.prior, pending: state.pending, declinedRequest: state.declinedRequest};
}
function refreshAfterCommit(ss, data, events) {
  try { refreshTracking(ss, data, events); }
  catch (error) { console.error('History is safe; tracking needs a refresh: ' + error); }
}

// Host tools are intentionally not routed through the public web endpoint.
function hostAction(action) {
  const ui = SpreadsheetApp.getUi();
  try { const result = withLock(action); if (result) ui.alert(result); }
  catch (error) { ui.alert(error.message || String(error)); }
}
function ensureGuestHeaders(tab) {
  const data = sheetData(tab);
  if (['RSVP Group', 'Name', 'Category', 'Invite Intent', 'RSVP'].some(h => data.col(h) < 0)) throw new Error('Guestlist needs these headers: RSVP Group, Name, Category, Invite Intent, RSVP. Existing columns will not be moved.');
  const extras = (urlColumn(data) < 0 ? [URL_CODE_HEADER] : []).concat(EXTRA_HEADERS);
  extras.forEach(header => {
    if (data.headers.some(h => h.toLowerCase() === header.toLowerCase())) return;
    tab.getRange(1, data.headers.length + 1).setValue(header); data.headers.push(header);
  });
}
function prepareGuestIdentities(ss) {
  const tab = ss.getSheetByName(GUESTLIST_TAB);
  if (!tab) throw new Error('Create a Guestlist tab with the existing guest-list headers first.');
  ensureGuestHeaders(tab);
  const data = sheetData(tab), byGroup = new Map(), usedCodes = new Set(), usedIds = new Set(), codeCol = urlColumn(data);
  data.values.slice(1).forEach((r, i) => {
    const group = clean(getValue(data, r, 'RSVP Group')), name = clean(getValue(data, r, 'Name'));
    const code = normCode(r[codeCol]), id = clean(getValue(data, r, INVITE_ID_HEADER));
    // Uninvited planning rows can stay ungrouped. Never ignore an existing link.
    const requiresGroup = group || code || id || yes(getValue(data, r, 'Invite Intent')) || normCode(getValue(data, r, 'Invitation Status')) === 'active';
    if (!requiresGroup) return;
    if (!group || !name) throw new Error('Row ' + (i + 2) + ' needs both a Name and RSVP Group because it is invited or already has an invitation identity. No codes were changed.');
    const current = byGroup.get(group) || {codes: new Set(), ids: new Set()};
    if (code) { current.codes.add(code); usedCodes.add(code); } if (id) current.ids.add(id); byGroup.set(group, current);
    const guestId = clean(getValue(data, r, GUEST_ID_HEADER));
    if (guestId && usedIds.has(guestId)) throw new Error('Duplicate Guest ID on row ' + (i + 2) + '. Restore the original ID from your backup.');
    if (guestId) usedIds.add(guestId);
  });
  const codeOwners = new Map(), inviteOwners = new Map();
  for (const [group, info] of byGroup) {
    if (info.codes.size > 1 || info.ids.size > 1) throw new Error('Group ' + group + ' has conflicting codes/IDs. Use Move guests to regroup existing guests.');
    info.code = [...info.codes][0]; info.id = [...info.ids][0];
    if (info.code && codeOwners.has(info.code)) throw new Error('Groups ' + codeOwners.get(info.code) + ' and ' + group + ' share a URL code. If these are separate invitations, run repairDuplicateGroupLink for group ' + group + ', then rerun setupRsvp.');
    if (info.id && inviteOwners.has(info.id)) throw new Error('Groups ' + inviteOwners.get(info.id) + ' and ' + group + ' share an Invitation ID. Run repairDuplicateGroupLink for the group that needs its own invitation, then rerun setupRsvp.');
    if (info.code) codeOwners.set(info.code, group); if (info.id) inviteOwners.set(info.id, group);
    if (!info.code) { do { info.code = randomCode(); } while (usedCodes.has(info.code)); usedCodes.add(info.code); }
    if (!info.id) info.id = 'inv_' + uuid();
  }
  const fields = [URL_CODE_HEADER, GUEST_ID_HEADER, INVITE_ID_HEADER, 'Invitation Link', 'Invitation Status', 'Seat Status'];
  const columns = fields.map(header => ({index: header === URL_CODE_HEADER ? codeCol : data.col(header), cells: []}));
  data.values.slice(1).forEach(row => {
    const group = clean(getValue(data, row, 'RSVP Group')), name = clean(getValue(data, row, 'Name')), info = group && name ? byGroup.get(group) : null;
    const values = info ? [asStr(row[codeCol]) || info.code, clean(getValue(data, row, GUEST_ID_HEADER)) || 'guest_' + uuid(),
      clean(getValue(data, row, INVITE_ID_HEADER)) || info.id,
      RSVP_CONFIG.WEBSITE_URL.replace(/[?#].*$/, '') + '?inv=' + encodeURIComponent(info.code),
      clean(getValue(data, row, 'Invitation Status')) || (yes(getValue(data, row, 'Invite Intent')) ? 'Active' : 'Draft'),
      clean(getValue(data, row, 'Seat Status')) || 'Reserved'] : columns.map(c => row[c.index] || '');
    columns.forEach((column, i) => column.cells.push([safeCell(values[i])]));
  });
  columns.forEach(c => { if (c.cells.length) tab.getRange(2, c.index + 1, c.cells.length, 1).setValues(c.cells); });
  [GUEST_ID_HEADER, INVITE_ID_HEADER].forEach(h => tab.hideColumns(data.col(h) + 1));
  [['Invitation Status', ['Active', 'Draft', 'Waitlist', 'Retired']], ['Seat Status', ['Reserved', 'Released']]].forEach(([header, options]) => {
    const validation = SpreadsheetApp.newDataValidation().requireValueInList(options, true).setAllowInvalid(false).build();
    tab.getRange(2, data.col(header) + 1, Math.max(1, tab.getMaxRows() - 1), 1).setDataValidation(validation);
  });
}
function migrateReplies(ss, data, events) {
  const responseTab = ss.getSheetByName(RESPONSES_TAB), old = responseTab ? sheetData(responseTab) : null;
  const byId = new Map(), known = historyState(events).members;
  if (old && old.headers.some(h => h && !RESPONSE_HEADERS.some(expected => expected.toLowerCase() === h.toLowerCase()) && !/^url code\b/i.test(h))) throw new Error('RSVP Responses contains extra columns. Preserve those in your backup and move custom planning columns into Guestlist before setup.');
  if (old && old.values.length > 1) old.values.slice(1).filter(row => row.some(x => x !== '')).forEach((row, i) => {
    const code = urlColumn(old) >= 0 ? normCode(row[urlColumn(old)]) : '', id = clean(getValue(old, row, GUEST_ID_HEADER));
    const name = clean(getValue(old, row, 'Name')) || clean(getValue(old, row, 'Relationship'));
    const candidates = data.guests.filter(g => id ? g.id === id : g.code === code && (g.name === name || clean(getValue(data, g.raw, 'Relationship')) === name));
    if (candidates.length !== 1) throw new Error('Old RSVP Responses row ' + (i + 2) + ' cannot be matched unambiguously. Keep it intact and resolve the name/code before setup.');
    if (byId.has(candidates[0].id)) throw new Error('Duplicate old response for ' + candidates[0].name + '. Review your backup before migration.');
    const when = getValue(old, row, 'Submitted At');
    byId.set(candidates[0].id, {attending: answer(getValue(old, row, 'RSVP')), tea: answer(getValue(old, row, 'Tea Ceremony')),
      solem: clean(getValue(old, row, 'Solemnisation')), dietary: asStr(getValue(old, row, 'Dietary')),
      notes: asStr(getValue(old, row, 'Member Notes')), driving: asStr(getValue(old, row, 'Driving?')),
      vehicles: asStr(getValue(old, row, 'Vehicles')),
      submittedAt: when && !isNaN(new Date(when).getTime()) ? new Date(when).toISOString() : null});
  });
  const groups = new Map();
  data.guests.forEach(g => {
    if (known.has(g.id)) return;
    const saved = byId.get(g.id), manual = answer(getValue(data, g.raw, 'RSVP'));
    if (!saved && manual === 'pending') return;
    const member = {id: g.id, name: g.name, ...(saved || {attending: manual, tea: answer(getValue(data, g.raw, 'Tea Ceremony')), dietary: '', notes: '', submittedAt: null})};
    if (!groups.has(g.inviteId)) groups.set(g.inviteId, []); groups.get(g.inviteId).push(member);
  });
  for (const [inviteId, members] of groups) {
    const g = data.guests.find(g => g.inviteId === inviteId);
    const event = {requestId: 'migration_' + uuid(), inviteId, code: g.code, kind: 'confirmed', submittedAt: stamp(), source: 'Imported reply', members};
    appendEvent(ss, event); events.push(event);
  }
}
function setupRsvp() {
  hostAction(() => {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    PropertiesService.getScriptProperties().deleteProperty('RSVP_READY_V2');
    prepareGuestIdentities(ss); historySheet(ss);
    const data = guestData(ss), issues = guestIssues(data);
    if (issues.length) throw new Error(issues.join('\n'));
    const events = readHistory(ss); migrateReplies(ss, data, events); refreshTracking(ss, data, events);
    PropertiesService.getScriptProperties().setProperty('RSVP_READY_V2', ss.getId());
    return 'Setup complete. Existing codes and replies were retained. Review the Dashboard, then deploy protocol 2 and publish the updated website. Blank Invite Intent is not an invitation.';
  });
}
function generateMissingCodes() { setupRsvp(); }
function repairDuplicateGroupLink() {
  const group = promptText('Repair a shared invitation code', 'Enter the RSVP Group that should receive its own link (for example 51). Other groups keep their links. Make a workbook backup first.');
  if (!group) return;
  if (!confirmHost('Repair the shared code/Invitation ID for group ' + group + ' only? Existing guest IDs and matched replies will be retained. You must run setupRsvp afterwards.')) return;
  hostAction(() => repairSharedGroupCode(SpreadsheetApp.getActiveSpreadsheet(), group));
}
function repairSharedGroupCode(ss, group) {
  const tab = ss.getSheetByName(GUESTLIST_TAB);
  if (!tab) throw new Error('Guestlist tab not found.');
  ensureGuestHeaders(tab);
  const data = sheetData(tab), codeIndex = urlColumn(data), idIndex = data.col(GUEST_ID_HEADER), inviteIndex = data.col(INVITE_ID_HEADER);
  const rows = data.values.slice(1).map((raw, i) => ({raw, row: i + 2,
    group: clean(getValue(data, raw, 'RSVP Group')), name: clean(getValue(data, raw, 'Name')),
    relationship: clean(getValue(data, raw, 'Relationship')), code: normCode(raw[codeIndex]),
    id: clean(raw[idIndex]), inviteId: clean(raw[inviteIndex])}));
  const targets = rows.filter(r => r.group === clean(group));
  if (!targets.length || targets.some(r => !r.name)) throw new Error('That group needs at least one named guest, with no unnamed rows. Nothing was repaired.');
  const codes = new Set(targets.map(r => r.code).filter(Boolean)), inviteIds = new Set(targets.map(r => r.inviteId).filter(Boolean));
  if (codes.size !== 1 || inviteIds.size > 1) throw new Error('This tool repairs one shared code, not conflicting codes within a group. Preserve your backup and resolve that conflict first.');
  const oldCode = [...codes][0], otherRows = rows.filter(r => r.group !== clean(group));
  const sharedCode = otherRows.some(r => r.code === oldCode);
  const sharedId = inviteIds.size && otherRows.some(r => inviteIds.has(r.inviteId));
  if (!sharedCode && !sharedId) return 'This group already has its own code and Invitation ID. Nothing was changed. Run setupRsvp to finish preparation.';
  const existingIds = rows.map(r => r.id).filter(Boolean);
  if (new Set(existingIds).size !== existingIds.length) throw new Error('Duplicate Guest IDs need manual checking against your backup before repairing links.');
  targets.forEach(r => { r.newId = r.id || 'guest_' + uuid(); });
  const usedCodes = new Set(rows.map(r => r.code).filter(Boolean));
  let newCode = oldCode;
  if (sharedCode) do { newCode = randomCode(); } while (usedCodes.has(newCode));
  const newInviteId = 'inv_' + uuid();

  // Bind legacy responses before changing the join key. Ambiguous names stop the repair.
  const responseTab = ss.getSheetByName(RESPONSES_TAB), responses = responseTab ? sheetData(responseTab) : null;
  const bindings = [];
  if (responses && responses.values.length > 1) {
    const responseCodeIndex = urlColumn(responses);
    if (responseCodeIndex < 0) throw new Error('RSVP Responses is missing its URL Code header. Nothing was repaired.');
    responses.values.slice(1).forEach((raw, i) => {
      const savedId = clean(getValue(responses, raw, GUEST_ID_HEADER));
      const code = normCode(raw[responseCodeIndex]);
      if (code !== oldCode && !targets.some(r => savedId && r.id === savedId)) return;
      const name = clean(getValue(responses, raw, 'Name')) || clean(getValue(responses, raw, 'Relationship'));
      const candidates = rows.filter(r => savedId ? r.id === savedId : r.code === code && (r.name === name || r.relationship && r.relationship === name));
      if (candidates.length !== 1) throw new Error('An old response sharing this code cannot be matched uniquely. Nothing was repaired; keep that response and check it against your backup.');
      const target = targets.find(r => r.row === candidates[0].row);
      if (target) bindings.push({row: i + 2, id: target.newId});
    });
  }
  PropertiesService.getScriptProperties().deleteProperty('RSVP_READY_V2');
  const guestIds = data.values.slice(1).map((raw, i) => [targets.find(r => r.row === i + 2)?.newId || raw[idIndex] || '']);
  tab.getRange(2, idIndex + 1, guestIds.length, 1).setValues(guestIds);
  if (bindings.length) {
    let column = responses.col(GUEST_ID_HEADER);
    if (column < 0) { column = responses.headers.length; responseTab.getRange(1, column + 1).setValue(GUEST_ID_HEADER); }
    bindings.forEach(binding => responseTab.getRange(binding.row, column + 1).setValue(binding.id));
  }
  const targetRows = new Set(targets.map(r => r.row));
  // Batch each managed column so other groups and all reply values remain untouched.
  [[codeIndex, newCode], [inviteIndex, newInviteId], [data.col('Invitation Link'), RSVP_CONFIG.WEBSITE_URL + '?inv=' + newCode]].forEach(([column, value]) => {
    const cells = data.values.slice(1).map((raw, i) => [safeCell(targetRows.has(i + 2) ? value : raw[column] || '')]);
    tab.getRange(2, column + 1, cells.length, 1).setValues(cells);
  });
  return 'Group ' + group + ' now has its own link. Other groups kept their codes and no reply answers were changed. Run setupRsvp, validate, then copy Invitation Link for this group. Its old shared link must not be sent to this group again.';
}
function validateGuestlist() {
  hostAction(() => {
    const data = guestData(SpreadsheetApp.getActiveSpreadsheet()), issues = guestIssues(data);
    return issues.length ? issues.join('\n') : 'Guest list passed. ' + data.guests.filter(g => !g.intent).length + ' row(s) have blank Invite Intent and are not invited. Family/friend mixtures must use separate groups.';
  });
}
function responseRows(data, events) {
  const state = historyState(events);
  return data.guests.filter(g => state.members.has(g.id)).map(g => {
    const m = state.members.get(g.id);
    return [g.code, g.group, getValue(data, g.raw, 'Whose side?'), getValue(data, g.raw, 'Category'),
      getValue(data, g.raw, 'Relationship'), g.name, getValue(data, g.raw, 'Invite Intent'), getValue(data, g.raw, 'RSVP Sent Out?'),
      m.attending === 'yes' ? 'Yes' : m.attending === 'no' ? 'No' : 'Pending', getValue(data, g.raw, 'Table'),
      m.solem || '', m.tea === 'yes' ? 'Yes' : m.tea === 'no' ? 'No' : '', m.dietary || '', m.notes || '',
      m.driving || '', m.vehicles || '', m.submittedAt || '', g.id, g.inviteId, m.source || ''].map(safeCell);
  });
}
function refreshTracking(ss, data, events) {
  const state = historyState(events);
  let response = ss.getSheetByName(RESPONSES_TAB); if (!response) response = ss.insertSheet(RESPONSES_TAB);
  if (sheetData(response).headers.some(h => h && !RESPONSE_HEADERS.some(expected => expected.toLowerCase() === h.toLowerCase()) && !/^url code\b/i.test(h))) throw new Error('RSVP Responses contains custom columns. Preserve them before rebuilding this cache.');
  const rows = responseRows(data, events);
  // Cache only: a failure here cannot erase the authoritative history.
  response.clearContents(); response.getRange(1, 1, rows.length + 1, RESPONSE_HEADERS.length).setValues([RESPONSE_HEADERS, ...rows]); response.setFrozenRows(1);
  ['RSVP', 'Tea Ceremony', 'Last Reply At', 'Reply Source'].forEach(field => {
    const index = data.col(field); if (index < 0 || data.values.length < 2) return;
    const cells = data.values.slice(1).map((row, i) => {
      const g = data.guests.find(g => g.row === i + 2), m = g && state.members.get(g.id);
      if (!g) return [row[index] || ''];
      if (field === 'RSVP') return [m && m.attending === 'yes' ? 'Yes' : m && m.attending === 'no' ? 'No' : ''];
      if (field === 'Tea Ceremony') return [m && m.tea === 'yes' ? 'Yes' : m && m.tea === 'no' ? 'No' : ''];
      return [safeCell(m ? field === 'Last Reply At' ? m.submittedAt || '' : m.source || '' : '')];
    });
    data.tab.getRange(2, index + 1, cells.length, 1).setValues(cells);
  });
  rebuildDashboard(ss, data, events);
}
function rebuildDashboard(ss, data, events) {
  const state = historyState(events), active = data.guests.filter(activeGuest);
  const attending = active.filter(g => state.members.get(g.id)?.attending === 'yes').length, declined = active.filter(g => state.members.get(g.id)?.attending === 'no').length;
  const pending = [...state.latest.values()].filter(e => e.kind === 'requested');
  const rows = [['Wedding RSVP Dashboard', 'Refreshed ' + stamp()], ['Invited guests', active.length], ['Dinner attending', attending], ['Dinner declined', declined],
    ['Awaiting dinner reply', active.length - attending - declined], ['Tea attending', active.filter(g => g.category === 'family' && state.members.get(g.id)?.tea === 'yes').length],
    ['Waiting for host review', pending.length], ['Dinner capacity', RSVP_CONFIG.DINNER_CAPACITY || 'Not configured'],
    ['Capacity remaining', RSVP_CONFIG.DINNER_CAPACITY ? RSVP_CONFIG.DINNER_CAPACITY - attending : 'Set DINNER_CAPACITY in the script'],
    ['Reserved seats (including unanswered)', active.filter(g => g.seat === 'reserved').length],
    ['Released seats', data.guests.filter(g => g.seat === 'released').length], ['Waitlisted guests', data.guests.filter(g => g.status === 'waitlist').length],
    ['Deadline (Singapore)', RSVP_CONFIG.DEADLINE], [], ['Guest', 'Group', 'Dinner', 'Tea', 'Table', 'Dietary', 'Seat', 'Last reply', 'Source']];
  active.forEach(g => {
    const m = state.members.get(g.id) || {};
    rows.push([g.name, g.group, m.attending || 'pending', g.category === 'family' ? m.tea || 'pending' : '', getValue(data, g.raw, 'Table'),
      m.attending === 'yes' ? m.dietary || '' : '', g.seat, m.submittedAt || '', m.source || '']);
  });
  rows.push([], ['Requests needing review', 'Request ID', 'History row', 'Received', 'Action']);
  pending.forEach(e => rows.push([data.guests.find(g => g.inviteId === e.inviteId)?.group || 'Roster changed', e.requestId, e.historyRow || events.indexOf(e) + 2,
    e.submittedAt, 'Select that row in Reply History, then Wedding RSVP > Approve/Decline']));
  let tab = ss.getSheetByName(DASHBOARD_TAB); if (!tab) tab = ss.insertSheet(DASHBOARD_TAB);
  else if (clean(tab.getRange(1, 1).getValue()) && tab.getRange(1, 1).getValue() !== 'Wedding RSVP Dashboard') throw new Error('RSVP Dashboard contains unrelated data. Rename it before refreshing.');
  tab.clearContents(); const width = Math.max(...rows.map(r => r.length));
  tab.getRange(1, 1, rows.length, width).setValues(rows.map(r => Array.from({length: width}, (_, i) => safeCell(r[i] == null ? '' : r[i])))); tab.setFrozenRows(1);
}
function refreshRsvpTracking() {
  hostAction(() => { const ss = SpreadsheetApp.getActiveSpreadsheet(); refreshTracking(ss, guestData(ss), readHistory(ss)); return 'Tracking refreshed from Reply History. Names, groupings, tables and send-out columns were not changed.'; });
}
function selectedGuests(ss, data) {
  const range = ss.getActiveRange();
  if (!range || range.getSheet().getName() !== GUESTLIST_TAB || range.getRow() < 2) throw new Error('Select named guest row(s) in Guestlist first.');
  const guests = data.guests.filter(g => g.row >= range.getRow() && g.row < range.getRow() + range.getNumRows());
  if (!guests.length) throw new Error('Select at least one named guest.'); return guests;
}
function promptText(title, message) {
  const ui = SpreadsheetApp.getUi(), result = ui.prompt(title, message, ui.ButtonSet.OK_CANCEL);
  return result.getSelectedButton() === ui.Button.OK ? clean(result.getResponseText()) : null;
}
function confirmHost(message) { const ui = SpreadsheetApp.getUi(); return ui.alert('Wedding RSVP', message, ui.ButtonSet.YES_NO) === ui.Button.YES; }
function recordSelectedGuestReply() {
  // Prompts suspend execution, so ask BEFORE acquiring the script lock.
  const ss = SpreadsheetApp.getActiveSpreadsheet(), guests = selectedGuests(ss, guestData(ss));
  if (guests.length !== 1) return SpreadsheetApp.getUi().alert('Select one guest at a time.');
  const guest = guests[0], attending = promptText('Reply for ' + guest.name, 'Dinner: type Yes or No.'); if (attending === null) return;
  const tea = guest.category === 'family' ? promptText('Tea for ' + guest.name, 'Tea ceremony: type Yes or No.') : ''; if (tea === null) return;
  if (!['yes', 'no'].includes(normCode(attending)) || guest.category === 'family' && !['yes', 'no'].includes(normCode(tea))) return SpreadsheetApp.getUi().alert('Please enter Yes or No. Nothing was changed.');
  const dietary = normCode(attending) === 'yes' ? promptText('Dietary notes', 'Enter dietary needs, or leave blank.') : ''; if (dietary === null) return;
  hostAction(() => {
    const data = guestData(ss), invite = invitation(data, guest.code), events = readHistory(ss), state = historyState(events);
    if (!invite.guests.some(g => g.id === guest.id)) throw new Error('The guest list changed. Please start again.');
    if (state.latest.get(invite.inviteId)?.kind === 'requested') throw new Error('This group has a pending change request. Approve or decline it from Reply History before recording an individual reply.');
    const members = invite.guests.map(g => publicMember(g, state.members.get(g.id)));
    Object.assign(members.find(m => m.id === guest.id), {attending: normCode(attending), tea: normCode(tea), dietary});
    const checked = validateMembers(invite, members, true);
    if (capacityExceeded(data, events, checked)) throw new Error('This would exceed DINNER_CAPACITY. Review capacity before confirming.');
    const event = {requestId: 'host_' + uuid(), inviteId: invite.inviteId, code: invite.code, kind: 'confirmed', source: 'Host', submittedAt: stamp(), rosterVersion: invite.rosterVersion, members: checked};
    appendEvent(ss, event); events.push(event);
    if (normCode(attending) === 'yes') data.tab.getRange(invite.guests.find(g => g.id === guest.id).row, data.col('Seat Status') + 1).setValue('Reserved');
    refreshAfterCommit(ss, guestData(ss), events); return 'Reply recorded. The guest will see it using their existing link.';
  });
}
function decideSelectedRequest(approve) {
  const ss = SpreadsheetApp.getActiveSpreadsheet(), range = ss.getActiveRange();
  if (!range || range.getSheet().getName() !== HISTORY_TAB || range.getRow() < 2) return SpreadsheetApp.getUi().alert('Select a requested row in Reply History first.');
  const requestId = clean(range.getSheet().getRange(range.getRow(), 1).getValue());
  if (!confirmHost((approve ? 'Approve' : 'Decline') + ' this requested change?')) return;
  hostAction(() => {
    const data = guestData(ss), events = readHistory(ss), request = events.find(e => e.requestId === requestId);
    if (!request || request.kind !== 'requested' || historyState(events).latest.get(request.inviteId)?.requestId !== requestId) throw new Error('That request is no longer current. Refresh the Dashboard.');
    if (!approve) {
      const event = {requestId: 'decline_' + uuid(), inviteId: request.inviteId, code: request.code, kind: 'declined',
        source: 'Host review', submittedAt: stamp(), rosterVersion: request.rosterVersion, members: request.members, resolves: requestId};
      appendEvent(ss, event); events.push(event); refreshAfterCommit(ss, data, events);
      return 'Request declined; the previous confirmed reply is unchanged. Please message the guest.';
    }
    const guest = data.guests.find(g => g.inviteId === request.inviteId && activeGuest(g)); if (!guest) throw new Error('This invitation is no longer active.');
    const invite = invitation(data, guest.code);
    if (request.rosterVersion !== invite.rosterVersion) throw new Error('The guest list changed. Ask the guest to reload and resubmit, or record their reply individually.');
    const members = validateMembers(invite, request.members, false);
    if (capacityExceeded(data, events, members)) throw new Error('Approving this would exceed DINNER_CAPACITY. Review seating first.');
    const event = {requestId: 'approve_' + uuid(), inviteId: invite.inviteId, code: invite.code,
      kind: 'confirmed', source: 'Host review', submittedAt: stamp(), rosterVersion: invite.rosterVersion, members, resolves: requestId};
    appendEvent(ss, event); events.push(event);
    invite.guests.forEach(g => { if (members.find(m => m.id === g.id).attending === 'yes') data.tab.getRange(g.row, data.col('Seat Status') + 1).setValue('Reserved'); });
    refreshAfterCommit(ss, guestData(ss), events);
    return 'Change confirmed. Please message the guest so they know.';
  });
}
function approveSelectedRequest() { decideSelectedRequest(true); }
function declineSelectedRequest() { decideSelectedRequest(false); }
function releaseSelectedSeats() {
  const ss = SpreadsheetApp.getActiveSpreadsheet(), guests = selectedGuests(ss, guestData(ss));
  if (!confirmHost('Release the selected declined seats? A later Yes will need your approval.')) return;
  hostAction(() => {
    const data = guestData(ss), state = historyState(readHistory(ss));
    const fresh = guests.map(g => data.guests.find(x => x.id === g.id));
    if (fresh.some(g => !g || state.members.get(g.id)?.attending !== 'no')) throw new Error('Only guests with a confirmed No can have seats released.');
    fresh.forEach(g => data.tab.getRange(g.row, data.col('Seat Status') + 1).setValue('Released'));
    refreshTracking(ss, guestData(ss), readHistory(ss)); return 'Seats released. Add replacement guests as NEW rows; never replace old names.';
  });
}
function moveSelectedGuests() {
  const ss = SpreadsheetApp.getActiveSpreadsheet(), guests = selectedGuests(ss, guestData(ss));
  const group = promptText('Move selected guests', 'Destination RSVP Group: an existing group or a new unused number.'); if (group === null || !group) return;
  if (!confirmHost('Move ' + guests.length + ' guest(s) to group ' + group + '? Share the destination link afterwards.')) return;
  hostAction(() => {
    const data = guestData(ss), ids = new Set(guests.map(g => g.id)), moving = data.guests.filter(g => ids.has(g.id));
    if (moving.length !== guests.length) throw new Error('The selection changed. Please start again.');
    if (moving.every(g => g.group === group)) return 'These guests are already in that group. Their link was not changed.';
    const target = data.guests.filter(g => g.group === group && !ids.has(g.id));
    const code = target.length ? target[0].code : randomCode(), inviteId = target.length ? target[0].inviteId : 'inv_' + uuid();
    const changed = moving.map(g => ({...g, group, code, inviteId}));
    const issues = guestIssues({...data, guests: data.guests.map(g => changed.find(m => m.id === g.id) || g)});
    if (issues.length) throw new Error(issues.join('\n'));
    moving.forEach(g => {
      data.tab.getRange(g.row, data.col('RSVP Group') + 1).setValue(safeCell(group)); data.tab.getRange(g.row, urlColumn(data) + 1).setValue(code);
      data.tab.getRange(g.row, data.col(INVITE_ID_HEADER) + 1).setValue(inviteId); data.tab.getRange(g.row, data.col('Invitation Link') + 1).setValue(RSVP_CONFIG.WEBSITE_URL + '?inv=' + code);
    });
    refreshTracking(ss, guestData(ss), readHistory(ss)); return 'Guests moved. Saved answers follow their permanent IDs. Other guests in the old group keep their link.';
  });
}
function manageSelectedInvitation(retire) {
  const ss = SpreadsheetApp.getActiveSpreadsheet(), guests = selectedGuests(ss, guestData(ss));
  if (new Set(guests.map(g => g.inviteId)).size !== 1) return SpreadsheetApp.getUi().alert('Select guests from one invitation only.');
  if (!confirmHost(retire ? 'Retire this WHOLE invitation? Its link will stop loading names.' : 'Reissue this WHOLE invitation? Its old link will stop working. Send the new link to everyone in the group.')) return;
  hostAction(() => {
    const data = guestData(ss), group = data.guests.filter(g => g.inviteId === guests[0].inviteId), code = retire ? null : randomCode();
    group.forEach(g => {
      if (retire) data.tab.getRange(g.row, data.col('Invitation Status') + 1).setValue('Retired');
      else { data.tab.getRange(g.row, urlColumn(data) + 1).setValue(code); data.tab.getRange(g.row, data.col('Invitation Link') + 1).setValue(RSVP_CONFIG.WEBSITE_URL + '?inv=' + code); }
    });
    refreshTracking(ss, guestData(ss), readHistory(ss)); return retire ? 'Invitation retired. History has not been deleted.' : 'New link is in Invitation Link. Previous replies are retained.';
  });
}
function reissueSelectedLink() { manageSelectedInvitation(false); }
function retireSelectedInvitation() { manageSelectedInvitation(true); }
