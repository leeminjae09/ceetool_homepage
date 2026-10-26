import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { OAuth2Client } from "google-auth-library";
import { createHash } from "node:crypto";
import {
  API_PATH,
  GOOGLE_CALLBACK,
  PAYSM_BASE_URL,
  PUBLIC_SITE_URL,
  googleReady,
  paymentReady,
} from "./config.mjs";
import { digest, invoiceView, token } from "./database.mjs";
import {
  createPaysm,
  ediDate,
  equalSecret,
  initialFields,
  makeHash,
} from "./paysm.mjs";

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const requireValue = (condition, status, message) => {
  if (!condition) throw new HttpError(status, message);
};
const object = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value, max) =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max;
const validToken = (value) =>
  typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
function normalizePhone(value) {
  requireValue(
    typeof value === "string" && /^[+\d\s-]{8,24}$/.test(value),
    400,
    "연락처를 확인해 주세요.",
  );
  const phone = value.replace(/[+\s-]/g, "");
  requireValue(/^\d{8,15}$/.test(phone), 400, "연락처를 확인해 주세요.");
  return phone;
}
const cookieValue = (req, name) =>
  (req.headers.cookie || "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);

function transaction(db, fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function googleClient(config) {
  const client = new OAuth2Client(
    config.googleClientId,
    config.googleClientSecret,
    GOOGLE_CALLBACK,
  );
  return {
    authorizationUrl(state, verifier, nonce) {
      return client.generateAuthUrl({
        scope: ["openid", "email"],
        access_type: "online",
        state,
        nonce,
        code_challenge: createHash("sha256")
          .update(verifier)
          .digest("base64url"),
        code_challenge_method: "S256",
      });
    },
    async exchange(code, verifier) {
      const { tokens } = await client.getToken({
        code,
        codeVerifier: verifier,
      });
      requireValue(
        typeof tokens.id_token === "string",
        401,
        "Google 인증에 실패했습니다.",
      );
      const ticket = await client.verifyIdToken({
        idToken: tokens.id_token,
        audience: config.googleClientId,
      });
      return ticket.getPayload();
    },
  };
}

export function createPaymentApp({
  db,
  config,
  provider = createPaysm(config),
  google = googleClient(config),
  logger = console,
}) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", "loopback");
  app.use(helmet());
  app.use((req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Referrer-Policy", "no-referrer");
    next();
  });
  app.use(express.json({ limit: "64kb", strict: true }));
  app.use(
    express.urlencoded({ extended: false, limit: "64kb", parameterLimit: 50 }),
  );
  app.use(
    rateLimit({
      windowMs: 60000,
      limit: 120,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { error: "요청이 많습니다. 잠시 후 다시 시도해 주세요." },
    }),
  );
  const cookieName = config.production
    ? "__Host-ceetool_admin"
    : "ceetool_admin";
  const stateCookie = config.production
    ? "__Host-ceetool_oauth"
    : "ceetool_oauth";
  const cookieOptions = {
    httpOnly: true,
    secure: config.production,
    sameSite: "lax",
    path: "/",
  };
  const log = (event, reason) =>
    logger.error(JSON.stringify({ event, reason }));
  const getInvoice = (value) => {
    requireValue(validToken(value), 404, "결제 링크를 찾을 수 없습니다.");
    const invoice = db
      .prepare("SELECT * FROM invoices WHERE token = ?")
      .get(value);
    requireValue(invoice, 404, "결제 링크를 찾을 수 없습니다.");
    return invoice;
  };
  const getAttempt = (value) => {
    requireValue(validToken(value), 404, "결제 요청을 찾을 수 없습니다.");
    const attempt = db
      .prepare("SELECT * FROM attempts WHERE token = ?")
      .get(value);
    requireValue(attempt, 404, "결제 요청을 찾을 수 없습니다.");
    return attempt;
  };
  function sameOrigin(req, res, next) {
    const allowed = [PUBLIC_SITE_URL];
    if (!config.production)
      allowed.push(
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:4173",
      );
    requireValue(
      allowed.includes(req.headers.origin),
      403,
      "허용되지 않은 요청입니다.",
    );
    next();
  }
  function admin(req, res, next) {
    requireValue(
      googleReady(config),
      503,
      "관리자 Google 로그인이 아직 설정되지 않았습니다.",
    );
    const secret = cookieValue(req, cookieName);
    const session = validToken(secret)
      ? db
          .prepare("SELECT * FROM sessions WHERE hash = ? AND expires_at > ?")
          .get(digest(secret), Date.now())
      : undefined;
    requireValue(
      session && config.adminEmails.includes(session.email),
      401,
      "관리자 로그인이 필요합니다.",
    );
    req.adminSession = session;
    next();
  }
  function csrf(req, res, next) {
    requireValue(
      equalSecret(req.headers["x-csrf-token"], req.adminSession.csrf),
      403,
      "인증 정보가 만료되었습니다. 다시 로그인해 주세요.",
    );
    next();
  }
  function ready() {
    requireValue(
      paymentReady(config),
      503,
      "결제 서비스가 아직 설정되지 않았습니다. 담당자에게 문의해 주세요.",
    );
  }

  app.get(`${API_PATH}/health`, (req, res) => {
    db.prepare("SELECT 1").get();
    res.json({
      ok: true,
      paymentConfigured: paymentReady(config),
      adminConfigured: googleReady(config),
    });
  });

  const loginLimiter = rateLimit({
    windowMs: 60000,
    limit: 10,
    legacyHeaders: false,
    message: { error: "로그인 요청이 많습니다. 잠시 후 다시 시도해 주세요." },
  });
  app.get(`${API_PATH}/admin/login`, loginLimiter, (req, res) => {
    requireValue(
      googleReady(config),
      503,
      "관리자 Google 로그인이 아직 설정되지 않았습니다.",
    );
    const state = token(),
      verifier = token(),
      nonce = token(),
      now = Date.now();
    db.prepare("DELETE FROM oauth_states WHERE expires_at <= ?").run(now);
    db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now);
    db.prepare("INSERT INTO oauth_states VALUES (?, ?, ?, ?)").run(
      digest(state),
      verifier,
      nonce,
      now + 600000,
    );
    res.cookie(stateCookie, state, { ...cookieOptions, maxAge: 600000 });
    res.redirect(google.authorizationUrl(state, verifier, nonce));
  });
  app.get(`${API_PATH}/admin/callback`, loginLimiter, async (req, res) => {
    try {
      requireValue(googleReady(config), 503, "Google login is not configured");
      const { state, code } = req.query;
      requireValue(
        validToken(state) &&
          equalSecret(state, cookieValue(req, stateCookie)) &&
          text(code, 4096),
        401,
        "Invalid OAuth state",
      );
      const saved = db
        .prepare(
          "DELETE FROM oauth_states WHERE hash = ? AND expires_at > ? RETURNING *",
        )
        .get(digest(state), Date.now());
      requireValue(saved, 401, "Expired OAuth state");
      const claims = await google.exchange(code, saved.verifier);
      const email =
        typeof claims?.email === "string" ? claims.email.toLowerCase() : "";
      requireValue(
        claims?.email_verified === true &&
          equalSecret(claims.nonce, saved.nonce) &&
          config.adminEmails.includes(email),
        403,
        "Google account is not allowed",
      );
      const secret = token(),
        csrfToken = token();
      db.prepare("INSERT INTO sessions VALUES (?, ?, ?, ?)").run(
        digest(secret),
        email,
        csrfToken,
        Date.now() + 8 * 3600000,
      );
      res.cookie(cookieName, secret, { ...cookieOptions, maxAge: 8 * 3600000 });
      res.clearCookie(stateCookie, cookieOptions);
      res.redirect(303, `${PUBLIC_SITE_URL}/admin/payments`);
    } catch (error) {
      log(
        "google_login_failed",
        error instanceof HttpError ? error.message : "provider_error",
      );
      res.clearCookie(stateCookie, cookieOptions);
      res.redirect(303, `${PUBLIC_SITE_URL}/admin/payments?error=google_login`);
    }
  });
  app.get(`${API_PATH}/admin/session`, admin, (req, res) =>
    res.json({
      email: req.adminSession.email,
      csrfToken: req.adminSession.csrf,
      paymentConfigured: paymentReady(config),
    }),
  );
  app.post(`${API_PATH}/admin/logout`, sameOrigin, admin, csrf, (req, res) => {
    db.prepare("DELETE FROM sessions WHERE hash = ?").run(
      req.adminSession.hash,
    );
    res.clearCookie(cookieName, cookieOptions);
    res.status(204).end();
  });
  app.get(`${API_PATH}/admin/invoices`, admin, (req, res) => {
    const page = req.query.page === undefined ? 0 : Number(req.query.page);
    requireValue(
      Number.isSafeInteger(page) && page >= 0 && page <= 1000000,
      400,
      "페이지 번호가 올바르지 않습니다.",
    );
    const query = req.query.q ?? "";
    const state = req.query.state ?? "";
    requireValue(
      typeof query === "string" && query.length <= 100,
      400,
      "검색어는 100자 이내로 입력해 주세요.",
    );
    requireValue(
      typeof state === "string" &&
        ["", "pending", "expired", "processing", "paid", "review"].includes(
          state,
        ),
      400,
      "결제 상태를 확인해 주세요.",
    );
    const clauses = [];
    const values = [];
    if (query.trim()) {
      clauses.push(`(instr(lower(title), lower(?)) > 0 OR
        instr(lower(order_no), lower(?)) > 0 OR
        instr(lower(COALESCE(buyer_name, '')), lower(?)) > 0 OR
        instr(COALESCE(buyer_phone, ''), ?) > 0)`);
      values.push(...Array(4).fill(query.trim()));
    }
    if (state === "expired" || state === "pending") {
      clauses.push(
        `state = 'pending' AND expires_at ${state === "expired" ? "<=" : ">"} ?`,
      );
      values.push(Date.now());
    } else if (state) {
      clauses.push("state = ?");
      values.push(state);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = db
      .prepare(
        `SELECT * FROM invoices ${where} ORDER BY created_at DESC, token DESC LIMIT 21 OFFSET ?`,
      )
      .all(...values, page * 20);
    res.json({
      invoices: rows.slice(0, 20).map((row) => invoiceView(row, true)),
      hasMore: rows.length > 20,
    });
  });
  app.get(`${API_PATH}/admin/settings`, admin, (req, res) => {
    res.json({
      defaultTerms:
        db
          .prepare("SELECT value FROM settings WHERE key = 'default_terms'")
          .get()?.value || "",
    });
  });
  app.put(`${API_PATH}/admin/settings`, sameOrigin, admin, csrf, (req, res) => {
    requireValue(
      object(req.body) &&
        typeof req.body.defaultTerms === "string" &&
        req.body.defaultTerms.length <= 2000,
      400,
      "기본 문구는 2000자 이내로 입력해 주세요.",
    );
    const defaultTerms = req.body.defaultTerms.trim();
    db.prepare(
      "INSERT INTO settings (key, value) VALUES ('default_terms', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    ).run(defaultTerms);
    res.json({ defaultTerms });
  });
  app.post(
    `${API_PATH}/admin/invoices`,
    sameOrigin,
    admin,
    csrf,
    (req, res) => {
      ready();
      const body = req.body;
      requireValue(object(body), 400, "결제 정보를 확인해 주세요.");
      const { title, amount, taxType, expiresAt } = body;
      const terms = body.terms === undefined ? "" : body.terms;
      const buyerName = body.buyerName === undefined ? "" : body.buyerName;
      const buyerPhone = body.buyerPhone === undefined ? "" : body.buyerPhone;
      requireValue(text(title, 80), 400, "결제 항목은 1~80자로 입력해 주세요.");
      requireValue(
        Number.isSafeInteger(amount) && amount > 0,
        400,
        "결제 금액은 양의 정수(원)로 입력해 주세요.",
      );
      requireValue(
        ["taxable", "exempt"].includes(taxType),
        400,
        "과세 구분을 선택해 주세요.",
      );
      requireValue(
        typeof terms === "string" && terms.length <= 2000,
        400,
        "계약·환불조건은 2000자 이내로 입력해 주세요.",
      );
      requireValue(
        typeof buyerName === "string" && buyerName.length <= 50,
        400,
        "주문자 이름은 50자 이내로 입력해 주세요.",
      );
      requireValue(
        typeof buyerPhone === "string",
        400,
        "연락처를 확인해 주세요.",
      );
      const phone = buyerPhone.trim() ? normalizePhone(buyerPhone) : null;
      requireValue(
        Number.isSafeInteger(expiresAt) &&
          Number.isFinite(new Date(expiresAt).getTime()) &&
          expiresAt > Date.now(),
        400,
        "유효기간은 현재보다 이후로 지정해 주세요.",
      );
      const id = token(),
        now = Date.now();
      const orderNo = `CT${ediDate()}${token().replace(/[-_]/g, "").slice(0, 10)}`;
      db.prepare(
        `INSERT INTO invoices (token, order_no, title, amount, tax_type, terms, expires_at, created_at, buyer_name, buyer_phone)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        orderNo,
        title.trim(),
        amount,
        taxType,
        terms.trim(),
        expiresAt,
        now,
        buyerName.trim() || null,
        phone,
      );
      res.status(201).json(invoiceView(getInvoice(id), true));
    },
  );
  app.get(`${API_PATH}/invoices/:token`, (req, res) => {
    res.json({
      ...invoiceView(getInvoice(req.params.token)),
      paymentConfigured: paymentReady(config),
    });
  });
  app.post(
    `${API_PATH}/admin/invoices/:token/expire`,
    sameOrigin,
    admin,
    csrf,
    (req, res) => {
      const invoice = getInvoice(req.params.token);
      requireValue(
        invoice.state === "pending",
        409,
        "처리 중이거나 결제된 주문은 종료할 수 없습니다. PaySM 거래를 확인해 주세요.",
      );
      transaction(db, () => {
        const updated = db
          .prepare(
            "UPDATE invoices SET expires_at = ?, note = ? WHERE token = ? AND state = 'pending' RETURNING token",
          )
          .get(
            Date.now() - 1,
            "관리자가 결제 링크를 종료했습니다.",
            invoice.token,
          );
        requireValue(updated, 409, "이미 처리 중인 결제입니다.");
        db.prepare(
          "UPDATE attempts SET state = 'closed' WHERE invoice_token = ? AND state = 'prepared'",
        ).run(invoice.token);
      });
      res.json(invoiceView(getInvoice(invoice.token), true));
    },
  );
  app.post(`${API_PATH}/invoices/:token/prepare`, sameOrigin, (req, res) => {
    ready();
    const invoice = getInvoice(req.params.token);
    const body = req.body;
    requireValue(object(body), 400, "주문자 정보를 확인해 주세요.");
    requireValue(
      invoice.state === "pending" && invoice.expires_at > Date.now(),
      409,
      "현재 결제할 수 없는 주문입니다. 결제 상태를 확인해 주세요.",
    );
    requireValue(text(body.name, 50), 400, "주문자 이름을 입력해 주세요.");
    const phone = normalizePhone(body.phone);
    requireValue(
      body.consent === true && typeof body.mobile === "boolean",
      400,
      invoice.terms
        ? "계약·환불조건과 개인정보 수집에 동의해 주세요."
        : "개인정보 수집·이용에 동의해 주세요.",
    );
    const attempt = {
      token: token(),
      mid: config.mid,
      edi_date: ediDate(),
      created_at: Date.now(),
    };
    transaction(db, () => {
      db.prepare(
        "UPDATE attempts SET state = 'closed' WHERE invoice_token = ? AND state = 'prepared'",
      ).run(invoice.token);
      db.prepare(
        "INSERT INTO attempts (token, invoice_token, mid, edi_date, created_at) VALUES (?, ?, ?, ?, ?)",
      ).run(
        attempt.token,
        invoice.token,
        attempt.mid,
        attempt.edi_date,
        attempt.created_at,
      );
      db.prepare(
        "UPDATE invoices SET buyer_name = ?, buyer_phone = ?, consent_at = ?, note = '' WHERE token = ?",
      ).run(body.name.trim(), phone, Date.now(), invoice.token);
    });
    res.json({
      attemptToken: attempt.token,
      action: `${PAYSM_BASE_URL}/payInit_hash.do`,
      fields: initialFields(
        config,
        getInvoice(invoice.token),
        attempt,
        body.mobile,
      ),
    });
  });

  async function approve(attemptId, auth) {
    ready();
    const attempt = getAttempt(attemptId),
      invoice = getInvoice(attempt.invoice_token);
    requireValue(
      object(auth) && auth.resultCode === "0000",
      400,
      "결제 인증이 완료되지 않았습니다.",
    );
    requireValue(
      auth.mid === attempt.mid &&
        auth.mid === config.mid &&
        auth.ediDate === attempt.edi_date &&
        auth.goodsAmt === String(invoice.amount),
      400,
      "결제 인증 정보가 주문과 일치하지 않습니다.",
    );
    requireValue(
      text(auth.tid, 128) && text(auth.signData, 32000),
      400,
      "결제 인증 정보가 올바르지 않습니다.",
    );
    requireValue(
      !auth.ordNo || auth.ordNo === invoice.order_no,
      400,
      "주문번호가 일치하지 않습니다.",
    );
    if (invoice.state !== "pending") {
      requireValue(
        invoice.tid === auth.tid &&
          ["processing", "paid", "review"].includes(attempt.state),
        409,
        "이미 처리되었거나 만료된 결제 요청입니다.",
      );
      return invoiceView(invoice);
    }
    requireValue(
      attempt.state === "prepared" &&
        Date.now() - attempt.created_at < 15 * 60000 &&
        invoice.expires_at > Date.now(),
      409,
      "결제 요청이 만료되었습니다.",
    );
    requireValue(
      !db.prepare("SELECT token FROM invoices WHERE tid = ?").get(auth.tid),
      409,
      "이미 사용된 거래번호입니다.",
    );
    transaction(db, () => {
      const claimed = db
        .prepare(
          "UPDATE invoices SET state = 'processing', tid = ? WHERE token = ? AND state = 'pending' RETURNING token",
        )
        .get(auth.tid, invoice.token);
      requireValue(claimed, 409, "이미 처리 중인 결제 요청입니다.");
      db.prepare(
        "UPDATE attempts SET state = 'processing' WHERE token = ?",
      ).run(attempt.token);
    });
    try {
      const result = await provider.approve(auth);
      const matches =
        result.resultCd === "0000" &&
        result.mid === attempt.mid &&
        String(result.amt) === String(invoice.amount) &&
        result.tid === auth.tid &&
        (!result.ordNo || result.ordNo === invoice.order_no);
      if (!matches) {
        log(
          "payment_approval_unconfirmed",
          typeof result.resultCd === "string" && /^\d{4}$/.test(result.resultCd)
            ? result.resultCd
            : "invalid_response",
        );
        db.prepare(
          "UPDATE invoices SET state = 'review', note = ? WHERE token = ? AND state = 'processing'",
        ).run(
          "승인 결과를 확인 중입니다. 다시 결제하지 말고 담당자에게 문의해 주세요.",
          invoice.token,
        );
        db.prepare(
          "UPDATE attempts SET state = 'review' WHERE token = ? AND state = 'processing'",
        ).run(attempt.token);
      } else {
        transaction(db, () => {
          db.prepare(
            "UPDATE invoices SET state = 'paid', paid_at = ?, note = '' WHERE token = ? AND state = 'processing'",
          ).run(Date.now(), invoice.token);
          db.prepare(
            "UPDATE attempts SET state = 'paid' WHERE token = ? AND state = 'processing'",
          ).run(attempt.token);
        });
      }
    } catch (error) {
      log("payment_approval_unconfirmed", error.name);
      db.prepare(
        "UPDATE invoices SET state = 'review', note = ? WHERE token = ? AND state = 'processing'",
      ).run(
        "승인 응답을 확인하지 못했습니다. 다시 결제하지 말고 담당자에게 문의해 주세요.",
        invoice.token,
      );
      db.prepare(
        "UPDATE attempts SET state = 'review' WHERE token = ? AND state = 'processing'",
      ).run(attempt.token);
    }
    return invoiceView(getInvoice(invoice.token));
  }
  app.post(`${API_PATH}/approve/:attempt`, sameOrigin, async (req, res) => {
    res.json(await approve(req.params.attempt, req.body));
  });
  app.post(`${API_PATH}/return/:attempt`, async (req, res) => {
    const attempt = getAttempt(req.params.attempt);
    try {
      if (req.body?.resultCode === "0000")
        await approve(attempt.token, req.body);
      else {
        requireValue(
          object(req.body) && text(req.body.resultCode, 16),
          400,
          "결제 인증 결과가 올바르지 않습니다.",
        );
        db.prepare(
          "UPDATE attempts SET state = 'closed' WHERE token = ? AND state = 'prepared'",
        ).run(attempt.token);
        db.prepare(
          "UPDATE invoices SET note = ? WHERE token = ? AND state = 'pending'",
        ).run(
          "결제 인증이 취소되었거나 완료되지 않았습니다.",
          attempt.invoice_token,
        );
      }
    } catch (error) {
      log(
        "payment_return_rejected",
        error instanceof HttpError ? error.message : "internal_error",
      );
      db.prepare(
        "UPDATE invoices SET note = ? WHERE token = ? AND state = 'pending'",
      ).run(
        "결제 인증 결과를 확인하지 못했습니다. 담당자에게 문의해 주세요.",
        attempt.invoice_token,
      );
    }
    res.redirect(303, `${PUBLIC_SITE_URL}/pay/${attempt.invoice_token}/result`);
  });
  app.post(`${API_PATH}/notify/:attempt`, (req, res) => {
    ready();
    const attempt = getAttempt(req.params.attempt),
      invoice = getInvoice(attempt.invoice_token),
      body = req.body;
    requireValue(
      object(body) &&
        text(body.tid, 128) &&
        body.tid === invoice.tid &&
        (!body.mid || body.mid === attempt.mid),
      400,
      "통지 거래정보가 올바르지 않습니다.",
    );
    requireValue(
      typeof body.amt === "string" &&
        /^[1-9]\d*$/.test(body.amt) &&
        Number.isSafeInteger(Number(body.amt)) &&
        typeof body.ediDate === "string" &&
        /^\d{14}$/.test(body.ediDate) &&
        typeof body.hashStr === "string" &&
        /^[a-f0-9]{64}$/.test(body.hashStr) &&
        typeof body.resultCd === "string" &&
        /^\d{4}$/.test(body.resultCd),
      400,
      "통지 형식이 올바르지 않습니다.",
    );
    requireValue(
      equalSecret(
        body.hashStr,
        makeHash(attempt.mid, body.ediDate, body.amt, config.merchantKey),
      ),
      400,
      "통지 검증에 실패했습니다.",
    );
    requireValue(
      !body.ordNo || body.ordNo === invoice.order_no,
      400,
      "통지 주문번호가 올바르지 않습니다.",
    );
    const fingerprint = digest(
      JSON.stringify([
        attempt.token,
        body.tid,
        body.ediDate,
        body.amt,
        body.resultCd,
        body.hashStr,
        ...(body.cancelYN === undefined ? [] : [body.cancelYN]),
      ]),
    );
    transaction(db, () => {
      const inserted = db
        .prepare("INSERT OR IGNORE INTO notifications VALUES (?, ?, ?, ?, ?)")
        .run(fingerprint, invoice.token, body.resultCd, body.amt, Date.now());
      if (!inserted.changes) return;
      if (invoice.noti_date && body.ediDate < invoice.noti_date) return;
      const approval =
        (body.resultCd === "0000" && body.cancelYN === "N") ||
        (body.resultCd === "3001" &&
          (body.cancelYN === undefined || body.cancelYN === "N"));
      if (approval && body.amt === String(invoice.amount)) {
        if (!invoice.noti_code || invoice.noti_code === "3001") {
          db.prepare(
            "UPDATE invoices SET state = 'paid', paid_at = COALESCE(paid_at, ?), note = '', noti_code = ?, noti_date = ? WHERE token = ? AND state IN ('processing','review','paid')",
          ).run(Date.now(), "3001", body.ediDate, invoice.token);
          db.prepare("UPDATE attempts SET state = 'paid' WHERE token = ?").run(
            attempt.token,
          );
        } else {
          log(
            "payment_notification_review",
            "approval_after_cancel_or_ambiguous_notification",
          );
        }
      } else {
        log("payment_notification_review", body.resultCd);
        db.prepare(
          "UPDATE invoices SET state = 'review', note = ?, noti_code = ?, noti_date = ? WHERE token = ?",
        ).run(
          "서버 통지를 수신했습니다. PaySM 관리자에서 승인·취소 상태를 확인해야 합니다.",
          ["0000", "3001"].includes(body.resultCd) && body.cancelYN === "Y"
            ? "2001"
            : body.resultCd,
          body.ediDate,
          invoice.token,
        );
      }
    });
    res.status(200).end();
  });
  app.use((req, res) =>
    res.status(404).json({ error: "요청한 API를 찾을 수 없습니다." }),
  );
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status =
      error instanceof HttpError
        ? error.status
        : error.type === "entity.too.large"
          ? 413
          : error.type === "entity.parse.failed"
            ? 400
            : 500;
    log(
      "payment_api_error",
      error instanceof HttpError ? error.message : error.type || error.name,
    );
    res.status(status).json({
      error:
        error instanceof HttpError
          ? error.message
          : status === 400
            ? "요청 형식이 올바르지 않습니다."
            : status === 413
              ? "요청이 너무 큽니다."
              : "처리 중 오류가 발생했습니다. 담당자에게 문의해 주세요.",
    });
  });
  return app;
}
