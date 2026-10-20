import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { Link, useParams } from "react-router-dom";
import { services } from "app/services";
import ProjectDetails, {
  type ProjectDetailsProps,
} from "./organisms/project-details/project-details";

const mediaBaseUrl = "https://d2fgd6q9oovwa9.cloudfront.net/projects";

interface ServiceDetails {
  description: string;
  showcases?: ProjectDetailsProps[];
}

const serviceDetails: Record<string, ServiceDetails> = {
  "/docs/nft-market": {
    description:
      "쇼핑몰과 어드민 페이지 제작부터 결제·예약 관리, 서버 이전과 시스템 연동까지 웹서비스 구축에 필요한 작업을 수행합니다. 아래에서 DSWAR Market과 신이 홈페이지의 화면을 확인할 수 있습니다.",
    showcases: [
      {
        title: "DSWAR Market",
        url: "https://dswmarket.devwlt.org",
        description:
          "DSWAR Market의 쇼핑몰·어드민 페이지 제작 사례입니다. 공개 화면은 DS.WAR LAND ITEM 사전 판매 샘플로, USDT 또는 럭키박스 토큰을 이용한 아이템 구매 흐름을 보여줍니다.",
        media: [
          {
            type: "image",
            src: `${mediaBaseUrl}/dswar/dswar-ex.png`,
            alt: "DSWAR Market 전체 화면",
          },
          {
            type: "image",
            src: `${mediaBaseUrl}/dswar/one-ex.png`,
            alt: "DSWAR Market 아이템 화면 1",
          },
          {
            type: "image",
            src: `${mediaBaseUrl}/dswar/two-ex.png`,
            alt: "DSWAR Market 아이템 화면 2",
          },
          {
            type: "image",
            src: `${mediaBaseUrl}/dswar/three-ex.png`,
            alt: "DSWAR Market 아이템 화면 3",
          },
          {
            type: "image",
            src: `${mediaBaseUrl}/dswar/shini-ex.png`,
            alt: "웹사이트 제작 참고 화면",
          },
        ],
      },
      {
        title: "신이 홈페이지",
        url: "https://xn--zv4bu7f.com/",
        description:
          "청소 서비스 홈페이지의 결제 및 예약 관리시스템 개발 사례입니다. 서비스 소개 화면과 예약 흐름을 사진과 시연 영상으로 확인할 수 있습니다.",
        media: [
          {
            type: "video",
            src: `${mediaBaseUrl}/shini/shini-ex4.mp4`,
            poster: `${mediaBaseUrl}/shini/shini-ex1.jpg`,
            alt: "신이 홈페이지 시연 영상",
          },
          {
            type: "image",
            src: `${mediaBaseUrl}/shini/shini-ex2.jpg`,
            alt: "신이 홈페이지 소개 화면",
          },
          {
            type: "image",
            src: `${mediaBaseUrl}/shini/shini-ex3.jpg`,
            alt: "신이 홈페이지 상세 화면",
          },
        ],
      },
    ],
  },
  "/docs/payment-integration": {
    description:
      "카드·USDT·PayPal 등 결제 수단과 멤버십 연동, WooCommerce 결제 플러그인 및 PG 연동을 수행합니다. C9Pro 시연 화면에서는 결제 연동 프로젝트의 화면 구성을 확인할 수 있습니다.",
    showcases: [
      {
        title: "C9Pro",
        url: "https://c9-pro.com",
        description:
          "카드·USDT·PayPal 결제와 멤버십 연동을 수행한 프로젝트입니다. 아래 시연 영상과 화면 이미지를 통해 프로젝트의 화면 구성을 확인할 수 있습니다.",
        media: [
          {
            type: "video",
            src: `${mediaBaseUrl}/c9pro/c9pro-ex1.mp4`,
            poster: `${mediaBaseUrl}/c9pro/c9pro-ex5.png`,
            alt: "C9Pro 시연 영상",
          },
          {
            type: "image",
            src: `${mediaBaseUrl}/c9pro/c9pro-ex2.png`,
            alt: "C9Pro 화면 1",
          },
          {
            type: "image",
            src: `${mediaBaseUrl}/c9pro/c9pro-ex3.png`,
            alt: "C9Pro 화면 2",
          },
          {
            type: "image",
            src: `${mediaBaseUrl}/c9pro/c9pro-ex4.png`,
            alt: "C9Pro 화면 3",
          },
        ],
      },
    ],
  },
  "/docs/coin-development": {
    description:
      "메인넷과 블록 탐색기 구축, 코인 전송, Solana SWAP·MEME API, 거래소 연동 등 블록체인 기반 시스템을 개발합니다. 이더메인넷의 Blockscout 구축과 Digifinex 시장조성 로직 등 프로젝트별 수행 범위는 아래 이력에 정리했습니다.",
  },
  "/docs/api-platform": {
    description:
      "판매·주문·차트 API와 업무용 플랫폼, 연말 정산 자동화, 공공기관 시스템 통합 및 테이블 설계를 수행합니다. 서비스 간 데이터 연동과 내부 업무 처리를 위한 API·플랫폼 개발 이력을 소개합니다.",
  },
  "/docs/data-analysis": {
    description:
      "금융·거래 데이터 수집과 오픈 API 연구를 수행합니다. 빗썸 김치프리미엄 거래 데이터 10만 건 수집, 금융결제원 오픈 API 연구, investLog의 이용약관·개인정보 방침 작성 등 관련 수행 이력을 정리했습니다.",
  },
  "/docs/automation-tools": {
    description:
      "상품 자동 업로드와 워터마크 처리, FTP API와 콘솔 도구, 텔레그램 알림 등 반복적인 운영 작업을 위한 도구를 개발합니다. 프로젝트별 자동화 작업과 연동 범위는 아래에서 확인할 수 있습니다.",
  },
};

