import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createPaymentApp } from "../src/app.mjs";
import { loadConfig, PUBLIC_SITE_URL } from "../src/config.mjs";
import {
  digest,
  openDatabase,
  purgePersonalData,
  recoverInterruptedApprovals,
} from "../src/database.mjs";
import { createPaysm, ediDate, makeHash } from "../src/paysm.mjs";
import { reconcileReviews } from "../src/reconcile.mjs";
import { createEmailWorker, emailStatus } from "../src/email.mjs";
import { createTestDatabase } from "./mysql-helper.mjs";

const environment = {
  PAYSM_MID: "TESTMID001",
  PAYSM_MERCHANT_KEY: "unit-test-only-not-a-real-key",
  GOOGLE_CLIENT_ID: "unit-test-client",
  GOOGLE_CLIENT_SECRET: "unit-test-secret",
  ADMIN_GOOGLE_EMAILS: "owner@example.invalid",
};
async function fixture(t, options = {}) {
  const config = loadConfig({ ...environment, ...options.env });
  const db = await createTestDatabase(t);
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
    await db.close();
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
  async function invoice(overrides = {}, existingAdmin) {
    const admin = existingAdmin || (await login());
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

test("homepage settings persist through real MySQL with authenticated writes and conflict protection", async (t) => {
  const f = await fixture(t);
  const admin = await f.login();
  const content = {
    categories: [
      {
        id: "payment",
        title: "결제 시스템",
        tagline: "결제 연동",
        icon: "payment",
        visible: true,
        featured: false,
        features: ["카드·해외 결제"],
        slides: [
          {
            label: "카드 결제",
            project: {
              name: "C9Pro",
              description: "카드·USDT·PayPal·멤버십 연동",
              url: "https://c9-pro.com/",
            },
          },
          {
            label: "플러그인",
            project: {
              name: "ForYouPay",
              description: "우커머스 통합결제 플러그인",
            },
          },
        ],
      },
    ],
  };
  assert.equal((await f.api("/admin/homepage")).status, 401);
  assert.equal(
    (
      await f.api("/admin/homepage", {
        method: "PUT",
        cookie: admin.cookie,
        body: { content, revision: null },
      })
    ).status,
    403,
  );
  const saved = await f.api("/admin/homepage", {
    method: "PUT",
    ...admin,
    body: { content, revision: null },
  });
  assert.equal(saved.status, 200);
  assert.deepEqual((await f.api("/homepage")).data.content, content);
  assert.deepEqual(
    JSON.parse(
      (
        await f.db.get(
          "SELECT value FROM settings WHERE setting_key = 'homepage_v1'",
        )
      ).value,
    ),
    saved.data,
  );
  const concurrent = await Promise.all([
    f.api("/admin/homepage", {
      method: "PUT",
      ...admin,
      body: { content, revision: saved.data.revision },
    }),
    f.api("/admin/homepage", {
      method: "PUT",
      ...admin,
      body: { content, revision: saved.data.revision },
    }),
  ]);
  assert.deepEqual(
    concurrent.map((result) => result.status).sort(),
    [200, 409],
  );
  const latest = (await f.api("/admin/homepage", admin)).data;
  const hidden = structuredClone(content);
  hidden.categories[0].visible = false;
  assert.equal(
    (
      await f.api("/admin/homepage", {
        method: "PUT",
        ...admin,
        body: { content: hidden, revision: latest.revision },
      })
    ).status,
    200,
  );
  assert.deepEqual((await f.api("/homepage")).data.content.categories, []);
  assert.equal(
    (await f.api("/admin/homepage", admin)).data.content.categories.length,
    1,
  );
});

test("visit emails use a hashed browser cookie and an atomic exact 30-minute per-link throttle", async (t) => {
  let now = Date.now();
  t.mock.method(Date, "now", () => now);
  const f = await fixture(t);
  const invoice = await f.invoice();
  await f.api(`/invoices/${invoice.token}`);
  assert.equal((await emailStatus(f.db)).pending, 0);
  const path = `/invoices/${invoice.token}/visit`;
  assert.equal(
    (await f.api(path, { method: "POST", origin: "https://evil.invalid" }))
      .status,
    403,
  );
  assert.equal(
    (await f.api("/invoices/invalid/visit", { method: "POST" })).status,
    404,
  );
  const visit = await f.api(path, { method: "POST" });
  assert.equal(visit.status, 204);
  const setCookie = visit.response.headers.getSetCookie()[0];
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Lax/);
  assert.match(setCookie, /Max-Age=2592000/);
  const cookie = setCookie.split(";")[0];
  const visitor = cookie.slice(cookie.indexOf("=") + 1);
  assert.equal(
    (await f.db.get("SELECT visitor_hash FROM payment_visits")).visitor_hash,
    digest(visitor),
  );
  await Promise.all(
    Array.from({ length: 5 }, () => f.api(path, { method: "POST", cookie })),
  );
  assert.equal((await emailStatus(f.db)).pending, 1);
  now += 1799999;
  await f.api(path, { method: "POST", cookie });
  assert.equal((await emailStatus(f.db)).pending, 1);
  now++;
  await f.api(path, { method: "POST", cookie });
  assert.equal((await emailStatus(f.db)).pending, 2);
  await f.api(path, { method: "POST" });
  assert.equal((await emailStatus(f.db)).pending, 3);
  const other = await f.invoice();
  await Promise.all(
    Array.from({ length: 5 }, () =>
      f.api(`/invoices/${other.token}/visit`, { method: "POST", cookie }),
    ),
  );
  assert.equal((await emailStatus(f.db)).pending, 4);
  assert.equal(f.calls(), 0);
  await purgePersonalData(f.db, Date.now() + 31 * 86400000);
  assert.equal(
    (await f.db.get("SELECT COUNT(*) AS n FROM payment_visits")).n,
    0,
  );
});

test("desktop and mobile incomplete authentication alerts are attempt-scoped and never mark invoices paid", async (t) => {
  const f = await fixture(t);
  const invoice = await f.invoice();
  const checkout = await f.prepare(invoice);
  const path = `/attempts/${checkout.attemptToken}/failure`;
  assert.equal(
    (
      await f.api(path, {
        method: "POST",
        origin: "https://evil.invalid",
        body: { result: "FAIL" },
      })
    ).status,
    403,
  );
  assert.equal(
    (await f.api(path, { method: "POST", body: { result: "PAID" } })).status,
    400,
  );
  assert.equal(
    (
      await f.api("/attempts/invalid/failure", {
        method: "POST",
        body: { result: "FAIL" },
      })
    ).status,
    404,
  );
  assert.equal((await emailStatus(f.db)).pending, 0);
  assert.equal(
    (await f.api(path, { method: "POST", body: { result: "CANCEL" } })).status,
    204,
  );
  await f.api(path, { method: "POST", body: { result: "FAIL" } });
  assert.equal((await emailStatus(f.db)).pending, 1);
  assert.equal(
    (await f.api(`/invoices/${invoice.token}`)).data.state,
    "pending",
  );
  const next = await f.prepare(invoice);
  const returned = await f.api(`/return/${next.attemptToken}`, {
    method: "POST",
    origin: null,
    form: { resultCode: "9999" },
  });
  assert.equal(returned.status, 303);
  await f.api(`/return/${next.attemptToken}`, {
    method: "POST",
    origin: null,
    form: { resultCode: "9999" },
  });
  assert.equal((await emailStatus(f.db)).pending, 2);
  assert.deepEqual(
    (await f.db.all("SELECT DISTINCT kind FROM email_outbox")).map(
      (row) => row.kind,
    ),
    ["failed"],
  );
  const expired = await f.prepare(invoice);
  await f.db.run(
    "UPDATE attempts SET created_at = ? WHERE token = ?",
    Date.now() - 16 * 60000,
    expired.attemptToken,
  );
  await f.api(`/attempts/${expired.attemptToken}/failure`, {
    method: "POST",
    body: { result: "FAIL" },
  });
  assert.equal((await emailStatus(f.db)).pending, 2);
  assert.equal(f.calls(), 0);
});

test("confirmed approval and duplicate notifications produce one completion alert and separate cancellation", async (t) => {
  const f = await fixture(t);
  const invoice = await f.invoice(),
    checkout = await f.prepare(invoice),
    auth = f.auth(checkout);
  await f.api(`/approve/${checkout.attemptToken}`, {
    method: "POST",
    body: auth,
  });
  await f.api(`/approve/${checkout.attemptToken}`, {
    method: "POST",
    body: auth,
  });
  const notify = (overrides) =>
    f.api(`/notify/${checkout.attemptToken}`, {
      method: "POST",
      origin: null,
      form: f.notify(checkout, auth, overrides),
    });
  await notify({ resultCd: "0000", cancelYN: "N" });
  await notify({ resultCd: "3001" });
  await f.api(`/attempts/${checkout.attemptToken}/failure`, {
    method: "POST",
    body: { result: "FAIL" },
  });
  assert.deepEqual(
    (await f.db.all("SELECT kind FROM email_outbox")).map((row) => row.kind),
    ["paid"],
  );
  await notify({ resultCd: "0000", cancelYN: "Y" });
  await notify({ resultCd: "2001" });
  assert.deepEqual(
    (await f.db.all("SELECT kind FROM email_outbox ORDER BY id")).map(
      (row) => row.kind,
    ),
    ["paid", "cancelled"],
  );
  assert.equal(f.calls(), 1);
});

test("uncertain approval, startup recovery and receipt recovery durably enqueue correct alerts despite SES failure", async (t) => {
  const f = await fixture(t, {
    approve: async () => {
      throw new Error("timeout");
    },
  });
  const invoice = await f.invoice(),
    checkout = await f.prepare(invoice),
    auth = f.auth(checkout);
  const result = await f.api(`/approve/${checkout.attemptToken}`, {
    method: "POST",
    body: auth,
  });
  assert.equal(result.status, 200);
  assert.equal(result.data.state, "review");
  assert.equal(
    (await f.db.get("SELECT kind FROM email_outbox")).kind,
    "review",
  );
  const worker = createEmailWorker(
    f.db,
    {
      async send() {
        throw new Error("SES unavailable");
      },
    },
    { log() {}, error() {} },
  );
  await worker.run();
  assert.equal((await emailStatus(f.db)).pending, 1);
  const report = await reconcileReviews(f.db, {
    async receipt() {
      return {
        resultCd: "0000",
        TID: auth.tid,
        GOODS_AMT: "1100",
        TRX_ST_CD: "0",
      };
    },
  });
  assert.equal(report.recovered, 1);
  assert.deepEqual(
    (await f.db.all("SELECT kind FROM email_outbox ORDER BY id")).map(
      (row) => row.kind,
    ),
    ["review", "paid"],
  );
  const second = await f.invoice();
  await f.db.run(
    "UPDATE invoices SET state = 'processing' WHERE token = ?",
    second.token,
  );
  await recoverInterruptedApprovals(f.db);
  await recoverInterruptedApprovals(f.db);
  assert.equal(
    (
      await f.db.get(
        "SELECT COUNT(*) AS n FROM email_outbox WHERE kind = 'review'",
      )
    ).n,
    2,
  );
  assert.equal(f.calls(), 1);
  await worker.stop();
});

test("mail status/test/retry require admin, CSRF and same origin; retries do not resend accepted mail", async (t) => {
  const f = await fixture(t);
  assert.equal((await f.api("/admin/emails")).status, 401);
  const admin = await f.login();
  assert.equal(
    (
      await f.api("/admin/emails/test", {
        method: "POST",
        cookie: admin.cookie,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await f.api("/admin/emails/test", {
        method: "POST",
        ...admin,
        origin: "https://evil.invalid",
      })
    ).status,
    403,
  );
  const sent = await f.api("/admin/emails/test", { method: "POST", ...admin });
  assert.equal(sent.status, 202);
  assert.equal(sent.data.pending, 1);
  await f.db.run(
    "UPDATE email_outbox SET status = 'failed', attempts = 8, last_error = 'AccessDeniedException'",
  );
  assert.equal((await f.api("/admin/emails", admin)).data.failed, 1);
  assert.equal(
    (await f.api("/admin/emails/retry", { method: "POST", ...admin })).status,
    202,
  );
  const row = await f.db.get("SELECT * FROM email_outbox");
  assert.equal(row.status, "pending");
  assert.equal(row.attempts, 0);
  assert.equal(row.last_error, null);
  await f.db.run(
    "UPDATE email_outbox SET status = 'sent', sent_at = ?",
    Date.now(),
  );
  await f.api("/admin/emails/retry", { method: "POST", ...admin });
  assert.equal((await f.api("/admin/emails", admin)).data.sent, 1);
  for (let i = 0; i < 3; i++)
    assert.equal(
      (await f.api("/admin/emails/test", { method: "POST", ...admin })).status,
      202,
    );
  assert.equal(
    (await f.api("/admin/emails/test", { method: "POST", ...admin })).status,
    429,
  );
  assert.equal(f.calls(), 0);
});

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

test("receipt lookup uses only a bounded read-only GET to the fixed provider", async () => {
  const sent = [];
  const provider = createPaysm(
    loadConfig(environment),
    async (url, options) => {
      sent.push({ url, options });
      return new Response('{"resultCd":"0000","TRX_ST_CD":"0"}');
    },
  );
  assert.equal((await provider.receipt("TESTMID001 &tid")).TRX_ST_CD, "0");
  assert.equal(sent.length, 1);
  const url = new URL(sent[0].url);
  assert.equal(url.origin, "https://api.skyclassism.com");
  assert.equal(url.pathname, "/receipt.do");
  assert.equal(url.searchParams.get("tid"), "TESTMID001 &tid");
  assert.equal(url.searchParams.get("mid"), environment.PAYSM_MID);
  assert.equal(sent[0].options.method, "GET");
  assert.equal(sent[0].options.redirect, "error");
  assert.ok(sent[0].options.signal);
  assert.equal(sent[0].options.body, undefined);
  assert.ok(!sent[0].url.includes(environment.PAYSM_MERCHANT_KEY));
  for (const response of [
    new Response("{}", { status: 500 }),
    new Response("[]"),
    new Response("null"),
    new Response("not-json"),
  ]) {
    await assert.rejects(
      createPaysm(loadConfig(environment), async () => response).receipt("tid"),
    );
  }
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
        /^https:\/\/ceetool\.com\/admin\?error=google_login$/,
      );
      assert.equal(
        (await f.db.get("SELECT COUNT(*) AS count FROM sessions")).count,
        0,
      );
    });
  }
  const f = await fixture(t);
  const badState = await f.api("/admin/callback?state=bad&code=test");
  assert.match(
    badState.response.headers.get("location"),
    /^https:\/\/ceetool\.com\/admin\?error=google_login$/,
  );
  const login = await f.login();
  assert.equal(
    login.response.headers.get("location"),
    `${PUBLIC_SITE_URL}/admin`,
  );
  assert.equal(
    (await f.db.get("SELECT COUNT(*) AS count FROM oauth_states")).count,
    0,
  );
  const again = await f.api(`/admin/callback?state=${login.state}&code=test`, {
    cookie: login.cookie,
  });
  assert.equal(
    again.response.headers.get("location"),
    `${PUBLIC_SITE_URL}/admin?error=google_login`,
  );
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
    { terms: null },
    { terms: "a".repeat(2001) },
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

test("optional terms and customer prefill are validated, consented and hidden after checkout", async (t) => {
  const f = await fixture(t);
  const admin = await f.login();
  const invoice = await f.invoice(
    {
      terms: "",
      buyerName: " 주문자 ",
      buyerPhone: "010-1234-5678",
    },
    admin,
  );
  assert.equal(invoice.terms, "");
  assert.equal(invoice.buyerName, "주문자");
  const prefilled = (await f.api(`/invoices/${invoice.token}`)).data;
  assert.equal(prefilled.buyerName, "주문자");
  assert.equal(prefilled.buyerPhone, "01012345678");
  assert.equal(prefilled.tid, undefined);
  const checkout = await f.prepare(invoice);
  const publicAfterConsent = (await f.api(`/invoices/${invoice.token}`)).data;
  assert.equal(publicAfterConsent.buyerName, undefined);
  await f.api(`/approve/${checkout.attemptToken}`, {
    method: "POST",
    body: f.auth(checkout),
  });
  const paid = (await f.api(`/invoices/${invoice.token}`)).data;
  assert.equal(paid.state, "paid");
  assert.equal(paid.buyerName, undefined);
  assert.equal(paid.buyerPhone, undefined);
  const expired = await f.invoice({ terms: "", buyerName: "숨길 이름" }, admin);
  await f.db.run(
    "UPDATE invoices SET expires_at = 1 WHERE token = ?",
    expired.token,
  );
  assert.equal(
    (await f.api(`/invoices/${expired.token}`)).data.buyerName,
    undefined,
  );
  const phoneOnly = await f.invoice({ buyerPhone: "01012345678" }, admin);
  await f.db.run(
    "UPDATE invoices SET expires_at = 1 WHERE token = ?",
    phoneOnly.token,
  );
  await purgePersonalData(f.db);
  assert.equal(
    (
      await f.db.get(
        "SELECT buyer_phone FROM invoices WHERE token = ?",
        phoneOnly.token,
      )
    ).buyer_phone,
    null,
  );
  for (const invalid of [
    { buyerName: "a".repeat(51) },
    { buyerName: null },
    { buyerPhone: "bad" },
    { buyerPhone: 12345 },
  ]) {
    assert.equal(
      (
        await f.api("/admin/invoices", {
          method: "POST",
          ...admin,
          body: {
            title: "항목",
            amount: 1000,
            taxType: "taxable",
            expiresAt: Date.now() + 60000,
            ...invalid,
          },
        })
      ).status,
      400,
    );
  }
});

test("default terms are admin-only, explicitly saved and never rewrite issued invoice terms", async (t) => {
  const f = await fixture(t);
  const admin = await f.login();
  assert.equal((await f.api("/admin/settings")).status, 401);
  assert.deepEqual((await f.api("/admin/settings", admin)).data, {
    defaultTerms: "",
  });
  for (const options of [
    { cookie: admin.cookie },
    { ...admin, origin: "https://attacker.invalid" },
  ]) {
    assert.equal(
      (
        await f.api("/admin/settings", {
          method: "PUT",
          ...options,
          body: { defaultTerms: "문구" },
        })
      ).status,
      403,
    );
  }
  assert.equal(
    (
      await f.api("/admin/settings", {
        method: "PUT",
        ...admin,
        body: { defaultTerms: "a".repeat(2001) },
      })
    ).status,
    400,
  );
  const original = await f.invoice({ terms: "기존 계약" }, admin);
  assert.equal(
    (
      await f.api("/admin/settings", {
        method: "PUT",
        ...admin,
        body: { defaultTerms: "  저장된 문구  " },
      })
    ).status,
    200,
  );
  assert.equal(
    (await f.api("/admin/settings", admin)).data.defaultTerms,
    "저장된 문구",
  );
  assert.equal(
    (await f.api(`/invoices/${original.token}`)).data.terms,
    "기존 계약",
  );
  const blank = await f.invoice({ terms: "" }, admin);
  assert.equal(blank.terms, "");
  await f.api("/admin/settings", {
    method: "PUT",
    ...admin,
    body: { defaultTerms: "" },
  });
  assert.equal((await f.api("/admin/settings", admin)).data.defaultTerms, "");
});

test("history is server-paginated by twenty with literal search and derived expiry filters", async (t) => {
  const f = await fixture(t);
  const admin = await f.login();
  const insert = `INSERT INTO invoices
    (token, order_no, title, amount, tax_type, terms, expires_at, created_at, buyer_name, buyer_phone)
    VALUES (?, ?, ?, 1000, 'taxable', '', ?, ?, ?, ?)`;
  const now = Date.now();
  for (let i = 0; i < 42; i++) {
    await f.db.run(
      insert,
      `history-${i}`,
      `ORDER-${i}`,
      i === 0 ? "특수 %_" : `프로젝트 ${i}`,
      i === 0 ? 1 : now + 86400000,
      now + i,
      `고객 ${i}`,
      "01012345678",
    );
  }
  const first = (await f.api("/admin/invoices", admin)).data;
  assert.equal(first.invoices.length, 20);
  assert.equal(first.hasMore, true);
  assert.equal(first.invoices[0].orderNo, "ORDER-41");
  const second = (await f.api("/admin/invoices?page=1", admin)).data;
  assert.equal(second.invoices.length, 20);
  assert.ok(
    !second.invoices.some((invoice) =>
      first.invoices.some((other) => other.token === invoice.token),
    ),
  );
  const last = (await f.api("/admin/invoices?page=2", admin)).data;
  assert.equal(last.invoices.length, 2);
  assert.equal(last.hasMore, false);
  for (const q of ["ORDER-41", "고객 41", "프로젝트 41"]) {
    const result = (
      await f.api(`/admin/invoices?q=${encodeURIComponent(q)}`, admin)
    ).data;
    assert.equal(result.invoices.length, 1);
    assert.equal(result.invoices[0].orderNo, "ORDER-41");
  }
  const literal = (await f.api("/admin/invoices?q=%25_", admin)).data;
  assert.equal(literal.invoices.length, 1);
  assert.equal(literal.invoices[0].orderNo, "ORDER-0");
  const expired = (await f.api("/admin/invoices?state=expired", admin)).data;
  assert.equal(expired.invoices.length, 1);
  assert.equal(expired.invoices[0].state, "expired");
  assert.ok(
    (await f.api("/admin/invoices?state=pending", admin)).data.invoices.every(
      (invoice) => invoice.state === "pending",
    ),
  );
  assert.equal(
    (await f.api("/admin/invoices?state=paid", admin)).data.invoices.length,
    0,
  );
  assert.equal(
    (await f.api("/admin/invoices?state=invalid", admin)).status,
    400,
  );
  assert.equal(
    (await f.api(`/admin/invoices?q=${"a".repeat(101)}`, admin)).status,
    400,
  );
});

test("saved default terms survive reopening the MySQL connection pool", async (t) => {
  let db = await createTestDatabase(t);
  const config = db.config;
  try {
    await db.run(
      "INSERT INTO settings (setting_key, value) VALUES ('default_terms', ?)",
      "저장된 기본 조건",
    );
    await db.close();
    db = await openDatabase(config);
    assert.equal(
      (
        await db.get(
          "SELECT value FROM settings WHERE setting_key = 'default_terms'",
        )
      ).value,
      "저장된 기본 조건",
    );
  } finally {
    await db.close();
  }
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
  await f.db.run(
    "UPDATE invoices SET expires_at = 1 WHERE token = ?",
    invoice.token,
  );
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
    (await f.db.get("SELECT COUNT(*) AS count FROM notifications")).count,
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

test("0000 approval notifications use cancelYN, deduplicate and cannot resurrect cancellation", async (t) => {
  const f = await fixture(t);
  const invoice = await f.invoice(),
    checkout = await f.prepare(invoice),
    auth = f.auth(checkout);
  await f.api(`/approve/${checkout.attemptToken}`, {
    method: "POST",
    body: auth,
  });
  const paidAt = (await f.api(`/invoices/${invoice.token}`)).data.paidAt;
  const notify = (form) =>
    f.api(`/notify/${checkout.attemptToken}`, {
      method: "POST",
      form,
      origin: null,
    });
  const approved = f.notify(checkout, auth, {
    resultCd: "0000",
    cancelYN: "N",
  });
  assert.equal((await notify(approved)).status, 200);
  assert.equal((await notify(approved)).status, 200);
  let current = (await f.api(`/invoices/${invoice.token}`)).data;
  assert.equal(current.state, "paid");
  assert.equal(current.paidAt, paidAt);
  assert.equal(
    (await f.db.get("SELECT COUNT(*) AS n FROM notifications")).n,
    1,
  );
  await notify({ ...approved, cancelYN: "Y" });
  assert.equal(
    (await f.api(`/invoices/${invoice.token}`)).data.state,
    "review",
  );
  assert.equal(
    (await f.db.get("SELECT COUNT(*) AS n FROM notifications")).n,
    2,
  );
  await notify({
    ...approved,
    ediDate: "20990101000000",
    hashStr: makeHash(
      auth.mid,
      "20990101000000",
      auth.goodsAmt,
      environment.PAYSM_MERCHANT_KEY,
    ),
  });
  current = (await f.api(`/invoices/${invoice.token}`)).data;
  assert.equal(current.state, "review");
  assert.equal(f.calls(), 1);
});

test("0000 notifications arriving before approval returns preserve the final transaction state", async (t) => {
  for (const cancelYN of ["N", "Y"]) {
    await t.test(cancelYN, async (t) => {
      let started, release;
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
                amt: auth.goodsAmt,
                tid: auth.tid,
              });
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
      const notification = await f.api(`/notify/${checkout.attemptToken}`, {
        method: "POST",
        form: f.notify(checkout, auth, { resultCd: "0000", cancelYN }),
        origin: null,
      });
      release();
      assert.equal(notification.status, 200);
      assert.equal(
        (await approval).data.state,
        cancelYN === "N" ? "paid" : "review",
      );
      assert.equal(f.calls(), 1);
    });
  }
});

test("contradictory cancellation flags cannot be followed by automatic reapproval", async (t) => {
  const f = await fixture(t);
  const invoice = await f.invoice(),
    checkout = await f.prepare(invoice),
    auth = f.auth(checkout);
  await f.api(`/approve/${checkout.attemptToken}`, {
    method: "POST",
    body: auth,
  });
  for (const fields of [
    { resultCd: "3001", cancelYN: "Y" },
    { resultCd: "0000", cancelYN: "N", ediDate: "20990101000000" },
  ]) {
    await f.api(`/notify/${checkout.attemptToken}`, {
      method: "POST",
      form: f.notify(checkout, auth, fields),
      origin: null,
    });
    assert.equal(
      (await f.api(`/invoices/${invoice.token}`)).data.state,
      "review",
    );
  }
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

test("receipt reconciliation repairs only matching approved review transactions without charging", async (t) => {
  const cases = [
    { name: "approved", changes: {}, recovered: true },
    {
      name: "numeric status",
      changes: { TRX_ST_CD: 0, GOODS_AMT: 1100 },
      recovered: true,
    },
    { name: "cancelled", changes: { TRX_ST_CD: "1" } },
    { name: "post-cancelled", changes: { TRX_ST_CD: "2" } },
    { name: "wrong amount", changes: { GOODS_AMT: "1" } },
    { name: "wrong transaction", changes: { TID: "wrong" } },
    { name: "wrong order", changes: { ORD_NO: "wrong" } },
    { name: "lookup failure", changes: { resultCd: "1004" } },
    { name: "missing status", changes: { TRX_ST_CD: undefined } },
    { name: "timeout", fails: true },
    { name: "concurrent cancellation", cancel: true },
  ];
  for (const entry of cases) {
    await t.test(entry.name, async (t) => {
      const f = await fixture(t);
      const invoice = await f.invoice(),
        checkout = await f.prepare(invoice),
        auth = f.auth(checkout);
      await f.api(`/approve/${checkout.attemptToken}`, {
        method: "POST",
        body: auth,
      });
      const paidAt = (await f.api(`/invoices/${invoice.token}`)).data.paidAt;
      await f.api(`/notify/${checkout.attemptToken}`, {
        method: "POST",
        form: f.notify(checkout, auth, { resultCd: "0000" }),
        origin: null,
      });
      let lookups = 0;
      const provider = {
        receipt: async (tid) => {
          lookups++;
          assert.equal(tid, auth.tid);
          if (entry.fails) throw new Error("simulated-timeout");
          if (entry.cancel) {
            await f.api(`/notify/${checkout.attemptToken}`, {
              method: "POST",
              form: f.notify(checkout, auth, {
                resultCd: "0000",
                cancelYN: "Y",
              }),
              origin: null,
            });
          }
          return {
            resultCd: "0000",
            TID: auth.tid,
            ORD_NO: invoice.orderNo,
            GOODS_AMT: "1100",
            TRX_ST_CD: "0",
            ...entry.changes,
          };
        },
      };
      const logs = [];
      const report = await reconcileReviews(f.db, provider, {
        error: (message) => logs.push(message),
      });
      const current = (await f.api(`/invoices/${invoice.token}`)).data;
      assert.equal(current.state, entry.recovered ? "paid" : "review");
      assert.equal(report.checked, 1);
      assert.equal(report.recovered, entry.recovered ? 1 : 0);
      assert.equal(report.unresolved, entry.recovered ? 0 : 1);
      assert.equal(logs.length, entry.recovered ? 0 : 1);
      assert.equal(current.paidAt, paidAt);
      assert.equal(lookups, 1);
      assert.equal(f.calls(), 1);
      if (entry.recovered) {
        assert.equal(current.note, "");
        assert.equal((await reconcileReviews(f.db, provider)).checked, 0);
      }
    });
  }
});

test("receipt reconciliation limits each batch to five and never touches unpaid invoices", async (t) => {
  const f = await fixture(t);
  const admin = await f.login();
  const pending = await f.invoice({}, admin);
  for (let i = 0; i < 6; i++) {
    const invoice = await f.invoice({}, admin),
      checkout = await f.prepare(invoice),
      auth = f.auth(checkout, `${environment.PAYSM_MID}-transaction-${i}`);
    await f.api(`/approve/${checkout.attemptToken}`, {
      method: "POST",
      body: auth,
    });
    await f.api(`/notify/${checkout.attemptToken}`, {
      method: "POST",
      form: f.notify(checkout, auth, { resultCd: "0000" }),
      origin: null,
    });
  }
  let calls = 0;
  const report = await reconcileReviews(f.db, {
    receipt: async (tid) => {
      calls++;
      return { resultCd: "0000", TID: tid, GOODS_AMT: "1100", TRX_ST_CD: "0" };
    },
  });
  assert.deepEqual(report, {
    checked: 5,
    recovered: 5,
    unresolved: 0,
    remaining: 1,
  });
  assert.equal(calls, 5);
  assert.equal(
    (await f.api(`/invoices/${pending.token}`)).data.state,
    "pending",
  );
});

test("MySQL survives reconnect and retains personal data correctly", async (t) => {
  let db = await createTestDatabase(t);
  try {
    const config = db.config;
    const now = Date.now();
    await db.run(
      `INSERT INTO invoices
      (token,order_no,title,amount,tax_type,terms,expires_at,created_at,buyer_name,buyer_phone)
      VALUES (?,?,?,?,?,?,?,?,?,?)`,
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
    await db.close();
    db = await openDatabase(config);
    assert.equal((await db.get("SELECT amount FROM invoices")).amount, 100);
    await purgePersonalData(db, now);
    assert.equal(
      (await db.get("SELECT buyer_name FROM invoices")).buyer_name,
      null,
    );
    assert.equal(
      (await db.get("SELECT buyer_phone FROM invoices")).buyer_phone,
      null,
    );
    await db.run("UPDATE invoices SET state = 'processing'");
    await recoverInterruptedApprovals(db);
    assert.equal((await db.get("SELECT state FROM invoices")).state, "review");
    assert.equal(digest("session").length, 64);
  } finally {
    await db.close();
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
