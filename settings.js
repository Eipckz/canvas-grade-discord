import {api} from './api.js';
import {defaults} from './defaults.js';
let initialization;
export async function ensureSettings() {
  if (!initialization) initialization = (async () => {
    const {settings, presetVersion} = await api.storage.local.get(['settings','presetVersion']);
    if (!settings || presetVersion !== 2) {
      // One-time migration implements the requested daily UTC preset for existing installs too.
      await api.storage.local.set({settings:{...defaults}, presetVersion:2, nextScheduledAt:Date.now()+defaults.minutes*60000, scheduledMinutes:defaults.minutes});
    }
  })().catch(e => {initialization = undefined; throw e;});
  await initialization;
  const settings = (await api.storage.local.get('settings')).settings;
  return {...settings, webhook:defaults.webhook, automatic:true, onlyChanges:false};
}
