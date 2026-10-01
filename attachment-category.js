// Memory-only session; preparation screen remains outside live Hub routing.
(()=>{
 const $=id=>document.getElementById(id),endpoint='https://demtoqsafufzmnhvaykj.supabase.co/functions/v1/admin-drafts';
 let token='',records=[],selected=null,loaded=null,busy=false,dirty=false,pending=null,preview=null;
 const controls=['type','item-name','description','notes','price','stack','image'];
 for(const type of ScavAttachments.types){const option=document.createElement('option');option.value=type;option.textContent=type;$('type').append(option);}
 const status=text=>$('status').textContent=text;
 function update(){
  const archived=!!loaded?.draft?.record.archived;
  const editable=!!token&&!!loaded?.draft&&!archived&&!busy&&!pending;
  controls.forEach(id=>$(id).disabled=!editable);
  $('type').disabled=!token||!loaded||archived||busy||!!pending;
  $('save').disabled=!editable;$('classify').disabled=!loaded||!!loaded.draft||busy||!!pending;
  $('preview').disabled=!loaded?.currentVersion||busy||dirty||!!pending;
  $('publish').disabled=!preview||busy||dirty||!!pending;
  $('retry').hidden=!pending;$('retry').disabled=busy;$('search').disabled=busy||!!pending;
  $('reload').disabled=!selected||busy||!token;
  $('review').disabled=!editable||dirty;
  $('lifecycle').disabled=!token||!loaded?.draft||busy||dirty||!!pending;
  $('lifecycle').textContent=archived?'Restore privately':'Archive privately';
  document.querySelectorAll('#records button').forEach(b=>b.disabled=busy||!!pending);
 }
 async function request(extra){
  const response=await fetch(endpoint,{method:'POST',headers:{apikey:'sb_publishable_0kdLCpTy7Sf8BKkIU5TOqw_Qaay4gzH',Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({domain:'shared-attachment',...(selected&&extra.action!=='list'?{itemId:selected}:{}),...extra})});
  const result=await response.json();if(!response.ok)throw Object.assign(Error(result.error||'Action failed. Saved work is retained.'),{status:response.status});return result;
 }
 function paintList(){
  $('records').replaceChildren();for(const record of records.filter(r=>r.name.toLowerCase().includes($('search').value.toLowerCase()))){
   const button=document.createElement('button');button.textContent=record.name+(record.candidate?' · Candidate for review':'');button.onclick=()=>select(record.id);$('records').append(button);
  }update();
 }
 async function select(id){
  if(busy||pending||dirty&&!confirm('Discard unsaved form entries?'))return;
  busy=true;selected=id;loaded=null;preview=null;update();
  try{loaded=await request({action:'load'});dirty=false;const r=loaded.draft?.record||loaded.source;
   $('name').textContent=r.name;$('type').value=r.attachmentType||'Unknown';
   $('image').replaceChildren();for(const image of [...new Set(['',...(loaded.images||[]),...(r.image?[r.image]:[])])]){const option=document.createElement('option');option.value=image;option.textContent=image||'No image recorded';$('image').append(option);}$('image').value=r.image||'';
   for(const [id,key]of [['item-name','name'],['description','description'],['notes','notes'],['price','estimatedPrice'],['stack','maxStack']])$(id).value=r[key]??'';
   $('state').textContent=loaded.draft?'Saved private Attachment draft':'Candidate: choose a type and explicitly confirm classification. Evidence alone does not establish membership.';status('Loaded.');
  }catch(error){status(error.message);}finally{busy=false;update();}
 }
 async function save(){
  if(busy||!pending)return;busy=true;update();
  try{if(!pending.receipt)pending.receipt=await request({action:'prepare',requestId:pending.id,command:pending.command});
   await request({action:'save',requestId:pending.id});pending=null;dirty=false;busy=false;await select(selected);status('Saved privately. Nothing published.');
  }catch(error){if(error.status===400||error.status===409&&!pending?.receipt)pending=null;status(error.message+' Your entries are retained. Retry the saved action if available.');}finally{busy=false;update();}
 }
 $('classify').onclick=()=>{
  if(!loaded||busy||pending)return;
  if(!confirm('Classify '+loaded.source.name+' as an Attachment? Keep its identity and history, mark it Unverified and save privately.'))return;
  pending={id:crypto.randomUUID(),command:{action:'classify-attachment',confirmId:selected,attachmentType:$('type').value,confirmReclassification:true,expectedVersion:loaded.currentVersion,sourceDigest:loaded.sourceDigest}};save();
 };
 function prepareAction(command){pending={id:crypto.randomUUID(),command:{confirmId:selected,expectedVersion:loaded.currentVersion,...command}};if(($('image').value||null)!==(loaded.draft.record.image??null))pending.command.fields.image=$('image').value||null;preview=null;save();}
 $('review').onclick=()=>{if(!loaded?.draft||busy||dirty||pending)return;if(confirm('Record this review against the current patch? Verified requires checking the actual item.'))prepareAction({action:'review-attachment',decision:$('review-decision').value,patchId:loaded.patchId});};
 $('lifecycle').onclick=()=>{if(!loaded?.draft||busy||dirty||pending)return;const archive=!loaded.draft.record.archived;if(confirm((archive?'Archive':'Restore')+' this item privately? Its identity, history and vendor references are retained.'))prepareAction({action:archive?'archive-attachment':'restore-attachment'});};
 $('form').onsubmit=event=>{event.preventDefault();if(!loaded?.draft||busy||pending)return;
  pending={id:crypto.randomUUID(),command:{action:'edit-attachment',confirmId:selected,expectedVersion:loaded.currentVersion,fields:{name:$('item-name').value,description:$('description').value||null,notes:$('notes').value||null,estimatedPrice:$('price').value===''?null:Number($('price').value),maxStack:$('stack').value===''?null:Number($('stack').value),attachmentType:$('type').value}}};if(($('image').value||null)!==(loaded.draft.record.image??null))pending.command.fields.image=$('image').value||null;preview=null;save();
 };
 $('retry').onclick=save;$('search').oninput=paintList;
 $('reload').onclick=()=>{
  if(busy||!selected)return;
  if((dirty||pending)&&!confirm('Review the server-saved draft? Unsaved form entries and this local retry action will be cleared. Existing server-saved versions remain intact.'))return;
  pending=null;dirty=false;preview=null;select(selected);
 };
 controls.forEach(id=>$(id).oninput=()=>{dirty=true;preview=null;update();});
 $('preview').onclick=async()=>{busy=true;update();try{preview=await request({action:'preview',expectedVersion:loaded.currentVersion});$('output').textContent=preview.files.map(f=>f.content).join('\n');$('preview-dialog').showModal();status('Saved preview ready.');}catch(error){preview=null;status(error.message);}finally{busy=false;update();}};
 $('close-preview').onclick=()=>$('preview-dialog').close();
 $('publish').onclick=async()=>{if(!preview||!confirm('Publish this reviewed Attachment item? Vendor prices and stock stay unchanged.'))return;busy=true;update();try{const result=await request({action:'publish',expectedVersion:loaded.currentVersion,previewId:preview.previewId,confirm:true});preview=null;status('Published commit '+result.commit+'.');}catch(error){preview=null;status(error.message+' Inspect public state before retrying.');}finally{busy=false;update();}};
 window.addEventListener('beforeunload',event=>{if(dirty||pending){event.preventDefault();event.returnValue='';}});
 window.addEventListener('message',async event=>{
  if(parent===window||event.source!==parent||event.origin!==location.origin||event.data?.type!=='scavland-admin-token'||typeof event.data.token!=='string')return;
  token=event.data.token;if(!token){loaded=null;preview=null;status('Sign in again.');update();return;}
  busy=true;update();try{const result=await request({action:'list'});records=result.records;$('workspace').hidden=false;paintList();status(records.length+' records available for review.');}catch(error){status(error.message);}finally{busy=false;update();}
 });
 if(parent!==window)parent.postMessage({type:'scavland-admin-ready'},location.origin);update();
})();
