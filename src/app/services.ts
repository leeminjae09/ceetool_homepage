import {
  CodeBracketIcon,
  CreditCardIcon,
  BanknotesIcon,
  ServerStackIcon,
  ChartBarIcon,
  Cog6ToothIcon,
} from "@heroicons/react/24/outline";
import type { PortfolioProjectId } from "app/portfolio";

export interface ServiceProject {
  name: string;
  description: string;
  portfolioId?: PortfolioProjectId;
}

export interface Service {
  title: string;
  href: string;
  description: string;
  Icon: typeof CodeBracketIcon;
  projects: readonly ServiceProject[];
}

export const services: Service[] = [
  {
    title: "웹사이트 개발",
    href: "/docs/nft-market",
    description:
      "쇼핑몰·어드민 페이지, 서버 이전, 시스템 연동 등 다양한 웹사이트 구축 경험",
    Icon: CodeBracketIcon,
    projects: [
      {
        name: "DSWAR Market",
        description: "쇼핑몰·어드민 페이지 제작",
        portfolioId: "dswar",
      },
      {
        name: "신이 홈페이지",
        description: "결제 및 예약 관리시스템 개발",
        portfolioId: "shini",
      },
      {
        name: "주다스 글로벌 쇼핑몰",
        description: "페이버스 결제 취소 API 개발",
      },
      { name: "스카이젯", description: "비동기화 전환·통합결제 모듈 연동" },
      { name: "크리에이티브코드", description: "HTS 복구·차트 API 연동" },
      { name: "코레일", description: "소켓 통신 페이지 제작" },
    ],
  },
  {
    title: "결제 연동",
    href: "/docs/payment-integration",
    description:
      "신용카드, USDT, PayPal 등 다양한 결제 수단 통합 및 WooCommerce 연동",
    Icon: CreditCardIcon,
    projects: [
      {
        name: "C9Pro",
        description: "카드·USDT·PayPal·멤버십 연동",
        portfolioId: "c9pro",
      },
      { name: "ForYouPay", description: "우커머스 통합결제 플러그인" },
      { name: "업비트 데모", description: "PC/앱 버전 통합" },
      { name: "쿠키페이PG", description: "WooCommerce PG 연동" },
    ],
  },
  {
    title: "코인 개발",
    href: "/docs/coin-development",
    description:
      "메인넷 구축, 거래소 연동, 코인 전송 및 SWAP API 개발 등 블록체인 기반 시스템",
    Icon: BanknotesIcon,
    projects: [
      { name: "이더메인넷", description: "코인 전송·Blockscout 구축" },
      { name: "파이&솔라나", description: "Solana SWAP·MEME API" },
      { name: "Digifinex", description: "MM 시장조성 로직" },
      { name: "테더마스터", description: "거래소 연동 페이지" },
    ],
  },
  {
    title: "API·플랫폼",
    href: "/docs/api-platform",
    description:
      "ERP, 공공기관 API, 내부 플랫폼 등 다양한 B2B API 및 플랫폼 개발 경험",
    Icon: ServerStackIcon,
    projects: [
      { name: "ASDS", description: "판매 API 플랫폼 제작" },
      { name: "Figwts", description: "주문 API·차트 API" },
      { name: "Cotafa", description: "연말 정산 자동화" },
      { name: "KIPVC", description: "KICS 통합·테이블 설계" },
    ],
  },
  {
    title: "데이터 분석",
    href: "/docs/data-analysis",
    description:
      "금융 데이터 수집, 오픈 API 연구, 데이터 기반 의사결정 지원 분석툴",
    Icon: ChartBarIcon,
    projects: [
      { name: "빗썸 김치프리미엄", description: "거래 데이터 10만건" },
      { name: "investLog", description: "이용약관·개인정보 방침 작성" },
      { name: "금결원 파워볼", description: "금융결제원 오픈 API 연구" },
    ],
  },
  {
    title: "툴·자동화",
    href: "/docs/automation-tools",
    description:
      "업로드 툴, FTP 자동화, 알림 시스템 등 운영을 위한 다양한 자동화 도구 개발",
    Icon: Cog6ToothIcon,
    projects: [
      { name: "플리키", description: "상품 자동업로드·워터마크" },
      { name: "SayHello", description: "FTP API + 콘솔 툴" },
      { name: "MD AUTO", description: "퍼블리싱 + 텔레그램 알림" },
    ],
  },
];
