import {recentlyGraded, submissionSnapshot, recentTSV} from './recent.js';
import {api} from './api.js';
import {nextCheck, isReportingDay, localDate} from './calendar.js';
import {ensureSettings} from './settings.js';
import {canvasOrigin, webhookURL, gradesFromCourses, messagesFor} from './core.js';
import {collectCanvas} from './collector.js';
import {accountKey, defaultDetails} from './course-details.js';
let running = false;
async function schedule() {
  await ensureSettings();
  const alarm = await api.alarms.get('grades');
  const {nextScheduledAt, calendarVersion} = await api.storage.local.get(['nextScheduledAt','calendarVersion']);
  if (!alarm || calendarVersion !== 3 || alarm.periodInMinutes) {
    const when = calendarVersion === 3 && nextScheduledAt ? Math.max(Date.now()+1000,nextScheduledAt) : nextCheck();
    await api.storage.local.set({nextScheduledAt:when, calendarVersion:3});
    await api.alarms.create('grades', {when});
  }
}
async function canvasTab(origin) {
  const existing = await api.tabs.query({url: `${origin}/*`});
  const tab = existing.find(t => t.status === 'complete') || existing[0] || await api.tabs.create({url: origin, active: false});
  for (let i = 0; i < 40; i++) {
    const current = await api.tabs.get(tab.id);
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
    const {lastFingerprint} = await api.storage.local.get('lastFingerprint');
    if (!settings) throw new Error('Open Settings and connect your Canvas website first.');
    const origin = canvasOrigin(settings.origin); const hook = webhookURL(settings.webhook);
    if (!await api.permissions.contains({origins: [`${origin}/*`]})) throw new Error('Canvas permission is missing. Save your settings again.');
    const tabId = await canvasTab(origin);
    const results = await api.scripting.executeScript({target: {tabId}, func: collectCanvas, args: [origin]});
    const result = results[0]?.result;
    if (!result || result.error) throw new Error(result?.error || 'Could not read Canvas.');
    if (!result.profile?.id || !result.profile?.name) throw new Error('Canvas did not identify the signed-in account.');
    const {metadataByAccount = {}} = await api.storage.local.get('metadataByAccount');
    const details = metadataByAccount[accountKey(origin, result.profile)] ?? defaultDetails(result.profile);
    const account=accountKey(origin,result.profile);
    const receiptKey=`${account}|${localDate()}`;
    const attemptKey=receiptKey;
    const {dailySent={}, dailyAttempts={}}=await api.storage.local.get(['dailySent','dailyAttempts']);
    if (trigger !== 'manual' && (dailySent[receiptKey] || dailyAttempts[attemptKey])) return {ok:true,skipped:true};
    const grades = gradesFromCourses(result.courses, details);
    if (!grades.length) throw new Error('No available student courses were found. No Discord message was sent.');
    const fingerprint = JSON.stringify({origin, hook, profile: result.profile, grades});
    const checkedAt = new Date().toISOString();
    await api.storage.local.set({lastGrades: grades, lastProfile: result.profile, lastOrigin: origin, checkedAt});
    if (!force && settings.onlyChanges && fingerprint === lastFingerprint) {
      await api.storage.local.set({status: 'Checked successfully. Grades are unchanged.', error: ''});
      await api.action.setBadgeText({text: ''});
      return {ok: true};
    }
    const {submissionHistory={}} = await api.storage.local.get('submissionHistory');
    const recent = recentlyGraded(result.submissions || [], grades, submissionHistory[account] || {});
    const reports = messagesFor(grades, result.profile, localDate(), recent, result.warnings || []);
    await api.storage.local.set({lastRecent:recent, collectionWarnings:result.warnings || []});
    if (reports.length !== 1) throw new Error('Expected exactly one Discord message. Nothing was sent.');
    {
      const {file, ...payload} = reports[0];
      let body, headers;
      if (file) {
        body = new FormData();
        body.append('payload_json', JSON.stringify(payload));
        body.append('files[0]', new Blob([file.text], {type:'text/tab-separated-values;charset=utf-8'}), file.name);
        body.append('files[1]', new Blob([recentTSV(recent)], {type:'text/tab-separated-values;charset=utf-8'}), 'recently-graded.tsv');
        body.append('files[2]', new Blob([JSON.stringify({profile:result.profile, checkedAt, grades, recent, allGraded:result.submissions || [], warnings:result.warnings || []},null,2)], {type:'application/json'}), 'report.json');
      } else {
        body = JSON.stringify(payload);
        headers = {'Content-Type':'application/json'};
      }
      if (trigger !== 'manual') {
        // One automatic delivery attempt per account/day avoids refresh duplicates.
        await api.storage.local.set({dailyAttempts:{...dailyAttempts,[attemptKey]:true}});
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
    await api.storage.local.set({dailySent:{...dailySent,[receiptKey]:checkedAt}, submissionHistory:{...submissionHistory,[account]:{...(submissionHistory[account] || {}),...submissionSnapshot(result.submissions || [])}}, lastFingerprint: fingerprint, sentAt: checkedAt, status: `Sent ${grades.length} classes and ${recent.length} recently graded items to Discord.`, error: ''});
    await api.action.setBadgeText({text: ''});
    return {ok: true};
  } catch (e) {
    const error = `${sent ? `${sent} message(s) sent before failure. ` : ''}${e.message}`;
    await api.storage.local.set({error, status: 'Needs attention'});
    await api.action.setBadgeText({text: '!'});
    await api.action.setBadgeBackgroundColor({color: '#b83d4d'});
    return {ok: false, error};
  } finally { running = false; }
}
api.runtime.onInstalled.addListener(() => { schedule(); });
api.runtime.onStartup.addListener(() => { schedule().then(() => run(false, 'startup')); });
api.alarms.onAlarm.addListener(async a => {
  if (a.name !== 'grades') return;
  const when=nextCheck();
  await api.storage.local.set({nextScheduledAt:when, calendarVersion:3});
  await api.alarms.create('grades',{when});
  await run(false, 'scheduled');
});
api.tabs.onUpdated.addListener((tabId, change, tab) => {
  if (change.status === 'complete' && tab.url?.startsWith('https://utchattanooga.instructure.com/') && isReportingDay()) run(false, 'canvas-open');
});
api.runtime.onMessage.addListener((msg, sender, reply) => {
  if (sender.id !== api.runtime.id) return;
  if (msg.type === 'send') { run(true).then(reply); return true; }
  if (msg.type === 'schedule') { schedule().then(() => reply({ok: true})).catch(() => reply({ok: false})); return true; }
});

// Recreate missing alarms when the background context resumes.
schedule().catch(() => {});
