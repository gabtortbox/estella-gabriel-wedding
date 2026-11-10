const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
const rsvp = html.slice(html.indexOf('<section id="rsvp"'), html.indexOf('<!-- DIRECTIONS -->'));

test('the personalised welcome precedes the invitation heading and practical notes', () => {
  const greeting = rsvp.indexOf('id="inviteGreeting"');
  assert.ok(greeting > 0);
  assert.ok(greeting < rsvp.indexOf('<h2'));
  assert.ok(rsvp.indexOf('id="memberList"') < rsvp.indexOf('An adults-only celebration.'));
  assert.ok(rsvp.indexOf('</form>') < rsvp.indexOf('An adults-only celebration.'));
  assert.ok(rsvp.indexOf('id="rsvpSubmit"') < rsvp.indexOf('You can return to this same link'));
  assert.equal((rsvp.match(/id="inviteGreeting"/g) || []).length, 1);
  assert.equal((rsvp.match(/id="inviteWho"/g) || []).length, 1);
});

test('the FAQ separates family arrival, other guests and the seating deadline', () => {
  const answer = html.match(/When should I arrive\?<\/div>\s*<div class="faq-answer">([\s\S]*?)<\/div>/)[1];
  assert.match(answer, /Family, please arrive by <strong>5\.30 pm<\/strong> for the tea ceremony/);
  assert.match(answer, /All other guests are welcome from <strong>6 pm<\/strong>/);
  assert.match(answer, /<strong>Everyone should be SEATED by 6\.30 pm\.<\/strong>/);
  assert.match(answer, /not the time to arrive at the venue/);
});

