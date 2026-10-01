import {createPageGitObserver} from './page-git.mjs';
const root='https://api.github.com/repos/scavlandfanbase/scavlandfanbase.github.io';
const sha=value=>typeof value==='string'&&/^[a-f0-9]{40}$/.test(value);
// Recovery places a content-identical sibling commit at the original baseline.
// Either the original candidate or this fence may advance main, never both by
// fast-forward. Persist and record the fence attempt before attempting its ref write.
// This adapter must not be exposed until its durable receipt RPC is integrated.
export function createPageGitRecovery({env,fetcher=fetch,persistFence,claimFence}){
 return async({candidate,createdAt})=>{
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(candidate?.requestId)||!sha(candidate?.commit)||!sha(candidate?.baseHead)||typeof createdAt!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(createdAt)||!Number.isFinite(Date.parse(createdAt))||!env('GITHUB_TOKEN')||typeof persistFence!=='function'||typeof claimFence!=='function')throw Error('Recovery unavailable.');
  const observe=createPageGitObserver({env,fetcher});
  if((await observe(candidate)).state==='committed')return {...candidate,state:'committed'};
  async function call(path,method='GET',body){const response=await fetcher(root+path,{method,headers:{Authorization:'Bearer '+env('GITHUB_TOKEN'),Accept:'application/vnd.github+json','Content-Type':'application/json','X-GitHub-Api-Version':'2026-03-10'},body:body===undefined?undefined:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('Recovery not confirmed.');return response.json();}
  const base=await call('/git/commits/'+candidate.baseHead);if(base.sha!==candidate.baseHead||!sha(base.tree?.sha))throw Error('Recovery baseline unavailable.');
  const identity={name:'SCAVLAND Page Publisher',email:'scavland-page-publisher@users.noreply.github.com',date:createdAt};
  const commit=await call('/git/commits','POST',{message:'Fence interrupted page publication\n\nSCAVLAND-Recovery: '+candidate.requestId,tree:base.tree.sha,parents:[candidate.baseHead],author:identity,committer:identity});if(!sha(commit.sha)||commit.sha===candidate.commit)throw Error('Recovery fence invalid.');
  const fence={requestId:candidate.requestId,commit:commit.sha,baseHead:candidate.baseHead,candidateCommit:candidate.commit};await persistFence(fence);
  const acquired=await claimFence(fence);if(typeof acquired!=='boolean')throw Error('Recovery claim unavailable.');
  // Repeating this identical content-free fence is safe: it cannot publish the
  // candidate, and resolves a crash between recording the attempt and ref write.
  {const ref=await call('/git/ref/heads/main');if(ref.ref!=='refs/heads/main'||ref.object?.type!=='commit'||!sha(ref.object.sha))throw Error('Recovery ref unavailable.');if(ref.object.sha===candidate.baseHead){try{await call('/git/refs/heads/main','PATCH',{sha:fence.commit,force:false});}catch{/* Reconcile an uncertain response; do not repeat dispatch. */}}}
  if((await observe(candidate)).state==='committed')return {...candidate,state:'committed'};
  if((await observe(fence)).state==='committed')return {...candidate,state:'fenced',fenceCommit:fence.commit};
  return {...candidate,state:'unknown'};
 };
}
