const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('index.html','utf8');
const start=source.indexOf('  const canonicalInternalPages='),end=source.indexOf('  let contentSaveQueue=',start);
assert(start>=0&&end>start);
const context=vm.createContext({});vm.runInContext(source.slice(start,end)+';this.normalise=normaliseBoxHref;',context);
for(const link of ['/pages/guides/','/pages/player-guides/','/pages/guides/#start','/pages/guides/?topic=ammo','weapons.html','https://example.com/'])assert.equal(context.normalise(link),link);
for(const link of ['/pages/guides.html','/pages/../admin/','//example.com/pages/guides/','javascript:alert(1)','/pages/guides/extra','/pages/Guides/','/pages/guides/\\evil'])assert.equal(context.normalise(link),null,link);
console.log('PASS homepage links accept canonical Page Builder routes and reject malformed routes.');
