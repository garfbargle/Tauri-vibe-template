import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
process.chdir(root);
const requireInitialized = process.argv.includes("--require-initialized");
let failures = 0;
let warnings = 0;

const ok = (message) => console.log(`✓ ${message}`);
const fail = (message) => { failures += 1; console.error(`✗ ${message}`); };
const warn = (message) => { warnings += 1; console.warn(`! ${message}`); };
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

const pkg = readJson("package.json");
const tauri = readJson("src-tauri/tauri.conf.json");
const library = readJson(".library.json");
const template = readJson("template.config.json");
const cargo = fs.readFileSync("src-tauri/Cargo.toml", "utf8");
const html = fs.readFileSync("index.html", "utf8");
const css = fs.readFileSync("src/styles.css", "utf8");
const geometry = fs.readFileSync("src/lib/platformGeometry.ts", "utf8");

if (requireInitialized && !template.initialized) fail("template has not been initialized");
else if (!template.initialized) warn("template is intentionally still using starter identity");
else ok("template identity initialized");

const cargoVersion = cargo.match(/^version = "([^"]+)"/m)?.[1];
if (pkg.version === tauri.version && pkg.version === cargoVersion) ok(`version synchronized at ${pkg.version}`);
else fail(`version drift: package=${pkg.version}, tauri=${tauri.version}, cargo=${cargoVersion}`);

if (tauri.app?.security?.csp) ok("production CSP is enabled"); else fail("production CSP must not be null/empty");
if (tauri.app?.security?.devCsp?.includes("ws:")) ok("development CSP explicitly permits Vite HMR WebSockets");
else fail("development CSP must permit the Vite HMR WebSocket");
if (html.includes("viewport-fit=cover")) ok("viewport-fit=cover is present"); else fail("viewport-fit=cover is missing");
if (
  css.includes("--safe-top") &&
  css.includes("--safe-right") &&
  css.includes("--safe-bottom") &&
  css.includes("--safe-left") &&
  css.includes("--app-height") &&
  geometry.includes("__TAURI_VIBE_INSETS__") &&
  geometry.includes("window.visualViewport")
) ok("platform-neutral safe-area and visible-viewport plumbing is present");
else fail("safe-area/viewport plumbing is incomplete");

if (/body\s*\{[^}]*min-width\s*:\s*[1-9]/s.test(css)) fail("body must not impose a positive min-width");
else ok("document has no desktop-only minimum width");
if (library.provenance === "library-managed") ok("Library provenance is library-managed"); else fail("Library provenance must be library-managed");
if (library.assetPattern?.startsWith(`^${pkg.name}-`)) ok("Library asset pattern matches package slug"); else fail("Library asset pattern does not match package slug");

const androidDir = path.join("src-tauri", "gen", "android");
if (fs.existsSync(androidDir)) {
  const javaPath = path.join(androidDir, "app", "src", "main", "java", ...tauri.identifier.split("."), "MainActivity.kt");
  const gradlePath = path.join(androidDir, "app", "build.gradle.kts");
  const proguardPath = path.join(androidDir, "app", "proguard-rules.pro");
  if (fs.existsSync(javaPath)) {
    const activity = fs.readFileSync(javaPath, "utf8");
    if (
      activity.includes("WindowInsetsCompat.Type.ime()") &&
      activity.includes("WindowInsetsCompat.Type.systemBars()") &&
      activity.includes("WindowInsetsCompat.Type.displayCutout()") &&
      activity.includes("webView.addJavascriptInterface") &&
      activity.includes("fun insets(): String") &&
      activity.includes("setOnApplyWindowInsetsListener")
    ) ok("Android pull+push system-bar/cutout/IME bridge is installed");
    else fail("Android MainActivity inset bridge is incomplete");
  } else fail("Android MainActivity inset bridge is missing");
  if (fs.existsSync(gradlePath) && fs.readFileSync(gradlePath, "utf8").includes("androidx.core:core-ktx")) ok("Android core-ktx dependency is explicit");
  else fail("Android core-ktx dependency is missing");
  if (fs.existsSync(proguardPath) && fs.readFileSync(proguardPath, "utf8").includes("@android.webkit.JavascriptInterface")) ok("R8 keeps JavaScript bridge methods");
  else fail("R8 JavaScript-interface keep rule is missing");

  const manifestPath = path.join(androidDir, "app", "src", "main", "AndroidManifest.xml");
  if (fs.existsSync(manifestPath)) {
    const manifest = fs.readFileSync(manifestPath, "utf8");
    if (
      manifest.includes('android.hardware.touchscreen') &&
      manifest.includes('android:required="false"') &&
      manifest.includes('android:resizeableActivity="true"') &&
      manifest.includes("density") &&
      manifest.includes("navigation") &&
      manifest.includes("fontScale")
    ) ok("Android fold/DeX/external-display manifest invariants are present");
    else fail("Android manifest is missing fold/DeX/external-display invariants");
  } else fail("Android manifest is missing");
} else if (requireInitialized) {
  fail("Android project is required for release; run npm run android:prepare and commit src-tauri/gen/android");
} else {
  warn("Android project not generated yet; run npm run android:prepare when the SDK is available");
}

if (failures) {
  console.error(`\nDoctor found ${failures} failure(s) and ${warnings} warning(s).`);
  process.exit(1);
}
console.log(`\nDoctor passed${warnings ? ` with ${warnings} warning(s)` : ""}.`);
