import model from './page-model.mjs';
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const sha=value=>typeof value==='string'&&/^[a-f0-9]{40}$/.test(value);
const digest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
function fail(message,status=400){const error=new Error(message);error.status=status;throw error;}
function exact(value,fields){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==fields.length||fields.some(field=>!Object.hasOwn(value,field)))fail('Invalid public page metadata.');
}
function entry(value){
 exact(value,['id','slug','version','digest']);
 if(!uuid(value.id)||!Number.isSafeInteger(value.version)||value.version<1||value.version>=2147483647||!digest(value.digest))fail('Invalid public page metadata.');
 model.pageAddress(value.slug);return structuredClone(value);
}
export function validatePageManifest(input){
 exact(input,['schemaVersion','pages']);
 if(input.schemaVersion!==1||!Array.isArray(input.pages)||input.pages.length>10000)fail('Invalid public page metadata.');
 const ids=new Set(),slugs=new Set();
 const pages=input.pages.map(value=>{const page=entry(value);if(ids.has(page.id)||slugs.has(page.slug))fail('Duplicate public page identity or address.');ids.add(page.id);slugs.add(page.slug);return page;});
 return {schemaVersion:1,pages};
}
export function updatePageManifest(input,page){
 const manifest=validatePageManifest(input),next=entry(page),existing=manifest.pages.find(record=>record.id===next.id);
 if(manifest.pages.some(record=>record.slug===next.slug&&record.id!==next.id))fail('Public page address is already owned.',409);
 // Rename requires an explicit old-route removal/redirect plan; never silently orphan it.
 if(existing&&existing.slug!==next.slug)fail('Published page address changes require a reviewed route migration.',409);
 if(existing&&next.version<existing.version)fail('An older page revision cannot replace the current public revision.',409);
 if(existing&&next.version===existing.version&&next.digest!==existing.digest)fail('Published revision output changed.',409);
 const pages=manifest.pages.filter(record=>record.id!==next.id);pages.push(next);
 return validatePageManifest({schemaVersion:1,pages:pages.sort((a,b)=>a.slug.localeCompare(b.slug))});
}
// Private receipt transition contract only; no database or Git mutation here.
export function recordPagePublication(receipt,event){
 exact(receipt,['requestId','pageId','version','digest','baseHead','state','commit','buildRun']);
 if(!uuid(receipt.requestId)||!uuid(receipt.pageId)||!Number.isSafeInteger(receipt.version)||receipt.version<1
  ||receipt.version>=2147483647||!digest(receipt.digest)||!sha(receipt.baseHead)
  ||!['prepared','committed','live','build-failed'].includes(receipt.state)
  ||receipt.buildRun!==null&&(typeof receipt.buildRun!=='string'||!/^\d+$/.test(receipt.buildRun)))fail('Invalid page publication receipt.');
 if(receipt.state==='prepared'&&(receipt.commit!==null||receipt.buildRun!==null)
  ||receipt.state!=='prepared'&&!sha(receipt.commit)
  ||['live','build-failed'].includes(receipt.state)&&!/^\d+$/.test(receipt.buildRun))fail('Invalid page publication receipt.');
 const next=structuredClone(receipt);
 if(event?.type==='commit'){
  exact(event,['type','sha']);if(!sha(event.sha))fail('Invalid commit evidence.');
  if(next.commit!==null&&next.commit!==event.sha)fail('Publication request already belongs to another commit.',409);
  if(next.state==='prepared'){next.commit=event.sha;next.state='committed';}
 }else if(event?.type==='build'){
  exact(event,['type','sha','runId','status']);
  if(next.state==='prepared'||event.sha!==next.commit||typeof event.runId!=='string'||!/^\d+$/.test(event.runId)||!['success','failure','pending'].includes(event.status))fail('Build does not match this publication.',409);
  if(event.status==='pending')return next;
  if(next.state==='live'&&event.status!=='success')fail('Confirmed publication cannot be downgraded by a later build event.',409);
  if(next.state==='live'&&next.buildRun!==event.runId)fail('Confirmed build receipt cannot change.',409);
  next.buildRun=event.runId;next.state=event.status==='success'?'live':'build-failed';
 }else fail('Invalid publication event.');
 return next;
}
