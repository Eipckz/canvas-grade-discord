import {nextCheck, isReportingDay, reportingWeek} from './calendar.js';
import {ext, ensureSettings} from './settings.js';
import {defaults, OPEN_COOLDOWN_MINUTES} from './defaults.js';
import {canvasOrigin, webhookURL, gradesFromCourses, messagesFor, letterChanges, changeMessage, newerVersion} from './core.js';
import {collectCanvas} from './collector.js';
import {accountKey, defaultDetails} from './course-details.js';
const DISCORD = 'https://discord.com/api/webhooks/*';
let running = false;
async function schedule() {
  await ensureSettings();
  const alarm = await ext.alarms.get('grades');
  const {nextScheduledAt, calendarVersion} = await ext.storage.local.get(['nextScheduledAt','calendarVersion']);
  if (!alarm || calendarVersion !== 2 || alarm.periodInMinutes) {
    const when = calendarVersion === 2 && nextScheduledAt ? Math.max(Date.now()+1000,nextScheduledAt) : nextCheck();
    await ext.storage.local.set({nextScheduledAt:when, calendarVersion:2});
    await ext.alarms.create('grades', {when});
  }
  if (!await ext.alarms.get('update')) await ext.alarms.create('update', {periodInMinutes: 60});
}
async function canvasTab(origin) {
  const existing = await ext.tabs.query({url: `${origin}/*`});
  const tab = existing.find(t => t.status === 'complete') || existing[0] || await ext.tabs.create({url: origin, active: false});
  for (let i = 0; i < 40; i++) {
    const current = await ext.tabs.get(tab.id);
    if (current.status === 'complete') return tab.id;
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('Canvas did not finish loading. Open Canvas, sign in, and retry.');
}
async function post(hook, {file, ...payload}) {
  let body = JSON.stringify(payload), headers = {'Content-Type':'application/json'};
  if (file) {
    body = new FormData();
    body.append('payload_json', JSON.stringify(payload));
    body.append('files[0]', new Blob([file.text], {type:'text/tab-separated-values;charset=utf-8'}), file.name);
    headers = undefined;
  }
  let res;
  try { res = await fetch(hook, {method: 'POST', headers, body, signal: AbortSignal.timeout(20000)}); }
  catch { throw new Error('Discord could not confirm delivery. Check the channel before resending.'); }
  if (res.status === 429) throw new Error('Discord rate limited this send. Try again later.');
  if (!res.ok) throw new Error(`Discord returned HTTP ${res.status}.`);
  if (!(await res.json()).id) throw new Error('Discord did not return a message confirmation.');
}
// trigger: 'manual' always sends; 'canvas-open' sends unless one went out in the last OPEN_COOLDOWN_MINUTES;
// 'scheduled' is the Fri-Sun 6 PM fallback that only sends if nothing was sent this reporting week.
async function run(trigger = 'manual', tabId) {
  if (running) return {ok: false, error: 'A grade check is already running.'};
  running = true;
  try {
    const settings = await ensureSettings();
    const origin = canvasOrigin(settings.origin); const hook = webhookURL(settings.webhook);
    const s = await ext.storage.local.get(['lastAttemptAt','sentAt','letters','history','metadataByAccount']);
    if (trigger === 'canvas-open' && Date.now() - (s.lastAttemptAt || 0) < OPEN_COOLDOWN_MINUTES * 60000) return {ok: true, skipped: true};
    if (trigger === 'scheduled' && (!isReportingDay() || (s.sentAt && reportingWeek(new Date(s.sentAt)) === reportingWeek()))) return {ok: true, skipped: true};
    if (!await ext.permissions.contains({origins: [`${origin}/*`, DISCORD]})) throw new Error('Canvas and Discord access is not granted yet. Open the dashboard and click Grant access.');
    const [{result} = {}] = await ext.scripting.executeScript({target: {tabId: tabId ?? await canvasTab(origin)}, func: collectCanvas, args: [origin]});
    if (!result || result.error) throw new Error(result?.error || 'Could not read Canvas.');
    if (!result.profile?.id || !result.profile?.name) throw new Error('Canvas did not identify the signed-in account.');
    const key = accountKey(origin, result.profile);
    const grades = gradesFromCourses(result.courses, s.metadataByAccount?.[key] ?? defaultDetails(result.profile));
    if (!grades.length) throw new Error('No available student courses were found. No Discord message was sent.');
    const checkedAt = new Date().toISOString();
    // Cooldown starts only once Canvas was actually read, so a login-page load doesn't block the post-login send.
    await ext.storage.local.set({lastGrades: grades, lastProfile: result.profile, lastOrigin: origin, checkedAt, lastAttemptAt: Date.now()});
    const letters = s.letters || {};
    const {changes, next} = letterChanges(letters[key], grades);
    if (changes.length) {
      await post(hook, changeMessage(changes, result.profile));
      await ext.storage.local.set({history: [...changes.map(c => ({...c, at: checkedAt})), ...(s.history || [])].slice(0, 200)});
    }
    // Saved only after the alert posts, so a failed alert is retried next time.
    await ext.storage.local.set({letters: {...letters, [key]: next}});
    await post(hook, messagesFor(grades, result.profile, reportingWeek())[0]);
    await ext.storage.local.set({sentAt: checkedAt, status: `Sent ${grades.length} classes to Discord${changes.length ? ` with ${changes.length} letter grade change${changes.length > 1 ? 's' : ''}` : ''}.`, error: ''});
    await ext.action.setBadgeText({text: ''});
    return {ok: true};
  } catch (e) {
    await ext.storage.local.set({error: e.message, status: 'Needs attention'});
    await ext.action.setBadgeText({text: '!'});
    await ext.action.setBadgeBackgroundColor({color: '#b83d4d'});
    return {ok: false, error: e.message};
  } finally { running = false; }
}
// Auto-update support: the updater script replaces this folder on disk; reloading picks the new files up.
// Also reads the release message so browsers without the updater (Firefox, Safari) can show "update available".
async function checkForUpdate() {
  try {
    const disk = await (await fetch(ext.runtime.getURL('manifest.json'), {cache: 'no-store'})).json();
    if (disk.version !== ext.runtime.getManifest().version) return ext.runtime.reload();
    const url = (await (await fetch(ext.runtime.getURL('release-url.txt'), {cache: 'no-store'})).text()).trim();
    if (!url.startsWith(defaults.webhook.split('?')[0] + '/messages/')) return;
    const msg = await (await fetch(url, {signal: AbortSignal.timeout(20000)})).json();
    const latest = (msg.attachments || []).map(a => a.filename.match(/^canvas-grades-(\d+\.\d+\.\d+)\.zip$/)?.[1]).find(Boolean);
    await ext.storage.local.set({updateAvailable: latest && newerVersion(latest, disk.version) ? latest : ''});
  } catch {}
}
ext.runtime.onInstalled.addListener(({reason}) => {
  schedule(); checkForUpdate();
  // First install: show the dashboard (Firefox may need the Grant access button there).
  if (reason === 'install') ext.runtime.openOptionsPage();
});
ext.runtime.onStartup.addListener(() => { schedule(); checkForUpdate(); });
ext.alarms.onAlarm.addListener(async a => {
  if (a.name === 'update') return checkForUpdate();
  if (a.name !== 'grades') return;
  const when = nextCheck();
  await ext.storage.local.set({nextScheduledAt:when, calendarVersion:2});
  await ext.alarms.create('grades', {when});
  await run('scheduled');
});
ext.tabs.onUpdated.addListener((tabId, change, tab) => {
  if (change.status === 'complete' && tab.url?.startsWith(defaults.origin + '/')) run('canvas-open', tabId);
});
ext.runtime.onMessage.addListener((msg, sender, reply) => {
  if (sender.id !== ext.runtime.id) return;
  if (msg.type === 'send') { run('manual').then(reply); return true; }
  if (msg.type === 'checkUpdate') { checkForUpdate().then(() => reply({ok: true})); return true; }
});
