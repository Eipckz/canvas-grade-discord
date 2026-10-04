// Runs in Canvas's isolated extension world. No credentials leave this origin.
export async function collectCanvas(expectedOrigin) {
  try {
    if (location.origin !== expectedOrigin) throw new Error('Open Canvas and sign in, then try again.');
    async function profile() {
      const res = await fetch(`${expectedOrigin}/api/v1/users/self/profile`, {credentials: 'same-origin', headers: {Accept: 'application/json'}, signal: AbortSignal.timeout(20000)});
      if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) throw new Error('Cannot identify your Canvas account. Open Canvas and sign in again.');
      const user = await res.json();
      if (!user.id || typeof user.name !== 'string' || !user.name.trim()) throw new Error('Canvas did not return an account name. Nothing was sent.');
      return {id: String(user.id), name: user.name};
    }
    const before = await profile();
    let next = `${expectedOrigin}/api/v1/courses?enrollment_type=student&enrollment_state=active&include[]=total_scores&per_page=100`;
    const all = []; const seen = new Set();
    while (next) {
      const u = new URL(next, expectedOrigin);
      if (u.origin !== expectedOrigin || u.pathname !== '/api/v1/courses' || seen.has(u.href)) throw new Error('Unexpected Canvas pagination response.');
      seen.add(u.href);
      if (seen.size > 100) throw new Error('Canvas returned too many pages.');
      const res = await fetch(u.href, {credentials: 'same-origin', headers: {Accept: 'application/json'}, signal: AbortSignal.timeout(20000)});
      if (!res.ok) throw new Error(`Canvas returned HTTP ${res.status}. Open Canvas and confirm you are signed in.`);
      if (!res.headers.get('content-type')?.includes('application/json')) throw new Error('Canvas needs you to sign in again.');
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error('Canvas returned an unexpected course list.');
      all.push(...data);
      next = (res.headers.get('link') || '').match(/<([^>]+)>;\s*rel="next"/)?.[1] || null;
    }
    const recent = []; const warnings = [];
    // Fetch all submission pages so newly posted older grades are not lost to a date filter.
    for (const course of all.filter(c => c.workflow_state === 'available' && !c.hide_final_grades)) {
      try {
        const path = `/api/v1/courses/${encodeURIComponent(course.id)}/students/submissions`;
        let page = `${expectedOrigin}${path}?student_ids[]=${encodeURIComponent(before.id)}&include[]=assignment&include[]=submission_comments&include[]=rubric_assessment&include[]=visibility&per_page=100`;
        const visited = new Set();
        while (page) {
          const url = new URL(page, expectedOrigin);
          if (url.origin !== expectedOrigin || url.pathname !== path || visited.has(url.href) || visited.size >= 100) throw new Error('Unexpected submission pagination.');
          visited.add(url.href);
          const response = await fetch(url.href, {credentials:'same-origin', headers:{Accept:'application/json'}, signal:AbortSignal.timeout(20000)});
          if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error(`Submissions unavailable (HTTP ${response.status}).`);
          const submissions = await response.json();
          if (!Array.isArray(submissions)) throw new Error('Unexpected submission list.');
          for (const s of submissions) {
            if (String(s.user_id) !== before.id) throw new Error('Submissions belong to another account.');
            if (s.assignment_visible === false || s.grade == null && s.score == null && !s.excused) continue;
            recent.push({courseId:course.id, assignmentId:s.assignment_id, name:s.assignment?.name || `Assignment ${s.assignment_id}`, score:s.score ?? null, grade:s.grade ?? null, pointsPossible:s.assignment?.points_possible ?? null, gradedAt:s.graded_at ?? null, postedAt:s.posted_at ?? null, submittedAt:s.submitted_at ?? null, dueAt:s.cached_due_date ?? s.assignment?.due_at ?? null, late:!!s.late, missing:!!s.missing, excused:!!s.excused, attempt:s.attempt, currentAttempt:s.grade_matches_current_submission, url:s.assignment?.html_url || `${expectedOrigin}/courses/${course.id}/assignments/${s.assignment_id}`, comments:(s.submission_comments || []).map(c => ({author:c.author_name, text:c.comment, createdAt:c.created_at})), rubric:s.rubric_assessment ?? null});
          }
          page = (response.headers.get('link') || '').match(/<([^>]+)>;\s*rel="next"/)?.[1] || null;
        }
      } catch (e) {
        if (e.message === 'Submissions belong to another account.') throw e;
        // Some Canvas deployments deny the bulk submissions endpoint to students.
        try {
          const path = `/api/v1/courses/${encodeURIComponent(course.id)}/assignments`;
          let page = `${expectedOrigin}${path}?include[]=submission&per_page=100`;
          const visited = new Set();
          while (page) {
            const url = new URL(page, expectedOrigin);
            if (url.origin !== expectedOrigin || url.pathname !== path || visited.has(url.href) || visited.size >= 100) throw new Error('Unexpected assignment pagination.');
            visited.add(url.href);
            const response = await fetch(url.href, {credentials:'same-origin', headers:{Accept:'application/json'}, signal:AbortSignal.timeout(20000)});
            if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error(`HTTP ${response.status}`);
            const assignments = await response.json();
            if (!Array.isArray(assignments)) throw new Error('Unexpected assignment list.');
            for (const a of assignments) {
              const s = a.submission;
              if (!s) continue;
              if (String(s.user_id) !== before.id) throw new Error('Submissions belong to another account.');
              if (s.assignment_visible === false || s.grade == null && s.score == null && !s.excused) continue;
              const key = recent.findIndex(r => String(r.courseId) === String(course.id) && String(r.assignmentId) === String(a.id));
              if (key >= 0) continue;
              recent.push({courseId:course.id,assignmentId:a.id,name:a.name,score:s.score ?? null,grade:s.grade ?? null,pointsPossible:a.points_possible ?? null,gradedAt:s.graded_at ?? null,postedAt:s.posted_at ?? null,submittedAt:s.submitted_at ?? null,dueAt:s.cached_due_date ?? a.due_at ?? null,late:!!s.late,missing:!!s.missing,excused:!!s.excused,attempt:s.attempt,currentAttempt:s.grade_matches_current_submission,url:a.html_url || `${expectedOrigin}/courses/${course.id}/assignments/${a.id}`,comments:[],rubric:s.rubric_assessment ?? null});
            }
            page = (response.headers.get('link') || '').match(/<([^>]+)>;\s*rel="next"/)?.[1] || null;
          }
          warnings.push(`Course ${course.id}: used assignment fallback; comments may be unavailable.`);
        } catch (fallback) {
          if (fallback.message === 'Submissions belong to another account.') throw fallback;
          warnings.push(`Course ${course.id}: ${e.message} Fallback: ${fallback.message}`);
        }
      }
    }
    const after = await profile();
    if (before.id !== after.id) throw new Error('Canvas accounts changed during this check. Retry on the intended account.');
    if (all.some(c => (c.enrollments || []).some(e => e.user_id != null && String(e.user_id) !== before.id))) throw new Error('Canvas returned enrollments for a different account. Retry after reloading Canvas.');
    return {courses: all, profile: after, submissions: recent, warnings};
  } catch (e) { return {error: e.message}; }
}
