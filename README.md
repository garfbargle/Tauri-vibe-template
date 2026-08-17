# Tauri Vibe Template

A Tauri 2 + React starter built around the cross-platform details that are easy to get wrong *after* the product already works: Android edge-to-edge insets, keyboard-safe layout, foldables/DeX, mobile viewport sizing, least-privilege capabilities, repeatable release versioning, desktop distribution, and Library-managed Android artifacts.

The starter screen is intentionally a **platform conformance harness**, not a sample product. It places interactive UI at every edge, includes a scroll region, opens a corner menu, and exposes live geometry diagnostics so a new app can prove its shell is correct before product UI replaces it.

This repository is also the reference implementation for CI/release policy across our Tauri apps:

- routine GitHub CI is manual-only;
- a commit on `main` is cheap unless it contains a version newer than the latest Android release;
- the only normal automatic build is a genuine Library release candidate;
- Library enrollment is declared from the app repository itself;
- Android distribution signing belongs to Library, not the app repository.

The seed repository itself doubles as an end-to-end Library integration test using **Tauri Vibe App** (`com.example.taurivibe`). `template.config.json` deliberately remains `initialized: false` so repos created from this template start inert; the release workflow contains a seed-repository-only override for `garfbargle/Tauri-vibe-template` so this one repository can still publish a real smoke-test APK.

## Start a new app

Use this repository as a GitHub template, clone the new repo, then run:

```sh
npm install
npm run init -- --name "My App" --identifier com.example.myapp
npm run tauri dev
```

`npm run init` updates the display name, npm/Rust identifiers, bundle identifier, Library storefront metadata, repo-side `managedSigning.packageName`, HTML title, and icon set. If an Android SDK is configured it also generates the current Tauri Android scaffold and applies the native platform overlay. To explicitly control that step:

```sh
npm run init -- --name "My App" --identifier com.example.myapp --android
npm run init -- --name "My App" --identifier com.example.myapp --skip-android
```

A custom slug can be supplied with `--slug my-app`.

After initialization, replace `assets/app-icon.svg` with the real square app mark and run `npm run icons` again. Commit the generated `src-tauri/icons` directory. Once Android has been initialized on a development machine, **commit `src-tauri/gen/android`**; the generated project contains native behavior that should be code-reviewed, not silently recreated at release time.

If Android was skipped because the SDK was unavailable, the app is not release-ready yet. Configure the SDK, run `npm run android:prepare`, review the generated project, commit it, and run `npm run doctor:release` before the first Library release.

The seed repository is the one exception to the committed-scaffold rule: `garfbargle/Tauri-vibe-template` may bootstrap-generate Android inside its own release workflow so the template can remain a clean source template while still acting as a real Library smoke app. Repositories created from it do not get that exception.

## What this template guarantees

### Safe areas that actually work on Android

Modern Android draws apps edge-to-edge. Android WebView cannot be treated as if CSS `env(safe-area-inset-*)` always describes the status bar, navigation area, cutout, and software keyboard.

This template uses a native `WindowInsetsCompat` bridge with two delivery paths:

- a **cold-start pull** so the frontend can seed the last native inset before React paints;
- a **live push** for rotation, folding/unfolding, DeX/external displays, system-bar changes, and IME/keyboard changes.

The frontend merges native values with CSS safe-area values into platform-neutral variables:

```css
--safe-top
--safe-right
--safe-bottom
--safe-left
--safe-height
--app-height
```

Product components consume those variables and never need to know which platform supplied them. The Android overlay also adds the R8 keep rule required for `@JavascriptInterface` methods in release builds.

### A resilient full-screen shell

The baseline CSS deliberately avoids common webview layout traps:

- no document-level minimum width;
- `min-width: 0` / `min-height: 0` at shrinkable grid and flex boundaries;
- visible viewport tracking via `window.innerHeight` / `visualViewport` with `dvh` fallback;
- explicit scroll ownership inside a fixed application shell;
- safe-area edge ownership so nested surfaces do not double-pad;
- touch target enlargement under `pointer: coarse` without penalizing mouse-first DeX layouts;
- 16px mobile inputs to avoid focus zoom behavior;
- reduced-motion and keyboard focus defaults.

`src/App.tsx` is a live diagnostics screen for these invariants. Keep an equivalent screen or route available while building the product; it is much faster than debugging geometry from screenshots after the fact.

### A safer Tauri boundary

