import {
  chmodSync,
  chownSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, posix, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

const snippet = "/etc/nginx/snippets/ceetool-payments.conf";
const include = `include ${snippet};`;
const root = "/home/ubuntu/ceetool_homepage/dist";
const lexer = /#[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[{};]|[^\s{};#]+/g;

export function addInclude(content) {
  const tokens = [...content.matchAll(lexer)].filter(
    (item) => !item[0].startsWith("#"),
  );
  const insertions = [];
  let found = false;
  for (let i = 0; i + 1 < tokens.length; i++) {
    if (tokens[i][0] !== "server" || tokens[i + 1][0] !== "{") continue;
    let depth = 1,
      directive = [];
    const directives = [],
      roots = [];
    for (let j = i + 2; j < tokens.length; j++) {
      const item = tokens[j][0];
      if (item === "{") {
        depth++;
        directive = [];
      } else if (item === "}") {
        depth--;
        directive = [];
        if (depth === 0) {
          const names = directives
            .filter((d) => d[0] === "server_name")
            .flatMap((d) => d.slice(1));
          if (
            names.includes("ceetool.com") &&
            roots.some(
              (value) => value.startsWith("/") && posix.resolve(value) === root,
            )
          ) {
            found = true;
            if (
              !directives.some(
                (d) => d.length === 2 && d[0] === "include" && d[1] === snippet,
              )
            ) {
              insertions.push(tokens[i + 1].index + 1);
            }
          }
          break;
        }
      } else if (item === ";") {
        if (directive[0] === "root") roots.push(...directive.slice(1));
        if (depth === 1) directives.push(directive);
        directive = [];
      } else directive.push(item.replace(/^["']|["']$/g, ""));
      if (j === tokens.length - 1)
        throw new Error("Unbalanced nginx server block");
    }
  }
  for (const offset of insertions.reverse()) {
    content = `${content.slice(0, offset)}\n    ${include}\n${content.slice(offset)}`;
  }
  return { content, found };
}

function atomicWrite(path, data, mode = 0o644) {
  const original = existsSync(path) ? statSync(path) : null;
  const temporary = join(
    dirname(path),
    `.ceetool-${randomBytes(10).toString("hex")}`,
  );
  try {
    writeFileSync(temporary, data, {
      mode: original ? original.mode & 0o777 : mode,
      flag: "wx",
    });
    if (original) {
      chmodSync(temporary, original.mode & 0o777);
      chownSync(temporary, original.uid, original.gid);
    }
    renameSync(temporary, path);
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary);
  }
}

export function install() {
  execFileSync("nginx", ["-t"], { stdio: "inherit" });
  const dump = execFileSync("nginx", ["-T"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const paths = new Set(
    [...dump.matchAll(/^# configuration file (.+):$/gm)].map((m) =>
      realpathSync(m[1]),
    ),
  );
  const changes = [];
  let matched = false;
  for (const path of paths) {
    if (!path.startsWith("/etc/nginx/")) continue;
    const original = readFileSync(path);
    const updated = addInclude(original.toString("utf8"));
    matched ||= updated.found;
    if (updated.content !== original.toString("utf8"))
      changes.push({ path, original, updated: updated.content });
  }
  if (!matched)
    throw new Error(
      "CEETOOL virtual host with the expected static root was not found. Add the documented include manually; no nginx file was changed.",
    );
  mkdirSync(dirname(snippet), { recursive: true });
  const previous = existsSync(snippet) ? readFileSync(snippet) : null;
  if (
    previous &&
    !previous.toString().startsWith("# Managed by ceetool-payments.")
  ) {
    throw new Error("Refusing to overwrite an unmanaged nginx snippet");
  }
  const backup = join(
    "/var/backups/ceetool-payments",
    `${Date.now()}-${randomBytes(4).toString("hex")}`,
  );
  mkdirSync(backup, { recursive: true, mode: 0o700 });
  for (let i = 0; i < changes.length; i++)
    atomicWrite(join(backup, `${i}.conf`), changes[i].original, 0o600);
  if (previous)
    atomicWrite(join(backup, "previous-snippet.conf"), previous, 0o600);
  try {
    atomicWrite(
      snippet,
      readFileSync(new URL("./nginx.conf", import.meta.url)),
    );
    for (const change of changes) atomicWrite(change.path, change.updated);
    execFileSync("nginx", ["-t"], { stdio: "inherit" });
    execFileSync("systemctl", ["reload", "nginx"], { stdio: "inherit" });
  } catch (error) {
    for (const change of changes) atomicWrite(change.path, change.original);
    if (previous) atomicWrite(snippet, previous);
    else if (existsSync(snippet)) unlinkSync(snippet);
    execFileSync("nginx", ["-t"], { stdio: "inherit" });
    execFileSync("systemctl", ["reload", "nginx"], { stdio: "inherit" });
    console.error(
      "CEETOOL nginx installation failed; original configuration restored.",
    );
    throw error;
  }
  console.log(
    "CEETOOL payment routes installed; other virtual hosts were not changed.",
  );
}

function pruneReleases(current, previous) {
  const releasesRoot = realpathSync("/home/ubuntu/ceetool-payments/releases");
  const protectedPaths = new Set(
    [current, previous].filter(Boolean).map((p) => resolve(p)),
  );
  const releases = readdirSync(releasesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^[a-f0-9]{40}$/.test(entry.name))
    .map((entry) => join(releasesRoot, entry.name))
    .filter((path) => dirname(realpathSync(path)) === releasesRoot)
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  for (const path of releases.slice(0, 3)) protectedPaths.add(path);
  for (const path of releases) {
    if (
      !protectedPaths.has(path) &&
      existsSync(join(path, "server/package.json")) &&
      JSON.parse(readFileSync(join(path, "server/package.json"), "utf8"))
        .name === "ceetool-payments"
    ) {
      rmSync(path, { recursive: true });
    }
  }
}
if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  if (process.argv[2] === "--prune")
    pruneReleases(process.argv[3], process.argv[4]);
  else install();
}
