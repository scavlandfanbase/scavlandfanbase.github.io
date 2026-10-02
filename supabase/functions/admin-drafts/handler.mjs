// Shared authenticated contract. The DB RPC reuses has_scavland_permission.
// No service-role key; caller JWT reaches auth.uid() and the existing permission model.
const cors={'Access-Control-Allow-Origin':'https://scavlandfanbase.github.io','Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const domains=new Set(['items','ammo','vendors','vendor-inventory','pages']);
export function createHandler({env,fetcher=fetch,publishers={}}){
 return async req=>{
  const reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return reply({error:'POST is required.'},405);
  try{
   const url=env('SUPABASE_URL'),key=env('SUPABASE_ANON_KEY'),auth=req.headers.get('Authorization')||'';
   if(!url||!key)fail('Private draft storage is not configured.',503);
   if(!auth.startsWith('Bearer '))fail('Sign in to use private drafts.',401);
   const raw=await req.text();if(new TextEncoder().encode(raw).length>1100000)fail('Draft is too large.',413);
   let body;try{body=JSON.parse(raw);}catch{fail('Invalid draft request.');}
   if(!body||!domains.has(body.domain)||typeof body.entityId!=='string'||!['load','save','preview','publish'].includes(body.action))fail('Invalid draft request.');
   async function rpc(action){
    const response=await fetcher(url+'/rest/v1/rpc/scavland_draft',{method:'POST',headers:{apikey:key,Authorization:auth,'Content-Type':'application/json'},body:JSON.stringify({p_action:action,p_domain:body.domain,p_entity_id:body.entityId,...(action==='save'?{p_expected_version:body.expectedVersion,p_payload:body.payload,p_base:body.base,p_request_id:body.requestId}:{})})});
    let data;try{data=await response.json();}catch{fail('Private storage returned an invalid response. Keep your entries and retry.',502);}
    if(!response.ok)fail(data.message||'Could not access private drafts.',data.code==='PT409'||data.code==='23505'?409:response.status===401||response.status===403?response.status:response.status>=500?503:400);
    return data;
   }
   // RPC is the authorization boundary for all operations, including publication.
   const saved=await rpc(body.action==='save'?'save':'load');
   if(body.action==='publish'){const permission=await fetcher(url+'/rest/v1/rpc/has_scavland_permission',{method:'POST',headers:{apikey:key,Authorization:auth,'Content-Type':'application/json'},body:JSON.stringify({required_permission:'publish_public'})});if(!permission.ok||await permission.json()!==true)fail('Publishing permission required. Your private draft is retained.',403);}
   if(['save','load'].includes(body.action))return reply(saved);
   if(!saved.draft)fail('Save a private draft first.',404);
   if(!Number.isInteger(body.expectedVersion)||body.expectedVersion!==saved.currentVersion)fail('Conflict — newer draft version exists.',409);
   const adapter=publishers[body.domain];
   if(!adapter)fail('Preview and publishing are not enabled for this editor yet. Your private draft is retained.',503);
   await adapter.validate(structuredClone(saved.draft));
   if(body.action==='preview')return reply({version:saved.draft.version,preview:await adapter.preview(structuredClone(saved.draft))});
   if(body.confirm!==true)fail('Explicitly confirm Publish. Save Draft never publishes.');
   if(env('DRAFT_PUBLISH_ENABLED')!=='true')fail('Publishing is disabled. Your private draft is retained.',503);
   const publication=await adapter.publish(structuredClone(saved.draft));
   // Publication identifies the exact immutable saved version; never deletes the draft.
   return reply({publishedVersion:saved.draft.version,publication});
  }catch(error){return reply({error:error.status?error.message:'Couldn’t save or publish. Keep your entries and retry; check public state if a Publish response was lost.'},error.status||503);}
 };
}
