# Coordinated fixes

There are three complementary scopes. They do not require a simultaneous release.

| Repository | Boundary | Relationship |
| --- | --- | --- |
| module-federation/core | Runtime lookup before fetching an entry | Applies to Vite, enhanced Rspack, Rsbuild and other users of the shared runtime. Detects collisions before any script load. |
| module-federation/vite | Generated optional varRemoteEntry script | Protects direct script loading even when the Core loader is bypassed. No code dependency on the native Rspack PR. |
| web-infra-dev/rspack | Generated native federation container | Protects direct native container loading even when the Core loader is bypassed. No code dependency on the Vite PR. |

The patches preserve safe remote names and legitimate preloaded container interfaces. They reject colliding global registration with an actionable error; they do not make names such as window or location safe var-container names. ESM and a host's own instance name remain separate cases.

The demo's baseline results intentionally use released dependencies. Each upstream PR includes regression tests against its own modified source. The additional Windows SSR path issues are outside these changes.

## Pull requests

- [Core #5223](https://github.com/module-federation/core/pull/5223): shared lookup and ownership-aware cleanup; 152 package tests, build/lint, actual Node HTTP loading and native/enhanced Rspack integration pass. Independent review completed after fixing the cleanup finding.
- [Vite #1512](https://github.com/module-federation/vite/pull/1512): direct var-wrapper registration; 31 focused tests, build/typecheck and 14 Chromium cases pass. The final Linux run passed 1,885 tests with one skipped, and upstream integration/Playwright/build/lint checks are green. Independent review includes the maintainer's identifier follow-up. [Exact-head Linux evidence](https://github.com/tonoizer/module-federation-global-name-repro/actions/runs/40711386915).
- [Rspack #16323](https://github.com/web-infra-dev/rspack/pull/16323): native container registration; independently reviewed, including the test artifact filename correction. Full native binding build, JS build, and both real harness modes pass on the final head. [Exact-head Linux evidence](https://github.com/tonoizer/module-federation-global-name-repro/actions/runs/40710533683).
- [Runtime issue #5222](https://github.com/module-federation/core/issues/5222) contains the shared reproduction and expected behavior.

There is no release-order dependency. Core protects consumers before fetching scripts; Vite and Rspack protect their own generated registration code. The Vite and Rspack PRs have no code dependency on one another.

Retaining classic var semantics preserves lexical-binding conflict checks. A direct script's var declaration can still introduce an undefined own binding shadowing an inherited property before its guard rejects container assignment. The prototype value is preserved. Core preflight prevents executing that script in runtime-managed loading. The patches do not claim arbitrary global names become usable.

The baseline demo command `npm test` passes all 261 observations (expected collisions count as successful assertions). `MF_CORE_BUILD=/absolute/path/to/runtime-core/dist/index.js npm run test:rspack` additionally checks actual rebuilt Core with Rspack; its recorded results are in `results/rspack-patched-core.json`.
