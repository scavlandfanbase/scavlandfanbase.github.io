// Same-origin embedded Admin session only. No tokens or drafts in browser storage.
(()=>{
 if(new URLSearchParams(location.search).get('live')!=='1')return;
 let token='',readyResolve,canPublish=false;const ready=new Promise(resolve=>{readyResolve=resolve;}),pending=new Map();
 const endpoint='https://demtoqsafufzmnhvaykj.supabase.co/functions/v1/admin-drafts';
 window.addEventListener('message',event=>{
  if(parent===window||event.source!==parent||event.origin!==location.origin||event.data?.type!=='scavland-admin-token'||typeof event.data.token!=='string')return;
  token=event.data.token;if(token)readyResolve();
 });
 if(parent!==window)parent.postMessage({type:'scavland-admin-ready'},location.origin);
 async function call(command){await ready;if(!token)throw Error('Sign in again. Saved work is retained.');
  const response=await fetch(endpoint,{method:'POST',headers:{apikey:'sb_publishable_0kdLCpTy7Sf8BKkIU5TOqw_Qaay4gzH',Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({domain:'page-builder',...command})});
  let result;try{result=await response.json();}catch{throw Error('Page action was not confirmed. Retry the same action.');}
  if(!response.ok)throw Object.assign(Error(result.error||'Page action was not confirmed.'),{status:response.status});return result;
 }
 function receipt(command){const key=JSON.stringify(command);if(!pending.has(key))pending.set(key,{...command,requestId:crypto.randomUUID()});return {key,command:pending.get(key)};}
 const record=draft=>({draft:draft.payload,revision:draft.version,archived:draft.archived});
 async function api(path,options={}){
  if(!options.body){
   const summaries=[];let after=null;
   for(let batch=0;batch<100;batch++){const list=await call({action:'list',...(after?{after}:{})});summaries.push(...list.pages);if(!list.nextCursor)break;if(list.nextCursor===after||batch===99)throw Error('Page list is incomplete.');after=list.nextCursor;}
   const source=await call({action:'source'});
   canPublish=source.capabilities?.publish===true;
   return {pages:summaries.filter(p=>!p.archived).map(p=>({draft:{id:p.pageId,title:p.title,slug:p.slug,intro:'',sections:[]},revision:p.version,summary:true})),archivedPages:summaries.filter(p=>p.archived),imageChoices:source.imageChoices,existingPages:source.existingPages};
  }
  const body=JSON.parse(options.body);let command;
  if(body.action==='create'){const {id,...page}=body.page;command={action:'create',page};}
  else if(body.action==='save')command={action:'save',pageId:body.id,expectedVersion:body.revision,page:body.page};
  else if(body.action==='delete')command={action:'archive',pageId:body.id,expectedVersion:body.revision};
  else throw Error('Unsupported page action.');
  const entry=receipt(command),result=await call(entry.command);pending.delete(entry.key);return {record:record(result.draft)};
 }
 let reviewed=null,lastRequest=null,lastPageId=null;
 function publication(value){const p=value.publication,states={prepared:'outcome-unknown',committed:'deployment-pending','build-failed':'deployment-failed',live:'published',refused:'refused'};
  return {requestId:p.request_id,revision:reviewed?.preview.version??lastRequest?.revision,state:states[p.state]||'outcome-unknown',commitId:p.commit_sha,confirmed:p.state==='live',own:true};}
 const publicationAdapter={
  review:async({revision,page})=>{const entry=receipt({action:'preview',pageId:page.id,version:revision});reviewed=await call(entry.command);pending.delete(entry.key);return {revision:reviewed.preview.version,page:reviewed.page,html:reviewed.preview.html,digest:reviewed.preview.digest};},
  start:async()=>{
   if(!reviewed)throw Error('Review the saved revision first.');const entry=receipt({action:'publish',previewId:reviewed.previewId});
   lastRequest={requestId:entry.command.requestId,revision:reviewed.preview.version,state:'outcome-unknown',confirmed:false,own:true};
   try{const result=await call(entry.command);pending.delete(entry.key);lastRequest=publication(result);return lastRequest;}
   catch(error){return {...lastRequest,error:error.message};}
  },
  check:async requestId=>{if(lastRequest?.own===false){const result=await call({action:'page-state',pageId:lastPageId});const p=result.publication;if(!p)throw Error('Publication status unavailable.');lastRequest={requestId:p.requestId,revision:p.version,state:({prepared:'outcome-unknown',committed:'deployment-pending','build-failed':'deployment-failed',live:'published',refused:'refused'})[p.state],commitId:p.commit,confirmed:p.state==='live',own:p.own};return lastRequest;}
   const result=await call({action:'status',requestId});lastRequest=publication(result);return lastRequest;},
  advance:async requestId=>publicationAdapter.check(requestId),retry:async requestId=>{if(lastRequest?.state==='outcome-unknown'&&lastRequest.own!==false){const result=await call({action:'recover',requestId});lastRequest=publication(result);return lastRequest;}return publicationAdapter.check(requestId);}
 };
 window.ScavPageBackend={ready,api,call,record,publicationAdapter,get canPublish(){return canPublish;},
  load:async id=>{const result=await call({action:'load',pageId:id});if(!result.draft||result.draft.archived)throw Error('This page is archived or unavailable.');
   const state=await call({action:'page-state',pageId:id}),loaded=record(result.draft);
   lastPageId=id;
   if(state.publication){const p=state.publication;loaded.publication={requestId:p.requestId,revision:p.version,state:({prepared:'outcome-unknown',committed:'deployment-pending','build-failed':'deployment-failed',live:'published',refused:'refused'})[p.state],commitId:p.commit,confirmed:p.state==='live',own:p.own};lastRequest=loaded.publication;}
   return loaded;},
  historyAdapter:pageId=>({list:async()=>{
   const id=pageId();if(!id)return [];const result=await call({action:'history',pageId:id});const revisions=[];
   for(const value of result.revisions){const version=await call({action:'revision',pageId:id,version:value.version});if(version.draft)revisions.push({key:String(value.version),revision:value.version,savedAt:value.savedAt,editorName:'Recorded administrator',state:value.archived?'Archived':'Saved',page:version.draft.payload});}
   return revisions;
  }})};
})();
