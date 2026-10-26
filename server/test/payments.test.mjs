import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPaymentApp } from "../src/app.mjs";
import { loadConfig, PUBLIC_SITE_URL } from "../src/config.mjs";
import {
  digest,
  openDatabase,
  purgePersonalData,
  recoverInterruptedApprovals,
} from "../src/database.mjs";
import { backupDatabase } from "../src/backup.mjs";
import { createPaysm, ediDate, makeHash } from "../src/paysm.mjs";

const environment = {
  PAYSM_MID: "TESTMID001",
  PAYSM_MERCHANT_KEY: "unit-test-only-not-a-real-key",
  GOOGLE_CLIENT_ID: "unit-test-client",
  GOOGLE_CLIENT_SECRET: "unit-test-secret",
  ADMIN_GOOGLE_EMAILS: "owner@example.invalid",
};
async function fixture(t, options = {}) {
  const config = loadConfig({ ...environment, ...options.env });
  const db = openDatabase(":memory:");
  const logs = [];
  let googleRequest,
    calls = 0;
  const provider = {
    approve: async (auth) => {
      calls++;
      if (options.approve) return options.approve(auth);
      return {
        resultCd: "0000",
        mid: auth.mid,
        amt: auth.goodsAmt,
        tid: auth.tid,
      };
    },
  };
  const google = {
    authorizationUrl(state, verifier, nonce) {
      googleRequest = { state, verifier, nonce };
      return `https://accounts.google.com/o/oauth2/v2/auth?state=${state}`;
    },
    async exchange() {
      return {
        email: "owner@example.invalid",
        email_verified: true,
        nonce: googleRequest.nonce,
        ...options.claims,
      };
    },
  };
  const app = createPaymentApp({
    db,
    config,
    provider,
    google,
    logger: { error: (line) => logs.push(line) },
  });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}/api/payments`;
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    db.close();
    assert.ok(
      !logs.some(
        (line) =>
          line.includes(environment.PAYSM_MERCHANT_KEY) ||
          line.includes("private-sign-data"),
      ),
    );
  });
  async function api(
    path,
    { method = "GET", body, cookie, csrf, origin = PUBLIC_SITE_URL, form } = {},
  ) {
    const headers = {};
    if (origin) headers.Origin = origin;
    if (cookie) headers.Cookie = cookie;
    if (csrf) headers["X-CSRF-Token"] = csrf;
    if (body) headers["Content-Type"] = "application/json";
    if (form) headers["Content-Type"] = "application/x-www-form-urlencoded";
    const response = await fetch(`${base}${path}`, {
      method,
      headers,
      redirect: "manual",
      body: body
        ? JSON.stringify(body)
        : form
          ? new URLSearchParams(form)
          : undefined,
    });
    const data = response.headers
      .get("content-type")
      ?.includes("application/json")
      ? await response.json()
      : await response.text();
    return { response, data, status: response.status };
  }
  async function login() {
    const start = await api("/admin/login");
    assert.equal(start.status, 302);
    const state = new URL(
      start.response.headers.get("location"),
    ).searchParams.get("state");
    const cookie = start.response.headers.getSetCookie()[0].split(";")[0];
    const end = await api(`/admin/callback?state=${state}&code=test-code`, {
      cookie,
    });
    const cookies = end.response.headers.getSetCookie();
    const sessionCookie = cookies
      .find((value) => value.startsWith("ceetool_admin="))
      ?.split(";")[0];
    if (!sessionCookie) return { response: end.response, cookie, state };
    const session = await api("/admin/session", { cookie: sessionCookie });
    return {
      cookie: sessionCookie,
      csrf: session.data.csrfToken,
      response: end.response,
      state,
    };
  }
  async function invoice(overrides = {}) {
    const admin = await login();
    const created = await api("/admin/invoices", {
      method: "POST",
      ...admin,
      body: {
        title: "개발 계약금",
        amount: 1100,
        taxType: "taxable",
        terms: "합의된 계약 및 환불조건",
        expiresAt: Date.now() + 86400000,
        ...overrides,
      },
    });
    assert.equal(created.status, 201, JSON.stringify(created.data));
    return created.data;
  }
  async function prepare(invoice) {
    const result = await api(`/invoices/${invoice.token}/prepare`, {
      method: "POST",
      body: {
        name: "테스트 고객",
        phone: "010-1234-5678",
        consent: true,
        mobile: false,
        amount: 1,
      },
    });
    assert.equal(result.status, 200, JSON.stringify(result.data));
    return result.data;
  }
  function auth(checkout, tid = `${config.mid}-test-transaction`) {
    return {
      resultCode: "0000",
      tid,
      mid: checkout.fields.mid,
      ediDate: checkout.fields.ediDate,
      goodsAmt: checkout.fields.goodsAmt,
      signData: "private-sign-data".repeat(20),
    };
  }
  function notify(checkout, auth, overrides = {}) {
    const body = {
      tid: auth.tid,
      mid: auth.mid,
      ediDate: auth.ediDate,
      amt: auth.goodsAmt,
      resultCd: "3001",
      ...overrides,
    };
    return {
      ...body,
      hashStr: makeHash(body.mid, body.ediDate, body.amt, config.merchantKey),
    };
  }
  return {
    config,
    db,
    api,
    login,
    invoice,
    prepare,
    auth,
    notify,
    logs,
    calls: () => calls,
  };
}

test("payment API defaults to port 3888 and validates port overrides", () => {
  assert.equal(loadConfig({}).port, 3888);
  assert.equal(loadConfig({ PORT: "3888" }).port, 3888);
  assert.throws(() => loadConfig({ PORT: "65536" }), /PORT/);
});

test("PaySM SHA-256 format, Seoul clock, and fixed production URLs", async () => {
  assert.equal(
    makeHash("a", "b", "c", ""),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
  assert.equal(ediDate(new Date("2026-10-26T12:34:56Z")), "20261026213456");
  let sent;
  const paysm = createPaysm(loadConfig(environment), async (url, options) => {
    sent = { url, options };
    return new Response('{"resultCd":"0000"}');
  });
  await paysm.approve({
    tid: "tid",
    mid: "TESTMID001",
    ediDate: "20261026213456",
    goodsAmt: "1100",
    signData: "opaque-value",
  });
  assert.equal(sent.url, "https://api.skyclassism.com/payment.do");
  assert.match(
    sent.options.headers["Content-Type"],
    /application\/x-www-form-urlencoded/,
  );
  assert.equal(sent.options.body.get("signData"), "opaque-value");
  assert.equal(sent.options.body.get("encData").length, 64);
  assert.equal(sent.options.redirect, "error");
  assert.ok(
    !sent.options.body.toString().includes(environment.PAYSM_MERCHANT_KEY),
  );
  await assert.rejects(
    createPaysm(
      loadConfig(environment),
      async () => new Response("invalid"),
    ).approve({}),
    SyntaxError,
  );
});

test("missing credentials fail closed with explicit 503 responses", async (t) => {
  const f = await fixture(t, {
    env: { PAYSM_MID: "", PAYSM_MERCHANT_KEY: "", GOOGLE_CLIENT_ID: "" },
  });
  assert.deepEqual((await f.api("/health")).data, {
    ok: true,
    paymentConfigured: false,
    adminConfigured: false,
  });
  assert.equal((await f.api("/admin/login")).status, 503);
  assert.equal((await f.api("/admin/session")).status, 503);
  assert.equal(
    (await f.api("/invoices/invalid/prepare", { method: "POST", body: {} }))
      .status,
    503,
  );
});

test("Google login binds state, nonce, verified email, and the configured allowlist", async (t) => {
  for (const claims of [
    { email: "outsider@example.invalid" },
    { email_verified: false },
    { nonce: "wrong" },
  ]) {
    await t.test(JSON.stringify(claims), async (t) => {
      const f = await fixture(t, { claims });
      const login = await f.login();
      assert.match(
        login.response.headers.get("location"),
        /error=google_login$/,
      );
      assert.equal(
        f.db.prepare("SELECT COUNT(*) AS count FROM sessions").get().count,
        0,
      );
    });
  }
  const f = await fixture(t);
  const badState = await f.api("/admin/callback?state=bad&code=test");
  assert.match(
    badState.response.headers.get("location"),
    /error=google_login$/,
  );
  const login = await f.login();
  assert.match(login.response.headers.get("location"), /\/admin\/payments$/);
  assert.equal(
    f.db.prepare("SELECT COUNT(*) AS count FROM oauth_states").get().count,
    0,
  );
  const again = await f.api(`/admin/callback?state=${login.state}&code=test`, {
    cookie: login.cookie,
  });
  assert.match(again.response.headers.get("location"), /error=google_login$/);
  assert.equal((await f.api("/admin/invoices")).status, 401);
  const logout = await f.api("/admin/logout", { method: "POST", ...login });
  assert.equal(logout.status, 204);
  assert.equal((await f.api("/admin/session", login)).status, 401);
});

test("admin mutations require session, same origin, CSRF, and valid immutable invoice data", async (t) => {
  const f = await fixture(t);
  const admin = await f.login();
  const body = {
    title: "개발비",
    amount: 1100,
    taxType: "taxable",
    terms: "계약조건",
    expiresAt: Date.now() + 60000,
  };
  assert.equal(
    (await f.api("/admin/invoices", { method: "POST", body })).status,
    401,
  );
  assert.equal(
    (
      await f.api("/admin/invoices", {
        method: "POST",
        ...admin,
        csrf: "wrong",
        body,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await f.api("/admin/invoices", {
        method: "POST",
        ...admin,
        origin: "https://attacker.invalid",
        body,
      })
    ).status,
    403,
  );
  for (const invalid of [
    { amount: 1.5 },
    { amount: 0 },
    { amount: Number.MAX_SAFE_INTEGER + 1 },
    { terms: "" },
    { taxType: "invalid" },
    { expiresAt: 1 },
  ]) {
    assert.equal(
      (
        await f.api("/admin/invoices", {
          method: "POST",
          ...admin,
          body: { ...body, ...invalid },
        })
      ).status,
      400,
    );
  }
  assert.equal((await f.api("/admin/invoices?page=-1", admin)).status, 400);
});

test("checkout signs server amount, requires consent and locks expired or superseded requests", async (t) => {
  const f = await fixture(t);
  const invoice = await f.invoice();
  const checkout = await f.prepare(invoice);
  assert.equal(checkout.action, "https://api.skyclassism.com/payInit_hash.do");
  assert.equal(checkout.fields.goodsAmt, "1100");
  assert.equal(checkout.fields.goodsSplAmt, "1000");
  assert.equal(checkout.fields.goodsVat, "100");
  assert.equal(checkout.fields.goodsTaxFreeAmt, "0");
  assert.match(
    checkout.fields.returnUrl,
    /^https:\/\/ceetool\.com\/api\/payments\/return\//,
  );
  assert.equal(
    checkout.fields.encData,
    makeHash(
      f.config.mid,
      checkout.fields.ediDate,
      "1100",
      f.config.merchantKey,
    ),
  );
  assert.ok(!JSON.stringify(checkout).includes(f.config.merchantKey));
  const publicInvoice = (await f.api(`/invoices/${invoice.token}`)).data;
  assert.equal(publicInvoice.buyerName, undefined);
  assert.equal(publicInvoice.buyerPhone, undefined);
  assert.equal(publicInvoice.tid, undefined);
  for (const invalid of [{ consent: false }, { phone: "bad" }, { name: "" }]) {
    assert.equal(
      (
        await f.api(`/invoices/${invoice.token}/prepare`, {
          method: "POST",
          body: {
            name: "고객",
            phone: "01012345678",
            consent: true,
            mobile: false,
            ...invalid,
          },
        })
      ).status,
      400,
    );
  }
  await f.prepare(invoice);
  assert.equal(
    (
      await f.api(`/approve/${checkout.attemptToken}`, {
        method: "POST",
        body: f.auth(checkout),
      })
    ).status,
    409,
  );
  f.db
    .prepare("UPDATE invoices SET expires_at = 1 WHERE token = ?")
    .run(invoice.token);
  assert.equal(
    (await f.api(`/invoices/${invoice.token}`)).data.state,
    "expired",
  );
  assert.equal(
    (
      await f.api(`/invoices/${invoice.token}/prepare`, {
        method: "POST",
        body: {},
      })
    ).status,
    409,
  );
});

test("card authentication alone is not payment; approval and duplicate requests are idempotent", async (t) => {
  const f = await fixture(t);
  const invoice = await f.invoice(),
    checkout = await f.prepare(invoice),
    auth = f.auth(checkout);
  assert.equal(
    (await f.api(`/invoices/${invoice.token}`)).data.state,
    "pending",
  );
  for (const change of [
    { mid: "OTHER00001" },
    { goodsAmt: "1" },
    { ediDate: "20000101000000" },
    { signData: "" },
    { resultCode: "FAIL" },
  ]) {
    assert.equal(
      (
        await f.api(`/approve/${checkout.attemptToken}`, {
          method: "POST",
          body: { ...auth, ...change },
        })
      ).status,
      400,
    );
  }
  assert.equal(f.calls(), 0);
  const paid = await f.api(`/approve/${checkout.attemptToken}`, {
    method: "POST",
    body: auth,
  });
  assert.equal(paid.data.state, "paid");
  assert.ok(paid.data.paidAt);
  const duplicate = await f.api(`/approve/${checkout.attemptToken}`, {
    method: "POST",
    body: auth,
  });
  assert.equal(duplicate.data.state, "paid");
  assert.equal(f.calls(), 1);
  const second = await f.invoice(),
    secondCheckout = await f.prepare(second);
  assert.equal(
    (
      await f.api(`/approve/${secondCheckout.attemptToken}`, {
        method: "POST",
        body: f.auth(secondCheckout),
      })
    ).status,
    409,
  );
});

test("simultaneous approvals make exactly one provider request", async (t) => {
  let release, started;
  const inFlight = new Promise((resolve) => {
    started = resolve;
  });
  const f = await fixture(t, {
    approve: (auth) => {
      started();
      return new Promise((resolve) => {
        release = () =>
          resolve({
            resultCd: "0000",
            mid: auth.mid,
            tid: auth.tid,
            amt: auth.goodsAmt,
          });
      });
    },
  });
  const invoice = await f.invoice(),
    checkout = await f.prepare(invoice),
    auth = f.auth(checkout);
  const first = f.api(`/approve/${checkout.attemptToken}`, {
    method: "POST",
    body: auth,
  });
  await inFlight;
  const duplicate = await f.api(`/approve/${checkout.attemptToken}`, {
    method: "POST",
    body: auth,
  });
  assert.equal(duplicate.data.state, "processing");
  release();
  assert.equal((await first).data.state, "paid");
  assert.equal(f.calls(), 1);
});

test("timeout, failure, and mismatched approval results require review without automatic reapproval", async (t) => {
  for (const result of [
    null,
    { resultCd: "9999" },
    { resultCd: "0000", mid: "wrong", amt: "1100", tid: "wrong" },
  ]) {
    await t.test(JSON.stringify(result), async (t) => {
      const f = await fixture(t, {
        approve: async () => {
          if (!result) throw new Error("simulated-timeout");
          return result;
        },
      });
      const invoice = await f.invoice(),
        checkout = await f.prepare(invoice),
        auth = f.auth(checkout);
      assert.equal(
        (
          await f.api(`/approve/${checkout.attemptToken}`, {
            method: "POST",
            body: auth,
          })
        ).data.state,
        "review",
      );
      assert.equal(
        (
          await f.api(`/approve/${checkout.attemptToken}`, {
            method: "POST",
            body: auth,
          })
        ).data.state,
        "review",
      );
      assert.equal(f.calls(), 1);
      assert.equal(
        (
          await f.api(`/invoices/${invoice.token}/prepare`, {
            method: "POST",
            body: {},
          })
        ).status,
        409,
      );
    });
  }
});

test("mobile form callbacks approve on the server and redirect to the saved order", async (t) => {
  const f = await fixture(t);
  const invoice = await f.invoice(),
    checkout = await f.prepare(invoice);
  const result = await f.api(`/return/${checkout.attemptToken}`, {
    method: "POST",
    form: f.auth(checkout),
    origin: null,
  });
  assert.equal(result.status, 303);
  assert.equal(
    result.response.headers.get("location"),
    `https://ceetool.com/pay/${invoice.token}/result`,
  );
  assert.equal((await f.api(`/invoices/${invoice.token}`)).data.state, "paid");
  const unpaid = await f.invoice(),
    unpaidCheckout = await f.prepare(unpaid);
  await f.api(`/return/${unpaidCheckout.attemptToken}`, {
    method: "POST",
    form: { resultCode: "9999" },
    origin: null,
  });
  assert.equal(
    (await f.api(`/invoices/${unpaid.token}`)).data.state,
    "pending",
  );
  assert.equal(f.calls(), 1);
});

