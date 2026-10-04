import {mkdir, readFile, writeFile, copyFile} from 'node:fs/promises';
const files = ['api.js','background.js','calendar.js','collector.js','core.js','recent.js','course-details.js','defaults.js','settings.js','options.js','options.html','popup.js','popup.html','style.css','README.md'];
const base = JSON.parse(await readFile(new URL('../manifest.json', import.meta.url)));
for (const target of ['chromium', 'firefox']) {
  const dir = new URL(`../dist/${target}/`, import.meta.url);
  await mkdir(dir, {recursive:true});
  for (const file of files) await copyFile(new URL(`../${file}`, import.meta.url), new URL(file, dir));
  const manifest = structuredClone(base);
  if (target === 'firefox') {
    delete manifest.minimum_chrome_version;
    manifest.background = {scripts:['background.js'], type:'module'};
    manifest.browser_specific_settings = {gecko:{id:'canvas-grade-discord@christian-cantrell', strict_min_version:'142.0', data_collection_permissions:{required:['personallyIdentifyingInfo','websiteContent']}}};
  }
  await writeFile(new URL('manifest.json', dir), JSON.stringify(manifest,null,2)+'\n');
}
console.log('Built dist/chromium and dist/firefox');
