import mysql from "mysql2/promise";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { openDatabase } from "../src/database.mjs";

export function sqlStatements(text) {
  const statements = [];
  let delimiter = ";",
    buffer = "";
  for (const line of text.split(/\r?\n/)) {
    const directive = /^DELIMITER\s+(\S+)\s*$/.exec(line);
    if (directive) {
      if (buffer.trim()) throw new Error("Unterminated SQL before DELIMITER");
      delimiter = directive[1];
      continue;
    }
    buffer += `${line}\n`;
    if (buffer.trimEnd().endsWith(delimiter)) {
      statements.push(buffer.trimEnd().slice(0, -delimiter.length));
      buffer = "";
    }
  }
  if (
    buffer.trim() &&
    !buffer
      .trim()
      .split("\n")
      .every((line) => !line.trim() || line.trim().startsWith("--"))
  )
    throw new Error("Unterminated SQL statement");
  return statements;
}

export async function createTestDatabase(t, { migrated = true } = {}) {
  if (!process.env.MYSQL_TEST_PASSWORD)
    throw new Error(
      "Real MySQL tests require MYSQL_TEST_PASSWORD and a disposable MySQL 8 instance",
    );
  const config = {
    host: process.env.MYSQL_TEST_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_TEST_PORT || 3306),
    user: process.env.MYSQL_TEST_USER || "root",
    password: process.env.MYSQL_TEST_PASSWORD,
    database: `ceetool_test_${randomBytes(8).toString("hex")}`,
  };
  const admin = await mysql.createConnection({
    ...config,
    database: undefined,
  });
  let db;
  t.after(async () => {
    if (db) await db.close();
    await admin.query(`DROP DATABASE IF EXISTS \`${config.database}\``);
    await admin.end();
  });
  const schema = (
    await readFile(new URL("../../tables.sql", import.meta.url), "utf8")
  ).replaceAll("`ceetool_payments`", `\`${config.database}\``);
  for (const statement of sqlStatements(schema)) await admin.query(statement);
  if (migrated)
    await admin.query(
      "INSERT INTO settings (setting_key,value) VALUES ('storage_migration','sqlite-v1')",
    );
  db = await openDatabase(config, { requireMigration: migrated });
  return db;
}

export async function restoreTestDump(db, text) {
  if (!/^ceetool_test_[a-f0-9]+$/.test(db.config.database))
    throw new Error("Only disposable test databases can be restored");
  const connection = await mysql.createConnection(db.config);
  try {
    for (const statement of sqlStatements(text))
      await connection.query(statement);
  } finally {
    await connection.end();
  }
}
