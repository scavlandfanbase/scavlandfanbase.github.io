const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
(async()=>{
 let handler;const writes=[];
 const run=async(email,owner=true)=>{
 writes.length=0;
 vm.runInNewContext(fs.readFileSync('supabase/functions/manage-admin-users/index.ts','utf8'),{Response,Request,Map,JSON,Error,encodeURIComponent,Deno:{env:{get:()=> 'test'},serve:fn=>handler=fn},fetch:async(url,opt={})=>{
 if(url.endsWith('/auth/v1/user'))return Response.json({id:'owner'});
 if(url.endsWith('/rpc/is_scavland_owner'))return Response.json(owner);
 if(url.includes('/auth/v1/admin/users'))return Response.json({users:[{id:'owner',email:'owner@example.invalid'},{id:'invited',email:'invited@example.invalid'}]});
 if(url.includes('/admin_users?select='))return Response.json([{user_id:'owner',role:'owner'}]);
 writes.push({url,opt});return new Response(null,{status:201});
 }});
 return handler(new Request('https://local',{method:'POST',headers:{Authorization:'Bearer test'},body:JSON.stringify({action:'invite',email,role:'admin'})}));
 };
 assert.equal((await run('invited@example.invalid')).status,200);assert.equal(writes.length,1);assert.ok(writes[0].url.includes('admin_users?on_conflict='));
 assert.equal((await run('owner@example.invalid')).status,400);assert.equal(writes.length,0);
 assert.equal((await run('invited@example.invalid',false)).status,403);assert.equal(writes.length,0);
 console.log('PASS retry saves existing invite without email; Owner protected; non-owner rejected');
})();
