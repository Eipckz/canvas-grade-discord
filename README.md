# Canvas Grades to Discord

A browser extension that sends your current UTC Canvas grades to our Discord channel whenever you open Canvas. It also posts a short alert when a class changes letter grade (for example B → A).

> **Privacy:** installing this shares your name and course grades with the Discord channel. Only install it if you're part of that group.

## ⬇️ Download

**[Download Canvas-Grades-Extension.zip](https://github.com/Eipckz/canvas-grade-discord/releases/latest/download/Canvas-Grades-Extension.zip)**

Then follow the steps for your browser below. It takes about 2 minutes.

---

## Chrome, Edge, Brave, Opera, or Vivaldi

### On Windows (recommended: updates itself)

1. **Unzip it.** Open your Downloads folder, right-click **Canvas-Grades-Extension.zip**, choose **Extract All…**, then click **Extract**.
2. **Run the installer.** In the folder that opens, double-click **Install on Windows.cmd**.
   - If Windows says *"Windows protected your PC"*, click **More info**, then **Run anyway**.
   - A window shows the install folder and copies its location for you. Leave it open for step 4.
3. **Open your browser's extensions page.** Type this into the address bar and press Enter:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
   - Brave: `brave://extensions`
   - Opera: `opera://extensions`
   - Vivaldi: `vivaldi://extensions`
4. **Turn on Developer mode** (a switch in the top-right corner; in Edge it's on the left), then click **Load unpacked**.
5. In the folder window that opens, **click the address bar at the top, press Ctrl+V, press Enter**, then click **Select Folder**.
6. Done! "Canvas Grades to Discord" appears in your extensions list. Click the puzzle-piece icon in the toolbar and **pin** it so it's easy to find.

### On a Chromebook

Don't use the Linux terminal or the installer files on a Chromebook. Chrome can't load extensions from there.

1. **Download** the zip with the link above. It saves to your **Downloads** folder.
2. **Unzip it into a real folder.** Open the **Files** app, go to **Downloads**, right-click the zip (two-finger tap), and choose **Extract all**. A folder named **Canvas-Grades-Extension** appears in Downloads.
   - No "Extract all" option? Double-click the zip to open it, press **Ctrl+A** then **Ctrl+C**, go back to **Downloads**, create a new folder named `Canvas-Grades-Extension` (Ctrl+E), open it, and press **Ctrl+V**.
   - Don't load the extension from inside the opened zip. That zip "drive" disappears when the Chromebook restarts, and the extension stops working.
3. In Chrome, go to `chrome://extensions`, turn on **Developer mode** (top-right), and click **Load unpacked**.
4. Choose **Downloads → Canvas-Grades-Extension** (the folder that has `manifest.json` in it), then click **Open**.
5. Pin it from the puzzle-piece icon.

**If the Developer mode switch is missing or greyed out**, or the page says *"managed by your organization"*, the Chromebook is school- or work-managed and its admin blocks extensions like this. It won't work on that Chromebook. Use a personal Chromebook or computer instead.

Chromebooks don't update this extension automatically. When the dashboard says a new version is available, download the zip again, replace the files in the **Canvas-Grades-Extension** folder, and click the reload ↻ icon on the extension in `chrome://extensions`.

### On Mac or Linux (not Chromebook; updates itself)

1. **Unzip it:** double-click **Canvas-Grades-Extension.zip** in Downloads.
2. **Run the installer:** open **Terminal**, type `sh ` (with a space after it), drag **update.sh** from the unzipped folder into the Terminal window, then press **Enter**. On a Mac, the install folder's location is copied for you.
3. Open your browser's extensions page (see the list in step 3 above). Turn on **Developer mode** and click **Load unpacked**.
4. In the folder window, press **Cmd+Shift+G** (Mac) or **Ctrl+L** (Linux), paste the location the installer printed, press Enter, then click **Select**.
5. Pin the extension from the puzzle-piece menu.

### No installer? (works anywhere, but doesn't update itself)

Unzip the file into a folder you won't delete, such as Documents. Then go to the extensions page, turn on Developer mode, click **Load unpacked**, and pick that folder.

> **Keep Developer mode on.** Chrome turns off extensions you loaded this way if Developer mode is switched off.

---

## Firefox

Firefox only keeps unsigned extensions until you close it, so Chrome, Edge, or Brave is easier for everyday use.

1. Unzip **Canvas-Grades-Extension.zip**.
2. Type `about:debugging#/runtime/this-firefox` in the address bar and press Enter.
3. Click **Load Temporary Add-on…** and choose **manifest.json** inside the unzipped folder.
4. If the dashboard opens with a **Grant Canvas & Discord access** button, click it, then click **Allow**.

You'll need to repeat steps 2–3 each time you restart Firefox.

## Safari

Safari needs every extension wrapped in a Mac app built with Apple's Xcode, so please use Chrome, Edge, or Brave on your Mac instead.

---

## Using it

1. **Sign in to Canvas** at https://utchattanooga.instructure.com in the same browser.
2. That's it. **Each time you open Canvas, your grades are sent** to the Discord channel, at most once every 15 minutes.
3. Click the extension's icon to see your grades and GPA estimate, or **Open dashboard** for everything:
   - **Send grades now** sends right away.
   - **Copy for spreadsheet** copies your grades for pasting into Excel or Google Sheets.
   - **Letter grade changes** shows each time a class went up or down a letter.
   - **Course details** (at the bottom) lets you set credit hours, which the GPA estimate needs.

**If the icon shows a red "!"**, open the dashboard to see what's wrong. Usually it just means you need to sign in to Canvas again.

## Updates

If you used the installer, updates install themselves within an hour, so there's nothing to do. Otherwise, download the zip again and replace your folder's files, then click the reload ↻ icon on the extension in your extensions page.
