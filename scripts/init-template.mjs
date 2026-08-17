import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
process.chdir(root);

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const name = arg("name");
const identifier = arg("identifier");
const slug = arg("slug") ?? name?.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const forceAndroid = process.argv.includes("--android");
const skipAndroid = process.argv.includes("--skip-android");

if (!name || !identifier || !slug) {
  console.error('Usage: npm run init -- --name "My App" --identifier com.example.myapp [--slug my-app] [--android|--skip-android]');
  process.exit(1);
}
if (!/^[a-z0-9][a-z0-9._-]*$/.test(slug)) {
  console.error(`Invalid slug: ${slug}`);
  process.exit(1);
}
if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(identifier)) {
  console.error("Identifier must be a lowercase reverse-DNS package such as com.example.myapp");
  process.exit(1);
}

const cargoLib = `${slug.replace(/-/g, "_")}_lib`;
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
packageJson.name = slug;
writeJson("package.json", packageJson);

const tauri = JSON.parse(fs.readFileSync("src-tauri/tauri.conf.json", "utf8"));
tauri.productName = name;
tauri.identifier = identifier;
tauri.app.windows[0].title = name;
writeJson("src-tauri/tauri.conf.json", tauri);

let cargo = fs.readFileSync("src-tauri/Cargo.toml", "utf8");
cargo = cargo.replace(/^name = ".*"/m, `name = "${slug}"`);
cargo = cargo.replace(/^name = ".*_lib"/m, `name = "${cargoLib}"`);
fs.writeFileSync("src-tauri/Cargo.toml", cargo);

let mainRs = fs.readFileSync("src-tauri/src/main.rs", "utf8");
mainRs = mainRs.replace(/\btauri_vibe_app_lib::run\(\)/, `${cargoLib}::run()`);
fs.writeFileSync("src-tauri/src/main.rs", mainRs);

const library = JSON.parse(fs.readFileSync(".library.json", "utf8"));
library.name = name;
library.assetPattern = `^${slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-.*\\.apk$`;
writeJson(".library.json", library);

writeJson("template.config.json", { initialized: true, name, slug, identifier });

let html = fs.readFileSync("index.html", "utf8");
html = html.replace(/<title>.*<\/title>/, `<title>${name.replace(/[<&]/g, "")}</title>`);
fs.writeFileSync("index.html", html);

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(process.platform === "win32" ? "npx.cmd" : "npx", ["tauri", "icon", "assets/app-icon.svg"]);

const hasAndroidEnv = Boolean(process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT);
if (!skipAndroid && (forceAndroid || hasAndroidEnv)) {
  run(process.execPath, ["scripts/prepare-android.mjs", "--fresh"]);
} else if (!skipAndroid) {
  console.log("Android SDK not detected; skipping local Android generation.");
  console.log("Before the first Library release, run `npm run android:prepare`, review the generated native project, and commit `src-tauri/gen/android`.");
}

run(process.execPath, ["scripts/template-doctor.mjs", "--require-initialized"]);
console.log(`\nInitialized ${name} (${identifier}).`);
