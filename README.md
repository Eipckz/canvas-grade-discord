# Canvas Grades to Discord 1.4.0

Daily Canvas course totals and graded assignment details, sent to the preconfigured Discord webhook in one message.

## Browser packages

Run npm run build. Use dist/chromium for Chrome, Edge, Chromium, Brave, Opera, and compatible desktop browsers. Use dist/firefox for Firefox 142+ and compatible Firefox browsers.

- Chrome/Chromium: open chrome://extensions, enable Developer mode, select Load unpacked.
- Edge: open edge://extensions, enable Developer mode, select Load unpacked.
- Firefox: open about:debugging#/runtime/this-firefox, select Load Temporary Add-on, then the Firefox manifest.json. Temporary installs disappear when Firefox closes. Permanent ordinary Firefox installs require Mozilla signing; this release is not signed or published to browser stores.

The original local Chromium folder can still be loaded directly. Replace/reload the existing installation to update. Use only one automatic installation per account if you want one daily message across browsers. Different browser installations have independent receipt records.

## Daily delivery

Checks run every day at 6 PM America/New_York, including DST. Browser startup and Canvas page loads also catch up on an unsent day. An earlier successful catch-up suppresses that day's 6 PM send. Reports send even when totals have not changed. Manual Send now can resend explicitly.

The browser must be running and Canvas signed in. Alarms cannot wake a powered-off computer. Authentication failures can retry after Canvas opens. There is at most one automatic webhook attempt per account per Eastern calendar day, including uncertain network responses, to prevent duplicate posts. Manual resend remains available. Existing weekly receipt records are preserved but no longer suppress daily reports.

## Assignment coverage

For every available course with visible totals, the collector paginates the signed-in student's submissions and requests assignment metadata, comments, rubric assessments, and visibility. If that endpoint is unavailable, it tries paginated assignments with embedded submissions. A report warns when coverage or comments are incomplete. Hidden grades and other students' submissions are excluded. Account identity is checked before and after collection.

Recently graded means posted or graded within the last 30 days, plus older records whose grades or feedback changed since a successful report. All retrievable graded submissions, including older items or records without grading timestamps, are included in report.json. Canvas may omit unpublished grades, comments, or rubric details. Fallback coverage is explicitly marked.

Each Discord message includes:

- grades.tsv: signed-in name, course names/codes, current grades, credit hours, and estimated GPA.
- recently-graded.tsv: assignment grade/score, possible points, grading/posting/submission/due dates, late/missing/excused flags, attempt, Canvas link, comments, and rubric data.
- report.json: full course totals, recently graded items, all collected graded records, collection time, and coverage warnings.

The text preview stays within Discord's 2,000-character limit. Attachments retain full details. Exceptionally large reports can exceed Discord's upload limit and will surface a delivery error.

## Account details and destination

UTC Canvas and the shared webhook remain preconfigured. Settings keep account-specific course metadata separate. A configured course list controls the totals and recent TSV; the JSON also includes graded records from other available courses. Unknown credit hours are NA. GPA uses A/B/C/D/F = 4/3/2/1/0 or numeric fallback 90/80/70/60, excludes hidden/unavailable/zero-credit courses, and is an estimate.

Installing and sending shares the signed-in name, grades, and available grading feedback with the configured Discord channel. The bundled webhook is present in local source, so keep distribution within the intended group. Automatic delivery and destination remain locked in Settings.

## Verification

Run npm test and npm run build. Tests cover daily/DST scheduling, recent and updated historical grades, pagination, zero scores, fallback collection, account isolation, formula-safe TSV, one-message reporting, daily receipts, manual resend, and failed-send deduplication. Firefox package validation uses web-ext lint. Mock tests do not confirm live Canvas access or Discord delivery.
