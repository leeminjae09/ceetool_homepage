import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import BusinessInfo from "components/BusinessInfo";
import HomepageAdmin from "components/HomepageAdmin";
import {
  paymentApi,
  PaymentApiError,
  type AdminInvoice,
  type AdminSession,
  type Checkout,
  type EmailStatus,
  type Invoice,
  type PaymentState,
  type PublicInvoice,
} from "app/payments-api";

const inputClass =
  "mt-1 block w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-white focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400";
const buttonClass =
  "inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-600 px-5 py-2 font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-400";
const statusLabels: Record<PaymentState, string> = {
  pending: "결제 대기",
  expired: "결제 기한 만료",
  processing: "승인 처리 중",
  paid: "결제 완료",
  review: "결제 확인 중",
};
const isPaymentState = (value: string): value is PaymentState =>
  Object.prototype.hasOwnProperty.call(statusLabels, value);
const won = (amount: number) => `${amount.toLocaleString("ko-KR")}원`;
const date = (value: number) => new Date(value).toLocaleString("ko-KR");
function message(error: unknown): string {
  if (error instanceof TypeError) {
    console.error("Payment request failed", error.name);
    return "서버에 연결하지 못했습니다. 잠시 후 다시 확인해 주세요.";
  }
  return error instanceof Error
    ? error.message
    : "요청을 처리하지 못했습니다. 담당자에게 문의해 주세요.";
}
function Layout({
  title,
  children,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <main className="payment-page text-gray-100">
      <div className={`mx-auto ${wide ? "max-w-4xl" : "max-w-xl"}`}>
        <header className="mb-8">
          <Link
            to="/"
            className="text-xl font-bold text-purple-300 hover:text-purple-200"
          >
            CEETOOL
          </Link>
          <h1 className="mt-5 text-2xl font-bold">{title}</h1>
        </header>
        {children}
        <BusinessInfo className="mt-10 border-t border-gray-700 pt-5 text-xs leading-relaxed text-gray-400 space-y-1" />
      </div>
    </main>
  );
}
function ErrorNotice({ error }: { error: string }) {
  return error ? (
    <p
      role="alert"
      className="my-4 rounded-lg border border-red-400/40 bg-red-950/30 p-3 text-sm text-red-200"
    >
      {error}
    </p>
  ) : null;
}
function useInvoice(token: string, poll = false) {
  const [invoice, setInvoice] = useState<PublicInvoice | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true,
      timer: number | undefined,
      count = 0;
    setError("");
    const load = async () => {
      try {
        const result = await paymentApi.invoice(token);
        if (!active) return;
        setInvoice(result);
        if (poll && result.state === "processing" && count++ < 10) {
          timer = window.setTimeout(load, 3000);
        }
      } catch (err) {
        if (active) setError(message(err));
      }
    };
    void load();
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [token, poll, revision]);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  return { invoice: invoice?.token === token ? invoice : null, error, reload };
}
function Summary({ invoice }: { invoice: Invoice }) {
  return (
    <section className="mb-6 border-b border-gray-700 pb-6">
      <h2 className="break-words text-lg font-semibold">{invoice.title}</h2>
      <p className="mt-2 text-3xl font-bold">{won(invoice.amount)}</p>
      <p className="mt-2 text-sm text-gray-400">
        {invoice.taxType === "taxable" ? "부가세 포함" : "면세"} ·{" "}
        {statusLabels[invoice.state]}
      </p>
    </section>
  );
}
function PaymentFrame({
  checkout,
  busy,
  onClose,
  onApproval,
  onError,
  onIncomplete,
}: {
  checkout: Checkout;
  busy: boolean;
  onClose: () => void;
  onApproval: (auth: Record<string, string>) => void;
  onError: (error: string) => void;
  onIncomplete: (result: "FAIL" | "CANCEL") => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const submitted = useRef(false);
  const handling = useRef(false);
  const cancel = () => {
    if (busy || handling.current) return;
    handling.current = true;
    onIncomplete("CANCEL");
    onClose();
  };
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const opener = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      if (opener instanceof HTMLElement) opener.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    if (!submitted.current && formRef.current) {
      submitted.current = true;
      formRef.current.submit();
    }
  }, [checkout]);
  useEffect(() => {
    const receive = (event: MessageEvent<unknown>) => {
      if (
        event.origin !== new URL(checkout.action).origin ||
        event.source !== frameRef.current?.contentWindow ||
        !Array.isArray(event.data) ||
        handling.current
      )
        return;
      const [result, payload] = event.data;
      if (result === "SUCCESS") {
        if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
          onError("결제 인증 응답이 올바르지 않습니다.");
          handling.current = true;
          onIncomplete("FAIL");
          onClose();
          return;
        }
        const auth: Record<string, string> = {};
        for (const key of [
          "resultCode",
          "tid",
          "mid",
          "ediDate",
          "goodsAmt",
          "signData",
        ]) {
          if (!(key in payload) || typeof payload[key] !== "string") {
            onError("결제 인증 정보를 확인하지 못했습니다.");
            handling.current = true;
            onIncomplete("FAIL");
            onClose();
            return;
          }
          auth[key] = payload[key];
        }
        if ("ordNo" in payload && typeof payload.ordNo === "string")
          auth.ordNo = payload.ordNo;
        handling.current = true;
        onApproval(auth);
      } else if (result === "FAIL" || result === "CANCEL") {
        handling.current = true;
        onIncomplete(result);
        onError(
          result === "FAIL"
            ? "결제 인증을 완료하지 못했습니다."
            : "결제창을 닫았습니다.",
        );
        onClose();
      }
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [checkout, onApproval, onClose, onError, onIncomplete]);
  return (
    <dialog
      ref={dialogRef}
      aria-label="카드 결제"
      aria-modal="true"
      onCancel={(event) => {
        event.preventDefault();
        cancel();
      }}
      onClose={(event) => {
        if (!event.currentTarget.open && !busy) onClose();
      }}
      className="fixed inset-0 m-auto h-[90dvh] w-[min(720px,100%)] max-w-full overflow-hidden rounded-xl border border-gray-600 bg-white p-0 backdrop:bg-black/75 open:flex open:flex-col"
    >
      <header className="flex shrink-0 items-center justify-between gap-4 bg-gray-900 p-3 text-white">
        <h2 className="font-semibold">
          {busy ? "승인 결과 확인 중" : "카드 결제"}
        </h2>
        <button
          type="button"
          autoFocus
          disabled={busy}
          onClick={cancel}
          className="rounded px-3 py-2 disabled:opacity-40"
          aria-label="결제창 닫기"
        >
          닫기
        </button>
      </header>
      <iframe
        ref={frameRef}
        name="ceetool-paysm"
        title="카드 결제 인증"
        referrerPolicy="no-referrer"
        className="min-h-0 flex-1 border-0"
      />
      <form
        ref={formRef}
        method="post"
        action={checkout.action}
        target="ceetool-paysm"
        hidden
      >
        {Object.entries(checkout.fields).map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={value} />
        ))}
      </form>
    </dialog>
  );
}
export function PaymentPage() {
  const { token = "" } = useParams();
  return <CustomerPayment key={token} token={token} />;
}
function CustomerPayment({ token }: { token: string }) {
  const navigate = useNavigate();
  const { invoice, error: loadError, reload } = useInvoice(token);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [checkout, setCheckout] = useState<Checkout | null>(null);
  const visited = useRef(false);
  useEffect(() => {
    if (!invoice || visited.current) return;
    visited.current = true;
    void paymentApi
      .visit(token)
      .catch((err: unknown) =>
        console.error("Payment visit notification failed", message(err)),
      );
  }, [invoice, token]);
  const close = useCallback(() => setCheckout(null), []);
  const incomplete = useCallback(
    (result: "FAIL" | "CANCEL") => {
      if (!checkout) return;
      void paymentApi
        .incomplete(checkout.attemptToken, result)
        .catch((err: unknown) => setError(message(err)));
    },
    [checkout],
  );
  const approve = useCallback(
    async (auth: Record<string, string>) => {
      if (!checkout) return;
      setBusy(true);
      try {
        await paymentApi.approve(checkout.attemptToken, auth);
        navigate(`/pay/${token}/result`, { replace: true });
      } catch (err) {
        setError(message(err));
        setCheckout(null);
        reload();
      } finally {
        setBusy(false);
      }
    },
    [checkout, navigate, token, reload],
  );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const mobile =
        /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
        (navigator.maxTouchPoints > 1 &&
          /Macintosh/i.test(navigator.userAgent));
      const result = await paymentApi.prepare(token, {
        name: String(form.get("name") || ""),
        phone: String(form.get("phone") || ""),
        consent: form.get("consent") === "on",
        mobile,
      });
      if (mobile) {
        const redirect = document.createElement("form");
        redirect.method = "POST";
        redirect.action = result.action;
        redirect.target = "_self";
        for (const [key, value] of Object.entries(result.fields)) {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = key;
          input.value = value;
          redirect.append(input);
        }
        document.body.append(redirect);
        redirect.submit();
        return;
      }
      setCheckout(result);
    } catch (err) {
      setError(message(err));
    }
    setBusy(false);
  }
  return (
    <Layout title="결제">
      <ErrorNotice error={loadError || error} />
      {!invoice && !loadError && (
        <p role="status">결제 정보를 불러오는 중입니다.</p>
      )}
      {invoice && (
        <>
          <Summary invoice={invoice} />
          <p className="mb-4 text-xs leading-relaxed text-gray-400">
            접속 알림의 중복 방지를 위해 무작위 브라우저 식별 쿠키를 최대 30일
            사용합니다.
          </p>
          {invoice.state !== "pending" ? (
            <>
              <p className="my-4 text-gray-300">
                {invoice.note || statusLabels[invoice.state]}
              </p>
              <Link
                className="text-blue-400 hover:underline"
                to={`/pay/${token}/result`}
              >
                결제 상태 확인
              </Link>
            </>
          ) : (
            <form
              onSubmit={(event) => void submit(event)}
              className="space-y-5"
            >
              <p className="text-sm text-gray-400">
                유효기간: {date(invoice.expiresAt)}
              </p>
              <label className="block">
                주문자 이름
                <input
                  className={inputClass}
                  name="name"
                  autoComplete="name"
                  defaultValue={invoice.buyerName || ""}
                  required
                  maxLength={50}
                  disabled={busy}
                />
              </label>
              <label className="block">
                연락처
                <input
                  className={inputClass}
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  defaultValue={invoice.buyerPhone || ""}
                  required
                  maxLength={24}
                  disabled={busy}
                />
              </label>
              {invoice.terms && (
                <details className="rounded-lg border border-gray-700 p-3 text-sm">
                  <summary className="cursor-pointer">계약·환불조건</summary>
                  <p className="mt-3 whitespace-pre-wrap break-words leading-relaxed text-gray-300">
                    {invoice.terms}
                  </p>
                </details>
              )}
              <details className="rounded-lg border border-gray-700 p-3 text-sm">
                <summary className="cursor-pointer">개인정보 수집·이용</summary>
                <p className="mt-3 leading-relaxed text-gray-300">
                  씨툴은 결제 및 계약 이행을 위해 이름과 연락처를 수집합니다.
                  이름·연락처는 결제 완료 후 5년간 보관하며, 미결제 주문은
                  유효기간 종료 후 30일 이내 삭제합니다. 동의를 거부하면 결제를
                  진행할 수 없습니다.
                </p>
              </details>
              <label className="flex items-start gap-3 text-sm leading-relaxed">
                <input
                  name="consent"
                  type="checkbox"
                  required
                  disabled={busy}
                  className="mt-1 h-4 w-4 shrink-0"
                />
                <span>
                  {invoice.terms
                    ? "계약·환불조건 및 개인정보 수집·이용에 동의합니다."
                    : "개인정보 수집·이용에 동의합니다."}
                </span>
              </label>
              {!invoice.paymentConfigured && (
                <ErrorNotice error="결제 서비스가 아직 설정되지 않았습니다. 담당자에게 문의해 주세요." />
              )}
              <button
                className={`${buttonClass} w-full`}
                disabled={busy || !invoice.paymentConfigured}
                type="submit"
              >
                {busy ? "처리 중…" : "카드로 결제하기"}
              </button>
            </form>
          )}
        </>
      )}
      {checkout && (
        <PaymentFrame
          checkout={checkout}
          busy={busy}
          onClose={close}
          onApproval={(auth) => void approve(auth)}
          onError={setError}
          onIncomplete={incomplete}
        />
      )}
    </Layout>
  );
}

