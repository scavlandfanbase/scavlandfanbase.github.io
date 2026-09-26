const {chromium}=require('playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'..'),vendors=JSON.parse(fs.readFileSync(path.join(root,'data/vendors.json'))).data;
 const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'}[path.extname(file)]||'application/octet-stream'));res.end(fs.readFileSync(file));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({headless:true,channel:'msedge'});
  const page=await browser.newPage(),errors=[],writes=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))writes.push(r.url());});
  const base='http://127.0.0.1:'+server.address().port;
  await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
  await page.goto(base+'/vendor-builder.html');await page.locator('#local-link').waitFor();assert.equal(await page.locator('#workspace').isVisible(),false);
  assert.deepEqual(writes,[]);
  await page.goto(base+'/vendors.html');await page.locator('.vendor-header').first().waitFor();assert.equal(await page.locator('.vendor-header').count(),vendors.length);
  await page.locator('#vendorSearch').fill('Grigory');await page.locator('.vendor-header:visible').first().click();await page.locator('.vendor-modal-close:visible').waitFor();await page.keyboard.press('Escape');
  assert.equal(await page.locator('.vendor-modal-close:visible').count(),0);
  assert(writes.every(url=>url.endsWith('/functions/v1/track-site-session')));assert.deepEqual(errors,[]);
  console.log('PASS public vendors: record count, search, open/close details; no shell writes or browser errors (public analytics blocked)');
 }finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
