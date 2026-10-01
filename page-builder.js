(()=>{
  const Builder=window.ScavPageBuilder;
  const live=window.ScavPageBackend;
  const $=selector=>document.querySelector(selector);
  const status=$('#status'),retry=$('#retry'),draftList=$('#draft-list'),sections=$('#section-list');
  const titleInput=$('#page-title'),slugInput=$('#page-slug'),introInput=$('#page-intro'),saveButton=$('#save-draft');
  const preview=$('#preview-frame'),previewError=$('#preview-error');
  const historyToggle=$('#history-toggle'),historyPanel=$('#history-panel'),historyStatus=$('#history-status'),historyRetry=$('#history-retry'),historyList=$('#history-list'),historyEmpty=$('#history-empty'),historyDetail=$('#history-detail'),historyMetadata=$('#history-metadata'),historyFrame=$('#history-frame'),historyRepair=$('#history-repair');
  const publicationToggle=$('#publication-toggle'),publicationPanel=$('#publication-panel'),publicationClose=$('#publication-close'),publicationStatus=$('#publication-status'),publicationLockNote=$('#publication-lock-note'),publicationScenarioInput=$('#publication-scenario'),publicationCurrentDraft=$('#publication-current-draft'),publicationReviewButton=$('#publication-review'),publicationStartButton=$('#publication-start'),publicationNextButton=$('#publication-next'),publicationCheckButton=$('#publication-check'),publicationRetryButton=$('#publication-retry'),publicationReviewed=$('#publication-reviewed'),publicationRequestLabel=$('#publication-request'),publicationEventsList=$('#publication-events'),publicationPreviewPanel=$('#publication-preview-panel'),publicationPreviewLabel=$('#publication-preview-label'),publicationReviewFrame=$('#publication-review-frame');
  let token='',records=[],images=[],existingPages=[],active=null,revision=null,snapshot=null,dirty=false,slugEdited=false,cssText='',saving=false;
  const errorState=new WeakMap();let previewErrorField=null;
  let historyVersions=[],historySelection=null,historyLoaded=false,historyLoading=false,historyRequest=0,recordRequest=0;
  let publicationScenario='success',publicationReview=null,publicationReviewInvalidated=false,publicationRequest=null,publicationError='',publicationErrorFocus=null,publicationState='not-reviewed',publicationInFlight=false,publicationReviewing=false,publicationLock=false,publicationDisabled=new Map(),publicationEvents=[];
  const blockTypes=[['heading','Heading'],['text','Text'],['image','Image'],['card','Card'],['divider','Divider'],['button','Link button']];
  const layoutChoices={columns:[[1,'One column'],[2,'Two columns'],[3,'Three columns']],align:[['start','Start'],['center','Center']],spacing:[['compact','Compact'],['normal','Normal'],['spacious','Spacious']],background:[['none','None'],['surface','Surface'],['subtle','Subtle']]};
  function longTitleHistoryFixture(source){
    if(!source.revisions?.length)return null;
    const revision=structuredClone(source.revisions[0]);
    revision.key='demo-v4-long-title';revision.revision=4;revision.savedAt='2026-09-28T10:00:00.000Z';
    revision.editorName='Fixture editor with an intentionally long display name for narrow-screen history layout checks';
    revision.page.title='Demonstration History - '+'Northern Route Notes '.repeat(6);
    revision.page.intro='Long fixture title and editor-name reflow example.';
    return revision;
  }
  function historicalMetadataRepairFixtures(source){
    if(!source.revisions?.length)return [];
    const malformed=structuredClone(source.revisions[0]),reserved=structuredClone(source.revisions[0]);
    malformed.key='demo-invalid-identity';malformed.revision=0;malformed.savedAt='2026-09-05T10:00:00.000Z';malformed.editorName='Fixture metadata editor';malformed.state='Archived';malformed.page.id='invalid page identity';malformed.page.title='Fixture with malformed identity';
    reserved.key='demo-reserved-address';reserved.revision=0;reserved.savedAt='2026-09-03T10:00:00.000Z';reserved.editorName='Fixture metadata editor';reserved.state='Archived';reserved.page.slug='items';reserved.page.title='Fixture with protected address';
    return [malformed,reserved];
  }
  function createHistoryFixtureAdapter(source,imageRepair){
    let attempts=0;
    return Object.freeze({async list(){
      attempts++;await new Promise(resolve=>setTimeout(resolve,Math.max(0,Number(source.delayMs)||0)));
      if(source.failAttempts?.includes(attempts))throw new Error('Fixture history could not be loaded.');
      if(!Array.isArray(source.revisions))throw new Error('Fixture history data is malformed.');
      const revisions=structuredClone(source.revisions);
      if(source.includeLongTitle!==false){const longRevision=longTitleHistoryFixture(source);if(longRevision)revisions.push(longRevision);}
      if(source.includeMetadataRepairs!==false)revisions.push(...historicalMetadataRepairFixtures(source));
      if(source.includeImageRepair!==false)revisions.push(imageRepair);
      return revisions;
    }});
  }
  const historyAdapter=live?live.historyAdapter(()=>revision?active?.id:null):createHistoryFixtureAdapter(JSON.parse($('#page-builder-history-fixtures').content.textContent),JSON.parse($('#page-builder-history-image-fixture').content.textContent));
  function createPublicationFixtureAdapter(fixtures){
    const requests=new Map(),failActions={...(fixtures.failActions||{})};let sequence=0;
    const wait=async action=>{
      await new Promise(resolve=>setTimeout(resolve,Math.max(0,Number(fixtures.delayMs)||0)));
      if(failActions[action]>0){failActions[action]--;throw new Error(`Fixture ${action} adapter rejected the request.`);}
    };
    const snapshot=request=>structuredClone(request);
    const find=requestId=>{const request=requests.get(requestId);if(!request)throw new Error('Demonstration request was not found.');return request;};
    return Object.freeze({
      count:()=>requests.size,
      async review({revision,page}){await wait('review');return {revision,page:snapshot(page)};},
      async start({scenario,revision,digest,pageId,title,slug}){
        await wait('start');const plan=fixtures.scenarios.find(entry=>entry.id===scenario);if(!plan)throw new Error('Choose a demonstration scenario.');
        const number=++sequence,request={requestId:`DEMO-PUB-${String(number).padStart(3,'0')}`,scenario,revision,digest,pageId,title,slug,plan,retries:0,checks:0,statusChecks:0,index:1,state:plan.transitions[0],commitId:`DEMO-COMMIT-${String(number).padStart(3,'0')}`,commitRecorded:false,confirmed:plan.transitions[0]==='published'&&plan.confirmedPublished!==false,retrying:false};
        requests.set(request.requestId,request);return snapshot(request);
      },
      async advance(requestId){
        await wait('advance');const request=find(requestId),steps=request.retrying?fixtures.retryTransitions:request.plan.transitions,next=steps[request.index++];
        if(!next)throw new Error('This demonstration has no further status step.');
        request.state=next;if(next==='repository-commit-recorded')request.commitRecorded=true;if(next==='published'){request.confirmed=request.plan.confirmedPublished!==false;if(!request.confirmed)request.state='outcome-unknown';}return snapshot(request);
      },
      async check(requestId){
        await wait('check');const request=find(requestId);request.checks++;
        if(request.state==='published'&&request.confirmed!==true)request.state='outcome-unknown';
        else if(['unknown','unconfirmed'].includes(request.scenario)&&!request.confirmed&&['outcome-unknown','deployment-pending'].includes(request.state)){
          const next=fixtures.unknownChecks[Math.min(request.statusChecks++,fixtures.unknownChecks.length-1)];
          if(next){request.state=next;if(next==='published')request.confirmed=true;}
        }
        return snapshot(request);
      },
      async retry(requestId){
        await wait('retry');const request=find(requestId);if(request.state!=='deployment-failed')throw new Error('Check status before retrying an uncertain outcome.');
        request.retries++;request.retrying=true;request.index=1;request.state=fixtures.retryTransitions[0];request.confirmed=false;return snapshot(request);
      }
    });
  }
  const publicationAdapter=live?live.publicationAdapter:createPublicationFixtureAdapter(JSON.parse($('#page-builder-publication-fixtures').content.textContent));
  // Live publication controls stay unavailable until the real adapter is connected.
  // Never expose the fixture simulator through an authenticated production editor.
  if(live){$('#history-heading').textContent='Version history';$('#history-heading').nextElementSibling.textContent='Inspect retained saved revisions without replacing your current draft.';historyRetry.textContent='Retry loading history';historyEmpty.textContent='No saved revisions are available.';historyFrame.title='Read-only saved revision preview';historyToggle.textContent='Version history';$('#delete-draft').textContent='Archive draft';publicationToggle.textContent='Publish and status';$('#publication-heading').textContent='Publish and status';publicationClose.textContent='Close publication status';publicationReviewButton.textContent='Review saved revision';publicationStartButton.textContent='Publish reviewed revision';publicationCheckButton.textContent='Check publication status';publicationRetryButton.textContent='Check deployment recovery';publicationScenarioInput.closest('label').hidden=true;$('#publication-scenario-help').hidden=true;$('#publication-heading').nextElementSibling.textContent='Owner publishing applies the reviewed saved revision. Unsaved edits remain private.';publicationLockNote.textContent='Editing is protected while publication is unresolved. Check status to confirm the outcome.';}
  const uid=()=>globalThis.crypto?.randomUUID?crypto.randomUUID().replaceAll('-',''):Array.from(crypto.getRandomValues(new Uint8Array(16)),value=>value.toString(16).padStart(2,'0')).join('');
  const node=(tag,attributes={},text='')=>{
    const element=document.createElement(tag);
    for(const [key,value]of Object.entries(attributes)){
      if(value===undefined||value===null)continue;
      if(key==='className')element.className=value;
      else if(key==='dataset'){for(const [name,data]of Object.entries(value))if(data!==undefined&&data!==null)element.dataset[name]=data;}
      else if(key==='checked'||key==='disabled'||key==='hidden'||key==='required')element[key]=value;
      else if(key==='value')element.value=value;
      else element.setAttribute(key,value);
    }
    if(text)element.textContent=text;return element;
  };
  const setStatus=(message,state='saved')=>{status.textContent=message;status.dataset.state=state;status.setAttribute('aria-live',state==='error'?'assertive':'polite');};
  const setHistoryStatus=(message,state='saved')=>{historyStatus.textContent=message;historyStatus.dataset.state=state;};
  function blockControl(block,field){
    const section=active?.sections.find(entry=>entry.blocks.some(candidate=>candidate.id===block?.id));
    return section&&block?sections.querySelector(`[data-section-card="${CSS.escape(section.id)}"] [data-block-id="${CSS.escape(block.id)}"][data-field="${field}"]`):null;
  }
  function invalidBlock(predicate){return active?.sections.flatMap(section=>section.blocks).find(predicate);}
  function fieldForError(message){
    if(/page title/i.test(message))return titleInput;
    if(/page address|address/i.test(message))return slugInput;
    if(/introduction/i.test(message))return introInput;
    if(/section title/i.test(message)){
      const section=active?.sections.find(entry=>typeof entry.title!=='string'||entry.title.length>160);
      return section&&sections.querySelector(`[data-section-card="${CSS.escape(section.id)}"] [data-field="title"][data-section-id]`);
    }
    if(/block title/i.test(message)){
      const block=invalidBlock(entry=>['heading','card','button'].includes(entry.type)&&(typeof entry.title!=='string'||!entry.title.trim()||entry.title.length>160));
      return blockControl(block,'title');
    }
    if(/image description/i.test(message)){
      const block=invalidBlock(entry=>['image','card'].includes(entry.type)&&(typeof entry.alt!=='string'||entry.alt.length>300||(entry.type==='image'&&!entry.alt.trim())));
      return blockControl(block,'alt');
    }
    if(/approved image/i.test(message)){
      const block=invalidBlock(entry=>entry.type==='image'&&(typeof entry.image!=='string'||!entry.image||!images.includes(entry.image))||entry.type==='card'&&entry.image!==undefined&&entry.image!==null&&(typeof entry.image!=='string'||!entry.image||!images.includes(entry.image)));
      return blockControl(block,'image');
    }
    if(/https link|\blink\b/i.test(message)){
      const block=invalidBlock(entry=>['card','button'].includes(entry.type)&&!window.ScavPageBuilderModel.safeLink(entry.href));
      return blockControl(block,'href');
    }
    if(/\btext\b/i.test(message)){
      const block=invalidBlock(entry=>['text','card'].includes(entry.type)&&(typeof entry.text!=='string'||entry.text.length>10000||(entry.type==='text'&&!entry.text.trim())));
      return blockControl(block,'text');
    }
    if(/layout/i.test(message))return sections.querySelector('[data-field^="layout."]');
    return null;
  }
  function associateError(field,id){
    if(!field)return;
    let state=errorState.get(field);
    if(!state){state={originalInvalid:field.getAttribute('aria-invalid'),originalDescriptions:new Set((field.getAttribute('aria-describedby')||'').split(/\s+/).filter(Boolean)),addedDescriptions:new Set()};errorState.set(field,state);}
    if(!state.originalDescriptions.has(id)){
      const descriptions=(field.getAttribute('aria-describedby')||'').split(/\s+/).filter(Boolean);
      if(!descriptions.includes(id)){descriptions.push(id);field.setAttribute('aria-describedby',descriptions.join(' '));state.addedDescriptions.add(id);}
    }
    field.setAttribute('aria-invalid','true');
  }
  function clearErrorAssociation(field,id){
    const state=field&&errorState.get(field);if(!state)return;
    if(state.addedDescriptions.delete(id)&&!state.originalDescriptions.has(id)){
      const descriptions=(field.getAttribute('aria-describedby')||'').split(/\s+/).filter(description=>description&&description!==id);
      if(descriptions.length)field.setAttribute('aria-describedby',descriptions.join(' '));else field.removeAttribute('aria-describedby');
    }
    if(state.addedDescriptions.size)return;
    if(state.originalInvalid===null)field.removeAttribute('aria-invalid');else field.setAttribute('aria-invalid',state.originalInvalid);
    errorState.delete(field);
  }
  function reportError(error,{prefix='',suffix='',focusTarget=null}={}){
    setStatus(`${prefix}${error.message}${suffix}`,'error');
    const field=fieldForError(error.message)||focusTarget;if(!field)return;
    associateError(field,'status');
    if(field.disabled)requestAnimationFrame(()=>field.focus());else field.focus();
  }
  function clearFieldError(field){clearErrorAssociation(field,'status');}
  function clearPreviewError(){
    if(previewErrorField)clearErrorAssociation(previewErrorField,'preview-error');
    previewErrorField=null;previewError.hidden=true;previewError.textContent='';
  }
  function renderHistoryList(){
    historyList.replaceChildren();
    for(const entry of historyVersions){
      const item=node('li'),control=node('button',{type:'button',dataset:{historyKey:entry.key},'aria-pressed':String(entry.key===historySelection)});
      control.append(node('span',{className:'pb-history-primary'},`Revision ${entry.revision} · ${entry.state}`),node('span',{className:'pb-history-secondary'},`${entry.savedAt} · ${entry.editorName}`));
      item.append(control);historyList.append(item);
    }
  }
  function historyValidationContext(page){
    return {images,existingPages:[{id:page.id,slug:page.slug}],currentPageId:page.id};
  }
  function selectHistoryRevision(entry){
    historySelection=entry.key;
    for(const control of historyList.querySelectorAll('[data-history-key]'))control.setAttribute('aria-pressed',String(control.dataset.historyKey===entry.key));
    historyDetail.hidden=false;historyRepair.hidden=true;historyRepair.textContent='';
    historyMetadata.textContent=`Revision ${entry.revision} · Saved ${entry.savedAt} · ${entry.editorName} · ${entry.state}`;
    try{
      const page=structuredClone(entry.page),context=historyValidationContext(page);
      historyFrame.srcdoc=Builder.document(page,{...context,css:cssText});
    }catch(error){
      historyFrame.srcdoc='';
      historyRepair.textContent=`Repair needed. ${live?"This saved":"This demonstration"} revision is invalid and was not rendered: ${error.message}`;
      historyRepair.hidden=false;
    }
  }
  async function loadHistory(){
    if(historyLoading)return;
    const request=++historyRequest;historyLoading=true;historyRetry.hidden=true;historyEmpty.hidden=true;historyDetail.hidden=true;historyList.replaceChildren();
    setHistoryStatus(live?'Loading saved history...':'Loading demonstration history...','loading');
    try{
      const versions=await historyAdapter.list();
      if(request!==historyRequest||historyPanel.hidden)return;
      historyVersions=versions;historyLoaded=true;
      if(!versions.length){historySelection=null;setHistoryStatus(live?'No saved revisions are available.':'No demonstration revisions are available.','saved');historyEmpty.hidden=false;return;}
      renderHistoryList();setHistoryStatus(`${versions.length} ${live?"saved":"demonstration"} revisions loaded. Select a revision to inspect its read-only preview.`,'saved');
      const selected=versions.find(entry=>entry.key===historySelection);if(selected)selectHistoryRevision(selected);
    }catch(error){
      if(request!==historyRequest||historyPanel.hidden)return;
      historyLoading=false;historyLoaded=false;setHistoryStatus(`${live?"Saved":"Demonstration"} history failed to load: ${error.message}`,'error');historyRetry.hidden=false;
    }finally{if(request===historyRequest)historyLoading=false;}
  }
  function closeHistory(){
    historyRequest++;historyLoading=false;historyPanel.hidden=true;historyToggle.setAttribute('aria-expanded','false');historyToggle.focus();
  }
  function publicationSavedRecord(){return active&&revision?records.find(record=>record.draft.id===active.id&&record.revision===revision):null;}
  function publicationReviewIsCurrent(){const record=publicationSavedRecord();return !!record&&!!publicationReview&&publicationReview.id===record.draft.id&&publicationReview.revision===record.revision&&publicationReview.editorFingerprint===JSON.stringify(active);}
  function publicationNeedsEditorLock(request=publicationRequest){return !!request&&(['publishing','repository-commit-recorded','deployment-pending','deployment-failed','outcome-unknown'].includes(request.state)||request.state==='published'&&request.confirmed!==true);}
  function publicationFinished(){return !publicationRequest||publicationRequest.state==='refused'||publicationRequest.state==='published'&&publicationRequest.confirmed===true;}
  function setPublicationError(message,focusTarget){publicationError=message;publicationErrorFocus=focusTarget;}
  function restorePublicationErrorFocus(){const target=publicationErrorFocus;publicationErrorFocus=null;if(!publicationError)return;if(target?.isConnected&&!target.disabled&&!target.hidden)target.focus();else publicationStatus.focus();}
  function setPublicationLock(locked){
    publicationLock=locked;publicationLockNote.hidden=!locked;
    const controls=document.querySelectorAll('#page-form input,#page-form select,#page-form textarea,#page-form [data-action],#new-page,#save-draft,#delete-draft,#export-html,#add-section,#draft-list button');
    if(locked){for(const control of controls){if(!publicationDisabled.has(control))publicationDisabled.set(control,control.disabled);control.disabled=true;}}
    else{for(const [control,disabled]of publicationDisabled)control.disabled=disabled;publicationDisabled.clear();}
  }
  function publicationMessage(){
    if(live){const request=publicationRequest;if(!request)return 'Review the saved revision before publishing. Publishing requires Owner permission.';return ({'outcome-unknown':'Publication outcome is not confirmed. Keep your entries and check status.','deployment-pending':'Repository commit recorded. Waiting for confirmed deployment.','deployment-failed':'Deployment failed. The repository commit is retained; check recovery status.','published':'Published: the exact commit and public page content are confirmed.','refused':'Publication stopped. Your saved draft is available for another review.'})[request.state]||'Publication is processing.';}
    if(!publicationRequest){
      if(publicationSavedRecord())return publicationReviewInvalidated?'Editor changed since the prior review. Review the exact saved revision again; unsaved editor changes are not included.':'Ready for review. This is a saved local revision; the demonstration will not publish it.';
      return active?'Save this page locally before reviewing an exact saved revision.':'Select a saved local draft to review an exact revision.';
    }
    const request=publicationRequest;
    if(request.state==='publishing')return 'Publishing demonstration in progress. No real publication action is occurring.';
    if(request.state==='repository-commit-recorded')return `Fixture recorded repository commit ${request.commitId}. Deployment is not confirmed; this does not establish that nothing was committed.`;
    if(request.state==='deployment-pending')return `Deployment is pending for saved revision ${request.revision}. The fixture has not confirmed publication yet.`;
    if(request.state==='published')return request.confirmed===true?`Published (fixture-confirmed) saved revision ${request.revision}. No live site was changed.`:'Deployment confirmation is missing for this revision. Check status before considering it complete.';
    if(request.state==='deployment-failed')return `Deployment failed after the fixture recorded commit ${request.commitId}. Do not assume nothing was committed. Check status or retry the failed deployment.`;
    if(request.state==='outcome-unknown')return `Outcome unknown for request ${request.requestId}; the fixture recorded commit ${request.commitId}. Check status before deciding what happened.`;
    return 'Ready for review.';
  }
  function renderPublication(){
    const record=publicationSavedRecord(),current=active?`${active.title||'Untitled page'}${revision?` · saved revision ${revision}`:' · not saved'}`:'No editor page is selected';
    if(!publicationRequest)publicationState=record?'ready-for-review':'not-reviewed';
    publicationCurrentDraft.textContent=`Editor: ${current}${dirty?' · unsaved editor changes are separate from the saved revision':''}`;
    publicationStatus.textContent=publicationError||publicationMessage();publicationStatus.dataset.state=publicationError?'error':publicationRequest?.state==='published'&&publicationRequest.confirmed!==true?'outcome-unknown':publicationRequest?.state||publicationState;
    publicationReviewButton.disabled=publicationInFlight||publicationReviewing||saving||publicationLock||!record;
    publicationStartButton.disabled=publicationInFlight||saving||publicationLock||!publicationReviewIsCurrent()||!publicationFinished()||!!live&&!live.canPublish;
    publicationScenarioInput.disabled=publicationInFlight||publicationLock||!publicationFinished();
    const canAdvance=!!publicationRequest&&['publishing','repository-commit-recorded','deployment-pending'].includes(publicationRequest.state);
    publicationNextButton.hidden=!!live||!canAdvance;publicationNextButton.disabled=publicationInFlight;
    const canCheck=!!publicationRequest&&(['deployment-pending','deployment-failed','outcome-unknown'].includes(publicationRequest.state)||publicationRequest.state==='published'&&publicationRequest.confirmed!==true);
    publicationCheckButton.hidden=!canCheck;publicationCheckButton.disabled=publicationInFlight;
    const canRetry=!!publicationRequest&&(publicationRequest.state==='deployment-failed'||live&&publicationRequest.state==='outcome-unknown'&&publicationRequest.own!==false);
    if(live)publicationRetryButton.textContent=publicationRequest?.state==='outcome-unknown'?'Recover interrupted publication':'Check deployment recovery';
    publicationRetryButton.hidden=!canRetry;publicationRetryButton.disabled=publicationInFlight;
    publicationReviewed.hidden=!publicationReview;
    if(publicationReview)publicationReviewed.textContent=`Reviewed saved revision ${publicationReview.revision} of “${publicationReview.title}” · SHA-256 ${publicationReview.digest.slice(0,16)}…${dirty?' · current editor has unsaved changes and is not part of this review':''}`;
    publicationRequestLabel.hidden=!publicationRequest;
    if(publicationRequest)publicationRequestLabel.textContent=live?`Publication ${publicationRequest.requestId} · saved revision ${publicationRequest.revision}${publicationRequest.commitId?' · commit '+publicationRequest.commitId:''}`:`Fixture request ${publicationRequest.requestId} · saved revision ${publicationRequest.revision} · ${publicationRequest.digest.slice(0,16)}…${publicationRequest.commitRecorded?` · fixture commit ${publicationRequest.commitId}`:''}${publicationRequest.retries?` · retry ${publicationRequest.retries} (same request ID)`:''}`;
    publicationEventsList.replaceChildren();
    for(const event of publicationEvents){const item=node('li',{className:'pb-publication-event',dataset:{state:event.state}},event.message);publicationEventsList.append(item);}
    publicationPreviewPanel.hidden=!publicationReview;
    publicationPreviewLabel.textContent=publicationReview?`Saved revision ${publicationReview.revision} · ${publicationReview.title} · SHA-256 ${publicationReview.digest}`:'';
  }
  function invalidatePublicationReview(){
    if(!publicationReview)return;
    publicationReview=null;publicationReviewInvalidated=true;publicationReviewFrame.srcdoc='';
    if(!publicationRequest)publicationState=publicationSavedRecord()?'ready-for-review':'not-reviewed';
    renderPublication();
  }
  function recordPublicationEvent(request,action){
    const names={publishing:'Publishing', 'repository-commit-recorded':'Repository commit recorded','deployment-pending':'Deployment pending',published:request.confirmed===true?'Published':'Deployment confirmation missing','deployment-failed':'Deployment failed','outcome-unknown':'Outcome unknown'};
    const state=request.state==='published'&&request.confirmed!==true?'outcome-unknown':request.state;
    publicationEvents.push({state,message:`${names[request.state]||request.state} · ${action} · request ${request.requestId} · saved revision ${request.revision}${request.state==='published'&&request.confirmed!==true?' · confirmation missing':''}`});
  }
  async function reviewSavedRevision(){
    if(publicationInFlight||publicationReviewing||publicationLock)return;
    const record=publicationSavedRecord();if(!record)return;
    publicationError='';publicationErrorFocus=null;
    const editorFingerprint=JSON.stringify(active),page=structuredClone(record.draft),reviewRevision=record.revision;
    publicationReviewing=true;renderPublication();publicationStatus.textContent='Preparing exact saved-revision preview...';publicationStatus.dataset.state='loading';
    try{
      const reviewed=await publicationAdapter.review({revision:reviewRevision,page}),validated=Builder.validate(reviewed.page,{images,existingPages,currentPageId:page.id});
      if(reviewed.revision!==reviewRevision)throw new Error('Fixture review returned a different saved revision.');
      const payload=JSON.stringify({revision:reviewed.revision,page:validated});
      const digestBytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(payload)),digest=Array.from(new Uint8Array(digestBytes),value=>value.toString(16).padStart(2,'0')).join('');
      if(active?.id!==page.id||revision!==reviewRevision||JSON.stringify(active)!==editorFingerprint){publicationReviewInvalidated=true;publicationReview=null;publicationReviewFrame.srcdoc='';setPublicationError('The editor changed while the saved revision was being reviewed. Review it again.',publicationReviewButton);return;}
      const context={images,existingPages,currentPageId:page.id,css:cssText};
      publicationReview={id:page.id,title:page.title,slug:page.slug,revision:reviewRevision,digest:live?reviewed.digest:digest,page:validated,editorFingerprint};
      publicationReviewInvalidated=false;publicationState='ready-for-review';publicationReviewFrame.srcdoc=live?reviewed.html:Builder.document(validated,context);renderPublication();
    }catch(error){setPublicationError(`Saved revision could not be reviewed: ${error.message}`,publicationReviewButton);}
    finally{publicationReviewing=false;renderPublication();restorePublicationErrorFocus();}
  }
  function updatePublicationRequest(request,action){
    publicationError='';publicationErrorFocus=null;publicationRequest=request;publicationState=request.state;recordPublicationEvent(request,action);
    setPublicationLock(publicationNeedsEditorLock(request));renderPublication();
    if(request.error){setPublicationError(request.error,publicationCheckButton);renderPublication();}
  }
  async function startPublication(){
    if(publicationInFlight||!publicationFinished()||live&&!live.canPublish)return;
    if(!publicationReviewIsCurrent()){setPublicationError('Review the exact saved revision again before starting this demonstration.',publicationStartButton);renderPublication();restorePublicationErrorFocus();return;}
    publicationError='';publicationErrorFocus=null;
    const review=publicationReview;publicationInFlight=true;publicationRequest=null;publicationEvents=[];publicationState='publishing';setPublicationLock(true);renderPublication();
    publicationStatus.textContent=live?'Submitting the reviewed saved revision...':'Starting fixture-only publication demonstration...';publicationStatus.dataset.state='loading';
    try{
      const request=await publicationAdapter.start({scenario:publicationScenario,revision:review.revision,digest:review.digest,pageId:review.id,title:review.title,slug:review.slug});
      updatePublicationRequest(request,'start');
    }catch(error){setPublicationLock(live?publicationNeedsEditorLock():false);publicationState='ready-for-review';setPublicationError(`${live?'Publication was not confirmed':'Demonstration did not start'}: ${error.message}`,publicationStartButton);}
    finally{publicationInFlight=false;renderPublication();restorePublicationErrorFocus();}
  }
  async function runPublicationAction(action){
    if(publicationInFlight||!publicationRequest)return;
    if(action==='retry'&&publicationRequest.state!=='deployment-failed'&&!(live&&publicationRequest.state==='outcome-unknown'&&publicationRequest.own!==false))return;
    const actionButton={advance:publicationNextButton,check:publicationCheckButton,retry:publicationRetryButton}[action];
    publicationError='';publicationErrorFocus=null;const requestId=publicationRequest.requestId;publicationInFlight=true;setPublicationLock(true);renderPublication();
    publicationStatus.textContent=live?'Checking confirmed publication status...':action==='check'?'Checking fixture status...':action==='retry'?'Retrying the fixture deployment with the same request ID...':'Advancing the fixture status...';publicationStatus.dataset.state='loading';
    try{updatePublicationRequest(await publicationAdapter[action](requestId),action);}
    catch(error){setPublicationError(`${live?"Publication":"Fixture"} ${action} failed: ${error.message}`,actionButton);}
    finally{publicationInFlight=false;setPublicationLock(publicationNeedsEditorLock());renderPublication();restorePublicationErrorFocus();}
  }
  function showPreviewError(error){
    const message=`Preview unavailable: ${error.message}`,field=fieldForError(error.message);
    if(previewErrorField!==field&&previewErrorField)clearErrorAssociation(previewErrorField,'preview-error');
    previewErrorField=field;if(field)associateError(field,'preview-error');
    if(previewError.textContent!==message)previewError.textContent=message;
    previewError.hidden=false;
  }
  const slugify=value=>value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80).replace(/-+$/,'')||'new-page';
  const layoutDefault=()=>({columns:1,align:'start',spacing:'normal',background:'none',border:false});
  function isDirty(){return !snapshot||JSON.stringify(active)!==snapshot;}
  function updateDirty(){
    dirty=isDirty();if(publicationReview&&JSON.stringify(active)!==publicationReview.editorFingerprint)invalidatePublicationReview();
    setStatus(dirty?(live?'Unsaved changes. Save Draft stores this page privately.':'Unsaved changes. Save Draft stores this page locally.'):'Saved draft loaded.',dirty?'unsaved':'saved');renderPublication();
  }
  function labelInput(parent,labelText,value,{type='text',maxLength,field,sectionId,blockId,wide=false,required=false,choices}={}){
    const label=node('label',wide?{className:'pb-wide'}:{});label.append(document.createTextNode(labelText));
    const input=choices?node('select',{dataset:{field,sectionId,blockId}}):node(type==='textarea'?'textarea':'input',{type:type==='textarea'?undefined:type,maxlength:maxLength,dataset:{field,sectionId,blockId},required});
    if(type==='textarea')input.rows=3;
    if(choices){for(const [choice,text]of choices)input.append(node('option',{value:String(choice)},text));}
    input.value=value??'';label.append(input);parent.append(label);return input;
  }
  function addToggle(parent,text,checked,{field,sectionId,blockId}={}){
    const label=node('label',{className:'pb-toggle'}),input=node('input',{type:'checkbox',checked,dataset:{field,sectionId,blockId}});label.append(input,document.createTextNode(text));parent.append(label);return input;
  }
  function button(text,action,{label=text,disabled=false,className=''}={}){
    return node('button',{type:'button',dataset:{action},'aria-label':label,disabled,className},text);
  }
  function updatePreview(){
    if(!active){clearPreviewError();preview.srcdoc='';return;}
    try{
      const output=Builder.document(active,{images,existingPages,currentPageId:existingPages.some(page=>page.id===active.id)?active.id:null,css:cssText});
      clearPreviewError();if(preview.srcdoc!==output)preview.srcdoc=output;
    }catch(error){if(preview.srcdoc)preview.srcdoc='';showPreviewError(error);}
  }
  function renderDraftList(){
    draftList.replaceChildren();$('#drafts-empty').hidden=records.length>0;
    for(const record of records){
      const item=node('li'),open=node('button',{type:'button','aria-current':active?.id===record.draft.id?'true':'false',dataset:{openId:record.draft.id}});
      open.append(node('span',{className:'pb-draft-title'},record.draft.title),node('span',{className:'pb-draft-address'},`/pages/${record.draft.slug} · revision ${record.revision}`));item.append(open);draftList.append(item);
    }
    if(publicationLock)setPublicationLock(true);
  }
  function renderBlock(section,block,index){
    const row=node('div',{className:'pb-block-row',dataset:{blockId:block.id}}),top=node('div',{className:'pb-block-top'}),actions=node('div',{className:'pb-block-actions'});
    top.append(node('h4',{},`${blockTypes.find(([type])=>type===block.type)?.[1]||'Block'} ${index+1}`));
    actions.append(button('Move up','move-block-up',{label:`Move block ${index+1} up`,disabled:index===0}),button('Move down','move-block-down',{label:`Move block ${index+1} down`,disabled:index===section.blocks.length-1}),button('Duplicate','duplicate-block',{label:`Duplicate block ${index+1}`}),button('Remove','remove-block',{label:`Remove block ${index+1}`,className:'pb-danger'}));
    top.append(actions);row.append(top);
    const fields=node('div',{className:'pb-block-fields'}),id=block.id;
    if(['heading','card','button'].includes(block.type))labelInput(fields,'Heading',block.title,{field:'title',blockId:id,maxLength:160,required:true,wide:block.type==='heading'});
    if(['text','card'].includes(block.type))labelInput(fields,'Text',block.text,{type:'textarea',field:'text',blockId:id,maxLength:10000,wide:true,required:block.type==='text'});
    if(block.type==='image'||block.type==='card'){
      if(block.type==='card')labelInput(fields,'Approved image',block.image||'',{field:'image',blockId:id,choices:[['','No image'],...images.map(image=>[image,image])],wide:true});
      else{
        const imageSelect=labelInput(fields,'Approved image',block.image||'',{field:'image',blockId:id,choices:[['','Choose an image'],...images.map(image=>[image,image])],wide:true,required:true});
        if(block.image&&!images.includes(block.image)){const missing=node('option',{value:block.image,disabled:true},`${block.image} (missing; choose a replacement)`);imageSelect.insertBefore(missing,imageSelect.options[1]||null);imageSelect.value=block.image;}
      }
      labelInput(fields,'Alternative text',block.alt||'',{field:'alt',blockId:id,maxLength:300,wide:true,required:block.type==='image'});
    }
    if(block.type==='button'||block.type==='card')labelInput(fields,'Link address',block.href||'',{field:'href',blockId:id,maxLength:500,wide:true,required:true});
    addToggle(fields,'Hidden from export',block.hidden,{field:'hidden',blockId:id});
    row.append(fields);return row;
  }
  function renderSections(){
    sections.replaceChildren();$('#sections-empty').hidden=!!active?.sections.length;
    if(!active)return;
    active.sections.forEach((section,index)=>{
      const headingId=`pb-section-title-${section.id}`,card=node('section',{className:'pb-section-card',dataset:{sectionCard:section.id},'aria-labelledby':headingId}),heading=node('div',{className:'pb-card-heading'}),actions=node('div',{className:'pb-card-actions'});
      heading.append(node('h3',{id:headingId},`Section ${index+1}${section.title?`: ${section.title}`:''}`));
      actions.append(button('Move up','move-section-up',{label:`Move section ${index+1} up`,disabled:index===0}),button('Move down','move-section-down',{label:`Move section ${index+1} down`,disabled:index===active.sections.length-1}),button('Rename','focus-section-title',{label:`Rename section ${index+1}`}),button('Remove','remove-section',{label:`Remove section ${index+1}`,className:'pb-danger'}));
      heading.append(actions);card.append(heading);
      const fields=node('div',{className:'pb-section-fields'});
      labelInput(fields,'Section title',section.title,{field:'title',sectionId:section.id,maxLength:160,wide:true});
      for(const [field,choices]of Object.entries(layoutChoices))labelInput(fields,field==='align'?'Alignment':field==='columns'?'Columns':field==='spacing'?'Spacing':'Background',section.layout[field],{field:`layout.${field}`,sectionId:section.id,choices});
      addToggle(fields,'Show border',section.layout.border,{field:'layout.border',sectionId:section.id});
      addToggle(fields,'Hidden from export',section.hidden,{field:'hidden',sectionId:section.id});
      card.append(fields);
      const blockList=node('div',{className:'pb-block-list','aria-label':`Blocks in section ${index+1}`});section.blocks.forEach((block,blockIndex)=>blockList.append(renderBlock(section,block,blockIndex)));
      card.append(blockList);
      const addRow=node('div',{className:'pb-add-block'}),addLabel=node('label');addLabel.append(document.createTextNode('Add content block'));
      const typeSelect=node('select',{dataset:{addType:section.id},'aria-label':`Block type for section ${index+1}`});for(const [value,label]of blockTypes)typeSelect.append(node('option',{value},label));
      addLabel.append(typeSelect);addRow.append(addLabel,button('Add block','add-block',{label:`Add selected block to section ${index+1}`}));card.append(addRow);sections.append(card);
    });
  }
  function renderEditor(){
    const enabled=!!active;
    for(const element of [titleInput,slugInput,introInput])element.disabled=!enabled;
    titleInput.value=active?.title||'';slugInput.value=active?.slug||'';introInput.value=active?.intro||'';
    saveButton.disabled=!enabled||saving;$('#export-html').disabled=!enabled||saving;$('#add-section').disabled=!enabled||saving;
    $('#delete-draft').hidden=!revision;$('#save-revision').textContent=revision?`Saved revision ${revision}`:'Not saved yet';
    renderSections();renderDraftList();updatePreview();if(publicationLock)setPublicationLock(true);renderPublication();
  }
  function emptyBlock(type){
    const block={id:uid(),type,hidden:false};
    if(['heading','card','button'].includes(type))block.title='';
    if(['text','card'].includes(type))block.text='';
    if(type==='button'||type==='card')block.href='';
    if(type==='image'||type==='card'){block.image=type==='image'?'':null;block.alt='';}
    return block;
  }
  function newPage(){
    let slug='new-page',suffix=2;while(records.some(record=>record.draft.slug===slug))slug=`new-page-${suffix++}`;
    invalidatePublicationReview();
    active={id:uid(),title:'New page',slug,intro:'',sections:[]};revision=null;snapshot=null;slugEdited=false;dirty=true;
    renderEditor();setStatus('New page. Changes are not saved yet.','unsaved');titleInput.focus();
  }
  function canLeave(){return !dirty||window.confirm('Discard your unsaved changes?');}
  async function setRecord(record){
    if(!canLeave())return;
    const opening=++recordRequest,before=JSON.stringify(active);
    if(live&&record.summary){try{record=await live.load(record.draft.id);if(opening!==recordRequest)return;if(JSON.stringify(active)!==before){setStatus('Your editor changed while loading. Changes are preserved; select the draft again when ready.','unsaved');return;}const index=records.findIndex(value=>value.draft.id===record.draft.id);records[index]=record;}catch(error){reportError(error);return;}}
    historyRequest++;historyLoading=false;historyLoaded=false;historyVersions=[];historySelection=null;if(live){historyPanel.hidden=true;historyToggle.setAttribute('aria-expanded','false');historyList.replaceChildren();historyDetail.hidden=true;historyFrame.srcdoc='';}
    invalidatePublicationReview();
    active=structuredClone(record.draft);revision=record.revision;snapshot=JSON.stringify(active);dirty=false;slugEdited=true;
    if(live){setPublicationLock(false);publicationRequest=record.publication||null;}
    renderEditor();if(live)setPublicationLock(publicationNeedsEditorLock());setStatus(`Opened saved draft at revision ${revision}.`,'saved');titleInput.focus();
  }
  function move(list,index,delta){const next=index+delta;if(next<0||next>=list.length)return;[list[index],list[next]]=[list[next],list[index]];}
  function restoreSectionFocus(sectionId){
    const card=sectionId?sections.querySelector(`[data-section-card="${CSS.escape(sectionId)}"]`):null;
    const target=card?.querySelector('.pb-section-fields input:not([type=checkbox]),.pb-section-fields select')||card?.querySelector('.pb-card-actions button:not(:disabled)')||$('#add-section');
    requestAnimationFrame(()=>target.focus());
  }
  function restoreBlockFocus(sectionId,blockIndex){
    const card=sectionId?sections.querySelector(`[data-section-card="${CSS.escape(sectionId)}"]`):null;
    const row=blockIndex===null||blockIndex===undefined?null:card?.querySelectorAll('.pb-block-row')[blockIndex];
    const target=row?.querySelector('.pb-block-fields input:not([type=checkbox]),.pb-block-fields textarea,.pb-block-fields select')||row?.querySelector('.pb-block-actions button:not(:disabled)')||card?.querySelector('.pb-add-block select')||$('#add-section');
    requestAnimationFrame(()=>target.focus());
  }
  function syncField(target){
    const {field,sectionId,blockId}=target.dataset;if(!field)return;
    clearFieldError(target);
    if(field==='title'&&!sectionId&&!blockId){active.title=target.value;if(!slugEdited){active.slug=slugify(target.value);slugInput.value=active.slug;}}
    else if(field==='slug'){active.slug=target.value;slugEdited=true;}
    else if(field==='intro')active.intro=target.value;
    else if(sectionId){const section=active.sections.find(entry=>entry.id===sectionId);if(!section)return;if(field.startsWith('layout.')){const key=field.slice(7);section.layout[key]=key==='columns'?Number(target.value):key==='border'?target.checked:target.value;}else section[field]=target.type==='checkbox'?target.checked:target.value;}
    else if(blockId){const block=active.sections.flatMap(section=>section.blocks).find(entry=>entry.id===blockId);if(!block)return;block[field]=target.type==='checkbox'?target.checked:target.value;if(field==='image'&&block.type==='card'&&!target.value)block.image=null;}
    updateDirty();renderDraftList();updatePreview();
    if(sectionId&&field==='title'){const sectionIndex=active.sections.findIndex(section=>section.id===sectionId),card=sections.querySelector(`[data-section-card="${CSS.escape(sectionId)}"] h3`);if(card)card.textContent=`Section ${sectionIndex+1}${target.value?`: ${target.value}`:''}`;}
  }
  async function api(path,options={}){
    if(live)return live.api(path,options);
    const headers={'X-Scav-Session':token,...options.headers};
    const response=await fetch(path,{...options,headers});let result={};try{result=await response.json();}catch{}
    if(!response.ok)throw Object.assign(new Error(result.error||`Local service returned ${response.status}.`),{status:response.status});return result;
  }
  async function loadDrafts(){
    retry.hidden=true;setStatus('Loading private local drafts...','loading');
    try{
      if(live){await live.ready;const data=await api('/api/pages');records=data.pages;existingPages=data.existingPages;images=data.imageChoices;cssText=await fetch('page-builder.css').then(response=>response.text());renderDraftList();renderPublication();setStatus('Choose a saved page or create a new one. Drafts save privately.','saved');return;}
      const session=await fetch('/api/session').then(async response=>{if(!response.ok)throw new Error('The local draft service is unavailable.');return response.json();});
      if(session.mode!=='local'||typeof session.token!=='string')throw new Error('Unexpected local session response.');token=session.token;
      const data=await api('/api/pages');records=data.pages;existingPages=records.map(record=>({id:record.draft.id,slug:record.draft.slug}));images=data.imageChoices;cssText=await fetch('/page-builder.css').then(async response=>{if(!response.ok)throw new Error('Could not load preview styles.');return response.text();});
      renderPublication();
      if(!active){renderDraftList();setStatus(records.length?'Choose a saved page or create a new one.':'No saved drafts yet. Create a page to begin.','saved');}
      else{renderDraftList();setStatus(dirty?'Saved list refreshed. Your unsaved editor content remains on screen.':'Saved list refreshed. The open draft is unchanged.',dirty?'unsaved':'saved');}
    }catch(error){setStatus(`Could not load local drafts: ${error.message}`,'error');retry.hidden=false;}
  }
  async function saveDraft(){
    if(!active||saving)return;
    active.title=titleInput.value;active.slug=slugInput.value;active.intro=introInput.value;
    const duplicate=records.find(record=>record.draft.slug===active.slug&&record.draft.id!==active.id);
    if(duplicate){reportError(new Error('A saved draft already uses this address. Choose another address.'));return;}
    let page;try{page=Builder.validate(active,{images,existingPages,currentPageId:existingPages.some(entry=>entry.id===active.id)?active.id:null});}catch(error){reportError(error);return;}
    saving=true;saveButton.disabled=true;setStatus('Saving private draft...','saving');
    try{
      const body=revision?{action:'save',id:active.id,revision,page}:{action:'create',page};
      const result=await api('/api/pages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),record=result.record;
      invalidatePublicationReview();
      active=structuredClone(record.draft);revision=record.revision;snapshot=JSON.stringify(active);dirty=false;
      const existing=records.findIndex(entry=>entry.draft.id===active.id);if(existing<0)records.push(record);else records[existing]=record;
      existingPages=records.map(entry=>({id:entry.draft.id,slug:entry.draft.slug}));
      renderEditor();setStatus(`${live?'Saved privately':'Saved locally'} at revision ${revision}. This draft is not published.`,'saved');
    }catch(error){reportError(error,{prefix:'Save failed: ',suffix:' Your edits are still on screen; the last saved draft was preserved.',focusTarget:saveButton});}
    finally{saving=false;saveButton.disabled=!active||publicationLock;renderPublication();}
  }
  async function deleteDraft(){
    if(!active)return;
    const deletingId=active.id;
    if(revision){if(!canLeave())return;if(!window.confirm(live?`Archive "${active.title}" privately? Saved history remains stored.`:`Delete the saved draft "${active.title}"? This cannot be undone.`))return;}
    else if(!window.confirm('Discard this unsaved page?'))return;
    if(!revision){active=null;dirty=false;snapshot=null;renderEditor();setStatus('Unsaved page discarded.','saved');$('#new-page').focus();return;}
    setStatus('Deleting local draft...','saving');
    try{await api('/api/pages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'delete',id:deletingId,revision})});invalidatePublicationReview();records=records.filter(record=>record.draft.id!==deletingId);existingPages=records.map(record=>({id:record.draft.id,slug:record.draft.slug}));active=null;revision=null;snapshot=null;dirty=false;renderEditor();setStatus(live?'Draft archived. Saved revisions are retained.':'Saved draft deleted.','saved');(draftList.querySelector('button')||$('#new-page')).focus();}
    catch(error){reportError(error,{prefix:'Delete failed: ',suffix:' The saved draft remains available.',focusTarget:$('#delete-draft')});}
  }
  async function exportHtml(){
    if(!active)return;
    try{
      const page=Builder.document(active,{images,existingPages,currentPageId:existingPages.some(entry=>entry.id===active.id)?active.id:null,css:cssText}),blob=new Blob([page],{type:'text/html;charset=utf-8'}),url=URL.createObjectURL(blob),anchor=node('a',{href:url,download:`${slugify(active.slug)}.html`});
      document.body.append(anchor);anchor.click();anchor.remove();URL.revokeObjectURL(url);setStatus('HTML downloaded locally. This did not publish or deploy a website.','saved');
    }catch(error){reportError(error,{prefix:'Export failed: ',suffix:' Your saved draft is unchanged.',focusTarget:$('#export-html')});}
  }
  $('#page-form').addEventListener('input',event=>syncField(event.target));
  $('#page-form').addEventListener('change',event=>syncField(event.target));
  $('#page-form').addEventListener('submit',event=>event.preventDefault());
  $('#page-title').dataset.field='title';$('#page-slug').dataset.field='slug';$('#page-intro').dataset.field='intro';
  historyToggle.addEventListener('click',()=>{
    if(!historyPanel.hidden){closeHistory();return;}
    historyPanel.hidden=false;historyToggle.setAttribute('aria-expanded','true');
    if(!historyLoaded)loadHistory();
  });
  publicationToggle.addEventListener('click',()=>{
    if(!publicationPanel.hidden){publicationPanel.hidden=true;publicationToggle.setAttribute('aria-expanded','false');publicationToggle.focus();return;}
    publicationPanel.hidden=false;publicationToggle.setAttribute('aria-expanded','true');renderPublication();publicationClose.focus();
  });
  publicationClose.addEventListener('click',()=>{publicationPanel.hidden=true;publicationToggle.setAttribute('aria-expanded','false');publicationToggle.focus();});
  publicationScenarioInput.addEventListener('change',()=>{
    if(publicationRequest&&!(publicationRequest.state==='published'&&publicationRequest.confirmed===true)){publicationScenarioInput.value=publicationScenario;return;}
    publicationScenario=publicationScenarioInput.value;
  });
  publicationReviewButton.addEventListener('click',reviewSavedRevision);
  publicationStartButton.addEventListener('click',startPublication);
  publicationNextButton.addEventListener('click',()=>runPublicationAction('advance'));
  publicationCheckButton.addEventListener('click',()=>runPublicationAction('check'));
  publicationRetryButton.addEventListener('click',()=>runPublicationAction('retry'));
  $('#history-close').addEventListener('click',closeHistory);
  historyRetry.addEventListener('click',loadHistory);
  historyList.addEventListener('click',event=>{
    const control=event.target.closest('[data-history-key]');if(!control)return;
    const entry=historyVersions.find(version=>version.key===control.dataset.historyKey);if(entry)selectHistoryRevision(entry);
  });
  draftList.addEventListener('click',event=>{const control=event.target.closest('[data-open-id]');if(control){const record=records.find(entry=>entry.draft.id===control.dataset.openId);if(record)setRecord(record);}});
  $('#new-page').addEventListener('click',()=>{if(canLeave())newPage();});
  $('#refresh-drafts').addEventListener('click',loadDrafts);
  $('#retry').addEventListener('click',loadDrafts);
  $('#save-draft').addEventListener('click',saveDraft);
  $('#delete-draft').addEventListener('click',deleteDraft);
  $('#export-html').addEventListener('click',exportHtml);
  $('#add-section').addEventListener('click',()=>{if(!active)return;active.sections.push({id:uid(),title:'',hidden:false,layout:layoutDefault(),blocks:[]});renderSections();updateDirty();updatePreview();sections.lastElementChild?.querySelector('input')?.focus();});
  sections.addEventListener('click',event=>{
    const control=event.target.closest('[data-action]');if(!control||!active)return;
    const card=control.closest('[data-section-card]'),sectionId=card?.dataset.sectionCard,sectionIndex=active.sections.findIndex(section=>section.id===sectionId),section=active.sections[sectionIndex];
    const blockRow=control.closest('.pb-block-row'),blockIndex=blockRow?[...blockRow.parentElement.children].indexOf(blockRow):-1;
    let focusSectionId=null,focusBlockIndex=null,focusSection=false,focusBlock=false;
    if(control.dataset.action.startsWith('move-section')){move(active.sections,sectionIndex,control.dataset.action==='move-section-up'?-1:1);focusSectionId=sectionId;focusSection=true;}
    else if(control.dataset.action==='remove-section'){
      if(!window.confirm(`Remove section ${sectionIndex+1} and its blocks?`))return;
      active.sections.splice(sectionIndex,1);focusSectionId=active.sections[sectionIndex]?.id||active.sections[sectionIndex-1]?.id||null;focusSection=true;
    }
    else if(control.dataset.action==='focus-section-title'){card.querySelector('[data-field="title"][data-section-id]')?.focus();return;}
    else if(control.dataset.action.startsWith('move-block')){const delta=control.dataset.action==='move-block-up'?-1:1;move(section.blocks,blockIndex,delta);focusBlockIndex=blockIndex+delta;focusBlock=true;}
    else if(control.dataset.action==='duplicate-block'){const duplicate=structuredClone(section.blocks[blockIndex]);duplicate.id=uid();section.blocks.splice(blockIndex+1,0,duplicate);focusBlockIndex=blockIndex+1;focusBlock=true;}
    else if(control.dataset.action==='remove-block'){
      if(!window.confirm(`Remove block ${blockIndex+1}?`))return;
      section.blocks.splice(blockIndex,1);focusBlockIndex=Math.min(blockIndex,section.blocks.length-1);focusBlock=true;
    }
    else if(control.dataset.action==='add-block'){const type=card.querySelector(`[data-add-type="${CSS.escape(sectionId)}"]`).value;focusBlockIndex=section.blocks.length;section.blocks.push(emptyBlock(type));focusBlock=true;}
    renderSections();updateDirty();updatePreview();
    if(focusBlock)restoreBlockFocus(sectionId,focusBlockIndex);else if(focusSection)restoreSectionFocus(focusSectionId);
  });
  $('#desktop-view').addEventListener('click',()=>{preview.dataset.mode='desktop';$('#desktop-view').setAttribute('aria-pressed','true');$('#mobile-view').setAttribute('aria-pressed','false');});
  $('#mobile-view').addEventListener('click',()=>{preview.dataset.mode='mobile';$('#desktop-view').setAttribute('aria-pressed','false');$('#mobile-view').setAttribute('aria-pressed','true');});
  window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
  loadDrafts();
})();
