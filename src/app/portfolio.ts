import type { ProjectDetailsProps } from "components/organisms/project-details/project-details";

const mediaBaseUrl = "https://d2fgd6q9oovwa9.cloudfront.net/projects";

export const portfolioProjects = {
  dswar: {
    title: "DSWAR Market",
    url: "https://dswstore.io/",
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
  shini: {
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
  c9pro: {
    title: "C9Pro",
    url: "https://c9-pro.com/",
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
} satisfies Record<string, ProjectDetailsProps>;

export type PortfolioProjectId = keyof typeof portfolioProjects;
