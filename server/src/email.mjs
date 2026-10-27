import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { PUBLIC_SITE_URL, loadConfig } from "./config.mjs";
import { openDatabase, token } from "./database.mjs";

export const EMAIL_REGION = "ap-northeast-2";
export const EMAIL_ADDRESS = "john@ceetool.com";
const labels = {
  visit: "결제 링크 접속",
  paid: "결제 완료",
  failed: "결제 인증 실패·미완료",
  cancelled: "결제 취소 통지",
  review: "결제 상태 확인 필요",
  test: "결제 알림 연결 확인",
};

export function queueEmail(db, key, kind, invoice, now = Date.now()) {
  if (!Object.hasOwn(labels, kind)) throw new Error("INVALID_EMAIL_EVENT");
  return db.prepare(
    `INSERT OR IGNORE INTO email_outbox
      (event_key, kind, payload, created_at, next_at) VALUES (?, ?, ?, ?, ?)`,
  ).run(key, kind, JSON.stringify(invoice ? {
    orderNo: invoice.order_no, title: invoice.title, amount: invoice.amount,
  } : {}), now, now).changes;
}

export function emailStatus(db) {
  const rows = db.prepare("SELECT status, COUNT(*) AS count FROM email_outbox GROUP BY status").all();
  const count = (status) => rows.find((row) => row.status === status)?.count || 0;
  return {
    pending: count("pending") + count("sending"),
    sent: count("sent"),
    failed: count("failed"),
    lastError: db.prepare("SELECT last_error FROM email_outbox WHERE last_error IS NOT NULL AND status != 'sent' ORDER BY id DESC LIMIT 1").get()?.last_error || null,
    lastSentAt: db.prepare("SELECT MAX(sent_at) AS time FROM email_outbox WHERE status = 'sent'").get().time,
  };
}

export function createMailer(client = new SESv2Client({
  region: EMAIL_REGION,
  maxAttempts: 1,
})) {
  return {
    async send(row) {
      if (!Object.hasOwn(labels, row.kind)) throw new Error("INVALID_EMAIL_EVENT");
      const payload = JSON.parse(row.payload);
      const details = [
        labels[row.kind],
        `발생 시각: ${new Date(row.created_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} (한국 시간)`,
      ];
      if (row.kind !== "test") {
        if (typeof payload.orderNo !== "string" || typeof payload.title !== "string" ||
            !Number.isSafeInteger(payload.amount) || payload.amount < 1)
          throw new Error("INVALID_EMAIL_PAYLOAD");
        details.push(`주문번호: ${payload.orderNo}`, `결제 항목: ${payload.title}`,
          `금액: ${payload.amount.toLocaleString("ko-KR")}원`);
      }
      if (row.kind === "failed") details.push("인증이 완료되지 않았다는 알림입니다. 브라우저 신고 또는 반환 결과만으로 실제 청구 실패를 확정하지 않습니다.");
      if (row.kind === "review") details.push("승인·취소 상태를 확정하지 못했습니다. 재결제를 요청하지 말고 거래 내역을 확인해 주세요.");
      if (row.kind === "cancelled") details.push("취소 통지를 수신했습니다. 실제 환불 결과와 일정은 거래 내역을 확인해 주세요.");
      details.push(`관리자: ${PUBLIC_SITE_URL}/admin`);
      const result = await client.send(new SendEmailCommand({
        FromEmailAddress: EMAIL_ADDRESS,
        Destination: { ToAddresses: [EMAIL_ADDRESS] },
        Content: { Simple: {
          Subject: { Data: `[CEETOOL] ${labels[row.kind]}`, Charset: "UTF-8" },
          Body: { Text: { Data: details.join("\n"), Charset: "UTF-8" } },
        } },
      }), { abortSignal: AbortSignal.timeout(10000) });
      if (!result.MessageId) throw new Error("SES_MESSAGE_ID_MISSING");
      return result.MessageId;
    },
  };
}

export function createEmailWorker(db, mailer, logger = console, clock = Date.now) {
  let running;
  let stopped = false;
  async function drain() {
    let sent = 0;
    db.prepare(`UPDATE email_outbox SET status = 'failed', lease_until = NULL,
      last_error = 'EmailDeliveryInterrupted'
      WHERE status = 'sending' AND lease_until <= ? AND attempts >= 8`).run(clock());
    for (let i = 0; i < 10 && !stopped; i++) {
      const now = clock();
      const lease = now + 60000;
      const row = db.prepare(
        `UPDATE email_outbox SET status = 'sending', attempts = attempts + 1, lease_until = ?
         WHERE id = (SELECT id FROM email_outbox
           WHERE attempts < 8 AND ((status = 'pending' AND next_at <= ?)
           OR (status = 'sending' AND lease_until <= ?))
           ORDER BY id LIMIT 1)
         RETURNING *`,
      ).get(lease, now, now);
      if (!row) break;
      try {
        const messageId = await mailer.send(row);
        db.prepare(`UPDATE email_outbox SET status = 'sent', sent_at = ?, message_id = ?,
          lease_until = NULL, last_error = NULL WHERE id = ? AND lease_until = ?`)
          .run(clock(), messageId, row.id, lease);
        logger.log(JSON.stringify({ event: "payment_email_sent", kind: row.kind }));
        sent++;
      } catch (error) {
        const name = typeof error?.name === "string" && /^[A-Za-z0-9_]{1,80}$/.test(error.name)
          ? error.name : "EmailDeliveryError";
        const exhausted = row.attempts >= 8;
        db.prepare(`UPDATE email_outbox SET status = ?, next_at = ?,
          lease_until = NULL, last_error = ? WHERE id = ? AND lease_until = ?`)
          .run(exhausted ? "failed" : "pending",
            clock() + Math.min(6 * 3600000, 60000 * 2 ** (row.attempts - 1)),
            name, row.id, lease);
        logger.error(JSON.stringify({ event: "payment_email_failed", reason: name, exhausted }));
      }
    }
    return sent;
  }
  return {
    run() {
      if (!running && !stopped) {
        running = drain().finally(() => { running = undefined; });
      }
      return running || Promise.resolve(0);
    },
    async stop() { stopped = true; await running; },
  };
}

export function queueConnectionTest(db) {
  queueEmail(db, "email-connection:v1", "test");
}

export function queueManualTest(db) {
  queueEmail(db, `test:${token()}`, "test");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv[2] !== "--status") throw new Error("Use --status");
  const db = openDatabase(loadConfig().dbPath);
  try {
    for (let i = 0; i < 15; i++) {
      const test = db.prepare("SELECT status, attempts FROM email_outbox WHERE event_key = 'email-connection:v1'").get();
      if (!test || test.status === "sent" || test.status === "failed" ||
          (test.status === "pending" && test.attempts > 0)) break;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    console.log(JSON.stringify({ event: "payment_email_status", ...emailStatus(db),
      connectionTest: db.prepare("SELECT status FROM email_outbox WHERE event_key = 'email-connection:v1'").get()?.status || "not_queued",
    }));
  } finally { db.close(); }
}
