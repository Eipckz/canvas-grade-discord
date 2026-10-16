// node tests/updater.test.mjs
// Publishes a signed release to the mock Discord, then checks update.ps1 (Windows) and update.sh install it,
// and that a tampered release is rejected.
import assert from 'node:assert/strict';
import {cpSync, mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync} from 'node:fs';
import {join} from 'node:path';
import {homedir, tmpdir} from 'node:os';
import {generateKeyPairSync} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
// Async on purpose: the mock server lives in this process, so a sync spawn would deadlock.
const exec = (cmd, args, opts) => new Promise(ok => { const p = spawn(cmd, args, opts); let out = ''; p.stdout.on('data', d => out += d); p.stderr.on('data', d => out += d); p.on('close', status => ok({status, out})); });
import {mockServer} from './mock.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const work = mkdtempSync(join(tmpdir(), 'cg-updater-'));
cpSync(join(root, 'Canvas Grades Extension'), join(work, 'Canvas Grades Extension'), {recursive: true});
cpSync(join(root, 'tools'), join(work, 'tools'), {recursive: true});
writeFileSync(join(work, 'Canvas Grades Extension', 'release-url.txt'), '');
const mock = mockServer();
const server = await mock.listen(0);
const base = `http://127.0.0.1:${server.address().port}`;
const env = {...process.env, CANVAS_GRADES_WEBHOOK: `${base}/api/webhooks/1551820992244879371/test-token`};
// No release key on this machine (CI): sign with a throwaway key and swap its public half into the updaters.
if (!process.env.CANVAS_GRADES_KEY && !existsSync(join(homedir(), '.canvas-grades', 'release-key.pem'))) {
  const {privateKey, publicKey} = generateKeyPairSync('rsa', {modulusLength: 3072});
  writeFileSync(env.CANVAS_GRADES_KEY = join(work, 'key.pem'), privateKey.export({type: 'pkcs8', format: 'pem'}));
  const ext = join(work, 'Canvas Grades Extension'), edit = (f, fn) => writeFileSync(join(ext, f), fn(readFileSync(join(ext, f), 'utf8')));
  edit('update.sh', s => s.replace(/-----BEGIN PUBLIC KEY-----[^']*-----END PUBLIC KEY-----/, publicKey.export({type: 'spki', format: 'pem'}).trim()));
  edit('update.ps1', s => s.replace(/\$Modulus = '[^']*'/, `$Modulus = '${Buffer.from(publicKey.export({format: 'jwk'}).n, 'base64url').toString('base64')}'`));
}

const pub = await exec(process.execPath, [join(work, 'tools', 'publish-update.mjs')], {env});
assert.equal(pub.status, 0, pub.out); console.log(pub.out.trim());
const releaseUrl = readFileSync(join(work, 'Canvas Grades Extension', 'release-url.txt'), 'utf8').trim();
assert.match(releaseUrl, /\/messages\/\d+$/);
const version = JSON.parse(readFileSync(join(work, 'Canvas Grades Extension', 'manifest.json'))).version;
assert.deepEqual(mock.state.messages.get(releaseUrl.split('/').pop()).attachments, [`canvas-grades-${version}.zip`, `canvas-grades-${version}.zip.sig`]);

function oldInstall(dir) {
  cpSync(join(work, 'Canvas Grades Extension'), dir, {recursive: true});
  const m = JSON.parse(readFileSync(join(dir, 'manifest.json'))); m.version = '1.0.0';
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(m));
  rmSync(join(dir, 'dashboard.html'));
}
const installed = dir => JSON.parse(readFileSync(join(dir, 'manifest.json'))).version;
const runners = [];
if (process.platform === 'win32') runners.push(['update.ps1', home => {
  const dir = join(home, 'CanvasGrades', 'extension'); oldInstall(dir);
  return exec('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(dir, 'update.ps1')], {env: {...process.env, LOCALAPPDATA: home}}).then(r => [dir, r]);
}]);
runners.push(['update.sh', home => {
  const dir = process.platform === 'darwin' ? join(home, 'Library', 'Application Support', 'CanvasGrades', 'extension') : join(home, 'canvas-grades', 'extension');
  oldInstall(dir);
  return exec('sh', [join(dir, 'update.sh')], {env: {...process.env, HOME: home, XDG_DATA_HOME: home}}).then(r => [dir, r]);
}]);

for (const [name, run] of runners) {
  const [dir, r] = await run(mkdtempSync(join(tmpdir(), 'cg-home-')));
  assert.equal(r.status, 0, `${name}: ${r.out}`);
  assert.equal(installed(dir), version, `${name} installs the signed release`);
  assert.ok(existsSync(join(dir, 'dashboard.html')), `${name} restores every file`);
  console.log(`${name}: installed ${version}`);
}

// Tamper: a newer-looking release whose zip doesn't match the signature must be ignored.
const zip = Buffer.from(mock.state.files.get(`canvas-grades-${version}.zip`)); zip[zip.length - 30] ^= 0xff;
const sig = mock.state.files.get(`canvas-grades-${version}.zip.sig`);
mock.state.files.set('canvas-grades-9.0.0.zip', zip); mock.state.files.set('canvas-grades-9.0.0.zip.sig', sig);
mock.state.messages.get(releaseUrl.split('/').pop()).attachments = ['canvas-grades-9.0.0.zip', 'canvas-grades-9.0.0.zip.sig'];
for (const [name, run] of runners) {
  const [dir, r] = await run(mkdtempSync(join(tmpdir(), 'cg-home-')));
  assert.notEqual(r.status, 0, `${name} should fail on a bad signature`);
  assert.equal(installed(dir), '1.0.0', `${name} leaves the install untouched`);
  assert.match(r.out, /signature/i);
  console.log(`${name}: rejected tampered release`);
}
server.close();
console.log('updater tests passed');
