const { chromium } = require('playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
(async () => {
  const root = path.resolve(__dirname, '..'), v = require('../verification.js');
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage(), errors = [], external = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    let state, writes = 0, fail = false, delay = false, deniedRead = false;
    function reset(owner = true) {
      const settings = { schemaVersion: 1, current_patch_id: '0.7.2' };
      state = { settings, sha: 'a', canStart: owner, owner, datasets: { items: [v.decide({ id: 'one' }, 'verified', settings, 'fixture-admin'), { id: 'two' }], weapons: [], armour: [], ammo: [], crafting: [], vendors: [] } };
    }
    reset();
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/functions/v1/manage-patches')) {
        const body = route.request().postDataJSON();
        if (body.action === 'read') return route.fulfill({ status: deniedRead ? 503 : 200, json: deniedRead ? { error: 'Temporarily unavailable' } : state });
        writes++;
        if (delay) await new Promise(resolve => setTimeout(resolve, 200));
        if (fail) { fail = false; return route.fulfill({ status: 409, json: { error: 'Another patch change was saved.' } }); }
        const { startPatch } = await import('../supabase/functions/manage-patches/handler.mjs');
        state.settings = startPatch(state.settings, body.patchId, 'fixture-owner', new Date('2026-09-23T14:00:00Z')); state.sha = 'b';
        return route.fulfill({ json: { settings: state.settings, sha: state.sha } });
      }
      if (url.origin !== 'http://patch.test') { external.push(url.href); return route.abort(); }
      if (url.pathname === '/harness') return route.fulfill({ contentType: 'text/html', body: '<iframe id="frame" style="width:100%;height:75dvh;min-height:320px;border:0" src="patch-admin.html"></iframe><script>addEventListener("message",e=>{if(e.origin===location.origin&&e.data.type==="scavland-admin-ready")e.source.postMessage({type:"scavland-admin-token",token:"fixture"},location.origin)})</script>' });
      const name = path.resolve(root, '.' + url.pathname);
      if (!name.startsWith(root + path.sep) || !fs.existsSync(name)) return route.fulfill({ status: 404, body: '' });
      return route.fulfill({ contentType: ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' })[path.extname(name)] || 'text/plain', body: fs.readFileSync(name) });
    });
    async function open() { await page.goto('http://patch.test/harness'); const f = page.frameLocator('#frame'); await f.locator('#status').filter({ hasText: 'Ready' }).waitFor(); return f; }
    deniedRead = true; await page.goto('http://patch.test/harness');
    let f = page.frameLocator('#frame'); await f.locator('#retry-load').waitFor(); deniedRead = false;
    await f.locator('#retry-load').click(); await f.locator('#status').filter({ hasText: 'Ready' }).waitFor();
    assert.equal(await f.locator('#summary').textContent(), '1 / 2 verified (50%)');
    await f.locator('#new-patch').click(); await f.locator('#cancel').click(); assert.equal(writes, 0);
    await f.locator('#new-patch').click(); await f.locator('#patch-id').fill('test-0.8.0'); await f.locator('#start').click(); assert.equal(writes, 0, 'Confirmation required');
    await f.locator('#confirm-all').check(); delay = true; await f.locator('#start').click();
    assert.equal(await f.locator('#start').isDisabled(), true);
    await f.locator('#status').filter({ hasText: 'Patch started.' }).waitFor(); delay = false;
    assert.equal(writes, 1); assert.equal(await f.locator('#current').textContent(), 'test-0.8.0'); assert.equal(await f.locator('#summary').textContent(), '0 / 2 verified (0%)');
    assert.ok((await f.locator('#categories').textContent()).includes('1 patch checks'));
    await f.locator('#refresh').click(); await f.locator('#status').filter({ hasText: 'Ready' }).waitFor();
    assert.equal(await f.locator('#current').textContent(), 'test-0.8.0');
    fail = true; await f.locator('#new-patch').click(); await f.locator('#patch-id').fill('test-0.9.0'); await f.locator('#confirm-all').check(); await f.locator('#start').click();
    await f.locator('#save-error').filter({ hasText: 'refresh' }).waitFor(); assert.equal(await f.locator('#start').isDisabled(), true);
    await f.locator('#cancel').click(); assert.equal(await f.locator('#new-patch').isDisabled(), true);
    await f.locator('#refresh').click(); await f.locator('#status').filter({ hasText: 'Ready' }).waitFor(); assert.equal(await f.locator('#new-patch').isEnabled(), true);
    deniedRead = true; await f.locator('#refresh').click(); await f.locator('#status').filter({ hasText: 'unavailable' }).waitFor(); assert.equal(await f.locator('#new-patch').isDisabled(), true); deniedRead = false;
    reset(false); f = await open(); assert.equal(await f.locator('#new-patch').isDisabled(), true);
    reset(); state.canStart = false; f = await open(); assert.ok((await f.locator('#permission').textContent()).includes('release approval'));
    reset(); f = await open();
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await f.locator('body').evaluate(el => el.scrollWidth <= innerWidth), true, 'Page width ' + width);
      await f.locator('#new-patch').click();
      assert.equal(await f.locator('#confirm-dialog').evaluate(el => el.scrollWidth <= el.clientWidth), true, 'Dialog width ' + width);
      await page.keyboard.press('Escape'); assert.equal(await f.locator('#new-patch').evaluate(el => el === document.activeElement), true);
    }
    if (process.env.SCAVLAND_TEST_OUTPUT) { fs.mkdirSync(process.env.SCAVLAND_TEST_OUTPUT, { recursive: true }); await page.setViewportSize({ width: 390, height: 900 }); await page.screenshot({ path: path.join(process.env.SCAVLAND_TEST_OUTPUT, 'patch-management-mobile.png'), fullPage: true }); }
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    console.log('PASS: browser progress, confirmation/cancel, pending-save lock, patch transition, refresh, conflict/read-error recovery, Admin/Owner permissions, disabled release, keyboard focus, 320–1280px layouts. All requests intercepted.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
