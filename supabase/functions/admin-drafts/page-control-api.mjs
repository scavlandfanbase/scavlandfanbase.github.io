import {validatePageRequest} from './page-request.mjs';
import {createPageContextSource} from './page-source.mjs';
import {createTrustedPagePreview} from './page-preview.mjs';
import {createPageGitPublisher,createPageGitObserver} from './page-git.mjs';
import {createPageBuildDiscovery,createPageBuildEvidence} from './page-build-evidence.mjs';
const headers={'Access-Control-Allow-Origin':'https://scavlandfanbase.github.io','Cache-Control':'no-store'};
const reply=(value,status=200)=>Response.json(value,{status,headers});
function fail(status=503){const error=new Error();error.status=status;throw error;}
// Gated production preparation. Browser supplies identities, never Git evidence.
export function createPageControlApi({env,fetcher=fetch,readSnapshot,publisherFactory=createPageGitPublisher,observeGit,discoverBuild,readBuild}){
 const source=readSnapshot??createPageContextSource({env,fetcher,withSnapshot:true});
 return async request=>{
  if(env('PAGE_BUILDER_ENABLED')!=='true')return reply({error:'Page Builder is not enabled.'},503);
  const auth=request.headers.get('Authorization');if(!auth?.startsWith('Bearer ')||!auth.slice(7).trim())return reply({error:'Sign in to continue.'},401);
  try{
   const raw=await request.text();if(new TextEncoder().encode(raw).length>1100000)fail(413);
   let command;try{command=validatePageRequest(JSON.parse(raw));}catch{fail(400);}
   const sb=env('SUPABASE_URL'),key=env('SUPABASE_ANON_KEY');if(!sb||!key)fail();
   async function rpc(name,args,trusted=false){
    const credential=trusted?env('SUPABASE_SERVICE_ROLE_KEY'):key;if(!credential)fail();
    const response=await fetcher(sb+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:credential,Authorization:trusted?'Bearer '+credential:auth,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(15000)});
    const value=await response.json();if(!response.ok)fail(value.code==='42501'?403:value.code==='PT409'||value.code==='23505'?409:response.status>=500?503:400);return value;
   }
   const read=args=>rpc('scavland_read_page_work',{p_page:null,p_version:null,p_request:null,...args});
   if(command.action==='page-state')return reply({publication:await read({p_action:'page-state',p_page:command.pageId})});
   if(command.action==='history')return reply({revisions:await read({p_action:'history',p_page:command.pageId})});
   if(command.action==='revision')return reply({draft:await read({p_action:'revision',p_page:command.pageId,p_version:command.version})});
   if(command.action==='source'){
    await rpc('scavland_page',{p_action:'list',p_page:null,p_request:null,p_after:null});
    const snapshot=await source({pageId:null,rpc});const owner=await rpc('is_scavland_owner',{});
    return reply({imageChoices:snapshot.context.approvedImages,existingPages:snapshot.context.existingPages,capabilities:{publish:owner===true}});
   }
   if(command.action==='preview'){
    const current=await rpc('scavland_page',{p_action:'load',p_page:command.pageId,p_request:null,p_after:null});
    if(current.currentVersion!==command.version||!current.draft)fail(409);
    const user=await fetcher(sb+'/auth/v1/user',{headers:{apikey:key,Authorization:auth},signal:AbortSignal.timeout(15000)});
    if(!user.ok)fail(401);const actor=(await user.json()).id;if(typeof actor!=='string')fail(401);
    const snapshot=await source({pageId:command.pageId,rpc});const preview=await createTrustedPagePreview({saved:current.draft,snapshot});
    await rpc('scavland_prepare_page_preview',{p_actor:actor,p_request:command.requestId,p_page:command.pageId,p_version:command.version,p_preview:preview},true);
    return reply({previewId:command.requestId,preview,page:current.draft.payload});
   }
   if(!['publish','status'].includes(command.action))fail(400);
   if(command.action==='publish')await rpc('scavland_reserve_page_publication',{p_request:command.requestId,p_preview:command.previewId});
   let work=await read({p_action:'publication',p_request:command.requestId});
   async function confirmBuild(){
    if(['committed','build-failed'].includes(work.publication.state)){
     const id=await (discoverBuild??createPageBuildDiscovery({env,fetcher}))(work.publication.commit_sha);
     if(id){const event=await (readBuild??createPageBuildEvidence({env,fetcher}))({commit:work.publication.commit_sha,buildId:id,path:work.preview.path,digest:work.preview.digest});
      await rpc('scavland_page_publication_outcome',{p_request:command.requestId,p_event_id:crypto.randomUUID(),p_event:event},true);
      work=await read({p_action:'publication',p_request:command.requestId});
     }
    }
    return reply({publication:work.publication});
   }
   if(work.publication.state!=='prepared')return await confirmBuild();
   const attempt=crypto.randomUUID();
   const publisher=publisherFactory({env,fetcher,persistCandidate:candidate=>rpc('scavland_prepare_page_git_candidate',{p_request:command.requestId,p_candidate:candidate},true),
    claimAttempt:async()=> (await rpc('scavland_page_dispatch',{p_request:command.requestId,p_attempt:attempt,p_action:'claim'},true)).acquired});
   // Status performs GET-only Git reconciliation, never object creation/dispatch.
   let result;
   if(command.action==='status'){
    if(!work.candidate)return reply({publication:work.publication,uncertain:true});
    result=await (observeGit??createPageGitObserver({env,fetcher}))(work.candidate);
   }else{
    const snapshot=await source({pageId:work.saved.page_id,rpc,pinnedHead:work.preview.baseHead});
    result=await publisher({requestId:command.requestId,createdAt:new Date(work.publication.created_at).toISOString(),preview:work.preview,saved:work.saved,snapshot});
   }
   if(result.state==='committed')await rpc('scavland_page_publication_outcome',{p_request:command.requestId,p_event_id:crypto.randomUUID(),p_event:{type:'commit',sha:result.commit}},true);
   else if(result.state==='refused'&&result.noWrite===true)await rpc('scavland_page_dispatch',{p_request:command.requestId,p_attempt:attempt,p_action:'refuse-no-write'},true);
   work=await read({p_action:'publication',p_request:command.requestId});
   if(work.publication.state==='committed')return await confirmBuild();
   return reply({publication:work.publication,uncertain:result.state==='unknown'});
  }catch(error){const status=error.status||503;return reply({error:status===403?'Permission required.':status===409?'Saved page or publication changed. Keep your edits.':status===400?'Invalid page request.':'Page action was not confirmed. Keep your edits and retry the same request.'},status);}
 };
}
