// Supplied by the user. Grades are always read live from Canvas.
export const suppliedCourses = [
  ['Conservation of Biodiversity','ESC 1100',3],
  ['Musicianship 3','MUS 2710',2],
  ['Musicianship Lab 3','MUS 2730',1],
  ['Aural Skills 3','MUS 2750',2],
  ['Basic Conducting','MUS 3030',2],
  ['History of Music 1','MUS 3150',3],
  ['Voice Instruction','MUS 2550',1],
  ['Seminar','MUS 1000',0],
  ['Orpheus Chorale','MUS 0027',0],
  ['Chattanooga Singers','MUS 0020',1]
].map(([name,code,credits]) => ({name,code,credits}));
export const accountKey = (origin, profile) => `${origin}|${profile.id}`;
export function defaultDetails(profile) {
  return profile.name.trim().toLowerCase() === 'christian cantrell' ? suppliedCourses : [];
}
export function validateDetails(value) {
  if (!Array.isArray(value)) throw new Error('Course details must be a JSON array.');
  for (const row of value) {
    if (!row || typeof row.name !== 'string' || typeof row.code !== 'string' || !row.code.trim() || typeof row.credits !== 'number' || !Number.isFinite(row.credits) || row.credits < 0 || row.credits > 30) throw new Error('Each course needs a name, code, and numeric credits from 0 to 30.');
  }
  return value;
}
