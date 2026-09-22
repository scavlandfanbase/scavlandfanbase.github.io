// Exports data/*.json into user-friendly spreadsheets under bulk-edit/.
// Run: node scripts/bulk-edit-export.cjs
const fs = require('node:fs');
const path = require('node:path');
const { writeCSVFile } = require('./csv-utils.cjs');

const OUT_DIR = path.join(__dirname, '..', 'bulk-edit');
fs.mkdirSync(OUT_DIR, { recursive: true });

const readJSON = file => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', file), 'utf8'));

const num = value => (value === null || value === undefined ? '' : value);
const list = value => (Array.isArray(value) ? value.join(';') : '');
const bool = value => (value === true ? 'TRUE' : value === false ? 'FALSE' : '');

function exportCategory(name, file, headers, toRow) {
  const doc = readJSON(file);
  const rows = doc.data.map(toRow);
  writeCSVFile(path.join(OUT_DIR, `${name}.csv`), rows, headers);
  console.log(`Wrote bulk-edit/${name}.csv (${rows.length} rows)`);
}

exportCategory('items', 'items.json', [
  'id', 'name', 'classification', 'estimatedPrice', 'rank', 'maxStack', 'stackable',
  'effects_health', 'effects_bleed', 'effects_radiation', 'effects_hunger', 'effects_thirst',
  'notes', 'image', 'source_status', 'source_file', 'source_note',
], item => ({
  id: item.id,
  name: item.name,
  classification: list(item.classification),
  estimatedPrice: num(item.estimatedPrice),
  rank: num(item.rank),
  maxStack: num(item.maxStack),
  stackable: bool(item.stackable),
  effects_health: num(item.effects?.health),
  effects_bleed: num(item.effects?.bleed),
  effects_radiation: num(item.effects?.radiation),
  effects_hunger: num(item.effects?.hunger),
  effects_thirst: num(item.effects?.thirst),
  notes: item.notes ?? '',
  image: item.image ?? '',
  source_status: item.source?.status ?? '',
  source_file: item.source?.file ?? '',
  source_note: item.source?.note ?? '',
}));

exportCategory('weapons', 'weapons.json', [
  'id', 'name', 'category', 'tier', 'ammo', 'damage', 'rpm', 'range', 'accuracy',
  'recoil', 'handling', 'ergonomics', 'reload', 'image', 'source_status', 'source_file', 'source_note',
], weapon => ({
  id: weapon.id,
  name: weapon.name,
  category: weapon.category ?? '',
  tier: weapon.tier ?? '',
  ammo: weapon.ammo ?? '',
  damage: num(weapon.damage),
  rpm: num(weapon.rpm),
  range: num(weapon.range),
  accuracy: num(weapon.accuracy),
  recoil: num(weapon.recoil),
  handling: num(weapon.handling),
  ergonomics: num(weapon.ergonomics),
  reload: num(weapon.reload),
  image: weapon.image ?? '',
  source_status: weapon.source?.status ?? '',
  source_file: weapon.source?.file ?? '',
  source_note: weapon.source?.note ?? '',
}));

exportCategory('armour', 'armour.json', [
  'id', 'name', 'category', 'vendorRank', 'price', 'ballistic', 'slash', 'radiation',
  'durability', 'repairClass', 'stackable', 'description', 'image', 'source_status', 'source_file', 'source_note',
], armour => ({
  id: armour.id,
  name: armour.name,
  category: armour.category ?? '',
  vendorRank: armour.vendorRank ?? '',
  price: num(armour.price),
  ballistic: num(armour.ballistic),
  slash: num(armour.slash),
  radiation: num(armour.radiation),
  durability: num(armour.durability),
  repairClass: armour.repairClass ?? '',
  stackable: bool(armour.stackable),
  description: armour.description ?? '',
  image: armour.image ?? '',
  source_status: armour.source?.status ?? '',
  source_file: armour.source?.file ?? '',
  source_note: armour.source?.note ?? '',
}));

exportCategory('ammo', 'ammo.json', [
  'id', 'name', 'category', 'estimatedPrice', 'damage', 'penetrationPercent', 'maxStack',
  'rank', 'description', 'source_status', 'source_file', 'source_note',
], ammo => ({
  id: ammo.id,
  name: ammo.name,
  category: ammo.category ?? '',
  estimatedPrice: num(ammo.estimatedPrice),
  damage: num(ammo.damage),
  penetrationPercent: num(ammo.penetrationPercent),
  maxStack: num(ammo.maxStack),
  rank: num(ammo.rank),
  description: ammo.description ?? '',
  source_status: ammo.source?.status ?? '',
  source_file: ammo.source?.file ?? '',
  source_note: ammo.source?.note ?? '',
}));

exportCategory('crafting', 'crafting.json', [
  'id', 'name', 'workbench', 'ingredients', 'source_status', 'source_file', 'source_note',
], recipe => ({
  id: recipe.id,
  name: recipe.name,
  workbench: recipe.workbench ?? '',
  ingredients: (recipe.ingredients || []).map(entry => `${entry.name} x${entry.quantity}`).join('; '),
  source_status: recipe.source?.status ?? '',
  source_file: recipe.source?.file ?? '',
  source_note: recipe.source?.note ?? '',
}));

console.log('\nDone. Open the files in bulk-edit/ with Excel or Google Sheets.');
console.log('Read bulk-edit/README.md before editing.');
