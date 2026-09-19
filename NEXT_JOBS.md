# SCAVLAND Website — Next Jobs

Last reviewed: 19 September 2026

This is the active project backlog. Work from the top unless a new game-data update or site bug takes priority.\n\n## Permanent cross-device documentation rule

**This rule applies to every future repository change, regardless of device or chat session.**

Whenever any website code, structured data, assets, navigation, UI, database content, verification status, or project configuration is changed:

1. Update the project documentation **in the same work session** before considering the task complete.
2. Record what changed and which files/areas were affected.
3. Record whether game data involved is screenshot-verified, unverified, community-sourced, or otherwise pending evidence.
4. Record important decisions or rules that a future session must preserve.
5. Record the relevant commit SHA/reference when useful.
6. Update completed/remaining jobs so the next session knows exactly where to resume.
7. Never leave a repo change undocumented simply because it was small.
8. If a change is reverted, abandoned, or deliberately not made, document that too when it affects the expected project state.

**Purpose:** a new ChatGPT session on phone, PC, or another device must be able to inspect the repository documentation and continue the SCAVLAND project without relying on the previous chat transcript.

## Handover — 19 September 2026

- **GitHub Pages HTTPS verified from repository settings:** site is live at the default `scavlandfanbase.github.io` domain, deployment source is `main` `/ (root)`, and **Enforce HTTPS** is enabled/required. Together with push protection, Dependabot/security settings and the active `Protect main` ruleset, the planned GitHub hardening pass is complete.

- **GitHub main-branch hardening confirmed from repository settings:** active ruleset `Protect main` targets the default `main` branch, has an empty bypass list, blocks branch deletion and force pushes, while normal direct updates remain allowed. Account-level push protection and the selected code-security/Dependabot protections were also enabled manually in GitHub settings. A normal direct commit after enabling the ruleset is used below to verify our existing update workflow still works.

- **Evidence workflow fully validated end-to-end:** a fresh live public submission successfully uploaded its screenshot, created a Pending database row, appeared in the secure Admin queue, and displayed the correct public success message after fixing the async form reset (`20a0752496b61c9ea5cea0f1ba316e8be7feede6`). Admin Rejected records now include **Restore to Pending** with confirmation for accidental rejections (`45a782ee93fff62175b6ff21c7f7cb80f29aa6de`).

- **Public evidence submission false-failure fix:** the insert policy requires `status = 'pending'`, while the browser payload previously omitted `status`; PostgREST/RLS could therefore reject the row after the screenshot upload. `items.html` now explicitly sends `status: 'pending'` and displays the real backend error text if a future submission fails. Commit `4fb709540e4b5101590eed7e1bd82882f4637c26`. Next validation: submit one fresh screenshot from the live Items page and confirm it appears in Admin → Pending.

- **Secure admin review is operational:** Supabase Auth login for the allowlisted admin is confirmed working. RLS authorization was fixed using `public.is_scavland_admin()` as a `SECURITY DEFINER` helper, so the private `admin_users` table remains unreadable while evidence policies can securely test admin membership. The admin UI now supports Pending / Approved / Rejected views, confirmation before decisions, review history via status tabs, and click-to-enlarge private screenshots. Workflow improvement commit: `3fdae529af63c4ca8408a3eb2c2d0364cbd29914`.

- **Security/admin phase implemented:** added private Supabase admin allowlist (`public.admin_users`) and RLS policies so only authenticated allowlisted admins can read/update evidence submissions or read private evidence files. Added `admin.html` evidence review UI with Supabase Auth sign-in, expiring signed screenshot URLs, and Approve/Reject actions (commit `8e5b4d38a8e35c81bdbdfa05d6b0c19758131cf7`). The admin page contains only the public/publishable Supabase key; no service-role key or password is committed. An admin account still needs to be created in Supabase Auth and its user UUID inserted into `public.admin_users` before review access works.
- **Repository hardening:** audited repo metadata (public GitHub Pages repo; current connector has admin permission), searched indexed code for obvious service-role/password/API-secret patterns with no hits, and added a root `.gitignore` blocking common local secret/env/key files (commit `2c7ff679122d38c49717de81b7342dec2eae1d31`). Account-level GitHub settings such as 2FA, secret scanning/push protection, and branch rulesets still require GitHub settings/API support not exposed by the current connector and should be enabled manually.
- **Submission diagnostics:** confirmed three test submissions and screenshots reached Supabase despite the UI reporting failure; improved frontend error diagnostics for any future failed HTTP response (commit `c5de49a63d9fbeb03d432c7c66052578672cebe7`).

