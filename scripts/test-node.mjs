import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { names } from './names.mjs'
import { startStaticServer } from './static-server.mjs'
const { server, requests } = await startStaticServer()
const results = []
async function run(name, mode, ownName) {
  const start = requests.length
  const result = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--experimental-vm-modules', 'scripts/node-one.mjs', name, mode, ...(ownName ? [ownName] : [])])
    let stdout = '', stderr = ''
    child.stdout.on('data', x => stdout += x)
    child.stderr.on('data', x => stderr += x)
    child.on('error', reject)
    child.on('exit', code => {
      const line = stdout.split('\n').find(x => x.startsWith('LAB_RESULT '))
      if (!line) reject(new Error(`Node case ${name}/${mode} exited ${code}: ${stderr}`))
      else resolve(JSON.parse(line.slice(11)))
    })
  })
  results.push({ ...result, ...(ownName ? { test: 'own-host-name' } : {}), requests: requests.slice(start) })
  console.log(mode, ownName ? `host=${ownName}` : name, result.ok ? 'PASS' : 'FAIL', requests.length - start)
}
try {
  for (const mode of ['cjs', 'esm', 'vite-ssr']) for (const name of names) await run(name, mode)
  for (const ownName of names) await run('mf_remote', 'cjs', ownName)
  await mkdir('results', { recursive: true })
  await writeFile('results/node.json', JSON.stringify({ date: new Date().toISOString(), node: process.version, platform: process.platform, results }, null, 2) + '\n')
  assert(results.filter(r => r.mode === 'vite-ssr').every(r => r.ok), 'Vite SSR loader should bypass raw global collisions')
  assert(results.filter(r => r.test === 'own-host-name').every(r => r.ok), 'Own Node host names should work')
  for (const mode of ['cjs', 'esm']) for (const name of ['process', 'global', 'globalThis', 'Buffer', 'console', 'navigator', 'fetch', 'constructor', 'toString']) {
    const r = results.find(r => r.name === name && r.mode === mode && !r.test)
    assert(!r.ok && r.error.includes('RUNTIME-002') && r.requests.length === 0, `Expected Node collision: ${name}/${mode}`)
  }
} finally { server.close() }
