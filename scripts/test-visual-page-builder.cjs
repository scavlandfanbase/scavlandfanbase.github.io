// Isolated test suite for the fixture-only visual canvas. Does not touch any
// live save/history/publication service, production page model or game data.
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const Model=require('../visual-canvas-model.js');
const Renderer=require('../visual-canvas-renderer.js');
const Fixtures=require('../visual-canvas-fixtures.js');
const Layout=require('../visual-canvas-layout.js');

const contentTypes={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg'};

function createStaticServer(){
  return http.createServer((req,res)=>{
    const urlPath=decodeURIComponent(req.url.split('?')[0]);
    const filePath=path.join(root,urlPath==='/'?'/visual-page-builder.html':urlPath);
    if(!filePath.startsWith(root+path.sep)&&filePath!==root){res.writeHead(403);res.end();return;}
    fs.readFile(filePath,(error,data)=>{
      if(error){res.writeHead(404);res.end();return;}
      res.writeHead(200,{'Content-Type':contentTypes[path.extname(filePath)]||'application/octet-stream'});
      res.end(data);
    });
  });
}

function modelTests(){
  const context={approvedImages:Fixtures.approvedImages};
  const valid=Model.validate(Fixtures.sampleDocument,context);
  assert.deepEqual(valid,Fixtures.sampleDocument);
  assert.notEqual(valid,Fixtures.sampleDocument);

  assert.throws(()=>Model.validate(Fixtures.sampleDocument),/trusted/i);
  assert.throws(()=>Model.validate({...Fixtures.sampleDocument,role:'admin'},context),/unsupported or protected field/i);
  assert.throws(()=>Model.validate({...Fixtures.sampleDocument,blocks:[{...Fixtures.sampleDocument.blocks[0],updatedAt:'today'}]},context),/unsupported or protected field/i);

  const overlapRegion=block=>({...block,desktop:{...block.desktop,x:10,w:3}});
  assert.throws(()=>Model.validate({...Fixtures.sampleDocument,blocks:[overlapRegion(Fixtures.sampleDocument.blocks[0])]},context),/extends past/i);

  const belowGridRegion=block=>({...block,desktop:{...block.desktop,y:58,h:4}});
  assert.throws(()=>Model.validate({...Fixtures.sampleDocument,blocks:[belowGridRegion(Fixtures.sampleDocument.blocks[0])]},context),/extends past the 60-row grid/i);

  const exactFitRegion={...Fixtures.sampleDocument.blocks[0],desktop:{x:0,y:56,w:12,h:4}};
  assert.deepEqual(Model.validate({...Fixtures.sampleDocument,blocks:[exactFitRegion]},context).blocks[0].desktop,exactFitRegion.desktop);

  const overlappingBlocks=[
    {...Fixtures.sampleDocument.blocks[0],desktop:{x:0,y:0,w:4,h:4}},
    {...Fixtures.sampleDocument.blocks[1],desktop:{x:2,y:2,w:4,h:4},image:Fixtures.approvedImages[0]},
  ];
  assert.throws(()=>Model.validate({...Fixtures.sampleDocument,blocks:overlappingBlocks},context),/must not overlap/i);
  const touchingBlocks=[
    {...Fixtures.sampleDocument.blocks[0],desktop:{x:0,y:0,w:4,h:4}},
    {...Fixtures.sampleDocument.blocks[1],desktop:{x:4,y:0,w:4,h:4},image:Fixtures.approvedImages[0]},
  ];
  assert.deepEqual(Model.validate({...Fixtures.sampleDocument,blocks:touchingBlocks},context).blocks.map(b=>b.desktop),touchingBlocks.map(b=>b.desktop));

  const dupeId=Fixtures.sampleDocument.blocks.map((block,index)=>index===1?{...block,id:Fixtures.sampleDocument.blocks[0].id}:block);
  assert.throws(()=>Model.validate({...Fixtures.sampleDocument,blocks:dupeId},context),/identities must be unique/i);

  const dupeOrder=Fixtures.sampleDocument.blocks.map((block,index)=>index===1?{...block,mobileOrder:Fixtures.sampleDocument.blocks[0].mobileOrder}:block);
  assert.throws(()=>Model.validate({...Fixtures.sampleDocument,blocks:dupeOrder},context),/mobile order values must be unique/i);

  const badImage={...Fixtures.sampleDocument.blocks[1],image:'images/../private.png'};
  assert.throws(()=>Model.validate({...Fixtures.sampleDocument,blocks:[badImage]},context),/approved image/i);

  const unsafeLink={...Fixtures.sampleDocument.blocks[3],href:'javascript:alert(1)'};
  assert.throws(()=>Model.validate({...Fixtures.sampleDocument,blocks:[unsafeLink]},context),/HTTPS link/i);

  const badStyle={...Fixtures.sampleDocument.blocks[0],style:{...Fixtures.sampleDocument.blocks[0].style,fontSize:'huge'}};
  assert.throws(()=>Model.validate({...Fixtures.sampleDocument,blocks:[badStyle]},context),/text size/i);

  const rendered=Renderer.render(Fixtures.sampleDocument,{images:Fixtures.approvedImages});
  assert(rendered.includes('canvas-doc-title'));
  assert(!rendered.includes('<script'));
  const mobileRendered=Renderer.render(Fixtures.sampleDocument,{images:Fixtures.approvedImages,breakpoint:'mobile'});
  assert(mobileRendered.includes('mobile-stack'));

  const xssDoc={...Fixtures.sampleDocument,blocks:[{...Fixtures.sampleDocument.blocks[0],text:'<img src=x onerror=alert(1)>'}]};
  const xssRender=Renderer.render(xssDoc,{images:Fixtures.approvedImages});
  assert(!xssRender.includes('<img src=x'));
  assert(xssRender.includes('&lt;img'));

  console.log('Model/renderer fixture tests passed.');
}

function layoutTests(){
  const grid={cols:12,maxRows:60,minW:2,minH:2};

  // regionsOverlap: touching edges are not overlap; genuine overlap is detected both ways.
  assert.equal(Layout.regionsOverlap({x:0,y:0,w:4,h:4},{x:4,y:0,w:4,h:4}),false,'adjacent regions sharing an edge do not overlap');
  assert.equal(Layout.regionsOverlap({x:0,y:0,w:4,h:4},{x:0,y:4,w:4,h:4}),false,'vertically adjacent regions do not overlap');
  assert.equal(Layout.regionsOverlap({x:0,y:0,w:4,h:4},{x:3,y:3,w:4,h:4}),true,'corner-overlapping regions are detected');
  assert.equal(Layout.regionsOverlap({x:0,y:0,w:4,h:4},{x:3,y:3,w:4,h:4}),Layout.regionsOverlap({x:3,y:3,w:4,h:4},{x:0,y:0,w:4,h:4}),'overlap check is symmetric');

  // regionInBounds: exact-fit regions are valid; one unit past either edge is not.
  assert.equal(Layout.regionInBounds({x:8,y:56,w:4,h:4},grid),true,'region touching both far edges exactly is in bounds');
  assert.equal(Layout.regionInBounds({x:9,y:56,w:4,h:4},grid),false,'region one column past the right edge is rejected');
  assert.equal(Layout.regionInBounds({x:8,y:57,w:4,h:4},grid),false,'region one row past the bottom edge is rejected');
  assert.equal(Layout.regionInBounds({x:-1,y:0,w:4,h:4},grid),false,'negative x is rejected');
  assert.equal(Layout.regionInBounds({x:0,y:0,w:1,h:4},grid),false,'width below the minimum is rejected');

  // canPlace: excludeId lets a block be compared against others without colliding with itself.
  const blocks=[{id:'a',desktop:{x:0,y:0,w:4,h:4}},{id:'b',desktop:{x:4,y:0,w:4,h:4}}];
  assert.equal(Layout.canPlace({x:0,y:0,w:4,h:4},blocks,grid,'a'),true,'a block can keep its own current region');
  assert.equal(Layout.canPlace({x:2,y:0,w:4,h:4},blocks,grid,'a'),false,'moving into another block is rejected');
  assert.equal(Layout.canPlace({x:2,y:0,w:4,h:4},blocks,grid,null),false,'without an exclusion even the first block collides with itself in place');

  // findFreeRegion: finds the first open gap; returns null when nothing fits.
  assert.deepEqual(Layout.findFreeRegion([],{w:4,h:4},grid),{x:0,y:0,w:4,h:4},'an empty grid places the first block at the origin');
  const packedExceptOneGap=[{id:'a',desktop:{x:0,y:0,w:12,h:58}}];
  assert.deepEqual(Layout.findFreeRegion(packedExceptOneGap,{w:4,h:2},grid),{x:0,y:58,w:4,h:2},'a free strip below a full-width block is found');
  const fullGrid=[{id:'a',desktop:{x:0,y:0,w:12,h:60}}];
  assert.equal(Layout.findFreeRegion(fullGrid,{w:2,h:2},grid),null,'no region is returned when the grid has no free space');

  console.log('Layout geometry tests passed.');
}

async function loadFixtureDoc(page,doc){
  await page.evaluate(d=>window.__visualCanvasTestHooks.setDocForTest(d),doc);
  if(doc.blocks.length>0)await page.waitForSelector('.vcb-block');
  else await page.waitForSelector('#stage');
}

const defaultStyle=Fixtures.defaultStyle;

const soloDoc={
  id:'interaction-fixture',title:'Interaction fixture',
  blocks:[{id:'solo-block',type:'text',desktop:{x:2,y:2,w:4,h:6},mobileOrder:0,style:{...defaultStyle},text:'Solo block for interaction tests.'}],
};

const overlapDoc={
  id:'overlap-fixture',title:'Overlap fixture',
  blocks:[
    {id:'block-a',type:'text',desktop:{x:0,y:0,w:4,h:4},mobileOrder:0,style:{...defaultStyle},text:'Block A'},
    {id:'block-b',type:'text',desktop:{x:4,y:0,w:4,h:4},mobileOrder:1,style:{...defaultStyle},text:'Block B'},
  ],
};

const fullGridDoc={
  id:'full-fixture',title:'Full fixture',
  blocks:[{id:'cover-block',type:'text',desktop:{x:0,y:0,w:12,h:60},mobileOrder:0,style:{...defaultStyle},text:'Covers the entire grid.'}],
};

async function browserTests(){
  const server=createStaticServer();
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch();
  try{
    const page=await browser.newPage({viewport:{width:1280,height:900}});
    await page.goto(base+'/visual-page-builder.html');
    await page.waitForSelector('.vcb-block');

    // --- Selection ---
    const firstBlock=page.locator('.vcb-block').first();
    await firstBlock.click();
    assert.equal(await firstBlock.getAttribute('aria-selected'),'true','first block selected on click');
    await page.waitForSelector('#properties-panel select');

    // === Move/resize via pointer, keyboard and buttons, on an isolated block with open space ===
    await loadFixtureDoc(page,soloDoc);
    const soloBlock=page.locator('.vcb-block').first();
    await soloBlock.click();
    const before=await page.evaluate(()=>window.__visualCanvasTestHooks.getDoc());
    const beforeBlock=before.blocks[0];

    await soloBlock.focus();
    await page.keyboard.press('ArrowRight');
    let afterDoc=await page.evaluate(()=>window.__visualCanvasTestHooks.getDoc());
    assert.equal(afterDoc.blocks[0].desktop.x,beforeBlock.desktop.x+1,'ArrowRight moves the block right by one column');

    await page.keyboard.press('Shift+ArrowDown');
    afterDoc=await page.evaluate(()=>window.__visualCanvasTestHooks.getDoc());
    assert.equal(afterDoc.blocks[0].desktop.h,beforeBlock.desktop.h+1,'Shift+ArrowDown grows height by one row');

    await page.click('#move-left');
    afterDoc=await page.evaluate(()=>window.__visualCanvasTestHooks.getDoc());
    assert.equal(afterDoc.blocks[0].desktop.x,beforeBlock.desktop.x,'Move-left button mirrors the keyboard move');

    // Reload a fresh, centrally-placed block so the drag has guaranteed room to move.
    await loadFixtureDoc(page,soloDoc);
    const dragBlock=page.locator('.vcb-block').first();
    await dragBlock.click();
    const soloBox=await dragBlock.boundingBox();
    const dragBeforeDoc=await page.evaluate(()=>window.__visualCanvasTestHooks.getDoc());
    await page.mouse.move(soloBox.x+soloBox.width/2,soloBox.y+soloBox.height/2);
    await page.mouse.down();
    await page.mouse.move(soloBox.x+soloBox.width/2+120,soloBox.y+soloBox.height/2+50,{steps:5});
    await page.mouse.up();
    const dragAfterDoc=await page.evaluate(()=>window.__visualCanvasTestHooks.getDoc());
    assert(dragAfterDoc.blocks[0].desktop.x>dragBeforeDoc.blocks[0].desktop.x,'Dragging the block moved it right');
    assert(dragAfterDoc.blocks[0].desktop.y>dragBeforeDoc.blocks[0].desktop.y,'Dragging the block moved it down');

    // Reload again so the resize handle has guaranteed room to grow into.
    await loadFixtureDoc(page,soloDoc);
    const resizeBlock=page.locator('.vcb-block').first();
    await resizeBlock.click();
    const handle=resizeBlock.locator('.vcb-handle-se');
    const handleBox=await handle.boundingBox();
    const resizeBeforeDoc=await page.evaluate(()=>window.__visualCanvasTestHooks.getDoc());
    await page.mouse.move(handleBox.x+handleBox.width/2,handleBox.y+handleBox.height/2);
    await page.mouse.down();
    await page.mouse.move(handleBox.x+60,handleBox.y+40,{steps:5});
    await page.mouse.up();
    const resizeAfterDoc=await page.evaluate(()=>window.__visualCanvasTestHooks.getDoc());
    assert(resizeAfterDoc.blocks[0].desktop.w>resizeBeforeDoc.blocks[0].desktop.w,'Handle drag grows width');
    assert(resizeAfterDoc.blocks[0].desktop.h>resizeBeforeDoc.blocks[0].desktop.h,'Handle drag grows height');

    // === Pointer dragging can never escape the grid, matching keyboard/button bounds ===
    await loadFixtureDoc(page,soloDoc);
    const edgeBlock=page.locator('.vcb-block').first();
    await edgeBlock.click();
    const edgeBox=await edgeBlock.boundingBox();
    await page.mouse.move(edgeBox.x+edgeBox.width/2,edgeBox.y+edgeBox.height/2);
    await page.mouse.down();
    await page.mouse.move(edgeBox.x+edgeBox.width/2+2000,edgeBox.y+edgeBox.height/2,{steps:30});
    await page.mouse.up();
    const edgeDragDoc=await page.evaluate(()=>window.__visualCanvasTestHooks.getDoc());
    const edgeRegion=edgeDragDoc.blocks[0].desktop;
    assert.equal(edgeRegion.x+edgeRegion.w,12,'dragging far past the right edge stops with the block flush against it, never past it');
    assert(edgeRegion.x>soloDoc.blocks[0].desktop.x,'the block still moved toward the edge before being stopped');

    // === Keyboard/button bounds at the exact edge ===
    await loadFixtureDoc(page,{id:'right-edge-fixture',title:'Right edge',blocks:[{id:'edge-block',type:'text',desktop:{x:9,y:0,w:2,h:4},mobileOrder:0,style:{...defaultStyle},text:'Near the right edge.'}]});
    const rightEdgeBlock=page.locator('.vcb-block').first();
    await rightEdgeBlock.click();
    await rightEdgeBlock.focus();
    await page.keyboard.press('ArrowRight');
    let rightEdgeDoc=await page.evaluate(()=>window.__visualCanvasTestHooks.getDoc());
    assert.equal(rightEdgeDoc.blocks[0].desktop.x,10,'the first ArrowRight reaches the exact right edge');
    await page.keyboard.press('ArrowRight');
    rightEdgeDoc=await page.evaluate(()=>window.__visualCanvasTestHooks.getDoc());
    assert.equal(rightEdgeDoc.blocks[0].desktop.x,10,'a further ArrowRight past the right edge is rejected');
    const rightEdgeMessage=await page.locator('#status-line').innerText();
    assert(/leave the grid/i.test(rightEdgeMessage),'a clear message explains the rejected edge move');

    await loadFixtureDoc(page,{id:'bottom-edge-fixture',title:'Bottom edge',blocks:[{id:'bottom-block',type:'text',desktop:{x:0,y:57,w:4,h:2},mobileOrder:0,style:{...defaultStyle},text:'Near the bottom edge.'}]});
    await page.locator('.vcb-block').first().click();
    await page.click('#grow-h');
    let bottomEdgeDoc=await page.evaluate(()=>window.__visualCanvasTestHooks.getDoc());
    assert.equal(bottomEdgeDoc.blocks[0].desktop.h,3,'Taller reaches the exact bottom edge (y+h=60)');
    await page.click('#grow-h');
    bottomEdgeDoc=await page.evaluate(()=>window.__visualCanvasTestHooks.getDoc());
    assert.equal(bottomEdgeDoc.blocks[0].desktop.h,3,'a further Taller click past the bottom edge is rejected');

    // === Overlap is rejected on move, resize and drag; mobile order stays independent ===
    await loadFixtureDoc(page,overlapDoc);
    const blockA=page.locator('.vcb-block').nth(0);
    await blockA.click();
    const beforeOverlap=await page.evaluate(()=>window.__visualCanvasTestHooks.getDoc());
    await blockA.focus();
    await page.keyboard.press('ArrowRight');
    const afterOverlapMove=await page.evaluate(()=>window.__visualCanvasTestHooks.getDoc());
    assert.deepEqual(afterOverlapMove,beforeOverlap,'moving into another block is rejected and the document is unchanged');
    const overlapMoveMessage=await page.locator('#status-line').innerText();
    assert(/overlap/i.test(overlapMoveMessage),'a clear message explains the rejected overlapping move');

    await page.click('#grow-w');
    const afterOverlapResize=await page.evaluate(()=>window.__visualCanvasTestHooks.getDoc());
    assert.deepEqual(afterOverlapResize,beforeOverlap,'resizing into another block is rejected and the document is unchanged');

    const blockABox=await blockA.boundingBox();
    await page.mouse.move(blockABox.x+blockABox.width/2,blockABox.y+blockABox.height/2);
    await page.mouse.down();
    await page.mouse.move(blockABox.x+blockABox.width/2+300,blockABox.y+blockABox.height/2,{steps:5});
    await page.mouse.up();
    const afterDragOverlap=await page.evaluate(()=>window.__visualCanvasTestHooks.getDoc());
    const blockAAfter=afterDragOverlap.blocks.find(b=>b.id==='block-a');
    const blockBAfter=afterDragOverlap.blocks.find(b=>b.id==='block-b');
    assert.equal(Layout.regionsOverlap(blockAAfter.desktop,blockBAfter.desktop),false,'dragging never leaves two blocks overlapping');

    await page.click('#order-later');
    const afterReorder=await page.evaluate(()=>window.__visualCanvasTestHooks.getDoc());
    assert.notDeepEqual(afterReorder.blocks.map(b=>b.mobileOrder),afterDragOverlap.blocks.map(b=>b.mobileOrder),'mobile stacking order can still change independent of the blocked desktop overlap');

    // === Adding a block with no free space leaves the document unchanged ===
    await loadFixtureDoc(page,fullGridDoc);
    const beforeFull=await page.evaluate(()=>window.__visualCanvasTestHooks.getDoc());
    await page.click('#add-text');
    const afterFullAttempt=await page.evaluate(()=>window.__visualCanvasTestHooks.getDoc());
    assert.deepEqual(afterFullAttempt,beforeFull,'adding a block when there is no space leaves the document unchanged');
    const fullMessage=await page.locator('#status-line').innerText();
    assert(/no space/i.test(fullMessage),'a clear message explains why the block could not be added');

    // === Repeated additions each find free space, with no overlaps, until the grid fills ===
    await loadFixtureDoc(page,{id:'repeat-fixture',title:'Repeat fixture',blocks:[]});
    for(let i=0;i<8;i++)await page.click('#add-card');
    const repeatedDoc=await page.evaluate(()=>window.__visualCanvasTestHooks.getDoc());
    assert.equal(repeatedDoc.blocks.length,8,'eight repeated additions all found free space');
    for(let i=0;i<repeatedDoc.blocks.length;i++)
      for(let j=i+1;j<repeatedDoc.blocks.length;j++)
        assert.equal(Layout.regionsOverlap(repeatedDoc.blocks[i].desktop,repeatedDoc.blocks[j].desktop),false,`repeated blocks ${i} and ${j} do not overlap`);
    let lastDoc=repeatedDoc;
    for(let i=0;i<20;i++){
      await page.click('#add-card');
      const current=await page.evaluate(()=>window.__visualCanvasTestHooks.getDoc());
      if(current.blocks.length===lastDoc.blocks.length)break;
      lastDoc=current;
    }
    const beforeFinalAttempt=lastDoc;
    await page.click('#add-card');
    const afterFinalAttempt=await page.evaluate(()=>window.__visualCanvasTestHooks.getDoc());
    assert.deepEqual(afterFinalAttempt,beforeFinalAttempt,'once the grid is full, a further addition is rejected without altering the existing layout');

    // === Properties-panel typing preserves focus, cursor position and selection ===
    await loadFixtureDoc(page,soloDoc);
    await page.locator('.vcb-block').first().click();
    const textarea=page.locator('#properties-panel textarea').first();
    await textarea.click();
    await textarea.fill('Hello world');
    await textarea.evaluate(el=>{el.selectionStart=el.selectionEnd=5;});
    await page.keyboard.type(' there');
    const midEditResult=await textarea.evaluate(el=>({value:el.value,selectionStart:el.selectionStart,isActive:document.activeElement===el}));
    assert.equal(midEditResult.value,'Hello there world','typing mid-sentence inserts at the cursor instead of resetting the field');
    assert.equal(midEditResult.selectionStart,11,'the cursor stays immediately after the inserted text');
    assert.equal(midEditResult.isActive,true,'the textarea keeps focus while the canvas/preview update around it');
    const midEditDoc=await page.evaluate(()=>window.__visualCanvasTestHooks.getDoc());
    assert.equal(midEditDoc.blocks[0].text,'Hello there world','the underlying document reflects the mid-sentence edit immediately');

    await page.click('#add-card');
    const cardTitleInput=page.locator('#properties-panel label').filter({hasText:'Title'}).locator('input');
    await cardTitleInput.click();
    await cardTitleInput.fill('Card Title');
    await cardTitleInput.evaluate(el=>{el.selectionStart=el.selectionEnd=4;});
    await page.keyboard.type('XXXX');
    const cardTitleResult=await cardTitleInput.evaluate(el=>({value:el.value,isActive:document.activeElement===el}));
    assert.equal(cardTitleResult.value,'CardXXXX Title','title field inserts typed text at the cursor position, not at the end');
    assert.equal(cardTitleResult.isActive,true,'title input keeps focus during the edit');

    const linkInput=page.locator('#properties-panel label').filter({hasText:'Link'}).locator('input');
    await linkInput.click();
    await linkInput.fill('items.html');
    await page.keyboard.type('#top');
    assert.equal(await linkInput.inputValue(),'items.html#top','link field keeps typed text');
    assert.equal(await linkInput.evaluate(el=>document.activeElement===el),true,'link field keeps focus during the edit');

    const altInput=page.locator('#properties-panel label').filter({hasText:'Image description'}).locator('input');
    await altInput.click();
    await altInput.fill('A fixture image');
    await page.keyboard.type('.');
    assert.equal(await altInput.inputValue(),'A fixture image.','image description field keeps typed text');
    assert.equal(await altInput.evaluate(el=>document.activeElement===el),true,'image description field keeps focus during the edit');

    // === Remaining checks run against the original sample fixture ===
    await page.goto(base+'/visual-page-builder.html');
    await page.waitForSelector('.vcb-block');

    const targetBlock=page.locator('.vcb-block').nth(1);
    await targetBlock.click();
    const selectedId=await page.evaluate(()=>window.__visualCanvasTestHooks.getSelectedId());

    const fontSizeSelect=page.locator('#properties-panel label').filter({hasText:'Text size'}).locator('select');
    await fontSizeSelect.selectOption({index:2});
    const styledDoc=await page.evaluate(()=>window.__visualCanvasTestHooks.getDoc());
    const styledBlock=styledDoc.blocks.find(b=>b.id===selectedId);
    assert.equal(styledBlock.style.fontSize,'lg','properties panel select updates block style');

    const thirdBlock=page.locator('.vcb-block').nth(2);
    await thirdBlock.click();
    const afterSwitch=await page.evaluate(()=>window.__visualCanvasTestHooks.getDoc());
    const preservedBlock=afterSwitch.blocks.find(b=>b.id===selectedId);
    assert.deepEqual(preservedBlock,styledDoc.blocks.find(b=>b.id===selectedId),'editing a different block preserves prior edits');

    await page.click('#preview-mobile');
    await page.waitForSelector('.vcb-preview-frame.is-mobile');
    const afterMobilePreview=await page.evaluate(()=>window.__visualCanvasTestHooks.getDoc());
    assert.deepEqual(afterMobilePreview,afterSwitch,'switching preview size preserves unsaved edits');
    const mobileHtml=await page.locator('#preview-output .mobile-stack').count();
    assert.equal(mobileHtml,1,'mobile preview renders stacked layout');
    await page.click('#preview-desktop');
    await page.waitForSelector('.vcb-preview-frame:not(.is-mobile)');

    await page.click('#add-image');
    const imageSelectOptions=await page.$$eval('#properties-panel select',selects=>selects.find(s=>s.previousElementSibling && /Image \(approved/.test(s.previousElementSibling.textContent)).innerHTML);
    const approvedImages=Fixtures.approvedImages;
    for(const image of approvedImages)assert(imageSelectOptions.includes(image),`approved image ${image} is selectable`);
    assert(!/images\/not-in-library/.test(imageSelectOptions),'unapproved images are never offered');

    await page.click('.vcb-block >> nth=0');
    const safeTextarea=page.locator('#properties-panel textarea').first();
    await safeTextarea.fill('<img src=x onerror=alert(1)>safe text');
    await page.waitForTimeout(50);
    const injected=await page.evaluate(()=>document.querySelectorAll('#preview-output img[src="x"]').length);
    assert.equal(injected,0,'typed HTML-looking text is not rendered as markup in the preview');
    const previewText=await page.locator('#preview-output').innerText();
    assert(previewText.includes('safe text'),'typed text content still renders as text');

    await page.setViewportSize({width:375,height:800});
    await page.waitForTimeout(50);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    assert(overflow<=1,`no horizontal overflow at 375px viewport (overflow=${overflow})`);
    await page.setViewportSize({width:1280,height:900});

    console.log('Browser interaction tests passed.');
  }finally{
    await browser.close();
    server.close();
  }
}

(async()=>{
  modelTests();
  layoutTests();
  await browserTests();
  console.log('All visual page builder fixture tests passed.');
})().catch(error=>{
  console.error('Visual page builder test failure:',error);
  process.exitCode=1;
});
