export function canvasOrigin(value) {
  const u = new URL(value.trim());
  if (u.protocol !== 'https:' || u.username || u.password) throw new Error('Enter your HTTPS Canvas website address.');
  return u.origin;
}
export function webhookURL(value) {
  const u = new URL(value.trim());
  if (u.origin !== 'https://discord.com' || !/^\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+\/?$/.test(u.pathname) || u.username || u.password) throw new Error('Enter a valid discord.com webhook URL.');
  u.search = '?wait=true'; u.hash = '';
  return u.href;
}
export function courseCode(value) {
  const m = String(value || '').toUpperCase().match(/(?:^|[^A-Z])([A-Z]{2,5})[\s_.-]*(\d{4}[A-Z]?)(?!\d)/);
  return m ? `${m[1]} ${m[2]}` : '';
}
export function gradesFromCourses(courses, details = []) {
  return [...new Map(courses.filter(c => c.workflow_state === 'available').map(c => {
    const e = (c.enrollments || []).find(e => ['student', 'StudentEnrollment'].includes(e.type));
    if (!e) return [c.id, null];
    const candidates = [c.original_name, c.name, c.course_code].filter(Boolean);
    const originalName = candidates.find(n => !courseCode(n)) || candidates[0] || `Course ${c.id}`;
    const code = courseCode(c.original_name) || courseCode(c.name) || courseCode(c.course_code);
    const detail = details.find(d => code && courseCode(d.code) === code) || details.find(d => d.name.trim().toLowerCase() === originalName.trim().toLowerCase());
    if (details.length && !detail) return [c.id, null];
    const score = !c.hide_final_grades && typeof e.computed_current_score === 'number' && Number.isFinite(e.computed_current_score) ? e.computed_current_score : null;
    const letter = c.hide_final_grades ? null : e.computed_current_grade || null;
    const grade = c.hide_final_grades ? 'Hidden' : score !== null ? String(score) : letter || 'NA';
    return [c.id, {id: c.id, name: detail?.name || originalName, code: code || detail?.code || 'NA', grade, score, letter, credits: detail?.credits ?? null, order: detail ? details.indexOf(detail) : details.length}];
  })).values()].filter(Boolean).sort((a,b) => a.order-b.order || a.name.localeCompare(b.name));
}
export function estimatedGPA(grades) {
  let points = 0, credits = 0;
  for (const row of grades) {
    if (row.credits === 0 || row.grade === 'NA' || row.grade === 'Hidden') continue;
    const letterPoints = {A:4,B:3,C:2,D:1,F:0}[row.letter?.trim().toUpperCase()];
    const p = letterPoints ?? (typeof row.score === 'number' ? row.score >= 90 ? 4 : row.score >= 80 ? 3 : row.score >= 70 ? 2 : row.score >= 60 ? 1 : 0 : null);
    if (p === null) continue;
    if (row.credits == null) return 'NA';
    points += p * row.credits; credits += row.credits;
  }
  return credits ? (points / credits).toFixed(2) : 'NA';
}
export function spreadsheetRows(grades, profile) {
  const clean = value => {
    const text = String(value ?? 'NA').replace(/[\r\n\t`\u0000-\u001f\u007f]/g, ' ');
    return /^[=+@-]/.test(text) ? "'" + text : text;
  };
  return [
    ['Name:', clean(profile.name), '', '', ''],
    ['Course Name', 'Course #', 'Grade', 'Credits', 'GPA'],
    ...grades.map((r,i) => [clean(r.name), clean(r.code), clean(r.grade), r.credits == null ? 'NA' : String(r.credits), i === grades.length - 1 ? estimatedGPA(grades) : ''])
  ];
}
export function spreadsheetTSV(grades, profile) {
  return spreadsheetRows(grades, profile).map(row => row.join('\t')).join('\n');
}
export function messagesFor(grades, profile, week = '') {
  const name = String(profile.name).replace(/[\r\n\t]/g, ' ').slice(0,150).replace(/[\\`*_~|<>]/g, '\\$&');
  const heading = `**Name: ${name}**\n${week ? `Week ending ${week}\n` : ''}`;
  const tsv = spreadsheetTSV(grades, profile);
  const intro = 'Import grades.tsv into your spreadsheet, or use Copy for spreadsheet in the extension. GPA is an estimate.\n';
  const content = heading + intro + '```\n' + tsv + '\n```';
  const allowed_mentions = {parse: []};
  if (content.length <= 2000) return [{content, allowed_mentions, file:{name:'grades.tsv',text:tsv}}];
  return [{content: heading + 'The complete report is attached as grades.tsv. Open or import it in your spreadsheet. GPA is an estimate.', allowed_mentions, file: {name:'grades.tsv', text:tsv}}];
}
