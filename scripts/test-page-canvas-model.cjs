const assert=require('node:assert/strict');
const frontend=require('../page-builder-model.js');
const clone=value=>structuredClone(value);
const context={approvedImages:['images/example.png'],existingPages:[],currentPageId:null};
const style={fontSize:'md',textColor:'default',background:'surface',border:'thin',padding:'md',align:'left',spacing:'normal'};
const content=[
 {id:'heading',type:'heading',hidden:false,title:'Heading'},
 {id:'text',type:'text',hidden:false,text:'Long editable text'},
 {id:'image',type:'image',hidden:false,image:'images/example.png',alt:'Example'},
 {id:'card',type:'card',hidden:false,title:'Guide',text:'Description',href:'/pages/guides',image:null,alt:''},
 {id:'divider',type:'divider',hidden:false},
 {id:'button',type:'button',hidden:false,title:'Open guide',href:'/pages/guides'},
];
const legacy={id:'page',title:'Legacy page',slug:'legacy-page',intro:'Introduction',sections:[{id:'section',title:'Section',hidden:false,layout:{columns:2},blocks:clone(content)}]};
const canvas=clone(legacy);canvas.sections[0].layout.mode='canvas';
canvas.sections[0].blocks.forEach((b,i)=>{b.canvas={desktop:{x:(i%2)*6,y:Math.floor(i/2)*8,w:6,h:8},mobileOrder:5-i,style:clone(style)};});
(async()=>{
 const backend=(await import('../supabase/functions/admin-drafts/page-model.mjs')).default;
 for(const model of [frontend,backend]){
  const original=clone(legacy);assert.deepEqual(model.validate(legacy,context),original,'legacy format must not be rewritten');
  assert.deepEqual(legacy,original,'validation must not mutate input');
  const validated=model.validate(canvas,context);assert.deepEqual(validated,canvas);
  validated.sections[0].blocks[0].title='Changed';assert.notEqual(canvas.sections[0].blocks[0].title,'Changed','return detached content');
  const reject=(change,pattern)=>{const p=clone(canvas);change(p,p.sections[0].blocks);assert.throws(()=>model.validate(p,context),pattern);};
  reject((p,b)=>{b[1].canvas.desktop.x=5;},/overlap/);
  reject((p,b)=>{b[1].hidden=true;b[1].canvas.desktop.x=5;},/overlap/);
  reject((p,b)=>{b[0].canvas.desktop.y=59;},/outside/);
  reject((p,b)=>{b[1].canvas.desktop.w=7;},/outside/);
  reject((p,b)=>{b[0].canvas.desktop.x=0.5;},/outside/);
  reject((p,b)=>{b[0].canvas.desktop.h=Infinity;},/outside/);
  reject((p,b)=>{b[0].canvas.mobileOrder=b[1].canvas.mobileOrder;},/mobile order/);
  reject((p,b)=>{b[0].canvas.mobileOrder=-1;},/mobile order/);
  reject((p,b)=>{b[0].canvas.style.background='url(javascript:alert(1))';},/styles/);
  reject((p,b)=>{b[0].canvas.style.css='position:fixed';},/protected/);
  reject((p,b)=>{b[0].canvas.savedBy='owner';},/protected/);
  reject((p,b)=>{delete b[0].canvas;},/required/);
  reject((p,b)=>{b[2].image='images/unapproved.png';},/approved image/);
  reject((p,b)=>{b[3].href='javascript:alert(1)';},/HTTPS/);
  reject(p=>{p.sections[0].layout.mode='untrusted';},/layout mode/);
  reject(p=>{delete p.sections[0].layout.mode;},/protected/);
  const boundary=clone(canvas);boundary.sections[0].blocks=[clone(boundary.sections[0].blocks[0])];
  boundary.sections[0].blocks[0].canvas.desktop={x:10,y:58,w:2,h:2};assert.deepEqual(model.validate(boundary,context),boundary);
  const hidden=clone(canvas);hidden.sections[0].hidden=true;hidden.sections[0].blocks[0].hidden=true;
  assert.deepEqual(model.validate(hidden,context),hidden,'visibility and independent mobile order retained');
 }
 assert.deepEqual(frontend.validate(canvas,context),backend.validate(canvas,context),'frontend/backend parity');
 console.log('Page canvas model: legacy preservation, all six block types, boundaries, hidden collisions, trusted fields and frontend/backend parity passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
