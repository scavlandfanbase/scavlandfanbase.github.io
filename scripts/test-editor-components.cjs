const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {html}=require('./preview-editor-components.cjs');const root=path.resolve(__dirname,'..');
(async()=>{const browser=await chromium.launch({headless:true,channel:'msedge'});try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];let calls=0;
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{const url=new URL(route.request().url());assert.equal(url.hostname,'local.test');assert.equal(route.request().method(),'GET');if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:html});const file=path.join(root,url.pathname);return fs.existsSync(file)?route.fulfill({path:file}):route.fulfill({status:404,body:''});});
 await page.goto('http://local.test/');
 // Canonical IDs, independent copies, duplicate-name handling, invalid IDs and dangling links.
 assert.deepEqual(await page.evaluate(()=>{
  const source=[{id:'one',name:'Same',stats:{damage:1}},{id:'two',name:'Same',stats:{damage:9}}],catalog=ScavEditor.catalog(source);
  source[0].stats.damage=200;const returned=catalog.resolve('one');returned.stats.damage=99;
  let duplicate=false,missing=false;try{ScavEditor.catalog([{id:'x'},{id:'x'}]);}catch{duplicate=true;}try{ScavEditor.catalog([{name:'missing'}]);}catch{missing=true;}
  return [catalog.resolve('one').stats.damage,catalog.resolve('two').stats.damage,catalog.resolve('gone'),duplicate,missing];
 }),[1,9,null,true,true]);
 await page.locator('#demo-record').click();
 assert.equal(await page.getByRole('dialog').getByRole('button',{name:'Use selected record',exact:true}).isDisabled(),true);
 await page.getByLabel('Search records',{exact:true}).fill('example bandage');
 assert.equal(await page.locator('.scav-record-choice').count(),2);
 await page.locator('[data-record-id="example-bandage-second"]').click();
 await page.getByRole('button',{name:'Use selected record',exact:true}).click();await page.getByRole('dialog').waitFor({state:'detached'});
 assert.equal(await page.locator('#demo-result').getAttribute('data-selected-id'),'example-bandage-second');
 await page.locator('#demo-record').click();await page.getByLabel('Verification',{exact:true}).selectOption('verified');assert.equal(await page.locator('.scav-record-choice').count(),1);
 await page.getByLabel('Verification',{exact:true}).selectOption('attention');assert.equal(await page.locator('.scav-record-choice').count(),3);
 await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0,'Filter-only changes should close without discard');
 await page.evaluate(()=>ScavEditor.recordPicker({records:[{id:'archived',name:'Archived',archived:true},{id:'active',name:'Active'}],currentId:'archived',settings:{schemaVersion:1,current_patch_id:'x'},onSelect:()=>{}}));
 assert.equal(await page.locator('.scav-record-choice').count(),1);assert.equal(await page.getByRole('button',{name:'Use selected record'}).isDisabled(),true);await page.keyboard.press('Escape');
 // Image browsing isn't an edit; selecting an image is, and keeps keyboard focus.
 await page.locator('#demo-image').click();await page.getByLabel('Search images',{exact:true}).fill('missing');assert.equal(await page.getByText('No images match.',{exact:true}).count(),1);await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);
 await page.locator('#demo-image').click();await page.getByRole('button',{name:'images/scavland-banner.jpg.png',exact:true}).click();
 assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-pressed')),'true');await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),1);await page.getByRole('button',{name:'Discard changes',exact:true}).click();
 await page.locator('#demo-image').click();await page.getByRole('button',{name:'images/scavland-banner.jpg.png',exact:true}).click();await page.getByRole('button',{name:'Use Image',exact:true}).click();await page.getByRole('dialog').waitFor({state:'detached'});
 // Retrying keeps the form, and pending async work makes its body inert, not absent from FormData.
 await page.locator('#demo-failure').click();const save=page.getByRole('dialog').getByRole('button',{name:'Save changes',exact:true});assert.equal(await save.isDisabled(),true);
 await page.getByLabel('Name',{exact:true}).fill('Retained after failure');await save.click();
 assert.equal(await page.locator('.scav-dialog-body').evaluate(el=>el.inert),true);await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),1);
 await page.getByRole('button',{name:'Retry',exact:true}).waitFor();assert.equal(await page.getByLabel('Name',{exact:true}).inputValue(),'Retained after failure');await page.getByRole('button',{name:'Retry',exact:true}).click();await page.getByRole('dialog').waitFor({state:'detached'});
 assert.equal(await page.locator('#demo-result').textContent(),'Example name: Retained after failure');
 // Programmatic changes can enable a changed-only dialog (e.g. image choices).
 await page.evaluate(()=>{window.programmatic=scavEditorDialog({title:'Programmatic',changedOnly:true,build:()=>{},onSubmit:()=>{}});programmatic.setDirty();});
 assert.equal(await page.getByRole('button',{name:'Save changes',exact:true}).isEnabled(),true);await page.getByRole('button',{name:'Save changes',exact:true}).click();
 // Shared confirmation is explicit and cannot write without the caller's callback.
 await page.evaluate(()=>{window.confirmed=0;ScavEditor.confirm({title:'Delete example?',message:'Example only',onConfirm:()=>{window.confirmed++;}});});
 await page.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(await page.evaluate(()=>confirmed),0);
 await page.evaluate(()=>ScavEditor.confirm({title:'Delete example?',onConfirm:()=>{window.confirmed++;}}));await page.getByRole('button',{name:'Delete',exact:true}).click();assert.equal(await page.evaluate(()=>confirmed),1);
 // Large lists remain searchable without rendering every result at once.
 await page.evaluate(()=>ScavEditor.recordPicker({records:Array.from({length:80},(_,i)=>({id:'record-'+i,name:'Record '+i})),settings:{schemaVersion:1,current_patch_id:'x'},onSelect:()=>{}}));
 assert.equal(await page.locator('.scav-record-choice').count(),50);await page.getByRole('button',{name:'Show more records',exact:true}).click();assert.equal(await page.locator('.scav-record-choice').count(),80);await page.keyboard.press('Escape');
 assert.match(await page.locator('#demo-verification').textContent(),/Never/);assert.match(await page.locator('#demo-verification').textContent(),/Unknown \(legacy evidence\)/);assert.match(await page.locator('#demo-verification').textContent(),/Example reviewer/);
 const output=process.env.SCAVLAND_TEST_OUTPUT;if(output)fs.mkdirSync(output,{recursive:true});
 for(const width of [320,390,768,1280]){
  await page.setViewportSize({width,height:900});await page.locator('#demo-record').click();
  assert.equal(await page.getByRole('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth&&el.getBoundingClientRect().right<=innerWidth),true);
  if(output&&[390,1280].includes(width))await page.screenshot({path:path.join(output,'record-picker-'+width+'.png')});
  for(let i=0;i<14;i++){await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>!!document.activeElement.closest('dialog')),true);}
  await page.keyboard.press('Escape');assert.equal(await page.locator('#demo-record').evaluate(el=>el===document.activeElement),true);
 }
 assert.deepEqual(errors,[]);console.log('PASS: shared image/search/confirmation/verification, pending-save inertness, retry retention, focus/mobile layout, stable-ID selection, duplicate names, archived/dangling IDs, independent catalogue snapshots, pagination. No writes or external requests.');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1});
