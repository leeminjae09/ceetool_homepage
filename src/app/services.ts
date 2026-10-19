import {
  CodeBracketIcon,
  CreditCardIcon,
  BanknotesIcon,
  ServerStackIcon,
  ChartBarIcon,
  Cog6ToothIcon,
} from "@heroicons/react/24/outline";
import type { CardProps } from "components/organisms/card/card";

export const services = [
  {
    title: "웹사이트 개발",
    href: "/docs/nft-market",
    description: "쇼핑몰·어드민 페이지, 서버 이전, 시스템 연동 등 다양한 웹사이트 구축 경험",
    Icon: CodeBracketIcon,
    projects: [
      "DSWAR Market – 쇼핑몰·어드민 페이지 제작",
      "신이 홈페이지 – 결제 및 예약 관리시스템 개발",
      "주다스 글로벌 쇼핑몰 – 페이버스 결제 취소 API 개발",
      "스카이젯 – 비동기화 전환·통합결제 모듈 연동",
      "크리에이티브코드 – HTS 복구·차트 API 연동",
      "코레일 – 소켓 통신 페이지 제작",
    ],
  },
  {
    title: "결제 연동",
    href: "/docs/payment-integration",
    description: "신용카드, USDT, PayPal 등 다양한 결제 수단 통합 및 WooCommerce 연동",
    Icon: CreditCardIcon,
    projects: [
      "C9Pro – 카드·USDT·PayPal·멤버십 연동",
      "ForYouPay – 우커머스 통합결제 플러그인",
      "업비트 데모 – PC/앱 버전 통합",
      "쿠키페이PG – WooCommerce PG 연동",
    ],
  },
  {
    title: "코인 개발",
    href: "/docs/coin-development",
    description: "메인넷 구축, 거래소 연동, 코인 전송 및 SWAP API 개발 등 블록체인 기반 시스템",
    Icon: BanknotesIcon,
    projects: [
      "이더메인넷 – 코인 전송·Blockscout 구축",
      "파이&솔라나 – Solana SWAP·MEME API",
      "Digifinex – MM 시장조성 로직",
      "테더마스터 – 거래소 연동 페이지",
    ],
  },
  {
    title: "API·플랫폼",
    href: "/docs/api-platform",
    description: "ERP, 공공기관 API, 내부 플랫폼 등 다양한 B2B API 및 플랫폼 개발 경험",
    Icon: ServerStackIcon,
    projects: [
      "ASDS – 판매 API 플랫폼 제작",
      "Figwts – 주문 API·차트 API",
      "Cotafa – 연말 정산 자동화",
      "KIPVC – KICS 통합·테이블 설계",
    ],
  },
  {
    title: "데이터 분석",
    href: "/docs/data-analysis",
    description: "금융 데이터 수집, 오픈 API 연구, 데이터 기반 의사결정 지원 분석툴",
    Icon: ChartBarIcon,
    projects: [
      "빗썸 김치프리미엄 – 거래 데이터 10만건",
      "investLog – 이용약관·개인정보 방침 작성",
      "금결원 파워볼 – 금융결제원 오픈 API 연구",
    ],
  },
  {
    title: "툴·자동화",
    href: "/docs/automation-tools",
    description: "업로드 툴, FTP 자동화, 알림 시스템 등 운영을 위한 다양한 자동화 도구 개발",
    Icon: Cog6ToothIcon,
    projects: [
      "플리키 – 상품 자동업로드·워터마크",
      "SayHello – FTP API + 콘솔 툴",
      "MD AUTO – 퍼블리싱 + 텔레그램 알림",
    ],
  },
] satisfies CardProps[];
