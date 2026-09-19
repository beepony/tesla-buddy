#!/usr/bin/env node
/**
 * 按 CHANGELOG.md 的版本条目创建版本标签和 GitHub Release。
 *
 * 用法：
 *   npm run release                                # 发布 apps/ios/project.yml 中的当前版本
 *   npm run release -- 1.2.0                       # 补发历史版本
 *   npm run release -- 1.2.0 --target b0528e9      # 指定标签指向的提交
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function run(command, args) {
  return execFileSync(command, args, {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "inherit"]
  })
    .toString()
    .trim();
}

function probe(command, args) {
  try {
    return execFileSync(command, args, {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "ignore"]
    })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

function projectVersion() {
  const project = readFileSync(join(repoRoot, "apps/ios/project.yml"), "utf8");
  const version = project.match(/^\s*MARKETING_VERSION:\s*(\S+)/m)?.[1];
  const build = project.match(/^\s*CURRENT_PROJECT_VERSION:\s*(\S+)/m)?.[1];
  if (!version || !build) throw new Error("无法从 apps/ios/project.yml 读取版本号和构建号。");
  return { version, build };
}

function changelogEntry(version) {
  const lines = readFileSync(join(repoRoot, "CHANGELOG.md"), "utf8").split("\n");
  const escaped = version.replace(/\./g, "\\.");
  const heading = new RegExp(`^##\\s+${escaped}\\s+\\((\\d+)\\)`);
  const start = lines.findIndex((line) => heading.test(line));
  if (start === -1) throw new Error(`CHANGELOG.md 中没有 ${version} 的发布条目。`);

  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^##\s/.test(line));
  const notes = (end === -1 ? rest : rest.slice(0, end)).join("\n").trim();
  return { build: lines[start].match(heading)[1], notes };
}

const args = process.argv.slice(2);
const positional = [];
let target = null;
for (let index = 0; index < args.length; index += 1) {
  if (args[index] === "--target") {
    target = args[index + 1] ?? null;
    index += 1;
  } else if (!args[index].startsWith("--")) {
    positional.push(args[index]);
  }
}

const version = positional[0] ?? projectVersion().version;
const { build, notes } = changelogEntry(version);
const tag = `v${version}`;
const title = `${version} (${build})`;

if (!target && probe("git", ["status", "--porcelain", "--untracked-files=no"])) {
  console.warn("提示：工作区存在未提交的已跟踪改动，标签会指向当前提交，请先确认这些改动属于本版本。");
}

if (probe("git", ["rev-parse", "-q", "--verify", `refs/tags/${tag}`])) {
  console.log(`标签 ${tag} 已存在，跳过创建。`);
} else {
  run("git", target ? ["tag", "-a", tag, "-m", title, target] : ["tag", "-a", tag, "-m", title]);
  run("git", ["push", "origin", tag]);
  console.log(`已创建并推送标签 ${tag}${target ? `（指向 ${target}）` : ""}。`);
}

const tempDir = mkdtempSync(join(tmpdir(), "tesla-buddy-release-"));
const notesPath = join(tempDir, "notes.md");
writeFileSync(notesPath, `${notes}\n`);

try {
  const existing = probe("gh", ["release", "view", tag, "--json", "url"]);
  if (existing) {
    run("gh", ["release", "edit", tag, "--title", title, "--notes-file", notesPath]);
    console.log(`已更新 Release：${JSON.parse(existing).url}`);
  } else {
    const url = run("gh", ["release", "create", tag, "--verify-tag", "--title", title, "--notes-file", notesPath]);
    console.log(`已创建 Release：${url}`);
  }
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
