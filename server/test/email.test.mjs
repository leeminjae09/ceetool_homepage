import test from "node:test";
import assert from "node:assert/strict";
import { openDatabase, purgePersonalData } from "../src/database.mjs";
import { createTestDatabase as memory } from "./mysql-helper.mjs";
import {
  createEmailWorker,
  createMailer,
  emailStatus,
  queueEmail,
  queueConnectionTest,
} from "../src/email.mjs";

const invoice = {
  order_no: "CT-UNIT-TEST",
  title: "개발 계약금",
  amount: 1250000,
  buyer_name: "private-name",
  buyer_phone: "01012345678",
  token: "private-payment-token",
  tid: "private-transaction-id",
  signData: "private-sign-data",
};
const silent = { log() {}, error() {} };
test("SES uses fixed sender/recipient and safe UTF-8 content, not customer credentials", async (t) => {
  const db = await memory(t);
  let command, options;
  const mailer = createMailer({
    async send(sent, opts) {
      command = sent.input;
      options = opts;
      return { MessageId: "test-message" };
    },
  });
  await queueEmail(db, "paid:one", "paid", invoice);
  const row = await db.get("SELECT * FROM email_outbox");
  assert.equal(await mailer.send(row), "test-message");
  assert.equal(command.FromEmailAddress, "john@ceetool.com");
  assert.deepEqual(command.Destination, { ToAddresses: ["john@ceetool.com"] });
  assert.equal(command.Content.Simple.Subject.Charset, "UTF-8");
  assert.match(command.Content.Simple.Body.Text.Data, /1,250,000원/);
  assert.match(
    command.Content.Simple.Body.Text.Data,
    /관리자: https:\/\/ceetool\.com\/admin$/,
  );
  for (const secret of [
    invoice.buyer_name,
    invoice.buyer_phone,
    invoice.token,
    invoice.tid,
    invoice.signData,
  ]) {
    assert.ok(!JSON.stringify(command).includes(secret));
    assert.ok(!row.payload.includes(secret));
  }
  assert.ok(options.abortSignal instanceof AbortSignal);
  for (const [kind, expected] of [
    ["failed", /실제 청구 실패를 확정하지/],
    ["review", /재결제를 요청하지/],
    ["cancelled", /실제 환불 결과/],
  ]) {
    await queueEmail(db, kind, kind, invoice);
    await mailer.send(
      await db.get("SELECT * FROM email_outbox WHERE event_key = ?", kind),
    );
    assert.match(command.Content.Simple.Body.Text.Data, expected);
  }
  await assert.rejects(
    mailer.send({ ...row, kind: "untrusted" }),
    /INVALID_EMAIL_EVENT/,
  );
  await assert.rejects(
    mailer.send({ ...row, payload: "{}" }),
    /INVALID_EMAIL_PAYLOAD/,
  );
});

test("outbox deduplicates events and persists retries through database reopen", async (t) => {
  let db = await memory(t);
  const config = db.config;
  let now = Date.now(),
    calls = 0;
  const logs = [];
  const logger = {
    log: (line) => logs.push(line),
    error: (line) => logs.push(line),
  };
  await queueEmail(db, "paid:one", "paid", invoice, now);
  assert.equal(await queueEmail(db, "paid:one", "paid", invoice, now), 0);
  const failure = Object.assign(new Error("private provider response"), {
    name: "AccessDeniedException",
  });
  let worker = createEmailWorker(
    db,
    {
      async send() {
        calls++;
        throw failure;
      },
    },
    logger,
    () => now,
  );
  assert.equal(await worker.run(), 0);
  assert.equal((await emailStatus(db)).lastError, "AccessDeniedException");
  assert.ok(!JSON.stringify(logs).includes(failure.message));
  assert.equal(await worker.run(), 0);
  assert.equal(calls, 1);
  await worker.stop();
  await db.close();
  db = await openDatabase(config);
  now += 60000;
  worker = createEmailWorker(
    db,
    {
      async send() {
        calls++;
        return "message-id";
      },
    },
    logger,
    () => now,
  );
  assert.equal(await worker.run(), 1);
  assert.equal(await worker.run(), 0);
  assert.deepEqual(await emailStatus(db), {
    pending: 0,
    sent: 1,
    failed: 0,
    lastError: null,
    lastSentAt: now,
  });
  assert.equal(calls, 2);
  await purgePersonalData(db, now + 31 * 86400000);
  assert.equal(
    (await db.get("SELECT payload FROM email_outbox")).payload,
    "{}",
  );
  assert.equal(await queueEmail(db, "paid:one", "paid", invoice, now), 0);
  await queueConnectionTest(db);
  await queueConnectionTest(db);
  assert.equal(
    (await db.get("SELECT COUNT(*) AS n FROM email_outbox WHERE kind = 'test'"))
      .n,
    1,
  );
  await worker.stop();
  await db.close();
});

