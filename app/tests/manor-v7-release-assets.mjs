import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

// Use the YAML parser already installed with the project's tooling; no app imports.
const { parse: parseYaml } = createRequire(import.meta.url)("yaml");
const appRoot = realpathSync(fileURLToPath(new URL("..", import.meta.url)));
const repoRoot = realpathSync(path.dirname(appRoot));
const archiveRelative = "\u5f00\u53d1\u6750\u6599/\u53c2\u8003\u8d44\u4ea7\u9694\u79bb/qq-farm-sprites";
const sourceRelative = "app/public/art/qq-farm/sprites";
const expectedNames = [
  "activity-calendar.png", "activity-gift.png", "activity-message.png",
  "activity-rank.png", "brand-sprout.png", "mode-magic.png", "mode-memory.png",
  "mode-pasture.png", "mode-season.png", "warehouse-chest.png",
];
const textExtensions = new Set([
  ".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".css", ".scss", ".sass",
  ".less", ".json", ".map", ".html", ".htm", ".svg", ".xml", ".txt", ".md",
  ".mdx", ".yaml", ".yml", ".webmanifest", ".rsc",
]);
const sha256 = (data) => createHash("sha256").update(data).digest("hex").toUpperCase();
const posix = (value) => value.split(path.sep).join("/");
const report = { issue: "V7-15", checks: [], archivedFiles: 0, publicFiles: 0, sourceFiles: 0, dockerContexts: [] };

function parseReleaseOptions(args) {
  const { values, tokens } = parseArgs({
    args, strict: true, allowPositionals: false, tokens: true,
    options: { "release-root": { type: "string" }, "dist-dir": { type: "string" } },
  });
  const seen = new Set();
  for (const token of tokens) {
    assert(!seen.has(token.name), `Duplicate option: --${token.name}`);
    seen.add(token.name);
    assert(values[token.name].trim(), `Empty value for --${token.name}`);
  }
  return seen.size ? { releaseRoot: values["release-root"] ?? appRoot, distDir: values["dist-dir"] ?? ".next" } : null;
}

// Relative dist paths are relative to the release root, never the calling cwd.
const releaseOptions = parseReleaseOptions(process.argv.slice(2));

