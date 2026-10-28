import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
const role = process.argv[2]
if (!['host', 'remote'].includes(role)) throw new Error('Expected host or remote')
const cli = resolve('node_modules/@rsbuild/core/bin/rsbuild.js')
process.chdir(resolve(`apps/rsbuild-${role}`))
process.argv = [process.execPath, cli, 'dev']
await import(pathToFileURL(cli).href)
