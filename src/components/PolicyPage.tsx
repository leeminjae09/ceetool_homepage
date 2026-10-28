import { useEffect, type ReactNode } from "react";
import { Link } from "react-router-dom";
import BusinessInfo from "components/BusinessInfo";

const linkClass =
  "rounded text-blue-300 underline underline-offset-4 hover:text-blue-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-400";

export function PrivacyCollectionNotice() {
  return (
    <>
      씨툴은 결제 및 계약 이행을 위해 이름과 연락처를 수집합니다. 이름·연락처는
      결제 완료 후 5년간 보관하며, 미결제 주문은 유효기간 종료 후 30일 이내
      삭제합니다. 동의를 거부하면 결제를 진행할 수 없습니다.
    </>
  );
}

function PolicySection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {children}
    </section>
  );
}

function PolicyContact() {
  return (
    <address className="space-y-2 not-italic">
      <p>담당 창구: 씨툴(CEETOOL)</p>
      <p>
        이메일:{" "}
        <a className={linkClass} href="mailto:john@ceetool.com">
          john@ceetool.com
        </a>
      </p>
      <p>
        전화:{" "}
        <a className={linkClass} href="tel:01021956202">
          010-2195-6202
        </a>
      </p>
    </address>
  );
}

function PrivacyPolicy() {
  return (
    <>
      <p>
        씨툴(CEETOOL)은 홈페이지와 고객별 결제 링크를 운영하면서 아래와 같이
        개인정보를 처리합니다. 외부 카카오톡 채널이나 결제대행사의 화면에서 직접
        수집하는 정보에는 해당 서비스의 개인정보처리방침도 적용됩니다.
      </p>
      <PolicySection title="1. 처리 목적과 수집 항목">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            결제·계약 이행 및 거래 확인: 주문자 이름, 연락처, 주문번호,
            서비스명, 금액, 결제 상태·시각, 거래 식별정보, 동의 시각
          </li>
          <li>
            상담·취소·환불 문의: 이용자가 직접 알려 주는 연락 가능한 정보,
            주문번호 및 문의 내용
          </li>
          <li>
            결제 페이지 접속 알림 중복 방지: 무작위 방문 식별 쿠키와 그 해시값,
            결제 링크 식별정보, 알림 시각
          </li>
          <li>
            관리자 인증: 허용된 Google 계정의 이메일, 로그인 세션 및 로그인 보안
            확인값
          </li>
        </ul>
        <p>
          카드번호 전체, 카드 비밀번호, CVC 등 카드 인증정보를 씨툴의 입력란이나
          문의 창구로 수집하지 않습니다. 카드 인증은 결제대행사의 결제창에서
          진행합니다.
        </p>
      </PolicySection>
      <PolicySection title="2. 수집 방법과 필수 정보">
        <p>
          주문자가 결제 화면에 입력하거나, 계약 상담 과정에서 전달한 정보를
          사용합니다. 관리자가 미리 입력한 이름·연락처는 결제 전 주문자가
          확인·수정할 수 있습니다. 문의 정보는 이메일·전화 등 이용자가 선택한
          연락 수단으로 접수합니다.
        </p>
        <p>
          <PrivacyCollectionNotice />
        </p>
      </PolicySection>
      <PolicySection title="3. 보유 기간과 파기">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            결제 주문의 이름·연락처: 결제 완료 후 5년을 기준으로 정리합니다.
            미결제 주문의 이름·연락처는 유효기간 종료 후 30일 이내 삭제합니다.
          </li>
          <li>
            일반 문의: 문의 처리 목적을 달성하면 불필요한 개인정보를 지체 없이
            파기합니다. 계약·거래 관련 자료로 보존이 필요한 경우 관계 법령에
            따른 기간 동안 보관합니다.
          </li>
          <li>
            방문 식별 쿠키 및 접속 알림 중복 방지 기록: 최대 30일을 기준으로
            정리합니다.
          </li>
          <li>
            관리자 로그인 세션의 유효기간은 최대 8시간, 로그인 보안 확인값의
            유효기간은 최대 10분입니다. 만료된 서버 기록은 정기적으로
            정리합니다.
          </li>
          <li>
            발송 완료한 거래 알림의 본문 데이터: 발송 후 30일이 지나면
            삭제합니다. 미발송 알림은 처리될 때까지 보관합니다.
          </li>
        </ul>
        <p>
          보존 목적이 종료된 전자적 개인정보는 해당 필드를 삭제하는 등 복구하여
          이용하지 않도록 처리합니다. 법령상 보존 의무가 있는 자료는 그 의무를
          이행하는 범위에서 처리하며, 관련 정보가 필요한 경우 아래 창구로 문의할
          수 있습니다.
        </p>
      </PolicySection>
      <PolicySection title="4. 결제 정보 전달 및 외부 서비스 이용">
        <p>
          씨툴은 결제·서비스 운영에 필요한 범위에서 다음 서비스를 이용합니다.
          개인정보를 판매하거나 광고 목적으로 제공하지 않으며, 별도의 동의나
          법령상 근거가 필요한 제공은 그 절차에 따릅니다.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <a
              className={linkClass}
              href="https://paysm.co.kr/"
              target="_blank"
              rel="noopener noreferrer"
            >
              주식회사 페이즘(PaySM, 새 창)
            </a>
            : 신용카드 결제 처리·거래 확인. 주문자 이름·연락처, 주문번호,
            서비스명, 금액 및 거래 식별정보를 전달합니다. 결제창의 별도 약관과
            개인정보 안내도 확인해 주세요.
          </li>
          <li>
            Amazon Web Services(AWS): 웹서비스·데이터베이스·미디어 운영 및
            관리자 대상 거래 알림 발송. 알림에는 주문번호·결제 항목·금액을
            전달하며, 주문자 이름·연락처 필드는 별도로 포함하지 않습니다.
          </li>
          <li>
            Google: 관리자 계정 인증. 일반 결제 고객에게 Google 로그인을
            요구하지 않습니다.
          </li>
        </ul>
        <p>
          외부 서비스가 직접 수집하는 정보의 처리·보관에 대해서는 해당 사업자의
          안내가 함께 적용됩니다. 씨툴의 처리 업무와 관련된 문의는 아래 창구에서
          받습니다.
        </p>
      </PolicySection>
      <PolicySection title="5. 쿠키와 자동 처리">
        <p>
          결제 접속 알림의 중복 방지와 관리자 로그인 보안을 위해 쿠키를
          사용합니다. 방문 식별값은 무작위로 생성하며 서버에는 해시값으로
          보관합니다. 방문 식별 쿠키는 최대 30일, 관리자 로그인 쿠키는 최대
          8시간, 로그인 보안 쿠키는 최대 10분 동안 유지합니다.
        </p>
        <p>
          브라우저 설정에서 쿠키를 삭제하거나 저장을 거부할 수 있습니다. 쿠키를
          거부하면 관리자 로그인 등 일부 기능이 제한될 수 있습니다.
        </p>
      </PolicySection>
      <PolicySection title="6. 이용자의 권리와 행사 방법">
        <p>
          개인정보의 열람·정정·삭제·처리정지 및 동의 철회를 아래 문의 창구로
          요청할 수 있습니다. 본인 또는 정당한 대리인인지 확인한 뒤 관계 법령에
          따라 처리합니다. 법령상 보존 의무가 있는 정보는 즉시 삭제가 제한될 수
          있으며, 제한 사유를 안내합니다.
        </p>
      </PolicySection>
      <PolicySection title="7. 안전성 확보">
        <p>
          HTTPS 통신, 관리자 인증과 허용 계정 확인, 접근 권한 제한, 보관기간이
          지난 정보 정리 등 개인정보 보호를 위한 조치를 적용합니다.
        </p>
      </PolicySection>
      <PolicySection title="8. 개인정보 보호 문의·고충처리">
        <PolicyContact />
      </PolicySection>
      <PolicySection title="9. 방침 변경">
        <p>
          처리 항목·목적·운영 방식 등이 변경되면 이 페이지에 변경된 내용과
          시행일을 공개하며, 별도 안내나 동의가 필요한 경우 관련 절차를
          진행합니다.
        </p>
      </PolicySection>
    </>
  );
}

