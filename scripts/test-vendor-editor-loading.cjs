const {chromium}=require('playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const server=http.createServer((req,res)=>{
  const name=new URL(req.url,'http://local').pathname;
  if(name==='/harness'){res.setHeader('Content-Type','text/html');res.end('<iframe id="editor" src="vendors-admin.html?embed=1"></iframe><script>addEventListener("message",e=>{if(e.data.type==="scavland-admin-ready")e.source.postMessage({type:"scavland-admin-token",token:"local-test"},location.origin)})</script>');return;}
  const file=path.resolve(root,'.'+decodeURIComponent(name));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'}[path.extname(file)]||'application/octet-stream'));res.end(fs.readFileSync(file));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{
  browser=await chromium.launch({headless:true,channel:'msedge'});
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://demtoqsafufzmnhvaykj.supabase.co/**',route=>route.fulfill({json:true}));
  const url='http://127.0.0.1:'+server.address().port+'/harness';
  await page.goto(url);let frame=page.frameLocator('#editor');await frame.locator('#new-record').waitFor();
  assert.equal(await frame.locator('.choice').count(),22);
  await frame.locator('#search').fill('Ilya');await frame.locator('.choice').click();await frame.locator('#preview').click();
  assert.ok((await frame.locator('#preview-panel').innerText()).includes('Ilya'));
  console.log('PASS repaired data: 22 vendors load, search, open and preview');
  await page.route('**/data/vendors.json',route=>route.fulfill({contentType:'application/json',body:'{"location": The Mire}'}));
  await page.goto(url);frame=page.frameLocator('#editor');await frame.locator('#session-status').filter({hasText:'Its data format is invalid'}).waitFor();
  assert.ok((await frame.locator('#session-status').innerText()).includes('data/vendors.json'));
  assert.deepEqual(errors,[]);console.log('PASS malformed data: helpful error with filename, no records.filter crash');
 }finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
