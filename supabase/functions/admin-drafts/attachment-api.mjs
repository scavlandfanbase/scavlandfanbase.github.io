// Preparation-only adapter. Production routing/transport are deliberately unregistered.
import {prepareAttachmentDecision,prepareAttachmentEdit} from './attachment-draft.mjs';
import {legacyDigest} from './legacy-item-review.mjs';
import {fail} from './core.mjs';
import {legacyItemBlockers} from './item-draft.mjs';
export function createAttachmentApi({enabled=()=>false,publishEnabled=()=>false,authenticate,loadContext,storage,publication}={}){
 return async request=>{
  const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
  try{
   if(!enabled())fail('Attachment editing is not enabled.',503);
   if(request.method!=='POST')fail('POST is required.',405);
   const auth=request.headers.get('Authorization');if(!auth?.startsWith('Bearer '))fail('Sign in to continue.',401);
   const identity=await authenticate(auth);
   if(!identity?.actor)fail('Sign in again.',401);
   if(!identity.permissions?.includes('items_edit'))fail('Items editing permission is required.',403);
   const raw=await request.text();if(new TextEncoder().encode(raw).length>50000)fail('Attachment request is too large.',413);
   let body;try{body=JSON.parse(raw);}catch{fail('Invalid request.');}
   if(!body||Array.isArray(body)||Object.keys(body).some(k=>!['action','itemId','requestId','command','previewId','confirm','expectedVersion'].includes(k))||
    !['load','prepare','save','preview','publish'].includes(body.action)||typeof body.itemId!=='string'||!body.itemId.trim()||body.itemId.length>160)fail('Invalid Attachment request.');
   if(['preview','publish'].includes(body.action)){
    if(body.command!==undefined||body.requestId!==undefined||!Number.isSafeInteger(body.expectedVersion)||body.expectedVersion<1)fail('Preview a saved Attachment version.');
    if(body.action==='publish'&&(!publishEnabled()||body.confirm!==true||typeof body.previewId!=='string'))fail('Publication requires enabled publishing and explicit preview confirmation.',403);
    if(typeof publication!=='function')fail('Attachment publication is unavailable.',503);
    return reply(await publication({...body,actor:identity.actor,authorization:auth}));
   }
   if(body.previewId!==undefined||body.confirm!==undefined||body.expectedVersion!==undefined)fail('Unsupported action fields.');
   const receiptActions=['prepare','save'].includes(body.action);
   if(receiptActions&&(typeof body.requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.requestId)))fail('A save request identity is required.');
   if(body.action==='save'){
    if(body.command!==undefined)fail('Save accepts a prepared receipt only.');
    return reply(await storage.save({actor:identity.actor,itemId:body.itemId,requestId:body.requestId,authorization:auth}));
   }
   if(body.action==='prepare'){
    const prior=await storage.receipt({actor:identity.actor,itemId:body.itemId,requestId:body.requestId,command:body.command});
    if(prior)return reply(prior);
   }
   const context={...await loadContext(body.itemId,auth),...identity};
   if(context.source?.id!==body.itemId)fail('Item not found.',404);
   if(body.action==='load')return reply({itemId:body.itemId,currentVersion:context.version,
    draft:context.savedDraft||null,source:context.source,sourceDigest:await legacyDigest({source:context.source,settings:context.settings})});
   if(body.command?.confirmId!==body.itemId)fail('Confirm the selected Item identity.');
   if(context.savedDraft){
    if(!Array.isArray(context.legacyDrafts))fail('Load existing Items work before editing.',503);
    if(legacyItemBlockers(body.itemId,context.source,context.legacyDrafts).length)fail('Existing Items work changed. Preserve it before editing.',409);
    if(context.savedDraft.sourceDigest!==await legacyDigest({source:context.source,settings:context.settings}))fail('Public facts or the patch changed. Review before editing.',409);
   }
   const payload=context.savedDraft?prepareAttachmentEdit(body.command,context):await prepareAttachmentDecision(body.command,context);
   return reply(await storage.prepare({actor:identity.actor,itemId:body.itemId,requestId:body.requestId,command:body.command,payload,legacyVersion:context.legacyVersion}));
  }catch(error){return reply({error:error.status?error.message:'Attachment storage is unavailable. Your saved draft is retained.'},error.status||503);}
 };
}
