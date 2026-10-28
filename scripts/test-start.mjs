import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { evidence } from './evidence.mjs'

const scenarios = [
  { name: 'baseline', remote: 'mf_remote', host: 'mf_host', type: 'module' },
  ...['top', 'self', 'parent', 'window', 'document', 'location', 'frames', 'process', 'globalThis', 'Buffer'].map(remote => ({ name: `remote-${remote}-esm`, remote, host: 'mf_host', type: 'module' })),
  ...['top', 'process', 'window'].map(host => ({ name: `host-${host}`, remote: 'mf_remote', host, type: 'module' })),
  ...['mf_remote', 'top', 'self', 'parent', 'window', 'document', 'location', 'frames', 'process'].map(remote => ({ name: `remote-${remote}-var`, remote, host: 'mf_host', type: 'var' })),
]
const browser = await chromium.launch()
const results = []
await mkdir('results/logs', { recursive: true })
async function waitForServer(url) {
  let lastError
  for (let i = 0; i < 120; i++) {
    try { const r = await fetch(url, { signal: AbortSignal.timeout(3000) }); if (r.status === 200) return }
    catch (e) { lastError = e }
    await new Promise(r => setTimeout(r, 250))
  }
  throw new Error(`Server not ready ${url}: ${lastError}`)
}
try {
  for (const scenario of scenarios) {
    const children = [], logs = [], pageErrors = [], consoleErrors = [], requests = []
    const result = { ...scenario, hydrated: false, interactive: false }
    try {
      for (const role of ['remote', 'host']) {
        const child = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--config', `apps/${role}/vite.config.ts`], {
          env: { ...process.env, MF_REMOTE_NAME: scenario.remote, MF_HOST_NAME: scenario.host, MF_REMOTE_TYPE: scenario.type },
          stdio: ['ignore', 'pipe', 'pipe'],
        })
        child.stdout.on('data', x => logs.push(`${role}: ${x}`))
        child.stderr.on('data', x => logs.push(`${role}: ${x}`))
        children.push(child)
        await waitForServer(`http://127.0.0.1:${role === 'host' ? 4310 : 4311}/`)
      }
      const response = await fetch('http://127.0.0.1:4310/')
      const html = await response.text()
      result.httpStatus = response.status
      result.ssr = html.includes('Federated remote rendered') && !html.includes('Switched to client rendering')
      result.ssrError = html.match(/Switched to client rendering[^<]{0,700}/)?.[0]
      const context = await browser.newContext(), page = await context.newPage()
      try {
        page.on('pageerror', e => pageErrors.push(e.message))
        page.on('console', message => {
          if (['warning', 'error'].includes(message.type())) consoleErrors.push(message.text())
        })
        page.on('request', r => { if (r.url().includes(':4311/')) requests.push(new URL(r.url()).pathname) })
        await page.goto('http://127.0.0.1:4310/')
        await page.waitForFunction(() => document.querySelector('[data-testid="hydration"]')?.textContent === 'hydrated'
          || document.body.innerText.includes('RUNTIME-002'), undefined, { timeout: 12000 })
        result.hydrated = await page.getByTestId('hydration').count() > 0
          && await page.getByTestId('hydration').textContent() === 'hydrated'
        try {
          if (!result.hydrated) throw new Error('Hydration failed')
          await page.getByTestId('counter').click({ timeout: 5000 })
          await page.getByTestId('counter').filter({ hasText: 'Remote count: 1' }).waitFor({ timeout: 3000 })
          result.interactive = true
        } catch { result.interactive = false }
        result.body = (await page.locator('body').innerText()).slice(0, 1200)
        result.browserGlobalType = await page.evaluate(name => typeof globalThis[name], scenario.remote)
      } finally { await context.close() }
    } catch (error) { result.error = String(error) }
    finally {
      for (const child of children) child.kill()
      await Promise.all(children.map(child => child.exitCode !== null ? undefined : new Promise(resolve => child.once('exit', resolve))))
      await writeFile(`results/logs/${scenario.name}.log`, logs.join(''))
    }
    result.pageErrors = pageErrors
    result.consoleErrors = consoleErrors
    result.remoteBrowserRequests = requests
    results.push(result)
    await writeFile('results/tanstack-start.json', evidence({ date: new Date().toISOString(), node: process.version, platform: process.platform, results }))
    console.log(scenario.name, `SSR=${result.ssr}`, `interactive=${result.interactive}`, result.error || '')
  }
  for (const r of results.filter(r => r.type === 'module' || r.remote === 'mf_remote')) {
    assert(r.ssr && r.interactive, `Expected working TanStack baseline/ESM case ${r.name}`)
  }
  for (const r of results.filter(r => r.type === 'var' && r.remote !== 'mf_remote')) {
    assert(!r.interactive, `Expected browser var collision ${r.name}`)
    assert([...r.pageErrors, ...r.consoleErrors].some(e => e.includes('RUNTIME-002')), `Expected RUNTIME-002 ${r.name}`)
  }
} finally { await browser.close() }