export function PaymentResultPage() {
  const { token = "" } = useParams();
  const { invoice, error, reload } = useInvoice(token, true);
  return (
    <Layout title={invoice ? statusLabels[invoice.state] : "결제 결과"}>
      <ErrorNotice error={error} />
      {!invoice && !error && (
        <p role="status">결제 결과를 확인하는 중입니다.</p>
      )}
      {invoice && (
        <>
          <Summary invoice={invoice} />
          {invoice.state === "paid" && invoice.paidAt && (
            <p className="text-gray-300">결제일: {date(invoice.paidAt)}</p>
          )}
          {invoice.state === "processing" && (
            <p role="status" className="text-gray-300">
              승인 결과를 확인하고 있습니다. 다시 결제하지 마세요.
            </p>
          )}
          {invoice.note && (
            <p className="mt-4 text-sm text-amber-200">{invoice.note}</p>
          )}
          <p className="mt-4 break-all text-sm text-gray-400">
            주문번호: {invoice.orderNo}
          </p>
          <div className="mt-6 flex flex-wrap gap-4">
            {invoice.state === "pending" && (
              <Link className={buttonClass} to={`/pay/${token}`}>
                결제 페이지로
              </Link>
            )}
            <button
              type="button"
              className="min-h-11 rounded-lg border border-gray-600 px-4 py-2 hover:bg-gray-800"
              onClick={reload}
            >
              상태 새로고침
            </button>
          </div>
        </>
      )}
    </Layout>
  );
}

