/** Gabriel & Estella, private spreadsheet gateway, protocol 3.
 * Run Update invitation codes once, then deploy as Me / Anyone.
 * Guestlist H-K are manual. Website replies live only in RSVP Responses.
 */
const SETTINGS = {
  WEBSITE_URL: 'https://gabtortbox.github.io/estella-gabriel-wedding/',
  GUESTLIST_TAB: 'Guestlist',
  RESPONSES_TAB: 'RSVP Responses'
};
const RESPONSE_HEADERS = ['Name', 'RSVP Group', 'Dinner', 'Tea Ceremony', 'Dietary', 'Message', 'Last Saved', 'URL Code', 'Member ID (internal)'];
const LOG_HEADERS = ['Submission ID (internal v3)', 'URL Code', 'Saved At', 'Snapshot JSON', 'Sequence'];

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Wedding RSVP')
    .addItem('Update invitation codes', 'updateInvitationCodes').addToUi();
}
function updateInvitationCodes() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  try {
    const result = locked_(() => {
      const source = source_(ss);
      responses_(ss, true);
      const count = syncCodes_(ss, source);
      PropertiesService.getScriptProperties().setProperty('RSVP3_SPREADSHEET', ss.getId());
      const checked = source_(ss), issues = [], checkedCodes = new Set();
      checked.rows.filter(row => yes_(row[6]) && str_(row[1]) && code_(row[0])).forEach(row => {
        const code = str_(row[0]);
        if (checkedCodes.has(code)) return;
        checkedCodes.add(code);
        try { roster_(ss, code, checked); } catch (error) { issues.push('Group ' + str_(row[1]) + ': ' + error.message); }
      });
      rebuildReplies_(ss);
      count.issues = issues;
      return count;
    });
    ss.toast(result.groups + ' groups updated. ' + result.missing + ' invited guests need a group in B. ' + result.issues.length + ' groups need checking. H-K unchanged.', 'Wedding RSVP', 10);
    if (result.issues.length) SpreadsheetApp.getUi().alert('Codes updated, but please fix these invitations before sending:\n' + result.issues.join('\n'));
  } catch (error) {
    SpreadsheetApp.getUi().alert('Invitation codes were not fully updated. ' + error.message);
  }
}
function onEdit(e) {
  if (!e || !e.range || e.range.getSheet().getName() !== SETTINGS.GUESTLIST_TAB) return;
  const first = e.range.getColumn(), last = first + e.range.getNumColumns() - 1;
  if (!((first <= 2 && last >= 2) || (first <= 7 && last >= 7))) return;
  try {
    locked_(() => syncCodes_(e.source, source_(e.source)));
  } catch (error) {
    e.source.toast('Please run Wedding RSVP > Update invitation codes. ' + error.message, 'Wedding RSVP', 10);
  }
}
function doGet() {
  return json_({ok: true, protocol: 3, configured: !!PropertiesService.getScriptProperties().getProperty('RSVP3_SPREADSHEET')});
}
function doPost(e) {
  try {
    const text = e && e.postData && e.postData.contents;
    if (!text || text.length > 100000) fail_('invalid_request', 'Please refresh your invitation and try again.');
    const body = JSON.parse(text);
    if (body.protocol !== 3 || body.environment === 'test') fail_('upgrade_required', 'Please refresh the website to load the latest invitation.');
    const result = locked_(() => {
      const id = PropertiesService.getScriptProperties().getProperty('RSVP3_SPREADSHEET');
      if (!id) fail_('setup_required', 'We are preparing the invitations. Please try again later.');
      const ss = SpreadsheetApp.openById(id);
      if (body.action === 'lookup') return lookup_(ss, body.code);
      if (body.action === 'submit') return submit_(ss, body.payload);
      fail_('invalid_request', 'Please refresh your invitation and try again.');
    });
    return json_(Object.assign({ok: true, protocol: 3}, result));
  } catch (error) {
    console.error(error && error.stack || error);
    return json_({ok: false, protocol: 3, errorCode: error.rsvpCode || 'temporarily_unavailable',
      error: error.rsvpCode ? error.message : 'We could not reach the guest book. Your previous reply is safe. Please try again shortly.'});
  }
}
function locked_(action) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) fail_('busy', 'The guest book is busy. Please try again in a moment.');
  try { return action(); } finally { lock.releaseLock(); }
}
function fail_(code, message) { const error = new Error(message); error.rsvpCode = code; throw error; }
function json_(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
function str_(value) { return String(value == null ? '' : value).trim(); }
function norm_(value) { return str_(value).replace(/\s+/g, ' ').toLowerCase(); }
function yes_(value) { return norm_(value) === 'yes'; }
function code_(value) { return /^[a-z2-9]{6,7}$/.test(str_(value)); }
function hash_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8)
    .map(byte => ('0' + ((byte + 256) % 256).toString(16)).slice(-2)).join('');
}
function source_(ss) {
  const sheet = ss.getSheetByName(SETTINGS.GUESTLIST_TAB);
  if (!sheet) fail_('setup_required', 'The Guestlist tab could not be found.');
  const rows = sheet.getDataRange().getValues(), h = rows[0] || [];
  if (!/^url code/i.test(str_(h[0])) || norm_(h[1]) !== 'rsvp group' || norm_(h[5]) !== 'name' || norm_(h[6]) !== 'invite intent')
    fail_('setup_required', 'Keep the Guestlist columns A-L in their original positions.');
  return {sheet, rows: rows.slice(1), idIndex: h.indexOf('Guest ID (do not edit)')};
}
function syncCodes_(ss, source) {
  const properties = PropertiesService.getScriptProperties();
  const prefix = 'RSVP3_' + hash_(ss.getId() + '|' + source.sheet.getSheetId()).slice(0, 16) + '_';
  const all = properties.getProperties(), registered = new Map(), used = new Set(), groups = new Map();
  Object.keys(all).filter(key => key.indexOf(prefix) === 0).forEach(key => {
    const item = JSON.parse(all[key]);
    if (!item.group || !code_(item.code) || used.has(item.code)) throw new Error('The private code register needs checking. No links were changed.');
    registered.set(item.group, item.code); used.add(item.code);
  });
  source.rows.forEach(row => {
    const group = str_(row[1]);
    if (group && norm_(row[6]) !== 'no') {
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push(row);
    }
  });
  // Adopt already-sent short links only when unambiguous. All unsent legacy links get fresh short codes.
  groups.forEach((rows, group) => {
    if (registered.has(group) || !rows.some(row => yes_(row[8]))) return;
    const codes = new Set(rows.map(row => str_(row[0])));
    const candidate = Array.from(codes)[0];
    if (codes.size !== 1 || !code_(candidate) || used.has(candidate) ||
        Array.from(groups.entries()).some(([other, members]) => other !== group && members.some(row => str_(row[0]) === candidate)))
      throw new Error('A group marked as sent has an ambiguous code. Check column I before proceeding.');
    registered.set(group, candidate); used.add(candidate);
  });
  const pending = {};
  groups.forEach((rows, group) => {
    if (!registered.has(group)) {
      const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
      let candidate;
      do {
        const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid(), Utilities.Charset.UTF_8);
        candidate = bytes.slice(0, 7).map(byte => alphabet[((byte + 256) % 256) % alphabet.length]).join('');
      } while (used.has(candidate));
      registered.set(group, candidate); used.add(candidate);
    }
    pending[prefix + hash_(group)] = JSON.stringify({group, code: registered.get(group)});
  });
  // Persist first so retries cannot accidentally create a different link after a sheet-write failure.
  if (Object.keys(pending).length) properties.setProperties(pending);
  if (source.rows.length) source.sheet.getRange(2, 1, source.rows.length, 1).setValues(source.rows.map(row =>
    [norm_(row[6]) === 'no' || !str_(row[1]) ? '' : registered.get(str_(row[1]))]));
  const clear = source.rows.flatMap((row, index) => norm_(row[6]) === 'no' && str_(row[1]) ? ['B' + (index + 2)] : []);
  if (clear.length) source.sheet.getRangeList(clear).clearContent();
  SpreadsheetApp.flush();
  return {groups: groups.size, missing: source.rows.filter(row => yes_(row[6]) && !str_(row[1])).length};
}
function roster_(ss, code, preparedSource) {
  if (!code_(code)) fail_('unknown_invitation', 'Please use the complete invitation link we sent you.');
  const source = preparedSource || source_(ss), eligible = source.rows.filter(row => yes_(row[6]) && str_(row[1]));
  const matched = eligible.filter(row => str_(row[0]) === code);
  if (!matched.length) fail_('unknown_invitation', 'We could not find this invitation. Please check the link with us.');
  const group = str_(matched[0][1]);
  if (matched.some(row => str_(row[1]) !== group) || eligible.some(row => str_(row[1]) === group && str_(row[0]) !== code))
    fail_('invitation_needs_check', 'We need to check this invitation. Please contact Gabriel or Estella.');
  const family = norm_(matched[0][3]) === 'family';
  if (matched.some(row => (norm_(row[3]) === 'family') !== family) || matched.length > 40)
    fail_('invitation_needs_check', 'We need to check this invitation. Please contact Gabriel or Estella.');
  if (!source.identities) {
    source.identities = new Map(); source.identityCounts = new Map();
    eligible.forEach(row => {
      const id = source.idIndex >= 0 && str_(row[source.idIndex]) || 'm_' + hash_(source.sheet.getSheetId() + '|' + str_(row[0]) + '|' + norm_(row[5])).slice(0, 24);
      source.identities.set(row, id);
      source.identityCounts.set(id, (source.identityCounts.get(id) || 0) + 1);
    });
  }
  const ids = new Set(), names = new Set();
  const members = matched.map(row => {
    const id = source.identities.get(row), name = str_(row[5]);
    if (!name || ids.has(id) || names.has(norm_(name)) || source.identityCounts.get(id) > 1)
      fail_('invitation_needs_check', 'We need to check the guest names on this invitation. Please contact us.');
    ids.add(id); names.add(norm_(name)); return {id, name};
  });
  return {code, group, household: members.map(member => member.name).join(' & '), category: family ? 'family' : 'friends', events: family ? ['tea', 'dinner'] : ['dinner'], members,
    rosterVersion: hash_(JSON.stringify({family, members: members.slice().sort((a, b) => a.id.localeCompare(b.id))}))};
}
function responses_(ss, prepare) {
  let sheet = ss.getSheetByName(SETTINGS.RESPONSES_TAB);
  if (sheet && sheet.getLastRow()) {
    const rows = sheet.getDataRange().getValues(), header = rows[0];
    const logMatches = LOG_HEADERS.every((value, index) => header[index + 13] === value);
    const visibleMatches = RESPONSE_HEADERS.every((value, index) => header[index] === value);
    if (logMatches && visibleMatches) return sheet;
    if (norm_(header[0]).indexOf('url code') === 0 && prepare && !header.includes(LOG_HEADERS[0])) {
      let name = SETTINGS.RESPONSES_TAB + ' (Previous)', suffix = 1;
      while (ss.getSheetByName(name)) name = SETTINGS.RESPONSES_TAB + ' (Previous ' + (++suffix) + ')';
      sheet.setName(name); sheet = null;
    } else fail_('setup_required', 'Please run Wedding RSVP > Update invitation codes, or check the RSVP Responses headers.');
  }
  if (!prepare) fail_('setup_required', 'We are preparing the invitations. Please try again later.');
  if (!sheet) sheet = ss.insertSheet(SETTINGS.RESPONSES_TAB);
  sheet.getRange(1, 1, 1, RESPONSE_HEADERS.length).setValues([RESPONSE_HEADERS]);
  sheet.getRange(1, 14, 1, LOG_HEADERS.length).setValues([LOG_HEADERS]);
  sheet.setFrozenRows(1); sheet.hideColumns(9); sheet.hideColumns(14, 5);
  return sheet;
}
function log_(sheet) {
  const rows = sheet.getLastRow() > 1 ? sheet.getRange(2, 14, sheet.getLastRow() - 1, 5).getValues() : [];
  const events = [], seen = new Set();
  rows.forEach((row, index) => {
    if (!row.some(value => value !== '')) return;
    let event;
    try { event = JSON.parse(row[3]); } catch (error) { throw new Error('The saved reply log needs checking.'); }
    if (!event || !Array.isArray(event.members) || event.requestId !== row[0] || event.code !== row[1] ||
        event.sequence !== index + 1 || Number(row[4]) !== event.sequence || seen.has(event.requestId))
      throw new Error('The saved reply log needs checking.');
    seen.add(event.requestId); events.push(event);
  });
  if (events.some((event, index) => event.sequence !== index + 1)) throw new Error('The saved reply log needs checking.');
  return events;
}
function prior_(roster, events) {
  const latest = events.filter(event => event.code === roster.code).pop();
  const answers = new Map();
  events.filter(event => event.code === roster.code).forEach(event => event.members.forEach(member => answers.set(member.id, Object.assign({submittedAt: event.submittedAt}, member))));
  const members = roster.members.filter(member => answers.has(member.id)).map(member => Object.assign({}, answers.get(member.id), member));
  return {revision: latest ? latest.requestId : '', prior: members.length ? {members, submittedAt: latest.submittedAt} : null};
}
function lookup_(ss, code) {
  const roster = roster_(ss, str_(code)), state = prior_(roster, log_(responses_(ss, false)));
  return {household: Object.assign({}, roster, {revision: state.revision}), prior: state.prior};
}
function submit_(ss, payload) {
  if (!payload || !/^[\w-]{16,100}$/.test(payload.requestId || '')) fail_('invalid_request', 'Please refresh your invitation and try again.');
  const roster = roster_(ss, str_(payload.code));
  if (payload.rosterVersion !== roster.rosterVersion) fail_('roster_changed', 'Your invitation has been updated. Reload your invitation before replying.');
  if (!Array.isArray(payload.members) || payload.members.length !== roster.members.length) fail_('invalid_members', 'Please reply for each named guest on your invitation.');
  const incoming = new Map(payload.members.map(member => [member.id, member]));
  if (incoming.size !== roster.members.length || roster.members.some(member => !incoming.has(member.id)))
    fail_('invalid_members', 'Only the named guests on your invitation can reply.');
  const members = roster.members.map(member => {
    const answer = incoming.get(member.id), tea = roster.category === 'family' ? answer.tea : '';
    if (!['yes', 'no'].includes(answer.attending) || (roster.category === 'family' && !['yes', 'no'].includes(tea)))
      fail_('incomplete_reply', 'Please choose an answer for each event and each guest.');
    const dietary = str_(answer.dietary), notes = str_(answer.notes);
    if (dietary.length > 300 || notes.length > 1000) fail_('invalid_request', 'Please shorten the dietary information or message and try again.');
    return {id: member.id, name: member.name, group: roster.group, attending: answer.attending, tea,
      dietary: answer.attending === 'yes' || tea === 'yes' ? dietary : '', notes};
  });
  const sheet = responses_(ss, false), events = log_(sheet), state = prior_(roster, events);
  const fingerprint = hash_(JSON.stringify({code: roster.code, members: members.slice().sort((a, b) => a.id.localeCompare(b.id))}));
  const existing = events.find(event => event.requestId === payload.requestId);
  if (existing) {
    if (existing.code !== roster.code || existing.fingerprint !== fingerprint) fail_('invalid_request', 'Please reload your invitation before replying again.');
    if (state.revision !== existing.requestId) fail_('conflict', 'Another reply was saved for your invitation. Reload it before making changes.');
    try { rebuildReplies_(ss); } catch (error) { console.error('Reply saved; visible view needs refresh: ' + error.message); }
    return {status: 'saved', revision: state.revision, prior: state.prior};
  }
  if (str_(payload.revision) !== state.revision) fail_('conflict', 'Another reply was saved for your invitation. Reload it before making changes.');
  const event = {requestId: payload.requestId, code: roster.code, submittedAt: new Date().toISOString(), sequence: events.length + 1, fingerprint, members};
  const snapshot = JSON.stringify(event);
  if (snapshot.length > 45000) fail_('invalid_request', 'Please shorten the messages on this reply and try again.');
  // Commit one complete snapshot before rebuilding the visible, replaceable latest-replies view.
  sheet.getRange(events.length + 2, 14, 1, 5).setValues([[event.requestId, event.code, event.submittedAt, snapshot, event.sequence]]);
  SpreadsheetApp.flush();
  try { rebuildReplies_(ss); } catch (error) { console.error('Reply saved; visible view needs refresh: ' + error.message); }
  const saved = prior_(roster, events.concat(event));
  return {status: 'saved', revision: saved.revision, prior: saved.prior};
}
function cell_(value) { const text = str_(value); return /^[=+@\-\t\r\n]/.test(text) ? "'" + text : text; }
function rebuildReplies_(ss) {
  const source = source_(ss), sheet = responses_(ss, false), events = log_(sheet), latest = new Map();
  events.forEach(event => event.members.forEach(member => latest.set(event.code + '|' + member.id, Object.assign({code: event.code, submittedAt: event.submittedAt}, member))));
  const output = [], visited = new Set();
  source.rows.filter(row => yes_(row[6]) && str_(row[1]) && code_(row[0])).forEach(row => {
    const code = str_(row[0]);
    if (visited.has(code)) return;
    visited.add(code);
    let roster;
    try { roster = roster_(ss, code, source); } catch (error) { return; }
    roster.members.forEach(member => {
      const answer = latest.get(code + '|' + member.id);
      if (answer) output.push([member.name, roster.group, answer.attending === 'yes' ? 'Yes' : 'No',
        answer.tea ? answer.tea === 'yes' ? 'Yes' : 'No' : '', answer.dietary, answer.notes,
        answer.submittedAt, code, member.id].map(cell_));
    });
  });
  const previous = Math.max(0, sheet.getLastRow() - 1), height = Math.max(previous, output.length);
  if (height) sheet.getRange(2, 1, height, RESPONSE_HEADERS.length).setValues(Array.from({length: height}, (_, index) => output[index] || Array(RESPONSE_HEADERS.length).fill('')));
}
