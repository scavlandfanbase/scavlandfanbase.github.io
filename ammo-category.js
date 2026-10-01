// One selected identity, one private draft. No tokens/drafts in browser storage.
(()=>{
 const $=id=>document.getElementById(id),E=ScavEditor;
 const endpoint='https://demtoqsafufzmnhvaykj.supabase.co/functions/v1/admin-drafts',key='sb_publishable_0kdLCpTy7Sf8BKkIU5TOqw_Qaay4gzH';
 let token='',records=[],selected=null,loaded=null,pending=null,busy=false,dirty=false,previewId=null,controls=[];
 const category=document.documentElement.dataset.category||'ammo',categoryName=category==='armour'?'Armour':category==='weapons'?'Weapons':'Ammo';
 const schema=[['name','Name','text','shared'],['description','Description','textarea','shared'],['image','Image reference','image','shared'],['notes','Notes','textarea','shared'],['estimatedPrice','General estimated price','number','shared'],['maxStack','Maximum stack','number','shared'],...(category==='weapons'?[['category','Weapon type','text','specialist'],['tier','Tier','text','specialist'],['ammo','Ammunition type','text','specialist'],...['damage','rpm','range','accuracy','recoil','handling','ergonomics','reload'].map(k=>[k,k==='rpm'?'Rate of fire (RPM)':k[0].toUpperCase()+k.slice(1),'number','specialist'])]:category==='armour'?[['category','Armour type','text','specialist'],['repairClass','Repair class','text','specialist'],['ballistic','Ballistic','number','specialist'],['slash','Slash','number','specialist'],['radiation','Radiation','number','specialist'],['durability','Durability','number','specialist']]:[['category','Ammo type','text','specialist'],['damage','Damage','text','specialist'],['penetrationPercent','Penetration (%)','number','specialist']])];
 const label=k=>schema.find(r=>r[0]===k)?.[1]||k;
 const text=v=>v===null||v===undefined?'Not recorded':String(v);
 function status(s){$('status').textContent=s;}
 function buttons(){
  const archived=!!loaded?.state.records.items.archived;
  $('save').disabled=busy||!!pending||!loaded||archived;
  $('lifecycle').textContent=archived?'Restore item':'Archive item';
  $('lifecycle').disabled=busy||dirty||!!pending||!loaded;
  $('facet-add').hidden=!!loaded?.state.records[category];
  $('facet-add').disabled=busy||dirty||!!pending||!loaded||archived;
  $('add').disabled=busy||dirty||!!pending||!token;
  $('legacy-review').disabled=busy||dirty||!!pending||!selected;
  $('review').disabled=busy||dirty||!!pending||!loaded?.state.records[category]||archived;
  $('preview').disabled=busy||dirty||!!pending||!loaded||loaded.currentVersion===0||!loaded.hasChanges;
  $('publish').disabled=busy||dirty||!!pending||!previewId||!loaded?.canPublish;
  $('retry').hidden=!pending;$('retry').disabled=busy;
  $('search').disabled=busy||!!pending;
  document.querySelectorAll('#ammo-list button').forEach(b=>b.disabled=busy||!!pending);
  document.querySelectorAll('#fields input,#fields textarea,#fields button').forEach(b=>b.disabled=busy||!!pending||archived);
  if(!loaded?.state.records[category])for(const c of controls)if(c.group==='specialist')c.field.disabled=true;
 }
 async function request(extra){
  const response=await fetch(endpoint,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({domain:'shared-item',category,...(selected?{itemId:selected}:{}),...extra})});
  const result=await response.json();if(!response.ok)throw Object.assign(Error(result.error||'Could not complete this item action.'),{status:response.status});return result;
 }
 function list(){
  const q=$('search').value.toLowerCase(),matches=records.filter(r=>r.name.toLowerCase().includes(q));
  $('count').textContent=matches.length+' '+categoryName;$('ammo-list').replaceChildren();
  for(const r of matches){const b=E.button('',r.name+(r.archived?' · Archived':r.unpublished?' · Private new item':''),()=>select(r.id),$('ammo-list'));b.className='ammo-choice';b.setAttribute('aria-pressed',String(r.id===selected));}
  buttons();
 }
 function paint(){
  const state=loaded.state,item=state.records.items,facet=state.records[category]||{};
  const entry=records.find(r=>r.id===selected);if(entry)entry.name=item.name;
  $('selected-name').textContent=item.name+(item.archived?' · Archived':'');controls=[];$('fields').replaceChildren();$('blocked').hidden=true;$('item-form').hidden=false;
  if(entry)entry.archived=!!item.archived;
  const disagreements=[];
  for(const [key,title,type,group]of schema){
   const owner=group==='shared'?item:facet;
   const value=Object.hasOwn(owner,key)?owner[key]:group==='shared'?facet[key]:undefined;
   const field=E.field($('fields'),title,'field-'+key,value??'',key==='name'?300:10000,key==='name',type==='textarea');
   if(type==='number'){field.type='number';field.step=key==='maxStack'?'1':'any';if(key!=='penetrationPercent')field.min='0';}
   if(type==='textarea')field.parentElement.classList.add('wide');
   if(type==='image'){
    field.readOnly=true;E.button('image-picker','Choose image',()=>E.imagePicker({inventory:loaded.images,current:value??null,title:'Shared item image',onSubmit:image=>{field.value=image??'';dirty=true;previewId=null;buttons();}}),field.parentElement);
   }
   controls.push({key,type,group,field,before:field.value});
   if(group==='shared'&&Object.hasOwn(item,key)&&Object.hasOwn(facet,key)&&JSON.stringify(item[key])!==JSON.stringify(facet[key]))disagreements.push(title+': shared '+text(item[key])+'; '+categoryName+' '+text(facet[key]));
  }
  $('conflicts').hidden=!disagreements.length;$('conflicts').textContent='Existing values need review. Only a field you deliberately change will be reconciled.\n'+disagreements.join('\n');
  $('verification').replaceChildren();if(facet.id)E.verificationInfo($('verification'),ScavVerification.inspect(facet,loaded.settings));
  $('usage').replaceChildren();
  for(const u of loaded.usage||[]){const li=document.createElement('li');li.textContent=u.name+' · Price '+text(u.price)+' · Rank '+text(u.rank)+' · Quantity '+text(u.quantity);$('usage').append(li);}
  if(!loaded.usage?.length){const li=document.createElement('li');li.textContent='No linked vendor stock.';$('usage').append(li);}
  dirty=false;list();
 }
 async function select(id){
  if(busy||pending)return;if(dirty&&!confirm('Discard the unsaved form changes?'))return;
  busy=true;loaded=null;previewId=null;selected=id;dirty=false;$('item-form').hidden=true;$('blocked').hidden=true;$('conflicts').hidden=true;$('usage').replaceChildren();status('Loading selected '+categoryName+'…');buttons();
  try{loaded=await request({action:'load'});paint();status(loaded.currentVersion?'Saved private item draft. Preview before publishing.':'Ready. Changes save privately.');}
  catch(e){$('selected-name').textContent=records.find(r=>r.id===id)?.name||categoryName;$('blocked').hidden=false;$('blocked').textContent=e.message;status('This item is read-only until the reported issue is resolved. Existing saved work is retained.');}
  finally{busy=false;list();}
 }
 async function save(){
  if(busy||(!loaded&&!pending))return;busy=true;previewId=null;buttons();
  try{
   if(!pending){
    const shared={},specialist={};
    for(const c of controls)if(c.field.value!==c.before){const v=c.field.value===''?null:c.type==='number'?Number(c.field.value):c.field.value;(c.group==='shared'?shared:specialist)[c.key]=v;}
    if(!Object.keys(shared).length&&!Object.keys(specialist).length){dirty=false;status('No changes to save.');return;}
    pending={requestId:crypto.randomUUID(),version:loaded.currentVersion,command:{action:'edit',expectedRevision:loaded.state.revision,shared,specialist}};
   }
   status('Saving private item draft…');
   if(!pending.receipt)pending.receipt=await request({action:pending.creation?'create':'prepare',...(pending.creation?{itemId:undefined}:{}),expectedVersion:pending.version,requestId:pending.requestId,command:pending.command});
   const target=pending.creation?pending.receipt.item_id:selected;
   await request({action:'save',itemId:target,expectedVersion:pending.version,requestId:pending.requestId,...(pending.command.action==='import-legacy'?{command:pending.command}:{})});
   loaded=await request({action:'load',itemId:target});selected=target;pending=null;
   let record=records.find(r=>r.id===selected);if(!record){record={id:selected,unpublished:true};records.push(record);}record.name=loaded.state.records.items.name;
   paint();status('Saved — private item draft. Nothing has been published.');return true;
  }catch(e){if((e.status===400||e.status===409&&!pending?.creation)&&!pending?.receipt)pending=null;status(e.message+' Your form entries are retained. Retry or review the conflict.');}
  finally{busy=false;buttons();}
 }
 $('item-form').onsubmit=e=>{e.preventDefault();save();};$('item-form').oninput=()=>{dirty=true;previewId=null;buttons();};$('retry').onclick=save;$('search').oninput=list;
 $('add').onclick=()=>{
  let name;
  scavEditorDialog({title:'Add '+categoryName,submit:'Create private item',build:({body})=>{
   const note=document.createElement('p');note.textContent='Create one shared '+categoryName+' identity. You can enter its stats next. It starts unverified and is not published or added to vendor stock.';body.append(note);
   name=E.field(body,'Name','new-ammo-name','',300,true);
  },onSubmit:async()=>{
   if(busy||dirty||pending&&!pending.creation)throw Error('Finish the current save before adding '+categoryName+'.');
   if(pending&&pending.command.shared.name!==name.value)throw Error('Retry the original name first. You can edit it after the item is saved.');
   pending??={creation:true,requestId:crypto.randomUUID(),version:0,command:{action:'create',shared:{name:name.value},specialist:{}}};
   if(!await save())throw Error('Creation could not finish. Close this dialog and use Retry if a request is pending.');
  }});
 };
 $('legacy-review').onclick=async()=>{
  busy=true;buttons();
  try{const report=await request({action:'legacy-review'});
   const preserveReview=report.historyRecoverable;let historyChoice;
   const importable=(['ready-for-reviewed-import','no-pending-public-fields'].includes(report.status)||preserveReview)&&report.sourceVersion;
   scavEditorDialog({title:'Existing Items work — '+report.name,submit:importable?(preserveReview?'Preserve history and import':'Import privately'):'Close',readOnly:!importable,build:({body})=>{
    const summary=document.createElement('p');summary.textContent='Read-only review: '+report.status+(report.sourceVersion?' · Items draft version '+report.sourceVersion:'')+'. Existing work stays saved. Import privately saves supported work into this editor; publication requires a separate preview and Publish.';body.append(summary);
    if(preserveReview){const note=document.createElement('p');note.textContent='Keep the old verification and its history in the private preserved record. Mark this category Unverified for a fresh review. This does not publish, erase history or declare it verified.';body.append(note);historyChoice=E.selectField(body,'Historical review decision','historical-review-decision',[['','Choose a decision'],['unverified','Keep history and mark Unverified']],'');}
    for(const field of report.fields){const heading=document.createElement('h3');heading.textContent=label(field.field)+' · '+field.status;body.append(heading);
     for(const [key,title]of [['baseline','Original public value'],['private','Saved private value'],['public','Current public value']]){const line=document.createElement('p');line.textContent=title+': '+(field[key].present?JSON.stringify(field[key].value):'Not present');body.append(line);}
    }
    if(report.preserved){const note=document.createElement('p');note.textContent='The complete selected private record, including its notes and review history, remains preserved in the existing draft. An explicit version-bound import is still required.';body.append(note);}
   },onSubmit:async()=>{
    if(!importable)return;
    if(preserveReview&&historyChoice.value!=='unverified')throw Error('Choose Keep history and mark Unverified before importing.');
    pending??={requestId:crypto.randomUUID(),version:report.currentVersion,command:{action:'import-legacy',expectedRevision:report.revision,confirmId:selected,sourceVersion:report.sourceVersion,sourceDigest:report.sourceDigest,publicDigest:report.publicDigest,...(preserveReview?{preserveVerification:true}:{})}};
    if(!await save())throw Error('Import could not finish. Review the status message before retrying.');
   }});
  }catch(e){status(e.message);}finally{busy=false;buttons();}
 };
 $('review').onclick=()=>{
  let decision;
  scavEditorDialog({title:'Review '+loaded.state.records.items.name+' verification',submit:'Record review',build:({body})=>{
   const note=document.createElement('p');note.textContent='Review the saved '+categoryName+' details against patch '+(loaded.settings.current_patch_id||'not configured')+'. Choose Verified after checking them, or Unverified when they need another review. History is retained. This saves privately; it does not publish or verify other categories.';body.append(note);
   decision=E.selectField(body,'Review decision','review-decision',[['unverified','Unverified'],['verified','Verified']],'unverified');
  },onSubmit:async()=>{
   if(busy||dirty||pending&&pending.command.action!=='review')throw Error('Save or reload the item before reviewing.');
   if(pending&&pending.command.decision!==decision.value)throw Error('Retry the original decision before changing it.');
   pending??={requestId:crypto.randomUUID(),version:loaded.currentVersion,command:{action:'review',expectedRevision:loaded.state.revision,confirmId:selected,patchId:loaded.settings.current_patch_id,decision:decision.value}};
   if(!await save())throw Error('Review could not be saved. Close this dialog and review the status message; any prepared request is retained for Retry.');
  }});
 };
 $('lifecycle').onclick=()=>{
  const action=loaded.state.records.items.archived?'restore':'archive';
  E.confirm({title:(action==='archive'?'Archive ':'Restore ')+loaded.state.records.items.name+'?',submit:action==='archive'?'Archive privately':'Restore privately',message:'This saves a private visibility change for the shared item. Preview and publish to update public category and vendor pages. The identity, stats, review history and vendor stock references are retained.',onConfirm:async()=>{
   pending??={requestId:crypto.randomUUID(),version:loaded.currentVersion,command:{action,expectedRevision:loaded.state.revision,confirmId:selected}};
   if(!await save())throw Error('Visibility change could not finish. Review the status message and retry any pending request.');
  }});
 };
 $('facet-add').onclick=()=>E.confirm({title:'Add '+categoryName+' details?',submit:'Add details privately',message:'Keep this existing '+categoryName+' identity and create its missing category details with unknown stats. This does not reclassify, publish or stock the item.',onConfirm:async()=>{
  pending??={requestId:crypto.randomUUID(),version:loaded.currentVersion,command:{action:'add-facet',expectedRevision:loaded.state.revision,confirmId:selected,specialist:{}}};
  if(!await save())throw Error('Details could not finish. Review the status message and retry any pending request.');
 }});
 $('preview').onclick=async()=>{
  busy=true;previewId=null;buttons();
  try{const result=await request({action:'preview',expectedVersion:loaded.currentVersion});
   scavEditorDialog({title:'Preview '+loaded.state.records.items.name,submit:'Close',readOnly:true,build:({body})=>{
    const note=document.createElement('p');note.textContent='This publishes only the selected item’s saved changes. Linked vendor prices and stock stay unchanged. Public visibility: '+(loaded.state.records.items.archived?'Archived — omitted from public category and stocking vendor pages.':'Active — hidden items remain hidden.');body.append(note);
    for(const file of result.preview.files){const r=JSON.parse(file.content).data.find(r=>r.id===selected);const heading=document.createElement('h3');heading.textContent=file.path.endsWith('/items.json')?'Shared item details':categoryName+' details';body.append(heading);const dl=document.createElement('dl');body.append(dl);for(const [key,title]of schema)if(Object.hasOwn(r,key)){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=title;dd.textContent=text(r[key]);dl.append(dt,dd);}E.verificationInfo(body,ScavVerification.inspect(r,loaded.settings));}
   },onSubmit:()=>{previewId=result.previewId;status('Preview reviewed. You can publish this saved item.');buttons();}});
  }catch(e){status(e.message);}finally{busy=false;buttons();}
 };
 $('publish').onclick=()=>E.confirm({title:'Publish '+loaded.state.records.items.name+'?',message:'Publish this item’s reviewed shared details and '+categoryName+' stats? Its stocking vendors will use the updated item information. Their prices, ranks and quantities stay unchanged.',submit:'Publish this item',onConfirm:async()=>{
  busy=true;buttons();try{const r=await request({action:'publish',expectedVersion:loaded.currentVersion,previewId,confirm:true});previewId=null;loaded.hasChanges=false;const entry=records.find(e=>e.id===selected);if(entry)entry.unpublished=false;list();status('Published item version '+r.publishedVersion+'. The public pages may take a moment to update.');}
  catch(e){previewId=null;status(e.message);throw e;}finally{busy=false;buttons();}
 }});
 let started=false;
 window.addEventListener('message',async e=>{
  if(parent===window||e.source!==parent||e.origin!==location.origin||e.data?.type!=='scavland-admin-token'||typeof e.data.token!=='string')return;
  token=e.data.token;if(started)return;started=true;
  try{const result=await request({action:'list'});records=result.records;$('workspace').hidden=false;list();if(records.length)await select(records[0].id);else status('No '+categoryName+' records.');}catch(error){started=false;status(error.message);}
 });
 if(parent!==window)parent.postMessage({type:'scavland-admin-ready'},location.origin);
 window.addEventListener('beforeunload',e=>{if(dirty||pending||busy){e.preventDefault();e.returnValue='';}});
})();
