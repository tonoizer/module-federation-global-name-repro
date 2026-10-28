import { createInstance } from '@module-federation/runtime'
import ssrEntryLoader from '@module-federation/vite/ssrEntryLoader'
const [name, mode, ownName = 'lab_node_host'] = process.argv.slice(2)
const before = globalThis[name]
const entry = mode === 'vite-ssr' ? `http://127.0.0.1:4320/remotes/${name}/remoteEntry.ssr.js`
  : `http://127.0.0.1:4320/node-${mode}/${name}.js`
const result = { name, mode, ownName, beforeType: typeof before }
try {
  const instance = createInstance({ name: ownName,
    // VM avoids an independent temp-file Windows path conversion bug in 1.23.6.
    plugins: mode === 'vite-ssr' ? [ssrEntryLoader({ strategy: 'vm' })] : [],
    remotes: [{ name, alias: 'probe', entry, type: mode === 'cjs' ? 'commonjs-module' : 'module', entryGlobalName: name }],
  })
  const mod = await instance.loadRemote('probe/message')
  result.message = mod?.message
  result.ok = result.message === 'federated-ok'
} catch (error) { result.ok = false; result.error = String(error) }
result.globalChanged = globalThis[name] !== before
process.stdout.write(`LAB_RESULT ${JSON.stringify(result)}\n`)
