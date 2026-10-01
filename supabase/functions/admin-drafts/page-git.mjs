import {verifyTrustedPagePreview} from './page-preview.mjs';
const root='https://api.github.com/repos/scavlandfanbase/scavlandfanbase.github.io';
const sha=value=>typeof value==='string'&&/^[a-f0-9]{40}$/.test(value);
function fail(status=503){const error=new Error('Page repository operation unavailable.');error.status=status;throw error;}
// Unwired server adapter. persistCandidate must durably bind one candidate per
// publication request BEFORE any ref write. Its database implementation is required.
export function createPageGitPublisher({env,fetcher=fetch,persistCandidate}){
 return async({requestId,createdAt,preview,saved,snapshot})=>{
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(requestId)
   ||typeof createdAt!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(createdAt)||!Number.isFinite(Date.parse(createdAt)))fail(400);
  if(typeof persistCandidate!=='function'||!env('GITHUB_TOKEN'))fail();
  const verified=await verifyTrustedPagePreview(preview,{saved,snapshot});
  async function call(path,method='GET',body){
   const response=await fetcher(root+path,{method,headers:{Authorization:'Bearer '+env('GITHUB_TOKEN'),Accept:'application/vnd.github+json','Content-Type':'application/json','X-GitHub-Api-Version':'2026-03-10'},
    body:body===undefined?undefined:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(15000)});
   if(!response.ok)fail(response.status===409||response.status===422?409:503);return response.json();
  }
  const base=await call('/git/commits/'+verified.baseHead);if(base.sha!==verified.baseHead||!sha(base.tree?.sha))fail();
  const tree=await call('/git/trees','POST',{base_tree:base.tree.sha,tree:[
   {path:verified.path,mode:'100644',type:'blob',content:verified.html},
   {path:'data/page-builder-pages.json',mode:'100644',type:'blob',content:JSON.stringify(verified.manifest,null,2)+'\n'}]});
  if(!sha(tree.sha))fail();
  // Fixed server reservation time makes object creation deterministic on retry.
  const identity={name:'SCAVLAND Page Publisher',email:'scavland-page-publisher@users.noreply.github.com',date:createdAt};
  const commit=await call('/git/commits','POST',{message:'Publish page '+verified.pageId+' revision '+verified.version+'\n\nSCAVLAND-Publication: '+requestId,
   tree:tree.sha,parents:[verified.baseHead],author:identity,committer:identity});
  if(!sha(commit.sha))fail();
  const candidate={requestId,commit:commit.sha,baseHead:verified.baseHead,tree:tree.sha,digest:verified.digest,path:verified.path};
  await persistCandidate(candidate); // never perform a ref write if persistence fails
  async function observe(){
   const ref=await call('/git/ref/heads/main');if(ref.ref!=='refs/heads/main'||ref.object?.type!=='commit'||!sha(ref.object.sha))fail();
   if(ref.object.sha===commit.sha)return 'committed';
   if(ref.object.sha===verified.baseHead)return 'baseline';
   const comparison=await call('/compare/'+commit.sha+'...'+ref.object.sha);
   if(comparison.merge_base_commit?.sha===commit.sha&&['ahead','identical'].includes(comparison.status))return 'committed';
   return 'changed';
  }
  let before;try{before=await observe();}catch{return {...candidate,state:'unknown'};}
  if(before==='committed')return {...candidate,state:'committed'};
  if(before==='changed')return {...candidate,state:'refused'}; // requires fenced recovery before releasing editing
  try{await call('/git/refs/heads/main','PATCH',{sha:commit.sha,force:false});}
  catch{ // Rejection and lost response are both reconciled using Git evidence.
   try{return {...candidate,state:await observe()==='committed'?'committed':'unknown'};}catch{return {...candidate,state:'unknown'};}
  }
  // A successful HTTP response is verified independently; still no Pages success.
  try{return {...candidate,state:await observe()==='committed'?'committed':'unknown'};}catch{return {...candidate,state:'unknown'};}
 };
}
