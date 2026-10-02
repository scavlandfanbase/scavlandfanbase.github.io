// Feature-gated authenticated per-item bridge. No browser authority over payloads/actors.
import {snapshotItem,categoryView,reconcilePublishedItem,editItem,reviewItem,createCategoryItem,addCategoryFacet,lifecycleItem,planItem,createItemPublisher} from './item-draft.mjs';
import {fail} from './core.mjs';
import {inspectLegacyItem,prepareLegacyImport,legacyDigest} from './legacy-item-review.mjs';
const repository='scavlandfanbase/scavlandfanbase.github.io';
const permission={ammo:'ammunition_edit',armour:'armour_edit',weapons:'weapons_edit'};
const cors={'Access-Control-Allow-Origin':'https://scavlandfanbase.github.io','Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
export async function previewDigest(files){
 const bytes=new TextEncoder().encode(JSON.stringify(files.map(({path,content})=>({path,content})).sort((a,b)=>a.path.localeCompare(b.path))));
 return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
}
export function createItemApi({env,fetcher=fetch,readSource}={}){
 async function github(path){
  const r=await fetcher('https://api.github.com/repos/'+repository+path,{headers:{Authorization:'Bearer '+env('GITHUB_TOKEN'),Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'}});
  if(!r.ok)fail('Canonical source is unavailable. Your draft is retained.',502);return r.json();
 }
 const source=readSource||(async()=>{
  const head=(await github('/git/ref/heads/main')).object.sha;
  const names=['items','ammo','armour','weapons','vendors','verification-settings','site-images'],documents={},base={};
  for(const name of names){const path='data/'+name+'.json',f=await github('/contents/'+path+'?ref='+encodeURIComponent(head));
   if(f.encoding!=='base64'||typeof f.content!=='string'||typeof f.sha!=='string')fail('Invalid canonical response.',502);
   documents[path]=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(f.content.replace(/\n/g,'')),c=>c.charCodeAt(0))));base[path]=f.sha;
  }
  return {documents,base,settings:documents['data/verification-settings.json'],images:[...new Set(Object.values(documents['data/site-images.json'].categories||{}).flatMap(c=>c.images||[]))]};
 });
 return async request=>{
  const reply=(value,status=200)=>Response.json(value,{status,headers:{...cors,'Cache-Control':'no-store'}});
  if(request.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(request.method!=='POST')return reply({error:'POST is required.'},405);
  try{
   if(env('SHARED_ITEM_ENABLED')!=='true')fail('Connected category editing is not enabled yet.',503);
   const auth=request.headers.get('Authorization')||'';if(!auth.startsWith('Bearer '))fail('Sign in to continue.',401);
   const raw=await request.text();if(new TextEncoder().encode(raw).length>250000)fail('Item request is too large.',413);
   let body;try{body=JSON.parse(raw);}catch{fail('Invalid item request.');}
   if(!body||Object.keys(body).some(k=>!['domain','action','itemId','category','expectedVersion','requestId','command','previewId','confirm'].includes(k))||body.domain!=='shared-item'||!Object.hasOwn(permission,body.category)||!['list','create','legacy-review','load','prepare','save','preview','publish'].includes(body.action)||(!['list','create'].includes(body.action)&&(typeof body.itemId!=='string'||!body.itemId.trim()||body.itemId.length>160)))fail('Invalid item request.');
   const sb=env('SUPABASE_URL'),key=env('SUPABASE_ANON_KEY');if(!sb||!key)fail('Private storage is unavailable.',503);
   async function rpc(name,args,trusted=false){
    const token=trusted?env('SUPABASE_SERVICE_ROLE_KEY'):key;if(!token)fail('Trusted storage is unavailable.',503);
    const r=await fetcher(sb+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:token,Authorization:trusted?'Bearer '+token:auth,'Content-Type':'application/json'},body:JSON.stringify(args)});
    const result=await r.json();if(!r.ok)fail(result.message||'Item storage is unavailable.',result.code==='PT409'?409:result.code==='42501'?403:r.status>=500?503:400);return result;
   }
   const userResponse=await fetcher(sb+'/auth/v1/user',{headers:{apikey:key,Authorization:auth}});
   if(!userResponse.ok)fail('Sign in again. Your draft is retained.',401);
   const actor=(await userResponse.json()).id;if(typeof actor!=='string'||!actor)fail('Sign in again.',401);
   if(await rpc('has_scavland_permission',{required_permission:permission[body.category]})!==true)fail('Category editing permission is required.',403);
   const canPublish=await rpc('has_scavland_permission',{required_permission:'publish_public'})===true;
   if(body.action==='publish'&&!canPublish)fail('Publishing permission required. Your private draft is retained.',403);
   const latest=await source();const context={actor,permissions:[permission[body.category]],settings:latest.settings,images:latest.images};
   if(body.action==='legacy-review'){
    const legacy=await rpc('scavland_item_legacy',{},true);
    const saved=await rpc('scavland_item_draft',{p_action:'load',p_item:body.itemId,p_category:body.category});
    return reply({...await inspectLegacyItem(latest.documents,legacy,body.itemId,body.category,context),currentVersion:saved.currentVersion,revision:saved.draft?.payload.revision||0});
   }
   const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
   if(body.action==='create'){
    if(!['ammo','armour','weapons'].includes(body.category)||body.itemId!==undefined||body.expectedVersion!==0||!uuid(body.requestId)||!body.command)fail('Invalid new category request.');
    const args={p_actor:actor,p_item:null,p_category:body.category,p_version:0,p_request:body.requestId,p_command:body.command};
    const receipt=await rpc('scavland_prepare_item',args,true);if(receipt)return reply(receipt);
    const itemId='item-'+crypto.randomUUID(),state=createCategoryItem(latest.documents,itemId,body.category,body.command,context);
    const legacy=await rpc('scavland_item_legacy',{},true);planItem(state,latest.documents,{legacyDrafts:legacy?[legacy]:[]});
    return reply(await rpc('scavland_prepare_item',{...args,p_item:itemId,p_payload:state},true));
   }
   const tags={ammo:'ammunition',armour:'armour',weapons:'weapon'};
   const vendorDocument=latest.documents['data/vendors.json']||{data:[]};
   const usage=id=>(vendorDocument.vendorListings?.listings||[]).filter(r=>!r.archived&&r.entity?.type==='item'&&r.entity.id===id)
    .map(r=>({vendorId:r.vendorId,name:vendorDocument.data.find(v=>v.id===r.vendorId)?.name||'Vendor',price:r.price,rank:r.rank,quantity:r.quantity}));
   if(body.action==='list'){
    const facets=new Set(latest.documents['data/'+body.category+'.json'].data.map(r=>r.id));
    const entries=new Map(latest.documents['data/items.json'].data.filter(r=>facets.has(r.id)||r.classification?.includes(tags[body.category])).map(r=>[r.id,{id:r.id,name:r.name,archived:!!r.archived,hidden:!!r.hidden}]));
    const privateEntries=await rpc('scavland_item_draft',{p_action:'list',p_item:null,p_category:body.category});
    for(const d of privateEntries){const view=categoryView(d.payload,body.category,context),r=view.records.items;
     if(entries.has(d.itemId))Object.assign(entries.get(d.itemId),{name:r.name,archived:!!r.archived});
     else if(view.creation?.items)entries.set(d.itemId,{id:d.itemId,name:r.name,archived:!!r.archived,unpublished:true});
    }
    return reply({records:[...entries.values()],settings:latest.settings});
   }
   const args={p_item:body.itemId,p_category:body.category};
   const load=()=>rpc('scavland_item_draft',{p_action:'load',...args});
   const saved=await load();
   const exists=latest.documents['data/items.json'].data.some(r=>r.id===body.itemId);
   const seed=exists?snapshotItem(latest.documents,body.itemId,body.category,context):null; // Fresh membership when public.
   if(!seed&&!saved.draft?.payload.creation?.items&&body.action!=='save')fail('Item not found.',404);
   const state=saved.draft?reconcilePublishedItem(categoryView(saved.draft.payload,body.category,context),latest.documents):seed;
   const legacy=await rpc('scavland_item_legacy',{},true);
   const guardedLegacy=async(s,l)=>s?.legacyTransfer&&l?.version===s.legacyTransfer.sourceVersion&&await legacyDigest(l)===s.legacyTransfer.sourceDigest?[]:l?[l]:[];
   const legacyDrafts=await guardedLegacy(state,legacy);
   const importing=body.command?.action==='import-legacy'&&['prepare','save'].includes(body.action);
   if(state&&!importing)planItem(state,latest.documents,{legacyDrafts});
   if(body.action==='load')return reply({currentVersion:saved.currentVersion,state,hasChanges:!!(Object.keys(state.changes).length||Object.keys(state.creation||{}).length),settings:latest.settings,images:latest.documents['data/site-images.json'],usage:usage(body.itemId),savedBy:saved.draft?.saved_by||null,canPublish:canPublish&&env('DRAFT_PUBLISH_ENABLED')==='true'&&env('ADMIN_CORE_ENABLED')==='true'});
   if(!Number.isSafeInteger(body.expectedVersion)||body.expectedVersion<0)fail('The saved item version is required.');
   if(body.action==='save'){
    if(!uuid(body.requestId))fail('A prepared receipt is required.');
    if(importing){
     const receipt=await rpc('scavland_prepare_item',{p_actor:actor,...args,p_version:body.expectedVersion,p_request:body.requestId,p_command:body.command},true);
     if(!receipt)fail('Prepare this import first.',409);
     const report=await inspectLegacyItem(latest.documents,legacy,body.itemId,body.category,context);
     if(report.publicDigest!==receipt.payload.legacyTransfer.publicDigest||report.sourceDigest!==receipt.payload.legacyTransfer.sourceDigest)fail('Import sources changed. Review again.',409);
     planItem(receipt.payload,latest.documents,{legacyDrafts:await guardedLegacy(receipt.payload,legacy)});
    }
    return reply(await rpc('scavland_item_draft',{p_action:'save',...args,p_expected_version:body.expectedVersion,p_request:body.requestId}));
   }
   if(body.action==='prepare'){
    if(!uuid(body.requestId)||!body.command)fail('A valid prepared action is required.');
    const prepareArgs={p_actor:actor,...args,p_version:body.expectedVersion,p_request:body.requestId,p_command:body.command};
    const receipt=await rpc('scavland_prepare_item',prepareArgs,true);if(receipt)return reply(receipt);
    if(saved.currentVersion!==body.expectedVersion)fail('A newer item draft exists.',409);
    const changed=importing?await prepareLegacyImport(latest.documents,legacy,state,body.command,context):(body.command.action==='review'?reviewItem:body.command.action==='add-facet'?addCategoryFacet:['archive','restore'].includes(body.command.action)?lifecycleItem:editItem)(state,body.command,context);
    if(importing)await rpc('scavland_preserve_item_legacy',{p_version:legacy.version},true);
    planItem(changed,latest.documents,{legacyDrafts:await guardedLegacy(changed,legacy)});
    return reply(await rpc('scavland_prepare_item',{...prepareArgs,p_payload:changed},true));
   }
   if(!saved.draft)fail('Save this item draft first.',404);
   if(saved.currentVersion!==body.expectedVersion)fail('A newer item draft exists. Preview it again.',409);
   const create=beforePublish=>createItemPublisher({state,base:latest.base,repository,token:env('GITHUB_TOKEN'),fetcher,legacyDrafts,beforePublish});
   if(body.action==='preview'){
    const preview=await create().preview(),digest=await previewDigest(preview.files);
    const intent=await rpc('scavland_item_preview',{p_actor:actor,...args,p_version:body.expectedVersion,p_digest:digest},true);
    return reply({version:saved.currentVersion,previewId:intent.id,preview});
   }
   if(body.confirm!==true||!uuid(body.previewId))fail('Preview this item and explicitly confirm publication.');
   if(env('DRAFT_PUBLISH_ENABLED')!=='true'||env('ADMIN_CORE_ENABLED')!=='true')fail('Publishing is disabled. Your draft is retained.',503);
   const intent=await rpc('scavland_item_preview',{p_actor:actor,...args,p_version:body.expectedVersion,p_id:body.previewId},true);
   if(!intent)fail('Preview this saved item again.',409);
   const publication=await create(async plan=>{
    if(await rpc('has_scavland_permission',{required_permission:'publish_public'})!==true)fail('Publishing permission required.',403);
    if(await previewDigest(plan.tree)!==intent.digest)fail('Public content changed since preview. Review again.',409);
    if((await load()).currentVersion!==body.expectedVersion)fail('A newer item draft exists. Review again.',409);
    const currentLegacy=await rpc('scavland_item_legacy',{},true);
    const now=await source();if(!state.creation?.items)snapshotItem(now.documents,body.itemId,body.category,context);
    planItem(state,now.documents,{legacyDrafts:await guardedLegacy(state,currentLegacy)});
   }).publish();
   return reply({publishedVersion:body.expectedVersion,publication});
  }catch(e){return reply({error:e.status?e.message:'Could not complete this item action. Draft retained; inspect public state before retrying an uncertain publish.'},e.status||503);}
 };
}
