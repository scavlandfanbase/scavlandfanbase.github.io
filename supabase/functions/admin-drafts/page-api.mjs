// Prepared adapter only: not wired to production.mjs or deployed.
import {validatePageRequest} from './page-request.mjs';
import model from './page-model.mjs';
import {createPageContextSource} from './page-source.mjs';
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const headers={'Access-Control-Allow-Origin':'https://scavlandfanbase.github.io','Cache-Control':'no-store'};
const reply=(body,status=200)=>Response.json(body,{status,headers});
function fail(status){const error=new Error();error.status=status;throw error;}
export function createPageApi({env,fetcher=fetch,readContext}){
 const contextReader=readContext??createPageContextSource({env,fetcher});
 return async request=>{
  if(env('PAGE_BUILDER_ENABLED')!=='true')return reply({error:'Page Builder is not enabled.'},503);
  if(request.method!=='POST')return reply({error:'POST is required.'},405);
  const authorization=request.headers.get('Authorization');
  if(!authorization?.startsWith('Bearer ')||!authorization.slice(7).trim())return reply({error:'Sign in to continue.'},401);
  try{
   const sb=env('SUPABASE_URL'),key=env('SUPABASE_ANON_KEY');if(!sb||!key)fail(503);
   const raw=await request.text();if(new TextEncoder().encode(raw).length>1100000)fail(413);
   let command;try{command=validatePageRequest(JSON.parse(raw));}catch{fail(400);}
   async function rpc(name,args,trusted=false){
    const credential=trusted?env('SUPABASE_SERVICE_ROLE_KEY'):key;if(!credential)fail(503);
    const response=await fetcher(sb+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:credential,
     Authorization:trusted?'Bearer '+credential:authorization,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(15000)});
    const value=await response.json();if(!response.ok)fail(value.code==='PT409'||value.code==='23505'?409:value.code==='42501'?403:response.status===401?401:response.status>=500?503:400);
    return value;
   }
   const page=command.pageId??null;
   // Caller-JWT RPC checks current DB permissions, including before service work.
   const state=await rpc('scavland_page',{p_action:command.action==='list'||command.action==='create'?'list':'load',p_page:page,
    p_request:null,p_after:command.action==='list'?command.after??null:null});
   if(command.action==='list')return reply({pages:state,nextCursor:state.length===100?state.at(-1).pageId:null});
   if(command.action==='load')return reply(state); // invalid historic content remains repairable
   if(!env('SUPABASE_SERVICE_ROLE_KEY'))fail(503);
   const userResponse=await fetcher(sb+'/auth/v1/user',{headers:{apikey:key,Authorization:authorization},signal:AbortSignal.timeout(15000)});
   if(!userResponse.ok)fail(401);const actor=(await userResponse.json()).id;if(!uuid(actor))fail(401);
   const args={p_actor:actor,p_request:command.requestId,p_action:command.action,p_page:page,
    p_version:command.expectedVersion??0,p_command:command};
   let receipt=await rpc('scavland_prepare_page',args,true);
   if(!uuid(receipt?.page_id)||receipt.actor!==actor)fail(503);
   if(receipt.payload===null){
    if(typeof contextReader!=='function')fail(503);
    const context=await contextReader({pageId:receipt.page_id,rpc});
    let validated;try{validated=model.validate(command.action==='create'?{...command.page,id:receipt.page_id}:command.page,context);}catch{fail(400);}
    receipt=await rpc('scavland_prepare_page',{...args,p_payload:validated},true);
   }
   return reply(await rpc('scavland_page',{p_action:'commit',p_page:receipt.page_id,p_request:command.requestId,p_after:null}));
  }catch(error){
   const status=error.status||503;
   const messages={400:'Invalid page entries. Keep your edits and review the fields.',401:'Sign in again. Your saved work is retained.',
    403:'Content editing permission required.',409:'The page or address changed. Keep your edits and reload explicitly.',
    413:'Page request is too large.',503:'Page work was not confirmed. Keep your edits and retry the same request.'};
   return reply({error:messages[status]||messages[503]},status);
  }
 };
}