function within(root, target) {
  const relative = path.relative(root, target);
  return relative === "" || (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`));
}

function resolveBuildDirectory(releaseRoot, distDir) {
  const target = path.resolve(releaseRoot, distDir);
  assert(path.relative(releaseRoot, target) !== "" && within(releaseRoot, target), "Build directory must be inside the release root");
  let current = releaseRoot;
  for (const segment of path.relative(releaseRoot, target).split(path.sep)) {
    current = path.join(current, segment);
    assert(existsSync(current), `Build directory does not exist: ${current}`);
    const stat = lstatSync(current);
    assert(!stat.isSymbolicLink(), `Linked build directory is not allowed: ${current}`);
    assert(stat.isDirectory(), `Expected build directory: ${current}`);
    assert(within(releaseRoot, realpathSync(current)), `Build directory escapes release root: ${current}`);
  }
  return realpathSync(target);
}

function resolveRepositoryPath(relative) {
  assert.equal(typeof relative, "string");
  assert(!relative.includes("\\") && !relative.includes(":"), `Non-canonical path: ${relative}`);
  assert.equal(path.posix.normalize(relative), relative, `Non-canonical path: ${relative}`);
  const resolved = path.resolve(repoRoot, relative);
  assert(within(repoRoot, resolved), `Path escapes repository: ${relative}`);
  // Resolve every existing ancestor, including junctions, before trusting a path.
  let current = repoRoot;
  for (const segment of relative.split("/")) {
    current = path.join(current, segment);
    if (existsSync(current)) {
      assert(!lstatSync(current).isSymbolicLink(), `Linked path is not allowed: ${current}`);
      assert.equal(realpathSync(current), current, `Redirected path: ${current}`);
    }
  }
  return resolved;
}

function filesUnder(root) {
  assert(!lstatSync(root).isSymbolicLink(), `Linked release/source directory: ${root}`);
  assert(lstatSync(root).isDirectory(), `Expected directory: ${root}`);
  const result = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const target = path.join(root, entry.name);
    assert(!entry.isSymbolicLink(), `Linked release/source entry: ${target}`);
    if (entry.isDirectory()) result.push(...filesUnder(target));
    else {
      assert(entry.isFile(), `Non-file release/source entry: ${target}`);
      result.push(target);
    }
  }
  return result;
}

function check(name, run) {
  run();
  report.checks.push(name);
}

function normalizeReference(value) {
  return value
    .replace(/\\u([0-9a-f]{4})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\x([0-9a-f]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/%([0-9a-f]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\\//g, "/")
    .replace(/["'`]\s*\+\s*["'`]/g, "")
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .toLowerCase();
}

function referenceViolation(value) {
  const normalized = normalizeReference(value);
  return ["qq-farm/sprites", "qq-farm-sprites", ...expectedNames]
    .find((marker) => normalized.includes(marker));
}

const archiveRoot = resolveRepositoryPath(archiveRelative);
const manifest = JSON.parse(readFileSync(path.join(archiveRoot, "manifest.json"), "utf8"));
const registry = readFileSync(path.join(appRoot, "public/art/REGISTRY.md"), "utf8");
const hashSet = new Set();
const sizeSet = new Set();

check("manifest, original hashes, archived bytes and provenance", () => {
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.issue, "V7-15");
  assert.equal(manifest.operation, "byte-preserving-move");
  assert.equal(manifest.classification, "historical-research-only");
  assert.equal(manifest.hashAlgorithm, "SHA-256");
  assert.equal(manifest.sourceRoot, sourceRelative);
  assert.equal(manifest.archiveRoot, archiveRelative);
  assert.equal(manifest.deployment.publicServing, false);
  assert.equal(manifest.restore.from, "archivePath");
  assert.equal(manifest.restore.to, "sourcePath");
  assert.equal(manifest.restore.overwrite, false);
  assert.deepEqual(manifest.assets.map((asset) => asset.name).sort(), expectedNames);
  assert.deepEqual(readdirSync(archiveRoot).sort(), [...expectedNames, "manifest.json", "README.md"].sort());

  for (const asset of manifest.assets) {
    assert.equal(asset.sourcePath, `${sourceRelative}/${asset.name}`);
    assert.equal(asset.archivePath, `${archiveRelative}/${asset.name}`);
    assert.equal(asset.legacyUrl, `/art/qq-farm/sprites/${asset.name}`);
    assert.match(asset.sourceSha256, /^[0-9A-F]{64}$/);
    assert.equal(asset.sourceSha256, asset.targetSha256, `Source/target mismatch: ${asset.name}`);
    const archiveFile = resolveRepositoryPath(asset.archivePath);
    assert(lstatSync(archiveFile).isFile());
    const bytes = readFileSync(archiveFile);
    assert.equal(bytes.length, asset.bytes, `Archive size changed: ${asset.name}`);
    assert.equal(sha256(bytes), asset.targetSha256, `Archive hash changed: ${asset.name}`);
    const row = registry.split(/\r?\n/).find((line) => line.includes(`\`sprites/${asset.name}\``));
    assert(row?.includes(`\`${asset.extractedFrom}\``), `Missing extraction provenance: ${asset.name}`);
    assert(row?.includes(`\`${asset.sourceSha256}\``), `Provenance hash mismatch: ${asset.name}`);
    assert(!existsSync(resolveRepositoryPath(asset.sourcePath)), `Legacy public file remains: ${asset.sourcePath}`);
    hashSet.add(asset.targetSha256);
    sizeSet.add(asset.bytes);
    report.archivedFiles++;
  }
});

function inspectPayload(relative, bytes, provenance = false) {
  assert(!referenceViolation(relative), `Legacy/research release path: ${relative}`);
  if (bytes) {
    assert(!hashSet.has(sha256(bytes)), `Byte-identical legacy sprite in release: ${relative}`);
    if (!provenance && textExtensions.has(path.extname(relative).toLowerCase())) {
      const marker = referenceViolation(bytes.toString("utf8"));
      assert(!marker, `Legacy/research reference (${marker}) in ${relative}`);
    }
  }
}

function scanPublic(publicRoot) {
  const files = filesUnder(publicRoot);
  for (const file of files) {
    const relative = posix(path.relative(publicRoot, file));
    const needsBytes = sizeSet.has(lstatSync(file).size) || textExtensions.has(path.extname(file).toLowerCase());
    inspectPayload(relative, needsBytes ? readFileSync(file) : null, relative === "art/REGISTRY.md");
  }
  for (const asset of manifest.assets) {
    const staticTarget = path.join(publicRoot, asset.legacyUrl.slice(1));
    assert(!existsSync(staticTarget), `Old static URL still resolves to a file: ${asset.legacyUrl}`);
  }
  const oldDirectory = path.join(publicRoot, "art/qq-farm/sprites");
  if (existsSync(oldDirectory)) assert.equal(readdirSync(oldDirectory).length, 0, "Legacy public directory is not empty");
  return files.length;
}

