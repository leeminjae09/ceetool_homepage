import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, purgePersonalData } from "../src/database.mjs";
import {
  createEmailWorker, createMailer, emailStatus, queueEmail, queueConnectionTest,
} from "../src/email.mjs";

const invoice = {
  order_no: "CT-UNIT-TEST", title: "개발 계약금", amount: 1250000,
  buyer_name: "private-name", buyer_phone: "01012345678",
  token: "private-payment-token", tid: "private-transaction-id", signData: "private-sign-data",
};
const silent = { log() {}, error() {} };
function memory(t) {
  const db = openDatabase(":memory:");
  t.after(() => db.close());
  return db;
}

test("SES uses fixed sender/recipient and safe UTF-8 content, not customer credentials", async (t) => {
  const db = memory(t);
  let command, options;
  const mailer = createMailer({ async send(sent, opts) {
    command = sent.input;
    options = opts;
    return { MessageId: "test-message" };
  } });
  queueEmail(db, "paid:one", "paid", invoice);
  const row = db.prepare("SELECT * FROM email_outbox").get();
  assert.equal(await mailer.send(row), "test-message");
  assert.equal(command.FromEmailAddress, "john@ceetool.com");
  assert.deepEqual(command.Destination, { ToAddresses: ["john@ceetool.com"] });
  assert.equal(command.Content.Simple.Subject.Charset, "UTF-8");
  assert.match(command.Content.Simple.Body.Text.Data, /1,250,000원/);
  assert.match(command.Content.Simple.Body.Text.Data, /https:\/\/ceetool.com\/admin\/payments/);
  for (const secret of [invoice.buyer_name, invoice.buyer_phone, invoice.token, invoice.tid, invoice.signData]) {
    assert.ok(!JSON.stringify(command).includes(secret));
    assert.ok(!row.payload.includes(secret));
  }
  assert.ok(options.abortSignal instanceof AbortSignal);
  for (const [kind, expected] of [["failed", /실제 청구 실패를 확정하지/], ["review", /재결제를 요청하지/], ["cancelled", /실제 환불 결과/]]) {
    queueEmail(db, kind, kind, invoice);
    await mailer.send(db.prepare("SELECT * FROM email_outbox WHERE event_key = ?").get(kind));
    assert.match(command.Content.Simple.Body.Text.Data, expected);
  }
  await assert.rejects(mailer.send({ ...row, kind: "untrusted" }), /INVALID_EMAIL_EVENT/);
  await assert.rejects(mailer.send({ ...row, payload: "{}" }), /INVALID_EMAIL_PAYLOAD/);
});

test("outbox deduplicates events and persists retries through database reopen", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "ceetool-email-test-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const path = join(directory, "payments.sqlite");
  let db = openDatabase(path);
  let now = Date.now(), calls = 0;
  const logs = [];
  const logger = { log: (line) => logs.push(line), error: (line) => logs.push(line) };
  queueEmail(db, "paid:one", "paid", invoice, now);
  assert.equal(queueEmail(db, "paid:one", "paid", invoice, now), 0);
  const failure = Object.assign(new Error("private provider response"), { name: "AccessDeniedException" });
  let worker = createEmailWorker(db, { async send() { calls++; throw failure; } }, logger, () => now);
  assert.equal(await worker.run(), 0);
  assert.equal(emailStatus(db).lastError, "AccessDeniedException");
  assert.ok(!JSON.stringify(logs).includes(failure.message));
  assert.equal(await worker.run(), 0);
  assert.equal(calls, 1);
  await worker.stop();
  db.close();
  db = openDatabase(path);
  now += 60000;
  worker = createEmailWorker(db, { async send() { calls++; return "message-id"; } }, logger, () => now);
  assert.equal(await worker.run(), 1);
  assert.equal(await worker.run(), 0);
  assert.deepEqual(emailStatus(db), { pending: 0, sent: 1, failed: 0, lastError: null, lastSentAt: now });
  assert.equal(calls, 2);
  purgePersonalData(db, now + 31 * 86400000);
  assert.equal(db.prepare("SELECT payload FROM email_outbox").get().payload, "{}");
  assert.equal(queueEmail(db, "paid:one", "paid", invoice, now), 0);
  queueConnectionTest(db);
  queueConnectionTest(db);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM email_outbox WHERE kind = 'test'").get().n, 1);
  await worker.stop();
  db.close();
});

