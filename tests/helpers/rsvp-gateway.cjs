const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const source = fs.readFileSync(path.resolve(__dirname, '../../rsvp-handler.gs'), 'utf8');

function sheet(name, initial = []) {
  const tab = {name, rows: initial.map(row => [...row]), writes: [], hidden: [], fail: null,
    getName: () => name, getLastRow: () => tab.rows.length, getMaxRows: () => Math.max(1000, tab.rows.length),
    getDataRange: () => ({getValues: () => tab.rows.length ? tab.rows.map(row => [...row]) : [['']]}),
    setFrozenRows() {}, hideColumns(column) { tab.hidden.push(column); },
    clearContents() { if (tab.fail === 'clear') throw new Error('Simulated cache failure'); tab.rows = []; },
    getRange(row, column = 1, height = 1, width = 1) {
      const range = {getSheet: () => tab, getRow: () => row, getNumRows: () => height,
        getValue: () => tab.rows[row - 1]?.[column - 1] ?? '', setDataValidation() {},
        getValues: () => Array.from({length: height}, (_, y) => Array.from({length: width}, (_, x) => tab.rows[row + y - 1]?.[column + x - 1] ?? '')),
        setValue(value) { return range.setValues([[value]]); },
        setValues(values) {
          if (tab.fail === 'write') throw new Error('Simulated write failure');
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
  ['old123', 10, 'Gabriel', 'Friends', 'Uni friend', 'Alex Tan', 'Yes', '', 'Yes', '', 'Table 1', ''],
  ['old123', 10, 'Gabriel', 'Friends', 'Uni friend', 'Jamie Lim', 'Yes', '', 'Yes', '', 'Table 1', ''],
  ['fam123', 20, 'Estella', 'Family', 'Sibling', 'Sam Lee', 'Yes', '', 'Yes', '', 'VIP', ''],
  ['old123', 10, 'Gabriel', 'Friends', 'Not invited', 'Pat Teo', 'No', '', '', '', '', '']
];
function gateway(options = {}) {
  const tabs = new Map(), alerts = [], prompts = [], errors = [];
  tabs.set('Guestlist', sheet('Guestlist', options.guestRows || [headers, ...guests]));
  if (options.responseRows) tabs.set('RSVP Responses', sheet('RSVP Responses', options.responseRows));
  let active = tabs.get('Guestlist').getRange(2, 1), counter = 0, locked = false;
  const properties = new Map();
  const ss = {getId: () => 'fictional-spreadsheet', getSheetByName: name => tabs.get(name) || null,
    insertSheet: name => { const tab = sheet(name); tabs.set(name, tab); return tab; }, getActiveRange: () => active};
  const ui = {Button: {OK: 'OK', YES: 'YES'}, ButtonSet: {OK_CANCEL: 1, YES_NO: 2},
    alert: (...args) => { alerts.push(args.join(' ')); return 'YES'; },
    prompt: () => { const value = prompts.shift(); return {getSelectedButton: () => value === null ? 'CANCEL' : 'OK', getResponseText: () => value}; }};
  const NativeDate = Date;
  class TestDate extends NativeDate { constructor(...args) { super(...(args.length ? args : ['2026-11-08T12:00:00Z'])); } static now() { return +new TestDate(); } }
  const context = vm.createContext({Date: TestDate,
    PropertiesService: {getScriptProperties: () => ({getProperty: key => properties.get(key), setProperty: (key, value) => properties.set(key, value), deleteProperty: key => properties.delete(key)})},
    SpreadsheetApp: {getActiveSpreadsheet: () => ss, getUi: () => ui, flush() {}, newDataValidation: () => ({requireValueInList() { return this; }, setAllowInvalid() { return this; }, build() { return {}; }})},
    LockService: {getScriptLock: () => ({tryLock: () => { if (locked || context.busy) return false; locked = true; return true; }, releaseLock: () => { locked = false; }})},
    Utilities: {getUuid: () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`,
      DigestAlgorithm: {SHA_256: 'sha256'}, Charset: {UTF_8: 'utf8'}, computeDigest: (algorithm, value) => [...crypto.createHash(algorithm).update(value).digest()]},
    console: {error: value => errors.push(value)}});
  vm.runInContext(source, context);
  context.jsonOut = value => value;
  const config = vm.runInContext('RSVP_CONFIG', context);
  const api = body => JSON.parse(JSON.stringify(context.doPost({postData: {contents: JSON.stringify(body)}})));
  const lookup = code => api({action: 'lookup', code});
  const payload = (code = 'old123', attending = 'yes') => {
    const result = lookup(code);
    if (!result.ok) throw new Error(JSON.stringify(result));
    return {code, revision: result.household.revision, rosterVersion: result.household.rosterVersion,
      requestId: crypto.randomUUID(), members: result.household.members.map(m => ({...m, attending,
        tea: result.household.events.includes('tea') ? attending : '', dietary: '', notes: ''}))};
  };
  const submit = value => api({action: 'submit', payload: value});
  const get = name => tabs.get(name);
  const master = (row, field, value) => { const tab = get('Guestlist'); const index = tab.rows[0].indexOf(field); if (index < 0) throw new Error(field); tab.rows[row - 1][index] = value; };
  const select = (name, row, count = 1) => { active = get(name).getRange(row, 1, count, 1); };
  const setup = () => { const before = alerts.length; context.setupRsvp(); if (!alerts.at(-1)?.startsWith('Setup complete')) throw new Error(alerts.slice(before).join('\n')); };
  if (options.setup !== false) setup();
  return {context, config, api, lookup, payload, submit, tabs, get, ss, alerts, prompts, errors, setup, master, select,
    history: () => context.readHistory(ss), locked: () => locked};
}
module.exports = {gateway, sheet, headers, guests};
