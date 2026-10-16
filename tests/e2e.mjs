// Loads the real extension into real browsers against the mock Canvas/Discord and checks: report on Canvas open,
// cooldown, letter-change alert, dashboard, update banner, and self-reload after the updater replaces files.
//   cd tests && npm install && node e2e.mjs
// Browser paths: CHROME, EDGE, BRAVE, CHROMIUM, FIREFOX env vars (Windows install paths are the defaults).
import assert from 'node:assert/strict';
import {cpSync, mkdtempSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import puppeteer from 'puppeteer-core';
import {Builder, By} from 'selenium-webdriver';
import firefox from 'selenium-webdriver/firefox.js';
import {Command} from 'selenium-webdriver/lib/command.js';
import {mockServer} from './mock.mjs';

const root = process.env.CG_ROOT || fileURLToPath(new URL('..', import.meta.url));
const shots = process.env.CG_SHOTS || tmpdir();
const HOOK = 'https://discord.com/api/webhooks/1551820992244879371/7t3YcgA1Lg6DtyMI2j_ysfCIx6qKUGpS2e-RI1eVqWpXScKmsUR7sygQwFeZ11zOucSs';
const FIREFOX_UUID = '6f1f5a5e-6a8e-4c38-9a59-2f5b0f7d2c11';
const win = process.platform === 'win32';

const certDir = mkdtempSync(join(tmpdir(), 'cg-cert-'));
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '2', '-subj', '/CN=mock', '-keyout', join(certDir, 'key.pem'), '-out', join(certDir, 'cert.pem'),
  '-addext', 'subjectAltName=DNS:utchattanooga.instructure.com,DNS:discord.com'], {stdio: 'ignore'});
const tls = {key: readFileSync(join(certDir, 'key.pem')), cert: readFileSync(join(certDir, 'cert.pem'))};
const mock = mockServer();
const servers = [await mock.listen(8443, tls)];
// Firefox can only redirect hostnames (not ports), so it needs the mock on 443 too.
// CG_443_FORWARDED=1 means something (e.g. pf on macOS CI) already forwards 127.0.0.1:443 to 8443.
const has443 = process.env.CG_443_FORWARDED === '1' || await mock.listen(443, tls).then(s => servers.push(s), () => console.log('Port 443 unavailable (run with sudo on Linux/mac); Firefox skipped.'));