function RefundPolicy() {
  return (
    <>
      <p>
        이 안내는 씨툴(CEETOOL)의 맞춤형 소프트웨어 개발·시스템 연동 등 용역
        결제에 적용됩니다. 결제 전 견적서·계약서 및 결제 화면에 표시된 개별
        계약·환불조건을 확인해 주세요. 조건이 불명확하면 결제 전에 문의해
        주세요.
      </p>
      <PolicySection title="1. 적용 기준">
        <p>
          취소·환불은 개별 계약, 결제 전에 안내한 조건 및 관계 법령에 따라
          판단합니다. 계약이나 이 안내로 관계 법령에 따른 이용자의 권리를
          제한하지 않습니다. 별도 환불조건이 표시되지 않았다는 이유만으로 환불이
          불가능한 것은 아닙니다.
        </p>
      </PolicySection>
      <PolicySection title="2. 진행 단계별 확인">
        <p>
          작업 착수 전·진행 중·납품 후의 상태, 합의한 개발 범위, 이미 제공한
          용역 및 산출물 등을 확인해 환불 대상과 범위를 안내합니다. 일률적인
          환불 비율이나 기간을 이 페이지에서 정하지 않으며, 맞춤 개발이라는
          이유만으로 모든 취소·환불 요청을 배제하지 않습니다.
        </p>
      </PolicySection>
      <PolicySection title="3. 취소·환불 접수">
        <p>
          아래 창구에 주문번호, 연락 가능한 정보와 요청 내용을 알려 주세요.
          거래와 계약 내용을 확인한 뒤 처리 가능 여부 및 후속 절차를 안내합니다.
          카드번호 전체·카드 비밀번호·CVC 등 인증정보는 보내지 마세요.
        </p>
        <PolicyContact />
      </PolicySection>
      <PolicySection title="4. 신용카드 결제 취소">
        <p>
          확정된 취소·환불은 결제대행사 및 카드사의 절차에 따라 처리합니다. 카드
          승인 취소가 명세서에 반영되는 시점은 카드사와 결제일 등에 따라 달라질
          수 있으며, 실제 처리 결과를 기준으로 안내합니다.
        </p>
      </PolicySection>
      <PolicySection title="5. 결제 링크 종료와 결제 상태">
        <p>
          미결제 링크의 유효기간 만료나 링크 종료는 이미 승인된 결제의 환불을
          의미하지 않습니다. 결제창을 닫았거나 화면에 오류가 표시되었더라도 실제
          청구 여부는 거래 확인이 필요합니다. 결제 상태가 불명확하면 다시
          결제하기 전에 씨툴로 문의해 주세요.
        </p>
      </PolicySection>
    </>
  );
}

