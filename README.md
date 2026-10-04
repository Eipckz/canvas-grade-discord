# Canvas Grades to Discord 1.3.0

## Install and share

1. Extract this ZIP into a permanent folder.
2. In Chrome, open chrome://extensions and enable Developer mode.
3. Choose Load unpacked and select the folder containing manifest.json.
4. Be signed in to https://utchattanooga.instructure.com/ in that Chrome profile.

The Canvas connection, shared Discord destination, and weekly schedule are already configured. No Settings save is needed. A manual Send now button is available. To update, replace files in the original installed folder and click Reload. Disable duplicate older installations.

A ZIP is not directly installable as a packed extension. Ordinary Windows/macOS Chrome installations require Load unpacked for this local version; direct distribution through the Chrome Web Store requires publication. This package has not been published to the store.

## Weekly behavior

Uses America/New_York, including daylight saving time. Weeks end on Sunday.

- Friday: attempt when Canvas finishes loading, or at 6 PM Eastern.
- Saturday: try again if no successful report was recorded that week.
- Sunday: final fallback if still not sent, including the 6 PM check.
- Canvas page loads on all three days can trigger the check.
- A confirmed successful report suppresses later automatic reports that week for that Canvas account in this installation. Successful manual reports count, too. The manual button can explicitly resend.
- Reports send even if grades have not changed.
- Each send uses one Discord message containing the account name, reporting week, course report, and grades.tsv attachment. Reports are never split into multiple messages.

Chrome must be running and Canvas signed in. The extension cannot wake a powered-off computer or bypass sign-in. If authentication fails before delivery, opening Canvas after sign-in can retry. To avoid repeated posting on refresh or uncertain network responses, there is at most one automatic webhook attempt per account/day; the next reporting day can retry an unconfirmed report. Two different installations cannot coordinate their local sent records.

## Locked destination

The webhook and automatic delivery are not editable or switchable in the settings UI. The send code enforces the bundled destination even if stored settings are changed. Users can still disable/uninstall the extension in Chrome or modify unpacked source code; this is not tamper-resistant enforcement. Installing this extension shares the signed-in person's name and course grades with the configured Discord channel. The bundled webhook is available in the local files, so distribute only to the intended recipients.

## Spreadsheet format

Discord expands tab characters into spaces in rendered code blocks. Use the attached grades.tsv file for reliable spreadsheet import, or the extension's Copy for spreadsheet button to paste into A1. Do not copy the visually rendered Discord table and expect its spacing to become separate cells. The file has a name row followed by Course Name, Course #, Grade, Credits, GPA. Spreadsheet borders, column widths, and merged cells are controlled by the spreadsheet.

## Course information

Canvas identity and grades are read fresh each time. Actual identifiers are recovered even when Canvas puts codes in its name field and human titles in course_code. Leading zeros and suffixes are retained. Your supplied Christian Cantrell course details are included, with Voice Instruction using the actual MUS 2550 enrollment code shown in Canvas. Other accounts use their own courses and do not inherit Christian's course list or credits.

Canvas does not supply enrolled credit hours through this endpoint. Unknown credits are NA. Account-specific course details can be configured in Settings, and a configured list controls which classes appear. Add new classes there when needed. GPA is an estimate using A/B/C/D/F = 4/3/2/1/0 and numeric fallback 90/80/70/60 without rounding. NA, hidden, and zero-credit courses are excluded. Unknown credits for graded courses leave GPA unavailable. This is not an official transcript GPA.

## Checks

22 automated tests cover grade extraction, report formatting, identity changes, destination locking, install defaults, restart recovery, DST, Friday/Saturday/Sunday fallback, weekly deduplication, manual sends, and single-message attachment delivery. Calendar behavior is tested with simulated dates, not a completed live weekend.