function localDateInput(value: number) {
  const d = new Date(value);
  return new Date(value - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
function EmailNotifications({ csrf }: { csrf: string }) {
  const [status, setStatus] = useState<EmailStatus | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    void paymentApi
      .emailStatus()
      .then((value) => {
        if (active) setStatus(value);
      })
      .catch((err: unknown) => {
        if (active) setError(message(err));
      });
    return () => {
      active = false;
    };
  }, []);
  async function update(action?: "test" | "retry") {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      setStatus(await paymentApi.emailStatus(action, csrf));
      if (action)
        setNotice(
          "발송 대기열에 등록했습니다. 잠시 후 상태를 새로고침해 주세요.",
        );
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="mb-6 rounded-xl border border-gray-700 p-4 text-sm">
      <summary className="cursor-pointer font-semibold">
        관리자 메일 알림
      </summary>
      <p className="mt-3 break-all text-gray-300">
        발신·수신: john@ceetool.com · 서울 리전
      </p>
      <p className="mt-2 text-gray-400">
        같은 링크·브라우저의 접속 알림은 30분마다 최대 1회 발송합니다.
      </p>
      {status && (
        <p className="mt-2">
          대기 {status.pending} · 발송 접수 {status.sent} · 재시도 소진{" "}
          {status.failed}
        </p>
      )}
      {status?.lastSentAt && (
        <p className="mt-2">마지막 발송 접수: {date(status.lastSentAt)}</p>
      )}
      {status?.lastError && (
        <p role="alert" className="mt-2 text-amber-300">
          발송 오류: {status.lastError}. AWS 권한·인증 설정을 확인해 주세요.
        </p>
      )}
      <ErrorNotice error={error} />
      {notice && (
        <p role="status" className="mt-2 text-green-300">
          {notice}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-3">
        <button
          type="button"
          className={buttonClass}
          disabled={busy}
          onClick={() => void update()}
        >
          상태 새로고침
        </button>
        <button
          type="button"
          className={buttonClass}
          disabled={busy}
          onClick={() => void update("test")}
        >
          테스트 메일
        </button>
        <button
          type="button"
          className={buttonClass}
          disabled={busy}
          onClick={() => void update("retry")}
        >
          오류 메일 재시도
        </button>
      </div>
      <p className="mt-3 text-gray-400">
        발송 접수는 메일 서비스가 수락했다는 뜻이며, 받은편지함 도착을 보장하지
        않습니다.
      </p>
    </details>
  );
}

export function PaymentAdminPage() {
  const [params] = useSearchParams();
  const homepageView = params.get("section") === "homepage";
  const [homepageDirty, setHomepageDirty] = useState(false);
  const [session, setSession] = useState<AdminSession | null>(null);
  const clearSession = useCallback(() => setSession(null), []);
  const [loaded, setLoaded] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [invoices, setInvoices] = useState<AdminInvoice[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  const [amount, setAmount] = useState("");
  const [terms, setTerms] = useState("");
  const [defaultTerms, setDefaultTerms] = useState("");
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [settingsRevision, setSettingsRevision] = useState(0);
  const [query, setQuery] = useState("");
  const [queryInput, setQueryInput] = useState("");
  const [filter, setFilter] = useState<PaymentState | "">("");
  const [listingLoading, setListingLoading] = useState(false);
  const settingsEmail = session?.email;
  useEffect(() => {
    let active = true;
    setSettingsLoaded(false);
    setSettingsError("");
    if (!settingsEmail) return;
    void paymentApi
      .settings()
      .then((settings) => {
        if (!active) return;
        setDefaultTerms(settings.defaultTerms);
        setTerms(settings.defaultTerms);
        setSettingsLoaded(true);
      })
      .catch((err: unknown) => {
        if (active) setSettingsError(message(err));
      });
    return () => {
      active = false;
    };
  }, [settingsEmail, settingsRevision]);
  useEffect(() => {
    let active = true;
    async function load() {
      setError("");
      setUnavailable(false);
      setListingLoading(true);
      setInvoices([]);
      setHasMore(false);
      try {
        const current = await paymentApi.session();
        if (!active) return;
        setSession(current);
        if (current) {
          const result = await paymentApi.invoices(page, query, filter);
          if (!active) return;
          setInvoices(result.invoices);
          setHasMore(result.hasMore);
        }
      } catch (err) {
        if (active) {
          setError(message(err));
          setUnavailable(err instanceof PaymentApiError && err.status === 503);
        }
      } finally {
        if (active) {
          setLoaded(true);
          setListingLoading(false);
        }
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [revision, page, query, filter]);
  const link = (invoice: Invoice) => `https://ceetool.com/pay/${invoice.token}`;
  function operationError(err: unknown) {
    setError(message(err));
    if (err instanceof PaymentApiError && err.status === 401) setSession(null);
  }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || busy) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const taxType = form.get("taxType");
    if (taxType !== "taxable" && taxType !== "exempt") {
      setError("과세 구분을 선택해 주세요.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const created = await paymentApi.create(
        {
          title: String(form.get("title") || ""),
          amount: Number(String(form.get("amount") || "").replace(/,/g, "")),
          taxType,
          terms: String(form.get("terms") || ""),
          expiresAt: new Date(String(form.get("expiresAt") || "")).getTime(),
          buyerName: String(form.get("buyerName") || ""),
          buyerPhone: String(form.get("buyerPhone") || ""),
        },
        session.csrfToken,
      );
      setInvoices([created]);
      setPage(0);
      setQuery("");
      setQueryInput("");
      setFilter("");
      setRevision((value) => value + 1);
      setNotice("결제 링크를 발급했습니다.");
      formElement.reset();
      setAmount("");
      setTerms(defaultTerms);
    } catch (err) {
      operationError(err);
    } finally {
      setBusy(false);
    }
  }
  async function saveTerms() {
    if (!session || busy || !settingsLoaded) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const settings = await paymentApi.saveDefaultTerms(
        terms,
        session.csrfToken,
      );
      setDefaultTerms(settings.defaultTerms);
      setTerms(settings.defaultTerms);
      setNotice(
        "기본 문구를 저장했습니다. 기존 결제 링크에는 적용되지 않습니다.",
      );
    } catch (err) {
      operationError(err);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    if (!session || busy) return;
    if (
      homepageDirty &&
      !window.confirm("저장하지 않은 홈페이지 변경을 버리고 로그아웃할까요?")
    )
      return;
    setBusy(true);
    setError("");
    try {
      await paymentApi.logout(session.csrfToken);
      setSession(null);
      setHomepageDirty(false);
      setInvoices([]);
    } catch (err) {
      operationError(err);
    } finally {
      setBusy(false);
    }
  }
  async function copy(invoice: Invoice) {
    setError("");
    setNotice("");
    try {
      await navigator.clipboard.writeText(link(invoice));
      setNotice("링크를 복사했습니다.");
    } catch {
      setError(
        "링크를 복사하지 못했습니다. 아래 주소를 직접 선택해 복사해 주세요.",
      );
    }
  }
  async function expire(invoice: AdminInvoice) {
    if (!session || busy || !window.confirm("이 결제 링크를 종료할까요?"))
      return;
    setBusy(true);
    setError("");
    try {
      const expired = await paymentApi.expire(invoice.token, session.csrfToken);
      setInvoices((current) =>
        current.map((item) => (item.token === expired.token ? expired : item)),
      );
      setNotice("결제 링크를 종료했습니다.");
      setRevision((value) => value + 1);
    } catch (err) {
      operationError(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Layout title="관리자" wide>
      <ErrorNotice
        error={
          error ||
          (!session && params.get("error") === "google_login"
            ? "Google 로그인에 실패했습니다. 허용된 관리자 계정과 OAuth 설정을 확인해 주세요."
            : "")
        }
      />
      {notice && (
        <p role="status" className="mb-4 text-sm text-green-300">
          {notice}
        </p>
      )}
      {!loaded ? (
        <p role="status">관리자 인증을 확인하는 중입니다.</p>
      ) : !session ? (
        <>
          {!unavailable && (
            <a className={buttonClass} href="/api/payments/admin/login">
              Google 계정으로 로그인
            </a>
          )}
          <button
            type="button"
            className="ml-4 min-h-11 text-gray-300 hover:underline"
            onClick={() => setRevision((value) => value + 1)}
          >
            다시 확인
          </button>
        </>
      ) : (
        <>
          <nav
            aria-label="관리자 메뉴"
            className="mb-6 border-b border-gray-700"
          >
            <Link
              to="/admin"
              aria-current={homepageView ? undefined : "page"}
              onClick={(event) => {
                if (
                  homepageDirty &&
                  !window.confirm("저장하지 않은 홈페이지 변경을 버릴까요?")
                )
                  event.preventDefault();
                else setHomepageDirty(false);
              }}
              className={`inline-flex min-h-11 items-center px-4 py-2 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-400 ${homepageView ? "text-gray-400" : "border-b-2 border-purple-400 text-purple-300"}`}
            >
              결제 관리
            </Link>
            <Link
              to="/admin?section=homepage"
              aria-current={homepageView ? "page" : undefined}
              className={`inline-flex min-h-11 items-center px-4 py-2 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-400 ${homepageView ? "border-b-2 border-purple-400 text-purple-300" : "text-gray-400"}`}
            >
              홈페이지 관리
            </Link>
          </nav>
          <div className="mb-6 flex flex-wrap items-center gap-4 text-sm">
            <span className="break-all text-gray-300">{session.email}</span>
            <button
              type="button"
              className="text-blue-400 hover:underline"
              onClick={() => void logout()}
              disabled={busy}
            >
              로그아웃
            </button>
            {!homepageView && (
              <button
                type="button"
                className="text-blue-400 hover:underline"
                onClick={() => setRevision((value) => value + 1)}
                disabled={busy}
              >
                내역 새로고침
              </button>
            )}
          </div>
          {homepageView ? (
            <HomepageAdmin
              csrf={session.csrfToken}
              onUnauthorized={clearSession}
              onDirtyChange={setHomepageDirty}
            />
          ) : (
            <>
              <h2 className="mb-4 text-xl font-semibold">결제 관리</h2>
              <EmailNotifications csrf={session.csrfToken} />
              {!session.paymentConfigured && (
                <ErrorNotice error="서버 .env에 실가맹점 MID·Merchant Key를 설정해야 링크를 발급할 수 있습니다." />
              )}
              <form
                onSubmit={(event) => void create(event)}
                className="space-y-4 rounded-xl border border-gray-700 p-4 sm:p-6"
              >
                <h2 className="text-lg font-semibold">결제 링크 발급</h2>
                <label className="block text-sm">
                  결제 항목
                  <input
                    className={inputClass}
                    name="title"
                    required
                    maxLength={80}
                    disabled={busy}
                  />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm">
                    최종 결제금액(원)
                    <input
                      className={inputClass}
                      name="amount"
                      type="text"
                      inputMode="numeric"
                      value={amount}
                      onChange={(event) => {
                        const digits = event.target.value.replace(/,/g, "");
                        setAmount(
                          /^\d*$/.test(digits)
                            ? digits
                                .replace(/^0+(?=\d)/, "")
                                .replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                            : event.target.value,
                        );
                      }}
                      pattern="[1-9][0-9]{0,2}(,[0-9]{3})*"
                      title="1원 이상의 정수 금액을 입력해 주세요."
                      maxLength={21}
                      required
                      disabled={busy}
                    />
                  </label>
                  <label className="block text-sm">
                    과세 구분
                    <select
                      className={inputClass}
                      name="taxType"
                      defaultValue=""
                      required
                      disabled={busy}
                    >
                      <option value="" disabled>
                        선택
                      </option>
                      <option value="taxable">과세 · 부가세 포함</option>
                      <option value="exempt">면세</option>
                    </select>
                  </label>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm">
                    주문자 이름 (선택)
                    <input
                      className={inputClass}
                      name="buyerName"
                      maxLength={50}
                      disabled={busy}
                      autoComplete="off"
                    />
                  </label>
                  <label className="block text-sm">
                    연락처 (선택)
                    <input
                      className={inputClass}
                      name="buyerPhone"
                      type="tel"
                      maxLength={24}
                      disabled={busy}
                      autoComplete="off"
                    />
                  </label>
                </div>
                <p className="text-xs text-gray-400">
                  입력한 주문자 정보는 고객 결제 화면에 미리 표시됩니다.
                  수집·제공이 가능한 정보만 입력하고 링크는 해당 고객에게만
                  전달하세요.
                </p>
                <label className="block text-sm">
                  유효기간
                  <input
                    className={inputClass}
                    name="expiresAt"
                    type="datetime-local"
                    required
                    defaultValue={localDateInput(Date.now() + 7 * 86400000)}
                    disabled={busy}
                  />
                </label>
                <label className="block text-sm">
                  계약·환불조건 (선택)
                  <textarea
                    className={`${inputClass} min-h-28`}
                    name="terms"
                    value={terms}
                    onChange={(event) => setTerms(event.target.value)}
                    maxLength={2000}
                    disabled={busy || !settingsLoaded}
                    placeholder="별도 안내가 필요한 경우에만 입력하세요."
                  />
                </label>
                <ErrorNotice error={settingsError} />
                {settingsError && (
                  <button
                    type="button"
                    className="min-h-11 text-sm text-blue-400 hover:underline"
                    onClick={() => setSettingsRevision((value) => value + 1)}
                  >
                    기본 문구 다시 불러오기
                  </button>
                )}
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <button
                    type="button"
                    className="min-h-11 text-blue-400 hover:underline disabled:opacity-50"
                    disabled={busy || !settingsLoaded}
                    onClick={() => void saveTerms()}
                  >
                    현재 문구를 기본으로 저장
                  </button>
                  <button
                    type="button"
                    className="min-h-11 text-gray-300 hover:underline disabled:opacity-50"
                    disabled={busy || !settingsLoaded}
                    onClick={() => setTerms(defaultTerms)}
                  >
                    기본 문구 불러오기
                  </button>
                </div>
                <button
                  type="submit"
                  className={buttonClass}
                  disabled={
                    busy || !settingsLoaded || !session.paymentConfigured
                  }
                >
                  {busy ? "처리 중…" : "링크 발급"}
                </button>
              </form>
              <section className="mt-8 space-y-4" aria-label="결제 내역">
                <h2 className="text-lg font-semibold">결제 내역</h2>
                <form
                  className="flex flex-col gap-3 sm:flex-row"
                  role="search"
                  onSubmit={(event) => {
                    event.preventDefault();
                    setQuery(queryInput.trim());
                    setPage(0);
                    setRevision((value) => value + 1);
                  }}
                >
                  <input
                    className={`${inputClass} mt-0 min-w-0 flex-1`}
                    aria-label="결제 내역 검색"
                    value={queryInput}
                    onChange={(event) => setQueryInput(event.target.value)}
                    placeholder="항목 · 주문번호 · 주문자 · 연락처"
                    maxLength={100}
                    disabled={busy}
                  />
                  <select
                    className={`${inputClass} mt-0 sm:w-auto`}
                    aria-label="결제 상태 필터"
                    value={filter}
                    disabled={busy}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (value === "" || isPaymentState(value)) {
                        setFilter(value);
                        setPage(0);
                      }
                    }}
                  >
                    <option value="">전체 상태</option>
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className={buttonClass}
                    disabled={busy || listingLoading}
                  >
                    검색
                  </button>
                </form>
                <div
                  className="hidden grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_1fr] gap-3 px-4 text-xs text-gray-400 sm:grid"
                  aria-hidden="true"
                >
                  <span>결제 항목</span>
                  <span>금액</span>
                  <span>주문자</span>
                  <span>상태</span>
                  <span>발급일</span>
                </div>
                {listingLoading && (
                  <p role="status" className="text-gray-400">
                    결제 내역을 불러오는 중입니다.
                  </p>
                )}
                {!listingLoading && !error && !invoices.length && (
                  <p className="text-gray-400">
                    조건에 맞는 결제 내역이 없습니다.
                  </p>
                )}
                {!listingLoading &&
                  invoices.map((invoice) => (
                    <details
                      key={invoice.token}
                      className="group min-w-0 rounded-xl border border-gray-700 p-4"
                    >
                      <summary
                        className="grid cursor-pointer list-none grid-cols-2 items-center gap-3 text-sm sm:grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_1fr]"
                        aria-label={`${invoice.title} 상세`}
                      >
                        <span className="min-w-0 break-words font-semibold">
                          <span
                            aria-hidden="true"
                            className="mr-2 inline-block text-gray-400 group-open:rotate-90"
                          >
                            ▸
                          </span>
                          {invoice.title}
                        </span>
                        <span className="break-words">
                          {won(invoice.amount)}
                        </span>
                        <span className="min-w-0 break-words text-gray-300">
                          {invoice.buyerName || "미입력"}
                        </span>
                        <span
                          className={
                            invoice.state === "paid"
                              ? "text-green-300"
                              : invoice.state === "review"
                                ? "text-amber-200"
                                : "text-gray-300"
                          }
                        >
                          {statusLabels[invoice.state]}
                        </span>
                        <span className="col-span-2 text-xs text-gray-400 sm:col-span-1">
                          {new Date(invoice.createdAt).toLocaleDateString(
                            "ko-KR",
                          )}
                        </span>
                      </summary>
                      <div className="mt-4 border-t border-gray-700 pt-3">
                        <p className="text-sm text-gray-400">
                          {invoice.taxType === "taxable"
                            ? "부가세 포함"
                            : "면세"}
                        </p>
                        <p className="mt-2 text-sm text-gray-400">
                          유효기간: {date(invoice.expiresAt)}
                        </p>
                        <p className="mt-1 break-all text-sm text-gray-400">
                          주문번호: {invoice.orderNo}
                        </p>
                        {invoice.tid && (
                          <p className="mt-1 break-all text-sm text-gray-400">
                            거래번호: {invoice.tid}
                          </p>
                        )}
                        {invoice.buyerName && (
                          <p className="mt-1 break-all text-sm text-gray-300">
                            {invoice.buyerName} · {invoice.buyerPhone}
                          </p>
                        )}
                        {invoice.note && (
                          <p className="mt-3 text-sm text-amber-200">
                            {invoice.note}
                          </p>
                        )}
                        {invoice.terms && (
                          <p className="mt-3 whitespace-pre-wrap break-words text-sm text-gray-300">
                            {invoice.terms}
                          </p>
                        )}
                        <div className="mt-3 flex min-w-0 flex-wrap items-center gap-3">
                          <input
                            aria-label={`${invoice.title} 결제 링크`}
                            className="min-w-0 flex-1 rounded bg-gray-800 px-3 py-2 text-sm"
                            readOnly
                            value={link(invoice)}
                            onFocus={(event) => event.currentTarget.select()}
                          />
                          <button
                            className="min-h-11 text-sm text-blue-400 hover:underline"
                            type="button"
                            onClick={() => void copy(invoice)}
                          >
                            링크 복사
                          </button>
                          {invoice.state === "pending" && (
                            <button
                              className="min-h-11 text-sm text-red-300 hover:underline"
                              type="button"
                              disabled={busy}
                              onClick={() => void expire(invoice)}
                            >
                              링크 종료
                            </button>
                          )}
                          <Link
                            className="min-h-11 content-center text-sm text-blue-400 hover:underline"
                            to={`/pay/${invoice.token}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            열기
                          </Link>
                        </div>
                      </div>
                    </details>
                  ))}
                <nav
                  className="flex items-center justify-between gap-3"
                  aria-label="결제 내역 페이지"
                >
                  <button
                    className="min-h-11 rounded-lg border border-gray-600 px-4 py-2 disabled:opacity-40"
                    type="button"
                    disabled={busy || listingLoading || page === 0}
                    onClick={() => setPage((value) => value - 1)}
                  >
                    이전
                  </button>
                  <span className="text-sm text-gray-400">
                    {page + 1} 페이지 · 페이지당 20건
                  </span>
                  <button
                    className="min-h-11 rounded-lg border border-gray-600 px-4 py-2 disabled:opacity-40"
                    type="button"
                    disabled={busy || listingLoading || !hasMore}
                    onClick={() => setPage((value) => value + 1)}
                  >
                    다음
                  </button>
                </nav>
              </section>
            </>
          )}
        </>
      )}
    </Layout>
  );
}
