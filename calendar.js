export const TIME_ZONE = 'America/New_York';
export function easternParts(date = new Date()) {
  return Object.fromEntries(new Intl.DateTimeFormat('en-US', {timeZone:TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',hourCycle:'h23',minute:'2-digit'}).formatToParts(date).map(p=>[p.type,p.value]));
}
export function isReportingDay(date = new Date()) {
  return true;
}
export function localDate(date = new Date()) {
  const p=easternParts(date);return `${p.year}-${p.month}-${p.day}`;
}
export function reportingWeek(date = new Date()) {
  const d=new Date(localDate(date)+'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + (7-d.getUTCDay())%7);
  return d.toISOString().slice(0,10); // Week ending Sunday, Eastern calendar.
}
export function nextCheck(now = new Date()) {
  const start=Math.floor(now.getTime()/3600000)*3600000;
  for(let i=1;i<=8*24;i++) {
    const time=start+i*3600000;
    const p=easternParts(new Date(time));
    if(p.hour==='18') return time;
  }
  throw new Error('Could not determine next reporting day.');
}