test('dress guidance welcomes existing outfits without changing the event style', () => {
  assert.equal((html.match(/There's no need to buy a new outfit for us\./g) || []).length, 2);
  assert.ok(html.includes('Something you already own and feel comfortable in is absolutely welcome.'));
  assert.match(html, /<h2 class="section-title[^\"]*">Formal but Funky<\/h2>/);
  assert.ok(html.includes("colours, depending on our florals (we'll confirm closer to the day)"));
});

test('drinks FAQ confirms free corkage for duty-paid wines and spirits', () => {
  const answer = html.match(/Will there be drinks\?<\/div>\s*<div class="faq-answer">([\s\S]*?)<\/div>/)[1];
  assert.match(answer, /<strong>free corkage for DUTY PAID wines and spirits<\/strong>/);
  assert.doesNotMatch(answer, /to be confirmed/);
});

test('named seats are explained politely without offering additional guests', () => {
  const answer = html.match(/Can I bring a \+1\?<\/div>\s*<div class="faq-answer">([\s\S]*?)<\/div>/)[1];
  assert.match(answer, /We're unable to accommodate additional guests/);
  assert.doesNotMatch(answer, /special circumstance|reach out|do our best/);
  assert.ok(rsvp.indexOf('</form>') < rsvp.indexOf('Seats reserved with love.'));
  assert.match(rsvp, /Our invitation is for the guests named on this RSVP/);
  assert.match(rsvp, /We've planned the evening with our grown-up loved ones in mind/);
});

test('family tea starts at 5.30 pm without solemnisation and original RSVP controls remain present', () => {
  assert.match(html, /5\.30 pm<\/p>\s*<p class="h-item-event">Tea Ceremony/);
  assert.doesNotMatch(html, /<p class="h-item-event">Solemnisation|<span class="event-block-title">Solemnisation/);
  for (const id of ['rsvpForm', 'rsvpSavedBanner', 'rsvpReturningNote', 'rsvpCalendar', 'memberList', 'rsvpSubmit']) {
    assert.equal((rsvp.match(new RegExp(`id="${id}"`, 'g')) || []).length, 1);
  }
  assert.ok(!html.includes('reply-slip.css'));
});

test('schedule and calendar notes consistently anchor seating at 6.30 pm', () => {
  assert.match(html, /<p class="h-item-time">6\.30 pm<\/p>\s*<p class="h-item-event">Take your seats<\/p>\s*<p class="h-item-desc">Please be seated by 6\.30 pm so everyone is settled for our walk-in\.<\/p>/);
  assert.equal((html.match(/detail: '[^']*Please be seated by 6\.30pm so everyone is settled for our walk-in\.'/g) || []).length, 2);
  assert.doesNotMatch(html, /Do not be late!|be seated by 6\.45pm|SEATED by 6\.45 pm/);
});

test('the party starts at 9 pm in the shared family and friends schedule', () => {
  assert.match(html, /<p class="h-item-time">9 pm<\/p>\s*<p class="h-item-event">The Fun Begins<\/p>/);
  assert.equal((html.match(/class="h-item h-item-party reveal"/g) || []).length, 1);
  assert.doesNotMatch(html, /8\.30 pm|8\.30pm/);
  assert.match(html, /class="h-item h-item-party reveal" style="--item:2">/);
});

test('the illustrated schedule retains both invitation sequences without the numbered programme', () => {
  const schedule = html.slice(html.indexOf('id="schedule"'), html.indexOf('<!-- RSVP -->'));
  assert.equal((schedule.match(/class="h-item-icon"/g) || []).length, 5);
  assert.equal((schedule.match(/data-audience="family"/g) || []).length, 1);
  assert.equal((schedule.match(/data-hide-for-family/g) || []).length, 1);
  assert.ok(schedule.includes('class="section-divider center"'));
  assert.doesNotMatch(html, /evening-chapter|schedule-date/);
});

test('family calendar notes use the 5.30 pm tea ceremony start for current and legacy invitations', () => {
  const calendar = html.slice(html.indexOf('    const WEDDING_END ='), html.indexOf('    function revealCalendar('));
  const context = vm.createContext({CURRENT_HOUSEHOLD: null, URLSearchParams});
  vm.runInContext(calendar, context);
  for (const events of [['tea', 'ceremony'], ['solem', 'tea', 'ceremony']]) {
    context.CURRENT_HOUSEHOLD = {code: 'fictional-family', events};
    assert.match(context.buildIcs(), /DTSTART:20270711T093000Z/);
    assert.match(context.buildIcs(), /DESCRIPTION:Tea ceremony 5\.30pm\./);
    const link = new URL(context.googleCalendarUrl());
    assert.match(link.searchParams.get('details'), /^Tea ceremony 5\.30pm\./);
    assert.doesNotMatch(link.searchParams.get('details'), /Solemnisation|tea ceremony 6pm/i);
  }
  context.CURRENT_HOUSEHOLD = {events: ['ceremony']};
  assert.match(context.buildIcs(), /DTSTART:20270711T100000Z/);
  assert.match(context.buildIcs(), /DESCRIPTION:Arrival from 6pm\./);
});

test('refreshed directions retain route maps, practical notes and the original branding', () => {
  const directions = html.slice(html.indexOf('<!-- DIRECTIONS -->'), html.indexOf('<!-- FAQ -->'));
  const heading = directions.slice(0, directions.indexOf('<!-- QR code for Sentosa entry -->'));
  assert.doesNotMatch(heading, /Oasia Resort Sentosa|directions-destination/);
  assert.ok(heading.includes('class="guests-header reveal"'));
  assert.equal((directions.match(/src="https:\/\/www\.google\.com\/maps\/embed\?pb=/g) || []).length, 4);
  for (const route of ['dir-car', 'dir-taxi', 'dir-mrt', 'car-valet', 'car-selfpark']) assert.ok(directions.includes(`id="${route}"`));
  for (const icon of ['car-front', 'car-taxi-front', 'tram-front']) assert.ok(directions.includes(`data-icon="${icon}"`));
  assert.ok(directions.includes('first come, first served'));
  assert.ok(directions.includes('Imbiah Station'));
  assert.ok(html.includes('assets/photos/logo.jpeg'));
  assert.ok(fs.existsSync(path.resolve(__dirname, '../assets/icons/LUCIDE-LICENSE.txt')));
});

test('every original inline script remains valid JavaScript', () => {
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
  assert.ok(scripts.length > 0);
  for (const match of scripts) new vm.Script(match[1]);
});
