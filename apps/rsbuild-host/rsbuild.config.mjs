import { defineConfig } from '@rsbuild/core'
import { pluginReact } from '@rsbuild/plugin-react'
import { pluginModuleFederation } from '@module-federation/rsbuild-plugin'
export default defineConfig({
  source: { entry: { index: './src/index.jsx' } },
  server: { host: '127.0.0.1', port: 4340, strictPort: true },
  plugins: [pluginReact(), pluginModuleFederation({
    name: 'rsbuild_host', dts: false,
    remotes: { remote: `${process.env.MF_REMOTE_NAME || 'mf_remote'}@http://127.0.0.1:4341/remoteEntry.js` },
    shared: { react: { singleton: true }, 'react-dom': { singleton: true } },
  })],
})
