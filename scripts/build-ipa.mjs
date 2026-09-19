#!/usr/bin/env node
/**
 * 归档 Release 版本并导出可分发的 .ipa。
 *
 * 用法：
 *   npm run ipa                        # 优先 Ad Hoc，账号无 Ad Hoc 权限时回退开发签名
 *   npm run ipa -- --method ad-hoc     # 只导出 Ad Hoc
 *   npm run ipa -- --method development
 *
 * 产物写入 build/ipa/TeslaBuddy-<版本>-<构建号>-<方式>.ipa。
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const projectPath = "apps/ios/TeslaCompanion.xcodeproj";
const scheme = "TeslaCompanion";
const buildDir = join(repoRoot, "build");
const archivePath = join(buildDir, "TeslaBuddy.xcarchive");
const ipaDir = join(buildDir, "ipa");

const exportOptions = {
  "ad-hoc": "apps/ios/ExportOptions-adhoc.plist",
  development: "apps/ios/ExportOptions-development.plist"
};

function fail(message) {
  console.error(message);
  process.exit(1);
}

function projectVersion() {
  const project = readFileSync(join(repoRoot, "apps/ios/project.yml"), "utf8");
  const version = project.match(/^\s*MARKETING_VERSION:\s*(\S+)/m)?.[1];
  const build = project.match(/^\s*CURRENT_PROJECT_VERSION:\s*(\S+)/m)?.[1];
  if (!version || !build) fail("无法从 apps/ios/project.yml 读取版本号和构建号。");
  return { version, build };
}

function runLive(command, args) {
  execFileSync(command, args, { cwd: repoRoot, stdio: ["ignore", "inherit", "inherit"] });
}

function runCaptured(command, args) {
  try {
    const output = execFileSync(command, args, { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] });
    return { ok: true, output: output.toString() };
  } catch (error) {
    return { ok: false, output: `${error.stdout ?? ""}${error.stderr ?? ""}` };
  }
}

function archive() {
  console.log("正在归档 Release 版本…");
  rmSync(archivePath, { recursive: true, force: true });
  runLive("xcodebuild", [
    "-project", projectPath,
    "-scheme", scheme,
    "-configuration", "Release",
    "-destination", "generic/platform=iOS",
    "-archivePath", archivePath,
    "-allowProvisioningUpdates",
    "clean", "archive"
  ]);
}

function exportIpa(method) {
  const exportPath = join(buildDir, `ipa-export-${method}`);
  rmSync(exportPath, { recursive: true, force: true });
  return runCaptured("xcodebuild", [
    "-exportArchive",
    "-archivePath", archivePath,
    "-exportOptionsPlist", exportOptions[method],
    "-exportPath", exportPath,
    "-allowProvisioningUpdates"
  ]);
}

function moveIpa(method, version, build) {
  const exportPath = join(buildDir, `ipa-export-${method}`);
  const produced = readdirSync(exportPath).find((name) => name.endsWith(".ipa"));
  if (!produced) return null;
  mkdirSync(ipaDir, { recursive: true });
  const target = join(ipaDir, `TeslaBuddy-${version}-${build}-${method}.ipa`);
  renameSync(join(exportPath, produced), target);
  rmSync(exportPath, { recursive: true, force: true });
  return target;
}

const args = process.argv.slice(2);
let method = "ad-hoc";
let methodWasSet = false;
for (let index = 0; index < args.length; index += 1) {
  if (args[index] === "--method") {
    method = args[index + 1] ?? "";
    methodWasSet = true;
    index += 1;
  }
}
if (!exportOptions[method]) fail(`不支持的导出方式 “${method}”，可选：ad-hoc、development。`);

const { version, build } = projectVersion();

archive();

let usedMethod = method;
let result = exportIpa(method);
if (!result.ok && method === "ad-hoc" && !methodWasSet) {
  console.warn("Ad Hoc 导出失败，可能是 Apple Developer Program 会员权限不足，改用开发签名重试。");
  usedMethod = "development";
  result = exportIpa(usedMethod);
}
if (!result.ok) {
  console.error(result.output.trim());
  fail(`${usedMethod} 导出失败。`);
}

const ipaPath = moveIpa(usedMethod, version, build);
if (!ipaPath) fail("导出成功但没有找到 .ipa 文件。");

console.log(`\n已生成 ${ipaPath}`);
console.log(`安装到已注册设备：xcrun devicectl device install app --device <UDID> "${ipaPath}"`);
if (usedMethod === "development") {
  console.log("当前为开发签名，只能安装到开发者账号中已注册 UDID 的设备；首次运行需在“设置 > 通用 > VPN与设备管理”中信任证书。");
}
if (existsSync(archivePath)) console.log(`归档保留在 ${archivePath}。`);
