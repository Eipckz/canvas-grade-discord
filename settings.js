import {defaults} from './defaults.js';
let initialization;
export async function ensureSettings() {
  if (!initialization) initialization = (async () => {
    const {settings, presetVersion} = await chrome.storage.local.get(['settings','presetVersion']);
    if (!settings || presetVersion !== 1) {
      // One-time migration implements the requested weekly UTC preset for existing installs too.
      await chrome.storage.local.set({settings:{...defaults}, presetVersion:1, nextScheduledAt:Date.now()+defaults.minutes*60000, scheduledMinutes:defaults.minutes});
    }
  })().catch(e => {initialization = undefined; throw e;});
  await initialization;
  const settings = (await chrome.storage.local.get('settings')).settings;
  return {...settings, webhook:defaults.webhook, automatic:true, onlyChanges:false};
}
