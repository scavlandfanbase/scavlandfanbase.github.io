// Explicit private classification only. Evidence paths are a review aid, never membership.
(function(root){
 const types=Object.freeze(['Sight','Scope','Muzzle','Suppressor','Magazine','Stock','Handguard','Foregrip','Pistol Grip','Dust Cover','Mount','Rail','Laser','Flashlight','Other','Unknown']);
 const contentTypes=Object.freeze(['Item','Weapon','Armour','Ammo','Attachment','Blueprint']);
 const contentType=r=>r.contentType??'Item';
 function validate(r){
  if(!contentTypes.includes(contentType(r)))throw new Error('Choose a recognised Content Type.');
  if(r.attachmentType!==undefined&&!types.includes(r.attachmentType))throw new Error('Choose a supported Attachment Type.');
  if(contentType(r)==='Attachment'&&!types.includes(r.attachmentType))throw new Error('Choose an Attachment Type, including Unknown.');
 }
 function candidate(r){
  function evidence(v){return typeof v==='string'?v.startsWith('evidence-inbox/attachments/'):v&&typeof v==='object'?Object.values(v).some(evidence):false;}
  return evidence(r.source)||evidence(r.evidence)||evidence(r.image)||evidence(r.file);
 }
 function catalogue(state){state.data.forEach(validate);return {...structuredClone(state),data:structuredClone(state.data.filter(r=>contentType(r)==='Attachment'))};}
 // Read only: explicit source classifications are displayed, never written back.
 const sourceTypes=Object.freeze({item:'Item',weapon:'Weapon',armour:'Armour',ammunition:'Ammo',ammo:'Ammo',attachment:'Attachment',blueprint:'Blueprint'});
 function describe(record,namespace='item'){
  const recorded=contentType(record),source=[...new Set((Array.isArray(record.classification)?record.classification:[]).map(v=>sourceTypes[v]).filter(Boolean))];
  const dedicated=sourceTypes[namespace];
  const type=namespace!=='item'&&dedicated?dedicated:source.length===1?source[0]:recorded;
  const conflict=source.length>1||source.some(v=>v!==recorded);
  return {type,recorded,source,conflict,message:conflict?'Stored Content Type: '+recorded+'; existing classification: '+source.join(', ')+'. Review before reclassifying. No information has been moved.':''};
 }
 const api=Object.freeze({types,contentTypes,contentType,describe,validate,candidate,catalogue});
 if(typeof module==='object'&&module.exports)module.exports=api;else root.ScavAttachments=api;
})(globalThis);