test("email retry exhaustion is explicit and bounded to eight attempts", async (t) => {
  const db = await memory(t);
  let now = Date.now(),
    calls = 0;
  await queueEmail(db, "review:one", "review", invoice, now);
  const worker = createEmailWorker(
    db,
    {
      async send() {
        calls++;
        throw new Error("offline");
      },
    },
    silent,
    () => now,
  );
  for (let i = 1; i <= 8; i++) {
    await worker.run();
    const row = await db.get("SELECT * FROM email_outbox");
    assert.equal(row.attempts, i);
    assert.equal(row.status, i === 8 ? "failed" : "pending");
    if (i < 8) assert.equal(row.next_at - now, 60000 * 2 ** (i - 1));
    now = row.next_at;
  }
  assert.equal(await worker.run(), 0);
  assert.equal(calls, 8);
  assert.equal((await emailStatus(db)).failed, 1);
  await worker.stop();
});

test("workers atomically lease jobs, coalesce flushes, and await shutdown", async (t) => {
  const db = await memory(t);
  await queueEmail(db, "paid:one", "paid", invoice);
  let resolveSend, started;
  const claimed = new Promise((resolve) => {
    started = resolve;
  });
  const worker = createEmailWorker(
    db,
    {
      send() {
        started();
        return new Promise((resolve) => {
          resolveSend = resolve;
        });
      },
    },
    silent,
  );
  const pending = worker.run();
  assert.equal(worker.run(), pending);
  await claimed;
  const other = createEmailWorker(
    db,
    {
      async send() {
        assert.fail("leased job was sent twice");
      },
    },
    silent,
  );
  assert.equal(await other.run(), 0);
  let stopped = false;
  const stop = worker.stop().then(() => {
    stopped = true;
  });
  await Promise.resolve();
  assert.equal(stopped, false);
  resolveSend("message-id");
  await stop;
  assert.equal(stopped, true);
  assert.equal((await emailStatus(db)).sent, 1);
  assert.equal(await worker.run(), 0);
  await other.stop();
});

test("expired sending leases recover but live leases are not stolen", async (t) => {
  const db = await memory(t);
  let now = Date.now(),
    calls = 0;
  await queueEmail(db, "paid:one", "paid", invoice, now);
  await db.run(
    "UPDATE email_outbox SET status = 'sending', attempts = 1, lease_until = ?",
    now + 60000,
  );
  const worker = createEmailWorker(
    db,
    {
      async send() {
        calls++;
        return "recovered";
      },
    },
    silent,
    () => now,
  );
  await worker.run();
  assert.equal(calls, 0);
  now += 60000;
  await worker.run();
  assert.equal(calls, 1);
  assert.equal((await db.get("SELECT attempts FROM email_outbox")).attempts, 2);
  await worker.stop();
});

test("missing SES acknowledgement never counts as sent and batches are bounded", async (t) => {
  const db = await memory(t);
  for (let i = 0; i < 11; i++)
    await queueEmail(db, `visit:${i}`, "visit", invoice);
  const mailer = createMailer({
    async send() {
      return {};
    },
  });
  const worker = createEmailWorker(db, mailer, silent);
  await worker.run();
  assert.equal((await emailStatus(db)).sent, 0);
  assert.equal(
    (await db.get("SELECT COUNT(*) AS n FROM email_outbox WHERE attempts = 1"))
      .n,
    10,
  );
  assert.equal(
    (await db.get("SELECT COUNT(*) AS n FROM email_outbox WHERE attempts = 0"))
      .n,
    1,
  );
  await worker.stop();
});

test("the eighth crashed send becomes visibly failed instead of retrying forever", async (t) => {
  const db = await memory(t);
  await queueEmail(db, "paid:one", "paid", invoice);
  await db.run(
    "UPDATE email_outbox SET status = 'sending', attempts = 8, lease_until = ?",
    Date.now() - 1,
  );
  const worker = createEmailWorker(
    db,
    {
      async send() {
        assert.fail("retry limit exceeded");
      },
    },
    silent,
  );
  await worker.run();
  assert.equal((await emailStatus(db)).failed, 1);
  assert.equal((await emailStatus(db)).lastError, "EmailDeliveryInterrupted");
  await worker.stop();
});

test("invoice status events roll back atomically with the payment transaction", async (t) => {
  const db = await memory(t);
  await db.run(
    `INSERT INTO invoices
    (token,order_no,title,amount,tax_type,terms,expires_at,created_at,state)
    VALUES ('unit-token','CT-ROLLBACK','계약금',100,'taxable','',?,?, 'processing')`,
    Date.now() + 86400000,
    Date.now(),
  );
  await assert.rejects(
    db.transaction(async () => {
      await db.run("UPDATE invoices SET state = 'paid'");
      assert.equal((await emailStatus(db)).pending, 1);
      throw new Error("rollback-test");
    }),
    /rollback-test/,
  );
  assert.equal((await emailStatus(db)).pending, 0);
  assert.equal(
    (await db.get("SELECT state FROM invoices")).state,
    "processing",
  );
  await db.run("UPDATE invoices SET state = 'paid'");
  assert.equal((await emailStatus(db)).pending, 1);
});
