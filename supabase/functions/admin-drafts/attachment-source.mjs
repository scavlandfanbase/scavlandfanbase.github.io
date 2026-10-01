// Trusted canonical source snapshot: every document comes from one main commit.
import {fail} from './core.mjs';
export function createAttachmentSource({env,fetcher=fetch}={}){
 const root='https://api.github.com/repos/scavlandfanbase/scavlandfanbase.github.io';
 async function get(path){
  const response=await fetcher(root+path,{headers:{Authorization:'Bearer '+env('GITHUB_TOKEN'),Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'}});
  if(!response.ok)fail('Canonical source is unavailable. Saved work is retained.',502);
  return response.json();
 }
 return async()=>{
  const head=(await get('/git/ref/heads/main')).object?.sha;
  if(typeof head!=='string'||!head)fail('Canonical source is unavailable.',502);
  const documents={},base={};
  for(const name of ['items','ammo','armour','weapons','vendors','verification-settings','site-images']){
   const path='data/'+name+'.json',file=await get('/contents/'+path+'?ref='+encodeURIComponent(head));
   if(file.encoding!=='base64'||typeof file.content!=='string'||typeof file.sha!=='string')fail('Invalid canonical source.',502);
   try{documents[path]=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(file.content.replace(/\n/g,'')),c=>c.charCodeAt(0))));}catch{fail('Invalid canonical source.',502);}
   base[path]=file.sha;
  }
  return {documents,base,head,settings:documents['data/verification-settings.json'],images:[...new Set(Object.values(documents['data/site-images.json'].categories||{}).flatMap(c=>c.images||[]))]};
 };
}
