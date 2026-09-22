// Reads edited spreadsheets from bulk-edit/ and writes changes back into data/*.json.
// Run: node scripts/bulk-edit-import.cjs           (dry run, shows what would change)
//      node scripts/bulk-edit-import.cjs --write    (actually saves the changes)
const fs = require('node:fs');
const path = require('node:path');
const { readCSVFile } = require('./csv-utils.cjs');

const WRITE = process.argv.includes('--write');
const DATA_DIR = path.join(__dirname, '..', 'data');
const CSV_DIR = path.join(__dirname, '..', 'bulk-edit');
const today = new Date().toISOString().slice(0, 10);

const readJSON = file => JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
const writeJSON = (file, doc) => fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(doc, null, 2) + '\n');

const blank = value => value === undefined || value === null || String(value).trim() === '';
const toNumberOrNull = value => (blank(value) ? null : Number(value));
const toStringOrNull = value => (blank(value) ? null : String(value));
const toBoolOrNull = value => (blank(value) ? null : /^true$/i.test(value));
const toList = value => (blank(value) ? [] : String(value).split(';').map(s => s.trim()).filter(Boolean));
// Same convention the Admin Hub uses, so a new row here lines up with an id created there.
const slug = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

let totalChanged = 0;
let totalCreated = 0;
let totalDowngraded = 0;

function applyCategory({ csvName, jsonFile, valueFields, applyRow }) {
  const csvPath = path.join(CSV_DIR, `${csvName}.csv`);
  if (!fs.existsSync(csvPath)) { console.log(`Skipping ${csvName}: bulk-edit/${csvName}.csv not found.`); return; }
  const rows = readCSVFile(csvPath);
  const doc = readJSON(jsonFile);
  const byId = new Map(doc.data.map(record => [record.id, record]));
  let changedCount = 0;
  let createdCount = 0;
  let downgradedCount = 0;

  for (const row of rows) {
    let record = byId.get(row.id);
    let creating = false;

    if (!record && blank(row.id)) {
      if (blank(row.name)) { console.log(`  [${csvName}] WARNING: a new row needs a name before it can be added — row skipped.`); continue; }
      const newId = slug(row.name);
      const nameClash = doc.data.some(existing => slug(existing.name) === slug(row.name));
      if (!newId || byId.has(newId) || nameClash) { console.log(`  [${csvName}] WARNING: "${row.name}" looks like it already exists — row skipped. Edit its existing row (fill in its id) instead of adding a new one.`); continue; }
      record = { id: newId, source: { file: null, status: 'pending-review', note: null } };
      creating = true;
    } else if (!record) {
      console.log(`  [${csvName}] WARNING: id "${row.id}" not found in ${jsonFile} — row skipped. Leave "id" blank to add a brand new record instead.`);
      continue;
    }

    const before = JSON.stringify(record);
    const changedFields = applyRow(record, row);
    if (!creating && JSON.stringify(record) === before) continue;

    if (creating) {
      doc.data.push(record);
      byId.set(record.id, record);
      createdCount++;
      console.log(`  [${csvName}] NEW ${record.id}: ${changedFields.join(', ')}`);
      if (csvName === 'items' && !(record.classification || []).length) {
        console.log(`  [${csvName}] NOTE: ${record.id} has no classification tag set — it won't appear on any page until you add one (e.g. weapon, armour, ammunition).`);
      }
      continue;
    }

    changedCount++;
    console.log(`  [${csvName}] ${row.id}: ${changedFields.join(', ')}`);

    const touchedValueField = changedFields.some(field => valueFields.includes(field));
    const userTouchedStatus = changedFields.includes('source.status');
    if (touchedValueField && !userTouchedStatus && record.source?.status === 'screenshot-verified') {
      record.source.status = 'pending-review';
      record.source.note = `Bulk-edited ${today}: value changed, needs re-verification against new patch evidence. Previous note: ${record.source.note || 'none'}`;
      downgradedCount++;
    }
  }

  if (WRITE && (changedCount || createdCount)) writeJSON(jsonFile, doc);
  console.log(`${csvName}: ${createdCount} new, ${changedCount} changed, ${downgradedCount} moved back to pending-review.${WRITE ? ' Saved.' : ' (dry run — nothing saved)'}\n`);
  totalChanged += changedCount;
  totalCreated += createdCount;
  totalDowngraded += downgradedCount;
}

function valuesEqual(a, b) {
  const normalize = value => (value === '' ? null : value);
  const na = normalize(a);
  const nb = normalize(b);
  if (Array.isArray(na) || Array.isArray(nb)) return JSON.stringify(na) === JSON.stringify(nb);
  return na === nb || (na == null && nb == null);
}

function setField(record, changedFields, field, newValue) {
  const oldValue = field.split('.').reduce((obj, key) => obj?.[key], record);
  if (valuesEqual(oldValue, newValue)) return;
  const keys = field.split('.');
  let target = record;
  for (let i = 0; i < keys.length - 1; i++) { target[keys[i]] = target[keys[i]] || {}; target = target[keys[i]]; }
  target[keys[keys.length - 1]] = newValue;
  changedFields.push(field);
}

