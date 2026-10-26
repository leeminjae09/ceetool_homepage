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
import {
  paymentApi,
  PaymentApiError,
  type AdminInvoice,
  type AdminSession,
  type Checkout,
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
}: {
  checkout: Checkout;
  busy: boolean;
  onClose: () => void;
  onApproval: (auth: Record<string, string>) => void;
  onError: (error: string) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const submitted = useRef(false);
  const handling = useRef(false);
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
  }, [checkout, onApproval, onClose, onError]);
  return (
    <dialog
      ref={dialogRef}
      aria-label="카드 결제"
      aria-modal="true"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
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
          onClick={onClose}
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
  const close = useCallback(() => setCheckout(null), []);
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
                  required
                  maxLength={24}
                  disabled={busy}
                />
              </label>
              <details className="rounded-lg border border-gray-700 p-3 text-sm">
                <summary className="cursor-pointer">계약·환불조건</summary>
                <p className="mt-3 whitespace-pre-wrap break-words leading-relaxed text-gray-300">
                  {invoice.terms}
                </p>
              </details>
              <details className="rounded-lg border border-gray-700 p-3 text-sm">
                <summary className="cursor-pointer">개인정보 수집·이용</summary>
                <p className="mt-3 leading-relaxed text-gray-300">
                  씨툴은 결제 및 계약 이행을 위해 이름과 연락처를 수집합니다.
                  이름·연락처는 결제 완료 후 5년간 보관하며, 미결제 주문은
                  유효기간 종료 후 30일 이내 삭제합니다. 보관기간이 종료된
                  정보가 포함된 백업본은 7일 이내 순환 삭제합니다. 동의를
                  거부하면 결제를 진행할 수 없습니다.
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
                <span>계약·환불조건 및 개인정보 수집·이용에 동의합니다.</span>
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
export function PaymentAdminPage() {
  const [params] = useSearchParams();
  const [session, setSession] = useState<AdminSession | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [invoices, setInvoices] = useState<AdminInvoice[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    async function load() {
      setError("");
      setUnavailable(false);
      try {
        const current = await paymentApi.session();
        if (!active) return;
        setSession(current);
        if (current) {
          const result = await paymentApi.invoices();
          if (!active) return;
          setInvoices(result.invoices);
          setHasMore(result.hasMore);
          setPage(0);
        }
      } catch (err) {
        if (active) {
          setError(message(err));
          setUnavailable(err instanceof PaymentApiError && err.status === 503);
        }
      } finally {
        if (active) setLoaded(true);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [revision]);
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
          amount: Number(form.get("amount")),
          taxType,
          terms: String(form.get("terms") || ""),
          expiresAt: new Date(String(form.get("expiresAt") || "")).getTime(),
        },
        session.csrfToken,
      );
      setInvoices((previous) => [created, ...previous]);
      setRevision((value) => value + 1);
      setNotice("결제 링크를 발급했습니다.");
      formElement.reset();
    } catch (err) {
      operationError(err);
    } finally {
      setBusy(false);
    }
  }
  async function more() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const nextPage = page + 1;
      const result = await paymentApi.invoices(nextPage);
      setInvoices((previous) => [
        ...previous,
        ...result.invoices.filter(
          (item) => !previous.some((old) => old.token === item.token),
        ),
      ]);
      setHasMore(result.hasMore);
      setPage(nextPage);
    } catch (err) {
      operationError(err);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    if (!session || busy) return;
    setBusy(true);
    setError("");
    try {
      await paymentApi.logout(session.csrfToken);
      setSession(null);
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
    } catch (err) {
      operationError(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Layout title="결제 관리" wide>
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
            <button
              type="button"
              className="text-blue-400 hover:underline"
              onClick={() => setRevision((value) => value + 1)}
              disabled={busy}
            >
              내역 새로고침
            </button>
          </div>
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
                  type="number"
                  min={1}
                  step={1}
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
              계약·환불조건
              <textarea
                className={`${inputClass} min-h-28`}
                name="terms"
                required
                maxLength={2000}
                disabled={busy}
              />
            </label>
            <button
              type="submit"
              className={buttonClass}
              disabled={busy || !session.paymentConfigured}
            >
              {busy ? "처리 중…" : "링크 발급"}
            </button>
          </form>
          <section className="mt-8 space-y-4" aria-label="결제 내역">
            <h2 className="text-lg font-semibold">결제 내역</h2>
            {!invoices.length && (
              <p className="text-gray-400">발급한 결제 링크가 없습니다.</p>
            )}
            {invoices.map((invoice) => (
              <article
                key={invoice.token}
                className="min-w-0 rounded-xl border border-gray-700 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="min-w-0 flex-1 break-words font-semibold">
                    {invoice.title}
                  </h3>
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
                </div>
                <p className="mt-2">
                  {won(invoice.amount)} ·{" "}
                  {invoice.taxType === "taxable" ? "부가세 포함" : "면세"}
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
                  <p className="mt-3 text-sm text-amber-200">{invoice.note}</p>
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
              </article>
            ))}
            {hasMore && (
              <button
                className={buttonClass}
                type="button"
                disabled={busy}
                onClick={() => void more()}
              >
                이전 내역 더 보기
              </button>
            )}
          </section>
        </>
      )}
    </Layout>
  );
}