The starter has a non-null CSP and separate desktop/mobile capability files. Add permissions only when a concrete feature needs them.

The sample Rust command demonstrates the rule for expensive native work: a Tauri command stays async while blocking work moves to `tauri::async_runtime::spawn_blocking`. Do not copy the traditional synchronous `greet()` example into filesystem, database, crypto, process, or blocking-network code.

## Android workflow

Initialized product repositories own both the generated native scaffold and the overlay used to keep it current.

```sh
npm run android:prepare
```

creates the Android project when missing and applies the repository-owned overlay. `npm run android:reset` deliberately recreates the scaffold from scratch before applying the same overlay; use that when testing a regeneration, not as normal product release behavior.

The overlay enforces:

- native system-bar + display-cutout + IME insets;
- cold-start JS bridge plus live inset listener;
- `androidx.core:core-ktx` as an explicit dependency;
- the R8/ProGuard JavaScript-interface keep rule;
- resizable activity behavior for foldables, DeX, and external displays;
- density/navigation/font-scale configuration-change handling;
- touchscreen marked optional so mouse/keyboard-only configurations remain valid.

Validate release invariants with:

```sh
npm run doctor:release
```

`doctor:release` requires both an initialized identity and an Android scaffold for normal product repositories. Plain `npm run doctor` can still validate a repository that intentionally used `--skip-android`. The template seed workflow supplies its explicit smoke-test override when running the release doctor. Do **not** use `tauri android init` as a repair step without rerunning `npm run android:prepare` afterward and reviewing the resulting native diff.

## Local device deploys

On macOS, with the Android SDK available if Android is wanted:

```sh
npm run deploy:devices
npm run deploy:devices:mac
npm run deploy:devices:android
```

The Android path creates a persistent local signing key under `~/.tauri-vibe/<bundle-identifier>` on first use. Back that key up: Android requires the same signing identity to update an installed app in place.

Set `INCLUDE_EMULATORS=1` to include emulators. Physical devices are deduplicated by hardware serial so the same phone connected over USB and Wi-Fi is not installed twice.

## Library integration

`.library.json` is present from day one with `provenance: "library-managed"` and a `managedSigning` declaration. The initializer updates its app name, APK asset pattern, and package name to match the new Tauri identifier.

A normal Tauri app therefore does **not** need a separate PR to Library just to enroll. When a successful default-branch workflow emits `library-unsigned-apk`, Library treats it as a signing candidate. The protected Library signer then reads `.library.json` from the exact commit that produced the artifact, validates the declared package against the APK, signs it, and creates the stable Android release.

Library still supports a central hard-pinned enrollment for apps that need a stronger separate authorization boundary; central enrollment takes precedence over repo-side metadata.

### Automatic release rule

`.github/workflows/library-unsigned-apk.yml` is the **only normal automatic workflow**. It runs on commits to `main`, but the first job is deliberately cheap:

1. require product repositories to have run template initialization (the seed repo is the sole explicit exception);
2. read the committed stable `X.Y.Z` version;
3. find the greatest stable `android-vX.Y.Z` GitHub release;
4. stop successfully if the committed version is not newer;
5. only then install Node/Java/Android/Rust tooling and build.

A version bump is therefore explicit Android release intent. Ordinary commits on `main` exercise only the gate.

For a real release candidate the workflow:

1. prepares and verifies the Android/native invariants;
2. requires a committed Android scaffold for every repository except the template seed itself;
3. builds an arm64 release APK;
4. verifies the APK package ID;
5. verifies that the APK is actually **unsigned**;
6. uploads exactly one artifact named `library-unsigned-apk`.

That artifact name is a protocol. **Do not use it from manual checks or ad-hoc workflows.** Library's webhook treats a successful owned default-branch run containing that artifact as a managed-signing candidate; the protected signer is what authoritatively accepts or rejects repo-side enrollment.

Library validates the APK again, signs it with the central distribution identity, and creates the stable `android-vX.Y.Z` release. The app repository never receives the Library signing key.

Do not hand-create Android release tags. Desktop releases may continue using `vX.Y.Z`; the separate `android-vX.Y.Z` namespace prevents collisions between desktop and Library distribution.

### Template smoke release

