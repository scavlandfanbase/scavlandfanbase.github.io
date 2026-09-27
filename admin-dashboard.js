// Read-only maintenance dashboard. Authentication and editor navigation stay in admin.html.
window.createScavDashboard = function ({ hub, read, navigate, allowedViews=null }) {
  const $ = id => document.getElementById(id);
  let state = null, rows = [], loading = false;
  const names = {weapons:'Weapons',armour:'Armour',items:'Items',ammo:'Ammo',vendors:'Vendors',crafting:'Crafting',listings:'Vendor listings'};
  const views = {weapons:'weapons',armour:'armour',items:'items',ammo:'ammunition',vendors:'vendors',crafting:'crafting',listings:'vendors'};
  if(allowedViews)for(const key of Object.keys(names))if(!allowedViews.includes(views[key]))delete names[key];
  const titles = {'verified':'Verified','unverified':'Unverified','patch-check-needed':'Patch check needed'};
  const source = hub.querySelector('.hub-grid'), oldHeader = hub.querySelector(':scope > .panel');
  const analytics = $('analytics-card');
  const dashboard = document.createElement('div'); dashboard.className = 'dashboard';
  dashboard.innerHTML = `<section class="panel dashboard-overview" aria-labelledby="dashboard-title">
    <div><p class="dashboard-eyebrow">SCAVLAND ADMIN</p><h2 id="dashboard-title">Maintenance overview</h2></div>
    <div class="dashboard-actions"><button class="btn" id="dashboard-refresh">Refresh</button><button class="btn" id="dashboard-new-patch" hidden>New Patch</button></div>
    <p id="dashboard-status" role="status" aria-live="polite">Loading verification…</p>
    <div id="dashboard-metrics" hidden><div class="dashboard-patch">CURRENT PATCH <strong id="dashboard-patch"></strong></div>
    <label for="dashboard-progress">Verification <strong id="dashboard-summary"></strong></label><progress id="dashboard-progress" max="100" value="0"></progress>
    <div class="dashboard-counts"><span id="dashboard-current"></span><span id="dashboard-stale"></span><span id="dashboard-unverified"></span></div>
    <p class="status">Includes separate checks for vendor stock. Previous screenshot evidence is retained; it does not establish verification for this patch.</p>
    <button class="btn" id="dashboard-review">Review entries needing attention</button></div>
  </section>
  <section class="dashboard-review panel" id="dashboard-review-panel" hidden aria-labelledby="dashboard-review-title">
    <h2 id="dashboard-review-title" tabindex="-1">Review verification</h2>
    <p class="status">Review the entries below and open their existing editor when needed. Use Items to record a review without requiring evidence, then Preview and Publish the saved draft.</p>
    <div class="dashboard-filters"><label>Category<select id="dashboard-category" aria-label="Review category"><option value="all">All categories</option></select></label>
    <label>Status<select id="dashboard-filter" aria-label="Review status"><option value="attention">Needs attention</option><option value="unverified">Unverified</option><option value="patch-check-needed">Patch check needed</option><option value="verified">Verified</option><option value="all">All statuses</option></select></label>
    <label>Search<input id="dashboard-search" type="search" placeholder="Name or vendor"></label></div>
    <p id="dashboard-results" role="status"></p><div id="dashboard-review-list"></div><button class="btn" id="dashboard-more">Show more</button>
  </section>
  <section aria-labelledby="dashboard-content-title"><h2 id="dashboard-content-title">Content</h2><div id="dashboard-content" class="dashboard-grid"></div></section>
  <section aria-labelledby="dashboard-website-title"><h2 id="dashboard-website-title">Website</h2><div id="dashboard-website" class="dashboard-grid"></div></section>
  <section aria-labelledby="dashboard-admin-title"><h2 id="dashboard-admin-title">Administration</h2><div id="dashboard-admin" class="dashboard-grid"></div></section>`;
  hub.prepend(dashboard); oldHeader.hidden = true; source.classList.add('hidden');
  if (analytics) dashboard.append(analytics);
  function action(parent, text, onclick) { const b = document.createElement('button'); b.className = 'btn'; b.type = 'button'; b.textContent = text; b.onclick = onclick; parent.append(b); return b; }
  function organize() {
    [...source.children].forEach(card => {
      const view = card.querySelector('[data-view]')?.dataset.view;
      const target = ['patches','admin-users','settings'].includes(view) ? 'admin' : ['evidence','content'].includes(view) || card.querySelector('#edit-site') ? 'website' : 'content';
      $('dashboard-'+target).append(card);
    });
  }
  organize();
  const pagesCard=document.createElement('article');pagesCard.className='panel hub-card';
  const pagesHeading=document.createElement('h2');pagesHeading.textContent='Page Builder';
  const pagesDescription=document.createElement('p');pagesDescription.textContent='Create custom pages with sections, text, images and links. Available for local review; live publishing is not enabled.';
  pagesCard.append(pagesHeading,pagesDescription);
  if(['127.0.0.1','localhost'].includes(location.hostname)){
    const link=document.createElement('a');link.className='btn';link.textContent='Open Page Builder';link.href='http://127.0.0.1:4181/';pagesCard.append(link);
  }else{const unavailable=action(pagesCard,'Local review only',()=>{});unavailable.disabled=true;}
  $('dashboard-website').append(pagesCard);
  for (const [key,name] of Object.entries(names)) {
    const option = document.createElement('option'); option.value = key; option.textContent = name; $('dashboard-category').append(option);
    const card = key === 'listings' ? document.createElement('article') : $('dashboard-content').querySelector('[data-view="'+views[key]+'"]').closest('article');
    if (key === 'listings') { card.className = 'panel hub-card'; const h = document.createElement('h2'); h.textContent = name; card.append(h); $('dashboard-content').append(card); }
    const count = document.createElement('p'); count.id = 'dashboard-count-'+key; count.textContent = 'Verification unavailable';
    const review = action(card,'Review '+name,()=>showReview(key)); review.dataset.reviewCategory = key; review.disabled = true; card.insertBefore(count,review);
  }
  for (const name of ['Attachments','Blueprints']) {
    const card = document.createElement('article'); card.className = 'panel hub-card';
    const h = document.createElement('h2'); h.textContent = name; const p = document.createElement('p'); p.textContent = 'Planned — separate editor and verification counts are not available yet.'; card.append(h,p); $('dashboard-content').append(card);
  }
  const images = document.createElement('article'); images.className = 'panel hub-card';
  images.innerHTML = '<h2>Images</h2><p>Use existing image controls in Site Settings. The dedicated Image Manager is planned.</p>';
  const imageAction=action(images,'Open image settings',()=>navigate('settings'));if(allowedViews&&!allowedViews.includes('settings')){imageAction.disabled=true;imageAction.textContent='Not available in Admin 0.1';} $('dashboard-website').append(images);
  const siteSettings = $('dashboard-admin').querySelector('[data-view="settings"]');
  siteSettings.textContent = 'Open Site Settings'; siteSettings.closest('article').querySelector('h2').textContent = 'Site Settings';
  $('dashboard-refresh').onclick = refresh;
  $('dashboard-new-patch').onclick = () => navigate('patches');
  $('dashboard-review').onclick = () => showReview('all');
  let limit = 50;
  function showReview(category) {
    if (!state || loading) return;
    $('dashboard-category').value = category; $('dashboard-filter').value = 'attention'; $('dashboard-search').value = '';
    $('dashboard-review-panel').hidden = false; limit = 50; renderReview(); $('dashboard-review-title').focus(); $('dashboard-review-panel').scrollIntoView({block:'start'});
  }
  function renderReview() {
    const category = $('dashboard-category').value, status = $('dashboard-filter').value, search = $('dashboard-search').value.trim().toLowerCase();
    const filtered = rows.filter(row => (category === 'all' || row.category === category) && (status === 'all' || status === 'attention' && row.status !== 'verified' || row.status === status) && ScavEditor.matches(row.name,search));
    const list = $('dashboard-review-list'); list.replaceChildren();
    $('dashboard-results').textContent = filtered.length ? `${filtered.length} entries · showing ${Math.min(limit,filtered.length)}` : 'No entries match these filters.';
    for (const row of filtered.slice(0,limit)) {
      const item = document.createElement('article'); item.className = 'dashboard-review-row';
      const info = document.createElement('div'), title = document.createElement('strong'), text = document.createElement('p');
      title.textContent = row.name; text.textContent = names[row.category] ; info.append(title,text); ScavEditor.verificationInfo(info,row.inspection);
      if (row.legacy) { const note = document.createElement('p'); note.className = 'status'; note.textContent = 'Previously screenshot-verified; patch and verifier unknown.'; info.append(note); }
      item.append(info); action(item,'Open '+names[row.category]+' editor',()=>navigate(views[row.category])); list.append(item);
    }
    $('dashboard-more').hidden = filtered.length <= limit;
  }
  for (const id of ['dashboard-category','dashboard-filter']) $(id).addEventListener('input',()=>{limit=50;renderReview();});
  ScavEditor.search($('dashboard-search'),()=>{limit=50;renderReview();});
  $('dashboard-more').onclick = () => {limit+=50;renderReview();};
  function buildSnapshot(data) {
    const groups = {};
    for (const key of Object.keys(names).filter(k=>k!=='listings')) {
      if (!Array.isArray(data.datasets?.[key])) throw new Error('Verification data is incomplete.');
      groups[key] = data.datasets[key];
    }
    groups.listings = data.datasets.listings || groups.vendors.flatMap(v => {
      if (v.inventory != null && !Array.isArray(v.inventory)) throw new Error('Vendor stock data is invalid.');
      return (v.inventory || []).map(record=>({...record,dashboardVendorName:v.name||v.title||'Vendor'}));
    });
    const totals = ScavVerification.progress(Object.values(groups).flat(),data.settings);
    const counts = Object.fromEntries(Object.entries(groups).map(([key,records])=>[key,ScavVerification.progress(records,data.settings)]));
    const entries = Object.entries(groups).flatMap(([category,records])=>records.map(record=> {
      const check = ScavVerification.inspect(record,data.settings), name = record.name || record.itemName || record.item_name || record.title || 'Unnamed entry';
      return {category,name:record.dashboardVendorName ? record.dashboardVendorName+' — '+name : name,status:check.status,legacy:check.legacy,inspection:check};
    }));
    return {totals,counts,entries};
  }
  async function refresh() {
    if (loading) return;
    loading=true; state=null; rows=[]; organize();
    $('dashboard-status').textContent='Loading verification…'; $('dashboard-refresh').disabled=true;
    $('dashboard-metrics').hidden=true; $('dashboard-new-patch').hidden=true; $('dashboard-review-panel').hidden=true;
    document.querySelectorAll('[data-review-category]').forEach(b=>b.disabled=true);
    for (const key of Object.keys(names)) $('dashboard-count-'+key).textContent='Loading verification…';
    try {
      const data=await read(), snapshot=buildSnapshot(data); state=data; rows=snapshot.entries;
      $('dashboard-patch').textContent=data.settings.current_patch_id || 'Not set';
      const {totals,counts}=snapshot;
      $('dashboard-summary').textContent=`${totals.verified} / ${totals.total} (${totals.percent}%)`;
      $('dashboard-progress').value=totals.percent;
      $('dashboard-current').textContent=`${totals.verified} current`;
      $('dashboard-stale').textContent=`${totals['patch-check-needed']} patch checks`;
      $('dashboard-unverified').textContent=`${totals.unverified} unverified`;
      $('dashboard-new-patch').hidden=data.owner!==true; $('dashboard-new-patch').disabled=data.canStart!==true;
      $('dashboard-new-patch').title=data.canStart ? 'Open Patch Management to confirm a new patch' : 'Patch changes remain disabled pending release approval';
      for (const [key,count] of Object.entries(counts)) $('dashboard-count-'+key).textContent=`${count.verified} / ${count.total} verified for this patch`;
      document.querySelectorAll('[data-review-category]').forEach(b=>b.disabled=false);
      $('dashboard-metrics').hidden=false; $('dashboard-status').textContent='Updated '+new Date().toLocaleTimeString()+'.';
      if (!data.settings.current_patch_id) $('dashboard-status').textContent='Current patch is not set. Configure it in Patch Management before verifying.';
    } catch(error) {
      $('dashboard-status').textContent='Verification unavailable — '+error.message+' Use Refresh to retry. Existing editors remain available.';
      for(const key of Object.keys(names)) $('dashboard-count-'+key).textContent='Verification unavailable';
    } finally {loading=false;$('dashboard-refresh').disabled=false;}
  }
  return {refresh};
};
