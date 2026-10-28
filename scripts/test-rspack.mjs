import { rspack } from '@rspack/core'
import { ModuleFederationPlugin as EnhancedPlugin } from '@module-federation/enhanced/rspack'
import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, extname } from 'node:path'
import assert from 'node:assert/strict'

const root = resolve('fixtures/rspack')
const port = 4330
const requests = []
const patchedCore = process.env.MF_CORE_BUILD
await mkdir(resolve(root, 'src'), { recursive: true })
await writeFile(resolve(root, 'src/message.js'), "export const message = 'rspack-federated-ok'\n")
await writeFile(resolve(root, 'src/host.js'), `import('probe/message').then(m => {
  window.__LAB_RESULT__ = { ok: m.message === 'rspack-federated-ok', message: m.message }
}).catch(e => { window.__LAB_RESULT__ = { ok: false, error: String(e) } })`)

async function build(options) {
  const compiler = rspack(options)
  await new Promise((resolve, reject) => compiler.run((error, stats) => {
    compiler.close(closeError => {
      if (error || closeError) reject(error || closeError)
      else if (stats.hasErrors()) reject(new Error(stats.toString({ all: false, errors: true })))
      else resolve()
    })
  }))
}

const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, `http://127.0.0.1:${port}`).pathname
  requests.push(pathname)
  if (pathname.endsWith('/index.html')) {
    res.setHeader('Content-Type', 'text/html')
    res.end('<!doctype html><html><body><script src="./host/host.js"></script></body></html>')
    return
  }
  try {
    const file = resolve(root, 'dist', `.${pathname}`)
    const data = await readFile(file)
    res.setHeader('Content-Type', extname(file) === '.js' ? 'text/javascript' : 'text/plain')
    res.end(data)
  } catch { res.writeHead(404).end('Not found') }
})
await new Promise(resolve => server.listen(port, '127.0.0.1', resolve))
const browser = await chromium.launch()
const results = []
try {
  for (const kind of ['builtin-1.5', 'enhanced-2']) for (const name of ['mf_safe', 'top', 'self', 'document', 'location', 'globalThis']) {
    const Plugin = kind === 'builtin-1.5' ? rspack.container.ModuleFederationPlugin : EnhancedPlugin
    const key = `${kind}/${name}`
    const common = { mode: 'development', devtool: false, context: resolve(root, 'src'),
      ...(patchedCore ? { resolve: { alias: { '@module-federation/runtime-core$': resolve(patchedCore) } } } : {}),
      target: 'web', optimization: { minimize: false } }
    const extra = kind === 'enhanced-2' ? { dts: false, manifest: false } : {}
    await build({ ...common, entry: {},
      output: { path: resolve(root, 'dist', key, 'remote'), filename: 'bundle.js', chunkFilename: '[id].js',
        publicPath: `http://127.0.0.1:${port}/${key}/remote/`, uniqueName: `remote_${name}` },
      plugins: [new Plugin({ name, filename: 'remoteEntry.js', exposes: { './message': './message.js' }, ...extra })],
    })
    await build({ ...common, entry: './host.js',
      output: { path: resolve(root, 'dist', key, 'host'), filename: 'host.js', chunkFilename: '[id].js',
        publicPath: `http://127.0.0.1:${port}/${key}/host/`, uniqueName: 'lab_host' },
      plugins: [new Plugin({ name: 'lab_host', remotes: { probe: `${name}@http://127.0.0.1:${port}/${key}/remote/remoteEntry.js` }, ...extra })],
    })
    const context = await browser.newContext(), page = await context.newPage()
    const start = requests.length
    await page.goto(`http://127.0.0.1:${port}/${key}/index.html`)
    await page.waitForFunction(() => window.__LAB_RESULT__, undefined, { timeout: 10000 })
    const result = { kind, name, ...(await page.evaluate(() => window.__LAB_RESULT__)),
      remoteRequests: requests.slice(start).filter(p => p.startsWith(`/${key}/remote/`)) }
    results.push(result)
    console.log(JSON.stringify(result))
    await context.close()
    if (name === 'mf_safe') assert(result.ok)
    else assert(!result.ok && result.error.includes(patchedCore ? 'Remote entry global name collision' : 'RUNTIME-002') && result.remoteRequests.length === 0)
  }
  await writeFile(resolve(patchedCore ? 'results/rspack-patched-core.json' : 'results/rspack.json'), JSON.stringify({ rspack: '2.2.9', enhanced: '2.9.2', patchedCore: Boolean(patchedCore), results }, null, 2))
} finally { await browser.close(); server.close() }
