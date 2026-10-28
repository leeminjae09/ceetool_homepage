export default function BusinessInfo({ className }: { className: string }) {
  return (
    <footer className={className}>
      <nav
        aria-label="정책 안내"
        className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pb-2"
      >
        <Link
          to="/privacy"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="개인정보처리방침 (새 창)"
          className="inline-flex min-h-11 items-center rounded font-semibold text-gray-300 hover:text-white hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-400"
        >
          개인정보처리방침
        </Link>
        <Link
          to="/refund"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="취소·환불 안내 (새 창)"
          className="inline-flex min-h-11 items-center rounded text-gray-300 hover:text-white hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-400"
        >
          취소·환불 안내
        </Link>
      </nav>
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
import { Link } from "react-router-dom";
