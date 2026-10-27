import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { createTestDatabase } from "./mysql-helper.mjs";
import { digest, openDatabase, token } from "../src/database.mjs";
import { migrateSqlite } from "../src/migrate-sqlite.mjs";
import { queueEmail } from "../src/email.mjs";

function legacy(t) {
  const directory = mkdtempSync(join(tmpdir(), "ceetool-sqlite-migration-"));
  const path = join(directory, "payments.sqlite");
  const source = new DatabaseSync(path);
  t.after(() => {
    source.close();
    rmSync(directory, { recursive: true, force: true });
  });
  source.exec(`
    CREATE TABLE invoices (
      token TEXT PRIMARY KEY, order_no TEXT UNIQUE, title TEXT, amount INTEGER,
      tax_type TEXT, terms TEXT, expires_at INTEGER, created_at INTEGER,
      state TEXT DEFAULT 'pending', tid TEXT UNIQUE, paid_at INTEGER,
      buyer_name TEXT, buyer_phone TEXT, consent_at INTEGER, note TEXT DEFAULT '',
      noti_code TEXT, noti_date TEXT);
    CREATE TABLE attempts (
      token TEXT PRIMARY KEY, invoice_token TEXT, mid TEXT, edi_date TEXT,
      created_at INTEGER, state TEXT DEFAULT 'prepared');
    CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE sessions (hash TEXT PRIMARY KEY,email TEXT,csrf TEXT,expires_at INTEGER);
    CREATE TABLE oauth_states (hash TEXT PRIMARY KEY,verifier TEXT,nonce TEXT,expires_at INTEGER);
    CREATE TABLE notifications (
      fingerprint TEXT PRIMARY KEY,invoice_token TEXT,result_code TEXT,amount TEXT,received_at INTEGER);
    CREATE TABLE email_outbox (
      id INTEGER PRIMARY KEY,event_key TEXT UNIQUE,kind TEXT,payload TEXT,created_at INTEGER,
      status TEXT DEFAULT 'pending',attempts INTEGER DEFAULT 0,next_at INTEGER,
      lease_until INTEGER,message_id TEXT,sent_at INTEGER,last_error TEXT);
    CREATE TABLE payment_visits (
      invoice_token TEXT,visitor_hash TEXT,notified_at INTEGER,PRIMARY KEY(invoice_token,visitor_hash));
  `);
  const paid = token(),
    pending = token(),
    attempt = token(),
    now = Date.now();
  const insert = source.prepare(`INSERT INTO invoices
    (token,order_no,title,amount,tax_type,terms,expires_at,created_at,state,tid,paid_at,
      buyer_name,buyer_phone,consent_at,note,noti_code,noti_date)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  insert.run(
    paid,
    "CT-PAID",
    "개발 계약금 ' \"\n",
    1250000,
    "taxable",
    "기존 환불조건",
    now + 86400000,
    now - 1000,
    "paid",
    "legacy-tid",
    now - 500,
    "기존 고객",
    "01012345678",
    now - 900,
    "",
    "3001",
    "20261027090000",
  );
  insert.run(
    pending,
    "CT-PENDING",
    "잔금",
    2500000,
    "exempt",
    "",
    now + 86400000,
    now,
    "pending",
    null,
    null,
    null,
    null,
    null,
    "",
    null,
    null,
  );
  source
    .prepare("INSERT INTO attempts VALUES (?,?,?,?,?,?)")
    .run(attempt, pending, "TESTMID001", "20261027090000", now, "prepared");
  source
    .prepare("INSERT INTO settings VALUES ('default_terms',?)")
    .run("저장된 환불조건");
  source
    .prepare("INSERT INTO sessions VALUES (?,?,?,?)")
    .run(
      digest("legacy-session"),
      "owner@example.invalid",
      token(),
      now + 3600000,
    );
  source
    .prepare("INSERT INTO oauth_states VALUES (?,?,?,?)")
    .run(digest("legacy-oauth"), token(), token(), now + 600000);
  source
    .prepare("INSERT INTO notifications VALUES (?,?,?,?,?)")
    .run(digest("legacy-notification"), paid, "3001", "1250000", now);
  source
    .prepare("INSERT INTO payment_visits VALUES (?,?,?)")
    .run(pending, digest("legacy-browser"), now);
  source
    .prepare(
      `INSERT INTO email_outbox
    (id,event_key,kind,payload,created_at,status,attempts,next_at,last_error)
    VALUES (201,?,'visit',?,?,'pending',2,?,'CredentialsProviderError')`,
    )
    .run(
      "legacy-email",
      JSON.stringify({ orderNo: "CT-PENDING", title: "잔금", amount: 2500000 }),
      now,
      now + 60000,
    );
  return { path, source, paid, pending, attempt };
}

test("SQLite migration preserves every table, verifies checksums, and does not backfill paid emails", async (t) => {
  const db = await createTestDatabase(t, { migrated: false });
  const old = legacy(t);
  const before = createHash("sha256")
    .update(readFileSync(old.path))
    .digest("hex");
  const result = await migrateSqlite(db, old.path);
  assert.equal(result.alreadyMigrated, false);
  assert.equal(result.tables.invoices.count, 2);
  for (const table of [
    "attempts",
    "settings",
    "sessions",
    "oauth_states",
    "notifications",
    "email_outbox",
    "payment_visits",
  ])
    assert.equal(result.tables[table].count, 1, table);
  const copied = await db.get(
    "SELECT * FROM invoices WHERE token = ?",
    old.paid,
  );
  assert.equal(copied.amount, 1250000);
  assert.equal(copied.state, "paid");
  assert.equal(copied.buyer_phone, "01012345678");
  assert.equal(copied.noti_date, "20261027090000");
  assert.equal((await db.get("SELECT COUNT(*) AS n FROM email_outbox")).n, 1);
  assert.equal(
    (await db.get("SELECT status FROM email_outbox")).status,
    "pending",
  );
  assert.equal(
    (await db.get("SELECT state FROM attempts WHERE token = ?", old.attempt))
      .state,
    "prepared",
  );
  assert.equal(
    createHash("sha256").update(readFileSync(old.path)).digest("hex"),
    before,
  );
  const ready = await openDatabase(db.config);
  await ready.close();
  await queueEmail(db, "after-migration", "test");
  assert.equal(
    (
      await db.get(
        "SELECT id FROM email_outbox WHERE event_key = 'after-migration'",
      )
    ).id,
    202,
  );
  await db.run(
    "UPDATE invoices SET title = '이전 후 수정' WHERE token = ?",
    old.pending,
  );
  assert.equal((await migrateSqlite(db, old.path)).alreadyMigrated, true);
  assert.equal(
    (await db.get("SELECT title FROM invoices WHERE token = ?", old.pending))
      .title,
    "이전 후 수정",
  );
});

test("invalid legacy references roll back all MySQL writes and migration readiness", async (t) => {
  const db = await createTestDatabase(t, { migrated: false });
  const old = legacy(t);
  old.source.prepare("UPDATE attempts SET invoice_token = ?").run(token());
  await assert.rejects(migrateSqlite(db, old.path), {
    code: "ER_NO_REFERENCED_ROW_2",
  });
  assert.equal((await db.get("SELECT COUNT(*) AS n FROM invoices")).n, 0);
  assert.equal((await db.get("SELECT COUNT(*) AS n FROM settings")).n, 1);
  await assert.rejects(openDatabase(db.config), /Run migrate-sqlite/);
});

test("migration refuses nonempty targets and mismatched source snapshots without overwriting", async (t) => {
  const db = await createTestDatabase(t, { migrated: false });
  const old = legacy(t);
  await db.run(
    "INSERT INTO settings (setting_key,value) VALUES ('default_terms','existing')",
  );
  await assert.rejects(migrateSqlite(db, old.path), /empty target/);
  assert.equal(
    (
      await db.get(
        "SELECT value FROM settings WHERE setting_key = 'default_terms'",
      )
    ).value,
    "existing",
  );
  await db.run("DELETE FROM settings WHERE setting_key = 'default_terms'");
  await migrateSqlite(db, old.path);
  old.source
    .prepare("UPDATE invoices SET amount = 999 WHERE token = ?")
    .run(old.pending);
  await assert.rejects(
    migrateSqlite(db, old.path),
    /different source snapshot/,
  );
  assert.equal(
    (await db.get("SELECT amount FROM invoices WHERE token = ?", old.pending))
      .amount,
    2500000,
  );
});

test("MySQL transactions isolate pooled connections and roll back payment/outbox together", async (t) => {
  const db = await createTestDatabase(t);
  await db.run(
    `INSERT INTO invoices
    (token,order_no,title,amount,tax_type,terms,expires_at,created_at)
    VALUES (?,?,'큰 금액',?,'taxable','',?,?)`,
    token(),
    "CT-SAFE-INTEGER",
    Number.MAX_SAFE_INTEGER,
    Date.now() + 86400000,
    Date.now(),
  );
  assert.equal(
    (await db.get("SELECT amount FROM invoices")).amount,
    Number.MAX_SAFE_INTEGER,
  );
  const separate = await openDatabase(db.config);
  try {
    await assert.rejects(
      db.transaction(async () => {
        await db.run("UPDATE invoices SET state = 'paid'");
        assert.equal(
          (await db.get("SELECT state FROM invoices")).state,
          "paid",
        );
        assert.equal(
          (await separate.get("SELECT state FROM invoices")).state,
          "pending",
        );
        assert.equal(
          (await separate.get("SELECT COUNT(*) AS n FROM email_outbox")).n,
          0,
        );
        throw new Error("expected-rollback");
      }),
      /expected-rollback/,
    );
    assert.equal((await db.get("SELECT state FROM invoices")).state, "pending");
    assert.equal((await db.get("SELECT COUNT(*) AS n FROM email_outbox")).n, 0);
  } finally {
    await separate.close();
  }
});
