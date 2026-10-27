export default function BusinessInfo({
  className,
}: {
  className: string;
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
    </footer>
  );
}
