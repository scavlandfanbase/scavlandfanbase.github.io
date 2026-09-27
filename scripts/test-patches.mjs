import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHandler, startPatch } from '../supabase/functions/manage-patches/handler.mjs';
const initial = JSON.parse(fs.readFileSync('data/verification-settings.json', 'utf8'));
const now = new Date('2026-09-23T14:00:00Z');
const envValues = { SUPABASE_URL: 'https://auth.invalid', SUPABASE_ANON_KEY: 'public-test', GITHUB_TOKEN: 'test-github', SUPABASE_SERVICE_ROLE_KEY:'private-test', PATCH_MANAGEMENT_ENABLED: 'true' };
let doc, sha, puts, calls, owner, admin, user, conflict, enabled, lost, invalidHistory, audits;
function reset() { doc = structuredClone(initial); sha = 'settings-a'; puts = []; calls = []; audits=[]; owner = admin = user = enabled = true; conflict = lost = invalidHistory = false; }
const response = (data, status = 200) => new Response(JSON.stringify(data), { status });
async function transport(url, options = {}) {
  calls.push({ url, options });
  if (url.endsWith('/auth/v1/user')) return response({ id: 'trusted-owner' }, user ? 200 : 401);
  if (url.endsWith('/is_scavland_admin')) return response(admin);
  if (url.endsWith('/is_scavland_owner')) return response(owner);
  if(url.endsWith('/scavland_patch_history')){const patch=JSON.parse(options.body).p_patch;return response(audits.findLast(a=>a.p_settings.current_patch_id===patch)?.p_settings||null);}
  if(url.endsWith('/scavland_patch_audit')){assert.equal(options.headers.Authorization,'Bearer private-test');audits.push(JSON.parse(options.body));return response(true);}
  if (url.endsWith('/git/ref/heads/main')) return response({ object: { sha: 'snapshot' } });
  if (url.includes('/contents/')) {
    if (options.method === 'PUT') {
      puts.push(JSON.parse(options.body));
      if (conflict) return response({}, 409);
      doc = JSON.parse(Buffer.from(puts.at(-1).content, 'base64').toString()); sha = 'settings-b';
      if (lost) throw new Error('response lost');
      return response({ content: { sha } });
    }
    assert.ok(url.endsWith('?ref=snapshot'), 'All reads must use one commit');
    const name = new URL(url).pathname.split('/contents/')[1];
    let data = name.endsWith('verification-settings.json') ? doc : JSON.parse(fs.readFileSync(name, 'utf8'));
    if (invalidHistory && name.endsWith('verification-settings.json')) data = { ...doc, patch_history: {} };
    return response({ sha, content: Buffer.from(JSON.stringify(data)).toString('base64') });
  }
  throw new Error('Unexpected network access ' + url);
}
const handler = createHandler({ env: key => key === 'PATCH_MANAGEMENT_ENABLED' ? String(enabled) : envValues[key], fetcher: transport, clock: () => now });
const request = (body, auth = true) => handler(new Request('https://test.invalid', { method: 'POST', headers: auth ? { Authorization: 'Bearer fixture' } : {}, body: JSON.stringify(body) }));
const start = { action: 'start', expectedSha: 'settings-a', patchId: 'test-0.8.0', scope: 'everything', confirm: true, actorId: 'forged', started_at: '1900-01-01' };
reset(); assert.equal((await request({ action: 'read' }, false)).status, 403); assert.equal(calls.length, 0);
reset(); user = false; assert.equal((await request(start)).status, 403); assert.equal(puts.length, 0);
reset(); admin = false; assert.equal((await request(start)).status, 403); assert.equal(puts.length, 0);
reset(); owner = false; assert.equal((await request(start)).status, 403); assert.equal(puts.length, 0);
let read = await (await request({ action: 'read' })).json(); assert.equal(read.canStart, false); assert.equal(read.settings.current_patch_id, '0.7.2');
reset(); enabled = false; assert.equal((await request(start)).status, 503); assert.equal(puts.length, 0);
reset(); assert.equal((await request({ ...start, expectedSha: 'stale' })).status, 409); assert.equal(puts.length, 0);
for (const changed of [{ confirm: false }, { scope: 'weapons' }, { patchId: '0.7.2' }, { patchId: '../oops' }, { patchId: '<script>' }, { patchId: '' }]) {
  reset(); assert.equal((await request({ ...start, ...changed })).status, 400); assert.equal(puts.length, 0);
}
reset(); conflict = true; assert.equal((await request(start)).status, 409); assert.equal(doc.current_patch_id, '0.7.2');
reset(); invalidHistory = true; assert.equal((await request(start)).status, 502); assert.equal(puts.length, 0);
reset(); const saved = await request(start); assert.equal(saved.status, 200);
assert.equal(puts.length, 1); assert.equal(puts[0].sha, 'settings-a'); assert.equal(puts[0].branch, 'main');
assert.equal(doc.current_patch_id, 'test-0.8.0'); assert.equal(doc.patch_history,undefined);assert.equal(audits[0].p_actor,'trusted-owner');assert.equal(audits[0].p_settings.patch_history[0].started_by,'trusted-owner');assert(!JSON.stringify(doc).includes('trusted-owner')); assert.equal(doc.patch_started_at,undefined);assert.equal(audits[0].p_settings.patch_started_at,now.toISOString());
assert.equal(audits[0].p_settings.patch_history[0].previous_patch_id,'0.7.2');
assert.equal((await request(start)).status, 409, 'Duplicate request cannot write twice'); assert.equal(puts.length, 1);
assert.throws(() => startPatch(audits[0].p_settings, '0.7.2', 'owner', now), /already been used/);
assert.throws(() => startPatch(doc, 'TEST-0.8.0', 'owner', now), /already been used/);
const later = startPatch(audits[0].p_settings, 'test-0.9.0', 'owner', now); assert.equal(later.patch_history.length, 2); assert.equal(audits[0].p_settings.patch_history.length,1);
reset(); lost = true; assert.equal((await request(start)).status, 502); lost = false;
read = await (await request({ action: 'read' })).json(); assert.equal(read.settings.current_patch_id, 'test-0.8.0'); assert.equal(puts.length, 1);
assert.ok(calls.filter(x => x.options.method === 'PUT').every(x => x.url.endsWith('/data/verification-settings.json')));
console.log('PASS: offline handler authorization, disabled writes, consistent snapshot reads, validation, conflicts, audit identity/clock, history, duplicate/old patch rejection, lost response recovery. No external requests.');
