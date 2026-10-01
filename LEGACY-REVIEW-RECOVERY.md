# Historical review recovery — 1 October 2026

The genuine Special FMJ Ammo record is blocked by saved verification differences in the old Items catalogue. The earlier reviewed importer rejected all unsupported public changes, including verification. The user reported this block after category activation.

This fix adds an explicit historical-review preservation choice when verification is the only unsupported difference and all other fields are uncontested supported edits. The administrator must choose Keep history and mark Unverified, then Preserve history and import. Trusted preparation binds the exact source version/digest, public baseline, item and revision, preserves the immutable complete old snapshot, and retains the selected old review/history privately in legacyTransfer. It records a fresh server-attributed Unverified review for the selected category. It never promotes old metadata to a new Verified attestation.

The old Items draft and unrelated work remain intact. Snapshot/receipt saves, newer-legacy-version revocation and ordinary explicit preview/publication remain required. Other unsupported fields, public conflicts and existing pending category reviews remain blocked. No database migration is needed.

Validation: pure contract checks require opt-in, retain private historical records, refuse visibility/manual-field bypass and omit private actors/history from public output. Real local SQL/API/browser checks reproduce the blocked editor, require an explicit decision, preserve the snapshot, recover editing and keep public facts unchanged. Existing category and creation/import checks pass. Tests use fixtures; no genuine draft imports or game-data changes occurred.

Deployment requires the complete current admin-drafts dependency graph before the coordinated frontend/cache release. This checkpoint is prepared only. After deployment, the signed-in administrator must review and explicitly choose the new preservation action. Actual game verification remains a separate task.