- **Supabase evidence backend is now live** (19 September 2026). Project `Scavland-website` stores community evidence in `public.evidence_submissions` with private screenshots in the `evidence-submissions` Storage bucket. Anonymous/public clients may INSERT new pending submissions and upload PNG/JPG/WebP screenshots (10 MB max) only into `incoming/`; they have no public SELECT/UPDATE/DELETE access to submissions or private evidence. `items.html` now submits directly to Supabase with the project's publishable browser key, replacing FormSubmit/email. Successful uploads are truthfully shown as **pending review** because a durable database record now exists. Canonical JSON is never modified automatically. Backend migration: `create_evidence_submission_backend`. Website commit: `e3f530641042631a4d28bd5853af22cba9b9a755`.
- **Single-source/live-page cleanup from PC session:** `armour.html` now loads authoritative `data/armour.json` (commit `8c97498935e4bd5f023070eb65d4ac350166f605`). `items.html` no longer renders legacy vendor `Details` blobs that duplicate structured weapon/armour stats, fixing oversized cards (commit `daa438cc98a23f65095305809e8051bafb9fa329`). No canonical game values changed in either UI cleanup.
\n\n- Repository: `scavlandfanbase/scavlandfanbase.github.io`, branch `main`.\n- **Strict evidence rule:** do not promote a value into canonical/master data unless it is confirmed by an in-game screenshot or another explicitly approved authoritative source. Existing HTML or migrated JSON is not proof by itself.\n- `source.status: screenshot-verified` means the record may be presented as **In-game verified**. Legacy statuses such as `existing-site-data`, `community-reported-correction`, or migration-derived data must not be silently treated as screenshot-confirmed.\n- If evidence is missing, conflicting or unreadable, leave the value unverified/`null` and flag it for review. Never fill gaps by inference.\n- Crafting: `crafting.html` currently contains 22 embedded recipes and `data/crafting.json` contains a migrated copy. They do not fully match. **Do not reconcile or promote the extra HTML ingredients until the crafting screenshots are processed.** A proposed reconciliation was deliberately stopped before any repository write.\n- Items navigation is already immediately after Map in `site-shell.js`.\n- `items.html` is already JSON-driven and now displays verification badges. It shows **✓ In-game verified** only when linked specialist records are explicitly `screenshot-verified`; otherwise it shows **Needs verification**. No game values were changed for this UI update.\n- Verification-badge commit: `a7ee0c7fb2de0b37543d357de5f936d2eb678a38`.\n- Continue safe UI/site functionality work when screenshots are unavailable; do not use that as a reason to alter unverified game data.\n- Required screenshot submission upgrade 19 September 2026: `items.html` now posts evidence directly to FormSubmit for delivery to `scavlandfanbase@gmail.com` instead of opening a `mailto:` draft. Screenshot selection is required in-browser and accepts PNG/JPG/WebP; the page states the provider's 10 MB total upload limit. Contributors need no GitHub/SCAVLAND account. FormSubmit requires the inbox owner to confirm the first activation email before normal delivery. This does **not** yet auto-mark records Pending Review: no pending state may be shown unless a submission is actually recorded/reviewable. No canonical game data or verification status changed. Commit: `456441704833945b75ab77051948e055094a8027`.\n- Account-free email evidence flow added 19 September 2026: `items.html` now contains a native SCAVLAND submission form for missing items, corrections and clearer evidence. It collects submission type, category, item/name and optional notes, then opens the visitor's email client addressed to `scavlandfanbase@gmail.com` with those details pre-filled. The visitor is explicitly reminded to attach the in-game screenshot; `mailto:` cannot attach files automatically. No login is required and no submission can automatically modify canonical data or verification status. Commit: `6a954f2a5cf3f91479aca76e5ed6abc01639bd43`.\n- Submission workflow decision 19 September 2026: the public GitHub Issues **Submit Missing Item / Evidence** link was removed because it requires contributors to have a GitHub account. The issue template remains in the repository for now but is not linked from the public Items page. Replacement requirement: an **account-free, mobile-friendly screenshot submission form** with manual review; submissions must never automatically modify canonical JSON or verification status. Removal commit: `ea8c563784769089251bdcb897776f47359c7411`.\n- Items catalogue reorganisation 19 September 2026: `items.html` now presents category overview cards for All Items, Weapons, Armour, Ammo, Crafted, Crafting and Vendor Items. Each card shows the indexed total plus how many records still need verification. Added a mutually exclusive **Needs Verification** view alongside **Verified Only**, while retaining search, category filters and the community evidence submission button. This is UI/status presentation only; no game data or verification statuses were changed. Commit: `3dcdd12e69810da1c2715192bcf8fabd380bb279`.\n- Community evidence submissions added 19 September 2026: `items.html` now has **Submit Missing Item / Evidence**, linking to `.github/ISSUE_TEMPLATE/submit-evidence.yml`. Contributors can submit missing items, corrections or clearer evidence and attach/paste in-game screenshots through GitHub Issues. **Submissions are pending review and never automatically alter canonical JSON or verification status.** Template commit: `064040e38cad3ec66f75114f70b772ffb351585c`; Items link commit: `96dd8db7fbff8a18ffba4149d69a35bd5a96a5c7`.\n- Items UX update 19 September 2026: added a **Verified Only** toggle and verification-status legend to `items.html`. The toggle works alongside search/category filters and uses the existing conservative `screenshot-verified` status rule. No game data changed. Commit: `14f9dce926a0516d08500fdba720c9f8fbef665b`.\n- Items root-cause fix 19 September 2026: the verification-badge edit had inserted literal `\\n` text into the inline JavaScript around `sourceStatus()`, causing a browser syntax error before any item loading could run. Replaced those sequences with real line breaks and verified the inline script no longer contains literal `\\n`. No game data changed. Fix commit: `ad822074442c19787d865cee04b743e5de33bbe5`.\n- Items loading hotfix 19 September 2026: `items.html` no longer lets a failed secondary JSON request blank the whole Items database. `data/items.json` is loaded as the required source; weapons/armour/ammo/crafting/vendors load independently for enrichment. Added `cache: no-store` during loading and visible failure messaging. No game data changed. Fix commit: `0c45ca7e8328627cb27bd4b9166c2ebcb68501c6`.\n- Documentation audit completed 19 September 2026: `MASTER_DATABASE.md` was found to be a legacy generated snapshot containing stale/unverified values. It is now explicitly marked non-canonical until regenerated from verified JSON. `.github` contains the weapon screenshot archival workflow; `evidence-archive/` contains historical snapshots and is evidence/history, not current canonical data.\n

