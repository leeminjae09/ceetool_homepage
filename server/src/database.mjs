import { DatabaseSync } from "node:sqlite";
import { mkdirSync, chmodSync } from "node:fs";
import { dirname } from "node:path";
import { createHash, randomBytes } from "node:crypto";

export const token = () => randomBytes(32).toString("base64url");
export const digest = (value) =>
  createHash("sha256").update(value, "utf8").digest("hex");

export function openDatabase(path) {
  if (path !== ":memory:")
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  if (path !== ":memory:") chmodSync(path, 0o600);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS invoices (
      token TEXT PRIMARY KEY, order_no TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount > 0),
      tax_type TEXT NOT NULL CHECK(tax_type IN ('taxable', 'exempt')),
      terms TEXT NOT NULL, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL,
      state TEXT NOT NULL DEFAULT 'pending'
        CHECK(state IN ('pending','processing','paid','review')),
      tid TEXT UNIQUE, paid_at INTEGER, buyer_name TEXT, buyer_phone TEXT,
      consent_at INTEGER, note TEXT NOT NULL DEFAULT '',
      noti_code TEXT, noti_date TEXT
    );
    CREATE TABLE IF NOT EXISTS attempts (
      token TEXT PRIMARY KEY, invoice_token TEXT NOT NULL REFERENCES invoices(token),
      mid TEXT NOT NULL, edi_date TEXT NOT NULL, created_at INTEGER NOT NULL,
      state TEXT NOT NULL DEFAULT 'prepared'
        CHECK(state IN ('prepared','processing','closed','paid','review'))
    );
    CREATE INDEX IF NOT EXISTS attempts_invoice ON attempts(invoice_token);
    CREATE TABLE IF NOT EXISTS sessions (
      hash TEXT PRIMARY KEY, email TEXT NOT NULL, csrf TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS oauth_states (
      hash TEXT PRIMARY KEY, verifier TEXT NOT NULL, nonce TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS notifications (
      fingerprint TEXT PRIMARY KEY,
      invoice_token TEXT NOT NULL REFERENCES invoices(token),
      result_code TEXT NOT NULL, amount TEXT NOT NULL, received_at INTEGER NOT NULL
    );
  `);
  return db;
}

export function invoiceView(row, admin = false) {
  return {
    token: row.token,
    orderNo: row.order_no,
    title: row.title,
    amount: row.amount,
    taxType: row.tax_type,
    terms: row.terms,
    expiresAt: row.expires_at,
    state:
      row.state === "pending" && row.expires_at <= Date.now()
        ? "expired"
        : row.state,
    paidAt: row.paid_at,
    note: row.note,
    ...(admin
      ? {
          createdAt: row.created_at,
          buyerName: row.buyer_name,
          buyerPhone: row.buyer_phone,
          tid: row.tid,
        }
      : {}),
  };
}

export function purgePersonalData(db, now = Date.now()) {
  const fiveYearsAgo = new Date(now);
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
  db.prepare(
    `UPDATE invoices SET buyer_name = NULL, buyer_phone = NULL
    WHERE buyer_name IS NOT NULL AND
    ((state = 'pending' AND expires_at < ?) OR COALESCE(paid_at, created_at) < ?)`,
  ).run(now - 30 * 86400000, fiveYearsAgo.getTime());
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now);
  db.prepare("DELETE FROM oauth_states WHERE expires_at <= ?").run(now);
}

export function recoverInterruptedApprovals(db) {
  db.exec(`UPDATE invoices SET state = 'review',
    note = '승인 처리 중 서버가 재시작되었습니다. PaySM 관리자에서 거래를 확인해야 합니다.'
    WHERE state = 'processing';
    UPDATE attempts SET state = 'review' WHERE state = 'processing';`);
}
