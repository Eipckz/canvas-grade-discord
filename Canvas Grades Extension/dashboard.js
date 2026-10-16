import {ext, ensureSettings} from './settings.js';
import {spreadsheetTSV, courseLabel} from './core.js';
import {OPEN_COOLDOWN_MINUTES} from './defaults.js';
import {accountKey, defaultDetails, validateDetails} from './course-details.js';
import {$, el, when, renderCommon, showStatus, wireSend} from './ui.js';
const ORIGINS = {origins: ['https://utchattanooga.instructure.com/*', 'https://discord.com/api/webhooks/*']};
let editKey;
async function refresh() {
  const s = await renderCommon('panel course');
  $('count').textContent = s.lastGrades?.length ?? '–';
  $('sent').textContent = when(s.sentAt);
  $('grant').hidden = await ext.permissions.contains(ORIGINS);
  $('update').hidden = !s.updateAvailable;
  $('update').textContent = s.updateAvailable ? `Version ${s.updateAvailable} is available. Computers with the auto-updater install it within the hour; otherwise download it from the release message in Discord.` : '';
  const history = s.history || [];
  if (history.length) $('changes').replaceChildren(...history.map(c => {
    const li = el('li'), at = el('span', 'muted small', when(c.at));
    at.style.marginLeft = 'auto';
    li.append(el('span', c.up ? 'up' : 'down', c.up ? '▲' : '▼'), el('span', `letter ${c.to}`, c.to),
      el('div', '', `${courseLabel(c)}: ${c.from} → ${c.to}${c.score == null ? '' : ` (${c.score}%)`}`), at);
    return li;
  }));
  if (s.lastProfile && editKey !== accountKey(s.lastOrigin, s.lastProfile)) {
    editKey = accountKey(s.lastOrigin, s.lastProfile);
    $('account').textContent = `Applies only to ${s.lastProfile.name}. Canvas doesn't provide credit hours, so they come from this list. Only listed classes are reported.`;
    const defaults = defaultDetails(s.lastProfile);
    $('details').value = JSON.stringify(s.metadataByAccount?.[editKey] ?? (defaults.length ? defaults : (s.lastGrades || []).map(r => ({name: r.name, code: r.code, credits: r.credits}))), null, 2);
  }
  $('saveDetails').disabled = !s.lastProfile;
}
await ensureSettings();
$('cooldown').textContent = OPEN_COOLDOWN_MINUTES;
$('version').textContent = `Version ${ext.runtime.getManifest().version}`;
wireSend($('send'), refresh);
// permissions.request must run synchronously inside the click for Firefox.
$('grant').onclick = () => ext.permissions.request(ORIGINS).then(refresh);
$('copy').onclick = async () => {
  const {lastGrades, lastProfile} = await ext.storage.local.get(['lastGrades', 'lastProfile']);
  if (!lastProfile || !lastGrades?.length) return showStatus('Send a grade check first.', true);
  await navigator.clipboard.writeText(spreadsheetTSV(lastGrades, lastProfile));
  showStatus('Copied. Paste into cell A1 of your spreadsheet.');
};
$('saveDetails').onclick = async () => {
  try {
    const details = validateDetails(JSON.parse($('details').value));
    const {metadataByAccount = {}} = await ext.storage.local.get('metadataByAccount');
    await ext.storage.local.set({metadataByAccount: {...metadataByAccount, [editKey]: details}});
    $('detailsStatus').textContent = 'Saved. Send again to update the report.';
  } catch (e) { $('detailsStatus').textContent = e.message; }
};
ext.storage.onChanged.addListener(refresh);
await refresh();
ext.runtime.sendMessage({type: 'checkUpdate'}).catch(() => {});
