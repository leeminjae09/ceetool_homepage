export type PaymentState =
  | "pending"
  | "expired"
  | "processing"
  | "paid"
  | "review";
export interface Invoice {
  token: string;
  orderNo: string;
  title: string;
  amount: number;
  taxType: "taxable" | "exempt";
  terms: string;
  expiresAt: number;
  state: PaymentState;
  paidAt: number | null;
  note: string;
}
export interface PublicInvoice extends Invoice {
  paymentConfigured: boolean;
}
export interface AdminInvoice extends Invoice {
  createdAt: number;
  buyerName: string | null;
  buyerPhone: string | null;
  tid: string | null;
}
export interface AdminSession {
  email: string;
  csrfToken: string;
  paymentConfigured: boolean;
}
export interface Checkout {
  attemptToken: string;
  action: string;
  fields: Record<string, string>;
}
export interface NewInvoice {
  title: string;
  amount: number;
  taxType: "taxable" | "exempt";
  terms: string;
  expiresAt: number;
}

const base = "/api/payments";
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const nullableString = (value: unknown): value is string | null =>
  value === null || typeof value === "string";
function isInvoice(value: unknown): value is Invoice {
  return (
    record(value) &&
    typeof value.token === "string" &&
    typeof value.orderNo === "string" &&
    typeof value.title === "string" &&
    typeof value.amount === "number" &&
    Number.isSafeInteger(value.amount) &&
    (value.taxType === "taxable" || value.taxType === "exempt") &&
    typeof value.terms === "string" &&
    typeof value.expiresAt === "number" &&
    typeof value.state === "string" &&
    ["pending", "expired", "processing", "paid", "review"].includes(
      value.state,
    ) &&
    (value.paidAt === null || typeof value.paidAt === "number") &&
    typeof value.note === "string"
  );
}
function isAdminInvoice(value: unknown): value is AdminInvoice {
  return (
    isInvoice(value) &&
    record(value) &&
    typeof value.createdAt === "number" &&
    nullableString(value.buyerName) &&
    nullableString(value.buyerPhone) &&
    nullableString(value.tid)
  );
}
export class PaymentApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
function invalidResponse(): never {
  console.error("Invalid payment API response shape");
  throw new Error(
    "결제 서버의 응답을 확인할 수 없습니다. 담당자에게 문의해 주세요.",
  );
}
async function request(path: string, options?: RequestInit): Promise<unknown> {
  const response = await fetch(`${base}${path}`, {
    ...options,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      ...(options?.body ? { "Content-Type": "application/json" } : {}),
      ...options?.headers,
    },
  });
  if (response.status === 204) return null;
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return invalidResponse();
  }
  if (!response.ok) {
    throw new PaymentApiError(
      record(body) && typeof body.error === "string"
        ? body.error
        : "결제 요청을 처리하지 못했습니다.",
      response.status,
    );
  }
  return body;
}

export const paymentApi = {
  async invoice(token: string): Promise<PublicInvoice> {
    const value = await request(`/invoices/${encodeURIComponent(token)}`);
    if (
      !isInvoice(value) ||
      !record(value) ||
      typeof value.paymentConfigured !== "boolean"
    )
      return invalidResponse();
    return { ...value, paymentConfigured: value.paymentConfigured };
  },
  async prepare(
    token: string,
    buyer: { name: string; phone: string; consent: boolean; mobile: boolean },
  ): Promise<Checkout> {
    const value = await request(
      `/invoices/${encodeURIComponent(token)}/prepare`,
      {
        method: "POST",
        body: JSON.stringify(buyer),
      },
    );
    if (
      !record(value) ||
      typeof value.attemptToken !== "string" ||
      value.action !== "https://api.skyclassism.com/payInit_hash.do" ||
      !record(value.fields)
    )
      return invalidResponse();
    const fields: Record<string, string> = {};
    for (const [key, field] of Object.entries(value.fields)) {
      if (typeof field !== "string") return invalidResponse();
      fields[key] = field;
    }
    return { attemptToken: value.attemptToken, action: value.action, fields };
  },
  async approve(
    attempt: string,
    auth: Record<string, string>,
  ): Promise<Invoice> {
    const value = await request(`/approve/${encodeURIComponent(attempt)}`, {
      method: "POST",
      body: JSON.stringify(auth),
    });
    if (!isInvoice(value)) return invalidResponse();
    return value;
  },
  async session(): Promise<AdminSession | null> {
    let value: unknown;
    try {
      value = await request("/admin/session");
    } catch (error) {
      if (error instanceof PaymentApiError && error.status === 401) return null;
      throw error;
    }
    if (
      !record(value) ||
      typeof value.email !== "string" ||
      typeof value.csrfToken !== "string" ||
      typeof value.paymentConfigured !== "boolean"
    )
      return invalidResponse();
    return {
      email: value.email,
      csrfToken: value.csrfToken,
      paymentConfigured: value.paymentConfigured,
    };
  },
  async invoices(
    page = 0,
  ): Promise<{ invoices: AdminInvoice[]; hasMore: boolean }> {
    const value = await request(`/admin/invoices?page=${page}`);
    if (
      !record(value) ||
      !Array.isArray(value.invoices) ||
      !value.invoices.every(isAdminInvoice) ||
      typeof value.hasMore !== "boolean"
    )
      return invalidResponse();
    return { invoices: value.invoices, hasMore: value.hasMore };
  },
  async create(invoice: NewInvoice, csrf: string): Promise<AdminInvoice> {
    const value = await request("/admin/invoices", {
      method: "POST",
      headers: { "X-CSRF-Token": csrf },
      body: JSON.stringify(invoice),
    });
    if (!isAdminInvoice(value)) return invalidResponse();
    return value;
  },
  async logout(csrf: string): Promise<void> {
    await request("/admin/logout", {
      method: "POST",
      headers: { "X-CSRF-Token": csrf },
    });
  },
  async expire(token: string, csrf: string): Promise<AdminInvoice> {
    const value = await request(
      `/admin/invoices/${encodeURIComponent(token)}/expire`,
      {
        method: "POST",
        headers: { "X-CSRF-Token": csrf },
      },
    );
    if (!isAdminInvoice(value)) return invalidResponse();
    return value;
  },
};