test("verified notifications reconcile timeouts, reject forgery, and do not resurrect cancellation review", async (t) => {
  const f = await fixture(t, {
    approve: async () => {
      throw new Error("simulated-timeout");
    },
  });
  const invoice = await f.invoice(),
    checkout = await f.prepare(invoice),
    auth = f.auth(checkout);
  await f.api(`/approve/${checkout.attemptToken}`, {
    method: "POST",
    body: auth,
  });
  const good = f.notify(checkout, auth);
  for (const invalid of [
    { ...good, hashStr: "0".repeat(64) },
    { ...good, amt: "1" },
    { ...good, tid: "wrong" },
  ]) {
    assert.equal(
      (
        await f.api(`/notify/${checkout.attemptToken}`, {
          method: "POST",
          form: invalid,
          origin: null,
        })
      ).status,
      400,
    );
  }
  const notify = (form) =>
    f.api(`/notify/${checkout.attemptToken}`, {
      method: "POST",
      form,
      origin: null,
    });
  assert.equal((await notify(good)).status, 200);
  assert.equal((await f.api(`/invoices/${invoice.token}`)).data.state, "paid");
  await notify(good);
  assert.equal((await f.api(`/invoices/${invoice.token}`)).data.state, "paid");
  assert.equal(
    f.db.prepare("SELECT COUNT(*) AS count FROM notifications").get().count,
    1,
  );
  const cancelled = f.notify(checkout, auth, {
    resultCd: "2001",
    ediDate: "20990101000000",
  });
  await notify(cancelled);
  assert.equal(
    (await f.api(`/invoices/${invoice.token}`)).data.state,
    "review",
  );
  await notify(f.notify(checkout, auth, { ediDate: "20990101000001" }));
  assert.equal(
    (await f.api(`/invoices/${invoice.token}`)).data.state,
    "review",
  );
});

