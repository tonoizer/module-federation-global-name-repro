import { createInstance } from '@module-federation/runtime'
const query = new URLSearchParams(location.search)
const name = query.get('name') || 'mf_remote'
const type = query.get('type') || 'module'
const globalName = query.get('globalName') || name
const ownName = query.get('ownName') || 'lab_browser_host'
const before = globalThis[globalName]
const result = { name, type, globalName, ownName, beforeType: typeof before }
try {
  const instance = createInstance({ name: ownName, remotes: [{ name, alias: 'probe', type,
    entryGlobalName: globalName,
    entry: `${location.origin}/remotes/${name}/${type === 'var' ? 'varRemoteEntry.js' : 'remoteEntry.js'}`,
  }] })
  const mod = await instance.loadRemote('probe/message')
  result.message = mod?.message
  result.ok = result.message === 'federated-ok'
} catch (error) {
  result.ok = false
  result.error = String(error)
}
result.globalChanged = globalThis[globalName] !== before
globalThis.__LAB_RESULT__ = result
document.getElementById('result').textContent = JSON.stringify(result, null, 2)
