const fs = require('node:fs');

const itemPath = 'data/items.json';
const indexPath = 'evidence-analysis.json';
const itemsDocument = JSON.parse(fs.readFileSync(itemPath, 'utf8'));
const evidenceIndex = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
const evidence = new Map(evidenceIndex.files.map(row => [row.file, row.ocr || '']));
const numeric = value => Number(value.replace(/,/g, ''));
const read = (text, pattern) => { const match = text.match(pattern); return match ? numeric(match[1]) : null; };
const effect = (text, name) => {
  const match = text.match(new RegExp(`${name}\\s*:\\s*([+\\-«]?)\\s*(\\d+)`, 'i'));
  if (!match) return null;
  const sign = match[1] === '-' ? -1 : 1;
  return sign * Number(match[2]);
};

let changed = 0;
for (const item of itemsDocument.data) {
  if (item.source?.status !== 'screenshot-verified' || !item.source.file?.startsWith('evidence-inbox/')) continue;
  const text = evidence.get(item.source.file.slice('evidence-inbox/'.length));
  if (!text) continue;
  const updates = {};
  const price = read(text, /~\s*([\d,]+)P/i);
  const rank = read(text, /Rank\s*:?\s*(\d+)/i);
  const maxStack = read(text, /Max\s*Stack[s]?\s*:?\s*(\d+)/i);
  if (item.estimatedPrice == null && price != null) updates.estimatedPrice = price;
  if (item.rank == null && rank != null) updates.rank = rank;
  if (item.maxStack == null && maxStack != null) updates.maxStack = maxStack;
  const effects = { ...(item.effects || {}) };
  for (const name of ['health', 'bleed', 'radiation', 'hunger', 'thirst']) {
    const value = effect(text, name);
    if (effects[name] == null && value != null) effects[name] = value;
  }
  if (Object.keys(effects).length && JSON.stringify(effects) !== JSON.stringify(item.effects || {})) updates.effects = effects;
  if (!Object.keys(updates).length) continue;
  Object.assign(item, updates);
  changed++;
  console.log(`${item.id}: ${Object.keys(updates).join(', ')}`);
}

if (process.argv.includes('--write')) {
  fs.writeFileSync(itemPath, JSON.stringify(itemsDocument, null, 2) + '\n');
  console.log(`Updated ${changed} item records.`);
} else {
  console.log(`Dry run: ${changed} item records would be updated. Pass --write to save.`);
}
