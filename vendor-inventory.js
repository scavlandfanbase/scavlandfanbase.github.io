// Shared controls and dialogs; all persistence goes through the private vendor service.
window.ScavVendorInventory=function({state,vendor,session,change,catalogSource=null}){
 const E=ScavEditor,L=ScavVendorListings,$=id=>document.getElementById(id);
 const labels={item:'Item',weapon:'Weapon',ammo:'Ammo',armour:'Armour',attachment:'Attachment',blueprint:'Blueprint'};
 let catalog=null,loading=false,saving=false,lastPaint='';
 const section=$('inventory-workspace'),list=$('inventory-list'),status=$('inventory-status');
 const collection=()=>state()?.vendorListings||L.empty();
 const rows=()=>vendor()?L.forVendor(collection(),vendor().id,{includeArchived:$('inventory-archived').checked}):[];
 const entity=row=>catalog?.entities[row.entity.type]?.find(e=>e.id===row.entity.id);
 const text=(parent,tag,value)=>{const el=document.createElement(tag);el.textContent=value;parent.append(el);return el;};
 const name=row=>entity(row)?.name||row.entity.id;
 const unknown=value=>value===null?'Not recorded':String(value);
 function focusRow(id,action){
  setTimeout(()=>{const row=[...list.children].find(el=>el.dataset.listingId===id);([...row?.querySelectorAll('[data-action="'+action+'"]:not(:disabled)')||[]].find(el=>el.getClientRects().length)||row?.querySelector('button')||$('inventory-heading')).focus();},0);
 }
 async function save(operation,extra={}){
  if(saving)throw new Error('Wait for the current save.');
  saving=true;section.setAttribute('aria-busy','true');section.inert=true;
  E.status(status,'saving','Private inventory');
  try{await change(operation,extra);E.status(status,'saved',catalogSource?'Durable private inventory':'Private inventory on this computer');focusRow(extra.listingId,operation);}
  catch(error){E.status(status,'error',error.message);throw error;}
  finally{saving=false;section.removeAttribute('aria-busy');section.inert=false;paint();}
 }
 function edit(row){
  scavEditorDialog({title:'Edit '+name(row)+' · '+labels[row.entity.type],submit:'Save private listing',build:({body})=>{
   E.help(body,'Vendor Listings');
   for(const [key,label] of [['rank','Rank'],['price','Price (₽)'],['quantity','Stock / quantity']]){
    const input=E.field(body,label,key,row[key],30);input.type='number';input.min='0';input.max=String(Number.MAX_SAFE_INTEGER);input.step=key==='price'?'any':'1';
   }
   const noteState=E.selectField(body,'Note state','noteState',[['unknown','Not recorded'],['text','Written notes']],row.notes===null?'unknown':'text');
   const notes=E.field(body,'Vendor notes','notes',row.notes,4000,false,true);
   noteState.onchange=()=>{notes.disabled=noteState.value==='unknown';};noteState.onchange();
  },onSubmit:({form})=>{
   const values=Object.fromEntries(new FormData(form)),fields={};
   for(const key of ['rank','price','quantity'])fields[key]=values[key].trim()===''?null:Number(values[key]);
   fields.notes=values.noteState==='unknown'?null:values.notes;
   return save('edit',{listingId:row.id,fields});
  }});
 }
 function confirm(operation,row){
  E.confirm({title:operation==='remove'?'Remove listing permanently?':'Archive listing?',
   message:operation==='remove'?'Remove '+name(row)+' from this vendor and discard this listing’s history. The canonical record stays intact. Use Archive to retain a restorable listing.':'Archive '+name(row)+' for this vendor. Its values and history are retained, and the canonical record stays intact.',
   submit:operation==='remove'?'Remove listing':'Archive listing',onConfirm:()=>save(operation,{listingId:row.id,confirmId:row.id})});
 }
 function verification(row){
  scavEditorDialog({title:'Verification history · '+name(row),submit:'Close',readOnly:true,build:({body})=>{
   E.verificationInfo(body,ScavVerification.inspect(row,catalog.settings));
   text(body,'p','Item evidence is managed separately. Evidence is optional for verification.');
   if(!(row.verification.history||[]).length)text(body,'p','This vendor listing has not been verified yet.');
   for(const event of (row.verification.history||[]))text(body,'p',event.decision+' · '+event.at+' · '+(event.patch_id||'Patch unknown')+' · '+event.by);
  },onSubmit:()=>{}});
 }
 function reviewListing(row){
  const patchId=catalog.settings.current_patch_id;
  scavEditorDialog({title:'Review Vendor listing · '+name(row),submit:'Save private review',build:({body})=>{
   text(body,'p','Review this Vendor’s price, rank and stock only. This does not verify the Item or any other Vendor’s listing.');
   text(body,'p','Evidence is optional. Your identity, review time and current patch are recorded by the server. Saving does not publish.');
   text(body,'p','Price: '+unknown(row.price)+' · Rank: '+unknown(row.rank)+' · Stock: '+unknown(row.quantity));
   text(body,'p','Current patch: '+(patchId||'Not recorded'));
   E.verificationInfo(body,ScavVerification.inspect(row,catalog.settings));
   E.selectField(body,'Review decision','decision',[['unverified','Unverified — needs review'],...(patchId?[['verified','Verified — still correct for this patch']]:[])],'unverified');
  },onSubmit:({form})=>save('verify',{listingId:row.id,confirmId:row.id,decision:new FormData(form).get('decision'),patchId})});
 }
 function add(){
  let selected=null,limit=40;
  scavEditorDialog({title:'Add existing stock',submit:'Add private listing',build:({body,save:submit,setDirty})=>{
   E.help(body,'Vendor Listings');
   const query=E.field(body,'Search existing records','search','',200);query.dataset.editorTransient='true';
   const type=E.selectField(body,'Content Type','entityType',[['all','All types'],...L.types.map(t=>[t,labels[t]])],'all');type.dataset.editorTransient='true';
   const selection=text(body,'p','No record selected.'),count=text(body,'p','');count.setAttribute('role','status');
   const results=document.createElement('div');results.className='inventory-results';body.append(results);
   const more=E.button('','Show more records',()=>{limit+=40;show();},body);
   function show(){
    const entries=Object.entries(catalog.entities).filter(([t])=>type.value==='all'||type.value===t).flatMap(([t,records])=>records.filter(r=>!r.archived&&E.matches((r.name||'')+' '+r.id,query.value)).map(record=>({type:t,record})));
    count.textContent=entries.length?`${entries.length} records · showing ${Math.min(limit,entries.length)}`:type.value!=='all'&&!catalog.sources[type.value]?'No dedicated '+labels[type.value].toLowerCase()+' catalogue is available. No records have been inferred.':'No matching records.';
    results.replaceChildren();
    for(const {type:t,record} of entries.slice(0,limit)){
     const existing=collection().listings.find(r=>r.vendorId===vendor().id&&r.entity.type===t&&r.entity.id===record.id);
     const label=(record.name||'Unnamed entry')+' · '+ScavAttachments.describe(record,t).type;
     const button=E.button('',label+(existing?(existing.archived?' · Already archived — restore below':' · Already listed'):''),()=>{selected={type:t,id:record.id};selection.textContent='Selected: '+label;setDirty();show();[...results.children].find(b=>b.dataset.key===JSON.stringify(selected))?.focus();},results);
     button.disabled=!!existing;button.dataset.key=JSON.stringify({type:t,id:record.id});button.setAttribute('aria-pressed',String(selected?.type===t&&selected.id===record.id));
    }
    more.hidden=entries.length<=limit;submit.disabled=!selected;
   }
   E.search(query,()=>{limit=40;show();});type.onchange=()=>{limit=40;show();};show();
  },onSubmit:()=>{if(!selected)throw new Error('Select an existing record.');return save('add',{entity:selected});}});
 }
 const helpLabel=text($('inventory-tools'),'span','Inventory help');E.help(helpLabel,'Vendor inventory','Edit changes this Vendor’s price, rank and stock only. Not recorded means unknown. Verify records a private listing review; evidence is optional. History is under More actions. Save does not publish. Archive keeps a restorable listing; Remove deletes only the listing after confirmation. Move up/down changes its order.');
 const addButton=E.button('inventory-add','+ Add listing',add,$('inventory-tools'));
 const retry=E.button('inventory-retry','Reload catalogue',()=>load(),$('inventory-tools'));
 E.button('inventory-close','Close inventory',()=>{section.hidden=true;$('vendor-inventory').focus();},$('inventory-tools'));
 $('inventory-tools').querySelectorAll('button:not(.scav-help-trigger)').forEach(b=>b.dataset.helpAdded='true');
 $('inventory-archived').onchange=()=>paint();
 function paint(){
  if(section.hidden)return;
  if(!vendor()||vendor().archived){section.hidden=true;return;}
  $('inventory-heading').textContent=vendor().name+' — Inventory';
  const key=JSON.stringify([state().revision,vendor().id,$('inventory-archived').checked,!!catalog]);
  if(key===lastPaint)return;lastPaint=key;
  addButton.disabled=!catalog;retry.disabled=loading;retry.hidden=!!catalog;
  list.replaceChildren();if(!catalog)return;
  const entries=rows(),active=L.forVendor(collection(),vendor().id);
  if(!entries.length)text(list,'p','No new stock listings yet. Existing stock is retained below.');
  for(const row of entries){
   const article=document.createElement('article');article.className='inventory-card';article.dataset.listingId=row.id;article.dataset.entityType=row.entity.type;
   const identity=document.createElement('div');identity.className='inventory-identity';article.append(identity);
   const image=entity(row)?.image;if(typeof image==='string'&&/^(images|evidence-inbox)\//.test(image)){const icon=document.createElement('img');icon.src=image;icon.alt='';icon.loading='lazy';identity.append(icon);}
   const title=document.createElement('div');identity.append(title);text(title,'h3',name(row));text(title,'p',ScavAttachments.describe(entity(row)||{},row.entity.type).type+(row.archived?' · Archived':''));
   const facts=document.createElement('dl');facts.className='inventory-facts';article.append(facts);
   for(const [label,value] of [['Price',row.price===null?'Not recorded':row.price+'₽'],['Rank',unknown(row.rank)],['Stock',unknown(row.quantity)]]){const fact=document.createElement('div');text(fact,'dt',label);text(fact,'dd',value);facts.append(fact);}
   const inspection=ScavVerification.inspect(row,catalog.settings),badge=text(article,'strong',({'verified':'Verified','unverified':'Unverified','patch-check-needed':'Patch Check Needed'})[inspection.status]);badge.className='inventory-verification';badge.dataset.state=inspection.status;
   if(row.notes!==null)text(article,'p',row.notes).className='inventory-notes';
   const unavailable=!entity(row)||entity(row).archived;
   if(unavailable)text(article,'p','Original record unavailable. Editing and restoration are unavailable.');
   const actions=document.createElement('div');actions.className='inventory-actions';article.append(actions);
   function button(action,label,fn,disabled=false,aria,parent=actions){const b=E.button('',label,fn,parent,aria);b.dataset.action=action;b.dataset.helpAdded='true';b.disabled=disabled;return b;}
   if(row.archived)button('restore','Restore',()=>save('restore',{listingId:row.id}).catch(()=>{}),unavailable);
   else button('edit','Edit',()=>edit(row),unavailable);
   if(!row.archived)button('verify','Verify',()=>reviewListing(row),unavailable);
   button('status','Status',()=>scavEditorDialog({title:'Verification status · '+name(row),submit:'Close',readOnly:true,build:({body})=>{E.verificationInfo(body,inspection);text(body,'p','Viewing status does not verify this listing. Use Verify to record a private review. Item evidence is managed separately.');},onSubmit:()=>{}}));
   const menu=document.createElement('details');menu.className='inventory-more';const toggle=text(menu,'summary','•••');toggle.setAttribute('aria-label','More actions for '+name(row));actions.append(menu);
   const options=document.createElement('div');options.className='inventory-menu';menu.append(options);
   function option(action,label,fn,disabled=false){return button(action,label,()=>{menu.open=false;toggle.focus();fn();},disabled,undefined,options);}
   option('verification','Verification history',()=>verification(row));
   if(!row.archived){const index=active.findIndex(r=>r.id===row.id);option('up','Move up',()=>save('move',{listingId:row.id,direction:-1}).catch(()=>{}),index<=0);option('down','Move down',()=>save('move',{listingId:row.id,direction:1}).catch(()=>{}),index===active.length-1);option('archive','Archive',()=>confirm('archive',row));}
   option('remove','Remove',()=>confirm('remove',row));
   menu.addEventListener('keydown',e=>{if(e.key==='Escape'){menu.open=false;toggle.focus();e.preventDefault();}});
   list.append(article);
  }
  legacy();
 }
 function legacy(){
  let old=section.querySelector('#legacy-stock');if(old)old.remove();
  const panel=document.createElement('details');panel.id='legacy-stock';section.append(panel);
  const rows=ScavLegacyReview.review(vendor(),catalog.entities.item||[],collection().listings);
  const linked=rows.filter(r=>r.status==='already-linked').length,pending=rows.length-linked;
  text(panel,'summary','Legacy migration: '+linked+'/'+rows.length+' linked'+(pending?' · '+pending+' need review':' ✓')+' — View details');panel.open=pending>0;
  text(panel,'p','Original stock information is retained for reference. '+pending+' entries still need review.');
  for(const row of rows){const card=document.createElement('details');const summary=document.createElement('summary');summary.textContent=(row.entry.name||'Unnamed stock')+' · '+({'exact-proposal':'Exact match proposed',review:'Needs human review',unmatched:'No match','already-linked':'Already linked'}[row.status]);card.append(summary);
   text(card,'p',row.reason);text(card,'p','Rank '+unknown(row.entry.rank??null)+' · Price '+unknown(row.entry.price??null)+' · Stock '+unknown(row.entry.quantity??null));
   if(row.entry.details)text(card,'p',row.entry.details);
   for(const candidate of row.candidates)text(card,'p','Candidate: '+candidate.name);
   const tech=document.createElement('details');text(tech,'summary','Technical source and proposed references');text(tech,'pre',JSON.stringify({source:row.entry,candidates:row.candidates},null,2));card.append(tech);panel.append(card);
  }
 }
 async function load(){
  if(loading)return;loading=true;retry.disabled=true;status.textContent='Loading canonical records…';
  try{
   let value;
   if(catalogSource)value=await catalogSource();
   else{const response=await fetch('/api/vendor-catalog',{headers:{'X-Scav-Session':session()}});value=await response.json();if(!response.ok)throw new Error(value.error||'Catalogue unavailable.');}
   L.registry({vendors:[],entities:value.entities});ScavVerification.patchId(value.settings);catalog=value;
   status.textContent='Ready — listings save privately after each action.';
  }catch(error){catalog=null;status.textContent='Could not load catalogue. '+error.message;}
  finally{loading=false;lastPaint='';paint();}
 }
 function open(){section.hidden=false;paint();$('inventory-heading').focus();if(!catalog||catalogSource)load();}
 return {open,paint};
};