applyCategory({
  csvName: 'items',
  jsonFile: 'items.json',
  valueFields: ['estimatedPrice', 'rank', 'maxStack', 'effects.health', 'effects.bleed', 'effects.radiation', 'effects.hunger', 'effects.thirst'],
  applyRow(record, row) {
    const changedFields = [];
    setField(record, changedFields, 'name', row.name || record.name);
    setField(record, changedFields, 'classification', toList(row.classification));
    setField(record, changedFields, 'estimatedPrice', toNumberOrNull(row.estimatedPrice));
    setField(record, changedFields, 'rank', toNumberOrNull(row.rank));
    setField(record, changedFields, 'maxStack', toNumberOrNull(row.maxStack));
    setField(record, changedFields, 'stackable', toBoolOrNull(row.stackable));
    setField(record, changedFields, 'effects.health', toNumberOrNull(row.effects_health));
    setField(record, changedFields, 'effects.bleed', toNumberOrNull(row.effects_bleed));
    setField(record, changedFields, 'effects.radiation', toNumberOrNull(row.effects_radiation));
    setField(record, changedFields, 'effects.hunger', toNumberOrNull(row.effects_hunger));
    setField(record, changedFields, 'effects.thirst', toNumberOrNull(row.effects_thirst));
    setField(record, changedFields, 'notes', toStringOrNull(row.notes));
    setField(record, changedFields, 'image', toStringOrNull(row.image));
    setField(record, changedFields, 'source.status', toStringOrNull(row.source_status));
    setField(record, changedFields, 'source.file', toStringOrNull(row.source_file));
    setField(record, changedFields, 'source.note', toStringOrNull(row.source_note));
    return changedFields;
  },
});

applyCategory({
  csvName: 'weapons',
  jsonFile: 'weapons.json',
  valueFields: ['damage', 'rpm', 'range', 'accuracy', 'recoil', 'handling', 'ergonomics', 'reload'],
  applyRow(record, row) {
    const changedFields = [];
    setField(record, changedFields, 'name', row.name || record.name);
    setField(record, changedFields, 'category', toStringOrNull(row.category));
    setField(record, changedFields, 'tier', toStringOrNull(row.tier));
    setField(record, changedFields, 'ammo', toStringOrNull(row.ammo));
    setField(record, changedFields, 'damage', toNumberOrNull(row.damage));
    setField(record, changedFields, 'rpm', toNumberOrNull(row.rpm));
    setField(record, changedFields, 'range', toNumberOrNull(row.range));
    setField(record, changedFields, 'accuracy', toNumberOrNull(row.accuracy));
    setField(record, changedFields, 'recoil', toNumberOrNull(row.recoil));
    setField(record, changedFields, 'handling', toNumberOrNull(row.handling));
    setField(record, changedFields, 'ergonomics', toNumberOrNull(row.ergonomics));
    setField(record, changedFields, 'reload', toNumberOrNull(row.reload));
    setField(record, changedFields, 'image', toStringOrNull(row.image));
    setField(record, changedFields, 'source.status', toStringOrNull(row.source_status));
    setField(record, changedFields, 'source.file', toStringOrNull(row.source_file));
    setField(record, changedFields, 'source.note', toStringOrNull(row.source_note));
    return changedFields;
  },
});

applyCategory({
  csvName: 'armour',
  jsonFile: 'armour.json',
  valueFields: ['price', 'ballistic', 'slash', 'radiation', 'durability'],
  applyRow(record, row) {
    const changedFields = [];
    setField(record, changedFields, 'name', row.name || record.name);
    setField(record, changedFields, 'category', toStringOrNull(row.category));
    setField(record, changedFields, 'vendorRank', toStringOrNull(row.vendorRank));
    setField(record, changedFields, 'price', toNumberOrNull(row.price));
    setField(record, changedFields, 'ballistic', toNumberOrNull(row.ballistic));
    setField(record, changedFields, 'slash', toNumberOrNull(row.slash));
    setField(record, changedFields, 'radiation', toNumberOrNull(row.radiation));
    setField(record, changedFields, 'durability', toNumberOrNull(row.durability));
    setField(record, changedFields, 'repairClass', toStringOrNull(row.repairClass));
    setField(record, changedFields, 'stackable', toBoolOrNull(row.stackable));
    setField(record, changedFields, 'description', toStringOrNull(row.description));
    setField(record, changedFields, 'image', toStringOrNull(row.image));
    setField(record, changedFields, 'source.status', toStringOrNull(row.source_status));
    setField(record, changedFields, 'source.file', toStringOrNull(row.source_file));
    setField(record, changedFields, 'source.note', toStringOrNull(row.source_note));
    return changedFields;
  },
});

applyCategory({
  csvName: 'ammo',
  jsonFile: 'ammo.json',
  valueFields: ['estimatedPrice', 'damage', 'penetrationPercent', 'maxStack', 'rank'],
  applyRow(record, row) {
    const changedFields = [];
    setField(record, changedFields, 'name', row.name || record.name);
    setField(record, changedFields, 'category', toStringOrNull(row.category));
    setField(record, changedFields, 'estimatedPrice', toNumberOrNull(row.estimatedPrice));
    setField(record, changedFields, 'damage', toStringOrNull(row.damage));
    setField(record, changedFields, 'penetrationPercent', toNumberOrNull(row.penetrationPercent));
    setField(record, changedFields, 'maxStack', toNumberOrNull(row.maxStack));
    setField(record, changedFields, 'rank', toNumberOrNull(row.rank));
    setField(record, changedFields, 'description', toStringOrNull(row.description));
    setField(record, changedFields, 'source.status', toStringOrNull(row.source_status));
    setField(record, changedFields, 'source.file', toStringOrNull(row.source_file));
    setField(record, changedFields, 'source.note', toStringOrNull(row.source_note));
    return changedFields;
  },
});

console.log(`\nTOTAL: ${totalCreated} new record(s), ${totalChanged} changed across all files, ${totalDowngraded} sent back to pending-review.`);
if (!WRITE) console.log('This was a dry run. Re-run with --write to save the changes to data/*.json.');
