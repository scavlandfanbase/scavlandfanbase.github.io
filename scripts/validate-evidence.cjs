const fs = require('node:fs');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const load = name => JSON.parse(fs.readFileSync(`data/${name}.json`, 'utf8')).data;
const items = load('items'), armour = load('armour'), vendors = load('vendors');
for (const records of [items, armour, vendors]) assert.equal(new Set(records.map(x => x.id)).size, records.length);
for (const vendor of vendors) {
  for (const row of vendor.inventory) assert(items.some(item => item.id === row.itemId), `${vendor.id}: ${row.itemId}`);
  for (const shot of vendor.shopEvidence?.screenshots || []) assert(fs.existsSync(shot.file), shot.file);
  if (vendor.portrait) assert(fs.existsSync(vendor.portrait.file), vendor.portrait.file);
}
for (const slug of ['old-tactical-pants', 'old-tactical-vest']) {
  const gear = armour.find(x => x.id === slug), item = items.find(x => x.id === slug);
  assert.equal(gear.durability, 100);
  assert.equal(gear.source.status, 'screenshot-verified');
  assert.equal(item.source.file, gear.source.file);
  assert(fs.existsSync(gear.source.file));
}
const index = JSON.parse(fs.readFileSync('evidence-analysis.json', 'utf8'));
assert.equal(index.count, index.files.length);
for (const row of index.files) assert(fs.existsSync(`evidence-inbox/${row.file}`), row.file);
for (const page of ['vendors.html','armour.html','items.html']) {
  for (const script of fs.readFileSync(page,'utf8').matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) new vm.Script(script[1], {filename:page});
}
console.log(`PASS: ${vendors.length} vendors, ${vendors.reduce((n,v)=>n+v.inventory.length,0)} inventory links, ${index.count} evidence paths; unique IDs, armour links and page JavaScript.`);
for (const [label,records] of [['Armour',armour],['Items',items]]) console.log(`${label}: ${records.filter(x=>x.source?.status==='screenshot-verified').length}/${records.length} verified`);