- Old Tactical Vest verified 19 September 2026 from user-supplied in-game screenshots: added as a new armour/item identity. Confirmed visible values: value ~75,000₽, durability 100, ballistic resistance 35, slash resistance 25, radiation resistance 15, repair class Medium, not stackable. Added item icon asset at `images/armour/old-tactical-vest-icon.webp`; `data/armour.json` is `screenshot-verified` and `data/items.json` now indexes it as armour. The full stat-panel screenshot was reviewed in-chat as authoritative evidence; only the compact icon asset was committed in this session. Asset commit `9183d2c64577b13a9c66d520bfe81dd1a134cdfa`; armour commit `f52322ed6cf791e074abfd71b1e4138f5c2d3f5d`; item commit `9bdef9a1da123c71a0bd8a64f1a3b7596384e7c4`.\n
- Display fix 19 September 2026: Old Tactical Vest was initially stored with category `Vests`, but `armour.html` renders only Gas Masks, Helmets, Body Armour and Pants. Changed its canonical category to `Body Armour`, so it now renders in the live Armour section. No verified stats changed. Fix commit `eeb83b731b7b683a64909664fbc3f4e9a90241e2`.

## Priority 1 — Process screenshot evidence

- [ ] Re-verify all weapon stats against current game data; community report on 18 September 2026 identified multiple outdated damage values. Corrections already applied: 63 Dragoon 36, M4 Svodbonik 19, Mikhail 47/MK47 20.

