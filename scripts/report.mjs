import { readFile, writeFile } from 'node:fs/promises'
import { names } from './names.mjs'
const read = async name => JSON.parse(await readFile(`results/${name}.json`, 'utf8'))
const browser = await read('browser'), node = await read('node'), start = await read('tanstack-start')
const rspack = await read('rspack'), rsbuild = await read('rsbuild')
const mark = r => r?.ok ? 'PASS' : r?.error?.includes('RUNTIME-002') ? 'RUNTIME-002' : 'FAIL'
const rows = names.map(name => {
  const b = type => browser.results.find(r => r.name === name && r.type === type && !r.test)
  const n = mode => node.results.find(r => r.name === name && r.mode === mode && !r.test)
  return `| \`${name}\` | ${mark(b('module'))} | ${mark(b('var'))} | ${mark(n('cjs'))} | ${mark(n('esm'))} | ${mark(n('vite-ssr'))} |`
})
const packageJson = JSON.parse(await readFile('package.json', 'utf8'))
const versions = ['@module-federation/vite', '@module-federation/runtime', 'vite', '@tanstack/react-start', '@tanstack/react-router', 'react', 'playwright']
const hostControls = [...browser.results, ...node.results].filter(r => r.test === 'own-host-name')
const text = `# Observed results

Recorded ${start.date}. Environment: ${node.platform}, Node ${node.node}, Chromium ${browser.browser}.

${versions.map(name => `- ${name}: ${packageJson.dependencies[name]}`).join('\n')}

## Name matrix

Each row changes the actual configured name of a built Vite remote. Browser tests use those artifacts. The default Node CJS/ESM columns use minimal HTTP containers to isolate the runtime loader; the Vite SSR column uses actual generated SSR artifacts with the Vite VM loader.

| Remote name / entryGlobalName | Browser ESM | Browser var | Default Node CJS | Default Node ESM | Vite SSR VM |
| --- | --- | --- | --- | --- | --- |
${rows.join('\n')}

When the global already contains a truthy value, the loader raises RUNTIME-002 with **zero requests to the remote entry**. The browser name case is different: Window.name starts as an empty string, so its script is requested, but the setter converts the container to a string and initialization then fails. Other FAIL rows include readonly-global registration failures (NaN/undefined). See raw error messages in [browser.json](results/browser.json) and [node.json](results/node.json).

## TanStack Start integration

Both applications are TanStack Start. SSR is checked by fetching HTML without executing JavaScript and requiring actual remote markup without a server-rendering fallback error. Browser success requires hydration and clicking the remote counter from 0 to 1. A 200 response alone does not count as success.

| Scenario | Remote name | Host name | Type | Remote HTML from SSR | Hydrated and interactive |
| --- | --- | --- | --- | --- | --- |
${start.results.map(r => `| ${r.name} | \`${r.remote}\` | \`${r.host}\` | ${r.type} | ${r.ssr ? 'PASS' : 'FAIL'} | ${r.interactive ? 'PASS' : 'FAIL'} |`).join('\n')}

In the failing var cases, the React route boundary reports RUNTIME-002. The browser never requests the remote entry. The SSR loader succeeds, so HTML can initially appear correct before hydration fails. In this Start/Vite development environment, a browser process global is also present; consequently process fails here as a var remote although it passes in the isolated plain-browser fixture. Ambient globals and polyfills change which names collide.

All ${hostControls.length} isolated host-only name controls passed (${hostControls.filter(r => !r.ok).length} failures). Three full Start host-only controls also passed. These tests change the host instance name while leaving the remote's name and global key safe. A host that is itself consumed as a var remote still has the remote-side risk.

## Direct generated var script

These tests explicitly execute the generated script, bypassing the runtime's shortcut. They run in fresh browser contexts.

| Name | Global changed | Container init available | Navigation |
| --- | --- | --- | --- |
${browser.results.filter(r => r.test === 'direct-var-script').map(r => `| \`${r.name}\` | ${r.snapshotLost ? 'page navigated' : String(r.changed)} | ${r.initType || 'n/a'} | ${r.navigations.join(', ') || 'none'} |`).join('\n')}

The location script navigates to /[object%20Object]. Writable globals such as self, parent and frames are replaced; top, window and document retain their original values. This is a separate effect from the loader skipping a remote because a global already exists.

## Rspack and Rsbuild use cases

The native Rspack 1.5 and enhanced Rspack 2 hosts/remotes are production-style compiler fixtures. The Rsbuild pair is an actual React microfrontend: a safe-name control must render and increment the remote counter; colliding names fail before requesting the remote entry.

| Integration | Name | Outcome | Remote entry requests |
| --- | --- | --- | --- |
${rspack.results.map(r => `| Rspack ${r.kind} | \`${r.name}\` | ${r.ok ? 'PASS' : 'RUNTIME-002'} | ${r.remoteRequests.filter(p => p.endsWith('remoteEntry.js')).length} |`).join('\n')}
${rsbuild.results.map(r => `| Rsbuild React microfrontend | \`${r.name}\` | ${r.interactive ? 'PASS, counter clicked' : 'RUNTIME-002'} | ${r.entryRequests.length} |`).join('\n')}

Versions: @rspack/core ${packageJson.dependencies['@rspack/core']}, @module-federation/enhanced ${packageJson.dependencies['@module-federation/enhanced']}, @rsbuild/core ${packageJson.dependencies['@rsbuild/core']}, @module-federation/rsbuild-plugin ${packageJson.dependencies['@module-federation/rsbuild-plugin']}.

## Verification boundaries

- ${browser.results.length} browser observations, ${node.results.length} Node observations, and ${start.results.length} full Start scenarios.
- ${rspack.results.length} Rspack compiled host/remote cases and ${rsbuild.results.length} Rsbuild React microfrontend cases.
- Production browser and SSR remote fixtures are built before the runtime matrices.
- Full Start SSR/hydration scenarios run in development, with fresh application processes for each scenario.
- Both Start production builds and TypeScript are separate smoke checks; no production application deployment was tested.
- Windows workarounds are described in README.md. No dependency source was patched.
- Names such as require, module and exports are module-local in the tested Node ESM runner; their success here does not establish safety in every CommonJS/browser-polyfill environment.
- Chromium and Node 24 were tested. Other engines, Vite versions, and older federation releases may differ.
`
await writeFile('RESULTS.md', text)
console.log(`Report: ${browser.results.length + node.results.length + start.results.length + rspack.results.length + rsbuild.results.length} observations`)
