const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'dist');
const marker = path.join(out, '.wedding-build');
if (fs.existsSync(out)) {
  if (fs.lstatSync(out).isSymbolicLink() || !fs.existsSync(marker)) {
    throw new Error('dist already exists without a wedding build marker. Rename it before building.');
  }
  fs.rmSync(out, {recursive: true});
}
fs.mkdirSync(out);
fs.writeFileSync(marker, 'Generated public wedding site.');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
if (/fetch\(['"]guestlist\.json/.test(html)) throw new Error('Public guest-list fallback is forbidden.');
fs.writeFileSync(path.join(out, 'index.html'), html);
fs.writeFileSync(path.join(out, '.nojekyll'), '');
const assets = new Set([...html.matchAll(/assets\/[a-z0-9_./-]+\.(?:png|jpe?g|webp|svg|woff2?)/gi)].map(m => m[0]));
assets.add('assets/icons/LUCIDE-LICENSE.txt');
let copied = 0;
for (const relative of assets) {
  const file = path.resolve(root, relative);
  if (!fs.existsSync(file) && relative === 'assets/photos/sentosa-qr.png') continue;
  if (!fs.realpathSync(file).startsWith(path.join(root, 'assets') + path.sep) || !fs.statSync(file).isFile()) {
    throw new Error('Invalid public asset: ' + relative);
  }
  const destination = path.join(out, relative);
  fs.mkdirSync(path.dirname(destination), {recursive: true});
  fs.copyFileSync(file, destination);
  copied++;
}
console.log(`Public build ready in dist: index.html and ${copied} assets. No guest list, backend, drafts or backups included.`);
