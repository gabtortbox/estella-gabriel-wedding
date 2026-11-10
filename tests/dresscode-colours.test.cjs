const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
const source = html.slice(html.indexOf('(function initDressColours()'), html.indexOf('// \u2500\u2500 ADD TO CALENDAR'));
const names = ['dress', 'heels', 'bag', 'jacket', 'trousers', 'shirt', 'shoes'];

function element(textContent = '', attributes = {}) {
  return {
    textContent, attributes: {...attributes}, events: {}, disabled: false,
    getAttribute(name) { return this.attributes[name] ?? null; },
    setAttribute(name, value) { this.attributes[name] = String(value); },
    addEventListener(name, handler) { this.events[name] = handler; }
  };
}

function harness() {
  const pieces = new Map(names.map(name => [name, element('', {'data-piece': name})]));
  const fabrics = new Map(names.map(name => [name, element('', {'data-fabric-piece': name})]));
  const swatches = [...html.matchAll(/class="swatch" data-tint="([^"]+)"[\s\S]*?<span class="swatch-name">([^<]+)<\/span>/g)]
    .map(([, tint, label]) => element(label, {'data-tint': tint}));
  const palette = element();
  palette.querySelectorAll = () => swatches;
  const target = element();
  const looks = {};
  const panels = Object.entries({her: ['dress', 'heels', 'bag'], his: ['jacket', 'trousers', 'shirt', 'shoes']}).map(([name, options]) => {
    const select = element();
    select.value = options[0];
    select.options = options.map(name => ({value: name, textContent: name[0].toUpperCase() + name.slice(1)}));
    const finish = element();
    finish.value = 'plain';
    const radio = element();
    radio.checked = name === 'her';
    const panel = element('', {'data-look': name});
    panel.querySelector = selector => ({'[data-look-select]': radio, '[data-piece-select]': select, '[data-finish-select]': finish})[selector];
    looks[name] = {select, finish, radio, panel};
    return panel;
  });
  const reset = element();
  const status = element();
  const wrap = {querySelectorAll: selector => [...(selector === '[data-piece]' ? pieces : fabrics).values()]};
  const nodes = {dresscodeReset: reset, dresscodeColourStatus: status, dresscodeSwatches: palette, dresscodeColourTarget: target};
  const document = {
    getElementById: id => nodes[id],
    querySelector: () => wrap,
    querySelectorAll: () => panels
  };
  vm.runInNewContext(source, {document});
  return {
    pieces, fabrics, looks, reset, status, swatches, palette, target,
    choose(name, look = ['dress', 'heels', 'bag'].includes(name) ? 'her' : 'his') { looks[look].select.value = name; looks[look].select.events.change(); },
    paint(label) { swatches.find(swatch => swatch.textContent === label).events.click(); },
    finish(value, look = 'her') { looks[look].finish.value = value; looks[look].finish.events.change(); },
    activate(look) { looks[look].radio.checked = true; looks[look].radio.events.change(); },
    point(look, field = 'select') { looks[look][field].events.pointerdown(); },
    focus(look, field = 'select') { looks[look][field].events.focus?.(); }
  };
}

test('each selectable piece has one independent SVG region and preserves the original illustration', () => {
  const regions = [...html.matchAll(/<g data-piece="([^"]+)"/g)].map(match => match[1]).sort();
  assert.deepEqual(regions, [...names].sort());
  for (const name of names) assert.ok(html.includes(`<option value="${name}">`));
  assert.match(html, /class="dresscode-colours" viewBox="0 0 1280 1024" aria-hidden="true"/);
  assert.ok(html.includes('id="dresscode-shape-heels" mask="url(#dresscode-heel-guard)"'));
  assert.ok(html.includes('src="assets/photos/dresscode-transparent.png"'));
  assert.doesNotMatch(html, /dresscode-(?:garments|light|dark)\.png/);
});

