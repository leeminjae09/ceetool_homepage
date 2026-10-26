export default function BusinessInfo({
  className,
  showAdminLink = false,
}: {
  className: string;
  showAdminLink?: boolean;
}) {
  return (
    <footer className={className}>
      <p>
        씨툴(CEETOOL) | 업태: 정보통신업
        <br className="block sm:hidden" />
        <span className="hidden sm:inline"> | </span>
        <span>사업자등록번호: 886-12-02119</span>
      </p>
      <p>경기도 성남시 수정구 복정로72번길 10, 401호 (복정동)</p>
      <p>
        <span className="block sm:inline">전화번호: 010-2195-6202</span>
        <span className="hidden sm:inline"> | </span>
        <span className="block sm:inline">
          이메일:{" "}
          <a
            href="mailto:john@ceetool.com"
            className="text-blue-500 hover:underline font-semibold"
          >
            john@ceetool.com
          </a>
        </span>
      </p>
      {showAdminLink && (
        <p className="pt-3">
          <a
            href="/admin/payments"
            className="inline-flex min-h-11 items-center rounded text-xs font-normal text-gray-400 hover:text-gray-200 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-400"
          >
            관리자
          </a>
        </p>
      )}
    </footer>
  );
}