check("public release input: no legacy names, hashes or URL targets", () => {
  report.publicFiles = scanPublic(path.join(appRoot, "public"));
});

check("production-reference scope excludes historical docs and tests", () => {
  const files = ["app", "components", "lib", "src", "pages", "styles"]
    .map((dir) => path.join(appRoot, dir))
    .filter(existsSync)
    .flatMap(filesUnder);
  for (const entry of readdirSync(appRoot, { withFileTypes: true })) {
    if (entry.isFile() && /\.(?:[cm]?js|jsx|tsx?|json)$/.test(entry.name)) files.push(path.join(appRoot, entry.name));
  }
  for (const file of files) {
    if (!textExtensions.has(path.extname(file).toLowerCase())) continue;
    const marker = referenceViolation(readFileSync(file, "utf8"));
    assert(!marker, `Parent must handle runtime reference (${marker}): ${posix(path.relative(appRoot, file))}`);
    report.sourceFiles++;
  }
});

check("archive is outside every configured Docker context", () => {
  const deployRoot = path.join(appRoot, "deploy");
  const profiles = readdirSync(deployRoot).filter((name) => /\.compose\.ya?ml$/.test(name));
  assert(profiles.includes("school.compose.yml") && profiles.includes("internet-single.compose.yml"));
  for (const profile of profiles) {
    const config = parseYaml(readFileSync(path.join(deployRoot, profile), "utf8"));
    let builds = 0;
    for (const [service, options] of Object.entries(config.services)) {
      if (!options.build) continue;
      const build = typeof options.build === "string" ? { context: options.build } : options.build;
      assert.equal(typeof build.context, "string", `Missing build context: ${profile}/${service}`);
      assert(!build.additional_contexts, `Review additional Docker contexts: ${profile}/${service}`);
      assert(!build.dockerfile_inline, `Review inline Dockerfile: ${profile}/${service}`);
      const context = realpathSync(path.resolve(deployRoot, build.context));
      assert.equal(context, appRoot, `Context changed; explicitly review research exclusions: ${profile}/${service}`);
      assert(!within(context, archiveRoot), `Research archive entered Docker context: ${profile}/${service}`);
      const dockerfile = path.resolve(context, build.dockerfile || "Dockerfile");
      assert.equal(realpathSync(dockerfile), path.join(appRoot, "Dockerfile"));
      const dockerSource = readFileSync(dockerfile, "utf8");
      assert(!referenceViolation(dockerSource), `Research reference in ${dockerfile}`);
      assert.match(dockerSource, /^COPY\s+.*\/app\/public\s+\.\/public\s*$/m);
      report.dockerContexts.push({ profile, service, context: posix(path.relative(repoRoot, context)), archiveExcluded: true });
      builds++;
    }
    assert(builds > 0, `No build configuration inspected: ${profile}`);
  }
});

check("negative controls reject copies and references without touching files", () => {
  const bytes = readFileSync(path.join(archiveRoot, expectedNames[0]));
  assert.throws(() => inspectPayload("art/renamed.png", bytes), /Byte-identical/);
  assert.throws(() => inspectPayload(`art/${expectedNames[0]}`, Buffer.from("changed")), /release path/);
  for (const value of [
    '/art/qq-farm/sprites/activity-gift.png',
    String.raw`\/art\/qq-farm\/sprites\/new.png`,
    '/art%2Fqq-farm%2Fsprites%2Fnew.png',
    String.raw`/art/qq-farm\u002fsprites/new.png`,
    '"/art/qq-farm/" + "sprites/new.png"',
    '"qq-farm-sprites/manifest.json"',
  ]) assert.throws(() => inspectPayload("chunk.js", Buffer.from(value)), /reference/);
  inspectPayload("art/REGISTRY.md", Buffer.from("Historical /art/qq-farm/sprites/"), true);
  assert.throws(() => inspectPayload("art/other.md", Buffer.from("/art/qq-farm/sprites/")), /reference/);
  inspectPayload("scene.css", Buffer.from('url("/art/manor-v6/environment.webp")'));
  inspectPayload("legacy-scene.css", Buffer.from('url("/art/qq-farm/farm-scene.webp")'));
  assert.throws(() => resolveRepositoryPath("../outside"), /escapes/);
  assert.throws(() => resolveRepositoryPath(`${archiveRelative}/../escape`), /Non-canonical/);
  assert(within(repoRoot, archiveRoot));
  assert(!within(appRoot, archiveRoot));
});

