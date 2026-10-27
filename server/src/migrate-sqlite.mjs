import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { loadConfig } from "./config.mjs";
import { openDatabase } from "./database.mjs";

const tables = [
  "invoices",
  "attempts",
  "settings",
  "sessions",
  "oauth_states",
  "notifications",
  "email_outbox",
  "payment_visits",
];
const reserved = new Set([
  "schema_version",
  "storage_migration",
  "migration_manifest",
]);
function fingerprint(rows) {
  const normalized = rows
    .map((row) =>
      JSON.stringify(
        Object.fromEntries(
          Object.keys(row)
            .sort()
            .map((key) => [key, row[key]]),
        ),
      ),
    )
    .sort();
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}
function readSource(source) {
  return Object.fromEntries(
    tables.map((table) => {
      const rows = source
        .prepare(`SELECT * FROM ${table}`)
        .all()
        .map((row) => {
          for (const value of Object.values(row))
            if (typeof value === "number" && !Number.isSafeInteger(value))
              throw new Error(`Unsafe numeric value in ${table}`);
          if (table !== "settings") return { ...row };
          if (reserved.has(row.key))
            throw new Error("Source contains reserved MySQL settings");
          return { setting_key: row.key, value: row.value };
        });
      return [table, rows];
    }),
  );
}

export async function migrateSqlite(db, path) {
  const source = new DatabaseSync(path, { readOnly: true });
  try {
    source.exec("BEGIN");
    const rows = readSource(source);
    const manifest = Object.fromEntries(
      tables.map((table) => [
        table,
        { count: rows[table].length, sha256: fingerprint(rows[table]) },
      ]),
    );
    return await db.transaction(async () => {
      await db.get(
        "SELECT value FROM settings WHERE setting_key = 'schema_version' FOR UPDATE",
      );
      const previous = await db.get(
        "SELECT value FROM settings WHERE setting_key = 'storage_migration'",
      );
      if (previous) {
        const saved = await db.get(
          "SELECT value FROM settings WHERE setting_key = 'migration_manifest'",
        );
        if (saved?.value !== JSON.stringify(manifest))
          throw new Error(
            "This MySQL database was migrated from a different source snapshot",
          );
        return { alreadyMigrated: true, tables: manifest };
      }
      for (const table of tables) {
        const result = await db.get(
          `SELECT COUNT(*) AS count FROM ${table}${
            table === "settings" ? " WHERE setting_key != 'schema_version'" : ""
          }`,
        );
        if (result.count !== 0)
          throw new Error(`Migration requires an empty target: ${table}`);
      }
      for (const table of tables) {
        for (const row of rows[table]) {
          const columns = Object.keys(row);
          const quoted = columns
            .map((column) => `\`${column.replaceAll("`", "``")}\``)
            .join(",");
          await db.run(
            `INSERT INTO ${table} (${quoted}) VALUES (${columns.map(() => "?").join(",")})`,
            ...columns.map((column) => row[column]),
          );
        }
        const copied = await db.all(
          `SELECT * FROM ${table}${
            table === "settings" ? " WHERE setting_key != 'schema_version'" : ""
          }`,
        );
        if (fingerprint(copied) !== manifest[table].sha256)
          throw new Error(`Migration verification failed: ${table}`);
      }
      source.exec("COMMIT");
      const current = readSource(source);
      if (
        tables.some(
          (table) => fingerprint(current[table]) !== manifest[table].sha256,
        )
      )
        throw new Error(
          "SQLite changed during migration; stop the old payment service first",
        );
      await db.run(
        "INSERT INTO settings (setting_key,value) VALUES ('migration_manifest',?)",
        JSON.stringify(manifest),
      );
      await db.run(
        "INSERT INTO settings (setting_key,value) VALUES ('storage_migration','sqlite-v1')",
      );
      return { alreadyMigrated: false, tables: manifest };
    });
  } finally {
    source.close();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  if (
    process.argv[2] !== "--source" ||
    !process.argv[3] ||
    process.argv[4] !== "--offline"
  )
    throw new Error(
      "Stop ceetool-payments, then use --source <payments.sqlite> --offline",
    );
  if (process.platform === "linux") {
    const status = spawnSync("systemctl", [
      "is-active",
      "--quiet",
      "ceetool-payments",
    ]);
    if (status.error || status.status !== 3)
      throw new Error("ceetool-payments must be inactive before migration");
  }
  const db = await openDatabase(loadConfig().database, {
    requireMigration: false,
  });
  try {
    const report = await migrateSqlite(db, resolve(process.argv[3]));
    console.log(
      JSON.stringify({ event: "payment_mysql_migration", ...report }),
    );
  } finally {
    await db.close();
  }
}