export const DocumentationPage = () => {
  const { docType } = useParams<{ docType: string }>();
  const service = services.find(({ href }) => href === `/docs/${docType}`);

  if (!service) {
    return (
      <main>
        <section className="max-w-screen-lg mx-auto py-16 text-white space-y-6">
          <h1 className="text-3xl font-bold">페이지를 찾을 수 없습니다.</h1>
          <Link to="/" className="inline-block text-blue-400 hover:underline">
            홈으로 돌아가기
          </Link>
        </section>
      </main>
    );
  }

  const details = serviceDetails[service.href];

  return (
    <main>
      <div className="max-w-screen-lg xl:max-w-screen-xl mx-auto pb-16">
        <nav
          aria-label="페이지 이동"
          className="sticky top-0 z-20 bg-gray-900/95 py-5 backdrop-blur"
        >
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded text-white font-semibold hover:text-blue-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-400"
          >
            <ArrowLeftIcon className="h-5 w-5" aria-hidden="true" />
            홈으로 돌아가기
          </Link>
        </nav>

        <header className="pt-6 pb-10 space-y-4">
          <p className="text-sm font-semibold tracking-widest text-purple-300">
            CEETOOL PROJECTS
          </p>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white">
            {service.title}
          </h1>
          <p className="text-lg text-blue-300 leading-relaxed">
            {service.description}
          </p>
          <p className="max-w-3xl text-gray-300 leading-relaxed">
            {details.description}
          </p>
        </header>

        <section
          aria-labelledby="project-history-heading"
          className="rounded-xl border border-gray-700 bg-gray-800 p-5 sm:p-8"
        >
          <h2
            id="project-history-heading"
            className="text-xl font-bold text-white"
          >
            주요 수행 이력
          </h2>
          <ul className="mt-4 list-disc pl-5 text-gray-300 space-y-3 leading-relaxed">
            {service.projects.map((project) => (
              <li key={project}>{project}</li>
            ))}
          </ul>
        </section>

        <div className="mt-10 space-y-10">
          {details.showcases?.map((project) => (
            <ProjectDetails key={project.title} {...project} />
          ))}
        </div>

        <section className="mt-10 rounded-xl border border-gray-700 p-6 sm:p-8">
          <h2 className="text-xl font-bold text-white">프로젝트 문의</h2>
          <p className="mt-3 text-gray-300 leading-relaxed">
            필요한 기능과 현재 운영 환경을 알려주시면 개발 범위를 함께
            검토하겠습니다.
          </p>
          <a
            href="mailto:john@ceetool.com"
            className="mt-4 inline-block rounded text-blue-400 font-semibold hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-400"
          >
            john@ceetool.com
          </a>
        </section>
      </div>
    </main>
  );
};

export default DocumentationPage;
