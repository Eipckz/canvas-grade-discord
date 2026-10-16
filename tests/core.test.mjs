// node tests/core.test.mjs
import assert from 'node:assert/strict';
import {letterOf, letterChanges, changeMessage, newerVersion, gradesFromCourses} from '../Canvas Grades Extension/core.js';

assert.equal(letterOf({letter: 'B+', score: 89}), 'B');
assert.equal(letterOf({letter: null, score: 90}), 'A');
assert.equal(letterOf({letter: null, score: 59.9}), 'F');
assert.equal(letterOf({grade: 'Hidden', score: null, letter: null}), null);
assert.equal(letterOf({letter: 'Pass', score: null}), null);

const g = (id, score, letter = null) => ({id, name: `Course ${id}`, code: `MUS ${id}`, score, letter, grade: String(score)});
let r = letterChanges(undefined, [g(1, 85)]);
assert.deepEqual(r.changes, [], 'first sighting is a baseline, not a change');
r = letterChanges(r.next, [g(1, 92)]);
assert.equal(r.changes.length, 1);
assert.deepEqual([r.changes[0].from, r.changes[0].to, r.changes[0].up], ['B', 'A', true]);
r = letterChanges(r.next, [g(1, 91, 'A-')]);
assert.deepEqual(r.changes, [], 'A to A- is not a letter change');
r = letterChanges(r.next, [g(1, 68)]);
assert.deepEqual([r.changes[0].from, r.changes[0].to, r.changes[0].up], ['A', 'D', false]);
r = letterChanges(r.next, [{...g(1, null), grade: 'Hidden'}]);
assert.deepEqual([r.changes, r.next[1]], [[], 'D'], 'hidden grades keep the last known letter');

const msg = changeMessage([{code: 'MUS 2710', name: 'Musicianship_3', from: 'B', to: 'A', score: 92, up: true}], {name: 'Test *User*'});
assert.match(msg.content, /Letter grade change — Test \\\*User\\\*/);
assert.match(msg.content, /⬆️ \*\*MUS 2710 Musicianship\\_3\*\*: B → A \(92%\)/);
assert.deepEqual(msg.allowed_mentions, {parse: []});

assert.equal(newerVersion('1.10.0', '1.9.9'), true);
assert.equal(newerVersion('1.4.0', '1.4.0'), false);
assert.equal(newerVersion('1.3.9', '1.4'), false);

const rows = gradesFromCourses([{id: 7, workflow_state: 'available', name: 'MUS 2710 Musicianship 3', enrollments: [{type: 'student', computed_current_score: 85, computed_current_grade: 'B'}]}]);
assert.equal(letterOf(rows[0]), 'B');
console.log('core tests passed');
