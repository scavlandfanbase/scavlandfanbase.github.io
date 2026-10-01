// Single-operator loopback draft service. Never connects to GitHub or Supabase.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const Pages=require('../page-model.js'),PageBuilderModel=require('../page-builder-model.js');
const root=path.resolve(__dirname,'..');
const staticFiles=new Set(['page-builder.html','page-builder.js','page-builder.css','page-builder-model.js','page-builder-contract.js']);
const contentTypes={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp'};
const error=(message,status=400)=>Object.assign(new Error(message),{status});
function createStore(directory,{vendorMode=false,itemMode=false,ammoMode=false}={}){
  directory=path.resolve(directory);
  if(directory===root||directory.startsWith(root+path.sep))throw error('Private drafts must be outside the website repository.');
  fs.mkdirSync(directory,{recursive:true,mode:0o700});
  const actual=fs.realpathSync(directory),actualRoot=fs.realpathSync(root);
  if(actual===actualRoot||actual.startsWith(actualRoot+path.sep))throw error('Private drafts must be outside the website repository.');
  const file=path.join(directory,ammoMode?'ammo.json':itemMode?'items.json':vendorMode?'vendors.json':'pages.json');
  const imageChoices=()=>{
    if(vendorMode||itemMode||ammoMode)return [];
    const inventory=JSON.parse(fs.readFileSync(path.join(root,'data/site-images.json'),'utf8'));
    return [...new Set(Object.values(inventory.categories||{}).flatMap(category=>category.images||[]))].filter(name=>{
      if(!name.startsWith('images/')||!Pages.image(name))return false;
      const target=path.resolve(root,name),imageRoot=path.join(root,'images');
      return target.startsWith(imageRoot+path.sep)&&fs.existsSync(target)&&fs.statSync(target).isFile()&&fs.realpathSync(target).startsWith(fs.realpathSync(imageRoot)+path.sep);
    });
  };
  const validatePage=(page,existingPages,currentPageId)=>{
    try{return PageBuilderModel.validate(page,{approvedImages:imageChoices(),existingPages,currentPageId});}
    catch(reason){if(reason.message==='A page with this address already exists.'||reason.message==='A page with this identity already exists.')throw error(reason.message,409);throw reason;}
  };
  const Items=ammoMode?require('../ammo-model.cjs'):itemMode?require('../item-model.cjs'):null;
  const Vendors=vendorMode?require('../vendor-model.cjs'):null;
  const loadData=name=>JSON.parse(fs.readFileSync(path.join(root,'data',name+'.json'),'utf8'));
  const seed=()=>({version:1,revision:0,data:loadData('vendors').data});
  const constraints=vendorMode?{factions:loadData('factions').data.map(f=>f.id),images:[...new Set(Object.values(loadData('site-images').categories).flatMap(c=>c.images||[]))]}:null;
  if(fs.existsSync(file)&&fs.lstatSync(file).isSymbolicLink())throw error('Private storage cannot be a symbolic link.');
  function read(){
    if(!fs.existsSync(file))return (itemMode||ammoMode)?{...Items.foundation(loadData(ammoMode?'ammo':'items')),revision:0}:vendorMode?seed():{version:1,pages:[]};
    let value;try{value=JSON.parse(fs.readFileSync(file,'utf8'));}catch{throw error('Could not read saved drafts. The saved file has been preserved.',503);}
    if(itemMode||ammoMode){Items.validate(value);if(!Number.isInteger(value.revision)||value.revision<0)throw error('Saved catalogue format is invalid. The file has been preserved.',503);return value;}
    if(vendorMode){Vendors.validate(value);if(Object.hasOwn(value,'vendorListings'))require('../vendor-listings.js').validate(value.vendorListings);return value;}
    if(value.version!==1||!Array.isArray(value.pages))throw error('Saved page format is not supported. The saved file has been preserved.',503);
    return value;
  }
  function write(state){
    const temp=path.join(directory,crypto.randomUUID()+'.tmp');
    try{fs.writeFileSync(temp,JSON.stringify(state,null,2)+'\n',{flag:'wx',mode:0o600});fs.renameSync(temp,file);}catch{try{fs.unlinkSync(temp);}catch{}throw error('Could not save your draft. Try again; your previous saved file is preserved.',503);}
  }
  function mutate(body){
    const state=read();
    if(itemMode||ammoMode){
      if(typeof body?.requestId!=='string'||!/^[a-zA-Z0-9-]{16,80}$/.test(body.requestId))throw error('Reload the editor before saving.');
      const fingerprint=crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex');
      const previous=state.saveReceipts?.find(r=>r.id===body.requestId);
      if(previous){if(previous.fingerprint!==fingerprint)throw error('This save was already used. Reload saved records.',409);return {state,selectedId:previous.selectedId};}
      const images=[...new Set(Object.values(loadData('site-images').categories).flatMap(c=>c.images||[]))];
      const result=Items.mutate(state,body,{images,settings:loadData('verification-settings')});
      result.state.saveReceipts=[...(state.saveReceipts||[]),{id:body.requestId,fingerprint,selectedId:result.selectedId}].slice(-100);
      write(result.state);return result;
    }
    if(vendorMode){
      const inventoryCatalog=body?.action==='inventory'?catalog():null;
      const result=inventoryCatalog
        ?require('../vendor-inventory-model.cjs').mutate(state,body,inventoryCatalog.entities,inventoryCatalog.settings)
        :Vendors.mutate(state,body,constraints);
      write(result.state);return result;
    }
    if(!body||typeof body!=='object'||Array.isArray(body)||!['create','save','delete'].includes(body.action))throw error('Unknown page action.');
    const allowed=body.action==='create'?['action','page']:['action','id','revision'];
    if(body.action==='save')allowed.push('page');
    if(Object.keys(body).some(key=>!allowed.includes(key)))throw error('The page request contains an unsupported or protected field.');
    if(body.action!=='create'&&(typeof body.id!=='string'||!Number.isInteger(body.revision)||body.revision<0))throw error('Reload saved pages before continuing.');
    let record=state.pages.find(r=>r.draft.id===body.id);
    const now=new Date().toISOString();
    if(body.action==='create'){
      const existingPages=state.pages.map(entry=>({id:entry.draft.id,slug:entry.draft.slug}));
      const draft=validatePage(body.page,existingPages,null);
      if(state.pages.length>=100)throw error('This foundation supports up to 100 custom pages.');
      record={draft,revision:1,updatedAt:now};state.pages.push(record);
    }else{
      if(!record)throw error('This page no longer exists. Reload saved pages.',404);
      if(body.revision!==record.revision)throw error('This page changed in another window. Your work is still on screen. Copy any text you need, then reload saved pages.',409);
      if(body.action==='save'){
        const existingPages=state.pages.map(entry=>({id:entry.draft.id,slug:entry.draft.slug}));
        const draft=validatePage(body.page,existingPages,record.draft.id);
        record.draft=draft;record.revision++;record.updatedAt=now;
      }else{state.pages=state.pages.filter(r=>r!==record);record=null;}
    }
    write(state);return record;
  }
  function catalog(){
    // Explicit source namespaces. Do not match, merge or generate records from legacy inventory.
    const sources={item:'items',weapon:'weapons',ammo:'ammo',armour:'armour',attachment:null,blueprint:null};
    const entities=Object.fromEntries(Object.entries(sources).map(([type,source])=>[type,source?loadData(source).data:[]]));
    require('../vendor-listings.js').registry({vendors:[],entities});
    return {entities,sources,settings:loadData('verification-settings')};
  }
  return {read,mutate,catalog,imageChoices};
}
function createServer({directory,vendorMode=false,itemMode=false,ammoMode=false,attachmentMode=false,token=crypto.randomBytes(32).toString('hex')}={}){
  if([itemMode,vendorMode,ammoMode,attachmentMode].filter(Boolean).length>1)throw error('Choose one editor mode.');
  const pageBuilderMode=!vendorMode&&!itemMode&&!ammoMode&&!attachmentMode;
  const trustedStyleHash=pageBuilderMode?crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'page-builder.css'),'utf8').replace(/\r\n/g,'\n')).digest('base64'):null;
  const store=createStore(directory||(ammoMode?path.resolve(root,'../../private-state/ammo-builder'):(itemMode||attachmentMode)?path.resolve(root,'../../private-state/items-builder'):directory),{vendorMode,itemMode:itemMode||attachmentMode,ammoMode});
  const assets=attachmentMode?new Set(['attachment-builder.html','attachment-builder.js','attachment-builder.css','verification.js','page-builder.css','editor-dialog.js','editor-components.js','editor-components.css']):ammoMode?new Set(['ammo-builder.html','ammo-builder.js','ammo-builder.css','data/site-images.json','verification.js','page-builder.css','editor-dialog.js','editor-components.js','editor-components.css']):itemMode?new Set(['draft-persistence.js','production-editor.js','production-editor.css','items-builder.html','items-builder.js','items-builder.css','attachment-model.js','verification.js','page-builder.css','editor-dialog.js','editor-components.js','editor-components.css','data/site-images.json']):vendorMode?new Set(['draft-persistence.js','production-editor.js','production-editor.css','vendor-builder.html','vendor-builder.js','vendor-builder.css','vendor-workspace.js','vendor-inventory.js','vendor-legacy-review.js','attachment-model.js','vendor-listings.js','verification.js','page-builder.css','editor-dialog.js','editor-components.js','editor-components.css','data/site-images.json','data/factions.json']):staticFiles;
  const server=http.createServer(async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
    const styleSource=trustedStyleHash?`style-src 'self' 'sha256-${trustedStyleHash}'`:"style-src 'self'";
    res.setHeader('Content-Security-Policy',`default-src 'self'; connect-src 'self'; script-src 'self'; ${styleSource}; img-src 'self'; frame-src 'self' about:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`);
    const send=(status,value,type='application/json')=>{res.writeHead(status,{'Content-Type':type});res.end(type==='application/json'&&!Buffer.isBuffer(value)?JSON.stringify(value):value);};
    try{
      const expected='127.0.0.1:'+server.address().port;
      if(req.headers.host!==expected)return send(403,{error:'Use the local preview address.'});
      const url=new URL(req.url,'http://'+expected),name=decodeURIComponent(url.pathname.slice(1));
      if(url.pathname==='/api/session'){
        if(req.method!=='GET'||req.headers['sec-fetch-site']==='cross-site'||req.headers.origin&&req.headers.origin!=='http://'+expected)return send(403,{error:'Local browser access only.'});
        return send(200,{token,mode:'local'});
      }
      if(url.pathname===(attachmentMode?'/api/attachment':ammoMode?'/api/ammo':itemMode?'/api/items':vendorMode?'/api/vendors':'/api/pages')||(vendorMode&&url.pathname==='/api/vendor-catalog')){
        if(req.headers['x-scav-session']!==token||req.headers['sec-fetch-site']==='cross-site')return send(403,{error:'Private draft access is required. Reload the editor.'});
        if(req.headers.origin&&req.headers.origin!=='http://'+expected)return send(403,{error:'Local editor requests only.'});
        if(attachmentMode){
          if(req.method!=='GET')return send(405,{error:'Read-only Attachment catalogue.'});
          const Attachments=require('../attachment-model.js');
          return send(200,{catalogue:Attachments.catalogue(store.read()),categories:Attachments.types,settings:JSON.parse(fs.readFileSync(path.join(root,'data/verification-settings.json'),'utf8'))});
        }
        if((itemMode||ammoMode)&&req.method==='GET'){
          const Items=require(ammoMode?'../ammo-model.cjs':'../item-model.cjs');
          const load=name=>JSON.parse(fs.readFileSync(path.join(root,'data',name+'.json'),'utf8'));
          return send(200,{catalogue:store.read(),categories:Items.categories,factFields:Items.factFields,settings:load('verification-settings')});
        }
        if(url.pathname==='/api/vendor-catalog')return req.method==='GET'?send(200,store.catalog()):send(405,{error:'Read-only catalogue.'});
        if(req.method==='GET')return send(200,pageBuilderMode?{...store.read(),imageChoices:store.imageChoices()}:store.read());
        if(req.method!=='POST')return send(405,{error:'Unsupported operation.'});
        if(req.headers.origin!=='http://'+expected||!req.headers['content-type']?.startsWith('application/json'))return send(403,{error:'Local page editor requests only.'});
        let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>1024*1024)throw error('This page is too large.',413);}
        let body;try{body=JSON.parse(raw);}catch{throw error('Invalid request.');}
        return send(200,{record:store.mutate(body)});
      }
      if(req.method!=='GET')return send(405,{error:'Unsupported operation.'});
      const asset=name||(attachmentMode?'attachment-builder.html':ammoMode?'ammo-builder.html':itemMode?'items-builder.html':vendorMode?'vendor-builder.html':'page-builder.html');
      if(!assets.has(asset)&&!(pageBuilderMode?store.imageChoices().includes(asset):Pages.image(asset)))return send(404,'Not found.','text/plain');
      const file=path.resolve(root,asset);
      if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()||!fs.realpathSync(file).startsWith(fs.realpathSync(root)+path.sep))return send(404,'Not found.','text/plain');
      return send(200,fs.readFileSync(file),contentTypes[path.extname(file).toLowerCase()]||'application/octet-stream');
    }catch(reason){send(reason.status||400,{error:reason.message});}
  });return server;
}
module.exports={createStore,createServer};
if(require.main===module){
  const directory=process.env.SCAVLAND_PRIVATE_PAGES||path.resolve(root,'../../private-state/page-builder');
  createServer({directory}).listen(4181,'127.0.0.1',()=>console.log('Local Page Builder: http://127.0.0.1:4181/ — drafts saved privately outside the website.'));
}
