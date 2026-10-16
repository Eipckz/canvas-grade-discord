// Fake Canvas + Discord webhook API so tests never touch real grades or the real channel.
import http from 'node:http';
import https from 'node:https';

export function mockServer() {
  const state = {
    profile: {id: 42, name: 'Test Student'},
    courses: [
      {id: 1, name: 'MUS 2710 Musicianship 3', score: 85, letter: 'B'},
      {id: 2, name: 'ESC 1100 Conservation of Biodiversity', score: 93.5, letter: 'A'},
    ],
    posts: [], releaseChecks: 0, messages: new Map(), files: new Map(), nextId: 1000,
  };
  const json = (res, body, status = 200) => { res.writeHead(status, {'content-type': 'application/json; charset=utf-8'}); res.end(JSON.stringify(body)); };
  const message = (req, id) => {
    const m = state.messages.get(id);
    return {id, content: m.content, attachments: m.attachments.map(name => ({filename: name, url: `${req.headers['x-forwarded-proto'] || (req.socket.encrypted ? 'https' : 'http')}://${req.headers.host}/attachments/${name}?ex=1&hm=2`}))};
  };
  async function handle(req, res) {
    const url = new URL(req.url, 'http://x');
    const chunks = []; for await (const c of req) chunks.push(c);
    const body = Buffer.concat(chunks);
    const form = () => new Request('http://x', {method: 'POST', headers: {'content-type': req.headers['content-type']}, body}).formData();
    if (url.pathname === '/api/v1/users/self/profile') return json(res, state.profile);
    if (url.pathname === '/api/v1/courses') return json(res, state.courses.map(c => ({id: c.id, name: c.name, course_code: c.name, workflow_state: 'available', enrollments: [{type: 'student', user_id: state.profile.id, computed_current_score: c.score, computed_current_grade: c.letter}]})));
    if (url.pathname.startsWith('/attachments/')) { res.end(state.files.get(decodeURIComponent(url.pathname.slice(13)))); return; }
    const hook = url.pathname.match(/^\/api\/webhooks\/\d+\/[\w-]+(?:\/messages\/(\d+))?$/);
    if (hook && req.method === 'GET') { state.releaseChecks++; return state.messages.has(hook[1]) ? json(res, message(req, hook[1])) : json(res, {message: 'Unknown Message'}, 404); }
    if (hook && (req.method === 'POST' || req.method === 'PATCH')) {
      let payload, attachments = [];
      if (req.headers['content-type']?.startsWith('multipart/')) {
        const f = await form();
        payload = JSON.parse(f.get('payload_json'));
        for (const [k, v] of f) if (k.startsWith('files[')) { state.files.set(v.name, Buffer.from(await v.arrayBuffer())); attachments.push(v.name); }
      } else payload = JSON.parse(body);
      const id = hook[1] || String(state.nextId++);
      state.messages.set(id, {content: payload.content, attachments});
      state.posts.push({method: req.method, id, content: payload.content, attachments, text: attachments.map(a => state.files.get(a).toString()).join('\n')});
      return json(res, message(req, id));
    }
    res.writeHead(200, {'content-type': 'text/html'}); res.end('<!doctype html><title>Mock Canvas</title><h1>Mock Canvas dashboard</h1>');
  }
  const handler = (req, res) => handle(req, res).catch(e => { res.writeHead(500); res.end(String(e)); });
  return {
    state,
    listen: (port, tls) => new Promise((ok, fail) => { const s = tls ? https.createServer(tls, handler) : http.createServer(handler); s.on('error', fail).listen(port, '127.0.0.1', () => ok(s)); }),
  };
}
