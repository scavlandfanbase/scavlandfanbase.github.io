// Isolated test suite for the fixture-only visual canvas. Does not touch any
// live save/history/publication service, production page model or game data.
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const Model=require('../visual-canvas-model.js');
const Renderer=require('../visual-canvas-renderer.js');
const Fixtures=require('../visual-canvas-fixtures.js');

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

async function browserTests(){
  const server=createStaticServer();
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch();
  try{
    const page=await browser.newPage({viewport:{width:1280,height:900}});
    await page.goto(base+'/visual-page-builder.html');
    await page.waitForSelector('.vcb-block');

    // Selection and properties panel. The heading block spans the full width, so
    // use the narrower image block (index 1) for move/resize interaction tests.
    const firstBlock=page.locator('.vcb-block').first();
    await firstBlock.click();
    await assert_eq(await firstBlock.getAttribute('aria-selected'),'true','first block selected on click');
    await page.waitForSelector('#properties-panel select');

    const targetBlock=page.locator('.vcb-block').nth(1);
    await targetBlock.click();
    const selectedId=await page.evaluate(()=>window.__visualCanvasTestHooks.getSelectedId());
    const before=await page.evaluate(()=>window.__visualCanvasTestHooks.getDoc());

    // Keyboard move: ArrowRight should move the selected block one column right.
    await targetBlock.focus();
    await page.keyboard.press('ArrowRight');
    const afterMove=await page.evaluate(()=>window.__visualCanvasTestHooks.getDoc());
    const beforeBlock=before.blocks.find(b=>b.id===selectedId);
    const afterBlock=afterMove.blocks.find(b=>b.id===selectedId);
    assert.equal(afterBlock.desktop.x,beforeBlock.desktop.x+1,'ArrowRight moves block right by one column');

    // Keyboard resize: Shift+ArrowDown should grow height.
    await page.keyboard.press('Shift+ArrowDown');
    const afterResize=await page.evaluate(()=>window.__visualCanvasTestHooks.getDoc());
    const resizedBlock=afterResize.blocks.find(b=>b.id===selectedId);
    assert.equal(resizedBlock.desktop.h,afterBlock.desktop.h+1,'Shift+ArrowDown grows block height by one row');

    // Button alternative: move-left button should move it back left.
    await page.click('#move-left');
    const afterButtonMove=await page.evaluate(()=>window.__visualCanvasTestHooks.getDoc());
    const buttonMovedBlock=afterButtonMove.blocks.find(b=>b.id===selectedId);
    assert.equal(buttonMovedBlock.desktop.x,resizedBlock.desktop.x-1,'Move-left button moves block left by one column');

    // Drag (pointer) move: drag the block via mouse and confirm position changes.
    const box=await targetBlock.boundingBox();
    const dragBefore=await page.evaluate(()=>window.__visualCanvasTestHooks.getDoc());
    const dragBeforeBlock=dragBefore.blocks.find(b=>b.id===selectedId);
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
    await page.mouse.down();
    await page.mouse.move(box.x+box.width/2+120,box.y+box.height/2+50,{steps:5});
    await page.mouse.up();
    const dragAfter=await page.evaluate(()=>window.__visualCanvasTestHooks.getDoc());
    const dragAfterBlock=dragAfter.blocks.find(b=>b.id===selectedId);
    assert(dragAfterBlock.desktop.x>dragBeforeBlock.desktop.x,'Dragging the block moved it right');
    assert(dragAfterBlock.desktop.y>dragBeforeBlock.desktop.y,'Dragging the block moved it down');

    // Resize via handle drag.
    const handle=targetBlock.locator('.vcb-handle-se');
    const handleBox=await handle.boundingBox();
    const resizeBefore=await page.evaluate(()=>window.__visualCanvasTestHooks.getDoc());
    const resizeBeforeBlock=resizeBefore.blocks.find(b=>b.id===selectedId);
    await page.mouse.move(handleBox.x+handleBox.width/2,handleBox.y+handleBox.height/2);
    await page.mouse.down();
    await page.mouse.move(handleBox.x+80,handleBox.y+40,{steps:5});
    await page.mouse.up();
    const resizeAfter=await page.evaluate(()=>window.__visualCanvasTestHooks.getDoc());
    const resizeAfterBlock=resizeAfter.blocks.find(b=>b.id===selectedId);
    assert(resizeAfterBlock.desktop.w>=resizeBeforeBlock.desktop.w,'Handle drag grows width');
    assert(resizeAfterBlock.desktop.h>=resizeBeforeBlock.desktop.h,'Handle drag grows height');

    // Properties panel edit: change text size and confirm the style updates.
    const fontSizeSelect=page.locator('#properties-panel label').filter({hasText:'Text size'}).locator('select');
    await fontSizeSelect.selectOption({index:2});
    const styledDoc=await page.evaluate(()=>window.__visualCanvasTestHooks.getDoc());
    const styledBlock=styledDoc.blocks.find(b=>b.id===selectedId);
    assert.equal(styledBlock.style.fontSize,'lg','properties panel select updates block style');

    // Unsaved-edit preservation across selection switch.
    const thirdBlock=page.locator('.vcb-block').nth(2);
    await thirdBlock.click();
    const afterSwitch=await page.evaluate(()=>window.__visualCanvasTestHooks.getDoc());
    const preservedBlock=afterSwitch.blocks.find(b=>b.id===selectedId);
    assert.deepEqual(preservedBlock,styledDoc.blocks.find(b=>b.id===selectedId),'editing a different block preserves prior edits');

    // Unsaved-edit preservation across preview size switch.
    await page.click('#preview-mobile');
    await page.waitForSelector('.vcb-preview-frame.is-mobile');
    const afterMobilePreview=await page.evaluate(()=>window.__visualCanvasTestHooks.getDoc());
    assert.deepEqual(afterMobilePreview,afterSwitch,'switching preview size preserves unsaved edits');
    const mobileHtml=await page.locator('#preview-output .mobile-stack').count();
    assert.equal(mobileHtml,1,'mobile preview renders stacked layout');
    await page.click('#preview-desktop');
    await page.waitForSelector('.vcb-preview-frame:not(.is-mobile)');

    // Image selection restricted to approved list.
    await page.click('#add-image');
    const imageSelectOptions=await page.$$eval('#properties-panel select',selects=>selects.find(s=>s.previousElementSibling && /Image \(approved/.test(s.previousElementSibling.textContent)).innerHTML);
    const approvedImages=Fixtures.approvedImages;
    for(const image of approvedImages)assert(imageSelectOptions.includes(image),`approved image ${image} is selectable`);
    assert(!/images\/not-in-library/.test(imageSelectOptions),'unapproved images are never offered');

    // Safe text rendering: typing an HTML-looking string into a text field must not inject markup.
    await page.click('.vcb-block >> nth=0');
    const textarea=page.locator('#properties-panel textarea').first();
    await textarea.fill('<img src=x onerror=alert(1)>safe text');
    await page.waitForTimeout(50);
    const injected=await page.evaluate(()=>document.querySelectorAll('#preview-output img[src="x"]').length);
    assert.equal(injected,0,'typed HTML-looking text is not rendered as markup in the preview');
    const previewText=await page.locator('#preview-output').innerText();
    assert(previewText.includes('safe text'),'typed text content still renders as text');

    // Narrow viewport layout: builder UI and preview must not overflow horizontally.
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

async function assert_eq(actual,expected,message){
  assert.equal(actual,expected,message);
}

(async()=>{
  modelTests();
  await browserTests();
  console.log('All visual page builder fixture tests passed.');
})().catch(error=>{
  console.error('Visual page builder test failure:',error);
  process.exitCode=1;
});
