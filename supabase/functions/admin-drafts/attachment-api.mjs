// Preparation-only adapter. Production routing/transport are deliberately unregistered.
import {prepareAttachmentDecision,prepareAttachmentEdit,prepareAttachmentAction} from './attachment-draft.mjs';
import {legacyDigest} from './legacy-item-review.mjs';
import {fail} from './core.mjs';
import {legacyItemBlockers} from './item-draft.mjs';
import {reconcileAttachment} from './attachment-publication.mjs';
export function createAttachmentApi({enabled=()=>false,publishEnabled=()=>false,authenticate,loadContext,storage,publication,list}={}){
 return async request=>{
  const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','Access-Control-Allow-Origin':'https://scavlandfanbase.github.io'}});
  try{
   if(!enabled())fail('Attachment editing is not enabled.',503);
   if(request.method!=='POST')fail('POST is required.',405);
   const auth=request.headers.get('Authorization');if(!auth?.startsWith('Bearer '))fail('Sign in to continue.',401);
   const identity=await authenticate(auth);
   if(!identity?.actor)fail('Sign in again.',401);
   if(!identity.permissions?.includes('items_edit'))fail('Items editing permission is required.',403);
   const raw=await request.text();if(new TextEncoder().encode(raw).length>50000)fail('Attachment request is too large.',413);
   let body;try{body=JSON.parse(raw);}catch{fail('Invalid request.');}
   if(!body||Array.isArray(body)||Object.keys(body).some(k=>!['domain','action','itemId','requestId','command','previewId','confirm','expectedVersion'].includes(k))||
    body.domain!==undefined&&body.domain!=='shared-attachment'||!['list','load','prepare','save','preview','publish'].includes(body.action)||body.action!=='list'&&(typeof body.itemId!=='string'||!body.itemId.trim()||body.itemId.length>160))fail('Invalid Attachment request.');
   if(body.action==='list'){
    if(Object.keys(body).some(k=>!['domain','action'].includes(k))||typeof list!=='function')fail('Attachment review list is unavailable.',503);
    return reply(await list(auth));
   }
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
    draft:context.savedDraft||null,source:context.source,images:context.images||[],weapons:(context.weapons||[]).filter(r=>!r.hidden&&!r.archived&&context.weapons.filter(w=>w.id===r.id).length===1).map(r=>({id:r.id,name:r.name||r.id})),patchId:context.settings?.current_patch_id||null,sourceDigest:await legacyDigest({source:context.source,settings:context.settings})});
   if(body.command?.confirmId!==body.itemId)fail('Confirm the selected Item identity.');
   if(context.savedDraft){
    if(!Array.isArray(context.legacyDrafts))fail('Load existing Items work before editing.',503);
    if(legacyItemBlockers(body.itemId,context.source,context.legacyDrafts).length)fail('Existing Items work changed. Preserve it before editing.',409);
    context.savedDraft=await reconcileAttachment(context.savedDraft,context.source,context.settings);
   }
   const payload=context.savedDraft?(body.command.action==='edit-attachment'?prepareAttachmentEdit(body.command,context):prepareAttachmentAction(body.command,context)):await prepareAttachmentDecision(body.command,context);
   return reply(await storage.prepare({actor:identity.actor,itemId:body.itemId,requestId:body.requestId,command:body.command,payload,legacyVersion:context.legacyVersion}));
  }catch(error){return reply({error:error.status?error.message:'Attachment storage is unavailable. Your saved draft is retained.'},error.status||503);}
 };
}
