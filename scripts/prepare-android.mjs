import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
process.chdir(root);

const fresh = process.argv.includes("--fresh");
const androidDir = path.join(root, "src-tauri", "gen", "android");
const tauriConfig = JSON.parse(fs.readFileSync("src-tauri/tauri.conf.json", "utf8"));
const identifier = tauriConfig.identifier;
const packagePath = identifier.split(".").join(path.sep);

function run(command, args, env = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", env: { ...process.env, ...env } });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (fresh && fs.existsSync(androidDir)) fs.rmSync(androidDir, { recursive: true, force: true });

if (!fs.existsSync(androidDir)) {
  console.log("Generating Android project from the installed Tauri CLI…");
  run(process.platform === "win32" ? "npx.cmd" : "npx", ["tauri", "android", "init", "--ci"], { CI: "true" });
}

const mainActivityPath = path.join(androidDir, "app", "src", "main", "java", packagePath, "MainActivity.kt");
fs.mkdirSync(path.dirname(mainActivityPath), { recursive: true });

const bridgeName = "__TAURI_VIBE_INSETS__";
const mainActivity = `package ${identifier}

import android.annotation.SuppressLint
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

/**
 * Edge-to-edge is mandatory on modern Android, but Android WebView does not
 * reliably expose system bars through CSS env(safe-area-inset-*). Read the real
 * WindowInsets here and publish CSS-pixel values to the frontend.
 *
 * Delivery deliberately has two paths:
 *  - pull: JavaScript asks for the last value during cold start, because wry can
 *    receive the first inset pass while the WebView is still on about:blank;
 *  - push: the listener updates folding, rotation, DeX and keyboard changes.
 */
class MainActivity : TauriActivity() {
  @Volatile
  private var insetsJson: String = "{\\\"top\\\":0,\\\"right\\\":0,\\\"bottom\\\":0,\\\"left\\\":0}"

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
  }

  @SuppressLint("JavascriptInterface")
  override fun onWebViewCreate(webView: WebView) {
    webView.addJavascriptInterface(InsetBridge(), BRIDGE_NAME)

    ViewCompat.setOnApplyWindowInsetsListener(webView) { _, windowInsets ->
      val bars = windowInsets.getInsets(
        WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout(),
      )
      val ime = windowInsets.getInsets(WindowInsetsCompat.Type.ime())
      val density = webView.resources.displayMetrics.density.takeIf { it > 0f } ?: 1f

      val top = bars.top / density
      val right = bars.right / density
      val bottom = maxOf(bars.bottom, ime.bottom) / density
      val left = bars.left / density

      insetsJson = "{\\\"top\\\":$top,\\\"right\\\":$right,\\\"bottom\\\":$bottom,\\\"left\\\":$left}"
      webView.evaluateJavascript(applyScript(top, right, bottom, left), null)
      windowInsets
    }
    ViewCompat.requestApplyInsets(webView)
  }

  private inner class InsetBridge {
    @JavascriptInterface
    fun insets(): String = insetsJson
  }

  private companion object {
    const val BRIDGE_NAME = "${bridgeName}"

    fun applyScript(top: Float, right: Float, bottom: Float, left: Float): String =
      """
      (function () {
        var root = document.documentElement;
        if (!root) return;
        root.style.setProperty('--native-inset-top', '\${top}px');
        root.style.setProperty('--native-inset-right', '\${right}px');
        root.style.setProperty('--native-inset-bottom', '\${bottom}px');
        root.style.setProperty('--native-inset-left', '\${left}px');
        window.dispatchEvent(new Event('native-insets-changed'));
      })();
      """.trimIndent()
  }
}
`;
fs.writeFileSync(mainActivityPath, mainActivity);

const gradlePath = path.join(androidDir, "app", "build.gradle.kts");
let gradle = fs.readFileSync(gradlePath, "utf8");
if (!gradle.includes("androidx.core:core-ktx")) {
  gradle = gradle.replace(/dependencies\s*\{/, 'dependencies {\n    implementation("androidx.core:core-ktx:1.17.0")');
  fs.writeFileSync(gradlePath, gradle);
}

const proguardPath = path.join(androidDir, "app", "proguard-rules.pro");
let proguard = fs.existsSync(proguardPath) ? fs.readFileSync(proguardPath, "utf8") : "";
if (!proguard.includes("@android.webkit.JavascriptInterface")) {
  proguard += `\n# Preserve the narrow bridge surface called only from JavaScript in release/R8 builds.\n-keepclassmembers class ${identifier}.MainActivity$InsetBridge {\n    @android.webkit.JavascriptInterface <methods>;\n}\n`;
  fs.writeFileSync(proguardPath, proguard);
}

const manifestPath = path.join(androidDir, "app", "src", "main", "AndroidManifest.xml");
let manifest = fs.readFileSync(manifestPath, "utf8");
if (!manifest.includes('android.hardware.touchscreen')) {
  manifest = manifest.replace(
    /<application/,
    '    <!-- Keep mouse/keyboard-only DeX and external-display configurations eligible. -->\n    <uses-feature android:name="android.hardware.touchscreen" android:required="false" />\n\n    <application',
  );
}
if (!manifest.includes('android:resizeableActivity="true"')) {
  manifest = manifest.replace(/<application\s+/, '<application\n        android:resizeableActivity="true"\n        ');
}
manifest = manifest.replace(/android:configChanges="([^"]*)"/, (_match, value) => {
  const parts = new Set(value.split("|").filter(Boolean));
  for (const item of ["density", "navigation", "fontScale"]) parts.add(item);
  return `android:configChanges="${[...parts].join("|")}"`;
});
fs.writeFileSync(manifestPath, manifest);

console.log(`Android native glue prepared for ${identifier}.`);
console.log("Commit src-tauri/gen/android after initialization so native changes are reviewable.");
