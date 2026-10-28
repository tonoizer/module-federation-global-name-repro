# Observed results

Recorded 2026-10-28T13:41:53.929Z. Environment: win32, Node v24.19.0, Chromium 156.0.8078.4.

- @module-federation/vite: 1.23.6
- @module-federation/runtime: 2.9.2
- vite: 8.3.5
- @tanstack/react-start: 1.169.4
- @tanstack/react-router: 1.170.46
- react: 19.3.1
- playwright: 1.64.1

## Name matrix

Each row changes the actual configured name of a built Vite remote. Browser tests use those artifacts. The default Node CJS/ESM columns use minimal HTTP containers to isolate the runtime loader; the Vite SSR column uses actual generated SSR artifacts with the Vite VM loader.

| Remote name / entryGlobalName | Browser ESM | Browser var | Default Node CJS | Default Node ESM | Vite SSR VM |
| --- | --- | --- | --- | --- | --- |
| `mf_remote` | PASS | PASS | PASS | PASS | PASS |
| `top` | PASS | RUNTIME-002 | PASS | PASS | PASS |
| `self` | PASS | RUNTIME-002 | PASS | PASS | PASS |
| `parent` | PASS | RUNTIME-002 | PASS | PASS | PASS |
| `window` | PASS | RUNTIME-002 | PASS | PASS | PASS |
| `document` | PASS | RUNTIME-002 | PASS | PASS | PASS |
| `location` | PASS | RUNTIME-002 | PASS | PASS | PASS |
| `frames` | PASS | RUNTIME-002 | PASS | PASS | PASS |
| `globalThis` | PASS | RUNTIME-002 | RUNTIME-002 | RUNTIME-002 | PASS |
| `global` | PASS | PASS | RUNTIME-002 | RUNTIME-002 | PASS |
| `process` | PASS | PASS | RUNTIME-002 | RUNTIME-002 | PASS |
| `Buffer` | PASS | PASS | RUNTIME-002 | RUNTIME-002 | PASS |
| `console` | PASS | RUNTIME-002 | RUNTIME-002 | RUNTIME-002 | PASS |
| `navigator` | PASS | RUNTIME-002 | RUNTIME-002 | RUNTIME-002 | PASS |
| `fetch` | PASS | RUNTIME-002 | RUNTIME-002 | RUNTIME-002 | PASS |
| `performance` | PASS | RUNTIME-002 | RUNTIME-002 | RUNTIME-002 | PASS |
| `crypto` | PASS | RUNTIME-002 | RUNTIME-002 | RUNTIME-002 | PASS |
| `Object` | PASS | RUNTIME-002 | RUNTIME-002 | RUNTIME-002 | PASS |
| `constructor` | PASS | RUNTIME-002 | RUNTIME-002 | RUNTIME-002 | PASS |
| `toString` | PASS | RUNTIME-002 | RUNTIME-002 | RUNTIME-002 | PASS |
| `name` | PASS | RUNTIME-002 | PASS | PASS | PASS |
| `length` | PASS | PASS | PASS | PASS | PASS |
| `origin` | PASS | RUNTIME-002 | PASS | PASS | PASS |
| `NaN` | PASS | FAIL | FAIL | FAIL | PASS |
| `undefined` | PASS | FAIL | FAIL | FAIL | PASS |
| `Infinity` | PASS | RUNTIME-002 | RUNTIME-002 | RUNTIME-002 | PASS |
| `exports` | PASS | PASS | PASS | PASS | PASS |
| `module` | PASS | PASS | PASS | PASS | PASS |
| `require` | PASS | PASS | PASS | PASS | PASS |
| `setTimeout` | PASS | RUNTIME-002 | RUNTIME-002 | RUNTIME-002 | PASS |

When the global already contains a truthy value, the loader raises RUNTIME-002 with **zero requests to the remote entry**. The browser name case is different: Window.name starts as an empty string, so its script is requested, but the setter converts the container to a string and initialization then fails. Other FAIL rows include readonly-global registration failures (NaN/undefined). See raw error messages in [browser.json](results/browser.json) and [node.json](results/node.json).

## TanStack Start integration