export default function PolicyPage({
  policy,
}: {
  policy: "privacy" | "refund";
}) {
  const title = policy === "privacy" ? "개인정보처리방침" : "취소·환불 안내";
  useEffect(() => {
    const previousTitle = document.title;
    const canonical = document.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );
    const previousCanonical = canonical?.href;
    document.title = `${title} | CEETOOL(씨툴)`;
    if (canonical) canonical.href = `https://ceetool.com/${policy}`;
    return () => {
      document.title = previousTitle;
      if (canonical && previousCanonical) canonical.href = previousCanonical;
    };
  }, [policy, title]);

  return (
    <main className="payment-page text-gray-100">
      <div className="mx-auto max-w-3xl break-keep [overflow-wrap:anywhere]">
        <header className="mb-8">
          <Link className={linkClass} to="/">
            홈으로 돌아가기
          </Link>
          <h1 className="mt-6 text-2xl font-bold sm:text-3xl">{title}</h1>
          <p className="mt-3 text-sm text-gray-400">
            시행일: <time dateTime="2026-10-28">2026년 10월 28일</time>
          </p>
        </header>
        <article className="space-y-8 text-sm leading-7 text-gray-300">
          {policy === "privacy" ? <PrivacyPolicy /> : <RefundPolicy />}
        </article>
        <BusinessInfo className="mt-10 space-y-1 border-t border-gray-700 pt-5 text-xs leading-relaxed text-gray-400" />
      </div>
    </main>
  );
}
