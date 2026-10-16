import {defaults} from './defaults.js';
// Firefox and Safari expose promise-based `browser`; Chromium exposes `chrome`.
export const ext = globalThis.browser ?? globalThis.chrome;
let initialization;
export async function ensureSettings() {
  if (!initialization) initialization = (async () => {
    const {settings, presetVersion} = await ext.storage.local.get(['settings','presetVersion']);
    if (!settings || presetVersion !== 1) {
      // One-time migration implements the requested weekly UTC preset for existing installs too.
      await ext.storage.local.set({settings:{...defaults}, presetVersion:1, nextScheduledAt:Date.now()+defaults.minutes*60000, scheduledMinutes:defaults.minutes});
    }
  })().catch(e => {initialization = undefined; throw e;});
  await initialization;
  const settings = (await ext.storage.local.get('settings')).settings;
  return {...settings, webhook:defaults.webhook, automatic:true, onlyChanges:false};
}
