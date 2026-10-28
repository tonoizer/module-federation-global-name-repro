import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import { federation } from '@module-federation/vite'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
// 1.23.6's dev SSR loader treats C:\ paths as URL schemes. Explicit file URLs
// preserve the host's shared React instance on Windows without patching dependencies.
const resolvedShared = Object.fromEntries(['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime']
  .map(id => [id, pathToFileURL(require.resolve(id)).href]))

export function startConfig(root: string, role: 'host' | 'remote') {
  const name = process.env.MF_REMOTE_NAME || 'mf_remote'
  const type = process.env.MF_REMOTE_TYPE || 'module'
  return defineConfig({
    root,
    server: { host: '127.0.0.1', port: role === 'host' ? 4310 : 4311, strictPort: true, cors: true },
    preview: { host: '127.0.0.1', port: role === 'host' ? 4310 : 4311, strictPort: true },
    plugins: [
      federation({
        name: role === 'host' ? process.env.MF_HOST_NAME || 'mf_host' : name,
        filename: 'remoteEntry.js',
        varFilename: 'varRemoteEntry.js',
        manifest: true,
        dts: false,
        hostInitInjectLocation: 'entry',
        runtimePlugins: [['@module-federation/vite/ssrEntryLoader', { resolvedShared }]],
        ...(role === 'remote'
          ? { exposes: { './Counter': './src/Counter.tsx', './message': './src/message.ts' } }
          : { remotes: { remote: { type, name, entryGlobalName: name,
              entry: `http://127.0.0.1:4311/${type === 'var' ? 'varRemoteEntry.js' : 'remoteEntry.js'}` } } }),
        shared: { react: { singleton: true }, 'react-dom': { singleton: true } },
      }).map(plugin => plugin.name === 'module-federation-var-remote-entry' && !plugin.apply
        ? { ...plugin, applyToEnvironment: environment => environment.config.consumer === 'client' }
        : plugin),
      tanstackStart(),
      react(),
    ],
  })
}
