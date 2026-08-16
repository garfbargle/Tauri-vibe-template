# Engineering invariants

This repository is a Tauri 2 + React starter whose value is the platform behavior already encoded in it. Product code may change freely; the invariants below should only change deliberately and with device/release verification.

## Platform geometry

- Keep `<meta name="viewport" ... viewport-fit=cover>` in `index.html`.
- Application code consumes `--safe-top`, `--safe-right`, `--safe-bottom`, `--safe-left`, `--safe-height`, and `--app-height`. Do not make product components depend on Android-specific variables.
- Do not replace the Android bridge with CSS `env(safe-area-inset-*)` alone. Android system bars and the IME are read natively by `MainActivity.kt`.
- Android inset delivery is intentionally pull + push. The pull seeds cold start before React mounts; the listener handles rotation, folding, DeX, cutouts, system bars, and keyboard changes.
- Preserve the R8/ProGuard keep rule for `@JavascriptInterface` methods.
- Treat safe-area padding as edge ownership: the surface touching an edge pays that inset once. Avoid applying the same inset to nested shells.
- Do not add document-level `min-width` constraints. Grid/flex children that may shrink need `min-width: 0`; scrolling regions inside fixed-height layouts need `min-height: 0`.
- Full-screen application shells use `--app-height`/`dvh`, not bare `100vh` as the only sizing mechanism.
- Menus, dialogs, and overlays must remain inside the usable viewport and safe area. Touch-only access cannot depend on hover or right-click.

## Android native project

- `scripts/prepare-android.mjs` is the source of truth for the native overlay. It generates the current Tauri Android scaffold when missing and patches the inset bridge, explicit core-ktx dependency, R8 rule, resizable activity, and configuration-change behavior.
- After running Android initialization in a real product repository, commit `src-tauri/gen/android` so native changes are reviewable and a fresh checkout builds identically.
- Never run `tauri android init` as a recovery step without immediately running `npm run android:prepare` and `npm run doctor:release` afterward.
- Keep Android application/package identity synchronized with `src-tauri/tauri.conf.json`.

## Tauri/Rust boundary

- Keep capabilities least-privilege and split platform-specific permissions when possible.
- Never set Tauri CSP to `null` as a shortcut. Expand it only for concrete application needs.
- Tauri commands that perform blocking filesystem, process, crypto, database, or network work should be async and move blocking work to `tauri::async_runtime::spawn_blocking` (or use a genuinely async implementation).
- Treat Rust/TypeScript IPC payloads as a versioned contract. Prefer camelCase serialization for Rust structs mirrored in TypeScript.

## Releases and Library

- `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json` versions must agree. Use `npm run version:sync -- vX.Y.Z`.
- Library owns Android distribution signing. `.github/workflows/library-unsigned-apk.yml` intentionally emits an unsigned APK and verifies that it is unsigned before upload.
- `.library.json` has `provenance: "library-managed"`; its `assetPattern` must continue matching the generated artifact name.
- Desktop distribution is manual and version-driven. macOS release publishing must be Developer-ID signed and notarized; do not publish a downloadable DMG as a normal release when signing is absent.
- Local Android sideloads use a persistent developer key under `~/.tauri-vibe/<identifier>` so upgrades do not unexpectedly change signatures.

## Before merging

Run as much of this matrix as the host supports:

```sh
npm test
npm run build
npm run doctor
cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml --all-features
```

When touching platform geometry, also verify the diagnostics screen on at least one narrow touch device with the keyboard open and, when available, rotation/fold/DeX transitions.
