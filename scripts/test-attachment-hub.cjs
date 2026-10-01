const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('admin.html','utf8');
const source=html.match(/const permissionViews=\{[\s\S]*?\n};/)[0];
const allowed=html.match(/function allowedAdminViews\(\)\{[\s\S]*?\n}/)[0];
const send=html.match(/function sendSession\(frame\)\{[^\n]+/)[0];
function harness(enabled,permissions,authorized=true){
 const messages=[];const context={ATTACHMENT_RELEASE_ENABLED:enabled,adminProfile:{role:'admin',permissions},authorized,accessToken:'fixture-token',location:{origin:'https://fixture.test'},messages};vm.createContext(context);
 vm.runInContext(source+'\n'+allowed+'\n'+send,context);
 const frame={id:'attachments-frame',contentWindow:{postMessage:(body,origin)=>messages.push({body,origin})}};
 return {context,messages,frame};
}
for(const [enabled,permissions,expected] of [[false,['items_edit'],false],[true,['weapons_edit'],false],[true,['items_edit'],true],[true,[],false]]){
 const h=harness(enabled,permissions);assert.equal(vm.runInContext("allowedAdminViews().has('attachments')",h.context),expected);h.context.frame=h.frame;vm.runInContext('sendSession(frame)',h.context);assert.equal(h.messages.length,expected?1:0);if(expected)assert.equal(h.messages[0].origin,'https://fixture.test');
}
const owner=harness(true,[]);owner.context.adminProfile.role='owner';assert(vm.runInContext("allowedAdminViews().has('attachments')",owner.context));owner.context.frame=owner.frame;vm.runInContext('sendSession(frame)',owner.context);assert.equal(owner.messages.length,1);
const h=harness(true,['items_edit'],false);h.context.frame=h.frame;vm.runInContext('sendSession(frame)',h.context);assert.equal(h.messages.length,0);
assert.match(html,/const ATTACHMENT_RELEASE_ENABLED=false/);
assert.match(html,/attachment-category\.html\?embed=1&amp;v=attachment-preparation-20261001-3/);
assert.match(html,/'attachments-frame'\]\.some/);
const child=fs.readFileSync('attachment-category.html','utf8');for(const asset of ['attachment-category.css','attachment-model.js','attachment-category.js'])assert(child.includes(asset+'?v=attachment-preparation-20261001-3'),'versioned child asset '+asset);
console.log('PASS Attachment Hub release/permission gates and session refusal for unauthorized or disabled access.');

if(process.env.SCAVLAND_BROWSER==='1')(async()=>{
 const {chromium}=require('playwright'),path=require('node:path');const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{for(const [enabled,permissions,expected] of [[false,['items_edit'],false],[true,['weapons_edit'],false],[true,['items_edit'],true]]){
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://demtoqsafufzmnhvaykj.supabase.co/**',r=>r.fulfill({contentType:'application/json',body:'{}'}));
 await page.route('https://fixture.test/**',r=>{const name=new URL(r.request().url()).pathname.slice(1);
 if(name==='admin.html')return r.fulfill({contentType:'text/html',body:html.replace('const ATTACHMENT_RELEASE_ENABLED=false','const ATTACHMENT_RELEASE_ENABLED='+enabled)});
 if(name==='attachment-category.html')return r.fulfill({contentType:'text/html',body:'<p>Attachment fixture</p><script>addEventListener("message",e=>{if(e.source===parent&&e.origin===location.origin)document.body.dataset.received=e.data.token});parent.postMessage({type:"scavland-admin-ready"},location.origin)</script>'});
 return r.fulfill({path:path.resolve(name)});
 });
 await page.goto('https://fixture.test/admin.html');await page.evaluate(permissions=>{authorized=true;accessToken='fixture-token';adminProfile={role:'admin',permissions};applyAdminPermissions();navigate('hub')},permissions);
 const button=page.locator('[data-view="attachments"]');assert.equal(await button.isDisabled(),!expected);
 if(expected){await button.click();await page.locator('#attachments:not(.hidden)').waitFor();await page.frameLocator('#attachments-frame').locator('body[data-received="fixture-token"]').waitFor();await page.locator('#attachments .hub-button').click();await page.locator('#hub:not(.hidden)').waitFor();}
 else{await page.evaluate(()=>navigate('attachments'));assert.equal(await page.locator('#attachments-frame').getAttribute('src'),null);}
 assert.deepEqual(errors,[]);await page.close();
 }console.log('PASS browser Hub gate, permission refusal, Attachment navigation/session and return to Hub.');}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
