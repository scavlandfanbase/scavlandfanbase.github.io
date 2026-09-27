'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const v = require('../verification.js');
const configured = JSON.parse(fs.readFileSync('data/verification-settings.json', 'utf8'));
assert.equal(v.patchId(configured), '0.7.2');
const unset = { schemaVersion: 1, current_patch_id: null };
const first = { schemaVersion: 1, current_patch_id: 'test-patch-a' };
const next = { schemaVersion: 1, current_patch_id: 'test-patch-b' };
const clock = () => new Date('2026-09-23T12:00:00.000Z');
const record = { id: 'fixture', name: 'Fixture', source: { status: 'pending-review', file: 'evidence.png' } };
const snapshot = JSON.stringify(record);
assert.equal(v.inspect(record, first).last_verified, 'never');
assert.equal(v.inspect(record, first).status, 'unverified');
assert.throws(() => v.decide(record, 'verified', unset, 'admin-id', clock), /current patch/);
assert.throws(() => v.decide(record, 'verified', first, '', clock), /identity/);
assert.throws(() => v.decide(record, 'pending', first, 'admin-id', clock), /Verified or Unverified/);
assert.throws(() => v.inspect(record, { current_patch_id: '' }), /settings/);
const verified = v.decide(record, 'verified', first, 'admin-id', clock);
assert.equal(JSON.stringify(record), snapshot);
assert.deepEqual(verified.source, record.source);
assert.equal(v.inspect(verified, first).status, 'verified');
assert.equal(v.inspect(verified, next).status, 'patch-check-needed');
assert.equal(v.inspect(verified, unset).status, 'unverified');
assert.equal(verified.verification.last_verified_by, 'admin-id');
assert.equal(verified.verification.last_verified_at, clock().toISOString());
const again = v.decide(verified, 'verified', next, 'second-admin', clock);
assert.equal(again.verification.history.length, 2);
assert.equal(verified.verification.history.length, 1);
assert.equal(v.inspect(again, next).status, 'verified');
const revoked = v.decide(again, 'unverified', next, 'second-admin', clock);
assert.equal(v.inspect(revoked, next).status, 'unverified');
assert.equal(revoked.verification.last_verified_by, 'second-admin');
assert.equal(revoked.verification.history.length, 3);
assert.equal(v.inspect(revoked, next).last_verified, 'recorded');
const legacy = { source: { status: 'screenshot-verified', lastVerified: '2026-09-01' } };
assert.equal(v.inspect(legacy, first).status, 'patch-check-needed');
assert.equal(v.inspect(legacy, first).last_verified, 'unknown');
assert.equal(v.inspect(legacy, first).last_verified_at, null);
assert.equal(v.inspect(legacy, configured).status, 'patch-check-needed');
assert.equal(v.inspect(v.decide(record, 'verified', configured, 'admin-id', clock), configured).status, 'verified');
const legacyRevoked = v.decide(legacy, 'unverified', first, 'admin-id', clock);
assert.equal(v.inspect(legacyRevoked, first).status, 'unverified');
assert.equal(v.inspect(legacyRevoked, first).last_verified, 'unknown');
const overridden = { ...revoked, source: legacy.source };
assert.equal(v.inspect(overridden, next).status, 'unverified');
assert.throws(() => v.inspect({ verification: { decision: 'verified' } }, first), /metadata/);
const corrupt = structuredClone(verified); corrupt.verification.verified_patch_id = 'forged';
assert.throws(() => v.inspect(corrupt, first), /history/);
assert.throws(() => v.decide(corrupt, 'verified', first, 'admin-id', clock), /history/);
assert.deepEqual(v.progress([record, verified, again], next), { verified: 1, unverified: 1, 'patch-check-needed': 1, total: 3, percent: 33 });
assert.equal(v.progress([], next).percent, 0);
// Vendor listings and compatibility use the same rules without verifying siblings.
const listings = [{ id: 'vendor-a:item' }, { id: 'vendor-b:item' }];
listings[0] = v.decide(listings[0], 'verified', first, 'admin-id', clock);
assert.equal(v.inspect(listings[1], first).status, 'unverified');
// The browser build exposes exactly the same API, with no fetch/storage dependency.
const browser = { structuredClone }; vm.createContext(browser);
vm.runInContext(fs.readFileSync('verification.js', 'utf8'), browser);
assert.equal(browser.ScavVerification.inspect(verified, first).status, 'verified');
// Existing records must never acquire current-patch verification from provenance alone.
let checked = 0;
for (const name of ['items', 'weapons', 'armour', 'ammo', 'crafting', 'vendors']) {
  const data = JSON.parse(fs.readFileSync(`data/${name}.json`, 'utf8'));
  for (const entry of data.data || data) {
    for (const candidate of [entry, ...(entry.inventory || [])]) {
      const before = JSON.stringify(candidate);
      assert.notEqual(v.inspect(candidate, first).status, 'verified');
      assert.equal(JSON.stringify(candidate), before); checked++;
    }
  }
}
console.log(`PASS: verification transitions, history, legacy handling, patch changes, progress, browser API and ${checked} existing records/listings (read-only).`);