test('a new page starts with original line art and no selected colour', () => {
  const h = harness();
  assert.equal(h.reset.disabled, true);
  for (const piece of h.pieces.values()) {
    assert.equal(piece.getAttribute('fill'), 'transparent');
    assert.equal(piece.getAttribute('color'), 'transparent');
  }
  assert.equal(h.swatches.filter(swatch => swatch.getAttribute('aria-pressed') === 'true').length, 0);
  assert.equal(h.swatches.length, 14);
  assert.equal(h.palette.getAttribute('aria-label'), 'Her outfit, Dress colour');
  assert.equal(h.target.textContent, 'her dress');
  assert.equal(h.looks.her.radio.checked, true);
  assert.equal(h.looks.his.radio.checked, false);
  assert.equal((html.match(/class="dresscode-swatches"/g) || []).length, 1);
  assert.ok(!html.includes('id="dresscodePalette"'));
});

test('changing one garment leaves all other garment colours intact', () => {
  const h = harness();
  h.paint('Pink');
  h.choose('jacket');
  h.paint('Blue');
  h.choose('trousers');
  h.paint('Navy');
  h.choose('shirt');
  h.paint('Ivory');
  assert.equal(h.pieces.get('dress').getAttribute('fill'), '#e86cae');
  assert.equal(h.pieces.get('jacket').getAttribute('fill'), '#4a8fc9');
  assert.equal(h.pieces.get('trousers').getAttribute('fill'), '#273e62');
  assert.equal(h.pieces.get('shirt').getAttribute('fill'), '#f7f2e6');
  assert.equal(h.pieces.get('bag').getAttribute('fill'), 'transparent');
  assert.equal(h.reset.disabled, false);
});

test('teal completes the shared palette and applies to the active piece only', () => {
  const h = harness();
  const labels = h.swatches.map(swatch => swatch.textContent);
  assert.deepEqual(labels.slice(-2), ['Charcoal', 'Teal']);
  h.paint('Teal');
  assert.equal(h.pieces.get('dress').getAttribute('fill'), '#2d918b');
  assert.equal(h.pieces.get('jacket').getAttribute('fill'), 'transparent');
  assert.equal(h.swatches.find(swatch => swatch.textContent === 'Teal').getAttribute('aria-pressed'), 'true');
});

test('switching pieces restores its selected swatch and announces its own colour', () => {
  const h = harness();
  h.paint('Pink');
  h.choose('jacket');
  h.paint('Blue');
  h.choose('dress');
  const selected = h.swatches.filter(swatch => swatch.getAttribute('aria-pressed') === 'true');
  assert.deepEqual(selected.map(swatch => swatch.textContent), ['Pink']);
  assert.equal(h.status.textContent, 'Her outfit, Dress: Pink, plain');
  assert.equal(h.palette.getAttribute('aria-label'), 'Her outfit, Dress colour');
  h.activate('his');
  assert.equal(h.swatches.find(swatch => swatch.textContent === 'Blue').getAttribute('aria-pressed'), 'true');
  assert.equal(h.target.textContent, 'his jacket');
  assert.equal(h.pieces.get('dress').getAttribute('fill'), '#e86cae');
});

test('the active swatch clears only its own piece, including the bag handle', () => {
  const h = harness();
  h.paint('Pink');
  h.choose('bag');
  h.paint('Orange');
  assert.equal(h.pieces.get('bag').getAttribute('color'), '#f2a23a');
  h.paint('Orange');
  assert.equal(h.pieces.get('bag').getAttribute('fill'), 'transparent');
  assert.equal(h.pieces.get('bag').getAttribute('color'), 'transparent');
  assert.equal(h.pieces.get('dress').getAttribute('fill'), '#e86cae');
  assert.equal(h.status.textContent, 'Her outfit, Bag: no colour selected, plain');
});

test('reset restores every piece and the selected-colour controls', () => {
  const h = harness();
  for (const name of names) {
    const look = ['dress', 'heels', 'bag'].includes(name) ? 'her' : 'his';
    h.choose(name);
    h.paint('Green');
    h.finish('dots', look);
  }
  h.reset.events.click();
  for (const piece of h.pieces.values()) assert.equal(piece.getAttribute('fill'), 'transparent');
  assert.equal(h.reset.disabled, true);
  for (const fabric of h.fabrics.values()) assert.equal(fabric.getAttribute('fill'), 'transparent');
  assert.equal(h.swatches.filter(swatch => swatch.getAttribute('aria-pressed') === 'true').length, 0);
  for (const look of Object.values(h.looks)) {
    assert.equal(look.finish.value, 'plain');
  }
  assert.equal(h.status.textContent, 'All outfit colours and finishes cleared');
});

