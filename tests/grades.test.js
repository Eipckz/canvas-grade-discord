import test from 'node:test';
import assert from 'node:assert/strict';
import {nextCheck, localDate, isReportingDay} from '../calendar.js';
import {recentlyGraded, submissionSnapshot, recentTSV} from '../recent.js';
import {messagesFor} from '../core.js';
const grades=[{id:1,name:'Course',code:'MUS 1000',grade:'90',score:90,credits:3}];
const row={courseId:1,assignmentId:2,name:'Quiz',grade:'9',score:9,gradedAt:'2026-09-30T12:00:00Z',comments:[],rubric:null};
test('daily scheduling includes Monday and respects DST',()=>{
 assert.equal(isReportingDay(new Date('2026-10-05T12:00:00Z')),true);
 assert.equal(new Date(nextCheck(new Date('2026-10-05T12:00:00Z'))).toISOString(),'2026-10-05T22:00:00.000Z');
 assert.equal(new Date(nextCheck(new Date('2026-11-02T12:00:00Z'))).toISOString(),'2026-11-02T23:00:00.000Z');
 assert.equal(localDate(new Date('2026-10-05T02:00:00Z')),'2026-10-04');
});
test('recent items and changed old feedback are retained, unrelated courses excluded',()=>{
 const old={...row,assignmentId:3,gradedAt:'2026-01-01T12:00:00Z'};
 const previous=submissionSnapshot([old]);
 const changed={...old,comments:[{text:'Updated feedback'}]};
 assert.equal(recentlyGraded([row,changed,{...row,courseId:99}],grades,previous,new Date('2026-10-04')).length,2);
 assert.equal(recentlyGraded([old],grades,previous,new Date('2026-10-04')).length,0);
});
test('recent TSV escapes spreadsheet formulas and preserves feedback',()=>{
 const text=recentTSV([{...row,name:'=IMPORTDATA("x")',comments:[{text:'Good\nwork'}]}]);
 assert.ok(text.includes("'=IMPORTDATA"));assert.ok(text.includes('Good\\nwork'));assert.equal(text.split('\n').length,2);
});
test('one Discord message even for oversized reports; mentions disabled',()=>{
 const reports=messagesFor(Array.from({length:100},()=>({...grades[0],name:'x'.repeat(100)})),{name:'@everyone'},'2026-10-04',[row],['unavailable']);
 assert.equal(reports.length,1);assert.ok(reports[0].content.length<=2000);assert.deepEqual(reports[0].allowed_mentions,{parse:[]});assert.equal(reports[0].file.name,'grades.tsv');
});