- [ ] Identify the screenshots in `images/items/` and rename them to descriptive item-based filenames.
- [ ] Extract only confirmed visible item data and update `data/items.json`.
- [ ] Identify and rename screenshots in `images/weapons/`; compare their stats against `data/weapons.json`.
- [ ] Identify and rename screenshots in `images/armour/`; compare their stats against `data/armour.json`.
- [ ] Process the 22 crafting screenshots/recipes and attach evidence paths to `data/crafting.json`.
- [ ] Review faction screenshots and decide whether they add evidence beyond the existing faction icons/data.
- [ ] Connect the normalized ammo icons/detail screenshots in `images/ammo/` to the 13 records in `data/ammo.json`.
- [ ] Flag unreadable or conflicting screenshot values instead of guessing.

## Priority 2 — Clean repository assets

- [ ] Check remaining `- Copy` timestamp files in item/weapon folders; delete only confirmed byte-identical or visually duplicate files.
- [ ] Review duplicated weapon/item screenshot SHAs that appear in both `images/items/` and `images/weapons/` and retain one canonical evidence location where appropriate.
- [ ] Review root `Antatoly.png` against `images/vendors/anatoly.png`; remove the root file if confirmed obsolete.
- [ ] Decide whether the legacy root `ammo` documentation file can be retired after ammo JSON/evidence is fully verified.
- [ ] Review old `images/scavland-banner.jpg.png` now that the official logo is used in the shared header.
- [ ] Keep `images/branding/Scavland_Logo_2025.png` as the shared header logo.

## Priority 3 — Make JSON the live source

Migrate incrementally and test after every page:

1. [ ] Weapons + Ammo → `data/weapons.json` and `data/ammo.json`
2. [ ] Armour → `data/armour.json`
3. [ ] Crafting → `data/crafting.json`
4. [ ] Vendors → `data/vendors.json` + `data/vendor-selling-rates.json`
5. [ ] Factions → `data/factions.json`

Do not remove embedded HTML/JavaScript data until the equivalent JSON-powered page has been tested.

## Priority 4 — Database/site features

- [x] Build a dedicated Items database/search page from `data/items.json`.\n- [x] Add verification badges to Items so screenshot-verified records are visually distinct from records still needing verification.
- [x] Replace the public GitHub-only evidence flow with an account-free direct submission form to `scavlandfanbase@gmail.com`; screenshot selection is required and all evidence requires review before canonical promotion.\n- [x] Replace the abandoned FormSubmit/email route with durable Supabase submission storage and private screenshot uploads.\n- [ ] Test one real public-site screenshot submission end-to-end and review it in Supabase.\n- [ ] Add trustworthy Pending Review presentation only after a stored/reviewable submission source is available; never infer pending state from a button click.\n- [ ] Add item images/icons to cards and detail views where verified assets exist.
- [ ] Add cross-links: vendor item → item record; crafting ingredient → item; weapon → ammo; faction → vendors.
- [ ] Improve Areas page; it is currently under construction.
- [ ] Consider vendor portraits on directory cards.
- [ ] Add accessible keyboard/focus handling to vendor modal.
- [ ] Test map pan/zoom on desktop, phone and tablet.

## Priority 5 — Maintenance/QA

- [ ] After JSON migration, generate `MASTER_DATABASE.md` from the canonical JSON rather than maintaining duplicated tables manually.
- [ ] Check internal links and navigation after major changes.
- [ ] Check responsive layouts at phone, 1080p, 1440p and 4K widths.
- [ ] Keep developer-provided vendor percentage wording exact.
- [ ] Never infer undocumented game values.

## Current confirmed baseline

- 258 indexed item identities
- 40 weapons
- 30 armour/gear records
- 13 ammo records
- 22 vendors
- 9 factions
- 22 crafting recipes
- Shared header/navigation: `site-shell.js`
- Shared visual theme: `site-theme.css`
- Interactive map: `map.html`
- Official header logo: `images/branding/Scavland_Logo_2025.png`
