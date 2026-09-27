// Explicit private classification only. Evidence paths are a review aid, never membership.
(function(root){
 const types=Object.freeze(['Sight','Scope','Muzzle','Suppressor','Magazine','Stock','Handguard','Foregrip','Pistol Grip','Dust Cover','Mount','Rail','Laser','Flashlight','Other','Unknown']);
 const contentType=r=>r.contentType??'Item';
 function validate(r){
  if(!['Item','Attachment'].includes(contentType(r)))throw new Error('Choose Item or Attachment.');
  if(r.attachmentType!==undefined&&!types.includes(r.attachmentType))throw new Error('Choose a supported Attachment Type.');
  if(contentType(r)==='Attachment'&&!types.includes(r.attachmentType))throw new Error('Choose an Attachment Type, including Unknown.');
 }
 function candidate(r){
  function evidence(v){return typeof v==='string'?v.startsWith('evidence-inbox/attachments/'):v&&typeof v==='object'?Object.values(v).some(evidence):false;}
  return evidence(r.source)||evidence(r.evidence)||evidence(r.image)||evidence(r.file);
 }
 function catalogue(state){state.data.forEach(validate);return {...structuredClone(state),data:structuredClone(state.data.filter(r=>contentType(r)==='Attachment'))};}
 const api=Object.freeze({types,contentType,validate,candidate,catalogue});
 if(typeof module==='object'&&module.exports)module.exports=api;else root.ScavAttachments=api;
})(globalThis);
