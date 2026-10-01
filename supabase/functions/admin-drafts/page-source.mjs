import model from './page-model.mjs';
// Read-only trusted context, pinned to one repository commit. No browser inventory.
const root='https://api.github.com/repos/scavlandfanbase/scavlandfanbase.github.io';
function unavailable(){const error=new Error();error.status=503;throw error;}
export function createPageContextSource({env,fetcher=fetch}){
 return async({pageId,rpc})=>{
  const token=env('GITHUB_TOKEN');if(!token)unavailable();
  async function get(path){
   const response=await fetcher(root+path,{headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},signal:AbortSignal.timeout(15000)});
   if(!response.ok)unavailable();return response.json();
  }
  const head=(await get('/git/ref/heads/main')).object?.sha;
  if(typeof head!=='string'||!/^[a-f0-9]{40}$/i.test(head))unavailable();
  const tree=await get('/git/trees/'+head+'?recursive=1');
  if(tree.truncated!==false||!Array.isArray(tree.tree))unavailable();
  // Public custom pages need a reviewed identity manifest before future rollout.
  // Refuse existing custom HTML rather than guess ownership from a matching slug.
  if(tree.tree.some(entry=>entry.type==='blob'&&/^pages\/.*\.html$/i.test(entry.path)))unavailable();
  const file=await get('/contents/data/site-images.json?ref='+head);
  if(file.encoding!=='base64'||typeof file.content!=='string')unavailable();
  let inventory;try{inventory=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(file.content.replace(/\s/g,'')),c=>c.charCodeAt(0))));}catch{unavailable();}
  if(!inventory||typeof inventory.categories!=='object'||inventory.categories===null||Array.isArray(inventory.categories))unavailable();
  const files=new Set(tree.tree.filter(entry=>entry.type==='blob'&&['100644','100755'].includes(entry.mode)).map(entry=>entry.path));
  const choices=Object.values(inventory.categories).flatMap(category=>Array.isArray(category?.images)?category.images:[]);
  const approvedImages=[...new Set(choices.filter(image=>model.safeImagePath(image)&&files.has(image)))];
  const existingPages=[];let after=null;
  for(let batch=0;batch<100;batch++){
   const pages=await rpc('scavland_page',{p_action:'list',p_page:null,p_request:null,p_after:after});
   if(!Array.isArray(pages)||pages.length>100)unavailable();
   for(const page of pages)existingPages.push({id:page.pageId,slug:page.slug});
   if(pages.length<100)return {approvedImages,existingPages,currentPageId:existingPages.some(page=>page.id===pageId)?pageId:null};
   const next=pages.at(-1).pageId;if(typeof next!=='string'||next===after)unavailable();after=next;
  }
  unavailable();
 };
}
