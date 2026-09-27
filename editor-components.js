// Shared presentation only. Callers own authorization, data loading and persistence.
window.ScavEditor = (() => {
  let helpSequence=0;
  const helpText={
    'Content Type':'The kind of content: Item, Weapon, Armour, Ammo, Attachment or Blueprint. Choose only when you know. This does not move records between catalogues or copy their information.',
    'Content filter':'Filter by explicitly recorded Content Type. Older records without a Content Type stay in their existing Item collection; names and categories are never used to guess a type.',
    'Category':'A group within the selected Content Type. Existing categories are kept exactly as recorded. Not recorded means the category is unknown.',
    'Item category':'Choose an Item group. A recorded older category remains available for this item; changing it is your explicit decision.',
    'Attachment Type':'The recorded kind of Attachment. Choose Unknown when it is not recorded. This does not establish weapon compatibility.',
    'Value type':'Choose how a fact is recorded: Text, Number, Yes / No, a group of properties or a list. Not recorded means unknown. Changing the value type replaces that value; cancel to keep the original.',
    'Not recorded':'Unknown or not recorded is different from the number 0, the answer No, or intentionally empty text. Never replace unknown information with a guess.',
    'Value':'Not recorded means unknown. 0 is a known zero; No is a known negative answer. Empty Text is an intentionally blank value. An empty Number is not recorded.',
    'Properties':'Extra recorded facts. Keep their names and value types unless you have a reason to change them. Empty text, 0, No and Not recorded are different values.',
    'Property name':'The name of a recorded fact, such as weight. Names must be unique within the same group. Keep existing names unless correcting them deliberately.',
    'Estimated Price':'A general guide price for this Item, not a particular Vendor’s price. Not recorded is different from a known price of 0.',
    'Notes':'Recorded notes about this Item. Do not put passwords or private Admin information here; Item notes may appear in public output after publication.',
    'Vendor notes':'Private notes about this Vendor listing. They do not change the Item and are excluded from public listing output.',
    'Price (₽)':'This Vendor’s price only. Blank means unknown; 0 means a known zero price. It does not change the Item’s estimated price.',
    'Rank':'A recorded rank or requirement. Blank numeric values mean unknown; 0 is a recorded value. On a listing this belongs only to that Vendor.',
    'Stock / quantity':'The quantity offered by this Vendor. Blank means unknown; 0 means a known zero. Other Vendors are unaffected.',
    'Save private draft':'Saves for authorized Admins only. It does not change the public website. Preview and Publish are separate actions; publication may be disabled.',
    'Verify':'Confirm that you personally checked the facts for the current game patch. Evidence is optional. The server records your signed-in identity, time and current patch; editing facts requires another review.',
    'Verified':'Reviewed for the current patch. It does not mean the private draft has been published.',
    'Unverified':'No current verification decision is recorded. This does not mean the information is wrong. Check it before verifying.',
    'Patch check needed':'Reviewed for an earlier patch. Check it against the current patch and verify again. Earlier information and history are retained.',
    'Archive':'Remove from the active draft list without deleting information or relationships. Include archived entries to Restore. The public website changes only after publication.',
    'Restore':'Return an archived entry to the active draft list. Its recorded facts and history are retained. This does not publish it.',
    'Hide':'Hide or show an entry in the private draft without deleting it. Public visibility changes only after publication.',
    'Duplicate':'Create a separate record with a fresh reference. The copy starts hidden and unverified. Use a Vendor listing to offer an existing Item instead of duplicating it.',
    'Item reference':'The permanent reference for this Item. Renaming it keeps its Vendor relationships. You do not need to edit this reference.',
    'Vendor Listings':'A Vendor listing points to an existing Item. Item facts stay in one place; price, rank, quantity and private notes belong to this Vendor’s listing.',
    'Entity type':'Choose the existing catalogue to search. Adding a listing refers to its original record; it does not create a duplicate Item.',
    'Preview':'Review the public version of the saved draft. Internal Admin identity and verification history are excluded. Preview does not publish.',
    'Publish':'A separate action that changes the public website using a saved, previewed draft. It requires permission and enabled publication. Save private draft never publishes.',
    'Needs attention':'Review unverified or older-patch entries, missing images and unknown information. These are prompts to investigate, not permission to guess missing facts.',
    'Unknown information':'Includes missing or Not recorded category, description and recorded facts. Known 0, No and intentionally blank text are not unknown. Missing optional evidence is not an error.',
    'New Patch':'Owner-only action. Starting a new patch makes earlier verification need review; it does not change game facts or verify anything. This control may be disabled by release settings.',
    'Evidence':'Optional supporting references for a review. Evidence alone does not verify an entry. Use the existing evidence workflow for uploads.',
    'Retry save':'Try the same pending save again. A lost reply may still mean the save succeeded; retrying keeps the same request and avoids duplicates.',
    'Download pending entries':'Download your unsaved entries for recovery before reloading. Keep this file private; it may contain Admin-only notes.',
    'Description state':'Choose Not recorded for unknown information, or Written description for text, including an intentionally blank description.',
    'Item state':'Active includes hidden entries. Hidden controls visibility; Archived removes an entry from active work but keeps it restorable.',
    'Include archived vendors':'Include retained, inactive Vendors so you can inspect or restore them. Their inventory is not deleted.',
    'Include archived listings':'Show retained listings so you can restore them. Archiving a listing never deletes its Item.',
    'Review potential Attachments':'Evidence locations can suggest entries worth reviewing. They do not establish Content Type; no records are reclassified automatically.',
    'Missing image':'No usable image is recorded. Add an image only when it belongs to this entry.',
    'Record verification':'Record a review for the current patch. Evidence is optional. Local previews use a local reviewer; signed-in Admin uses authenticated server identity.',
    'Remove property':'Remove only this fact from the pending edit. Undo removal or cancel before saving to keep it.',
    'Remove listing':'Permanently remove this Vendor listing and its listing history after confirmation. The original Item stays intact. Archive instead when you may need it later.',
    'Maximum stack':'The recorded maximum number in a stack. Not recorded is unknown, not 0.',
    'Stackable':'Whether the item can stack. Not recorded, Yes and No are three different answers.',
    'Send invite':'Invite a person to Admin access using their email. Invitations and permission changes affect access; they do not publish content.',
    'Disable access':'Stop this Admin from using protected tools. Their earlier records and review history are retained.',
    'Enable access':'Restore this Admin’s assigned access. Check their permissions before enabling.',
    'Admin permissions':'Controls which protected Admin tools this person may use. Only the Owner manages access. Do not grant permissions merely to work around an error.',
    'Note state':'Choose Not recorded when there are no recorded notes, or Written notes to keep text, including intentionally blank notes.',
    'Classification conflict':'The stored Content Type and an existing source classification disagree. Review the original record; no type has been guessed or changed.',
    'After saving':'Stay on this entry, move to the next entry in the current filtered list, or open a separate verification confirmation after the save succeeds.',
    'Still correct':'Confirm that you checked this entry against the current patch. This records verification without changing its facts. Evidence is optional.',
    'Skip / Next':'Move through the current filtered list without saving or verifying the entry you leave.',
    'Effects':'Only effects actually recorded for this content. Keep unknown effects unknown; do not infer them from names or images.'
  };
  const aliases={'Publishing disabled':'Publish','Save private listing':'Save private draft','Add private listing':'Vendor Listings','+ Add listing':'Vendor Listings','Inventory':'Vendor Listings','Content Type / Attachment Type':'Content Type','Show':'Hide','Archive listing':'Archive','View evidence':'Evidence','View verification':'Verify','Review decision':'Verify','Record review':'Record verification','Verification':'Verify','New Patch — Require Re-verification':'New Patch','Start patch':'New Patch','Patch or build identifier':'New Patch','Unknown/not-recorded information':'Unknown information','Item properties':'Properties','Review entries needing attention':'Needs attention','Unknown/not-recorded information':'Unknown information'};
  function help(parent,title,message=helpText[aliases[title]||title]){
    if(!message)return null;
    const wrap=document.createElement('span');wrap.className='scav-help';
    const trigger=document.createElement('button');trigger.type='button';trigger.className='scav-help-trigger';trigger.textContent='ⓘ';trigger.setAttribute('aria-label','Help: '+title);
    const tip=document.createElement('span');tip.id='scav-help-'+(++helpSequence);tip.className='scav-help-text';tip.setAttribute('role','tooltip');tip.textContent=message;tip.hidden=true;
    trigger.setAttribute('aria-controls',tip.id);trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-describedby',tip.id);
    const show=value=>{tip.hidden=!value;trigger.setAttribute('aria-expanded',String(value));if(value){const rect=trigger.getBoundingClientRect();tip.style.left=Math.max(12,Math.min(rect.left,innerWidth-tip.offsetWidth-12))+'px';tip.style.top=Math.max(12,Math.min(rect.bottom+6,innerHeight-tip.offsetHeight-12))+'px';}};let pinned=false;
    trigger.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();pinned=!pinned;show(pinned);});
    wrap.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse')show(true);});wrap.addEventListener('pointerleave',()=>{if(!pinned&&!wrap.contains(document.activeElement))show(false);});
    trigger.addEventListener('focus',()=>show(true));wrap.addEventListener('focusout',e=>{if(!wrap.contains(e.relatedTarget)){pinned=false;show(false);}});
    wrap.addEventListener('keydown',e=>{if(e.key==='Escape'&&!tip.hidden){e.preventDefault();e.stopPropagation();pinned=false;show(false);}});
    wrap.append(trigger,tip);parent.append(wrap);return wrap;
  }
  function explain(node,title=node.dataset.help||node.textContent.trim(),message){
    if(node.dataset.helpAdded||node.closest('.scav-help')||node.matches('[data-id],[data-record-id],[data-key]'))return;
    if(!message&&!helpText[aliases[title]||title])return;
    node.dataset.helpAdded='true';const container=document.createElement('span');container.className='scav-help-slot';if(node.tagName==='BUTTON')node.before(container);else node.after(container);help(container,title,message);
  }
  function enhance(root){
    const nodes=[...(root.matches?.('[data-help],button')?[root]:[]),...root.querySelectorAll('[data-help],button')];
    for(const node of nodes)explain(node);
  }
  function startHelp(){enhance(document.body);new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node.nodeType===1&&!node.closest('.scav-help,.scav-help-slot'))enhance(node);}).observe(document.body,{childList:true,subtree:true});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startHelp,{once:true});else startHelp();
  function button(id, text, action, parent, aria) {
    const b=document.createElement('button');b.type='button';if(id)b.id=id;b.textContent=text;
    if(aria){b.setAttribute('aria-label',aria);b.title=aria;}b.onclick=action;parent.append(b);return b;
  }
  function options(select, entries, selected) {
    select.replaceChildren(...entries.map(([id,title])=>{const option=document.createElement('option');option.value=id;option.textContent=title;return option;}));
    if(entries.some(([id])=>id===selected))select.value=selected;
  }
  function field(body,label,name,value='',max=200,required=false,multiline=false) {
    const wrap=document.createElement('div');wrap.className='scav-field';const caption=document.createElement('label');caption.textContent=label;const head=document.createElement('div');head.className='scav-field-heading';head.append(caption);help(head,label);wrap.append(head);
    const input=document.createElement(multiline?'textarea':'input');input.id='scav-field-'+(++helpSequence);caption.htmlFor=input.id;input.name=name;input.value=value??'';input.maxLength=max;input.required=required;wrap.append(input);body.append(wrap);return input;
  }
  function selectField(body,label,name,entries,selected) {
    const wrap=document.createElement('div');wrap.className='scav-field';const caption=document.createElement('label');caption.textContent=label;const head=document.createElement('div');head.className='scav-field-heading';head.append(caption);help(head,label);wrap.append(head);
    const input=document.createElement('select');input.id='scav-field-'+(++helpSequence);caption.htmlFor=input.id;input.name=name;input.setAttribute('aria-label',label);options(input,entries,selected);wrap.append(input);body.append(wrap);return input;
  }
  function status(node,state,detail='') {
    const labels={ready:'Ready',saving:'Saving…',saved:'Saved',updating:'Public site updating…',error:'Couldn’t save'};
    if(!labels[state])throw new Error('Unknown editor status.');
    node.setAttribute('role','status');node.setAttribute('aria-live','polite');node.dataset.state=state;
    node.textContent=labels[state]+(detail?' — '+detail:'');
  }
  const matches=(value,query)=>String(value??'').toLocaleLowerCase().includes(String(query??'').trim().toLocaleLowerCase());
  function search(input,onChange) {
    input.type='search';const listener=()=>onChange(input.value.trim());input.addEventListener('input',listener);
    return {matches:value=>matches(value,input.value),destroy:()=>input.removeEventListener('input',listener)};
  }
  function imagePicker({inventory,current=null,title='Choose Image',recordName='',removeId='',onSubmit}) {
    let selected=current;
    return window.scavEditorDialog({title,submit:'Use Image',build:({body,setDirty})=>{
      const input=field(body,'Search images','search',recordName,200);input.dataset.editorTransient='true';
      const categories=document.createElement('div');categories.className='scav-image-categories';
      const grid=document.createElement('div');grid.className='scav-image-grid';
      const preview=document.createElement('img');preview.className='scav-image-preview';preview.alt='Selected image';
      const caption=document.createElement('p'),results=document.createElement('p');results.setAttribute('role','status');
      body.append(categories,results,grid,preview,caption);
      const groups=inventory.categories||{};let category='all',limit=60;
      const imageName=path=>path.split('/').pop().replace(/\.(png|jpe?g|webp|gif)$/i,'').replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim();
      const normalized=value=>String(value).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
      button('','Show all images',()=>{input.value='';category='all';show();},body);
      const technical=document.createElement('details'),technicalTitle=document.createElement('summary'),raw=document.createElement('p');technicalTitle.textContent='Technical image reference';technical.append(technicalTitle,raw);body.append(technical);
      const more=button('','Show more images',()=>{limit+=60;show();},body);
      function show(){
        const paths=category==='all'?[...new Set(Object.values(groups).flatMap(g=>g.images||[]))]:groups[category].images||[];
        const words=normalized(input.value).split(' ').filter(Boolean);const filtered=paths.filter(path=>words.every(word=>normalized(path).includes(word))).sort((a,b)=>Number(b===current)-Number(a===current));grid.replaceChildren();
        results.textContent=filtered.length?`${filtered.length} images · showing ${Math.min(limit,filtered.length)}`:'No images match.';
        filtered.slice(0,limit).forEach(path=>{
          const b=button('','',()=>{selected=path;setDirty();show();grid.querySelectorAll('button').forEach(node=>{if(node.dataset.imagePath===path)node.focus();});},grid,imageName(path));b.dataset.imagePath=path;
          b.setAttribute('aria-pressed',String(selected===path));
          const img=document.createElement('img');img.src=path;img.alt='';img.loading='lazy';const text=document.createElement('span');text.textContent=imageName(path);b.append(img,text);
        });
        categories.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.category===category)));
        more.hidden=filtered.length<=limit;preview.hidden=!selected;if(selected)preview.src=selected;else preview.removeAttribute('src');caption.textContent=selected?imageName(selected):'No image';raw.textContent=selected||'No image reference';
      }
      for(const [key,label] of [['all','All'],...Object.entries(groups).map(([k,v])=>[k,v.label||k])]){
        const b=button('',label,()=>{category=key;limit=60;show();},categories);b.dataset.category=key;
      }
      button(removeId,'Remove Image',()=>{selected=null;setDirty();show();},body);
      search(input,()=>{limit=60;show();});show();
    },onSubmit:()=>onSubmit(selected)});
  }
  function recordedField(parent,title,key,value){
    const group=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=title;group.append(legend);parent.append(group);help(group,title);
    if(value&&typeof value==='object'&&!Array.isArray(value)){
      const readers=Object.entries(value).map(([k,v])=>[k,recordedField(group,k.replace(/([a-z])([A-Z])/g,'$1 $2'),k,v)]);
      return ()=>Object.fromEntries(readers.map(([k,read])=>[k,read()]));
    }
    const numeric=['rank','estimatedPrice','maxStack'].includes(key)||typeof value==='number';
    if(key==='stackable'||typeof value==='boolean'){
      const input=selectField(group,title,key,[['unknown','Not recorded'],['yes','Yes'],['no','No']],value==null?'unknown':value===true?'yes':value===false?'no':'legacy');
      if(value!=null&&typeof value!=='boolean'){options(input,[['legacy','Keep recorded value'],['unknown','Not recorded'],['yes','Yes'],['no','No']],'legacy');}
      return ()=>input.value==='legacy'?value:input.value==='unknown'?null:input.value==='yes';
    }
    if(value!==null&&value!==undefined&&typeof value!=='string'&&typeof value!=='number'){
      const note=document.createElement('p');note.textContent='Structured information retained. Use Advanced details for complex values.';group.append(note);return ()=>structuredClone(value);
    }
    if(numeric&&value!=null&&typeof value!=='number'&&!Number.isFinite(Number(value))){const note=document.createElement('p');note.textContent='Recorded value: '+value+'. Retained exactly; review this legacy format before changing it.';group.append(note);return ()=>value;}
    const mode=selectField(group,title+' information',key+'-state',[['unknown','Not recorded'],['recorded','Recorded']],value==null?'unknown':'recorded');
    const input=field(group,title,key,value??'',10000,false,!numeric);if(numeric){input.type='number';input.step='any';}
    const initial=input.value;let touched=false;input.addEventListener('input',()=>{touched=true;});
    mode.onchange=()=>{input.disabled=mode.value==='unknown';};mode.onchange();
    return ()=>{if(mode.value==='unknown')return null;if(!touched&&input.value===initial&&value!=null)return value;if(!numeric)return input.value;if(input.value==='')return null;const number=Number(input.value);if(!Number.isFinite(number))throw Error('Enter a valid '+title.toLowerCase()+'.');return number;};
  }
  function verificationInfo(parent,inspection,{verifierName}={}) {
    const labels={verified:'Verified','unverified':'Unverified','patch-check-needed':'Patch check needed'};
    if(!labels[inspection.status])throw new Error('Invalid verification status.');
    const block=document.createElement('div');block.className='scav-verification';
    const badge=document.createElement('strong');badge.className='scav-verification-badge';badge.dataset.state=inspection.status;badge.textContent=labels[inspection.status];block.append(badge);
    const details=document.createElement('p');
    const last=inspection.last_verified_at?new Date(inspection.last_verified_at).toLocaleString():inspection.last_verified==='unknown'?'Unknown (legacy evidence)':'Never';
    details.textContent='Last verified: '+last+(inspection.verified_patch_id?' · Patch '+inspection.verified_patch_id:'');
    if(inspection.last_verified_by)details.textContent+=' · By '+(verifierName||'recorded administrator');
    help(block,labels[inspection.status]);block.append(details);parent.append(block);return block;
  }
  function confirm({title,message='',submit='Delete',build=()=>{},onConfirm}) {
    return window.scavEditorDialog({title,submit,build:api=>{
      api.save.className='scav-danger';
      if(message){const p=document.createElement('p');p.textContent=message;api.body.append(p);}
      build(api);
    },onSubmit:onConfirm});
  }
  // Resolve relationships by stable ID, never by a display name or copied game stats.
  function catalog(records) {
    const map=new Map();
    for(const record of records){
      if(!record||typeof record.id!=='string'||!record.id.trim())throw new Error('Every catalogue record needs a stable ID.');
      if(map.has(record.id))throw new Error('Duplicate catalogue ID.');map.set(record.id,structuredClone(record));
    }
    return Object.freeze({list:()=>structuredClone([...map.values()]),resolve:id=>map.has(id)?structuredClone(map.get(id)):null});
  }
  function recordPicker({records,currentId=null,settings,title='Choose existing record',onSelect}) {
    const source=catalog(records);let selected=source.resolve(currentId)?.archived?null:currentId;
    return window.scavEditorDialog({title,submit:'Use selected record',build:({body,save,setDirty})=>{
      const input=field(body,'Search records','search','',200);input.dataset.editorTransient='true';
      const filter=selectField(body,'Verification','filter',[['all','All'],['verified','Verified'],['attention','Needs verification']],'all');filter.dataset.editorTransient='true';
      const results=document.createElement('p');results.setAttribute('role','status');const list=document.createElement('div');list.className='scav-record-list';body.append(results,list);
      let limit=50;const more=button('','Show more records',()=>{limit+=50;show();},body);
      function show(){
        const entries=source.list().filter(r=>!r.archived&&matches(r.name||r.title,input.value)).map(record=>({record,inspection:window.ScavVerification.inspect(record,settings)})).filter(({inspection})=>filter.value==='all'||filter.value==='verified'&&inspection.status==='verified'||filter.value==='attention'&&inspection.status!=='verified');
        results.textContent=entries.length?`${entries.length} records · showing ${Math.min(limit,entries.length)}`:'No matching records.';list.replaceChildren();
        for(const {record,inspection} of entries.slice(0,limit)){
          const row=document.createElement('div');row.className='scav-record-choice';const b=button('',record.name||record.title||'Unnamed record',()=>{selected=record.id;setDirty();show();list.querySelectorAll('button').forEach(n=>{if(n.dataset.recordId===selected)n.focus();});},row);
          b.dataset.recordId=record.id;b.setAttribute('aria-pressed',String(record.id===selected));verificationInfo(row,inspection);list.append(row);
        }
        more.hidden=entries.length<=limit;save.disabled=!source.resolve(selected)||source.resolve(selected).archived===true;
      }
      search(input,()=>{limit=50;show();});filter.onchange=()=>{limit=50;show();};show();
    },onSubmit:()=>{if(!source.resolve(selected)||source.resolve(selected).archived)throw new Error('Select an existing record.');return onSelect(selected);}});
  }
  return Object.freeze({help,explain,enhance,recordedField,button,options,field,selectField,status,matches,search,imagePicker,verificationInfo,confirm,catalog,recordPicker});
})();
