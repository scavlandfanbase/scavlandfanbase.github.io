(function(root,factory){const api=factory(typeof module==='object'?require('./visual-canvas-layout.js'):root.ScavVisualCanvasLayout);if(typeof module==='object')module.exports=api;else root.ScavVisualCanvasModel=api;})(globalThis,Layout=>{
  // Proposed data contract for a free-position canvas layout. Fixture/demo only:
  // not read or written by any live save, history or publication service.
  const GRID_COLUMNS=12;
  const blockTypes=Object.freeze(['text','image','card']);
  const fontSizes=Object.freeze(['sm','md','lg','xl']);
  const palette=Object.freeze(['default','ink','paper','accent','danger']);
  const backgrounds=Object.freeze(['none','surface','subtle']);
  const paddings=Object.freeze(['none','sm','md','lg']);
  const borders=Object.freeze(['none','thin','thick']);
  const aligns=Object.freeze(['left','center','right']);
  const spacings=Object.freeze(['tight','normal','loose']);
  const limits=Object.freeze({title:160,text:4000,alt:300,href:500,blocks:60,minW:2,minH:2,maxH:60});

  const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
  const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
  const fail=message=>{throw new Error(message);};
  const int=(value,min,max,label)=>{if(!Number.isInteger(value)||value<min||value>max)fail(`${label} must be an integer between ${min} and ${max}.`);return value;};
  const text=(value,max,label,required=false)=>{if(typeof value!=='string'||value.length>max||(required&&!value.trim()))fail(`${label} ${required?'is required and ':''}must be at most ${max} characters.`);return value;};
  const identity=(value,label)=>{if(typeof value!=='string'||value.length>80||!/^[a-zA-Z0-9_-]+$/.test(value))fail(`${label} is invalid.`);return value;};
  const oneOf=(value,allowed,label)=>{if(!allowed.includes(value))fail(`${label} must be one of: ${allowed.join(', ')}.`);return value;};
  function exactKeys(value,allowed,label){for(const key of Reflect.ownKeys(value))if(typeof key!=='string'||!allowed.includes(key))fail(`${label} contains an unsupported or protected field.`);}

  function safeImagePath(value){
    return typeof value==='string'&&/^images\/[a-zA-Z0-9_./ -]+\.(?:png|jpe?g|webp|gif)$/i.test(value)&&!value.split('/').some(part=>part==='.'||part==='..')&&!value.includes('//');
  }
  function safeLink(value){
    if(typeof value!=='string'||value.length>limits.href||/[\s\\<>"']/u.test(value))return false;
    if(/^https:\/\//i.test(value)){
      try{const url=new URL(value);return url.protocol==='https:'&&!!url.hostname&&!url.username&&!url.password;}
      catch{return false;}
    }
    return /^(?:[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*\.html)(?:#[a-zA-Z0-9_-]+)?$/.test(value);
  }

  function validateRegion(region,label){
    if(!plain(region))fail(`${label} region is required.`);
    exactKeys(region,['x','y','w','h'],`${label} region`);
    int(region.x,0,GRID_COLUMNS-limits.minW,`${label} region x`);
    int(region.y,0,limits.maxH-limits.minH,`${label} region y`);
    int(region.w,limits.minW,GRID_COLUMNS,`${label} region width`);
    int(region.h,limits.minH,limits.maxH,`${label} region height`);
    if(region.x+region.w>GRID_COLUMNS)fail(`${label} region extends past the ${GRID_COLUMNS}-column grid.`);
    if(region.y+region.h>limits.maxH)fail(`${label} region extends past the ${limits.maxH}-row grid.`);
    return region;
  }

  function validateStyle(style,label){
    if(!plain(style))fail(`${label} style is required.`);
    exactKeys(style,['fontSize','textColor','background','border','padding','align','spacing'],`${label} style`);
    oneOf(style.fontSize,fontSizes,`${label} text size`);
    oneOf(style.textColor,palette,`${label} text colour`);
    oneOf(style.background,backgrounds,`${label} background colour`);
    oneOf(style.border,borders,`${label} border`);
    oneOf(style.padding,paddings,`${label} padding`);
    oneOf(style.align,aligns,`${label} alignment`);
    oneOf(style.spacing,spacings,`${label} spacing`);
    return style;
  }

  const blockFields={
    text:['id','type','desktop','mobileOrder','style','text'],
    image:['id','type','desktop','mobileOrder','style','image','alt'],
    card:['id','type','desktop','mobileOrder','style','title','text','image','alt','href'],
  };

  function validateContext(context){
    if(!plain(context))fail('Trusted validation context is required.');
    exactKeys(context,['approvedImages'],'Validation context');
    if(!Array.isArray(context.approvedImages))fail('Trusted approved-image context is required.');
    const approvedImages=new Set();
    for(const image of context.approvedImages){if(!safeImagePath(image)||approvedImages.has(image))fail('Trusted image context is invalid.');approvedImages.add(image);}
    return {approvedImages};
  }

  function validate(input,context){
    const trusted=validateContext(context);
    if(!plain(input))fail('Invalid canvas document.');
    exactKeys(input,['id','title','blocks'],'Canvas document');
    identity(input.id,'Document identity');
    text(input.title,limits.title,'Document title',true);
    if(!Array.isArray(input.blocks)||input.blocks.length>limits.blocks)fail(`A canvas supports up to ${limits.blocks} blocks.`);
    const ids=new Set(),orders=new Set();
    for(const block of input.blocks){
      if(!plain(block))fail('Invalid block.');
      if(!blockTypes.includes(block.type))fail('Choose a supported block type.');
      exactKeys(block,blockFields[block.type],'Block');
      const blockId=identity(block.id,'Block identity');
      if(ids.has(blockId))fail('Block identities must be unique.');ids.add(blockId);
      validateRegion(block.desktop,'Desktop');
      int(block.mobileOrder,0,limits.blocks-1,'Mobile order');
      if(orders.has(block.mobileOrder))fail('Mobile order values must be unique.');orders.add(block.mobileOrder);
      validateStyle(block.style,'Block');
      if(block.type==='card')text(block.title,limits.title,'Card title',true);
      if(block.type==='text'||block.type==='card')text(block.text,limits.text,'Text',block.type==='text');
      if(block.type==='image'&&(!own(block,'image')||!trusted.approvedImages.has(block.image)))fail('Choose an approved image from the image library.');
      if(block.type==='card'&&own(block,'image')&&block.image!==null&&!trusted.approvedImages.has(block.image))fail('Choose an approved image from the image library.');
      if(block.type==='image'||block.type==='card')text(block.alt,limits.alt,'Image description',block.type==='image');
      if(block.type==='card'){text(block.href,limits.href,'Link',true);if(!safeLink(block.href))fail('Use an HTTPS link or an existing page such as items.html.');}
    }
    for(let i=0;i<input.blocks.length;i++)for(let j=i+1;j<input.blocks.length;j++)
      if(Layout.regionsOverlap(input.blocks[i].desktop,input.blocks[j].desktop))fail('Desktop blocks must not overlap.');
    return structuredClone(input);
  }

  return Object.freeze({GRID_COLUMNS,blockTypes,fontSizes,palette,backgrounds,paddings,borders,aligns,spacings,limits,validate,safeImagePath,safeLink});
});
