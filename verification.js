/* Shared verification rules. No network, persistence or authorization side effects. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ScavVerification = api;
})(globalThis, function () {
  'use strict';
  const labels = { verified: 'VERIFIED', unverified: 'UNVERIFIED', 'patch-check-needed': 'PATCH CHECK NEEDED' };
  const text = value => typeof value === 'string' && value.trim().length > 0;
  const timestamp = value => text(value) && /^\d{4}-\d{2}-\d{2}T.*Z$/.test(value) && Number.isFinite(Date.parse(value));
  function patchId(settings) {
    if (settings?.schemaVersion !== 1 || !(settings.current_patch_id === null || text(settings.current_patch_id))) {
      throw new Error('Invalid current-patch settings.');
    }
    return settings.current_patch_id;
  }
  function validate(value) {
    // Public projection deliberately contains no identity, timestamps or audit history.
    if(value?.schemaVersion===2){
      if(Object.keys(value).some(k=>!['schemaVersion','decision','verified_patch_id'].includes(k))||!['verified','unverified'].includes(value.decision)||!(value.verified_patch_id===null||text(value.verified_patch_id))||(value.decision==='verified'&&!text(value.verified_patch_id)))throw new Error('Invalid public verification summary.');
      return value;
    }
    if (!value || value.schemaVersion !== 1 || !['verified', 'unverified'].includes(value.decision) || !Array.isArray(value.history)) {
      throw new Error('Invalid verification metadata.');
    }
    for (const event of value.history) {
      if (!event || !['verified', 'unverified'].includes(event.decision) || !timestamp(event.at) || !text(event.by) ||
          !(event.patch_id === null || text(event.patch_id)) || (event.decision === 'verified' && !text(event.patch_id))) {
        throw new Error('Invalid verification history.');
      }
    }
    const last = value.history.filter(event => event.decision === 'verified').at(-1);
    if (value.verified_patch_id !== (last?.patch_id ?? null) || value.last_verified_at !== (last?.at ?? null) ||
        value.last_verified_by !== (last?.by ?? null) ||
        value.decision !== (value.history.at(-1)?.decision ?? 'unverified')) {
      throw new Error('Verification summary does not match its history.');
    }
    return value;
  }
  function empty() {
    return { schemaVersion: 1, decision: 'unverified', verified_patch_id: null,
      last_verified_at: null, last_verified_by: null, history: [] };
  }
  // Legacy provenance is retained, never upgraded to a dated/current-patch attestation.
  function inspect(record, settings) {
    const current = patchId(settings);
    const metadata = record?.verification == null ? null : validate(record.verification);
    const legacy = !metadata && record?.source?.status === 'screenshot-verified';
    const wasVerified = metadata ? metadata.decision === 'verified' : legacy;
    const status = !wasVerified || !current ? 'unverified' : metadata?.verified_patch_id === current ? 'verified' : 'patch-check-needed';
    return { status, label: labels[status], current_patch_id: current,
      verified_patch_id: metadata?.verified_patch_id ?? null,
      last_verified_at: metadata?.last_verified_at ?? null,
      last_verified_by: metadata?.last_verified_by ?? null,
      last_verified: metadata?.last_verified_at ? 'recorded' : record?.source?.status === 'screenshot-verified' ? 'unknown' : 'never',
      reason: !current ? 'current-patch-not-configured' : legacy ? 'legacy-patch-unknown' : status === 'patch-check-needed' ? 'different-patch' : status,
      legacy };
  }
  // Call only AFTER a trusted server verifies the actor's permissions and explicit
  // review intent. actorId must come from authenticated identity, never request data.
  // This pure helper is not an authorization boundary or a public Verify endpoint.
  function decide(record, decision, settings, actorId, clock = () => new Date()) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('A record is required.');
    if (!['verified', 'unverified'].includes(decision)) throw new Error('Choose Verified or Unverified.');
    if (!text(actorId)) throw new Error('An authenticated verifier identity is required.');
    const current = patchId(settings);
    if (decision === 'verified' && !current) throw new Error('Set the current patch before verifying.');
    const previous = record.verification == null || record.verification.schemaVersion===2 ? empty() : validate(record.verification);
    const at = clock().toISOString();
    const event = { decision, patch_id: current, at, by: actorId };
    const verification = { ...previous, decision, history: [...previous.history, event] };
    if (decision === 'verified') Object.assign(verification, {
      verified_patch_id: current, last_verified_at: at, last_verified_by: actorId,
    });
    validate(verification);
    return structuredClone({ ...record, verification });
  }
  function progress(records, settings) {
    patchId(settings);
    const result = { verified: 0, unverified: 0, 'patch-check-needed': 0, total: records.length, percent: 0 };
    for (const record of records) result[inspect(record, settings).status]++;
    result.percent = result.total ? Math.round(result.verified / result.total * 100) : 0;
    return result;
  }
  return Object.freeze({ inspect, decide, progress, validate, patchId });
});
