// Server-only, read-only legacy Pages evidence. Never accept browser build events.
const api='https://api.github.com/repos/scavlandfanbase/scavlandfanbase.github.io';
const site='https://scavlandfanbase.github.io/';
function fail(status=503){const error=new Error('Publication evidence unavailable.');error.status=status;throw error;}
export function createPageBuildEvidence({env,fetcher=fetch}){
 return async({commit,buildId,path,digest})=>{
  if(!/^[a-f0-9]{40}$/.test(commit)||!/^\d+$/.test(buildId)||!/^pages\/[a-z0-9]+(?:-[a-z0-9]+)*\/index\.html$/.test(path)||! /^[a-f0-9]{64}$/.test(digest))fail(400);
  const token=env('GITHUB_TOKEN');if(!token)fail();
  const response=await fetcher(api+'/pages/builds/'+buildId,{headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2026-03-10'},redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!response.ok)fail();const build=await response.json();
  // Build identity and commit must both match, including on failed/pending builds.
  if(build.commit!==commit||build.url!==api+'/pages/builds/'+buildId)fail(409);
  if(build.status==='errored')return {type:'build',sha:commit,runId:buildId,status:'failure'};
  if(['queued','building'].includes(build.status))return {type:'build',sha:commit,runId:buildId,status:'pending'};
  if(build.status!=='built')fail();
  // A successful build alone is insufficient: verify the public bytes too.
  // No Authorization header crosses to the public site; reject redirects.
  const live=await fetcher(site+path,{headers:{'Cache-Control':'no-cache'},redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!live.ok)return {type:'build',sha:commit,runId:buildId,status:'pending'};
  const length=Number(live.headers.get('content-length'));if(length>2000000)fail();
  const reader=live.body?.getReader();if(!reader)fail();let size=0;const chunks=[];
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2000000)fail();chunks.push(value);}}
  finally{await reader.cancel();}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  const actual=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),byte=>byte.toString(16).padStart(2,'0')).join('');
  return {type:'build',sha:commit,runId:buildId,status:actual===digest?'success':'pending'};
 };
}
