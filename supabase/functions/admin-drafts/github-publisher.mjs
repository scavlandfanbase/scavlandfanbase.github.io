// Server-configured publication adapter. No path/branch/URL comes from the browser.
// Reuses existing SCAVLAND Git tree + commit + non-force ref update architecture.
export function githubPublisher({repository,branch='main',token,paths,validate,project,fetcher=fetch}){
 if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)||!Array.isArray(paths)||!paths.length||new Set(paths).size!==paths.length||paths.some(p=>!/^data\/[a-z0-9/_-]+\.json$/.test(p)||p.includes('..'))||typeof validate!=='function'||typeof project!=='function')throw Error('Invalid publication adapter configuration.');
 const fail=(message,status=409)=>{throw Object.assign(Error(message),{status});};
 const root='https://api.github.com/repos/'+repository;
 async function gh(path,method='GET',body){
  const response=await fetcher(root+path,{method,headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  if(!response.ok)fail(response.status===409||response.status===422?'Public data changed. Reload and review before publishing.':'Publish could not be confirmed. Draft retained; inspect public state before retrying.',response.status===409||response.status===422?409:502);
  return response.json();
 }
 async function plan(draft){
  await validate(draft);
  if(!draft.base||Object.keys(draft.base).length!==paths.length||paths.some(p=>!Object.hasOwn(draft.base,p)))fail('A reviewed public base is required.',400);
  const head=await gh('/git/ref/heads/'+encodeURIComponent(branch)),commit=await gh('/git/commits/'+head.object.sha),documents={};
  for(const path of paths){
   const file=await gh('/contents/'+path+'?ref='+head.object.sha);
   if(file.sha!==draft.base[path])fail('Public data changed since this draft was based on it. Reload and review before publishing.');
   if(file.encoding!=='base64'||typeof file.content!=='string')fail('Unsupported public file response.',502);
   documents[path]=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(file.content.replace(/\n/g,'')),c=>c.charCodeAt(0))));
  }
  const result=await project(structuredClone(draft),structuredClone(documents));
  if(!result||typeof result!=='object'||Object.keys(result).length!==paths.length||paths.some(p=>!Object.hasOwn(result,p)))fail('Invalid publication projection.',400);
  const tree=paths.map(path=>{if(!result[path]||typeof result[path]!=='object')fail('Public documents must be JSON objects or arrays.',400);return {path,mode:'100644',type:'blob',content:JSON.stringify(result[path],null,2)+'\n'};});
  return {head:head.object.sha,baseTree:commit.tree.sha,tree};
 }
 return {
  validate,
  async preview(draft){const p=await plan(draft);return {draftVersion:draft.version,baseCommit:p.head,files:p.tree.map(({path,content})=>({path,content}))};},
  async publish(draft){
   const p=await plan(draft);
   const tree=await gh('/git/trees','POST',{base_tree:p.baseTree,tree:p.tree});
   const commit=await gh('/git/commits','POST',{message:`Publish private draft ${draft.domain}/${draft.entity_id} v${draft.version}`,tree:tree.sha,parents:[p.head]});
   await gh('/git/refs/heads/'+encodeURIComponent(branch),'PATCH',{sha:commit.sha,force:false});
   return {commit:commit.sha};
  }
 };
}