Both applications are TanStack Start. SSR is checked by fetching HTML without executing JavaScript and requiring actual remote markup without a server-rendering fallback error. Browser success requires hydration and clicking the remote counter from 0 to 1. A 200 response alone does not count as success.

| Scenario | Remote name | Host name | Type | Remote HTML from SSR | Hydrated and interactive |
| --- | --- | --- | --- | --- | --- |
| baseline | `mf_remote` | `mf_host` | module | PASS | PASS |
| remote-top-esm | `top` | `mf_host` | module | PASS | PASS |
| remote-self-esm | `self` | `mf_host` | module | PASS | PASS |
| remote-parent-esm | `parent` | `mf_host` | module | PASS | PASS |
| remote-window-esm | `window` | `mf_host` | module | PASS | PASS |
| remote-document-esm | `document` | `mf_host` | module | PASS | PASS |
| remote-location-esm | `location` | `mf_host` | module | PASS | PASS |
| remote-frames-esm | `frames` | `mf_host` | module | PASS | PASS |
| remote-process-esm | `process` | `mf_host` | module | PASS | PASS |
| remote-globalThis-esm | `globalThis` | `mf_host` | module | PASS | PASS |
| remote-Buffer-esm | `Buffer` | `mf_host` | module | PASS | PASS |
| host-top | `mf_remote` | `top` | module | PASS | PASS |
| host-process | `mf_remote` | `process` | module | PASS | PASS |
| host-window | `mf_remote` | `window` | module | PASS | PASS |
| remote-mf_remote-var | `mf_remote` | `mf_host` | var | PASS | PASS |
| remote-top-var | `top` | `mf_host` | var | PASS | FAIL |
| remote-self-var | `self` | `mf_host` | var | PASS | FAIL |
| remote-parent-var | `parent` | `mf_host` | var | PASS | FAIL |
| remote-window-var | `window` | `mf_host` | var | PASS | FAIL |
| remote-document-var | `document` | `mf_host` | var | PASS | FAIL |
| remote-location-var | `location` | `mf_host` | var | PASS | FAIL |
| remote-frames-var | `frames` | `mf_host` | var | PASS | FAIL |
| remote-process-var | `process` | `mf_host` | var | PASS | FAIL |

In the failing var cases, the React route boundary reports RUNTIME-002. The browser never requests the remote entry. The SSR loader succeeds, so HTML can initially appear correct before hydration fails. In this Start/Vite development environment, a browser process global is also present; consequently process fails here as a var remote although it passes in the isolated plain-browser fixture. Ambient globals and polyfills change which names collide.

All 60 isolated host-only name controls passed (0 failures). Three full Start host-only controls also passed. These tests change the host instance name while leaving the remote's name and global key safe. A host that is itself consumed as a var remote still has the remote-side risk.

## Direct generated var script

These tests explicitly execute the generated script, bypassing the runtime's shortcut. They run in fresh browser contexts.

| Name | Global changed | Container init available | Navigation |
| --- | --- | --- | --- |
| `mf_remote` | true | function | none |
| `top` | false | undefined | none |
| `self` | true | function | none |
| `parent` | true | function | none |
| `window` | false | undefined | none |
| `document` | false | undefined | none |
| `location` | page navigated | n/a | http://127.0.0.1:4320/[object%20Object] |
| `frames` | true | function | none |
| `name` | true | undefined | none |
| `globalThis` | true | function | none |

The location script navigates to /[object%20Object]. Writable globals such as self, parent and frames are replaced; top, window and document retain their original values. This is a separate effect from the loader skipping a remote because a global already exists.

## Verification boundaries

- 100 browser observations, 120 Node observations, and 23 full Start scenarios.
- Production browser and SSR remote fixtures are built before the runtime matrices.
- Full Start SSR/hydration scenarios run in development, with fresh application processes for each scenario.
- Both Start production builds and TypeScript are separate smoke checks; no production application deployment was tested.
- Windows workarounds are described in README.md. No dependency source was patched.
- Names such as require, module and exports are module-local in the tested Node ESM runner; their success here does not establish safety in every CommonJS/browser-polyfill environment.
- Chromium and Node 24 were tested. Other engines, Vite versions, and older federation releases may differ.
