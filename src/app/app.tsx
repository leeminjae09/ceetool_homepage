import {
  CodeBracketIcon,
  CreditCardIcon,
  BanknotesIcon,
  ServerStackIcon,
  ChartBarIcon,
  Cog6ToothIcon,
} from "@heroicons/react/24/outline";


function App() {
  return (
    <main>
      <header className="pt-16 z-10 relative max-w-screen-lg xl:max-w-screen-xl mx-auto">
        <h3 className="text-2xl sm:text-4xl leading-none font-bold tracking-tight text-white">
          <span className="inline-flex items-center gap-2">
            <span className="text-[kakao] opacity-75">SOFTWARE</span>
            <span className="text-purple-200 ml-1">DEVELOPER</span>
          </span>
        </h3>

        <h1 className="text-6xl lg:text-7xl leading-none font-extrabold tracking-tight mb-8 sm:mb-10 text-purple-400">
          CEETOOL
        </h1>

        <p className="max-w-screen-lg text-lg sm:text-xl text-gray-300 font-medium mb-10 sm:mb-11 leading-relaxed">
          <span className="text-blue-500 font-bold">15년 경력</span>의 백엔드 개발자와{" "}
          <span className="text-blue-500 font-bold">숙련된 프론트엔드 팀</span>이
          결제연동·거래소·투자증권·금융·공공기관 프로젝트를{" "}
          <span className="text-blue-500 font-bold">전문적으로 수행</span>합니다.{" "}
          <span className="text-blue-500 font-bold">안정적인 운영</span>과{" "}
          <span className="text-blue-500 font-bold">철저한 보안</span>,{" "}
          <span className="text-blue-500 font-bold">24시간 모니터링</span>으로 신뢰할 수 있는{" "}
          <span className="text-blue-500 font-bold">맞춤형 솔루션</span>을 제공합니다.
        </p>

        <div className="absolute top-16 right-2 sm:top-12 sm:right-12 opacity-30 sm:opacity-50">
          <img
            src="/ceetool.logo.png"
            alt="Ceetool Logo"
            className="w-20 h-20 sm:w-40 sm:h-40 object-contain"
          />
        </div>

      </header>
      <section className="max-w-screen-lg xl:max-w-screen-xl mx-auto my-6">
        <div className="sm:flex sm:space-x-6 space-y-4 sm:space-y-0 items-center">
          {/* Telegram Button */}
          <a
            href="https://t.me/etimjang"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-blue-500 text-white font-bold px-6 py-3 rounded-lg flex items-center space-x-3"
          >
            <img src="/telegram-logo.png" alt="Telegram" className="w-5 h-5" />
            <span>@etimjang</span>
          </a>

          {/* KakaoTalk Button */}
          <a
            href="https://open.kakao.com/o/abc12345"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-kakao text-black px-6 py-3 rounded-lg font-bold flex items-center space-x-3"
          >
            <img src="/kakao-logo.png" alt="KakaoTalk" className="w-5 h-5" />
            <span>johnlee4</span>
          </a>
        </div>
      </section>
      <section className="max-w-screen-lg xl:max-w-screen-xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* 웹사이트 개발 */}
        <div className="bg-gray-800 p-6 rounded-lg text-white flex flex-col min-h-[280px]">
          <h2 className="text-xl font-bold text-blue-400">웹사이트 개발</h2>
          <p className="text-sm text-gray-300">쇼핑몰·어드민 페이지, 서버 이전, 시스템 연동 등 다양한 웹사이트 구축 경험</p>
          <ul className="list-disc list-inside text-sm text-gray-400 space-y-1">
            <li>DSWAR Market – 쇼핑몰·어드민 페이지 제작</li>
            <li>청담 쇼핑몰 – 서버 이전·파싱 자동화</li>
            <li>주다스 글로벌 쇼핑몰 – 페이버스 결제 취소 API 개발</li>
            <li>스카이젯 – 비동기화 전환·통합결제 모듈 연동</li>
            <li>크리에이티브코드 – HTS 복구·차트 API 연동</li>
            <li>코레일 – 소켓 통신 페이지 제작</li>
          </ul>
          <div className="mt-auto flex justify-between items-end pt-6">
            <a href="#" className="text-sm font-bold text-white hover:underline">View documentation →</a>
            <CodeBracketIcon className="w-8 h-8 text-gray-400" />
          </div>
        </div>

        {/* 결제 연동 */}
        <div className="bg-gray-800 p-6 rounded-lg text-white flex flex-col min-h-[280px]">
          <h2 className="text-xl font-bold text-blue-400">결제 연동</h2>
          <p className="text-sm text-gray-300">신용카드, USDT, PayPal 등 다양한 결제 수단 통합 및 WooCommerce 연동</p>
          <ul className="list-disc list-inside text-sm text-gray-400 space-y-1">
            <li>C9Pro – 카드·USDT·PayPal·멤버십 연동</li>
            <li>ForYouPay – 우커머스 통합결제 플러그인</li>
            <li>업비트 데모 – PC/앱 버전 통합</li>
            <li>쿠키페이PG – WooCommerce PG 연동</li>
          </ul>
          <div className="mt-auto flex justify-between items-end pt-6">
            <a href="#" className="text-sm font-bold text-white hover:underline">View documentation →</a>
            <CreditCardIcon className="w-8 h-8 text-gray-400" />
          </div>
        </div>

        {/* 코인 개발 */}
        <div className="bg-gray-800 p-6 rounded-lg text-white flex flex-col min-h-[280px]">
          <h2 className="text-xl font-bold text-blue-400">코인 개발</h2>
          <p className="text-sm text-gray-300">메인넷 구축, 거래소 연동, 코인 전송 및 SWAP API 개발 등 블록체인 기반 시스템</p>
          <ul className="list-disc list-inside text-sm text-gray-400 space-y-1">
            <li>이더메인넷 – 코인 전송·Blockscout 구축</li>
            <li>파이&솔라나 – Solana SWAP·MEME API</li>
            <li>Digifinex – MM 시장조성 로직</li>
            <li>테더마스터 – 거래소 연동 페이지</li>
          </ul>
          <div className="mt-auto flex justify-between items-end pt-6">
            <a href="#" className="text-sm font-bold text-white hover:underline">View documentation →</a>
            <BanknotesIcon className="w-8 h-8 text-gray-400" />
          </div>
        </div>

        {/* API·플랫폼 */}
        <div className="bg-gray-800 p-6 rounded-lg text-white flex flex-col min-h-[280px]">
          <h2 className="text-xl font-bold text-blue-400">API·플랫폼</h2>
          <p className="text-sm text-gray-300">ERP, 공공기관 API, 내부 플랫폼 등 다양한 B2B API 및 플랫폼 개발 경험</p>
          <ul className="list-disc list-inside text-sm text-gray-400 space-y-1">
            <li>ASDS – 판매 API 플랫폼 제작</li>
            <li>Figwts – 주문 API·차트 API</li>
            <li>Cotafa – 연말 정산 자동화</li>
            <li>KIPVC – KICS 통합·테이블 설계</li>
          </ul>
          <div className="mt-auto flex justify-between items-end pt-6">
            <a href="#" className="text-sm font-bold text-white hover:underline">View documentation →</a>
            <ServerStackIcon className="w-8 h-8 text-gray-400" />
          </div>
        </div>

        {/* 데이터 분석 */}
        <div className="bg-gray-800 p-6 rounded-lg text-white flex flex-col min-h-[280px]">
          <h2 className="text-xl font-bold text-blue-400">데이터 분석</h2>
          <p className="text-sm text-gray-300">금융 데이터 수집, 오픈 API 연구, 데이터 기반 의사결정 지원 분석툴</p>
          <ul className="list-disc list-inside text-sm text-gray-400 space-y-1">
            <li>빗썸 김치프리미엄 – 거래 데이터 10만건</li>
            <li>investLog – 이용약관·개인정보 방침 작성</li>
            <li>금결원 파워볼 – 금융결제원 오픈 API 연구</li>
          </ul>
          <div className="mt-auto flex justify-between items-end pt-6">
            <a href="#" className="text-sm font-bold text-white hover:underline">View documentation →</a>
            <ChartBarIcon className="w-8 h-8 text-gray-400" />
          </div>
        </div>

        {/* 툴·자동화 */}
        <div className="bg-gray-800 p-6 rounded-lg text-white flex flex-col min-h-[280px]">
          <h2 className="text-xl font-bold text-blue-400">툴·자동화</h2>
          <p className="text-sm text-gray-300">업로드 툴, FTP 자동화, 알림 시스템 등 운영을 위한 다양한 자동화 도구 개발</p>
          <ul className="list-disc list-inside text-sm text-gray-400 space-y-1">
            <li>플리키 – 상품 자동업로드·워터마크</li>
            <li>SayHello – FTP API + 콘솔 툴</li>
            <li>MD AUTO – 퍼블리싱 + 텔레그램 알림</li>
          </ul>
          <div className="mt-auto flex justify-between items-end pt-6">
            <a href="#" className="text-sm font-bold text-white hover:underline">View documentation →</a>
            <Cog6ToothIcon className="w-8 h-8 text-gray-400" />
          </div>
        </div>
      </section>
<footer className="pb-16 max-w-screen-lg xl:max-w-screen-xl mx-auto text-center text-gray-400 font-bold text-sm leading-relaxed space-y-1">
  <p>
    씨툴(CEETOOL) | 업태: 정보통신업
    <br className="block sm:hidden" />
    <span className="hidden sm:inline"> | </span>
    <span className="inline sm:inline">사업자등록번호: 886-12-02119</span>
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



    </main>
  );
}

export default App;