test('unknown pieces and invalid colour values do not change the artwork', () => {
  const h = harness();
  h.looks.her.select.value = 'unknown';
  h.paint('Red');
  h.choose('dress');
  const red = h.swatches.find(swatch => swatch.textContent === 'Red');
  red.setAttribute('data-tint', 'not-a-colour');
  h.paint('Red');
  assert.equal(h.pieces.get('dress').getAttribute('fill'), 'transparent');
  assert.equal(h.reset.disabled, true);
});

test('each outfit selector only offers and changes its own pieces', () => {
  const h = harness();
  h.looks.her.select.value = 'jacket';
  h.paint('Red');
  h.finish('stripes');
  assert.equal(h.pieces.get('jacket').getAttribute('fill'), 'transparent');
  assert.equal(h.fabrics.get('jacket').getAttribute('fill'), 'transparent');
  assert.ok(!html.includes('id="dresscodePiece"'));
  assert.ok(html.includes('aria-label="Her outfit piece"'));
  assert.ok(html.includes('aria-label="His outfit piece"'));
});

test('patterns stay attached to individual pieces and reuse the garment boundaries', () => {
  const h = harness();
  h.paint('Pink');
  h.finish('dots');
  h.choose('jacket');
  h.paint('Blue');
  h.finish('stripes', 'his');
  h.choose('bag');
  assert.equal(h.looks.her.finish.value, 'plain');
  h.choose('dress');
  assert.equal(h.looks.her.finish.value, 'dots');
  assert.equal(h.fabrics.get('dress').getAttribute('fill'), 'url(#dresscode-dots)');
  assert.equal(h.fabrics.get('jacket').getAttribute('fill'), 'url(#dresscode-stripes)');
  assert.equal(h.pieces.get('dress').getAttribute('fill'), '#e86cae');
  assert.equal(h.pieces.get('jacket').getAttribute('fill'), '#4a8fc9');
  for (const name of names) assert.ok(html.includes(`<use href="#dresscode-shape-${name}"`));
});

test('clicking an unchanged dropdown activates its outfit without losing existing colours', () => {
  const h = harness();
  h.paint('Pink');
  h.choose('jacket');
  h.paint('Blue');
  h.point('her');
  assert.equal(h.target.textContent, 'her dress');
  h.paint('Green');
  assert.equal(h.pieces.get('dress').getAttribute('fill'), '#59a96a');
  assert.equal(h.pieces.get('jacket').getAttribute('fill'), '#4a8fc9');
  h.point('his', 'finish');
  assert.equal(h.target.textContent, 'his jacket');
  assert.equal(h.looks.his.radio.checked, true);
  assert.equal(h.looks.her.radio.checked, false);
  assert.equal(h.swatches.find(swatch => swatch.textContent === 'Blue').getAttribute('aria-pressed'), 'true');
});

test('tabbing through inactive outfit controls never changes the shared palette target', () => {
  const h = harness();
  h.paint('Pink');
  h.focus('his');
  h.focus('his', 'finish');
  assert.equal(h.target.textContent, 'her dress');
  h.paint('Green');
  assert.equal(h.pieces.get('dress').getAttribute('fill'), '#59a96a');
  assert.equal(h.pieces.get('jacket').getAttribute('fill'), 'transparent');
  assert.equal(h.looks.her.radio.checked, true);
});

test('plain and invalid finishes never erase colours or affect other pieces', () => {
  const h = harness();
  h.paint('Green');
  h.finish('dots');
  h.finish('invalid');
  assert.equal(h.fabrics.get('dress').getAttribute('fill'), 'url(#dresscode-dots)');
  h.finish('plain');
  assert.equal(h.fabrics.get('dress').getAttribute('fill'), 'transparent');
  assert.equal(h.pieces.get('dress').getAttribute('fill'), '#59a96a');
  const patternOnly = harness();
  patternOnly.finish('dots');
  assert.equal(patternOnly.reset.disabled, false);
});
