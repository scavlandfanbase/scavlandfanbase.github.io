(() => {
  'use strict';
  const endpoint = 'https://demtoqsafufzmnhvaykj.supabase.co/functions/v1/manage-patches';
  const key = 'sb_publishable_0kdLCpTy7Sf8BKkIU5TOqw_Qaay4gzH';
  const $ = id => document.getElementById(id);
  let token = '', state = null, busy = false, ready = false;
  async function api(body) {
    const response = await fetch(endpoint, { method: 'POST', headers: { apikey: key, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not complete the request. Refresh and try again.');
    return data;
  }
  function lock(value) {
    busy = value; $('refresh').disabled = value; $('new-patch').disabled = value || !ready || !state?.canStart;
    $('start').disabled = $('cancel').disabled = value;
    $('patch-id').disabled = $('confirm-all').disabled = value;
  }
  function render() {
    const settings = state.settings, groups = { Items: state.datasets.items, Vendors: state.datasets.vendors, 'Vendor listings': state.datasets.listings ?? state.datasets.vendors.flatMap(v => v.inventory || []) };
    const totals = ScavVerification.progress(Object.values(groups).flat(), settings);
    $('current').textContent = settings.current_patch_id || 'Not set';
    $('started').textContent = settings.patch_started_at ? 'Started: ' + new Date(settings.patch_started_at).toLocaleString() : 'Start date not recorded for this patch.';
    $('summary').textContent = `${totals.verified} / ${totals.total} verified (${totals.percent}%)`;
    $('progress').value = totals.percent;
    $('categories').replaceChildren();
    for (const [name, records] of Object.entries(groups)) {
      const count = ScavVerification.progress(records, settings), row = document.createElement('div'); row.className = 'category';
      const title = document.createElement('strong'), summary = document.createElement('p'); title.textContent = name;
      summary.textContent = `${count.verified} / ${count.total} verified · ${count['patch-check-needed']} patch checks · ${count.unverified} unverified`;
      row.append(title, summary); $('categories').append(row);
    }
    $('permission').textContent = state.canStart ? 'Only the Owner can start a new patch.' : state.owner ? 'New Patch is disabled pending release approval.' : 'Only the Owner can start a new patch. You can review progress here.';
    $('history').replaceChildren();
    for (const event of [...(settings.patch_history || [])].reverse()) {
      const item = document.createElement('li'); item.textContent = `${event.patch_id} — ${new Date(event.started_at).toLocaleString()} — All categories`; $('history').append(item);
    }
    if (!$('history').children.length) { const item = document.createElement('li'); item.textContent = 'No patch transitions recorded yet.'; $('history').append(item); }
  }
  async function load() {
    if (busy) return;
    ready = false; lock(true); $('retry-load').hidden = true; $('status').textContent = 'Loading current patch…';
    try { const latest = await api({ action: 'read' }); state = latest; render(); ready = true; $('workspace').hidden = false; $('status').textContent = 'Ready'; }
    catch (error) { $('status').textContent = error.message; $('retry-load').hidden = false; }
    finally { lock(false); }
  }
  $('refresh').onclick = load;
  $('retry-load').onclick = load;
  $('new-patch').onclick = () => {
    if (busy || !ready || !state?.canStart) return;
    $('patch-form').reset(); $('save-error').textContent = ''; $('confirm-dialog').showModal(); $('patch-id').focus();
  };
  function close() {
    if (busy) return;
    if ($('patch-id').value && !confirm('Discard this new patch entry?')) return;
    $('confirm-dialog').close(); $('new-patch').focus();
  }
  $('cancel').onclick = close;
  $('confirm-dialog').addEventListener('cancel', event => { event.preventDefault(); close(); });
  $('patch-form').onsubmit = async event => {
    event.preventDefault(); if (busy || !ready || !state?.canStart || !$('patch-form').reportValidity()) return;
    const patchId = $('patch-id').value.trim();
    lock(true); $('save-error').textContent = ''; $('status').textContent = 'Starting patch…';
    try {
      const saved = await api({ action: 'start', patchId, scope: 'everything', confirm: true, expectedSha: state.sha });
      state = { ...state, ...saved }; render(); $('confirm-dialog').close(); $('status').textContent = 'Patch started. Previous information and verification history were preserved.';
    } catch (error) {
      // A lost response may follow a successful write: require an authoritative refresh.
      ready = false; $('save-error').textContent = error.message + ' Close this dialog and refresh before trying again.';
      $('status').textContent = 'Refresh required before another patch change.';
    } finally { lock(false); if (!$('confirm-dialog').open) $('new-patch').focus(); else if (!ready) $('start').disabled = true; }
  };
  window.addEventListener('beforeunload', event => { if (busy || $('confirm-dialog').open && $('patch-id').value) { event.preventDefault(); event.returnValue = ''; } });
  window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== parent || event.data?.type !== 'scavland-admin-token' || typeof event.data.token !== 'string' || busy) return;
    token = event.data.token; load();
  });
  if (parent !== window) parent.postMessage({ type: 'scavland-admin-ready' }, location.origin);
})();