test("email retry exhaustion is explicit and bounded to eight attempts", async (t) => {
  const db = memory(t);
  let now = Date.now(), calls = 0;
  queueEmail(db, "review:one", "review", invoice, now);
  const worker = createEmailWorker(db, { async send() { calls++; throw new Error("offline"); } }, silent, () => now);
  for (let i = 1; i <= 8; i++) {
    await worker.run();
    const row = db.prepare("SELECT * FROM email_outbox").get();
    assert.equal(row.attempts, i);
    assert.equal(row.status, i === 8 ? "failed" : "pending");
    if (i < 8) assert.equal(row.next_at - now, 60000 * 2 ** (i - 1));
    now = row.next_at;
  }
  assert.equal(await worker.run(), 0);
  assert.equal(calls, 8);
  assert.equal(emailStatus(db).failed, 1);
  await worker.stop();
});

test("workers atomically lease jobs, coalesce flushes, and await shutdown", async (t) => {
  const db = memory(t);
  queueEmail(db, "paid:one", "paid", invoice);
  let resolveSend;
  const worker = createEmailWorker(db, { send() {
    return new Promise((resolve) => { resolveSend = resolve; });
  } }, silent);
  const pending = worker.run();
  assert.equal(worker.run(), pending);
  const other = createEmailWorker(db, { async send() { assert.fail("leased job was sent twice"); } }, silent);
  assert.equal(await other.run(), 0);
  let stopped = false;
  const stop = worker.stop().then(() => { stopped = true; });
  await Promise.resolve();
  assert.equal(stopped, false);
  resolveSend("message-id");
  await stop;
  assert.equal(stopped, true);
  assert.equal(emailStatus(db).sent, 1);
  assert.equal(await worker.run(), 0);
  await other.stop();
});

test("expired sending leases recover but live leases are not stolen", async (t) => {
  const db = memory(t);
  let now = Date.now(), calls = 0;
  queueEmail(db, "paid:one", "paid", invoice, now);
  db.prepare("UPDATE email_outbox SET status = 'sending', attempts = 1, lease_until = ?").run(now + 60000);
  const worker = createEmailWorker(db, { async send() { calls++; return "recovered"; } }, silent, () => now);
  await worker.run();
  assert.equal(calls, 0);
  now += 60000;
  await worker.run();
  assert.equal(calls, 1);
  assert.equal(db.prepare("SELECT attempts FROM email_outbox").get().attempts, 2);
  await worker.stop();
});

test("missing SES acknowledgement never counts as sent and batches are bounded", async (t) => {
  const db = memory(t);
  for (let i = 0; i < 11; i++) queueEmail(db, `visit:${i}`, "visit", invoice);
  const mailer = createMailer({ async send() { return {}; } });
  const worker = createEmailWorker(db, mailer, silent);
  await worker.run();
  assert.equal(emailStatus(db).sent, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM email_outbox WHERE attempts = 1").get().n, 10);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM email_outbox WHERE attempts = 0").get().n, 1);
  await worker.stop();
});

test("the eighth crashed send becomes visibly failed instead of retrying forever", async (t) => {
  const db = memory(t);
  queueEmail(db, "paid:one", "paid", invoice);
  db.prepare("UPDATE email_outbox SET status = 'sending', attempts = 8, lease_until = ?").run(Date.now() - 1);
  const worker = createEmailWorker(db, { async send() { assert.fail("retry limit exceeded"); } }, silent);
  await worker.run();
  assert.equal(emailStatus(db).failed, 1);
  assert.equal(emailStatus(db).lastError, "EmailDeliveryInterrupted");
  await worker.stop();
});

test("invoice status events roll back atomically with the payment transaction", (t) => {
  const db = memory(t);
  db.prepare(`INSERT INTO invoices
    (token,order_no,title,amount,tax_type,terms,expires_at,created_at,state)
    VALUES ('unit-token','CT-ROLLBACK','계약금',100,'taxable','',?,?, 'processing')`)
    .run(Date.now() + 86400000, Date.now());
  db.exec("BEGIN IMMEDIATE");
  db.exec("UPDATE invoices SET state = 'paid'");
  assert.equal(emailStatus(db).pending, 1);
  db.exec("ROLLBACK");
  assert.equal(emailStatus(db).pending, 0);
  assert.equal(db.prepare("SELECT state FROM invoices").get().state, "processing");
  db.exec("UPDATE invoices SET state = 'paid'");
  assert.equal(emailStatus(db).pending, 1);
});