// Both drivers expose the same tiny interface: open, click, text, shot, run, close.
async function chromium(executablePath, dir) {
  const browser = await puppeteer.launch({executablePath, pipe: true, enableExtensions: true, headless: true,
    args: ['--host-resolver-rules=MAP utchattanooga.instructure.com 127.0.0.1:8443,MAP discord.com 127.0.0.1:8443', '--ignore-certificate-errors', '--no-first-run', '--no-sandbox']});
  const id = await browser.installExtension(dir);
  await browser.waitForTarget(t => t.type() === 'service_worker' && t.url().startsWith(`chrome-extension://${id}/`));
  // Chrome disables unpacked extensions on reload when Developer mode is off; real Load-unpacked users have it on.
  const settings = await browser.newPage();
  await settings.goto('chrome://extensions');
  await settings.evaluate(() => chrome.developerPrivate.updateProfileConfiguration({inDeveloperMode: true}));
  await settings.close();
  let page = await browser.newPage();
  await page.setViewport({width: 1200, height: 1000});
  return {
    name: await browser.version(), base: `chrome-extension://${id}/`,
    open: async url => { if (page.isClosed()) page = await browser.newPage(); await page.goto(url); },
    click: sel => page.click(sel), text: sel => page.$eval(sel, e => e.hidden ? '' : e.textContent),
    shot: path => page.screenshot({path, fullPage: true}), run: fn => page.evaluate(fn), close: () => browser.close(),
  };
}
async function gecko(binary, dir) {
  const options = new firefox.Options().setBinary(binary).addArguments('-headless').setAcceptInsecureCerts(true)
    .setPreference('network.dns.forceResolve', '127.0.0.1')
    .setPreference('extensions.webextensions.uuids', JSON.stringify({'canvas-grades-discord@utc.local': FIREFOX_UUID}));
  const driver = await new Builder().forBrowser('firefox').setFirefoxOptions(options)
    .setFirefoxService(new firefox.ServiceBuilder().addArguments('--allow-system-access')).build();
  // Install from the folder itself (not a zipped copy) so on-disk updates are visible, like a real unpacked install.
  driver.getExecutor().defineCommand('installAddonPath', 'POST', '/session/:sessionId/moz/addon/install');
  await driver.execute(new Command('installAddonPath').setParameter('path', dir).setParameter('temporary', true));
  await driver.manage().window().setRect({width: 1200, height: 1000});
  const caps = await driver.getCapabilities();
  const alive = async () => { const handles = await driver.getAllWindowHandles(); await driver.switchTo().window(handles[0]); };
  return {
    name: `Firefox ${caps.get('browserVersion')}`, base: `moz-extension://${FIREFOX_UUID}/`,
    open: async url => {
      try { await driver.getCurrentUrl(); } catch { await alive(); }
      if (!url.startsWith('moz-extension:')) return driver.get(url);
      // WebDriver refuses to navigate to extension pages, so open them from the browser's own (chrome) context.
      const before = await driver.getAllWindowHandles();
      await driver.setContext(firefox.Context.CHROME);
      await driver.executeScript('gBrowser.selectedTab = gBrowser.addTab(arguments[0], {triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal()})', url);
      await driver.setContext(firefox.Context.CONTENT);
      const added = (await driver.getAllWindowHandles()).find(h => !before.includes(h));
      await driver.switchTo().window(added);
      await waitFor(async () => (await driver.getCurrentUrl()).startsWith(url) && await driver.executeScript('return document.readyState') === 'complete', url);
    },
    click: async sel => (await driver.findElement(By.css(sel))).click(),
    text: async sel => driver.executeScript(`const e = document.querySelector(${JSON.stringify(sel)}); return e && !e.hidden ? e.textContent : ''`),
    shot: async path => writeFileSync(path, Buffer.from(await driver.takeScreenshot(), 'base64')),
    run: fn => driver.executeScript(`return (${fn})()`), close: () => driver.quit(),
  };
}
const browsers = [
  ['Chrome', chromium, process.env.CHROME ?? (win && 'C:/Program Files/Google/Chrome/Application/chrome.exe')],
  ['Edge', chromium, process.env.EDGE ?? (win && 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe')],
  ['Brave', chromium, process.env.BRAVE ?? (win && 'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe')],
  ['Chromium', chromium, process.env.CHROMIUM],
  ['Firefox', gecko, has443 && process.env.FIREFOX],
].filter(([, , path]) => path);

async function waitFor(check, what, ms = 20000) {
  for (const end = Date.now() + ms; Date.now() < end; await new Promise(r => setTimeout(r, 300))) { const v = await check().catch(() => false); if (v) return v; }
  throw new Error(`Timed out waiting for ${what}`);
}
const failures = [];
for (const [name, launch, path] of browsers) {
  const dir = mkdtempSync(join(tmpdir(), 'cg-ext-'));
  cpSync(join(root, 'Canvas Grades Extension'), dir, {recursive: true});
  writeFileSync(join(dir, 'release-url.txt'), `${HOOK}/messages/777\n`);
  Object.assign(mock.state, {posts: [], courses: [{id: 1, name: 'MUS 2710 Musicianship 3', score: 85, letter: 'B'}, {id: 2, name: 'ESC 1100 Conservation of Biodiversity', score: 93.5, letter: 'A'}]});
  mock.state.messages.set('777', {content: '', attachments: ['canvas-grades-9.9.9.zip', 'canvas-grades-9.9.9.zip.sig']});
  const reports = () => mock.state.posts.filter(p => p.attachments.includes('grades.tsv'));
  let b;
  try {
    b = await launch(path, dir);
    await new Promise(r => setTimeout(r, 1500)); // let the background script register its listeners

    await b.open('https://utchattanooga.instructure.com/');
    const first = await waitFor(async () => reports()[0], 'report after opening Canvas');
    assert.match(first.content, /Name: Test Student/);
    assert.match(first.text, /MUS 2710 Musicianship 3\tMUS 2710\t85/);

    await b.open('https://utchattanooga.instructure.com/courses/1');
    await new Promise(r => setTimeout(r, 2500));
    assert.equal(reports().length, 1, 'clicking around Canvas within the cooldown does not resend');

    mock.state.courses[0] = {...mock.state.courses[0], score: 91.2, letter: 'A-'};
    await b.open(b.base + 'dashboard.html');
    await waitFor(async () => /Test Student/.test(await b.text('#who')), 'dashboard to render');
    await b.click('#send');
    const alert = await waitFor(async () => mock.state.posts.find(p => /Letter grade change/.test(p.content)), 'letter change alert');
    assert.match(alert.content, /⬆️ \*\*MUS 2710 Musicianship 3\*\*: B → A \(91.2%\)/);
    await waitFor(async () => reports().length === 2, 'second report');
    await waitFor(async () => /B → A/.test(await b.text('#changes')), 'dashboard change timeline');
    await waitFor(async () => /9\.9\.9/.test(await b.text('#update')), 'update-available banner');
    await b.shot(join(shots, `dashboard-${name}.png`));

    // Simulate the updater replacing files on disk: the extension should notice and reload itself.
    const m = JSON.parse(readFileSync(join(dir, 'manifest.json'))); m.version = '1.99.0';
    writeFileSync(join(dir, 'manifest.json'), JSON.stringify(m));
    await b.run(() => { (globalThis.browser ?? chrome).runtime.sendMessage({type: 'checkUpdate'}).catch(() => {}); }).catch(() => {});
    await waitFor(async () => { await b.open(b.base + 'dashboard.html'); return /1\.99\.0/.test(await b.text('#version')); }, 'self-reload to the new version', 30000);
    console.log(`PASS ${name} (${b.name})`);
  } catch (e) {
    failures.push(name); console.log(`FAIL ${name}: ${e.stack || e.message}`);
  } finally { await b?.close().catch(() => {}); }
}
servers.forEach(s => s.close());
if (failures.length) { console.log(`Failed: ${failures.join(', ')}`); process.exit(1); }
console.log(`All ${browsers.length} browsers passed`);
