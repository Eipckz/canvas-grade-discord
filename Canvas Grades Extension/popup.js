import {ext} from './settings.js';
import {$, renderCommon, wireSend} from './ui.js';
const refresh = () => renderCommon('row');
$('open').onclick = () => { ext.runtime.openOptionsPage(); window.close(); };
wireSend($('send'), refresh);
ext.storage.onChanged.addListener(refresh);
await refresh();
