# Module Federation global name reproduction

Reproduces name collisions with **TanStack Start + Vite**, **Rspack native/enhanced federation**, and an interactive **Rsbuild React host/remote microfrontend**, plus isolated browser and Node loader tests. Published dependencies reproduce the original behavior; upstream fixes are linked in [PR coordination](PR-COORDINATION.md).

**Confirmed:** browser `var` remotes named `top`, `self`, `parent`, `window`, `document`, `location`, or `frames` fail with `RUNTIME-002`. The loader mistakes an existing global for an already loaded container and never requests the entry. In the TanStack Start pair, SSR succeeds but browser hydration fails.

This is **not a blanket failure of federation instance names**: the same names work as ESM remotes, and using them only as a host instance name works in the tested paths.

## Run

Requires Node 24 (tested with 24.19.0), npm, and free ports **4310, 4311, 4320, 4330, 4340, 4341**.

```sh
npm ci
npx playwright install chromium
npm test
```

Expected collisions are assertions: a successful test run reproduces both working controls and the documented failures. Each browser case gets a fresh context; each Node case gets a fresh process. TanStack scenarios restart both applications.

For an interactive baseline, run in two terminals:

```sh
npm run dev:remote
npm run dev:host
```

Open http://127.0.0.1:4310. The host renders a remote counter on the server, hydrates it in the browser, and increments it on click.

To reproduce the collision in PowerShell, set these variables in **both terminals before starting the apps**:

```powershell
$env:MF_REMOTE_NAME = 'top'
$env:MF_REMOTE_TYPE = 'var'
```

Restart both processes after changing names. With `MF_REMOTE_TYPE=module`, the same `top` remote works. `MF_HOST_NAME` independently changes only the host's own federation name. Defaults are `mf_remote`, `mf_host`, and `module`.

## Results and scope

### Rsbuild React microfrontend

Run `npm run dev:rsbuild-remote` and `npm run dev:rsbuild-host` in separate terminals, then visit http://127.0.0.1:4340. Set `MF_REMOTE_NAME=top` in both terminals and restart to reproduce the browser collision. The remote exports a React counter; the host imports it through Module Federation and shares React as a singleton. This is a client-rendered microfrontend use case, complementary to the TanStack SSR case.

`npm run test:rsbuild` validates six scenarios, including clicking the safe-name remote counter. `npm run test:rspack` separately compiles and runs twelve native/enhanced Rspack host/remote scenarios. We use Rsbuild as the additional app framework; this repository does not claim to have tested a separate Modern.js application.

See [RESULTS.md](RESULTS.md) and the committed [raw evidence](results/). These are observed results for the pinned versions, not a guarantee for every bundler, browser, runtime, or future release.

| Test | Coverage |
| --- | --- |
| TanStack Start host + remote | Dev SSR HTML, browser hydration, actual remote counter interaction; ESM and `var` configurations; host-only name controls |
| Production Vite remote fixtures | 30 real federation names, each built to browser ESM, a `var` wrapper, and SSR ESM |
| Browser runtime | ESM and `var` loading, remote request counts, host-only name controls |
| Direct `var` script | Global overwrites and navigation, independently of the runtime's cache shortcut |
| Standard Node runtime | Small dependency-free HTTP CommonJS and ESM containers, isolating default-loader behavior |
| Vite SSR loader | Actual built Vite SSR ESM remotes with the plugin's VM loader |

The Node default-loader fixtures are deliberately small synthetic containers, **not** TanStack Start applications. The TanStack integration is verified separately. TanStack production builds are smoke checks; the full application interaction matrix runs in development.

The name list is in [scripts/names.mjs](scripts/names.mjs). Individual commands are `npm run build:fixtures`, `npm run test:browser`, `npm run test:node`, `npm run test:start`, and `npm run typecheck`. Browser and Node tests require the fixtures to have been built first. The Node runner supplies `--experimental-vm-modules` to child processes.

## Why it happens

1. `getRemoteEntryExports(name, globalName)` reads `CurrentGlobal[globalName]`.
2. The browser `var` loader and default Node loader accept any truthy result as a cached remote without checking its container interface.
3. A built-in like `window.top` or `globalThis.process` therefore skips loading.
4. Container initialization later throws `The remote entry interface does not contain "init" #RUNTIME-002`.

Browser ESM uses dynamic import and bypasses this lookup. The Vite SSR loader supplies the module namespace through its `loadEntry` hook before the default Node loader runs. A host's own instance name is stored in the federation instance registry rather than directly in `globalThis[name]`.

There is also an independent problem in Vite's optional `varFilename` output: it emits `var NAME; NAME = …`. Direct script execution can overwrite writable globals; assigning `location` initiates a navigation. An identifier syntax check does not prevent these collisions.

Reviewed upstream sources:

- [Runtime global lookup](https://github.com/module-federation/core/blob/512bef835f1df67fdb967e54084061b8d326b970/packages/runtime-core/src/global.ts#L259)
- [Browser and Node entry loaders](https://github.com/module-federation/core/blob/512bef835f1df67fdb967e54084061b8d326b970/packages/runtime-core/src/utils/load.ts)
- [Vite `var` wrapper generation](https://github.com/module-federation/vite/blob/5b73c2cdcedfa182a3c3d6df05ab39f21e7f828e/src/plugins/pluginVarRemoteEntry.ts#L100)
- [Vite SSR loader](https://github.com/module-federation/vite/blob/5b73c2cdcedfa182a3c3d6df05ab39f21e7f828e/src/utils/ssrEntryLoader.ts)
- [TanStack Start setup](https://tanstack.com/start/latest/docs/framework/react/build-from-scratch)

Source links identify reviewed commits; installed release versions and lockfile define the experiments. The installed runtime 2.9.2 contains the same global lookup and loader shortcut.

## Configuration details

The Start pair explicitly configures `ssrEntryLoader` with shared-package `file:` URLs. In Vite federation 1.23.6, the automatic dev SSR mapping treats Windows `C:\…` paths as URL schemes; even the safe-name baseline otherwise fails with `ERR_UNSUPPORTED_ESM_URL_SCHEME`. This workaround preserves the host's React resolution and does not alter the name lookup.

The isolated production SSR fixtures use the Vite loader's `vm` strategy to avoid a separate Windows temp-file import path problem. The browser-only `var` output hook is restricted to the client environment in the Start config; otherwise it also runs on the SSR build and cannot find a browser `remoteEntry.js` chunk. These are independent baseline configuration issues, not evidence of name collisions. Dependencies are unmodified.

Use application-specific names such as `acme_catalog_remote` and an explicit remote type. A fixed denylist cannot cover custom globals, polyfills, or future platform additions. The three upstream fixes and their distinct validation scopes are linked in [PR coordination](PR-COORDINATION.md).
