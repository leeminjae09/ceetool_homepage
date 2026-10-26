import { createHash, timingSafeEqual } from "node:crypto";
import { API_PATH, PAYSM_BASE_URL, PUBLIC_SITE_URL } from "./config.mjs";

export function makeHash(mid, date, amount, key) {
  return createHash("sha256")
    .update(`${mid}${date}${amount}${key}`, "utf8")
    .digest("hex");
}

export function equalSecret(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function ediDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const part = (type) => parts.find((p) => p.type === type).value;
  return ["year", "month", "day", "hour", "minute", "second"]
    .map(part)
    .join("");
}

export function initialFields(config, invoice, attempt, mobile) {
  const taxable = invoice.tax_type === "taxable";
  const supply = taxable ? Math.round(invoice.amount / 1.1) : 0;
  return {
    mid: attempt.mid,
    goodsAmt: String(invoice.amount),
    goodsNm: invoice.title,
    ediDate: attempt.edi_date,
    encData: makeHash(
      attempt.mid,
      attempt.edi_date,
      invoice.amount,
      config.merchantKey,
    ),
    payMethod: "CARD",
    trxCd: "0",
    ordNo: invoice.order_no,
    ordNm: invoice.buyer_name,
    ordTel: invoice.buyer_phone,
    charSet: "UTF-8",
    returnUrl: `${PUBLIC_SITE_URL}${API_PATH}/return/${attempt.token}`,
    notiUrl: `${PUBLIC_SITE_URL}${API_PATH}/notify/${attempt.token}`,
    channel: mobile ? "0002" : "0001",
    ...(mobile ? { mobileMode: "Y" } : {}),
    goodsSplAmt: String(supply),
    goodsVat: String(taxable ? invoice.amount - supply : 0),
    goodsTaxFreeAmt: String(taxable ? 0 : invoice.amount),
  };
}

export function createPaysm(config, fetcher = fetch) {
  return {
    async approve(auth) {
      const fields = {
        tid: auth.tid,
        mid: auth.mid,
        ediDate: auth.ediDate,
        goodsAmt: auth.goodsAmt,
        signData: auth.signData,
        charSet: "UTF-8",
        encData: makeHash(
          auth.mid,
          auth.ediDate,
          auth.goodsAmt,
          config.merchantKey,
        ),
      };
      const response = await fetcher(`${PAYSM_BASE_URL}/payment.do`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
        body: new URLSearchParams(fields),
        redirect: "error",
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error("PAYSM_HTTP_ERROR");
      const raw = await response.text();
      if (Buffer.byteLength(raw) > 65536)
        throw new Error("PAYSM_RESPONSE_TOO_LARGE");
      const result = JSON.parse(raw);
      if (!result || typeof result !== "object" || Array.isArray(result)) {
        throw new Error("PAYSM_INVALID_RESPONSE");
      }
      return result;
    },
  };
}
