import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { names } from './names.mjs'
import { startStaticServer } from './static-server.mjs'

const { server } = await startStaticServer()
const browser = await chromium.launch()
const results = []
try {
  for (const type of ['module', 'var']) for (const name of names) {
    const context = await browser.newContext()
    const page = await context.newPage()
    const errors = [], requests = []
    page.on('pageerror', e => errors.push(e.message))
    page.on('request', r => { if (r.url().includes('/remotes/')) requests.push(r.url()) })
    await page.goto(`http://127.0.0.1:4320/?name=${name}&type=${type}`)
    let result
    try {
      await page.waitForFunction(() => globalThis.__LAB_RESULT__, undefined, { timeout: 8000 })
      result = await page.evaluate(() => globalThis.__LAB_RESULT__)
    } catch (error) { result = { name, type, ok: false, error: String(error) } }
    results.push({ ...result, requests: requests.map(x => new URL(x).pathname), pageErrors: errors })
    console.log(type, name, result.ok ? 'PASS' : 'FAIL', requests.length)
    await context.close()
  }
  // Change only the host instance name; keep the actual remote name and key safe.
  for (const ownName of names) {
    const context = await browser.newContext(), page = await context.newPage()
    await page.goto(`http://127.0.0.1:4320/?ownName=${ownName}`)
    await page.waitForFunction(() => globalThis.__LAB_RESULT__, undefined, { timeout: 8000 })
    results.push({ ...(await page.evaluate(() => globalThis.__LAB_RESULT__)), test: 'own-host-name' })
    await context.close()
  }
  // Load the generated var script explicitly to distinguish overwrites from loader short-circuits.
  for (const name of ['mf_remote', 'top', 'self', 'parent', 'window', 'document', 'location', 'frames', 'name', 'globalThis']) {
    const context = await browser.newContext(), page = await context.newPage(), errors = [], navigations = []
    page.on('pageerror', e => errors.push(e.message))
    await page.goto('http://127.0.0.1:4320/empty.html').catch(() => {})
    page.on('framenavigated', f => { if (f === page.mainFrame()) navigations.push(f.url()) })
    await page.evaluate(name => { window.__snapshot = { global: globalThis, value: globalThis[name] } }, name)
    let injectionError
    try { await page.addScriptTag({ url: `http://127.0.0.1:4320/remotes/${name}/varRemoteEntry.js` }) }
    catch (e) { injectionError = String(e) }
    await page.waitForTimeout(150)
    let state
    try { state = await page.evaluate(name => {
      const snapshot = window.__snapshot
      if (!snapshot) return { snapshotLost: true }
      const value = snapshot.global[name]
      return { changed: value !== snapshot.value, type: typeof value, initType: typeof value?.init }
    }, name) }
    catch (e) { state = { error: String(e) } }
    results.push({ test: 'direct-var-script', name, ...state, pageErrors: errors, navigations, injectionError })
    await context.close()
  }
  await mkdir('results', { recursive: true })
  await writeFile('results/browser.json', JSON.stringify({ date: new Date().toISOString(), browser: browser.version(), results }, null, 2) + '\n')
  assert(results.filter(r => r.type === 'module' && !r.test).every(r => r.ok), 'All tested browser ESM remotes should load')
  assert(results.filter(r => r.test === 'own-host-name').every(r => r.ok), 'Own instance names should not collide')
  for (const name of ['top', 'self', 'parent', 'window', 'document', 'location', 'frames']) {
    const r = results.find(r => r.name === name && r.type === 'var')
    assert(!r.ok && r.error.includes('RUNTIME-002') && r.requests.length === 0, `Expected var collision: ${name}`)
  }
} finally { await browser.close(); server.close() }
