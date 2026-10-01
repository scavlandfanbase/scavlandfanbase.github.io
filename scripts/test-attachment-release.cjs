// Full local Attachment release checks. Uses fixture Auth/Git and temporary SQL only.
const {spawnSync}=require('node:child_process'),path=require('node:path');
const suites=['test-shared-attachment-review.cjs','test-attachment-draft.cjs','test-attachment-api.cjs','test-attachment-routing.cjs','test-attachment-publication.cjs','test-attachment-storage.cjs','test-attachment-hub.cjs','test-attachment-browser.cjs','test-admin01-core.cjs','test-admin-invites.cjs'];
for(const suite of suites){
 console.log('\nChecking '+suite);
 const result=spawnSync(process.execPath,[path.join(__dirname,suite)],{cwd:path.resolve(__dirname,'..'),env:{...process.env,SCAVLAND_BROWSER:'1'},stdio:'inherit'});
 if(result.error){console.error(result.error.message);process.exit(1);}
 if(result.status!==0){console.error('Release checks stopped at '+suite);process.exit(result.status||1);}
}
console.log('\nPASS all local Attachment release suites. Live Auth, simultaneous production sessions and deployment acceptance remain separate.');
