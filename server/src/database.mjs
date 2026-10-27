import mysql from "mysql2/promise";
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { loadConfig } from "./config.mjs";

export const token = () => randomBytes(32).toString("base64url");
export const digest = (value) =>
  createHash("sha256").update(value, "utf8").digest("hex");

export async function openDatabase(config) {
  if (!config.password) throw new Error("DB_PASS is required");
  const pool = mysql.createPool({
    ...config,
    charset: "utf8mb4",
    timezone: "Z",
    connectionLimit: 5,
    connectTimeout: 10000,
    supportBigNumbers: true,
    bigNumberStrings: false,
    flags: ["-FOUND_ROWS"],
  });
  const context = new AsyncLocalStorage();
  let closing;
  const query = async (sql, params) => {
    const [result] = await (context.getStore() || pool).execute(sql, params);
    return result;
  };
  const db = {
    config,
    async run(sql, ...params) {
      const result = await query(sql, params);
      return { changes: result.affectedRows, insertId: result.insertId };
    },
    async all(sql, ...params) {
      return query(sql, params);
    },
    async get(sql, ...params) {
      return (await query(sql, params))[0];
    },
    async transaction(fn) {
      if (context.getStore())
        throw new Error("Nested database transactions are not supported");
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const result = await context.run(connection, fn);
        await connection.commit();
        return result;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },
    close() {
      return (closing ||= pool.end());
    },
  };
  try {
    const schema = await db.get(
      "SELECT value FROM settings WHERE setting_key = 'schema_version'",
    );
    if (schema?.value !== "mysql-v1")
      throw new Error("Apply tables.sql before starting the payment server");
    return db;
  } catch (error) {
    await db.close();
    throw error;
  }
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
    note:
      !admin && row.state === "review"
        ? "결제 상태를 확인하고 있습니다. 다시 결제하지 말고 담당자에게 문의해 주세요."
        : row.note,
    ...(admin
      ? {
          createdAt: row.created_at,
          buyerName: row.buyer_name,
          buyerPhone: row.buyer_phone,
          tid: row.tid,
        }
      : row.state === "pending" &&
          row.expires_at > Date.now() &&
          row.consent_at === null &&
          (row.buyer_name || row.buyer_phone)
        ? { buyerName: row.buyer_name, buyerPhone: row.buyer_phone }
        : {}),
  };
}

export async function purgePersonalData(db, now = Date.now()) {
  const fiveYearsAgo = new Date(now);
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
  await db.run(
    `UPDATE invoices SET buyer_name = NULL, buyer_phone = NULL
    WHERE (buyer_name IS NOT NULL OR buyer_phone IS NOT NULL) AND
    ((state = 'pending' AND expires_at < ?) OR COALESCE(paid_at, created_at) < ?)`,
    now - 30 * 86400000,
    fiveYearsAgo.getTime(),
  );
  await db.run("DELETE FROM sessions WHERE expires_at <= ?", now);
  await db.run("DELETE FROM oauth_states WHERE expires_at <= ?", now);
  await db.run(
    "DELETE FROM payment_visits WHERE notified_at < ?",
    now - 30 * 86400000,
  );
  await db.run(
    "UPDATE email_outbox SET payload = '{}' WHERE status = 'sent' AND sent_at < ? AND payload != '{}'",
    now - 30 * 86400000,
  );
}

export async function recoverInterruptedApprovals(db) {
  await db.transaction(async () => {
    await db.run(`UPDATE invoices SET state = 'review',
      note = '승인 처리 중 서버가 재시작되었습니다. PaySM 관리자에서 거래를 확인해야 합니다.'
      WHERE state = 'processing'`);
    await db.run(
      "UPDATE attempts SET state = 'review' WHERE state = 'processing'",
    );
  });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  if (process.argv[2])
    throw new Error("This command does not accept arguments");
  const db = await openDatabase(loadConfig().database);
  await db.close();
  console.log("MySQL payment schema is ready.");
}
