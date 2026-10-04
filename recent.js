export function submissionFingerprint(row) {
  return JSON.stringify([row.grade, row.score, row.gradedAt, row.postedAt, row.excused, row.comments, row.rubric]);
}
export function recentlyGraded(submissions, grades, previous = {}, now = new Date()) {
  const courses = new Map(grades.map(c => [String(c.id), c]));
  const cutoff = now.getTime() - 30 * 86400000;
  return submissions.filter(s => courses.has(String(s.courseId))).filter(s => {
    const key = `${s.courseId}:${s.assignmentId}`;
    const date = Date.parse(s.postedAt || s.gradedAt || '');
    return Number.isFinite(date) && date >= cutoff || previous[key] != null && previous[key] !== submissionFingerprint(s);
  }).map(s => ({...s, courseName:courses.get(String(s.courseId)).name, courseCode:courses.get(String(s.courseId)).code}))
    .sort((a,b) => (Date.parse(b.postedAt || b.gradedAt) || 0) - (Date.parse(a.postedAt || a.gradedAt) || 0));
}
export function submissionSnapshot(submissions) {
  return Object.fromEntries(submissions.map(s => [`${s.courseId}:${s.assignmentId}`, submissionFingerprint(s)]));
}
export function recentTSV(rows) {
  const clean = value => {
    const text = String(value ?? '').replace(/[\t\r\n\u0000-\u001f\u007f]/g, ' ');
    return /^[=+@-]/.test(text) ? "'" + text : text;
  };
  const columns = ['Course', 'Course #', 'Assignment', 'Grade', 'Score', 'Points possible', 'Graded at', 'Posted at', 'Submitted at', 'Due at', 'Late', 'Missing', 'Excused', 'Attempt', 'Grade matches current attempt', 'URL', 'Comments', 'Rubric'];
  return [columns, ...rows.map(r => [r.courseName,r.courseCode,r.name,r.grade,r.score,r.pointsPossible,r.gradedAt,r.postedAt,r.submittedAt,r.dueAt,r.late,r.missing,r.excused,r.attempt,r.currentAttempt,r.url,JSON.stringify(r.comments),JSON.stringify(r.rubric)])].map(row => row.map(clean).join('\t')).join('\n');
}