test("ambiguous 0000 notification is not mistaken for an approval or refund", async (t) => {
  const f = await fixture(t);
  const invoice = await f.invoice(),
    checkout = await f.prepare(invoice),
    auth = f.auth(checkout);
  await f.api(`/approve/${checkout.attemptToken}`, {
    method: "POST",
    body: auth,
  });
  const result = await f.api(`/notify/${checkout.attemptToken}`, {
    method: "POST",
    form: f.notify(checkout, auth, { resultCd: "0000" }),
    origin: null,
  });
  assert.equal(result.status, 200);
  assert.equal(
    (await f.api(`/invoices/${invoice.token}`)).data.state,
    "review",
  );
});

test("customer review messages do not expose internal provider instructions", async (t) => {
  const f = await fixture(t);
  const invoice = await f.invoice(),
    checkout = await f.prepare(invoice),
    auth = f.auth(checkout);
  await f.api(`/approve/${checkout.attemptToken}`, {
    method: "POST",
    body: auth,
  });
  await f.api(`/notify/${checkout.attemptToken}`, {
    method: "POST",
    form: f.notify(checkout, auth, { resultCd: "0000" }),
    origin: null,
  });
  const customer = (await f.api(`/invoices/${invoice.token}`)).data;
  assert.equal(customer.state, "review");
  assert.equal(
    customer.note,
    "결제 상태를 확인하고 있습니다. 다시 결제하지 말고 담당자에게 문의해 주세요.",
  );
  assert.doesNotMatch(customer.note, /PaySM|PG|관리자|서버 통지/i);
  const admin = await f.login();
  const history = await f.api("/admin/invoices", admin);
  assert.match(JSON.stringify(history.data), /PaySM 관리자/);
  assert.equal(f.calls(), 1);
});

