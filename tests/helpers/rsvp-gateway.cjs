const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const source = fs.readFileSync(path.resolve(__dirname, '../../rsvp-handler.gs'), 'utf8');

let nextSheetId = 0;
function sheet(name, initial = [], tabs) {
  const id = ++nextSheetId;
  const tab = {name, rows: initial.map(row => [...row]), writes: [], hidden: [], fail: null,
    getName: () => tab.name, getSheetId: () => id, getLastRow: () => tab.rows.length,
    setName(value) { tabs?.delete(tab.name); tab.name = value; tabs?.set(value, tab); },
    getDataRange: () => ({getValues: () => tab.rows.length ? tab.rows.map(row => [...row]) : [['']]}),
    setFrozenRows() {}, hideColumns(column, count = 1) { tab.hidden.push([column, count]); },
    getRangeList(cells) { return {clearContent() { cells.forEach(cell => { const match = cell.match(/^B(\d+)$/); if (!match) throw new Error(cell); tab.getRange(+match[1], 2).setValue(''); }); }}; },
    getRange(row, column = 1, height = 1, width = 1) {
      const range = {getSheet: () => tab, getRow: () => row, getNumRows: () => height, getColumn: () => column, getNumColumns: () => width,
        getValue: () => tab.rows[row - 1]?.[column - 1] ?? '',
        getValues: () => Array.from({length: height}, (_, y) => Array.from({length: width}, (_, x) => tab.rows[row + y - 1]?.[column + x - 1] ?? '')),
        setValue(value) { return range.setValues([[value]]); },
        setValues(values) {
          if (tab.fail === 'write' || tab.fail === 'cache' && column === 1) throw new Error('Simulated write failure');
          tab.writes.push({row, column, values: values.map(r => [...r])});
          values.forEach((r, y) => r.forEach((value, x) => {
            tab.rows[row + y - 1] ||= [];
            tab.rows[row + y - 1][column + x - 1] = value;
          }));
          if (tab.fail === 'after-write') { tab.fail = null; throw new Error('Connection lost after commit'); }
          return range;
        }};
      return range;
    }};
  return tab;
}
const headers = ['URL Code (do not edit)', 'RSVP Group', 'Whose side?', 'Category', 'Relationship', 'Name',
  'Invite Intent', 'Save the Date Sent Out?', 'RSVP Sent Out?', 'RSVP', 'Table', 'Driving'];
const guests = [
  ['old123', 10, 'Gabriel', 'Friends', 'Uni friend', 'Alex Tan', 'Yes', 'Manual H', 'No', 'Manual J', 'Table 1', ''],
  ['old123', 10, 'Gabriel', 'Friends', 'Uni friend', 'Jamie Lim', 'Yes', '', 'No', '', 'Table 1', ''],
  ['fam123', 20, 'Estella', 'Family', 'Sibling', 'Sam Lee', 'Yes', '', 'No', '', 'VIP', ''],
  ['old123', 10, 'Gabriel', 'Friends', 'Not invited', 'Pat Teo', 'No', 'Manual H', 'No', 'Manual J', 'Manual K', '']
];
function gateway(options = {}) {
  const tabs = new Map(), alerts = [], toasts = [], errors = [], menu = [];
  tabs.set('Guestlist', sheet('Guestlist', options.guestRows || [headers, ...guests], tabs));
  if (options.responseRows) tabs.set('RSVP Responses', sheet('RSVP Responses', options.responseRows, tabs));
  let counter = 0, locked = false;
  const properties = new Map();
  const ss = {getId: () => 'fictional-spreadsheet', getSheetByName: name => tabs.get(name) || null,
    insertSheet: name => { const tab = sheet(name, [], tabs); tabs.set(name, tab); return tab; }, toast: (...args) => toasts.push(args)};
  const ui = {alert: value => alerts.push(value), createMenu(name) { menu.push(name); return {addItem(label, handler) { menu.push([label, handler]); return this; }, addToUi() {}}; }};
  const NativeDate = Date;
  class TestDate extends NativeDate { constructor(...args) { super(...(args.length ? args : ['2026-11-11T12:00:00Z'])); } static now() { return +new TestDate(); } }
  const context = vm.createContext({Date: TestDate,
    PropertiesService: {getScriptProperties: () => ({getProperty: key => properties.get(key), getProperties: () => Object.fromEntries(properties),
      setProperty: (key, value) => properties.set(key, value), setProperties: values => Object.entries(values).forEach(([key, value]) => properties.set(key, value))})},
    SpreadsheetApp: {getActiveSpreadsheet: () => ss, openById: id => { if (id !== ss.getId()) throw new Error('wrong spreadsheet'); return ss; }, getUi: () => ui, flush() {}},
    LockService: {getScriptLock: () => ({tryLock: () => { if (locked || context.busy) return false; locked = true; return true; }, releaseLock: () => { locked = false; }})},
    Utilities: {getUuid: () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`,
      DigestAlgorithm: {SHA_256: 'sha256'}, Charset: {UTF_8: 'utf8'}, computeDigest: (algorithm, value) => [...crypto.createHash(algorithm).update(value).digest()]},
    console: {error: value => errors.push(value)}});
  vm.runInContext(source, context);
  context.json_ = value => value;
  const api = body => JSON.parse(JSON.stringify(context.doPost({postData: {contents: JSON.stringify({protocol: 3, ...body})}})));
  const lookup = code => api({action: 'lookup', code});
  const get = name => tabs.get(name);
  const code = group => get('Guestlist').rows.find(row => String(row[1]) === String(group))?.[0];
  const payload = (invite = code(10), attending = 'yes') => {
    const result = lookup(invite);
    if (!result.ok) throw new Error(JSON.stringify(result));
    return {code: invite, revision: result.household.revision, rosterVersion: result.household.rosterVersion,
      requestId: crypto.randomUUID(), members: result.household.members.map(m => ({...m, attending,
        tea: result.household.events.includes('tea') ? attending : '', dietary: '', notes: ''}))};
  };
  const submit = value => api({action: 'submit', payload: value});
  const master = (row, field, value) => { const tab = get('Guestlist'); const index = tab.rows[0].indexOf(field); if (index < 0) throw new Error(field); tab.rows[row - 1][index] = value; };
  const setup = () => { const before = alerts.length; context.updateInvitationCodes(); if (alerts.length > before) throw new Error(alerts.at(-1)); };
  const edit = (row, column, count = 1, width = 1, tab = get('Guestlist')) => context.onEdit({source: ss, range: tab.getRange(row, column, count, width)});
  if (options.setup !== false) setup();
  return {context, api, lookup, payload, submit, tabs, get, ss, alerts, toasts, errors, menu, setup, master, edit, code, properties,
    history: () => JSON.parse(JSON.stringify(context.log_(get('RSVP Responses')))), locked: () => locked};
}
module.exports = {gateway, sheet, headers, guests};
