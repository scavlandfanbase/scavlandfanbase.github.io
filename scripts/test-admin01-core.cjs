// Real SQL + production handler + existing models + browser persistence adapter.
// GitHub/Auth transports are fixture-only; no live mutation or test publication.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {PGlite}=require(require.resolve('@electric-sql/pglite',{paths:[path.join(__dirname,'r1-test-runtime')]}));
const Client=require('../draft-persistence.js'),V=require('../verification.js'),L=require('../vendor-listings.js');
const root=path.resolve(__dirname,'..'),directory=fs.mkdtempSync(path.join(os.tmpdir(),'scav-admin01-'));
const alice='11111111-1111-4111-8111-111111111111',bob='22222222-2222-4222-8222-222222222222';
const documents=Object.fromEntries(['items','vendors','site-images','factions','verification-settings','weapons','armour','ammo','crafting'].map(n=>['data/'+n+'.json',JSON.parse(fs.readFileSync(path.join(root,'data',n+'.json')))]));
documents['data/verification-settings.json']={schemaVersion:1,current_patch_id:'test-a'};
const publicBefore=structuredClone(documents),sourceBytes=fs.readFileSync(path.join(root,'data/items.json'));
let db,head='head-0',tree,commit,gitWrites=0,offline=false,lost=false,lostSave=false,failPublish=false;
const sha=v=>crypto.createHash('sha1').update(JSON.stringify(v)).digest('hex');
(async()=>{try{
 db=new PGlite(directory);
 await db.exec(`create role anon;create role authenticated;create role service_role;
 create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function public.has_scavland_permission(permission text) returns boolean language sql stable as $$select (auth.uid() in ('${alice}'::uuid,'${bob}'::uuid) and permission in ('items_edit','vendors_edit')) or (auth.uid()='${alice}'::uuid and permission='ammunition_edit')$$;
 grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
 await db.exec(fs.readFileSync(path.join(root,'supabase/proposals/r1-private-drafts.sql'),'utf8'));
 await db.exec(fs.readFileSync(path.join(root,'supabase/proposals/admin01-trusted-drafts.sql'),'utf8'));
 await db.exec(fs.readFileSync(path.join(root,'supabase/proposals/ammo-trusted-drafts.sql'),'utf8'));
 async function rpc(name,b,token){
  return db.transaction(async tx=>{
   const service=token==='service-test-only';await tx.exec('set local role '+(service?'service_role':'authenticated'));
   await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[service?'':token]);
   if(name==='scavland_draft')return (await tx.query('select public.scavland_draft($1,$2,$3,$4,$5,$6,$7) as v',[b.p_action,b.p_domain,b.p_entity_id,b.p_expected_version??null,b.p_payload??null,b.p_base??null,b.p_request_id??null])).rows[0].v;
   if(name==='scavland_patch_audit')return (await tx.query('select public.scavland_patch_audit($1,$2,$3) as v',[b.p_actor,b.p_base,b.p_settings])).rows[0].v;
   if(name==='scavland_patch_history')return (await tx.query('select public.scavland_patch_history($1) as v',[b.p_patch])).rows[0].v;
   assert.equal(name,'scavland_prepare');
   return (await tx.query('select public.scavland_prepare($1,$2,$3,$4,$5,$6,$7) as v',[b.p_actor,b.p_domain,b.p_version,b.p_request,b.p_command,b.p_payload??null,b.p_base??null])).rows[0].v;
  });
 }
 const env=k=>({SUPABASE_URL:'https://sb.invalid',SUPABASE_ANON_KEY:'anon-fixture',SUPABASE_SERVICE_ROLE_KEY:'service-test-only',GITHUB_TOKEN:'github-fixture',DRAFT_PUBLISH_ENABLED:'true',ADMIN_CORE_ENABLED:'true'})[k];
 const fetcher=async(url,options={})=>{
  const u=new URL(url),b=options.body?JSON.parse(options.body):null,token=options.headers.Authorization.slice(7);
  if(u.origin==='https://sb.invalid'){
   if(u.pathname==='/auth/v1/user')return [alice,bob].includes(token)?Response.json({id:token}):Response.json({},{status:401});
   if(u.pathname.endsWith('/is_scavland_admin'))return Response.json([alice,bob].includes(token));
   if(u.pathname.endsWith('/is_scavland_owner'))return Response.json(token===alice);
   try{return Response.json(await rpc(u.pathname.split('/').at(-1),b,token));}
   catch(e){return Response.json({code:e.code,message:e.message},{status:e.code==='42501'?403:e.code==='PT409'?409:400});}
  }
  assert.equal(u.origin,'https://api.github.com');assert.equal(token,'github-fixture');
  const p=u.pathname.replace('/repos/scavlandfanbase/scavlandfanbase.github.io','');
  if(options.method==='PUT'&&p==='/contents/data/verification-settings.json'){
   if(b.sha!==sha(documents['data/verification-settings.json']))return Response.json({},{status:409});
   documents['data/verification-settings.json']=JSON.parse(Buffer.from(b.content,'base64').toString());
   head='patch-'+(++gitWrites);return Response.json({content:{sha:sha(documents['data/verification-settings.json'])}});
  }
  if(!options.method||options.method==='GET'){
   if(p==='/git/ref/heads/main')return Response.json({object:{sha:head}});
   if(p==='/git/commits/'+head)return Response.json({tree:{sha:head+'-tree'}});
   if(p.startsWith('/contents/')){const doc=documents[p.slice(10)];assert(doc,p);return Response.json({sha:sha(doc),encoding:'base64',content:Buffer.from(JSON.stringify(doc)).toString('base64')});}
  }
  if(failPublish)return Response.json({},{status:503});
  gitWrites++;
  if(p==='/git/trees'){tree=b;return Response.json({sha:'new-tree'});}
  if(p==='/git/commits'){commit=b;return Response.json({sha:'commit-'+gitWrites});}
  if(p==='/git/refs/heads/main'){
   assert.equal(b.force,false);assert.deepEqual(commit.parents,[head]);head=b.sha;
   for(const file of tree.tree)documents[file.path]=JSON.parse(file.content);
   return Response.json({object:{sha:head}});
  }
  throw Error('Unexpected transport '+url);
 };
 const {createProductionHandler}=await import('../supabase/functions/admin-drafts/production.mjs');
 const {project}=await import('../supabase/functions/admin-drafts/core.mjs');
 const handler=createProductionHandler({env,fetcher});
 const {createHandler:createLegacyHandler}=await import('../supabase/functions/_shared/records.js');
 for(const endpoint of ['items','vendors','specialist']){
  const retired=createLegacyHandler(endpoint,env,()=>{throw Error('Retired publisher must not contact storage.');});
  assert.equal((await retired(new Request('https://legacy.invalid',{method:'POST',body:'{}'}))).status,503);
 }
 const notActivated=createProductionHandler({env:key=>key==='ADMIN_CORE_ENABLED'?'false':env(key),fetcher});
 assert.equal((await notActivated(new Request('https://edge.invalid',{method:'POST',body:JSON.stringify({action:'publish',domain:'items',entityId:'catalogue',confirm:true})}))).status,503);
 const {createHandler:createPatchHandler}=await import('../supabase/functions/manage-patches/handler.mjs');
 const patchHandler=createPatchHandler({env:key=>key==='PATCH_MANAGEMENT_ENABLED'?'true':env(key),fetcher});
 async function call(actor,body){
  const response=await handler(new Request('https://edge.invalid',{method:'POST',headers:{Authorization:'Bearer '+actor},body:JSON.stringify(body)}));
  const result=await response.json();if(!response.ok)throw Object.assign(Error(result.error),{status:response.status});return result;
 }
 function device(actor=alice,domain='items'){
  const states=[];
  const client=Client.create({endpoint:'https://edge.invalid',apiKey:'fixture',getToken:()=>actor,domain,entityId:'catalogue',onState:s=>states.push(s.state),
   fetcher:async(url,opt)=>{
    if(offline){offline=false;throw Error('offline');}
    const response=await handler(new Request(url,opt));if(lost||lostSave&&JSON.parse(opt.body).action==='save'){lost=false;lostSave=false;throw Error('lost reply');}return response;
   }});
  return {client,states,source:()=>call(actor,{action:'source',domain,entityId:'catalogue'}),
   prepare:command=>call(actor,{action:'prepare',domain,entityId:'catalogue',expectedVersion:client.getVersion(),requestId:crypto.randomUUID(),command}),
   async change(command){const r=await this.prepare(command);return client.save(r.payload,r.base,{requestId:r.request_id});}};
 }
 const pc=device(),phone=device(bob);await pc.client.load();await phone.client.load();
 const seed=(await pc.source()).catalogue;assert.equal(seed.data.length,285);
 const added=await pc.change({action:'add',revision:0,details:{name:'Local test Item',category:null,description:null,properties:{unknown:null,zero:0,no:false}}});
 const id=added.payload.selectedId;assert(id);assert.equal(added.payload.catalogue.data.length,286);
 assert.deepEqual(documents,publicBefore);assert.equal(gitWrites,0);assert.equal(pc.states.at(-1),'saved');
 await db.close();db=new PGlite(directory);
 assert.equal((await phone.client.load()).payload.selectedId,id); // Engine restart + another authenticated actor.
 await assert.rejects(phone.client.save({...added.payload,catalogue:{...added.payload.catalogue,data:[]} },added.base),e=>e.status===403);
 await phone.client.load({discardPending:true});
 const raw={p_action:'save',p_domain:'items',p_entity_id:'catalogue',p_expected_version:1,p_payload:added.payload,p_base:added.base,p_request_id:crypto.randomUUID()};
 await assert.rejects(rpc('scavland_draft',raw,bob),e=>e.code==='42501');
 await assert.rejects(rpc('scavland_prepare',{p_actor:alice,p_domain:'items',p_version:1,p_request:crypto.randomUUID(),p_command:{action:'verify'}},bob),e=>e.code==='42501');
 await assert.rejects(rpc('scavland_patch_audit',{p_actor:alice,p_base:'fixture',p_settings:{}},bob),e=>e.code==='42501');
 await assert.rejects(rpc('scavland_patch_history',{p_patch:'test-a'},bob),e=>e.code==='42501');
 for(const role of ['anon','authenticated','service_role'])for(const table of ['prepared','patch_attempts']){
  assert.equal((await db.query('select has_table_privilege($1,$2,\'SELECT,INSERT,UPDATE,DELETE\') as allowed',[role,'scavland_drafts.'+table])).rows[0].allowed,false);
 }
 await assert.rejects(pc.prepare({action:'verify',id,revision:1,actorId:bob,decision:'verified',confirmId:id}),e=>e.status===400);
 const verified=await pc.change({action:'verify',id,revision:1,decision:'verified',confirmId:id,patchId:'client-fake-patch'});
 const reviewed=verified.payload.catalogue.data.find(r=>r.id===id);
 assert.equal(reviewed.evidence,null);assert.equal(reviewed.verification.last_verified_by,alice);
 assert.equal(reviewed.verification.verified_patch_id,'test-a');assert(Number.isFinite(Date.parse(reviewed.verification.last_verified_at)));
 assert.equal(V.inspect(reviewed,documents['data/verification-settings.json']).status,'verified');
 await assert.rejects(phone.prepare({action:'visibility',id,revision:1}),e=>e.status===409);
 await phone.client.load();
 const unrelated=await phone.change({action:'visibility',id:seed.data[0].id,revision:2});
 assert.deepEqual(unrelated.payload.catalogue.data.find(r=>r.id===id).verification,reviewed.verification);
 await pc.client.load();
 const preparation=await pc.prepare({action:'visibility',id,revision:3});offline=true;
 await assert.rejects(pc.client.save(preparation.payload,preparation.base,{requestId:preparation.request_id}));
 assert(pc.client.getPending());assert.equal(pc.states.at(-1),'error');await pc.client.retry();assert.equal(pc.states.at(-1),'saved');
 const again=await pc.prepare({action:'visibility',id,revision:4});lost=true;
 await assert.rejects(pc.client.save(again.payload,again.base,{requestId:again.request_id}));await pc.client.retry();assert.equal(pc.client.getVersion(),5);
 // Forgery with another Admin identity still fails even with a real approved request ID.
 const pending=await pc.prepare({action:'visibility',id:seed.data[0].id,revision:5});
 const forged=structuredClone(pending.payload);const forgedReview=forged.catalogue.data.find(r=>r.id===id).verification;
 forgedReview.last_verified_by=bob;forgedReview.history.at(-1).by=bob;
 await assert.rejects(pc.client.save(forged,pending.base,{requestId:pending.request_id}),e=>e.status===403);
 await pc.client.load({discardPending:true});
 await pc.client.save(pending.payload,pending.base,{requestId:pending.request_id});
 await pc.client.preview();assert.equal(gitWrites,0);await assert.rejects(pc.client.publish(),e=>e.status===400);
 failPublish=true;await assert.rejects(pc.client.publish({confirm:true}));failPublish=false;
 assert.equal((await phone.client.load()).version,6);
 await pc.client.publish({confirm:true});
 const published=documents['data/items.json'],publicRecord=published.data.find(r=>r.id===id);
 assert.equal(publicRecord.name,'Local test Item');assert.equal(publicRecord.verification.schemaVersion,2);
 assert(!JSON.stringify(published).includes(alice));assert(!JSON.stringify(published).includes(bob));
 assert.deepEqual(Object.keys(publicRecord.verification).sort(),['decision','schemaVersion','verified_patch_id']);
 assert.equal(V.inspect(publicRecord,documents['data/verification-settings.json']).status,'verified');
 const vendor=device(alice,'vendors');await vendor.client.load();
 const vs=(await vendor.source()).catalogue;
 const newVendor=await vendor.change({action:'add',revision:0,details:{name:'Local vendor',location:'',factionId:''}}),vendorId=newVendor.payload.selectedId;
 const listingDraft=await vendor.change({action:'inventory',operation:'add',id:vendorId,revision:1,entity:{type:'item',id}});
 const listing=listingDraft.payload.catalogue.vendorListings.listings.find(r=>r.vendorId===vendorId&&r.entity?.type==='item'&&r.entity?.id===id);assert(listing);
 const commercial=await vendor.change({action:'inventory',operation:'edit',id:vendorId,revision:2,listingId:listing.id,fields:{price:5,rank:0,quantity:null,notes:'Private listing note'}});
 await vendor.client.publish({confirm:true});
 const values=structuredClone(commercial.payload.catalogue.vendorListings.listings.find(r=>r.id===listing.id));assert(values);
 // Canonical rename after a publish reconciles the exact public projection/base.
 const current=(await pc.source()).catalogue;
 const renamed=await pc.change({action:'edit',id,revision:current.revision,details:{name:'Canonical renamed',category:null,description:null,properties:reviewed.properties}});
 await pc.client.publish({confirm:true});
 const registry=L.registry({vendors:documents['data/vendors.json'].data,entities:{item:documents['data/items.json'].data}});
 assert.equal(L.resolve(values,registry).entity.name,'Canonical renamed');
 assert.equal(require('../vendor-canonical.js').rows(vendorId,documents['data/vendors.json'].vendorListings,documents['data/items.json'].data)[0].item.name,'Canonical renamed');
 assert.equal(documents['data/vendors.json'].vendorListings.listings.find(r=>r.id===listing.id).notes,null);
 assert.equal(documents['data/items.json'].data.filter(r=>r.id===id).length,1);
 assert.deepEqual((await vendor.client.load()).payload.catalogue.vendorListings.listings.find(r=>r.id===listing.id),values);
 const archived=await vendor.change({action:'inventory',operation:'archive',id:vendorId,revision:3,listingId:listing.id});
 await vendor.change({action:'inventory',operation:'remove',id:vendorId,revision:4,listingId:listing.id,confirmId:listing.id});
 assert.equal(documents['data/items.json'].data.filter(r=>r.id===id).length,1);
 documents['data/verification-settings.json'].current_patch_id='test-b';
 assert.equal(V.inspect(publicRecord,documents['data/verification-settings.json']).status,'patch-check-needed');
 const beforeVerify=(await pc.source()).catalogue;
 await pc.change({action:'verify',id,revision:beforeVerify.revision,decision:'verified',confirmId:id});await pc.client.publish({confirm:true});
 assert.equal(V.inspect(documents['data/items.json'].data.find(r=>r.id===id),documents['data/verification-settings.json']).status,'verified');
 await assert.rejects(device('33333333-3333-4333-8333-333333333333').client.load(),e=>e.status===403);
 await assert.rejects(call(alice,{action:'source',domain:'attachments',entityId:'catalogue'}),e=>e.status===404);
 const final=(await pc.client.load()).payload;
 assert.equal(final.catalogue.data.filter(require('../attachment-model.js').candidate).length,74);
 assert.equal(final.catalogue.data.filter(r=>Object.hasOwn(r,'attachmentModifiers')).length,29);
 // Refresh must obtain the trusted SQL receipt before the normal durable save.
 const refreshDevice=device();await refreshDevice.client.load();
 const writesBeforeRefresh=gitWrites;
 const beforeRefreshSource=structuredClone(documents['data/items.json']);
 const publicTarget=documents['data/items.json'].data.find(r=>r.id!==id);
 publicTarget.notes='External public-only note';
 lost=true;await assert.rejects(refreshDevice.client.rebase(),/lost reply/);
 const refreshRequest=refreshDevice.client.getPending().requestId;
 const refreshed=await refreshDevice.client.retry();
 assert.equal(refreshed.request_id,refreshRequest,'Lost preparation response retries the same receipt');
 assert.equal(refreshed.payload.catalogue.data.find(r=>r.id===publicTarget.id).notes,'External public-only note');
 assert.equal(refreshed.base['data/items.json'],sha(documents['data/items.json']));
 assert.equal(gitWrites,writesBeforeRefresh,'Refresh never publishes');
 lostSave=true;await assert.rejects(refreshDevice.client.rebase(),/lost reply/);
 const retryPrepared=await refreshDevice.client.retry();
 assert.equal(retryPrepared.version,refreshed.version+1);
 const versionBeforeConflict=refreshDevice.client.getVersion();
 await refreshDevice.change({action:'edit',id,revision:refreshed.payload.catalogue.revision,details:{name:'Private name',category:null,description:null,properties:{unknown:null,zero:0,no:false}}});
 documents['data/items.json'].data.find(r=>r.id===id).name='External name';
 await assert.rejects(refreshDevice.client.rebase(),e=>e.status===409&&e.conflicts.some(c=>c.path.endsWith('.name')));
 assert.equal((await refreshDevice.client.load()).version,versionBeforeConflict+1,'Conflict adds no revision');
 await assert.rejects(call('33333333-3333-4333-8333-333333333333',{action:'prepare',domain:'items',entityId:'catalogue',expectedVersion:0,requestId:crypto.randomUUID(),command:{action:'refresh-public'}}),e=>e.status===403);
 documents['data/items.json']=beforeRefreshSource;
 assert.deepEqual(fs.readFileSync(path.join(root,'data/items.json')),sourceBytes);
 console.log('PASS Admin 0.1: trusted prepare + real R1 SQL; direct/approved-payload forgery denied; server actor/time/current patch; optional evidence; multi-actor history retained; restart/second-session; stale/retry/lost reply; explicit atomic mocked publish; private/public separation; canonical listing rename propagation without duplicates; independent vendor values; archive/remove retain Items; patch recheck/reverify; 74/29 source preservation.');
 // Ammo stays separate from Items, with the same trusted receipts and explicit review.
 const ammo=device(alice,'ammo');await ammo.client.load();
 const ammoSeed=(await ammo.source()).catalogue,ammoBefore=structuredClone(documents['data/ammo.json']),itemsBeforeAmmo=structuredClone(documents['data/items.json']);
 assert.equal(ammoSeed.data.find(r=>r.name==='High Caliber Rifle HP Ammo').damage,'46');
 await assert.rejects(device(bob,'ammo').source(),e=>e.status===403);
 await assert.rejects(ammo.client.save({catalogue:ammoSeed}, {'data/ammo.json':sha(documents['data/ammo.json'])}),e=>e.status===403);
 await ammo.client.load({discardPending:true});
 const ammoAdded=await ammo.change({action:'add',revision:ammoSeed.revision,details:{name:'Ammo fixture',category:null,description:null,facts:{damage:'6 x 5 = 30',penetrationPercent:-25,maxStack:0}}});
 const ammoId=ammoAdded.payload.selectedId;
 await ammo.change({action:'verify',id:ammoId,revision:ammoAdded.payload.catalogue.revision,confirmId:ammoId,decision:'verified'});
 let ammoSaved=await ammo.client.load(),ammoRecord=ammoSaved.payload.catalogue.data.find(r=>r.id===ammoId);
 assert.equal(ammoRecord.verification.last_verified_by,alice);
 const ammoHistory=structuredClone(ammoRecord.verification.history);
 await ammo.change({action:'edit',id:ammoId,revision:ammoSaved.payload.catalogue.revision,details:{name:'Ammo fixture',category:null,description:null,facts:{damage:'8 x 12',penetrationPercent:-30,maxStack:0}}});
 ammoSaved=await ammo.client.load();ammoRecord=ammoSaved.payload.catalogue.data.find(r=>r.id===ammoId);
 assert.equal(ammoRecord.verification.decision,'unverified');assert.deepEqual(ammoRecord.verification.history.slice(0,-1),ammoHistory);
 assert.deepEqual(documents['data/ammo.json'],ammoBefore);
 const ammoPreview=await ammo.client.preview();assert(!JSON.stringify(ammoPreview).includes(alice));assert(JSON.stringify(ammoPreview).includes('8 x 12'));
 await ammo.client.publish({confirm:true});
 assert.equal(documents['data/ammo.json'].data.find(r=>r.id===ammoId).penetrationPercent,-30);
 assert.deepEqual(documents['data/items.json'],itemsBeforeAmmo);
 await ammo.client.rebase();
 console.log('PASS Ammo: real receipt SQL, restricted permission denial, forgery denial, damage strings/negative penetration/zero preservation, server review/history reset, private preview and explicit Ammo-only mocked publication.');
 if(process.env.SCAVLAND_BROWSER==='1'){
  const {chromium}=require('playwright');const browser=await chromium.launch({headless:true,channel:'msedge'});
  try{
   async function browserSession(actor){
    const context=await browser.newContext();
    await context.route('**/*',async route=>{
     const request=route.request(),url=new URL(request.url());
     const cors={'Access-Control-Allow-Origin':'https://scavlandfanbase.github.io','Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
     if(url.origin==='https://demtoqsafufzmnhvaykj.supabase.co'){
      if(request.method()==='OPTIONS')return route.fulfill({headers:cors,body:'ok'});
      const allowed=[alice,bob].includes(actor);
      if(url.pathname==='/auth/v1/token')return route.fulfill({headers:cors,json:{access_token:actor}});
      if(url.pathname.endsWith('/is_scavland_admin'))return route.fulfill({headers:cors,json:allowed});
      if(url.pathname.endsWith('/get_scavland_admin_profile')){
       const permissions=actor===alice
        ? ['evidence_review','items_edit','weapons_edit','armour_edit','crafting_edit','ammunition_edit','vendors_edit','settings_edit','content_edit','manage_admins']
        : ['evidence_review','vendors_edit'];
       return route.fulfill({headers:cors,json:allowed?[{role:actor===alice?'owner':'admin',display_name:actor===alice?'Owner':'Admin',is_active:true,permissions}]:[]});
      }
      if(url.pathname.endsWith('/manage-patches')){
       const response=await patchHandler(new Request(request.url(),{method:request.method(),headers:request.headers(),body:request.postData()}));
       return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});
      }
      if(url.pathname.endsWith('/get-site-analytics'))return route.fulfill({headers:cors,json:{activeNow:0,last24Hours:0,totalSessions:0}});
     }
     if(url.pathname==='/functions/v1/admin-drafts'){
      const response=await handler(new Request(request.url(),{method:request.method(),headers:request.headers(),...(request.method()==='POST'?{body:request.postData()}:{})}));
      return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});
     }
     if(url.origin!=='https://scavlandfanbase.github.io')return route.abort();
     if(url.pathname==='/test-admin.html')return route.fulfill({contentType:'text/html',body:`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}iframe{border:0;width:100%;height:100vh}</style><iframe src="${url.searchParams.get('editor')||'items'}-builder.html?embed=1"></iframe><script>addEventListener('message',e=>{if(e.source===document.querySelector('iframe').contentWindow&&e.origin===location.origin&&e.data?.type==='scavland-admin-ready')e.source.postMessage({type:'scavland-admin-token',token:'${actor}'},location.origin)});</script>`});
     const name=decodeURIComponent(url.pathname).slice(1),file=path.resolve(root,name);
     if(!file.startsWith(root+path.sep))return route.abort();
     if(documents[name])return route.fulfill({json:documents[name]});
     if(!fs.existsSync(file)||fs.statSync(file).isDirectory())return route.fulfill({status:404,body:'Not found'});
     return route.fulfill({path:file});
    });
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);return {context,page,errors};
   }
   const first=await browserSession(alice),page=first.page;await page.goto('https://scavlandfanbase.github.io/test-admin.html');
   const frame=page.frameLocator('iframe');try{await frame.locator('#workspace').waitFor();}catch(e){console.error('ITEMS LOAD',await frame.locator('body').innerText(),first.errors);throw e;}
   await frame.locator('#item-add').focus();await page.keyboard.press('Enter');
   const dialog=frame.getByRole('dialog');await dialog.getByLabel('Item name',{exact:true}).fill('Browser durable Item');
   await dialog.getByRole('button',{name:'Save private draft',exact:true}).click();await dialog.waitFor({state:'detached'});
   assert.match(await frame.locator('#status').innerText(),/Saved/);await page.reload();await frame.locator('#workspace').waitFor();
   const browserSaved=(await pc.client.load()).payload;
   const browserDraftItem=browserSaved.catalogue.data.find(r=>r.name==='Browser durable Item');
   const refreshNoteTarget=documents['data/items.json'].data.find(r=>r.id!==id);
   refreshNoteTarget.notes='Browser external public-only note';
   await frame.locator('#production-refresh').click();
   await frame.getByText('Saved · private draft refreshed from public data',{exact:true}).waitFor();
   assert.equal((await pc.client.load()).payload.catalogue.data.find(r=>r.id===browserDraftItem.id).name,'Browser durable Item');
   assert.equal((await pc.client.load()).payload.catalogue.data.find(r=>r.id===refreshNoteTarget.id).notes,'Browser external public-only note');
   await frame.getByLabel('Search items',{exact:true}).fill('Browser durable Item');await frame.locator('#item-review').click();
   await dialog.getByLabel('Review decision',{exact:true}).selectOption('verified');
   await dialog.getByRole('button',{name:'Record review',exact:true}).click();await dialog.waitFor({state:'detached'});
   const output=process.env.SCAVLAND_TEST_OUTPUT;
   for(const width of [280,320,390,768,1280]){
    await page.setViewportSize({width,height:900});
    assert(await frame.locator('body').evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Items overflow at '+width);
    for(const name of ['production-preview','production-publish','item-add'])assert((await frame.locator('#'+name).boundingBox()).height>=44,name+' target');
    if(output&&[320,1280].includes(width)){fs.mkdirSync(output,{recursive:true});await frame.locator('body').evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(output,'admin01-items-'+width+'.png'),fullPage:true});}
   }
   await frame.locator('#production-preview').click();await dialog.waitFor();assert(!(await dialog.innerText()).includes(alice));
   await dialog.getByRole('button',{name:'Close',exact:true}).click();await dialog.waitFor({state:'detached'});
   await frame.locator('#production-publish').click();await dialog.getByRole('button',{name:'Publish',exact:true}).click();await dialog.waitFor({state:'detached'});
   await frame.locator('#production-refresh').click();await frame.getByText('Saved · private draft refreshed from public data',{exact:true}).waitFor();
   const historyBeforeRefresh=(await pc.client.load()).payload.catalogue.data.find(r=>r.id===browserDraftItem.id).verification.history;
   documents['data/items.json'].data.find(r=>r.id===browserDraftItem.id).image='images/review-fixture.png';
   await frame.locator('#production-refresh').click();await frame.getByText(/Refresh stopped/).waitFor();
   await frame.locator('#item-review').click();
   assert.equal(await dialog.getByLabel('Review decision',{exact:true}).inputValue(),'unverified');
   await dialog.getByRole('button',{name:'Record review',exact:true}).click();await dialog.waitFor({state:'detached'});
   const marked=(await pc.client.load()).payload.catalogue.data.find(r=>r.id===browserDraftItem.id);
   assert.equal(marked.verification.decision,'unverified');
   assert.deepEqual(marked.verification.history.slice(0,-1),historyBeforeRefresh);
   assert.equal(marked.verification.history.at(-1).by,alice);
   await frame.locator('#production-refresh').click();await frame.getByText('Saved · private draft refreshed from public data',{exact:true}).waitFor();
   const recovered=(await pc.client.load()).payload.catalogue.data.find(r=>r.id===browserDraftItem.id);
   assert.equal(recovered.image,'images/review-fixture.png');assert.equal(recovered.verification.decision,'unverified');
   const second=await browserSession(bob);await second.page.goto('https://scavlandfanbase.github.io/test-admin.html');
   const secondFrame=second.page.frameLocator('iframe');await secondFrame.locator('#workspace').waitFor();await secondFrame.getByLabel('Search items',{exact:true}).fill('Browser durable Item');
   assert.equal(await secondFrame.locator('#item-name').innerText(),'Browser durable Item');
   await page.goto('https://scavlandfanbase.github.io/test-admin.html?editor=vendor');await frame.locator('#workspace').waitFor();
   await frame.locator('#vendor-add').click();await dialog.getByLabel('Vendor name',{exact:true}).fill('Browser vendor');await dialog.getByRole('button',{name:'Save private draft',exact:true}).click();await dialog.waitFor({state:'detached'});
   await frame.locator('#vendor-inventory').click();await frame.locator('#inventory-status').filter({hasText:'Ready'}).waitFor();
   for(const width of [320,1280]){await page.setViewportSize({width,height:900});assert(await frame.locator('body').evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));if(output){await frame.locator('body').evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(output,'admin01-vendors-'+width+'.png'),fullPage:true});}}
   await page.goto('https://scavlandfanbase.github.io/items.html');await page.locator('#item-count').filter({hasText:'items'}).waitFor({state:'attached'});
   await page.locator('#item-search').fill('Browser durable Item');await page.locator('#item-browser').evaluate(e=>e.open=true);
   assert.match(await page.locator('#item-grid').innerText(),/VERIFIED/);assert(!(await page.locator('body').innerText()).includes(alice));
   await page.goto('https://scavlandfanbase.github.io/vendors.html');await page.locator('.vendor-count').filter({hasText:'vendors'}).waitFor();
   assert((await page.locator('#vendor-list').innerText()).includes('Local vendor'));
   // Real Admin Hub login and same-origin token handoff, with fixture Auth only.
   await page.goto('https://scavlandfanbase.github.io/admin.html');await page.locator('#email').fill('owner@example.invalid');await page.locator('#password').fill('fixture-only');await page.locator('#signin').click();await page.locator('#hub').waitFor();
   await page.locator('#dashboard-status').filter({hasText:'Updated'}).waitFor();
   assert(!(await page.locator('[data-view="ammunition"]').isDisabled()));assert(!(await page.locator('#edit-site').isDisabled()));
   await page.locator('[data-view="ammunition"]').click();
   const ammoFrame=page.frameLocator('#ammunition-frame');await ammoFrame.locator('#workspace').waitFor();
   await ammoFrame.getByLabel('Search ammo',{exact:true}).fill('High Caliber Rifle HP Ammo');
   assert.match(await ammoFrame.locator('#facts').innerText(),/Damage\s+46/);
   assert.match(await ammoFrame.locator('#facts').innerText(),/Penetration \(%\)\s+-25/);
   for(const width of [320,1280]){await page.setViewportSize({width,height:900});assert(await ammoFrame.locator('body').evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
   await ammoFrame.locator('#ammo-review').click();
   await ammoFrame.getByRole('dialog').getByRole('button',{name:'Record review',exact:true}).click();await ammoFrame.getByRole('dialog').waitFor({state:'detached'});
   await ammoFrame.locator('#production-preview').click();await ammoFrame.getByRole('dialog').waitFor();
   await ammoFrame.getByRole('dialog').locator('summary').filter({hasText:'High Caliber Rifle HP Ammo'}).click();
   assert.match(await ammoFrame.getByRole('dialog').innerText(),/Penetration percent\s+-25/i);
   await ammoFrame.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();await ammoFrame.getByRole('dialog').waitFor({state:'detached'});
   assert(await ammoFrame.locator('#production-publish').isEnabled());
   await page.locator('#ammunition .hub-button').click();
   await page.locator('[data-view="items"]').click();await page.frameLocator('#items-frame').locator('#workspace').waitFor();
   await page.locator('#items .hub-button').click();await page.locator('[data-view="patches"]').click();
   const patch=page.frameLocator('#patches-frame');await patch.locator('#status').filter({hasText:'Ready'}).waitFor();
   await patch.locator('#new-patch').click();await patch.locator('#patch-id').fill('test-browser-new-patch');await patch.locator('#confirm-all').check();await patch.locator('#start').click();await patch.locator('#status').filter({hasText:'Patch started'}).waitFor();
   const browserItem=documents['data/items.json'].data.find(r=>r.name==='Browser durable Item');
   assert.equal(V.inspect(browserItem,documents['data/verification-settings.json']).status,'patch-check-needed');
   assert(!JSON.stringify(documents['data/verification-settings.json']).includes(alice));
   const audit=(await db.query('select actor::text,settings from scavland_drafts.patch_attempts order by id desc limit 1')).rows[0];assert.equal(audit.actor,alice);assert.equal(audit.settings.patch_history.at(-1).started_by,alice);
   await page.locator('#patches .hub-button').click();await page.locator('[data-view="items"]').click();
   const actualItems=page.frameLocator('#items-frame');await actualItems.getByLabel('Search items',{exact:true}).fill('Browser durable Item');await actualItems.locator('#item-review').click();
   await actualItems.getByRole('dialog').getByLabel('Review decision',{exact:true}).selectOption('verified');
   await actualItems.getByRole('dialog').getByRole('button',{name:'Record review',exact:true}).click();await actualItems.getByRole('dialog').waitFor({state:'detached'});
   await actualItems.locator('#production-preview').click();await actualItems.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();await actualItems.getByRole('dialog').waitFor({state:'detached'});
   await actualItems.locator('#production-publish').click();await actualItems.getByRole('dialog').getByRole('button',{name:'Publish',exact:true}).click();await actualItems.getByRole('dialog').waitFor({state:'detached'});
   assert.equal(V.inspect(documents['data/items.json'].data.find(r=>r.id===browserItem.id),documents['data/verification-settings.json']).status,'verified');
   // Granular Admin Hub permissions: Bob may review Evidence and edit Vendors only.
    await second.page.goto('https://scavlandfanbase.github.io/admin.html');
    await second.page.locator('#email').fill('admin@example.invalid');
    await second.page.locator('#password').fill('fixture-only');
    await second.page.locator('#signin').click();
    await second.page.locator('#hub').waitFor();
    await second.page.locator('#dashboard-status').filter({hasText:'Updated'}).waitFor();
    assert(!(await second.page.locator('[data-view="evidence"]').isDisabled()));
    assert(!(await second.page.locator('[data-view="vendors"]').isDisabled()));
    assert(await second.page.locator('[data-view="items"]').isDisabled());
    assert(await second.page.locator('[data-view="weapons"]').isDisabled());
    assert(await second.page.locator('[data-view="ammunition"]').isDisabled());
    assert(await second.page.locator('[data-view="settings"]').isDisabled());
    assert(await second.page.locator('#edit-site').isDisabled());
    assert.equal(await second.page.locator('[data-view="admin-users"]').count(),0);
    const denied=await browserSession('33333333-3333-4333-8333-333333333333');await denied.page.goto('https://scavlandfanbase.github.io/admin.html');await denied.page.locator('#email').fill('denied@example.invalid');await denied.page.locator('#password').fill('fixture-only');await denied.page.locator('#signin').click();await denied.page.locator('#login-status').filter({hasText:'not authorized'}).waitFor();assert.equal(await denied.page.locator('#hub').isVisible(),false);assert.deepEqual(denied.errors,[]);
   assert.deepEqual(first.errors,[]);assert.deepEqual(second.errors,[]);
   console.log('PASS production browser bridge: parent-origin authentication, durable Item add/reload/verify/preview/publish, second authenticated browser context, Vendor add/catalogue, 280â€“1280px layouts/44px controls, public Items/Vendors rendering and identity privacy.');
  }finally{await browser.close();}
 }
}finally{if(db)await db.close();fs.rmSync(directory,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
