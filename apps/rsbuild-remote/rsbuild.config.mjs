import { defineConfig } from '@rsbuild/core'
import { pluginReact } from '@rsbuild/plugin-react'
import { pluginModuleFederation } from '@module-federation/rsbuild-plugin'
export default defineConfig({
  source: { entry: { index: './src/index.jsx' } },
  server: { host: '127.0.0.1', port: 4341, strictPort: true, cors: { origin: '*' } },
  output: { assetPrefix: 'http://127.0.0.1:4341/' },
  plugins: [pluginReact(), pluginModuleFederation({
    name: process.env.MF_REMOTE_NAME || 'mf_remote', filename: 'remoteEntry.js', dts: false,
    exposes: { './Counter': './src/Counter.jsx' },
    shared: { react: { singleton: true }, 'react-dom': { singleton: true } },
  })],
})
