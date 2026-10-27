import { services, type Service, type ServiceProject } from "app/services";
import { portfolioProjects } from "app/portfolio";
import { request } from "app/payments-api";

export const homepageIcons = [
  "shopping",
  "payment",
  "ai",
  "marketing",
  "automation",
  "finance",
] as const;
export type HomepageIcon = (typeof homepageIcons)[number];
export interface HomepageMedia {
  type: "image" | "video";
  src: string;
  alt: string;
  poster?: string;
}
export interface HomepageSlide {
  label: string;
  project: ServiceProject;
  media?: HomepageMedia;
}
export interface HomepageCategory {
  id: string;
  title: string;
  tagline: string;
  icon: HomepageIcon;
  visible: boolean;
  featured: boolean;
  features: string[];
  slides: [HomepageSlide, HomepageSlide];
}
export interface HomepageContent {
  categories: HomepageCategory[];
}
interface HomepageSnapshot {
  revision: string | null;
  content: HomepageContent | null;
}

const iconComponents: Record<HomepageIcon, Service["Icon"]> = {
  shopping: services[0].Icon,
  payment: services[1].Icon,
  ai: services[2].Icon,
  marketing: services[3].Icon,
  automation: services[4].Icon,
  finance: services[5].Icon,
};
export const defaultHomepageContent: HomepageContent = {
  categories: services.map((service, index) => {
    const slide = (item: Service["showcase"][number]): HomepageSlide => ({
      ...item,
      project: {
        ...item.project,
        ...(item.project.portfolioId
          ? { url: portfolioProjects[item.project.portfolioId].url }
          : {}),
      },
    });
    return {
      id: homepageIcons[index],
      icon: homepageIcons[index],
      title: service.title,
      tagline: service.tagline,
      visible: true,
      featured: service.featured ?? false,
      features: [...service.features],
      slides: [slide(service.showcase[0]), slide(service.showcase[1])],
    };
  }),
};
export function categoryService(category: HomepageCategory): Service {
  const slide = (item: HomepageSlide): Service["showcase"][number] => ({
    label: item.label,
    project: item.project,
    ...(item.media
      ? {
          media:
            item.media.type === "video"
              ? {
                  ...item.media,
                  type: "video",
                  poster: item.media.poster ?? "",
                }
              : { ...item.media, type: "image" },
        }
      : {}),
  });
  return {
    title: category.title,
    tagline: category.tagline,
    description: category.tagline,
    Icon: iconComponents[category.icon],
    featured: category.featured,
    features: category.features,
    projects: category.slides.map((item) => item.project),
    showcase: [slide(category.slides[0]), slide(category.slides[1])],
  };
}
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
function isMedia(value: unknown): value is HomepageMedia {
  return (
    record(value) &&
    (value.type === "image" || value.type === "video") &&
    typeof value.src === "string" &&
    typeof value.alt === "string" &&
    (value.poster === undefined || typeof value.poster === "string")
  );
}
function isSlide(value: unknown): value is HomepageSlide {
  return (
    record(value) &&
    typeof value.label === "string" &&
    record(value.project) &&
    typeof value.project.name === "string" &&
    typeof value.project.description === "string" &&
    (value.project.url === undefined ||
      typeof value.project.url === "string") &&
    (value.project.portfolioId === undefined ||
      value.project.portfolioId === "dswar" ||
      value.project.portfolioId === "shini" ||
      value.project.portfolioId === "c9pro") &&
    (value.media === undefined || isMedia(value.media))
  );
}
function isCategory(value: unknown): value is HomepageCategory {
  return (
    record(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.tagline === "string" &&
    homepageIcons.some((icon) => icon === value.icon) &&
    typeof value.visible === "boolean" &&
    typeof value.featured === "boolean" &&
    Array.isArray(value.features) &&
    value.features.every((feature) => typeof feature === "string") &&
    Array.isArray(value.slides) &&
    value.slides.length === 2 &&
    value.slides.every(isSlide)
  );
}
function isContent(value: unknown): value is HomepageContent {
  return (
    record(value) &&
    Array.isArray(value.categories) &&
    value.categories.every(isCategory)
  );
}
function snapshot(value: unknown): HomepageSnapshot {
  if (
    !record(value) ||
    (value.revision !== null && typeof value.revision !== "string") ||
    (value.content !== null && !isContent(value.content))
  ) {
    console.error("Invalid homepage API response");
    throw new Error("홈페이지 설정 응답을 확인할 수 없습니다.");
  }
  return {
    revision: value.revision,
    content: value.content,
  };
}
export const homepageApi = {
  async load(admin = false): Promise<HomepageSnapshot> {
    return snapshot(await request(admin ? "/admin/homepage" : "/homepage"));
  },
  async save(
    content: HomepageContent,
    revision: string | null,
    csrf: string,
  ): Promise<HomepageSnapshot> {
    return snapshot(
      await request("/admin/homepage", {
        method: "PUT",
        headers: { "X-CSRF-Token": csrf },
        body: JSON.stringify({ content, revision }),
      }),
    );
  },
  async upload(file: File, csrf: string): Promise<HomepageMedia> {
    const body = new FormData();
    body.append("file", file);
    const value = await request("/admin/homepage/media", {
      method: "POST",
      headers: { "X-CSRF-Token": csrf },
      body,
      signal: AbortSignal.timeout(180000),
    });
    if (!record(value) || !isMedia(value.media)) {
      console.error("Invalid homepage upload response");
      throw new Error("업로드 결과를 확인할 수 없습니다.");
    }
    return value.media;
  },
};
