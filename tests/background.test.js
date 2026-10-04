import test from 'node:test';
import assert from 'node:assert/strict';
test('daily receipts, manual override, attachments and failed sends',async()=>{
 const state={};const events={};let posts=0;let fail=false;
 const event=name=>({addListener:fn=>events[name]=fn});
 globalThis.browser={
  storage:{local:{get:async keys=>Object.fromEntries((Array.isArray(keys)?keys:[keys]).map(k=>[k,state[k]])),set:async values=>Object.assign(state,values)}},
  alarms:{get:async()=>null,create:async()=>{},onAlarm:event('alarm')},
  runtime:{id:'test',onInstalled:event('installed'),onStartup:event('startup'),onMessage:event('message')},
  tabs:{query:async()=>[{id:1,status:'complete'}],get:async()=>({status:'complete'}),onUpdated:event('tab')},
  permissions:{contains:async()=>true},action:{setBadgeText:async()=>{},setBadgeBackgroundColor:async()=>{}},
  scripting:{executeScript:async()=>[{result:{profile:{id:7,name:'Student'},courses:[{id:1,name:'Class',workflow_state:'available',enrollments:[{type:'student',computed_current_score:90}]}],submissions:[],warnings:[]}}]}
 };
 globalThis.fetch=async (url,options)=>{posts++;assert.equal(options.body.get('files[1]').name,'recently-graded.tsv');assert.equal(options.body.get('files[2]').name,'report.json');if(fail) throw new Error('network');return new Response(JSON.stringify({id:'receipt'}));};
 await import('../background.js');
 await events.alarm({name:'grades'});assert.equal(posts,1);assert.equal(Object.keys(state.dailySent).length,1);
 await events.alarm({name:'grades'});assert.equal(posts,1);
 const send=()=>new Promise(resolve=>events.message({type:'send'},{id:'test'},resolve));
 assert.equal((await send()).ok,true);assert.equal(posts,2);
 state.dailySent={};state.dailyAttempts={};fail=true;
 await events.alarm({name:'grades'});assert.equal(posts,3);assert.match(state.error,/could not confirm/);
 await events.alarm({name:'grades'});assert.equal(posts,3);
});
