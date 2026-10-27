import { createPaymentApp } from "./app.mjs";
import { loadConfig, googleReady, paymentReady } from "./config.mjs";
import { createEmailWorker, createMailer, queueConnectionTest } from "./email.mjs";
import {
  openDatabase,
  purgePersonalData,
  recoverInterruptedApprovals,
} from "./database.mjs";

const config = loadConfig();
const db = openDatabase(config.dbPath);
purgePersonalData(db);
const retentionTimer = setInterval(() => purgePersonalData(db), 3600000);
retentionTimer.unref();
recoverInterruptedApprovals(db);
queueConnectionTest(db);
const emailWorker = createEmailWorker(db, createMailer());
const flushEmails = () => {
  emailWorker.run().catch((error) =>
    console.error(JSON.stringify({ event: "payment_email_worker_error", reason: error.name })),
  );
};
const emailTimer = setInterval(flushEmails, 5000);
emailTimer.unref();
flushEmails();
if (!paymentReady(config) || !googleReady(config)) {
  console.error(
    "Payment server configuration is incomplete; unconfigured operations return HTTP 503.",
  );
}
const server = createPaymentApp({ db, config }).listen(
  config.port,
  "127.0.0.1",
  () => {
    console.log(`Payment API listening on 127.0.0.1:${config.port}`);
  },
);
let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  clearInterval(retentionTimer);
  clearInterval(emailTimer);
  const emailStopped = emailWorker.stop();
  server.close(async () => {
    await emailStopped;
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 25000).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
