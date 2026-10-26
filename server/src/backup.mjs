import { DatabaseSync } from "node:sqlite";
import {
  chmodSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { loadConfig } from "./config.mjs";

export function backupDatabase(source, destination) {
  mkdirSync(destination, { recursive: true, mode: 0o700 });
  const file = join(
    destination,
    `payments-${Date.now()}-${randomBytes(4).toString("hex")}.sqlite`,
  );
  const db = new DatabaseSync(source, { readOnly: true });
  try {
    db.exec("PRAGMA busy_timeout = 5000");
    db.prepare("VACUUM INTO ?").run(file);
  } finally {
    db.close();
  }
  chmodSync(file, 0o600);
  const files = readdirSync(destination, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() && /^payments-\d+-[a-f0-9]{8}\.sqlite$/.test(entry.name),
    )
    .map((entry) => join(destination, entry.name))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  for (const [index, old] of files.entries()) {
    if (index >= 7 || statSync(old).mtimeMs < Date.now() - 7 * 86400000)
      unlinkSync(old);
  }
  return file;
}
if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  const config = loadConfig();
  const path = backupDatabase(
    config.dbPath,
    join(dirname(config.dbPath), "backups"),
  );
  console.log(`Payment database snapshot created: ${path}`);
}
