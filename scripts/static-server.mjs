import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
export function startStaticServer(port = 4320) {
  const requests = []
  const server = createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname
    requests.push(pathname)
    if (pathname.startsWith('/node-cjs/')) {
      res.setHeader('Content-Type', 'text/javascript')
      res.end("module.exports = { init() {}, get() { return () => ({ message: 'federated-ok' }) } }")
      return
    }
    if (pathname.startsWith('/node-esm/')) {
      res.setHeader('Content-Type', 'text/javascript')
      res.end("export function init() {} export function get() { return () => ({ message: 'federated-ok' }) }")
      return
    }
    const base = resolve(pathname.startsWith('/remotes/') ? 'dist' : 'dist/browser')
    const file = resolve(base, `.${pathname === '/' ? '/index.html' : pathname}`)
    if (!file.startsWith(base + sep)) { res.writeHead(403).end(); return }
    try {
      const content = await readFile(file)
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.json': 'application/json', '.html': 'text/html' })[extname(file)] || 'application/octet-stream')
      res.end(content)
    } catch { res.writeHead(404).end('Not found') }
  })
  return new Promise((resolve, reject) => {
    server.on('error', reject)
    server.listen(port, '127.0.0.1', () => resolve({ server, requests }))
  })
}
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await startStaticServer()
  console.log('Fixture server: http://127.0.0.1:4320')
}
