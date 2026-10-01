const assert=require('node:assert/strict');
(async()=>{
 const {prepareAttachmentCreation:create}=await import('../supabase/functions/admin-drafts/attachment-create.mjs');
 const id='attachment-12345678-1234-4123-8123-123456789abc',documents=Object.fromEntries(['items','weapons','armour','ammo'].map(k=>['data/'+k+'.json',{data:k==='weapons'?[{id:'weapon-a'}]:[]}]))
 const context={actor:'fixture-admin',permissions:['items_edit'],newItemId:id,documents,privateItemIds:[],legacyDrafts:[],settings:{schemaVersion:1,current_patch_id:'fixture'},images:['images/approved.png'],clock:()=>new Date('2026-10-01T10:00:00Z')};
 const command={action:'create-attachment',confirmCreation:true,fields:{name:'Recorded fixture',attachmentType:'Scope',compatibleWeaponIds:['weapon-a']}};
 const snapshot=JSON.stringify(context),result=await create(command,context);
 assert.equal(result.record.id,id);assert.equal(result.before,null);assert.equal(result.expectedVersion,0);assert.equal(result.creation,true);assert.equal(result.record.verification.decision,'unverified');assert.equal(result.record.verification.history.at(-1).by,context.actor);assert.equal(result.record.estimatedPrice,null);assert.equal(result.record.maxStack,null);assert(!Object.hasOwn(result.record,'effects'));assert.equal(JSON.stringify(context),snapshot);
 await assert.rejects(create({...command,id:'forged'},context),/confirmation/);
 await assert.rejects(create(command,{...context,permissions:[]}),e=>e.status===403);
 await assert.rejects(create(command,{...context,newItemId:'browser-chosen'}),e=>e.status===503);
 await assert.rejects(create(command,{...context,privateItemIds:[id]}),e=>e.status===409);
 await assert.rejects(create(command,{...context,documents:{...documents,'data/ammo.json':{data:[{id}]}}}),e=>e.status===409);
 await assert.rejects(create(command,{...context,documents:{}}),e=>e.status===503);
 await assert.rejects(create(command,{...context,legacyDrafts:[{payload:{catalogue:{data:[{id}]}}}]}),e=>e.status===409);
 await assert.rejects(create({...command,fields:{name:'Fixture',effects:{invented:99}}},context),/Unsupported/);
 await assert.rejects(create({...command,fields:{name:'Fixture',compatibleWeaponIds:['invented']}},context),e=>e.status===409);
 console.log('PASS new Attachment contract: server identity, complete collision inspection, explicit facts, Unknown defaults, Unverified history and forged/protected fields refused. Not connected to live API.');
})().catch(e=>{console.error(e);process.exitCode=1});
