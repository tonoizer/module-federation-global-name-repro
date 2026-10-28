import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { evidence } from './evidence.mjs'
const browser = await chromium.launch()
const results = []
await mkdir('results/logs', { recursive: true })
async function wait(url) {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(url)).ok) return } catch {}
    await new Promise(r => setTimeout(r, 300))
  }
  throw new Error(`Not ready: ${url}`)
}
try {
  for (const name of ['mf_remote', 'top', 'self', 'document', 'location', 'globalThis']) {
    const children = [], logs = [], requests = []
    try {
      for (const role of ['remote', 'host']) {
        const child = spawn(process.execPath, [resolve('node_modules/@rsbuild/core/bin/rsbuild.js'), 'dev'], {
          cwd: resolve(`apps/rsbuild-${role}`), env: { ...process.env, MF_REMOTE_NAME: name },
          stdio: ['ignore', 'pipe', 'pipe'],
        })
        children.push(child)
        child.stdout.on('data', x => logs.push(String(x)))
        child.stderr.on('data', x => logs.push(String(x)))
        await wait(`http://127.0.0.1:${role === 'remote' ? 4341 : 4340}/`)
      }
      const context = await browser.newContext(), page = await context.newPage()
      page.on('request', r => { if (r.url().includes(':4341/remoteEntry')) requests.push(r.url()) })
      await page.goto('http://127.0.0.1:4340/')
      await page.waitForFunction(() => window.__RSBUILD_ERROR__ || document.querySelector('[data-testid="rsbuild-counter"]'))
      let interactive = false
      const error = await page.evaluate(() => window.__RSBUILD_ERROR__)
      if (!error) {
        await page.getByTestId('rsbuild-counter').click()
        await page.getByTestId('rsbuild-counter').filter({ hasText: 'Remote count: 1' }).waitFor()
        interactive = true
      }
      results.push({ name, interactive, error, entryRequests: requests })
      await context.close()
      if (name === 'mf_remote') assert(interactive)
      else assert(error.includes('RUNTIME-002') && requests.length === 0)
      console.log(name, interactive ? 'PASS' : 'expected collision')
    } finally {
      for (const child of children) child.kill()
      await Promise.all(children.map(c => c.exitCode !== null ? undefined : new Promise(r => c.once('exit', r))))
      await writeFile(`results/logs/rsbuild-${name}.log`, logs.join(''))
    }
  }
  await writeFile('results/rsbuild.json', evidence({ date: new Date().toISOString(), results }))
} finally { await browser.close() }
