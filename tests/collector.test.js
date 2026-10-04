import test from 'node:test';
import assert from 'node:assert/strict';
import {collectCanvas} from '../collector.js';
const origin='https://utchattanooga.instructure.com';
function response(data, link, status=200) { return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json',...(link ? {link} : {})}}); }
test('collector paginates, includes zero scores, and isolates accounts',async()=>{
 globalThis.location={origin};
 globalThis.fetch=async url=>{
  if(url.includes('/profile')) return response({id:7,name:'Student'});
  if(new URL(url).pathname==='/api/v1/courses') return response([{id:1,workflow_state:'available',enrollments:[{user_id:7}]}]);
  return url.includes('page=2') ? response([{assignment_id:3,user_id:7,score:10,grade:'10'}]) : response([{assignment_id:2,user_id:7,score:0,grade:'0'}],`<${origin}/api/v1/courses/1/students/submissions?page=2>; rel="next"`);
 };
 const result=await collectCanvas(origin);assert.equal(result.submissions.length,2);assert.equal(result.submissions[0].score,0);
 globalThis.fetch=async url=>url.includes('/profile') ? response({id:7,name:'Student'}) : new URL(url).pathname==='/api/v1/courses' ? response([{id:1,workflow_state:'available'}]) : response([{user_id:8,grade:'A'}]);
 assert.match((await collectCanvas(origin)).error,/another account/);
});
test('assignments fallback works when bulk submissions denied',async()=>{
 globalThis.location={origin};
 globalThis.fetch=async url=>{
  if(url.includes('/profile')) return response({id:7,name:'Student'});
  if(new URL(url).pathname==='/api/v1/courses') return response([{id:1,workflow_state:'available'}]);
  if(url.includes('/students/')) return response({},null,403);
  return response([{id:2,name:'Quiz',points_possible:10,submission:{user_id:7,score:8,grade:'8'}}]);
 };
 const result=await collectCanvas(origin);assert.equal(result.submissions[0].name,'Quiz');assert.match(result.warnings[0],/fallback/);
});
