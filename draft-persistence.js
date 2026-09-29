// R1 shared client contract; no editor wiring, localStorage or optimistic Saved message.
(function(root){
 function create({endpoint,apiKey,getToken,domain,entityId,fetcher=fetch,onState=()=>{}}){
  let version=0,pending=null,busy=false,loaded=false;
  const clone=v=>structuredClone(v),emit=(state,detail)=>onState({state,detail,pending:pending?clone(pending):null});
  async function request(body){
   const token=await getToken();if(!token)throw Object.assign(Error('Sign in again. Your entries are retained.'),{status:401});
   const response=await fetcher(endpoint,{method:'POST',headers:{apikey:apiKey,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({domain,entityId,...body})});
   let result;try{result=await response.json();}catch{throw Error('Invalid save response. Your entries are retained.');}
   if(!response.ok){const error=Object.assign(Error(result.error||'Couldn’t save — Retry'),{status:response.status});if(Array.isArray(result.conflicts))error.conflicts=clone(result.conflicts);throw error;}return result;
  }
  async function load({discardPending=false}={}){
   if(busy||pending&&!discardPending)throw Error('Keep or explicitly discard pending entries before reloading.');
   busy=true;
   try{const r=await request({action:'load'});if(!Number.isInteger(r.currentVersion)||r.currentVersion<0)throw Error('Invalid draft response.');version=r.currentVersion;loaded=true;pending=null;emit('ready');return r.draft;}finally{busy=false;}
  }
  async function retry(){
   if(busy||!pending)throw Error('No pending save is available.');busy=true;emit('saving','Saving…');
   try{
    if(pending.action==='prepare'){
     const prepared=await request(pending);
     if(prepared.request_id!==pending.requestId||!prepared.payload||!prepared.base)throw Error('The refreshed draft was not approved. Your entries are retained.');
     pending={...pending,action:'save',payload:clone(prepared.payload),base:clone(prepared.base)};
     delete pending.command;
    }
    const r=await request(pending);
    if(!r.draft||r.draft.request_id!==pending.requestId||r.draft.version!==pending.expectedVersion+1||!r.draft.saved_at)throw Error('Durable save was not acknowledged. Retry the same entries.');
    if(r.currentVersion!==r.draft.version)throw Object.assign(Error('Conflict — newer version exists. This request previously saved; reload explicitly.'),{status:409});
    version=r.draft.version;pending=null;emit('saved','Saved');return r.draft;
   }catch(e){if(pending?.action==='prepare'&&[400,409].includes(e.status))pending=null;emit(e.status===409?'conflict':'error',e.status===409?e.message:'Couldn’t save — Retry. '+e.message);throw e;}finally{busy=false;}
  }
  async function save(payload,base,{requestId=crypto.randomUUID()}={}){
   if(!loaded||busy||pending)throw Error('Load first; retry or explicitly reload pending entries before another save.');
   function check(value,seen=new Set()){
    if(value===null||typeof value==='string'||typeof value==='boolean')return;
    if(typeof value==='number'&&Number.isFinite(value))return;
    if(!value||typeof value!=='object'||seen.has(value)||(!Array.isArray(value)&&Object.getPrototypeOf(value)!==Object.prototype))throw Error('Use valid JSON values; unknown values must remain explicit.');
    seen.add(value);Object.values(value).forEach(v=>check(v,seen));seen.delete(value);
   }
   check(payload);check(base);
   pending={action:'save',payload:clone(payload),base:clone(base),expectedVersion:version,requestId};return retry();
  }
  async function rebase(){
   if(!loaded||busy||pending)throw Error('Load first; retry or save pending entries before refreshing from public data.');
   pending={action:'prepare',command:{action:'refresh-public'},expectedVersion:version,requestId:crypto.randomUUID()};
   emit('rebasing','Refreshing from public data…');return retry();
  }
  async function inspectOrPublish(action,confirm){
   if(!loaded||busy||pending)throw Error('Save pending entries before preview or Publish.');busy=true;emit(action==='publish'?'publishing':'previewing');
   try{const result=await request({action,expectedVersion:version,...(action==='publish'?{confirm:confirm===true}:{})});emit(action==='publish'?'published':'ready');return result;}catch(e){emit(e.status===409?'conflict':'error',e.message);throw e;}finally{busy=false;}
  }
  return Object.freeze({load,save,retry,rebase,preview:()=>inspectOrPublish('preview'),publish:({confirm=false}={})=>inspectOrPublish('publish',confirm),getPending:()=>pending?clone(pending):null,getVersion:()=>version});
 }
 const api=Object.freeze({create});if(typeof module==='object'&&module.exports)module.exports=api;else root.ScavDraftPersistence=api;
})(globalThis);
