# Canvas Grades to Discord 1.5

This one folder works in every browser: Chrome, Edge, Brave, Opera, Vivaldi, Firefox, and Safari, on Windows, macOS, and Linux.

## What it does

- **Sends your grades every time you open Canvas.** It sends at most once every 15 minutes, so clicking around Canvas doesn't flood the channel. `OPEN_COOLDOWN_MINUTES` in `defaults.js` sets this window.
- **Weekly backup.** If Canvas isn't opened all week, the extension checks Friday through Sunday at 6 PM Eastern while the browser is running.
- **Letter grade change alerts.** When a class moves between A, B, C, D, and F (in either direction), a separate **Letter grade change** summary is posted to Discord, such as `⬆️ MUS 2710 Musicianship 3: B → A (91.2%)`. Changes within a letter (B+ to B-) don't count. Each computer keeps its own grade history, so two computers can both report the same change.
- **Dashboard.** Click the toolbar icon for a quick view, then **Open dashboard**. The dashboard shows your GPA estimate, each class's letter and score, a timeline of letter changes, Send now, Copy for spreadsheet, and the course credit editor.

## Install (Chrome, Edge, Brave, Opera, Vivaldi): any OS, with automatic updates

1. Get this folder: copy it from OneDrive, or download the zip from the release message in Discord and extract it.
2. Run the installer once. It copies the extension to a local folder and checks for updates every hour.
   - **Windows:** double-click `Install on Windows.cmd` (or run `powershell -ExecutionPolicy Bypass -File update.ps1 -Install`)
   - **Mac/Linux:** `sh update.sh --install`
3. Open the browser's extensions page (`chrome://extensions`, `edge://extensions`, `brave://extensions`, …). Turn on **Developer mode**, click **Load unpacked**, and select the folder the installer printed or opened:
   - Windows: `%LOCALAPPDATA%\CanvasGrades\extension`
   - macOS: `~/Library/Application Support/CanvasGrades/extension`
   - Linux: `~/.local/share/canvas-grades/extension`
4. Remove any older copy that was loaded from another folder. **Leave Developer mode on**: Chrome disables unpacked extensions when it's off.
5. Sign in to https://utchattanooga.instructure.com/ in that browser.

## Firefox

The same folder works in Firefox 140+. Firefox only installs Mozilla-signed extensions permanently, so pick one of these:
- **Quick test:** go to `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on**, and pick `manifest.json`. Firefox removes it when it restarts.
- **Permanent:** sign it once for free as an unlisted add-on (`npx web-ext sign --channel=unlisted --api-key=… --api-secret=…` with keys from addons.mozilla.org), then install the `.xpi` it produces. Repeat the signing for each new version.
- **Firefox Developer Edition/Nightly/ESR:** set `xpinstall.signatures.required` to `false` in `about:config`, then install the zip. You can also point a proxy file at the auto-updated folder.

If the dashboard shows **Grant Canvas & Discord access**, click it once. Firefox's updater doesn't apply on its own. The dashboard shows a banner when a new version is out, and you can get it from the release message.

## Safari (Mac only)

Safari needs Xcode to wrap the extension in an app:
`xcrun safari-web-extension-converter "Canvas Grades Extension" --app-name "Canvas Grades" --macos-only`
Next, build and run the app in Xcode. In Safari, turn on **Settings → Advanced → Show features for web developers**, then **Develop → Allow Unsigned Extensions**, and enable it under **Settings → Extensions**. Safari builds don't update automatically; rerun the converter for new versions. Safari is untested because it needs a Mac.

## Rolling out an update (from the main computer)

1. Make your changes and bump `"version"` in `manifest.json`.
2. Run `node tools/publish-update.mjs` from the project folder.

The script zips this folder and signs it with the private key in `~/.canvas-grades/release-key.pem`. It then attaches the zip to one release message in the Discord channel, which the webhook edits in place. Every computer with the updater installs it within the hour, and the extension reloads itself. Updates are accepted only when the signature matches and the version is newer. Anyone who has the webhook URL can edit that message, but they can't push code without the private key. **Back up the private key, and never put it in this folder or OneDrive.** The first publish creates the release message and writes its address into `release-url.txt`. Install that copy on each computer once; after that, updates are automatic.

Logs are in `update.log` next to the installed `extension` folder.

## Privacy and limits

Installing this shares the signed-in person's name and course grades with the configured Discord channel. The webhook is in the local files, so distribute this only to the intended recipients. The browser must be running and signed in to Canvas, and it can't wake a sleeping computer.

## Spreadsheet format and GPA

Each report has a `grades.tsv` attachment (Course Name, Course #, Grade, Credits, GPA) for spreadsheet import. **Copy for spreadsheet** puts the same data on the clipboard for cell A1. Canvas doesn't provide credit hours, so edit them under **Course details** on the dashboard. GPA is an estimate (A–F = 4–0, with 90/80/70/60 when there's no letter). It leaves out hidden, NA, and zero-credit classes, and it isn't an official GPA.

## Tests

From `tests/`, run `npm install`, then `node core.test.mjs`, `node updater.test.mjs`, and `node e2e.mjs`. The e2e test runs the real extension in Chrome, Edge, Brave, Chromium, and Firefox against a fake Canvas and Discord, so nothing real is posted. `.github/workflows/test.yml` runs the same tests on Windows, macOS, and Linux.
