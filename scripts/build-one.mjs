import { build } from 'vite'
import { federation } from '@module-federation/vite'
import { resolve } from 'node:path'
const name = process.argv[2]
const config = {
  configFile: false,
  root: resolve('fixtures/remote'),
  base: `/remotes/${name}/`,
  logLevel: 'error',
  build: { outDir: resolve('dist/remotes', name), emptyOutDir: true, minify: false },
}
function plugins(ssr = false) { return [federation({ name, filename: 'remoteEntry.js', ...(ssr ? {} : { varFilename: 'varRemoteEntry.js' }),
  manifest: true, dts: false, exposes: { './message': './src/message.js' } })] }
await build({ ...config, plugins: plugins() })
await build({ ...config, plugins: plugins(true), build: { ...config.build, emptyOutDir: false, ssr: 'src/main.js' } })
