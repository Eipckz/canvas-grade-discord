const $ = id => document.getElementById(id);
import {estimatedGPA, spreadsheetTSV} from './core.js';
async function refresh() {
  const s = await chrome.storage.local.get(['settings','status','error','lastGrades','lastProfile','checkedAt','sentAt']);
  $('status').textContent = s.error || s.status || 'UTC Canvas is connected. Friday-to-Sunday weekly delivery is enabled. Sign in to Canvas, then use Send now anytime.';
  $('grades').replaceChildren();
  $('name').textContent = s.lastProfile ? `Name: ${s.lastProfile.name} (last checked account)` : '';
  for (const row of s.lastGrades || []) {
    const tr = document.createElement('tr');
    for (const value of [row.name, row.code || 'NA', row.grade, row.credits ?? 'NA', row === s.lastGrades.at(-1) ? estimatedGPA(s.lastGrades) : '']) {const td = document.createElement('td'); td.textContent = value; tr.append(td);}
    $('grades').append(tr);
  }
  $('time').textContent = [s.checkedAt ? `Checked: ${new Date(s.checkedAt).toLocaleString()}` : '', s.sentAt ? `Sent: ${new Date(s.sentAt).toLocaleString()}` : ''].filter(Boolean).join(' | ');
}
$('settings').onclick = () => chrome.runtime.openOptionsPage();
$('send').onclick = async () => {
  $('send').disabled = true; $('status').textContent = 'Reading Canvas and sending…';
  try { const r = await chrome.runtime.sendMessage({type:'send'}); await refresh(); if (!r.ok) $('status').textContent = r.error; }
  catch { $('status').textContent = 'Check again shortly for delivery status.'; }
  finally { $('send').disabled = false; }
};
chrome.storage.onChanged.addListener(refresh);
await refresh();

$('copy').onclick = async () => {
  try {
    const {lastGrades, lastProfile} = await chrome.storage.local.get(['lastGrades','lastProfile']);
    if (!lastProfile || !lastGrades?.length) throw new Error('Send a grade check first.');
    await navigator.clipboard.writeText(spreadsheetTSV(lastGrades,lastProfile));
    $('status').textContent = 'Copied. Paste into cell A1 of your spreadsheet.';
  } catch (e) { $('status').textContent = e.message; }
};
