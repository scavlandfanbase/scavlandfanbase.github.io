const cors = { 'Access-Control-Allow-Origin': 'https://scavlandfanbase.github.io', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const path = 'data/verification-settings.json';
const root = 'https://api.github.com/repos/scavlandfanbase/scavlandfanbase.github.io';
const decode = content => new TextDecoder().decode(Uint8Array.from(atob(content.replace(/\n/g, '')), c => c.charCodeAt(0)));
const encode = value => btoa(Array.from(new TextEncoder().encode(JSON.stringify(value, null, 2) + '\n'), c => String.fromCharCode(c)).join(''));
export const categories = { items: 'Items', weapons: 'Weapons', armour: 'Armour', ammo: 'Ammo', crafting: 'Crafting', vendors: 'Vendors' };

export function startPatch(settings, patch, actor, now) {
  if (settings?.schemaVersion !== 1 || !(settings.current_patch_id === null || typeof settings.current_patch_id === 'string')) fail('Current patch settings are invalid.', 502);
  if (typeof patch !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(patch)) fail('Use a patch identifier of up to 64 letters, numbers, dots, underscores or hyphens.');
  const history = settings.patch_history ?? [];
  if (!Array.isArray(history) || history.some(e => !e || typeof e.patch_id !== 'string' || typeof e.previous_patch_id !== 'string' && e.previous_patch_id !== null || typeof e.started_at !== 'string' || e.started_by !== undefined && typeof e.started_by !== 'string' || e.scope !== 'everything')) fail('Patch history is invalid.', 502);
  const used = [settings.current_patch_id, ...history.flatMap(e => [e.patch_id, e.previous_patch_id])].filter(Boolean);
  if (used.some(id => id.toLowerCase() === patch.toLowerCase())) fail('This patch has already been used. Enter a new identifier.');
  const event = { patch_id: patch, previous_patch_id: settings.current_patch_id, started_at: now.toISOString(), started_by: actor, scope: 'everything' };
  return { ...settings, current_patch_id: patch, patch_started_at: event.started_at, patch_history: [...history, event] };
}

// Injected transport/clock keep the complete authorization + write path testable offline.
export function createHandler({ env, fetcher = fetch, clock = () => new Date() }) {
  return async req => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
    if (req.method !== 'POST') return reply({ error: 'POST is required.' }, 405);
    try {
      const sb = env('SUPABASE_URL'), key = env('SUPABASE_ANON_KEY'), github = env('GITHUB_TOKEN');
      if (!sb || !key || !github) fail('Patch Management is not configured.', 503);
      const auth = req.headers.get('Authorization') || '';
      if (!auth.startsWith('Bearer ')) fail('Sign in first.', 403);
      const headers = { apikey: key, Authorization: auth, 'Content-Type': 'application/json' };
      const userResponse = await fetcher(sb + '/auth/v1/user', { headers });
      if (!userResponse.ok) fail('Your session expired. Sign in again.', 403);
      const user = await userResponse.json();
      if (!user?.id) fail('Sign in again.', 403);
      const rpc = async name => {
        const response = await fetcher(sb + '/rest/v1/rpc/' + name, { method: 'POST', headers, body: '{}' });
        return response.ok && await response.json() === true;
      };
      if (!await rpc('is_scavland_admin')) fail('Admin access is required.', 403);
      let body; try { body = await req.json(); } catch { fail('Request must be valid JSON.'); }
      if (!body || !['read', 'start'].includes(body.action)) fail('Unknown patch action.');
      const owner = await rpc('is_scavland_owner');
      if (body.action === 'start' && !owner) fail('Only the Owner can start a new patch.', 403);
      const enabled = env('PATCH_MANAGEMENT_ENABLED') === 'true';
      if (body.action === 'start' && !enabled) fail('Patch changes are disabled pending release approval.', 503);
      const ghHeaders = { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + github, 'X-GitHub-Api-Version': '2022-11-28' };
      const gh = async suffix => {
        const response = await fetcher(root + suffix, { headers: ghHeaders });
        if (!response.ok) fail('Could not read current patch data. Try again.', 502);
        return response.json();
      };
      // One revision for settings and all progress inputs, never mixed cached snapshots.
      const ref = await gh('/git/ref/heads/main');
      const read = async name => {
        const file = await gh('/contents/' + name + '?ref=' + encodeURIComponent(ref.object.sha));
        return { sha: file.sha, data: JSON.parse(decode(file.content)) };
      };
      const file = await read(path);
      if (file.data?.schemaVersion !== 1 || !(file.data.current_patch_id === null || typeof file.data.current_patch_id === 'string')) fail('Current patch settings are invalid.', 502);
      const service = env('SUPABASE_SERVICE_ROLE_KEY');
      if(!service)fail('Private patch audit is not configured.',503);
      const privateResponse=await fetcher(sb+'/rest/v1/rpc/scavland_patch_history',{
        method:'POST',headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'},
        body:JSON.stringify({p_patch:file.data.current_patch_id}),
      });
      if(!privateResponse.ok)fail('Could not load private patch history.',503);
      const recorded=await privateResponse.json();
      const adminSettings=recorded?.current_patch_id===file.data.current_patch_id?recorded:file.data;
      if (body.action === 'read') {
        const documents = Object.fromEntries(await Promise.all(Object.keys(categories).map(async name => {
          const doc = (await read('data/' + name + '.json')).data;
          if (!Array.isArray(doc.data)) fail('A content dataset could not be read.', 502);
          return [name, doc];
        })));
        const datasets=Object.fromEntries(Object.entries(documents).map(([name,doc])=>[name,doc.data]));
        const items=new Map(datasets.items.map(item=>[item.id,item])),vendors=new Map(datasets.vendors.map(vendor=>[vendor.id,vendor]));
        datasets.listings=(documents.vendors.vendorListings?.listings||[]).filter(row=>!row.archived).map(row=>({...row,name:items.get(row.entity?.id)?.name||row.entity?.id||'Unknown Item',dashboardVendorName:vendors.get(row.vendorId)?.name||row.vendorId}));
        return reply({ settings: adminSettings, sha: file.sha, datasets, canStart: owner && enabled, owner });
      }
      if (body.confirm !== true || body.scope !== 'everything') fail('Confirm that all categories require review.');
      if (typeof body.expectedSha !== 'string' || body.expectedSha !== file.sha) fail('Another patch change was saved. Refresh before continuing.', 409);
      const privateSettings = startPatch(adminSettings, body.patchId, user.id, clock());
      const audit = await fetcher(sb+'/rest/v1/rpc/scavland_patch_audit',{
        method:'POST',headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'},
        body:JSON.stringify({p_actor:user.id,p_base:file.sha,p_settings:privateSettings}),
      });
      if(!audit.ok||await audit.json()!==true)fail('Could not record the private patch audit. No public patch change was made.',503);
      // Never put the authenticated owner's identity in a public GitHub document.
      const settings = {schemaVersion:1,current_patch_id:privateSettings.current_patch_id};
      const response = await fetcher(root + '/contents/' + path, {
        method: 'PUT', headers: { ...ghHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch: 'main', sha: file.sha, message: 'Start game patch ' + settings.current_patch_id, content: encode(settings) }),
      });
      if (!response.ok) fail(response.status === 409 || response.status === 422 ? 'Another change was saved. Refresh before continuing.' : 'The save could not be confirmed. Refresh to check before retrying.', response.status === 409 || response.status === 422 ? 409 : 502);
      const saved = await response.json();
      if (!saved.content?.sha) fail('The save could not be confirmed. Refresh to check before retrying.', 502);
      return reply({ settings:privateSettings, sha: saved.content.sha });
    } catch (error) {
      return reply({ error: error.status ? error.message : 'Patch Management could not complete the request. Refresh to check the latest state.' }, error.status || 502);
    }
  };
}
