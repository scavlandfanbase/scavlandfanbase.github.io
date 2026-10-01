import renderer from './page-renderer.mjs';
import stylesheet from './page-style.mjs';
import {updatePageManifest} from './page-publication.mjs';
export async function pageDigest(text){
 const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)));
 return [...bytes].map(value=>value.toString(16).padStart(2,'0')).join('');
}
// Server-owned saved state and trusted repository snapshot only. No browser HTML/CSS.
export async function createTrustedPagePreview({saved,snapshot}){
 if(!saved||!Number.isSafeInteger(saved.version)||saved.version<1||saved.version>=2147483647
  ||saved.archived!==false||saved.page_id!==saved.payload?.id
  ||!snapshot||typeof snapshot.head!=='string'||!/^[a-f0-9]{40}$/.test(snapshot.head)){
  const error=new Error('Saved page or trusted snapshot is unavailable.');error.status=409;throw error;
 }
 const context=snapshot.context;
 const html=renderer.document(saved.payload,{images:context?.approvedImages,existingPages:context?.existingPages,
  currentPageId:context?.currentPageId,css:stylesheet});
 const digest=await pageDigest(html),styleDigest=await pageDigest(stylesheet);
 const manifest=updatePageManifest(snapshot.manifest,{id:saved.page_id,slug:saved.payload.slug,version:saved.version,digest});
 return {pageId:saved.page_id,version:saved.version,baseHead:snapshot.head,path:'pages/'+saved.payload.slug+'/index.html',
  digest,styleDigest,html,manifest};
}
export async function verifyTrustedPagePreview(preview,{saved,snapshot}){
 const current=await createTrustedPagePreview({saved,snapshot});
 for(const field of ['pageId','version','baseHead','path','digest','styleDigest'])if(preview?.[field]!==current[field]){
  const error=new Error('Page preview changed. Review a fresh preview before publishing.');error.status=409;throw error;
 }
 return current; // Publisher uses freshly rendered bytes, never submitted HTML/manifest.
}
