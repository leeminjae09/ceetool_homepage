import {
  CodeBracketIcon,
  CreditCardIcon,
  BanknotesIcon,
  ServerStackIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  ShoppingBagIcon,
  ChatBubbleLeftRightIcon,
  MegaphoneIcon,
} from "@heroicons/react/24/outline";
import type { PortfolioProjectId } from "app/portfolio";
import type { ProjectDetailsProps } from "components/organisms/project-details/project-details";

export interface ServiceProject {
  name: string;
  description: string;
  portfolioId?: PortfolioProjectId;
  url?: string;
}

interface LegacyService {
  title: string;
  href: string;
  description: string;
  Icon: typeof CodeBracketIcon;
  projects: readonly ServiceProject[];
}

export const legacyServices = [
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
] as const satisfies readonly LegacyService[];

export interface Service {
  title: string;
  tagline: string;
  description: string;
  showcase: readonly [
    {
      label: string;
      project: ServiceProject;
      media?: ProjectDetailsProps["media"][number];
    },
    {
      label: string;
      project: ServiceProject;
      media?: ProjectDetailsProps["media"][number];
    },
  ];
  Icon: LegacyService["Icon"];
  features: readonly string[];
  projects: readonly ServiceProject[];
  featured?: boolean;
}

const [web, payments, blockchain, api, data, automation] = legacyServices;

const aiChatbot = {
  name: "AI 챗봇 연동",
  description: "AI를 활용한 챗봇 연동 개발",
};
const marketingIntegration = {
  name: "메타·인스타그램 마케팅",
  description: "SNS 마케팅 관련 기능 개발",
};
const bankIntegration = {
  name: "은행 API 연동",
  description: "은행 연동 관련 업무 개발",
};

export const services: readonly Service[] = [
  {
    title: "쇼핑몰·웹사이트",
    tagline: "브랜드와 서비스에 맞는 웹사이트",
    showcase: [
      { label: "메인 화면", project: web.projects[0] },
      { label: "상품·서비스 상세 화면", project: web.projects[0] },
    ],
    description:
      "자사몰 제작부터 카페24·WooCommerce 기능 추가, 주문·재고·배송 연동까지.",
    Icon: ShoppingBagIcon,
    featured: true,
    features: [
      "자사몰 맞춤 개발",
      "카페24·WooCommerce 커스터마이징",
      "상품·주문·배송 시스템 연동",
    ],
    projects: [web.projects[0]],
  },
  {
    title: "결제 시스템",
    tagline: "결제부터 취소·정산까지",
    showcase: [
      { label: "고객 결제 화면", project: payments.projects[0] },
      { label: "결제 내역·관리 화면", project: payments.projects[1] },
    ],
    description:
      "새로운 결제 수단을 연결하고 승인·취소·환불 흐름을 구현합니다.",
    Icon: CreditCardIcon,
    features: [
      "국내 카드·해외 결제",
      "결제 링크·정기결제",
      "취소·부분취소·결제 오류 개선",
    ],
    projects: [
      payments.projects[0],
      payments.projects[1],
      web.projects[2],
      web.projects[3],
      payments.projects[3],
    ],
  },
  {
    title: "AI·챗봇",
    tagline: "서비스에 필요한 AI 기능",
    showcase: [
      { label: "챗봇 대화 화면", project: aiChatbot },
      { label: "AI 처리 결과 화면", project: aiChatbot },
    ],
    description:
      "기존 서비스에 AI를 연결해 상담과 문서 처리에 필요한 기능을 만듭니다.",
    Icon: ChatBubbleLeftRightIcon,
    features: [
      "상품·서비스 상담 챗봇",
      "내부 문서 검색·답변",
      "문서 요약·분류 자동화",
    ],
    projects: [aiChatbot],
  },
  {
    title: "마케팅·SNS",
    tagline: "채널과 데이터를 연결하는 기능",
    showcase: [
      { label: "SNS 연동·운영 화면", project: marketingIntegration },
      { label: "성과·통계 화면", project: marketingIntegration },
    ],
    description:
      "메타·인스타그램과 서비스를 연결해 채널 운영과 성과 확인을 돕습니다.",
    Icon: MegaphoneIcon,
    features: [
      "광고 전환 측정 연동",
      "SNS 콘텐츠·고객 문의 연동",
      "마케팅 데이터·보고서",
    ],
    projects: [marketingIntegration],
  },
  {
    title: "업무 자동화·관리 시스템",
    tagline: "반복 업무를 줄이는 맞춤 도구",
    showcase: [
      { label: "업무 관리 화면", project: web.projects[1] },
      { label: "자동화 실행·결과 화면", project: automation.projects[0] },
    ],
    description:
      "예약·정산부터 반복 작업까지, 실제 업무 방식에 맞는 화면과 도구를 만듭니다.",
    Icon: Cog6ToothIcon,
    features: [
      "예약·견적·발주·정산 관리",
      "엑셀·PDF·상품 일괄 처리",
      "관리자 화면·알림·운영 도구",
    ],
    projects: [
      web.projects[1],
      automation.projects[0],
      automation.projects[1],
      api.projects[2],
      automation.projects[2],
      api.projects[0],
      {
        name: "골프 스코어·정산 도구",
        description: "플레이어별 점수·정산 계산",
      },
    ],
  },
  {
    title: "금융·공공 시스템",
    tagline: "복잡한 데이터와 시스템 연결",
    showcase: [
      { label: "업무·API 연동 화면", project: bankIntegration },
      { label: "거래·데이터 조회 화면", project: web.projects[5] },
    ],
    description:
      "은행·금융 API와 기관 업무 시스템을 연결하고 거래·업무 데이터를 처리합니다.",
    Icon: ServerStackIcon,
    features: [
      "은행·금융 API 연동",
      "기관 업무 시스템·데이터 이관",
      "거래 데이터 수집·시스템 통합",
    ],
    projects: [
      bankIntegration,
      web.projects[5],
      web.projects[4],
      payments.projects[2],
      api.projects[1],
      api.projects[3],
      ...data.projects,
    ],
  },
];

export const additionalProjects: readonly ServiceProject[] = [
  ...services.flatMap((service) => service.projects.slice(2)),
  ...blockchain.projects,
];
