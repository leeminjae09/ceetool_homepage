import { pathToFileURL } from "node:url";
import { loadConfig, paymentReady } from "./config.mjs";
import { openDatabase } from "./database.mjs";
import { createPaysm } from "./paysm.mjs";

export async function reconcileReviews(db, provider, logger = console) {
  const invoices =
    await db.all(`SELECT * FROM invoices WHERE state = 'review' AND tid IS NOT NULL
       AND (noti_code IS NULL OR noti_code = '0000')
       ORDER BY created_at LIMIT 5`);
  const report = { checked: 0, recovered: 0, unresolved: 0, remaining: 0 };
  for (const invoice of invoices) {
    report.checked++;
    try {
      const result = await provider.receipt(invoice.tid);
      const matches =
        result.resultCd === "0000" &&
        result.TID === invoice.tid &&
        String(result.GOODS_AMT) === String(invoice.amount) &&
        (!result.ORD_NO || result.ORD_NO === invoice.order_no) &&
        (result.TRX_ST_CD === "0" || result.TRX_ST_CD === 0);
      if (!matches) {
        report.unresolved++;
        logger.error(
          JSON.stringify({
            event: "payment_reconciliation_unconfirmed",
            reason: "receipt_not_matching_approved_transaction",
            lookupSucceeded: result.resultCd === "0000",
            transactionMatches: result.TID === invoice.tid,
            amountMatches: String(result.GOODS_AMT) === String(invoice.amount),
            orderMatches: !result.ORD_NO || result.ORD_NO === invoice.order_no,
            status: ["0", "1", "2"].includes(String(result.TRX_ST_CD))
              ? String(result.TRX_ST_CD)
              : "missing_or_unknown",
            resultCode:
              typeof result.resultCd === "string" &&
              /^\d{4}$/.test(result.resultCd)
                ? result.resultCd
                : "missing_or_unknown",
          }),
        );
        continue;
      }
      await db.transaction(async () => {
        const updated = await db.run(
          `UPDATE invoices SET state = 'paid', paid_at = COALESCE(paid_at, ?),
             note = '', noti_code = '3001'
             WHERE token = ? AND state = 'review' AND tid = ?
             AND noti_code <=> ? AND noti_date <=> ?`,
          Date.now(),
          invoice.token,
          invoice.tid,
          invoice.noti_code,
          invoice.noti_date,
        );
        if (updated.changes) {
          await db.run(
            "UPDATE attempts SET state = 'paid' WHERE invoice_token = ? AND state IN ('processing','review')",
            invoice.token,
          );
          report.recovered++;
        } else {
          report.unresolved++;
          logger.error(
            JSON.stringify({
              event: "payment_reconciliation_unconfirmed",
              reason: "transaction_changed_during_lookup",
            }),
          );
        }
      });
    } catch (error) {
      report.unresolved++;
      logger.error(
        JSON.stringify({
          event: "payment_reconciliation_unconfirmed",
          reason: error.name,
        }),
      );
    }
  }
  report.remaining = (
    await db.get(`SELECT COUNT(*) AS count FROM invoices WHERE state = 'review'
       AND tid IS NOT NULL AND (noti_code IS NULL OR noti_code = '0000')`)
  ).count;
  return report;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const config = loadConfig();
  if (!paymentReady(config)) throw new Error("Payment credentials are missing");
  const db = await openDatabase(config.database);
  try {
    const report = await reconcileReviews(db, createPaysm(config));
    console.log(JSON.stringify({ event: "payment_reconciliation", ...report }));
    if (report.remaining || report.unresolved) process.exitCode = 1;
  } finally {
    await db.close();
  }
}
