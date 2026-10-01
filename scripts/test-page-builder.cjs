const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createServer}=require('./page-builder-server.cjs'),Builder=require('../page-builder-contract.js');

const draft=(overrides={})=>({id:'fixture-page',title:'Fixture <script>alert(1)</script>',slug:'fixture-page',intro:'Local fixture only.',sections:[{id:'section-one',title:'Welcome',hidden:false,layout:{columns:2,align:'center',spacing:'normal',background:'surface',border:true},blocks:[{id:'heading-one',type:'heading',title:'Safe heading',hidden:false}]}],...overrides});
async function main(){
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'scav-page-builder-test-'));
  const server=createServer({directory});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const base=`http://127.0.0.1:${server.address().port}`;
    assert.equal((await fetch(base+'/')).status,404);
    assert.equal((await fetch(base+'/api/pages')).status,403);
    const session=await (await fetch(base+'/api/session')).json();
    const headers={'X-Scav-Session':session.token};
    const list=await (await fetch(base+'/api/pages',{headers})).json();
    assert.equal(list.pages.length,0);
    assert(list.imageChoices.some(image=>image.startsWith('images/')));
    assert(list.imageChoices.every(image=>!image.startsWith('evidence-inbox/')));
    const post=body=>fetch(base+'/api/pages',{method:'POST',headers:{...headers,Origin:base,'Content-Type':'application/json'},body:JSON.stringify(body)});
    const created=await post({action:'create',page:draft()});
    assert.equal(created.status,200);
    const record=(await created.json()).record;
    assert.equal(record.revision,1);
    assert.equal(record.draft.sections[0].layout.columns,2);
    assert(!Object.hasOwn(record,'published'));
    assert.equal((await post({action:'create',page:draft({id:'other-page'})})).status,409);
    assert.equal((await post({action:'create',page:draft({id:'reserved-page',slug:'items'})})).status,400);
    assert.equal((await post({action:'create',page:draft({id:'bad-image',slug:'bad-image',sections:[{id:'section-bad',title:'',hidden:false,layout:{},blocks:[{id:'image-bad',type:'image',image:'images/../private.png',alt:'bad',hidden:false}]}]})})).status,400);
    assert.equal((await post({action:'publish',id:record.draft.id,revision:1})).status,400);
    assert.equal((await fetch(base+'/pages/fixture-page')).status,404);
    const exported=Builder.document(record.draft,{images:list.imageChoices,css:'.page-preview{color:#fff}'});
    assert(!exported.includes('<script>alert(1)</script>'));
    assert(exported.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
    const changed=draft({title:'Saved fixture'});
    assert.equal((await post({action:'save',id:record.draft.id,revision:0,page:changed})).status,409);
    const saved=await post({action:'save',id:record.draft.id,revision:1,page:changed});
    assert.equal(saved.status,200);
    assert.equal((await saved.json()).record.revision,2);
    assert.equal((await post({action:'delete',id:record.draft.id,revision:1})).status,409);
    assert.equal((await post({action:'delete',id:record.draft.id,revision:2})).status,200);
    assert.equal((await (await fetch(base+'/api/pages',{headers})).json()).pages.length,0);
    assert.throws(()=>Builder.validate(draft({sections:[{id:'bad-layout',title:'',hidden:false,layout:{columns:4},blocks:[]}]})),/layout/);
    assert.throws(()=>Builder.validate(draft({slug:'bad/slug'})),/page address/);
    assert.throws(()=>Builder.validate(draft({sections:[{id:'bad-link',title:'',hidden:false,layout:{},blocks:[{id:'bad-button',type:'button',title:'Bad',href:'javascript:alert(1)',hidden:false}]}]})),/HTTPS link/);
    console.log('PASS Page Builder service: local-only draft CRUD, private image choices, validation, escaping, no publish route, stale revisions and deletion.');
  }finally{
    await new Promise(resolve=>server.close(resolve));
    fs.rmSync(directory,{recursive:true,force:true});
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});