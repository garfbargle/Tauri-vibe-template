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
- The `garfbargle/Tauri-vibe-template` seed repository is the one deliberate exception: its own Library smoke release may bootstrap-generate Android in CI so the template itself remains a usable source template. Repositories created from it must commit their generated Android scaffold before Library release.
- Never run `tauri android init` as a recovery step without immediately running `npm run android:prepare` and `npm run doctor:release` afterward.
- Keep Android application/package identity synchronized with `src-tauri/tauri.conf.json`.

## Tauri/Rust boundary

- Keep capabilities least-privilege and split platform-specific permissions when possible.
- Never set Tauri CSP to `null` as a shortcut. Expand it only for concrete application needs.
- Tauri commands that perform blocking filesystem, process, crypto, database, or network work should be async and move blocking work to `tauri::async_runtime::spawn_blocking` (or use a genuinely async implementation).
- Treat Rust/TypeScript IPC payloads as a versioned contract. Prefer camelCase serialization for Rust structs mirrored in TypeScript.

## CI and releases

- Routine CI is manual. Agents may run `.github/workflows/ci.yml` with `workflow_dispatch`, optionally supplying a branch, tag, or SHA. Do not add automatic `push`, `pull_request`, or scheduled CI for normal checks.
- The only normal automatic Actions trigger is the Library Android release workflow on commits to `main`.
- A version bump is explicit release intent. `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json` versions must agree. Use `npm run version:sync -- vX.Y.Z`.
- Library Android releases use stable tags of the form `android-vX.Y.Z`. The release workflow must compare the tracked stable version with the newest stable `android-v*` GitHub release before installing SDKs or building.
- If the tracked version is not newer, the automatic release workflow exits successfully without doing expensive work.
- Only the genuine release path may upload an artifact named `library-unsigned-apk`. Manual checks must never use that artifact name because Library treats it as a managed-signing candidate.
- Repo-side Library enrollment lives in `.library.json`: keep `provenance: "library-managed"` and `managedSigning.packageName` synchronized with the Tauri identifier. New apps should not need a separate Library PR just to enroll.
- The protected Library signer resolves `.library.json` from the exact commit that produced the artifact and verifies that the declared package matches the APK before signing.
- Library owns Android distribution signing. App repositories build and validate an unsigned APK; they do not receive Library's signing key.
- Do not hand-create Android release tags. Library creates the stable `android-vX.Y.Z` release after validating and signing the APK.
- Preserve app-specific release validation when adopting this template. Product-specific native assets or runtime requirements belong in the release workflow before the Library artifact is uploaded.
- Desktop distribution remains manual and version-driven unless the product explicitly adopts another policy. macOS release publishing must be Developer-ID signed and notarized; do not publish a downloadable DMG as a normal release when signing is absent.
- Local Android sideloads use a persistent developer key under `~/.tauri-vibe/<identifier>` so upgrades do not unexpectedly change signatures.

## Pull requests and release notes

Every pull request must include a release-note section in its description:

```markdown
## Release note
Release type: feature | improvement | fix | skip

<one short user-facing sentence, or `None` when the release type is `skip`>
```

Rules:

- Choose exactly one release type.
- Write the release note for an app user, not for a maintainer. Describe the visible outcome, not implementation details.
- Use `feature` for new user-facing capabilities.
- Use `improvement` for meaningful UX, performance, reliability, or behavior improvements.
- Use `fix` for user-visible bug fixes.
- Use `skip` for CI, refactors, tests, documentation, dependency maintenance, release plumbing, and other changes that should not appear in user-facing release notes.
- Keep the release note to one concise sentence whenever possible.
- Do not use commit messages or PR titles as substitutes for the release note.
- Version-bump-only PRs should normally use `skip`; release tooling can compile user-facing notes from merged PRs since the previous release.

When creating or updating a PR, ensure this section is present and accurate before considering the PR complete.

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

For remote/platform checks, dispatch the manual CI workflow against the branch or commit being validated.

When touching platform geometry, also verify the diagnostics screen on at least one narrow touch device with the keyboard open and, when available, rotation/fold/DeX transitions.
