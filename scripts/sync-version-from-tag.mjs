import fs from "node:fs";

const tag = process.argv[2];
if (!tag?.startsWith("v")) {
  console.error("Usage: node scripts/sync-version-from-tag.mjs v1.2.3");
  process.exit(1);
}
const version = tag.slice(1);
if (!/^\d+\.\d+\.\d+(?:-[\w.]+)?(?:\+[\w.]+)?$/.test(version)) {
  console.error(`Invalid semver tag: ${tag}`);
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
pkg.version = version;
fs.writeFileSync("package.json", `${JSON.stringify(pkg, null, 2)}\n`);

const tauri = JSON.parse(fs.readFileSync("src-tauri/tauri.conf.json", "utf8"));
tauri.version = version;
fs.writeFileSync("src-tauri/tauri.conf.json", `${JSON.stringify(tauri, null, 2)}\n`);

const cargo = fs.readFileSync("src-tauri/Cargo.toml", "utf8");
if (!/^version = "/m.test(cargo)) throw new Error("Cargo package version not found");
fs.writeFileSync("src-tauri/Cargo.toml", cargo.replace(/^version = ".*"/m, `version = "${version}"`));
console.log(`Synced app version to ${version}.`);
