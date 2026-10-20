import type { ProjectDetailsProps } from "components/organisms/project-details/project-details";

const mediaBaseUrl = "https://d2fgd6q9oovwa9.cloudfront.net/projects";

export const portfolioProjects = {
  dswar: {
    title: "DSWAR Market",
    url: "https://dswstore.io/",
    description: "USDT·럭키박스 토큰으로 게임 아이템을 구매하는 쇼핑몰.",
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
    description: "청소 서비스 예약·결제 및 예약 관리.",
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
    description: "카드·USDT·PayPal 결제와 멤버십 연동.",
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
