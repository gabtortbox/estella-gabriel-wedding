const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'github-upload');
const marker = path.join(output, '.wedding-upload');
if (fs.existsSync(output)) {
  if (fs.lstatSync(output).isSymbolicLink() || !fs.existsSync(marker)) {
    throw new Error('github-upload exists without an upload marker. Rename it before preparing a package.');
  }
  fs.rmSync(output, {recursive: true});
}
execFileSync(process.execPath, [path.join(__dirname, 'build-site.cjs')], {stdio: 'inherit'});
const upload = path.join(output, 'UPLOAD-THESE-CONTENTS');
fs.mkdirSync(upload, {recursive: true});
fs.writeFileSync(marker, 'Generated wedding upload package.');
const manifest = [];

function copy(relative, from = root) {
  const source = path.join(from, relative);
  if (!fs.lstatSync(source).isFile() || !fs.realpathSync(source).startsWith(root + path.sep)) {
    throw new Error('Refusing to package a symlink or non-project file: ' + relative);
  }
  const content = fs.readFileSync(source);
  if (content.length > 25 * 1024 * 1024) throw new Error('File exceeds the GitHub browser upload limit: ' + relative);
  const destination = path.join(upload, relative);
  fs.mkdirSync(path.dirname(destination), {recursive: true});
  fs.copyFileSync(source, destination);
  manifest.push({path: relative, bytes: content.length, sha256: crypto.createHash('sha256').update(content).digest('hex')});
}
function walkAssets(directory, relative = 'assets') {
  for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
    const next = relative + '/' + entry.name;
    if (entry.isDirectory()) walkAssets(path.join(directory, entry.name), next);
    else if (entry.isFile()) copy(next, path.join(root, 'dist'));
    else throw new Error('Unexpected public asset type: ' + next);
  }
}

copy('index.html', path.join(root, 'dist'));
walkAssets(path.join(root, 'dist/assets'));
for (const relative of ['README.md', 'RSVP-SETUP.md', 'TEST-TAB-GUIDE.md', 'GITHUB-UPLOAD.md', 'LAUNCH-CHECKLIST.md', 'rsvp-handler.gs', '.gitignore',
  '.github/workflows/pages.yml', 'scripts/build-site.cjs', 'scripts/preview-rsvp.cjs', 'scripts/prepare-github-upload.cjs',
  'tests/dresscode-colours.test.cjs', 'tests/guest-experience.test.cjs', 'tests/saved-reply.test.cjs',
  'tests/rsvp-simple.test.cjs', 'tests/rsvp-timestamps.test.cjs', 'tests/rsvp-environments.test.cjs', 'tests/publishing.test.cjs', 'tests/github-upload.test.cjs', 'tests/helpers/rsvp-gateway.cjs']) copy(relative);
manifest.sort((a, b) => a.path.localeCompare(b.path));
if (manifest.length > 100) throw new Error('Package exceeds the 100-file browser upload limit. Split the upload before proceeding.');
if (manifest.some(file => /(?:^|\/)(?:guestlist\.json|\.private-rsvp|\.DS_Store|drafts|github-upload|dist)(?:\/|$)/.test(file.path))) {
  throw new Error('Private or generated content entered the upload package.');
}
const total = manifest.reduce((sum, file) => sum + file.bytes, 0);
const heading = `Prepared ${manifest.length} files, ${(total / 1024 / 1024).toFixed(2)} MiB total. Each file is below 25 MiB.\n\n`;
fs.writeFileSync(path.join(output, 'START-HERE.txt'), heading + fs.readFileSync(path.join(root, 'GITHUB-UPLOAD.md'), 'utf8'));
fs.writeFileSync(path.join(output, 'FILE-MANIFEST.json'), JSON.stringify({fileCount: manifest.length, totalBytes: total, files: manifest}, null, 2) + '\n');
console.log(`Ready: ${upload}\n${heading.trim()}\nUpload the CONTENTS, including .github and .gitignore, not the enclosing folder.`);
