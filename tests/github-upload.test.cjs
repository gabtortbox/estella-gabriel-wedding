const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');

const root = path.resolve(__dirname, '..');
test('the drag-and-drop package contains only allowlisted files with intact contents and main publishing', () => {
  execFileSync(process.execPath, [path.join(root, 'scripts/prepare-github-upload.cjs')]);
  const directory = path.join(root, 'github-upload');
  const upload = path.join(directory, 'UPLOAD-THESE-CONTENTS');
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'FILE-MANIFEST.json'), 'utf8'));
  assert.ok(manifest.fileCount > 40 && manifest.fileCount <= 100);
  assert.equal(manifest.files.length, manifest.fileCount);
  for (const file of manifest.files) {
    assert.ok(file.bytes <= 25 * 1024 * 1024);
    assert.ok(!/(?:guestlist\.json|\.private-rsvp|\.DS_Store|drafts\/|dist\/|github-upload\/)/.test(file.path));
    const content = fs.readFileSync(path.join(upload, file.path));
    assert.equal(crypto.createHash('sha256').update(content).digest('hex'), file.sha256);
    assert.deepEqual(content, fs.readFileSync(path.join(root, file.path)));
  }
  assert.match(fs.readFileSync(path.join(upload, '.github/workflows/pages.yml'), 'utf8'), /branches: \[main\]/);
  assert.ok(fs.existsSync(path.join(upload, 'tests/helpers/rsvp-gateway.cjs')));
  assert.ok(fs.existsSync(path.join(upload, 'assets/photos/optimized/Us1.jpeg')));
  assert.ok(!fs.existsSync(path.join(upload, 'START-HERE.txt')));
  assert.match(fs.readFileSync(path.join(directory, 'START-HERE.txt'), 'utf8'), /Uploads overwrite matching paths but do not remove old files/);
  assert.ok(fs.readFileSync(path.join(root, '.gitignore'), 'utf8').includes('github-upload/'));
});
