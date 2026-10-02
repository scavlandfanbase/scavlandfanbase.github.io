const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const front=require('../page-builder-contract.js');
const style={fontSize:'md',textColor:'default',background:'surface',border:'thin',padding:'md',align:'left',spacing:'normal'};
const block=(id,x,y,order,text,hidden=false)=>({id,type:'text',hidden,text,canvas:{desktop:{x,y,w:6,h:4},mobileOrder:order,style:{...style}}});
const page={id:'canvas-page',title:'Canvas <script>unsafe()</script>',slug:'canvas-page',intro:'Intro',sections:[
 {id:'canvas-section',title:'Canvas section',hidden:false,layout:{mode:'canvas'},blocks:[
  block('left',0,0,2,'Long text '.repeat(300)),block('right',6,0,0,'<img src=x onerror=unsafe()>'),
  block('below',0,4,1,'Below the first row'),block('hidden',6,4,3,'PRIVATE HIDDEN',true)]},
 {id:'hidden-section',title:'Private',hidden:true,layout:{mode:'canvas'},blocks:[block('private',0,0,0,'PRIVATE SECTION')]}
]};
const opts={images:[],existingPages:[],currentPageId:null};
(async()=>{
 const backend=(await import('../supabase/functions/admin-drafts/page-renderer.mjs')).default;
 const css=(await import('../supabase/functions/admin-drafts/page-style.mjs')).default;
 const html=front.document(page,{...opts,css});assert.equal(html,backend.document(page,{...opts,css}));
 assert.ok(!html.includes('PRIVATE HIDDEN'));assert.ok(!html.includes('PRIVATE SECTION'));
 assert.ok(html.includes('&lt;img src=x onerror=unsafe()&gt;'));
 const browser=await chromium.launch({headless:true});
 try{
  const tab=await browser.newPage();
  for(const width of [1440,800,375,320]){
   await tab.setViewportSize({width,height:900});await tab.setContent(html);
   const result=await tab.evaluate(()=>{
    const blocks=[...document.querySelectorAll('.canvas-section .page-block')];
    return {viewport:innerWidth,width:document.documentElement.scrollWidth,
     boxes:blocks.map(el=>{const r=el.getBoundingClientRect();return {text:el.textContent,x:r.x,y:r.y,right:r.right,bottom:r.bottom,height:r.height,scroll:el.scrollHeight,client:el.clientHeight};}),
     unsafe:!!document.querySelector('script:not([src="/shared-home-boxes.js?v=20261002-1"]), img[onerror]')};
   });
   assert.equal(result.unsafe,false);assert.ok(result.width<=result.viewport,'no horizontal overflow at '+width);
   for(const b of result.boxes)assert.ok(b.scroll<=b.client+1,'long text must not clip at '+width);
   for(let i=0;i<result.boxes.length;i++)for(let j=i+1;j<result.boxes.length;j++){
    const a=result.boxes[i],b=result.boxes[j];assert.ok(!(a.x<b.right-.5&&a.right>b.x+.5&&a.y<b.bottom-.5&&a.bottom>b.y+.5),'no content overlap at '+width);
   }
   if(width<=760)assert.ok(result.boxes.every((b,i)=>i===0||b.y>=result.boxes[i-1].bottom),'mobile order follows chosen sequence');
   else{const left=result.boxes.find(b=>b.text.startsWith('Long')),right=result.boxes.find(b=>b.text.startsWith('<img'));assert.equal(left.y,right.y);assert.ok(left.x<right.x,'desktop coordinates independent of mobile order');}
  }
 }finally{await browser.close();}
 console.log('Canvas rendering: server/browser parity, escaped output, hidden exclusion, independent mobile order, long-text expansion and 320–1440px non-overlap passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
