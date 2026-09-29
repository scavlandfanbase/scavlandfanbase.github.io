// Authenticated Admin bridge. No tokens or authoritative drafts in localStorage.
(function(root){
 const enabled=parent!==window||!['localhost','127.0.0.1'].includes(location.hostname);
 function create(domain){
  let token='',pending=null,busy=false,previewVersion=null,onSaved=()=>{},canPublish=false;
  const endpoint='https://demtoqsafufzmnhvaykj.supabase.co/functions/v1/admin-drafts',apiKey='sb_publishable_0kdLCpTy7Sf8BKkIU5TOqw_Qaay4gzH';
  const section=document.createElement('section');section.className='production-actions';section.setAttribute('aria-label','Private draft and publication');
  const status=document.createElement('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');section.append(status);
  document.getElementById('workspace').before(section);
  const E=ScavEditor,toolbar=document.createElement('div');toolbar.className='toolbar';section.append(toolbar);
  function paint(){
   const waiting=pending||client.getPending();
   retry.hidden=!waiting;recover.hidden=!waiting;
   for(const button of toolbar.querySelectorAll('button'))button.disabled=busy;
   if(refresh)refresh.disabled=busy||!!waiting;
   preview.disabled=busy||!!waiting;publish.disabled=!canPublish||busy||!!waiting||previewVersion!==client.getVersion();publish.textContent=canPublish?'Publish':'Publishing disabled';
  }
  const client=ScavDraftPersistence.create({endpoint,apiKey,getToken:()=>token,domain,entityId:'catalogue',onState:({state,detail})=>{
   const labels={saving:'Saving…',saved:'Saved · private draft',conflict:'Conflict — newer version exists',error:'Couldn’t save — Retry',rebasing:'Refreshing from public data…',publishing:'Publishing…',published:'Published',previewing:'Preparing preview…'};
   if(labels[state])status.textContent=labels[state]+(detail?' · '+detail:'');
  }});
  async function request(body){
   if(!token)throw Object.assign(Error('Open this editor from the signed-in Admin Hub.'),{status:401});
   const response=await fetch(endpoint,{method:'POST',headers:{apikey:apiKey,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({domain,entityId:'catalogue',...body})});
   let result;try{result=await response.json();}catch{throw Error('Private storage is unavailable. Keep your entries and retry.');}
   if(!response.ok)throw Object.assign(Error(result.error||'Could not complete this action.'),{status:response.status});return result;
  }
  const waiters=[];
  window.addEventListener('message',event=>{
   if(parent===window||event.source!==parent||event.origin!==location.origin||event.data?.type!=='scavland-admin-token'||typeof event.data.token!=='string')return;
   token=event.data.token;waiters.splice(0).forEach(resolve=>resolve());
  });
  async function authenticate(){
   if(token)return;if(parent===window)throw Error('Open this editor from the signed-in Admin Hub.');
   parent.postMessage({type:'scavland-admin-ready'},location.origin);
   await new Promise((resolve,reject)=>{const ready=()=>{clearTimeout(timer);resolve();};const timer=setTimeout(()=>{const i=waiters.indexOf(ready);if(i>=0)waiters.splice(i,1);reject(Error('Sign in through the Admin Hub, then reload this editor.'));},10000);waiters.push(ready);});
  }
  function record(saved){return {record:{state:saved.payload.catalogue,selectedId:saved.payload.selectedId},settings:saved.payload.settings};}
  async function retryPending(){
   if(busy||(!pending&&!client.getPending()))throw Error('No pending action is available.');busy=true;paint();status.textContent='Saving…';
   try{
    let saved;
    if(client.getPending())saved=await client.retry();
    else{
     if(!pending.prepared)pending.prepared=await request({action:'prepare',expectedVersion:pending.version,requestId:pending.requestId,command:pending.command});
     saved=await client.save(pending.prepared.payload,pending.prepared.base,{requestId:pending.requestId});
    }
    pending=null;previewVersion=null;const result=record(saved);onSaved(result);return result;
   }catch(error){
    // Rejected preparation has made no draft write. Keep form values editable.
    if(error.status===400&&!pending?.prepared&&!client.getPending())pending=null;
    status.textContent=(error.status===409?'Conflict — newer version exists. ':'Couldn’t save — Retry. ')+error.message;throw error;
   }
   finally{busy=false;paint();}
  }
  async function change(command){
   const clean=structuredClone(command);delete clean.requestId;
   if(client.getPending()&&!pending)throw Error('Retry the pending refresh before editing.');
   if(pending&&JSON.stringify(pending.command)!==JSON.stringify(clean))throw Error('Retry or download the pending entries before reloading.');
   if(!pending)pending={command:clean,requestId:crypto.randomUUID(),version:client.getVersion()};
   return retryPending();
  }
  const retry=E.button('production-retry','Retry save',()=>retryPending().catch(()=>{}),toolbar);
  const recover=E.button('production-recover','Download pending entries',()=>{
   const url=URL.createObjectURL(new Blob([JSON.stringify(pending||client.getPending(),null,2)],{type:'application/json'}));
   const link=document.createElement('a');link.href=url;link.download=domain+'-pending-private.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  },toolbar);
  const refresh=domain==='items'&&E.button('production-refresh','Refresh from public',async()=>{
   if(busy||pending||client.getPending())return;busy=true;paint();previewVersion=null;
   try{const saved=await client.rebase();previewVersion=null;onSaved(record(saved));status.textContent='Saved · private draft refreshed from public data';}
   catch(error){const paths=Array.isArray(error.conflicts)&&error.conflicts.length?' Conflicting fields: '+error.conflicts.map(item=>item.path).join(', ')+'.':'';status.textContent=(error.status===409?'Refresh stopped — review conflicts. ':'Couldn’t refresh — ')+error.message+paths;}
   finally{busy=false;paint();}
  },toolbar);
  const preview=E.button('production-preview','Preview',async()=>{
   if(busy||pending)return;busy=true;paint();
   try{const result=await client.preview();previewVersion=client.getVersion();
    scavEditorDialog({title:'Public '+domain+' preview',submit:'Close',build:({body})=>{
     body.classList.add('production-preview-body');
     const p=document.createElement('p');p.textContent='This preview contains public output only. Saving a draft does not publish it.';body.append(p);
     for(const file of result.preview.files){
      const document=JSON.parse(file.content),summary=window.document.createElement('p');
      summary.textContent=(document.data||[]).length+' records · hidden and archived records remain stored but are not shown on public pages.';body.append(summary);
      const label=key=>key.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/_/g,' ').replace(/^./,c=>c.toUpperCase());
      const describe=value=>value===null?'Not recorded':Array.isArray(value)?value.map(describe).join(', '):typeof value==='object'?Object.entries(value).map(([k,v])=>label(k)+': '+describe(v)).join('; '):String(value);
      for(const record of document.data||[]){
       const details=window.document.createElement('details'),heading=window.document.createElement('summary'),facts=window.document.createElement('dl');
       heading.textContent=record.name+(record.archived?' · Archived':record.hidden?' · Hidden':'');details.append(heading,facts);
       for(const key of ['category','description','properties','location','factionId','rank','estimatedPrice','maxStack'])if(Object.hasOwn(record,key)){
        const title=window.document.createElement('dt'),value=window.document.createElement('dd');title.textContent=label(key);value.textContent=describe(record[key]);facts.append(title,value);
       }
       if(record.verification){const note=window.document.createElement('p');note.textContent=record.verification.decision==='verified'?'Verification recorded for patch '+record.verification.verified_patch_id:'Unverified';details.append(note);}
       body.append(details);
      }
      if(document.vendorListings){const note=window.document.createElement('p');note.textContent=document.vendorListings.listings.filter(r=>!r.archived).length+' active Item listings. Listing notes remain private.';body.append(note);}
     }
    },onSubmit:()=>{}});
   }catch(error){status.textContent=error.message;}finally{busy=false;paint();}
  },toolbar);
  const publish=E.button('production-publish','Publish',()=>{
   if(!canPublish)return;
   E.confirm({title:'Publish '+domain+'?',message:'Update the public '+domain+' catalogue with the saved draft you previewed? This is separate from Save Draft.',submit:'Publish',onConfirm:async()=>{
    busy=true;paint();try{await client.publish({confirm:true});previewVersion=null;status.textContent='Published. Your private draft and review history are retained.';}
    catch(error){status.textContent=error.message;throw error;}finally{busy=false;paint();}
   }});
  },toolbar);
  paint();status.textContent='Sign in through the Admin Hub to load private drafts.';
  window.addEventListener('beforeunload',e=>{if(pending||client.getPending()||busy){e.preventDefault();e.returnValue='';}});
  return {change,retry:retryPending,hasPending:()=>!!pending||!!client.getPending(),set onSaved(callback){onSaved=callback;},
   async load(){await authenticate();await client.load({discardPending:true});pending=null;previewVersion=null;paint();const result=await request({action:'source'});canPublish=result.capabilities?.publish===true;paint();status.textContent=canPublish?'Private draft · Preview before Publish':'Private draft · Publishing disabled · Your saves do not change the website';return result;},
   async source(){await authenticate();return request({action:'source'});}};
 }
 root.ScavProductionEditor={enabled,create};
})(globalThis);
