// Confirmed private type corrections; no production services or data writes.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {chromium}=require('playwright'),Items=require('../item-model.cjs'),Types=require('../attachment-model.js'),Catalogue=require('../shared-catalogue.js');
const {createServer,createStore}=require('./page-builder-server.cjs');
const settings={schemaVersion:1,current_patch_id:'0.7.2'};
const record={id:'stable-ammo',name:'Ammo fixture',contentType:'Item',classification:['ammunition','vendor-item'],category:null,description:'Recorded facts',properties:{damage:0,unknown:null},source:{file:'evidence-inbox/proof.png'},estimatedPrice:350};
const source={schemaVersion:1,data:[record]},state={...Items.foundation(source),revision:0},before=JSON.stringify(state);
const apply=(input,extra)=>Items.mutate(input,{action:'classify',id:record.id,revision:input.revision,confirmId:record.id,...extra},{settings}).state;
const ammo=apply(state,{contentType:'Ammo'});
assert.equal(ammo.data[0].id,record.id);assert.equal(Types.describe(ammo.data[0]).conflict,false);
assert.deepEqual(ammo.data[0].classification,['vendor-item','ammunition']);assert.deepEqual(ammo.data[0].properties,record.properties);assert.deepEqual(ammo.data[0].source,record.source);
const junk=apply(ammo,{contentType:'Item',category:'Junk'});
assert.equal(junk.data[0].category,'Junk');assert.deepEqual(junk.data[0].classification,['vendor-item','item','junk-item']);
const facet={id:record.id,name:record.name,damage:0,penetrationPercent:null};
const view=Catalogue.create({items:junk.data,ammo:[facet]});assert.equal(view.category('ammo').length,0);assert.deepEqual(view.item(record.id).specialists.ammo,facet);
const returned=apply(junk,{contentType:'Ammo'});assert.equal(Catalogue.create({items:returned.data,ammo:[facet]}).category('ammo').length,1);assert(!returned.data[0].classification.includes('junk-item'));
for(const type of ['Weapon','Armour','Ammo','Blueprint']){const result=apply(state,{contentType:type});assert.equal(result.data[0].id,record.id);assert.deepEqual(result.data[0].properties,record.properties);assert.equal(result.data[0].contentType,type);}
assert.throws(()=>Items.mutate(state,{action:'classify',id:record.id,revision:0,contentType:'Ammo'},{settings}),/Confirm/);
assert.throws(()=>apply(state,{contentType:'Invented'}),/recognised/);assert.throws(()=>Items.mutate(ammo,{action:'classify',id:record.id,revision:0,contentType:'Item',confirmId:record.id},{settings}),/another window/);
assert.equal(JSON.stringify(state),before);
(async()=>{
 const {createCore}=await import('../supabase/functions/admin-drafts/core.mjs'),{createProductionHandler}=await import('../supabase/functions/admin-drafts/production.mjs');
 const env=k=>({SUPABASE_URL:'https://fixture.invalid',SUPABASE_ANON_KEY:'public-fixture',SUPABASE_SERVICE_ROLE_KEY:'service-fixture',ADMIN_CORE_ENABLED:'true',DRAFT_PUBLISH_ENABLED:'true'})[k];
 let allowed=new Set(['items_edit']),preparations=0;
 const fetcher=async(url,options={})=>{const name=new URL(url).pathname.split('/').at(-1),body=options.body?JSON.parse(options.body):{};
  if(name==='user')return Response.json({id:'00000000-0000-4000-8000-000000000001'});
  if(name==='scavland_draft')return Response.json({draft:null,currentVersion:0});
  if(name==='has_scavland_permission')return Response.json(allowed.has(body.required_permission));
  if(name==='scavland_prepare'){if(!body.p_payload)return Response.json(null);preparations++;return Response.json({payload:body.p_payload,base:body.p_base});}
  throw Error('Unexpected transport '+name);
 };
 const core=createCore({env,fetcher});core.read=async()=>({source,base:{'data/items.json':'fixture-sha'},settings,images:[]});
 const handler=createProductionHandler({env,fetcher,core});
 const request=action=>handler(new Request('https://fixture.invalid',{method:'POST',headers:{Authorization:'Bearer reviewer-fixture','Content-Type':'application/json'},body:JSON.stringify({domain:'items',entityId:'catalogue',action,expectedVersion:0,requestId:'00000000-0000-4000-8000-000000000002',command:{action:'classify',id:record.id,revision:0,confirmId:record.id,contentType:'Ammo'}})}));
 assert.equal((await request('prepare')).status,403);assert.equal(preparations,0);
 allowed.add('ammunition_edit');const response=await request('prepare');assert.equal(response.status,200);assert.equal((await response.json()).payload.catalogue.data[0].contentType,'Ammo');assert.equal(preparations,1);
 assert.equal((await request('publish')).status,403,'Reviewer cannot publish');
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'scav-type-correction-'));fs.writeFileSync(path.join(directory,'items.json'),JSON.stringify(state));const server=createServer({directory,itemMode:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{const base='http://127.0.0.1:'+server.address().port;browser=await chromium.launch({headless:true,channel:'msedge'});const context=await browser.newContext(),page=await context.newPage();await context.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());await page.goto(base);await page.locator('#workspace').waitFor();
  const dialog=()=>page.getByRole('dialog');await page.locator('#item-classify').click();await dialog().getByLabel('Content Type',{exact:true}).selectOption('Ammo');assert(await dialog().getByRole('button',{name:'Save private draft',exact:true}).isDisabled());await dialog().getByLabel('Confirm category change',{exact:true}).selectOption('yes');await dialog().getByRole('button',{name:'Save private draft',exact:true}).click();await dialog().waitFor({state:'hidden'});assert.equal(createStore(directory,{itemMode:true}).read().data[0].contentType,'Ammo');assert(!await page.locator('#facts').innerText().then(t=>t.includes('Classification Conflict')));
  await page.locator('#item-classify').click();await dialog().getByLabel('Content Type',{exact:true}).selectOption('Junk');await dialog().getByLabel('Confirm category change',{exact:true}).selectOption('yes');await dialog().getByRole('button',{name:'Save private draft',exact:true}).click();await dialog().waitFor({state:'hidden'});assert.equal(createStore(directory,{itemMode:true}).read().data[0].category,'Junk');assert(await page.locator('#item-edit').isEnabled());await page.getByLabel('Category',{exact:true}).selectOption('value:Junk');assert.equal(await page.locator('.item-choice').count(),1);
  const root=path.resolve(__dirname,'..');let publicItems=junk.data;
  await page.route('http://public.test/**',route=>{const pathname=new URL(route.request().url()).pathname;
   const fixtures={'/data/items.json':{schemaVersion:1,data:publicItems},'/data/ammo.json':{schemaVersion:1,data:[facet]},'/data/armour.json':{schemaVersion:1,data:[]},'/data/weapons.json':{schemaVersion:1,data:[]},'/data/crafting.json':{schemaVersion:1,data:[]},'/data/vendors.json':{schemaVersion:1,data:[]},'/data/verification-settings.json':settings};
   if(fixtures[pathname])return route.fulfill({json:fixtures[pathname]});const file=path.join(root,pathname);return fs.existsSync(file)&&fs.statSync(file).isFile()?route.fulfill({path:file}):route.fulfill({status:404,body:''});
  });
  await page.goto('http://public.test/items.html');await page.locator('.category-card[data-category="junk-item"]').click();assert.equal(await page.locator('.item-card').count(),1);assert(!(await page.locator('.item-card').innerText()).includes('Damage'));
  publicItems=[{...ammo.data[0],name:'Renamed ammo fixture'}];await page.reload();await page.locator('.category-card[data-category="ammunition"]').click();assert((await page.locator('.item-card').innerText()).includes('Damage'));assert((await page.locator('.item-card').innerText()).includes('Renamed ammo fixture'));
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));fs.rmSync(directory,{recursive:true,force:true});}
 console.log('PASS confirmed Item/Ammo/Armour/Weapon/Blueprint and Junk corrections: stable identity, retained stats/evidence, category membership, stale/invalid rejection, category permissions, Reviewer publish denial and browser save/filter behavior.');
})().catch(error=>{console.error(error);process.exitCode=1;});
