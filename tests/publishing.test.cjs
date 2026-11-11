const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

test('the public website never fetches a bundled guest list or stores invitation data locally', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.doesNotMatch(html, /fetch\(['"]guestlist\.json/);
  const rsvp = html.slice(html.indexOf('    const RSVP_ENDPOINT ='), html.indexOf('    // ── ADD TO CALENDAR'));
  assert.equal(/localStorage\.setItem|sessionStorage\.setItem/.test(rsvp), false);
  assert.match(html, /result\.protocol === 3/);
});
test('publishing uses an explicit public build and ignores local private backups', () => {
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/pages.yml'), 'utf8');
  const build = fs.readFileSync(path.join(root, 'scripts/build-site.cjs'), 'utf8');
  assert.match(workflow, /path: dist/);
  assert.match(workflow, /node --test tests\/\*\.test\.cjs/);
  assert.match(build, /assets\.add\('assets\/icons\/LUCIDE-LICENSE\.txt'\)/);
  assert.ok(fs.readFileSync(path.join(root, '.gitignore'), 'utf8').includes('.private-rsvp/'));
});
