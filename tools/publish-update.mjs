// Rolls out a new version to every computer running the auto-updater.
//   1. Bump "version" in Canvas Grades Extension/manifest.json
//   2. node tools/publish-update.mjs
// The zip is signed with ~/.canvas-grades/release-key.pem (keep it private, back it up) and attached to one
// "release message" that the webhook edits in place. The first run creates that message and writes its URL into
// release-url.txt; install that copy on each computer once, then they update themselves.
import {readFileSync, writeFileSync, readdirSync, mkdtempSync} from 'node:fs';
import {join} from 'node:path';
import {homedir, tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createSign} from 'node:crypto';

const ext = fileURLToPath(new URL('../Canvas Grades Extension/', import.meta.url));
const key = readFileSync(process.env.CANVAS_GRADES_KEY || join(homedir(), '.canvas-grades', 'release-key.pem'));
const {version} = JSON.parse(readFileSync(join(ext, 'manifest.json'), 'utf8'));
const webhook = process.env.CANVAS_GRADES_WEBHOOK || readFileSync(join(ext, 'defaults.js'), 'utf8').match(/"webhook": "([^"]+)"/)[1];
async function discord(method, url, form) {
  const res = await fetch(url, {method, body: form});
  if (!res.ok) throw new Error(`Discord ${method} returned ${res.status}: ${await res.text()}`);
  return res.json();
}
const payload = content => { const form = new FormData(); form.append('payload_json', JSON.stringify(content)); return form; };

const urlFile = join(ext, 'release-url.txt');
let releaseUrl = readFileSync(urlFile, 'utf8').trim();
if (!releaseUrl) {
  const {id} = await discord('POST', `${webhook}?wait=true`, payload({content: 'Canvas Grades release channel (setting up)'}));
  releaseUrl = `${webhook}/messages/${id}`;
  writeFileSync(urlFile, releaseUrl + '\n');
  console.log(`Created release message: ${releaseUrl}`);
}

const zipName = `canvas-grades-${version}.zip`;
const zipPath = join(mkdtempSync(join(tmpdir(), 'canvas-grades-')), zipName);
if (process.platform === 'linux') execFileSync('zip', ['-qr', zipPath, '.'], {cwd: ext});
else execFileSync(process.platform === 'win32' ? 'C:\\Windows\\System32\\tar.exe' : 'tar', ['-a', '-c', '-f', zipPath, ...readdirSync(ext)], {cwd: ext});
const zip = readFileSync(zipPath);
const sig = createSign('sha256').update(zip).sign(key, 'base64');

const form = payload({
  content: `📦 **Canvas Grades extension v${version}** (auto-update channel, please don't delete this message)\n` +
    'New computer: download the zip, extract it, run `powershell -ExecutionPolicy Bypass -File update.ps1 -Install` (Windows) or `sh update.sh --install` (Mac/Linux), then Load unpacked the folder it opens.',
  attachments: [{id: 0, filename: zipName}, {id: 1, filename: `${zipName}.sig`}],
  allowed_mentions: {parse: []},
});
form.append('files[0]', new Blob([zip]), zipName);
form.append('files[1]', new Blob([sig]), `${zipName}.sig`);
await discord('PATCH', releaseUrl, form);
console.log(`Published v${version} (${zip.length} bytes). Computers with the updater install it within the hour.`);
