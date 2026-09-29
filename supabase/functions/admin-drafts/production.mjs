import {createHandler} from './handler.mjs';
import {createCore,fail,rebasePayload} from './core.mjs';
const cors={'Access-Control-Allow-Origin':'https://scavlandfanbase.github.io','Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const reply=(value,status=200)=>Response.json(value,{status,headers:{...cors,'Cache-Control':'no-store'}});
export function createProductionHandler({env,fetcher=fetch,core=createCore({env,fetcher})}){
 const persistence=createHandler({env,fetcher,publishers:core.publishers});
 return async request=>{
  if(request.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(request.method!=='POST')return reply({error:'POST is required.'},405);
  try{
   const raw=await request.clone().text();if(new TextEncoder().encode(raw).length>1100000)fail('Draft is too large.',413);
   let body;try{body=JSON.parse(raw);}catch{fail('Invalid editor request.');}
   if(!['items','vendors'].includes(body?.domain)||body.entityId!=='catalogue')fail('This editor is unavailable in Admin 0.1.',404);
   if(body.action==='publish'&&env('ADMIN_CORE_ENABLED')!=='true')fail('Publishing awaits activation of the trusted core and retirement of legacy editors.',503);
   if(!['source','prepare'].includes(body.action))return persistence(request);
   const sb=env('SUPABASE_URL'),key=env('SUPABASE_ANON_KEY'),auth=request.headers.get('Authorization')||'';
   if(!sb||!key)fail('Private storage is not configured.',503);
   if(!auth.startsWith('Bearer '))fail('Sign in to continue.',401);
   async function rpc(name,args,trusted=false){
    const token=trusted?env('SUPABASE_SERVICE_ROLE_KEY'):key;
    if(!token)fail('Trusted editor actions are not configured.',503);
    const response=await fetcher(sb+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:token,Authorization:trusted?'Bearer '+token:auth,'Content-Type':'application/json'},body:JSON.stringify(args)});
    const result=await response.json();
    if(!response.ok)fail(result.message||'Could not complete this action.',result.code==='PT409'||result.code==='23505'?409:response.status===401||response.status===403?response.status:response.status>=500?503:400);
    return result;
   }
   // Permission check uses the real caller JWT, never the service identity.
   const saved=await rpc('scavland_draft',{p_action:'load',p_domain:body.domain,p_entity_id:'catalogue'});
   if(body.action==='source')return reply({...core.view(body.domain,saved.draft,await core.read(body.domain)),capabilities:{publish:env('ADMIN_CORE_ENABLED')==='true'&&env('DRAFT_PUBLISH_ENABLED')==='true'}});
   if(!Number.isSafeInteger(body.expectedVersion)||body.expectedVersion<0||typeof body.requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.requestId)||!body.command||typeof body.command!=='object'||Array.isArray(body.command))fail('Invalid editor action.');
   const userResponse=await fetcher(sb+'/auth/v1/user',{headers:{apikey:key,Authorization:auth}});
   if(!userResponse.ok)fail('Sign in again. Your entries are retained.',401);
   const actor=(await userResponse.json()).id;if(typeof actor!=='string')fail('Sign in again.',401);
   const args={p_actor:actor,p_domain:body.domain,p_version:body.expectedVersion,p_request:body.requestId,p_command:body.command};
   const receipt=await rpc('scavland_prepare',args,true);
   if(receipt)return reply(receipt); // Original ID/time even after response loss.
   if(saved.currentVersion!==body.expectedVersion)fail('Conflict — newer version exists. Your entries are retained.',409);
   const latest=await core.read(body.domain),context=core.context(body.domain,saved.draft,latest);
   let prepared;
   if(body.command.action==='refresh-public'){
    if(body.domain!=='items'||Object.keys(body.command).some(k=>k!=='action'))fail('Invalid refresh action.');
    prepared=rebasePayload(body.domain,saved.draft?{...saved.draft,payload:context.payload,base:context.base}:null,latest);
    if(prepared.conflicts.length)return reply({conflicts:prepared.conflicts,error:'Public changes conflict with your private draft. Nothing was saved.'},409);
   }else prepared=core.mutate(body.domain,context,body.command,latest,actor);
   return reply(await rpc('scavland_prepare',{...args,p_payload:prepared.payload,p_base:prepared.base},true));
  }catch(e){return reply({error:e.status?e.message:'Could not complete this action. Keep your entries and retry.'},e.status||503);}
 };
}
