// Combined local release acceptance. Production Auth, Storage and Git remain separate.
const {spawnSync}=require('node:child_process'),path=require('node:path');
const root=path.resolve(__dirname,'..');
for(const file of ['attachment-rollout-manifest.cjs','evidence-rollout-manifest.cjs']){const result=require('./'+file).manifest();console.log('Validated '+file+': '+result.files.length+' dependencies; live acceptance remains separate.');}
const suites=['test-attachment-release.cjs','test-release-config.cjs','test-admin-release-integration.cjs','test-admin-hub-permissions.cjs','test-evidence-review-storage.cjs','test-evidence-review-api.cjs','test-evidence-review-hub.cjs','test-evidence-review-browser.cjs','test-evidence-review-integrated.cjs','test-shared-catalogue.cjs','test-item-catalog.cjs','test-item-draft.cjs','test-item-draft-storage.cjs','test-legacy-item-import.cjs','test-legacy-item-review.cjs','test-items-builder.cjs','test-items-editor.cjs','test-vendor-builder.cjs','test-dashboard.cjs'];
if(process.env.SCAVLAND_PSQL)suites.push('test-attachment-concurrency.cjs','test-evidence-review-concurrency.cjs');
else console.log('Independent PostgreSQL concurrency not included: set SCAVLAND_PSQL with the isolated local server running.');
for(const suite of suites){console.log('Checking '+suite);const result=spawnSync(process.execPath,[path.join(__dirname,suite)],{cwd:root,env:{...process.env,SCAVLAND_BROWSER:'1'},stdio:'inherit',timeout:180000});if(result.error||result.status!==0){console.error('Stopped at '+suite+': '+(result.error?.message||result.status));process.exit(result.status||1);}}
console.log('PASS combined local admin release acceptance. No deployment or activation authorized by this result.');
