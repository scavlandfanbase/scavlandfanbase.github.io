const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../admin.html'),'utf8');
assert.match(html,/const EVIDENCE_REVIEW_RELEASE_ENABLED=(?:false|true)/);assert.match(html,/evidence-review\.html\?embed=1&amp;v=evidence-review-20261001-1/);
assert.match(html,/'patches','evidence'\]\.forEach/);assert.match(html,/'patches-frame','evidence-frame'\]\.some/);
for(const enabled of [false,true])for(const authorized of [false,true])for(const allowed of [false,true]){
 let sent=0;const context={PAGE_BUILDER_RELEASE_ENABLED:false,authorized,EVIDENCE_REVIEW_RELEASE_ENABLED:enabled,accessToken:'fixture',location:{origin:'https://fixture.test'},allowedAdminViews:()=>new Set(allowed?['evidence']:[])};
 vm.createContext(context);vm.runInContext(html.split('\n').find(line=>line.startsWith('function sendSession(')),context);
 context.sendSession({id:'evidence-frame',contentWindow:{postMessage(message,origin){assert.equal(message.token,'fixture');assert.equal(origin,'https://fixture.test');sent++;}}});
 assert.equal(sent,enabled&&authorized&&allowed?1:0);
}
(async()=>{const {createProductionHandler}=await import('../supabase/functions/admin-drafts/production.mjs');let calls=0;
 const handler=createProductionHandler({env:()=>undefined,core:{publishers:{}},fetcher:async()=>{calls++;throw Error('No live request expected');}});
 const result=await handler(new Request('https://fixture',{method:'POST',body:JSON.stringify({domain:'evidence-review',action:'list',status:'pending'})}));assert.equal(result.status,503);assert.equal(calls,0);
 console.log('PASS Evidence Hub: disabled default/cache, session registration, permission/activation refusal and disabled backend route without network.');
})().catch(e=>{console.error(e);process.exitCode=1;});
