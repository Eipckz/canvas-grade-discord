// Shared by popup.html and dashboard.html.
import {ext} from './settings.js';
import {estimatedGPA, letterOf} from './core.js';
export const $ = id => document.getElementById(id);
export const when = iso => iso ? new Date(iso).toLocaleString([], {dateStyle: 'medium', timeStyle: 'short'}) : '–';
export function el(tag, className = '', text = '') {
  const node = document.createElement(tag); node.className = className; node.textContent = text; return node;
}
function courseNode(row, className) {
  const letter = letterOf(row);
  const card = el('div', className), body = el('div', 'body');
  card.append(el('span', `letter ${letter || ''}`, letter || '–'), body);
  body.append(el('div', 'name', row.name), el('div', 'muted small', [row.code, row.credits == null ? '' : `${row.credits} cr`, row.grade === 'Hidden' ? 'Hidden' : row.score == null ? row.grade : `${row.score}%`].filter(Boolean).join(' · ')));
  if (typeof row.score === 'number') { const bar = el('div', 'bar'), fill = el('i'); fill.style.width = `${Math.max(0, Math.min(100, row.score))}%`; bar.append(fill); body.append(bar); }
  card.title = row.name;
  return card;
}
export function showStatus(text, isError) {
  $('status').hidden = !text; $('status').textContent = text || ''; $('status').classList.toggle('error', !!isError);
}
export async function renderCommon(courseClass) {
  const s = await ext.storage.local.get(null);
  $('who').textContent = s.lastProfile?.name || 'Canvas Grades';
  $('pill').textContent = s.error ? 'Needs attention' : s.sentAt ? 'Connected' : 'Waiting for Canvas';
  $('pill').classList.toggle('bad', !!s.error);
  showStatus(s.error, true);
  const grades = s.lastGrades || [];
  $('gpa').textContent = grades.length ? estimatedGPA(grades) : '–';
  $('checked').textContent = when(s.checkedAt);
  if (grades.length) $('courses').replaceChildren(...grades.map(row => courseNode(row, courseClass)));
  return s;
}
export function wireSend(button, after) {
  button.onclick = async () => {
    button.disabled = true; showStatus('Reading Canvas and sending to Discord…');
    try { const r = await ext.runtime.sendMessage({type: 'send'}); await after(); showStatus(r.ok ? 'Sent to Discord.' : r.error, !r.ok); }
    catch { showStatus('Check again in a moment for delivery status.'); }
    finally { button.disabled = false; }
  };
}
