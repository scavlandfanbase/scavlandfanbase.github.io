// Registered in production routing; disabled by default and requires reviewed RPC migrations.
import {prepareAttachmentCreation} from './attachment-create.mjs';
import {createAttachmentApi} from './attachment-api.mjs';
import {fail} from './core.mjs';
import {createAttachmentPublisher} from './attachment-publication.mjs';
import {legacyDigest} from './legacy-item-review.mjs';
import {Attachments} from './models.generated.mjs';
export function createAttachmentTransport({env,fetcher=fetch,readSource}={}){
 const sb=env('SUPABASE_URL'),key=env('SUPABASE_ANON_KEY');
 async function rpc(name,args,authorization,trusted=false){
  const apiKey=trusted?env('SUPABASE_SERVICE_ROLE_KEY'):key;
  if(!sb||!apiKey)fail('Private storage is unavailable.',503);
  const response=await fetcher(sb+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:apiKey,Authorization:trusted?'Bearer '+apiKey:authorization,'Content-Type':'application/json'},body:JSON.stringify(args)});
  let result;try{result=await response.json();}catch{fail('Private storage is unavailable.',503);}
  if(!response.ok)fail(result.message||'Private storage is unavailable.',result.code==='PT409'?409:result.code==='42501'?403:response.status>=500?503:400);
  return result;
 }
 function enabled(){
  if(env('SHARED_ATTACHMENT_ENABLED')!=='true')return false;
  const required=['SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','GITHUB_TOKEN'];
  if(required.some(name=>typeof env(name)!=='string'||!env(name).trim())||typeof readSource!=='function')fail('Attachment server configuration is unavailable.',503);
  return true;
 }
 return createAttachmentApi({enabled,
  create:async input=>{
   const allocation=await rpc('scavland_allocate_attachment',{p_actor:input.actor,p_request:input.requestId,p_command:input.command},null,true);
   const itemId=allocation.item_id;
   const prior=await rpc('scavland_attachment_receipt',{p_actor:input.actor,p_item:itemId,p_request:input.requestId,p_command:input.command},null,true);
   if(!prior){
    const latest=await readSource(),legacy=await rpc('scavland_item_legacy',{},null,true);
    const payload=await prepareAttachmentCreation(input.command,{actor:input.actor,permissions:input.permissions,newItemId:itemId,documents:latest.documents,settings:latest.settings,images:latest.images,privateItemIds:allocation.privateItemIds,legacyDrafts:legacy?[legacy]:[]});
    await rpc('scavland_prepare_attachment',{p_actor:input.actor,p_item:itemId,p_request:input.requestId,p_command:input.command,p_payload:payload,p_legacy:legacy?.version||0},null,true);
   }
   return {...await rpc('scavland_attachment_draft',{p_action:'save',p_item:itemId,p_request:input.requestId},input.authorization),itemId};
  },
  list:async authorization=>{
   if(typeof readSource!=='function')fail('Canonical source is unavailable.',503);
   const latest=await readSource();
   const drafts=await rpc('scavland_attachment_list',{},authorization);
   const privateRecords=new Map(drafts.map(row=>[row.item_id,row.payload.record]));
   const publicRecords=latest.documents['data/items.json'].data;const combined=[...publicRecords,...drafts.filter(row=>!publicRecords.some(r=>r.id===row.item_id)).map(row=>row.payload.record)];
   return {records:combined.filter(r=>!r.hidden&&(privateRecords.has(r.id)||r.contentType==='Attachment'||r.classification?.includes('attachment')||Attachments.candidate(r))).map(r=>({id:r.id,name:privateRecords.get(r.id)?.name||r.name||r.id,privateDraft:privateRecords.has(r.id),candidate:!privateRecords.has(r.id)&&r.contentType!=='Attachment'&&!r.classification?.includes('attachment')}))};
  },
  publishEnabled:()=>env('ADMIN_CORE_ENABLED')==='true'&&env('DRAFT_PUBLISH_ENABLED')==='true',
  publication:async input=>{
   async function current(){
    if(input.action==='publish'&&await rpc('has_scavland_permission',{required_permission:'publish_public'},input.authorization)!==true)fail('Publishing permission required.',403);
    if(input.action==='publish'&&(env('ADMIN_CORE_ENABLED')!=='true'||env('DRAFT_PUBLISH_ENABLED')!=='true'))fail('Publishing is disabled.',403);
    const session=await fetcher(sb+'/auth/v1/user',{headers:{apikey:key,Authorization:input.authorization}});
    if(!session.ok||(await session.json()).id!==input.actor)fail('Sign in again.',401);
    if(await rpc('has_scavland_permission',{required_permission:'items_edit'},input.authorization)!==true)fail('Items editing permission is required.',403);
    if(typeof readSource!=='function')fail('Canonical source is unavailable.',503);
    const latest=await readSource(),saved=await rpc('scavland_attachment_draft',{p_action:'load',p_item:input.itemId},input.authorization);
    const legacy=await rpc('scavland_item_legacy',{},null,true);
    return {...latest,actor:input.actor,permissions:['items_edit'],version:saved.currentVersion,savedDraft:saved.draft?.payload,legacyDrafts:legacy?[legacy]:[]};
   }
   const context=await current();
   if(context.version!==input.expectedVersion||!context.savedDraft)fail('The saved version changed. Preview again.',409);
   const publisher=createAttachmentPublisher({saved:context.savedDraft,version:context.version,base:context.base?.['data/items.json'],token:env('GITHUB_TOKEN'),fetcher,actor:input.actor,previewId:input.previewId,readCurrent:current,
    readIntent:args=>rpc('scavland_attachment_preview',{p_actor:args.actor,p_item:args.itemId,p_version:args.version,p_id:args.previewId},null,true)});
   if(input.action==='preview'){
    const preview=await publisher.preview();
    const intent=await rpc('scavland_attachment_preview',{p_actor:input.actor,p_item:input.itemId,p_version:context.version,p_digest:await legacyDigest(preview.files)},null,true);
    return {...preview,previewId:intent.id};
   }
   return publisher.publish();
  },
  authenticate:async authorization=>{
   if(!sb||!key)fail('Authentication is unavailable.',503);
   const response=await fetcher(sb+'/auth/v1/user',{headers:{apikey:key,Authorization:authorization}});
   if(!response.ok)fail('Sign in again.',401);
   const actor=(await response.json()).id;if(typeof actor!=='string'||!actor)fail('Sign in again.',401);
   const allowed=await rpc('has_scavland_permission',{required_permission:'items_edit'},authorization);
   const publish=await rpc('has_scavland_permission',{required_permission:'publish_public'},authorization);
   return {actor,permissions:allowed===true?['items_edit',...(publish===true?['publish_public']:[])]:[]};
  },
  loadContext:async(itemId,authorization)=>{
   if(typeof readSource!=='function')fail('Attachment source integration is unavailable.',503);
   const latest=await readSource(),source=latest.documents['data/items.json'].data.find(r=>r.id===itemId)||null;
   // Also reject public specialist links even if an old classification is incomplete.
   for(const kind of ['ammo','armour','weapons'])if(latest.documents['data/'+kind+'.json']?.data.some(r=>r.id===itemId))fail('Review this item in its existing category editor.',409);
   const saved=await rpc('scavland_attachment_draft',{p_action:'load',p_item:itemId},authorization);
   if(!source&&!saved.draft?.payload?.creation)fail('Item not found.',404);
   const legacy=await rpc('scavland_item_legacy',{},authorization,true);
   return {source,settings:latest.settings,images:latest.images,weapons:latest.documents['data/weapons.json']?.data,version:saved.currentVersion,savedDraft:saved.draft?.payload||null,legacyDrafts:legacy?[legacy]:[],legacyVersion:legacy?.version||0};
  },
  storage:{
   receipt:input=>rpc('scavland_attachment_receipt',{p_actor:input.actor,p_item:input.itemId,p_request:input.requestId,p_command:input.command},null,true),
   prepare:input=>rpc('scavland_prepare_attachment',{p_actor:input.actor,p_item:input.itemId,p_request:input.requestId,p_command:input.command,p_payload:input.payload,p_legacy:input.legacyVersion},null,true),
   save:input=>rpc('scavland_attachment_draft',{p_action:'save',p_item:input.itemId,p_request:input.requestId},input.authorization)
  }
 });
}
