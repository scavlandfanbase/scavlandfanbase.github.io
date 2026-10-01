(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ScavPageBuilderModel=api;})(globalThis,()=>{
  const blockTypes=Object.freeze(['heading','text','image','card','divider','button']);
  const limits=Object.freeze({pageTitle:160,intro:1000,pageAddress:80,sectionTitle:160,blockTitle:160,text:10000,alt:300,link:500,sections:40,blocks:200});
  const reserved=new Set(['index','home','admin','api','pages','data','images','assets','scripts','supabase','content-admin','page-builder','patch-admin','settings-admin','items-admin','vendors-admin','specialist-admin','admin-password','weapons','armour','items','ammo','ammunition','vendors','crafting','factions','areas','map','roadmap','evidence-import']);
  const layoutValues={columns:[1,2,3],align:['start','center'],spacing:['compact','normal','spacious'],background:['none','surface','subtle']};
  const blockFields={heading:['id','type','hidden','title'],text:['id','type','hidden','text'],image:['id','type','hidden','image','alt'],card:['id','type','hidden','title','text','href','image','alt'],divider:['id','type','hidden'],button:['id','type','hidden','title','href']};
  const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
  const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
  const fail=message=>{throw new Error(message);};
  function exactKeys(value,allowed,label){
    for(const key of Reflect.ownKeys(value))if(typeof key!=='string'||!allowed.includes(key))fail(`${label} contains an unsupported or protected field.`);
  }
  function text(value,max,label,required=false){
    if(typeof value!=='string'||value.length>max||(required&&!value.trim()))fail(`${label} ${required?'is required and ':''}must be at most ${max} characters.`);
    return value;
  }
  function identity(value,label){
    if(typeof value!=='string'||value.length>80||!/^[a-zA-Z0-9_-]+$/.test(value))fail(`${label} is invalid.`);
    return value;
  }
  function pageAddress(value){
    if(typeof value!=='string'||value.length>limits.pageAddress||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)||reserved.has(value))fail('Choose a unique page address using lowercase letters, numbers and hyphens. System page names are protected.');
    return value;
  }
  function safeImagePath(value){
    return typeof value==='string'&&/^images\/[a-zA-Z0-9_./ -]+\.(?:png|jpe?g|webp|gif)$/i.test(value)&&!value.split('/').some(part=>part==='.'||part==='..')&&!value.includes('//');
  }
  function safeLink(value){
    if(typeof value!=='string'||value.length>limits.link||/[\s\\<>"']/u.test(value))return false;
    if(/^https:\/\//i.test(value)){
      try{const url=new URL(value);return url.protocol==='https:'&&!!url.hostname&&!url.username&&!url.password;}
      catch{return false;}
    }
    const pageMatch=/^\/pages\/([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(value);
    if(pageMatch)return !reserved.has(pageMatch[1]);
    return /^(?:[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*\.html)(?:#[a-zA-Z0-9_-]+)?$/.test(value);
  }
  function validateContext(context){
    if(!plain(context))fail('Trusted validation context is required.');
    exactKeys(context,['approvedImages','existingPages','currentPageId'],'Validation context');
    if(!Array.isArray(context.approvedImages)||!Array.isArray(context.existingPages)||!(context.currentPageId===null||typeof context.currentPageId==='string'))fail('Trusted image and existing-page context is required.');
    const approvedImages=new Set();
    for(const image of context.approvedImages){if(!safeImagePath(image)||approvedImages.has(image))fail('Trusted image context is invalid.');approvedImages.add(image);}
    const ids=new Set(),addresses=new Set(),existingPages=[];
    for(const entry of context.existingPages){
      if(!plain(entry))fail('Trusted existing-page context is invalid.');
      exactKeys(entry,['id','slug'],'Existing page context');
      identity(entry.id,'Existing page identity');pageAddress(entry.slug);
      if(ids.has(entry.id)||addresses.has(entry.slug))fail('Trusted existing-page context contains duplicate identities or addresses.');
      ids.add(entry.id);addresses.add(entry.slug);existingPages.push({id:entry.id,slug:entry.slug});
    }
    if(context.currentPageId!==null&&(!identity(context.currentPageId,'Current page identity')||!ids.has(context.currentPageId)))fail('Current page identity is not present in trusted existing-page context.');
    return {approvedImages,existingPages};
  }
  function validate(input,context){
    const trusted=validateContext(context);
    if(!plain(input))fail('Invalid page.');
    exactKeys(input,['id','title','slug','intro','sections'],'Page');
    const pageId=identity(input.id,'Page identity');
    if(context.currentPageId!==null&&pageId!==context.currentPageId)fail('Page identity cannot change.');
    text(input.title,limits.pageTitle,'Page title',true);pageAddress(input.slug);text(input.intro,limits.intro,'Introduction');
    if(!Array.isArray(input.sections)||input.sections.length>limits.sections)fail(`A page supports up to ${limits.sections} sections.`);
    const identities=new Set([pageId]);let blockCount=0;
    for(const section of input.sections){
      if(!plain(section))fail('Invalid section.');
      exactKeys(section,['id','title','hidden','layout','blocks'],'Section');
      const sectionId=identity(section.id,'Section identity');
      if(identities.has(sectionId))fail('Content identities must be unique.');identities.add(sectionId);
      text(section.title,limits.sectionTitle,'Section title');
      if(typeof section.hidden!=='boolean')fail('Invalid section visibility.');
      if(!plain(section.layout))fail('Choose valid section layout settings.');
      exactKeys(section.layout,['columns','align','spacing','background','border'],'Section layout');
      for(const [key,values]of Object.entries(layoutValues))if(own(section.layout,key)&&!values.includes(section.layout[key]))fail('Choose valid section layout settings.');
      if(own(section.layout,'border')&&typeof section.layout.border!=='boolean')fail('Choose valid section layout settings.');
      if(!Array.isArray(section.blocks))fail('Invalid section blocks.');
      for(const block of section.blocks){
        if(!plain(block))fail('Invalid block.');
        if(!blockTypes.includes(block.type))fail('Choose a supported block type.');
        exactKeys(block,blockFields[block.type],'Block');
        const blockId=identity(block.id,'Block identity');
        if(identities.has(blockId))fail('Content identities must be unique.');identities.add(blockId);
        if(typeof block.hidden!=='boolean')fail('Invalid block visibility.');
        if(++blockCount>limits.blocks)fail(`A page supports up to ${limits.blocks} blocks.`);
        if(['heading','card','button'].includes(block.type))text(block.title,limits.blockTitle,'Block title',true);
        if(['text','card'].includes(block.type))text(block.text,limits.text,'Text',block.type==='text');
        if(['card','button'].includes(block.type)){
          text(block.href,limits.link,'Link',true);
          if(!safeLink(block.href))fail('Use an HTTPS link, an existing page such as items.html, or /pages/your-page.');
        }
        if(block.type==='image'&&(!own(block,'image')||typeof block.image!=='string'||!block.image||!trusted.approvedImages.has(block.image)))fail('Choose an approved image from the image library.');
        if(block.type==='card'&&own(block,'image')&&block.image!==null&&(typeof block.image!=='string'||!block.image||!trusted.approvedImages.has(block.image)))fail('Choose an approved image from the image library.');
        if(block.type==='image'||block.type==='card')text(block.alt,limits.alt,'Image description',block.type==='image');
      }
    }
    const identityConflict=trusted.existingPages.find(entry=>entry.id===pageId&&entry.id!==context.currentPageId);
    if(identityConflict)fail('A page with this identity already exists.');
    const conflict=trusted.existingPages.find(entry=>entry.slug===input.slug&&entry.id!==context.currentPageId);
    if(conflict)fail('A page with this address already exists.');
    return structuredClone(input);
  }
  return Object.freeze({blockTypes,limits,validate,pageAddress,safeImagePath,safeLink});
});
