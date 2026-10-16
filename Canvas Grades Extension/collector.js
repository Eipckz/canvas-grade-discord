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
    const after = await profile();
    if (before.id !== after.id) throw new Error('Canvas accounts changed during this check. Retry on the intended account.');
    if (all.some(c => (c.enrollments || []).some(e => e.user_id != null && String(e.user_id) !== before.id))) throw new Error('Canvas returned enrollments for a different account. Retry after reloading Canvas.');
    return {courses: all, profile: after};
  } catch (e) { return {error: e.message}; }
}
