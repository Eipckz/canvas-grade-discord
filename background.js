import {nextCheck, isReportingDay, localDate, reportingWeek} from './calendar.js';
import {ensureSettings} from './settings.js';
import {canvasOrigin, webhookURL, gradesFromCourses, messagesFor} from './core.js';
import {collectCanvas} from './collector.js';
import {accountKey, defaultDetails} from './course-details.js';
let running = false;
async function schedule() {
  await ensureSettings();
  const alarm = await chrome.alarms.get('grades');
  const {nextScheduledAt, calendarVersion} = await chrome.storage.local.get(['nextScheduledAt','calendarVersion']);
  if (!alarm || calendarVersion !== 2 || alarm.periodInMinutes) {
    const when = calendarVersion === 2 && nextScheduledAt ? Math.max(Date.now()+1000,nextScheduledAt) : nextCheck();
    await chrome.storage.local.set({nextScheduledAt:when, calendarVersion:2});
    await chrome.alarms.create('grades', {when});
  }
}
async function canvasTab(origin) {
  const existing = await chrome.tabs.query({url: `${origin}/*`});
  const tab = existing.find(t => t.status === 'complete') || existing[0] || await chrome.tabs.create({url: origin, active: false});
  for (let i = 0; i < 40; i++) {
    const current = await chrome.tabs.get(tab.id);
    if (current.status === 'complete') return tab.id;
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('Canvas did not finish loading. Open Canvas, sign in, and retry.');
}
async function run(force, trigger = 'manual') {
  if (running) return {ok: false, error: 'A grade check is already running.'};
  running = true;
  let sent = 0;
  try {
    const settings = await ensureSettings();
    if (trigger !== 'manual' && !isReportingDay()) return {ok:true,skipped:true};
    const {lastFingerprint} = await chrome.storage.local.get('lastFingerprint');
    if (!settings) throw new Error('Open Settings and connect your Canvas website first.');
    const origin = canvasOrigin(settings.origin); const hook = webhookURL(settings.webhook);
    if (!await chrome.permissions.contains({origins: [`${origin}/*`]})) throw new Error('Canvas permission is missing. Save your settings again.');
    const tabId = await canvasTab(origin);
    const results = await chrome.scripting.executeScript({target: {tabId}, func: collectCanvas, args: [origin]});
    const result = results[0]?.result;
    if (!result || result.error) throw new Error(result?.error || 'Could not read Canvas.');
    if (!result.profile?.id || !result.profile?.name) throw new Error('Canvas did not identify the signed-in account.');
    const {metadataByAccount = {}} = await chrome.storage.local.get('metadataByAccount');
    const details = metadataByAccount[accountKey(origin, result.profile)] ?? defaultDetails(result.profile);
    const week=reportingWeek();
    const receiptKey=`${accountKey(origin,result.profile)}|${week}`;
    const attemptKey=`${receiptKey}|${localDate()}`;
    const {weeklySent={}, dailyAttempts={}}=await chrome.storage.local.get(['weeklySent','dailyAttempts']);
    if (trigger !== 'manual' && (weeklySent[receiptKey] || dailyAttempts[attemptKey])) return {ok:true,skipped:true};
    const grades = gradesFromCourses(result.courses, details);
    if (!grades.length) throw new Error('No available student courses were found. No Discord message was sent.');
    const fingerprint = JSON.stringify({origin, hook, profile: result.profile, grades});
    const checkedAt = new Date().toISOString();
    await chrome.storage.local.set({lastGrades: grades, lastProfile: result.profile, lastOrigin: origin, checkedAt});
    if (!force && settings.onlyChanges && fingerprint === lastFingerprint) {
      await chrome.storage.local.set({status: 'Checked successfully. Grades are unchanged.', error: ''});
      await chrome.action.setBadgeText({text: ''});
      return {ok: true};
    }
    const reports = messagesFor(grades, result.profile, week);
    if (reports.length !== 1) throw new Error('Expected exactly one Discord message. Nothing was sent.');
    {
      const {file, ...payload} = reports[0];
      let body, headers;
      if (file) {
        body = new FormData();
        body.append('payload_json', JSON.stringify(payload));
        body.append('files[0]', new Blob([file.text], {type:'text/tab-separated-values;charset=utf-8'}), file.name);
      } else {
        body = JSON.stringify(payload);
        headers = {'Content-Type':'application/json'};
      }
      if (trigger !== 'manual') {
        // One automatic delivery attempt per account/day avoids refresh duplicates.
        await chrome.storage.local.set({dailyAttempts:{...dailyAttempts,[attemptKey]:true}});
      }
      let res;
      try { res = await fetch(hook, {method: 'POST', headers, body, signal: AbortSignal.timeout(20000)}); }
      catch { throw new Error('Discord could not confirm delivery. Check the channel before resending.'); }
      if (res.status === 429) throw new Error('Discord rate limited this send. Try again later.');
      if (!res.ok) throw new Error(`Discord returned HTTP ${res.status}. Check your webhook in Settings.`);
      const receipt = await res.json();
      if (!receipt.id) throw new Error('Discord did not return a message confirmation.');
      sent++;
    }
    await chrome.storage.local.set({weeklySent:{...weeklySent,[receiptKey]:checkedAt}, lastFingerprint: fingerprint, sentAt: checkedAt, status: `Sent ${grades.length} classes to Discord.`, error: ''});
    await chrome.action.setBadgeText({text: ''});
    return {ok: true};
  } catch (e) {
    const error = `${sent ? `${sent} message(s) sent before failure. ` : ''}${e.message}`;
    await chrome.storage.local.set({error, status: 'Needs attention'});
    await chrome.action.setBadgeText({text: '!'});
    await chrome.action.setBadgeBackgroundColor({color: '#b83d4d'});
    return {ok: false, error};
  } finally { running = false; }
}
chrome.runtime.onInstalled.addListener(() => { schedule(); });
chrome.runtime.onStartup.addListener(() => { schedule(); });
chrome.alarms.onAlarm.addListener(async a => {
  if (a.name !== 'grades') return;
  const when=nextCheck();
  await chrome.storage.local.set({nextScheduledAt:when, calendarVersion:2});
  await chrome.alarms.create('grades',{when});
  await run(false, 'scheduled');
});
chrome.tabs.onUpdated.addListener((tabId, change, tab) => {
  if (change.status === 'complete' && tab.url?.startsWith('https://utchattanooga.instructure.com/') && isReportingDay()) run(false, 'canvas-open');
});
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (sender.id !== chrome.runtime.id) return;
  if (msg.type === 'send') { run(true).then(reply); return true; }
  if (msg.type === 'schedule') { schedule().then(() => reply({ok: true})).catch(() => reply({ok: false})); return true; }
});
