import { spawn } from "node:child_process";
import { once } from "node:events";
import { createWriteStream } from "node:fs";
import {
  chmod,
  mkdir,
  mkdtemp,
  readdir,
  stat,
  unlink,
  writeFile,
  rm,
  rmdir,
  rename,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { randomBytes } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { loadConfig } from "./config.mjs";
import { openDatabase } from "./database.mjs";

const option = (value) =>
  `"${String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"').replaceAll("\n", "\\n").replaceAll("\r", "\\r")}"`;
export async function backupDatabase(config, destination) {
  const db = await openDatabase(config);
  await db.close();
  await mkdir(destination, { recursive: true, mode: 0o700 });
  const temporary = await mkdtemp(join(destination, ".mysql-backup-"));
  const file = join(
    destination,
    `payments-${Date.now()}-${randomBytes(4).toString("hex")}.sql`,
  );
  const partial = `${file}.partial`;
  try {
    const credentials = join(temporary, "client.cnf");
    await writeFile(
      credentials,
      `[client]\nhost=${option(config.host)}\nport=${config.port}\nuser=${option(config.user)}\npassword=${option(config.password)}\n`,
      { mode: 0o600 },
    );
    const child = spawn(
      "mysqldump",
      [
        `--defaults-extra-file=${credentials}`,
        "--protocol=TCP",
        "--single-transaction",
        "--quick",
        "--no-tablespaces",
        "--set-gtid-purged=OFF",
        "--hex-blob",
        config.database,
      ],
      { stdio: ["ignore", "pipe", "ignore"] },
    );
    const exited = once(child, "close");
    const written = pipeline(
      child.stdout,
      createWriteStream(partial, { mode: 0o600 }),
    );
    const [[code]] = await Promise.all([exited, written]);
    if (code !== 0) throw new Error(`mysqldump failed with exit code ${code}`);
    await rename(partial, file);
    await chmod(file, 0o600);
    const files = (await readdir(destination))
      .filter((name) => /^payments-\d+-[a-f0-9]{8}\.sql$/.test(name))
      .sort()
      .reverse();
    for (const [index, name] of files.entries()) {
      const path = join(destination, name);
      if (index >= 7 || (await stat(path)).mtimeMs < Date.now() - 7 * 86400000)
        await unlink(path);
    }
    return file;
  } catch (error) {
    await rm(partial, { force: true });
    throw error;
  } finally {
    await rm(join(temporary, "client.cnf"), { force: true });
    await rmdir(temporary);
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const path = await backupDatabase(
    loadConfig().database,
    resolve(
      process.env.PAYMENT_BACKUP_DIR ||
        "/home/ubuntu/ceetool-payments/data/backups",
    ),
  );
  console.log(`MySQL payment database snapshot created: ${path}`);
}