This repository tracks version `0.1.0` and `.library.json` self-enrolls `com.example.taurivibe`. Its inherited template config remains deliberately uninitialized, but the release workflow recognizes **only** the canonical `garfbargle/Tauri-vibe-template` repository as the seed smoke app. If no `android-v0.1.0` release exists, merging the release-convention change after Library's repo-side enrollment support is live should build `library-unsigned-apk`, have Library sign it, and publish `android-v0.1.0`. After that, ordinary commits at 0.1.0 stop at the cheap gate.

Repos created from this template do not inherit that exception: they must run `npm run init`, which marks their own `template.config.json` initialized and rewrites the Library package declaration before a release is eligible.

## Manual CI

`.github/workflows/ci.yml` is intentionally `workflow_dispatch` only. It accepts an optional branch, tag, or SHA so a human or coding agent can request remote/platform validation for the exact work being reviewed.

There is no automatic `push`, `pull_request`, or scheduled routine CI. Local checks remain the default feedback loop; GitHub runners are used when they add value.

The normal local matrix is:

```sh
npm test
npm run build
npm run doctor
cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml --all-features
```

For initialized product repositories, manual Android CI should also verify that `npm run android:prepare` leaves the committed Android scaffold unchanged.

## Versioning

A release version exists in three places and must never drift:

- `package.json`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`

Use:

```sh
npm run version:sync -- v1.2.3
```

`npm run doctor` checks the invariant.

## Desktop releases

**Release desktop** remains a manual workflow with a single version input. It builds:

- a universal Apple Silicon + Intel macOS app/DMG;
- Windows NSIS + MSI installers;
- Linux AppImage + Debian package.

All platform jobs must finish before one publisher job creates/updates the GitHub release, avoiding release-creation races.

macOS downloadable releases are deliberately blocked unless Developer ID signing/notarization secrets are configured. Add these repository secrets before publishing macOS artifacts:

```text
APPLE_CERTIFICATE
APPLE_CERTIFICATE_PASSWORD
APPLE_SIGNING_IDENTITY
APPLE_TEAM_ID
APPLE_ID
APPLE_PASSWORD
```

Local macOS builds do not require those distribution credentials.

Windows signing is optional but wired into the same workflow. If `WINDOWS_CERTIFICATE` is present, the workflow imports the PFX, injects a temporary Tauri signing config, and verifies the resulting installer signatures. Configure:

```text
WINDOWS_CERTIFICATE
WINDOWS_CERTIFICATE_PASSWORD
WINDOWS_CERTIFICATE_THUMBPRINT
WINDOWS_TIMESTAMP_URL
```

Unsigned Windows builds remain possible when these are absent, but browser downloads may show SmartScreen trust warnings until the app has an appropriate signing identity/reputation.

## Agent guidance and PR release notes

`AGENTS.md` is part of the template contract. It records the platform invariants above, the CI/release rules, repo-side Library enrollment, and the PR release-note format inherited from Orbit.

Every PR should classify its user-facing impact as exactly one of `feature`, `improvement`, `fix`, or `skip`. CI, documentation, refactors, dependency work, and release plumbing normally use `skip`. Version-bump-only PRs normally use `skip`; the bump is release intent, not itself a user-facing change.

## Project map

```text
assets/app-icon.svg                    starter source icon
src/lib/platformGeometry.ts           web/native geometry contract
src/App.tsx                            platform diagnostics/conformance UI
src/styles.css                         safe full-screen shell primitives
src-tauri/src/lib.rs                   minimal Rust/Tauri boundary
src-tauri/capabilities/                least-privilege platform capabilities
scripts/init-template.mjs              one-command identity + Library enrollment setup
scripts/prepare-android.mjs            reproducible Android native overlay
scripts/template-doctor.mjs            invariant checker
scripts/sync-version-from-tag.mjs      three-file version synchronization
scripts/deploy-local.sh                macOS + Android local sideloading
.github/workflows/ci.yml               manual frontend/Rust/platform checks
.github/workflows/library-unsigned-apk.yml
.github/workflows/release-desktop.yml
.library.json                          Library storefront + managed-signing contract
AGENTS.md                              rules for humans and coding agents
```

## When replacing the starter UI

Delete the diagnostics presentation, not the platform contract. Keep `installPlatformGeometry()` before the first React render, preserve the safe-area CSS variables, and carry the layout rules into the product shell.

Before declaring a new shell finished, test a narrow touch viewport with the keyboard open, a corner menu/overlay, larger system font size, and—when hardware is available—rotation, folding/unfolding, and DeX/external-display transitions.
