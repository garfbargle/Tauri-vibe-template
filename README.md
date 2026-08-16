# Tauri Vibe Template

A Tauri 2 + React starter built around the cross-platform details that are easy to get wrong *after* the product already works: Android edge-to-edge insets, keyboard-safe layout, foldables/DeX, mobile viewport sizing, least-privilege capabilities, repeatable release versioning, desktop distribution, and Library-managed Android artifacts.

The starter screen is intentionally a **platform conformance harness**, not a sample product. It places interactive UI at every edge, includes a scroll region, opens a corner menu, and exposes live geometry diagnostics so a new app can prove its shell is correct before product UI replaces it.

## Start a new app

Use this repository as a GitHub template, clone the new repo, then run:

```sh
npm install
npm run init -- --name "My App" --identifier com.example.myapp
npm run tauri dev
```

`npm run init` updates the display name, npm/Rust identifiers, bundle identifier, Library metadata, HTML title, and icon set. If an Android SDK is configured it also generates the current Tauri Android scaffold and applies the native platform overlay. To explicitly control that step:

```sh
npm run init -- --name "My App" --identifier com.example.myapp --android
npm run init -- --name "My App" --identifier com.example.myapp --skip-android
```

A custom slug can be supplied with `--slug my-app`.

After initialization, replace `assets/app-icon.svg` with the real square app mark and run `npm run icons` again. Commit the generated `src-tauri/icons` directory. Once Android has been initialized on a development machine, also commit `src-tauri/gen/android`; the generated project contains native behavior that should be code-reviewed, not silently recreated at release time.

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

The baseline CSS deliberately avoids the common webview layout traps:

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

The sample Rust command also demonstrates the rule for expensive native work: a Tauri command stays async while blocking work moves to `tauri::async_runtime::spawn_blocking`. Do not copy the traditional synchronous `greet()` example into filesystem, database, crypto, process, or blocking-network code.

## Android workflow

The template does not freeze a full Gradle scaffold forever. Instead:

```sh
npm run android:prepare
```

creates the Android project from the installed Tauri CLI when needed, then applies the repository-owned native overlay. `npm run android:reset` recreates it from scratch before applying the same overlay.

The overlay enforces:

- native system-bar + display-cutout + IME insets;
- cold-start JS bridge plus live inset listener;
- `androidx.core:core-ktx` as an explicit dependency;
- the R8/ProGuard JavaScript-interface keep rule;
- resizable activity behavior for foldables, DeX, and external displays;
- density/navigation/font-scale configuration-change handling;
- touchscreen marked optional so mouse/keyboard-only configurations remain valid.

Validate it with:

```sh
npm run doctor:release
```

Do **not** use `tauri android init` as a repair step without rerunning `npm run android:prepare` afterward.

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

`.library.json` is present from day one with `provenance: "library-managed"`. The initializer updates its app name and APK asset pattern.

The **Library release APK** workflow is intentionally manual and version-driven. It:

1. synchronizes the requested version across npm, Cargo, and Tauri config;
2. generates icons and a fresh Android project;
3. reapplies and verifies the native overlay;
4. builds an arm64 release APK;
5. verifies the APK package ID;
6. verifies that the APK is actually **unsigned**;
7. uploads a predictably named `library-unsigned-apk` artifact.

The application repository builds the artifact; Library remains the signing/distribution boundary.

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

**Release desktop** is a manual workflow with a single version input. It builds:

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

## Checks

The normal local matrix is:

```sh
npm test
npm run build
npm run doctor
cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml --all-features
```

CI also smoke-builds the Tauri binary on Linux, macOS, and Windows. Dependency updates are enabled through Dependabot for npm, Cargo, and GitHub Actions.

## Project map

```text
assets/app-icon.svg                    starter source icon
src/lib/platformGeometry.ts           web/native geometry contract
src/App.tsx                            platform diagnostics/conformance UI
src/styles.css                         safe full-screen shell primitives
src-tauri/src/lib.rs                   minimal Rust/Tauri boundary
src-tauri/capabilities/                least-privilege platform capabilities
scripts/init-template.mjs              one-command identity setup
scripts/prepare-android.mjs            reproducible Android native overlay
scripts/template-doctor.mjs            invariant checker
scripts/sync-version-from-tag.mjs      three-file version synchronization
scripts/deploy-local.sh                macOS + Android local sideloading
.github/workflows/ci.yml               frontend/Rust/cross-platform smoke checks
.github/workflows/library-unsigned-apk.yml
.github/workflows/release-desktop.yml
.library.json                          Library storefront/build contract
AGENTS.md                              rules for humans and coding agents
```

## When replacing the starter UI

Delete the diagnostics presentation, not the platform contract. Keep `installPlatformGeometry()` before the first React render, preserve the safe-area CSS variables, and carry the layout rules into the product shell.

Before declaring a new shell finished, test a narrow touch viewport with the keyboard open, a corner menu/overlay, larger system font size, and—when hardware is available—rotation, folding/unfolding, and DeX/external-display transitions.
