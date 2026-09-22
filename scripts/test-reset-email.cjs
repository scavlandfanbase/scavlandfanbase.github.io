const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
(async()=>{const html=fs.readFileSync('admin.html','utf8'),source=html.slice(html.indexOf('async function resetPassword()'),html.indexOf('async function adminApi'));
const nodes={email:{value:'test@example.invalid',checkValidity:()=>true},forgot:{disabled:false},'login-status':{textContent:''}};
for(const [status,body,expected] of [[429,{error_code:'over_email_send_rate_limit'},'temporarily limited'],[400,{msg:'Email address not authorized'},'Email address not authorized'],[200,{},'Check your inbox']]){
 const ctx={$:id=>nodes[id],location:{origin:'https://scavlandfanbase.github.io'},encodeURIComponent,api:async()=>({status,ok:status===200,json:async()=>body})};vm.createContext(ctx);vm.runInContext(source,ctx);await ctx.resetPassword();assert.ok(nodes['login-status'].textContent.includes(expected));assert.equal(nodes.forgot.disabled,false);
}console.log('PASS reset-email rate limit, service error and success messages');})();
