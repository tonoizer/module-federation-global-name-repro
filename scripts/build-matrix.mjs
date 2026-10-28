import { spawn } from 'node:child_process'
import { build } from 'vite'
import { resolve } from 'node:path'
import { names } from './names.mjs'
for (const name of names) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/build-one.mjs', name], { stdio: 'inherit' })
    child.on('error', reject)
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`Build ${name}: ${code}`)))
  })
  console.log(`Built ${name}`)
}
await build({ configFile: false, root: resolve('fixtures/browser'), logLevel: 'error',
  build: { outDir: resolve('dist/browser'), emptyOutDir: true,
    rolldownOptions: { input: { index: resolve('fixtures/browser/index.html'), empty: resolve('fixtures/browser/empty.html') } } } })
