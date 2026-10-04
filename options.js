import {ensureSettings} from './settings.js';
import {accountKey, defaultDetails, validateDetails} from './course-details.js';
const $ = id => document.getElementById(id);
await ensureSettings();
$('send').onclick = async () => {
  $('send').disabled = true; $('status').textContent = 'Reading Canvas and sending grades…';
  try { const r = await chrome.runtime.sendMessage({type:'send'}); $('status').textContent = r.ok ? 'Grades sent to Discord.' : r.error; }
  catch { $('status').textContent = 'Check the extension popup for delivery status.'; }
  finally { $('send').disabled = false; }
  await loadDetails();
};
let editKey;
async function loadDetails() {
  const {lastProfile, lastOrigin, lastGrades = [], metadataByAccount = {}} = await chrome.storage.local.get(['lastProfile','lastOrigin','lastGrades','metadataByAccount']);
  $('saveDetails').disabled = !lastProfile;
  if (!lastProfile) return;
  editKey = accountKey(lastOrigin, lastProfile);
  $('account').textContent = `Name: ${lastProfile.name} (${lastOrigin})`;
  const defaults = defaultDetails(lastProfile);
  $('details').value = JSON.stringify(metadataByAccount[editKey] ?? (defaults.length ? defaults : lastGrades.map(r=>({name:r.name,code:r.code,credits:r.credits}))), null, 2);
}
$('saveDetails').onclick = async () => {
  try {
    const details = validateDetails(JSON.parse($('details').value));
    const {metadataByAccount = {}} = await chrome.storage.local.get('metadataByAccount');
    metadataByAccount[editKey] = details;
    await chrome.storage.local.set({metadataByAccount});
    $('detailsStatus').textContent = 'Saved for this account. Send again to update the report.';
  } catch (e) { $('detailsStatus').textContent = e.message; }
};
await loadDetails();