check("release option parsing and build-directory boundaries", () => {
  assert.equal(parseReleaseOptions([]), null);
  assert.deepEqual(parseReleaseOptions(["--release-root", appRoot]), { releaseRoot: appRoot, distDir: ".next" });
  assert.deepEqual(parseReleaseOptions(["--dist-dir", "custom-build"]), { releaseRoot: appRoot, distDir: "custom-build" });
  assert.deepEqual(parseReleaseOptions(["--dist-dir=custom-build", "--release-root", appRoot]), { releaseRoot: appRoot, distDir: "custom-build" });
  for (const args of [["--dist-dir"], ["--release-root"], ["--dist-dir", ""], ["--release-root", " "],
    ["--dist-dir", "a", "--dist-dir", "b"], ["--release-root", "a", "--release-root", "b"],
    ["--unknown", "a"], ["positional"]]) {
    assert.throws(() => parseReleaseOptions(args));
  }
  assert.throws(() => resolveBuildDirectory(appRoot, ".."), /inside the release root/);
  assert.throws(() => resolveBuildDirectory(appRoot, repoRoot), /inside the release root/);
  assert.throws(() => resolveBuildDirectory(appRoot, "."), /inside the release root/);
  assert.throws(() => resolveBuildDirectory(appRoot, "package.json"), /Expected build directory/);
  assert.equal(resolveBuildDirectory(appRoot, "public"), realpathSync(path.join(appRoot, "public")));
  assert.equal(resolveBuildDirectory(appRoot, path.join(appRoot, "public")), realpathSync(path.join(appRoot, "public")));
});

if (releaseOptions) {
  check("explicit release artifact public and compiled application payloads", () => {
    const requestedRoot = path.resolve(releaseOptions.releaseRoot);
    assert(lstatSync(requestedRoot).isDirectory() && !lstatSync(requestedRoot).isSymbolicLink(), "Expected an unlinked release root directory");
    const releaseRoot = realpathSync(requestedRoot);
    const nextRoot = resolveBuildDirectory(releaseRoot, releaseOptions.distDir);
    const buildIdPath = path.join(nextRoot, "BUILD_ID");
    assert(existsSync(buildIdPath), `Expected an already-built Next.js release: ${nextRoot}`);
    assert(lstatSync(buildIdPath).isFile() && !lstatSync(buildIdPath).isSymbolicLink(), "Expected an unlinked BUILD_ID file");
    const buildId = readFileSync(buildIdPath, "utf8").trim();
    assert(buildId && !/[\r\n\0]/.test(buildId), "BUILD_ID must contain a nonempty single-line build identifier");
    report.releasePublicFiles = scanPublic(path.join(releaseRoot, "public"));
    const files = ["static", "server"].flatMap((dir) => filesUnder(path.join(nextRoot, dir)));
    for (const entry of readdirSync(nextRoot, { withFileTypes: true })) {
      if (entry.isFile() && textExtensions.has(path.extname(entry.name).toLowerCase())) files.push(path.join(nextRoot, entry.name));
    }
    for (const file of files) {
      const needsBytes = sizeSet.has(lstatSync(file).size) || textExtensions.has(path.extname(file).toLowerCase());
      inspectPayload(posix(path.relative(releaseRoot, file)), needsBytes ? readFileSync(file) : null);
    }
    assert.equal(readFileSync(buildIdPath, "utf8").trim(), buildId, "Build changed during release scan; rerun against stable output");
    report.releasePayloadFiles = files.length;
    report.releaseArtifact = releaseRoot;
    report.releaseDistDir = nextRoot;
    report.releaseBuildId = buildId;
  });
} else {
  report.releaseArtifact = "NOT_CHECKED: pass --release-root PATH [--dist-dir PATH], or --dist-dir PATH for this app";
}
report.deployedHttpAndCaches = "NOT_CHECKED: no application or database was started";
console.log(JSON.stringify({ status: "PASS", ...report }, null, 2));