test("SQLite survives reopen and removes personal data according to declared retention", () => {
  const directory = mkdtempSync(join(tmpdir(), "ceetool-payments-test-"));
  try {
    const path = join(directory, "payments.sqlite");
    let db = openDatabase(path);
    const now = Date.now();
    db.prepare(
      `INSERT INTO invoices
      (token,order_no,title,amount,tax_type,terms,expires_at,created_at,buyer_name,buyer_phone)
      VALUES (?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      "retention-token",
      "retention-order",
      "계약금",
      100,
      "taxable",
      "계약",
      now - 31 * 86400000,
      now - 32 * 86400000,
      "고객",
      "01012345678",
    );
    db.close();
    db = openDatabase(path);
    assert.equal(db.prepare("SELECT amount FROM invoices").get().amount, 100);
    const backup = backupDatabase(path, join(directory, "backups"));
    const snapshot = openDatabase(backup);
    assert.equal(
      snapshot.prepare("SELECT amount FROM invoices").get().amount,
      100,
    );
    snapshot.close();
    purgePersonalData(db, now);
    assert.equal(
      db.prepare("SELECT buyer_name FROM invoices").get().buyer_name,
      null,
    );
    assert.equal(
      db.prepare("SELECT buyer_phone FROM invoices").get().buyer_phone,
      null,
    );
    db.prepare("UPDATE invoices SET state = 'processing'").run();
    recoverInterruptedApprovals(db);
    assert.equal(
      db.prepare("SELECT state FROM invoices").get().state,
      "review",
    );
    db.close();
    assert.equal(digest("session").length, 64);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("verified notification before a failed approval response is not downgraded", async (t) => {
  let release, started;
  const inFlight = new Promise((resolve) => {
    started = resolve;
  });
  const f = await fixture(t, {
    approve: () => {
      started();
      return new Promise((resolve, reject) => {
        release = () => reject(new Error("simulated-timeout"));
      });
    },
  });
  const invoice = await f.invoice(),
    checkout = await f.prepare(invoice),
    auth = f.auth(checkout);
  const approval = f.api(`/approve/${checkout.attemptToken}`, {
    method: "POST",
    body: auth,
  });
  await inFlight;
  await f.api(`/notify/${checkout.attemptToken}`, {
    method: "POST",
    form: f.notify(checkout, auth),
    origin: null,
  });
  release();
  assert.equal((await approval).data.state, "paid");
  assert.equal(f.calls(), 1);
});

test("an administrator can expire only an unpaid invoice and stale authentication cannot charge it", async (t) => {
  const f = await fixture(t);
  const admin = await f.login(),
    invoice = await f.invoice(),
    checkout = await f.prepare(invoice);
  assert.equal(
    (
      await f.api(`/admin/invoices/${invoice.token}/expire`, {
        method: "POST",
        cookie: admin.cookie,
      })
    ).status,
    403,
  );
  const expired = await f.api(`/admin/invoices/${invoice.token}/expire`, {
    method: "POST",
    ...admin,
  });
  assert.equal(expired.data.state, "expired");
  assert.equal(
    (
      await f.api(`/approve/${checkout.attemptToken}`, {
        method: "POST",
        body: f.auth(checkout),
      })
    ).status,
    409,
  );
  assert.equal(f.calls(), 0);
  const paidInvoice = await f.invoice(),
    paidCheckout = await f.prepare(paidInvoice);
  await f.api(`/approve/${paidCheckout.attemptToken}`, {
    method: "POST",
    body: f.auth(paidCheckout),
  });
  assert.equal(
    (
      await f.api(`/admin/invoices/${paidInvoice.token}/expire`, {
        method: "POST",
        ...admin,
      })
    ).status,
    409,
  );
});

test("production administrator cookies are host-only, HttpOnly, Secure and SameSite=Lax", async (t) => {
  const f = await fixture(t, { env: { NODE_ENV: "production" } });
  const login = await f.login();
  const cookie = login.response.headers
    .getSetCookie()
    .find((value) => value.startsWith("__Host-ceetool_admin="));
  assert.ok(cookie);
  for (const attribute of ["HttpOnly", "Secure", "SameSite=Lax", "Path=/"])
    assert.ok(cookie.includes(attribute));
  assert.ok(!cookie.includes("Domain="));
});
