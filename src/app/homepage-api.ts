import {
  ShoppingBagIcon,
  CreditCardIcon,
  ChatBubbleLeftRightIcon,
  MegaphoneIcon,
  Cog6ToothIcon,
  ServerStackIcon,
} from "@heroicons/react/24/outline";
import type { Service, ServiceProject } from "app/services";
import type { ProjectDetailsProps } from "components/organisms/project-details/project-details";
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
  id: string;
  type: "image" | "video";
  src: string;
  alt: string;
  poster?: string;
}
export interface HomepageProject {
  id: string;
  name: string;
  description: string;
  details: string;
  url?: string;
  archive: boolean;
  media: HomepageMedia[];
}
export interface HomepageSlide {
  label: string;
  projectId: string;
  mediaId?: string;
}
export interface HomepageCategory {
  id: string;
  title: string;
  tagline: string;
  description: string;
  icon: HomepageIcon;
  visible: boolean;
  featured: boolean;
  features: string[];
  slides: [HomepageSlide, HomepageSlide];
}
export interface HomepageDocument {
  id: string;
  title: string;
  description: string;
  details: string;
  projectIds: string[];
}
export interface HomepageContent {
  categories: HomepageCategory[];
  projects: HomepageProject[];
  documents: HomepageDocument[];
}
interface HomepageSnapshot {
  revision: string;
  content: HomepageContent;
}
const iconComponents = {
  shopping: ShoppingBagIcon,
  payment: CreditCardIcon,
  ai: ChatBubbleLeftRightIcon,
  marketing: MegaphoneIcon,
  automation: Cog6ToothIcon,
  finance: ServerStackIcon,
};
export function projectCaption(project: HomepageProject): ServiceProject {
  return {
    name: project.name,
    description: project.description,
    ...(project.url ? { url: project.url } : {}),
    ...(project.media.length ? { portfolioId: project.id } : {}),
  };
}
export function projectDetails(
  project: HomepageProject,
): ProjectDetailsProps | null {
  const media = project.media.map(
    (item): ProjectDetailsProps["media"][number] =>
      item.type === "video"
        ? { ...item, type: "video", poster: item.poster ?? "" }
        : { ...item, type: "image" },
  );
  const first = media[0];
  if (!first) return null;
  return {
    title: project.name,
    description: project.details,
    url: project.url,
    media: [first, ...media.slice(1)],
  };
}
export function categoryService(
  category: HomepageCategory,
  content: HomepageContent,
): Service {
  const slide = (item: HomepageSlide): Service["showcase"][number] => {
    const project = content.projects.find(
      (project) => project.id === item.projectId,
    );
    if (!project) throw new Error("Missing homepage project");
    const media = project.media.find((media) => media.id === item.mediaId);
    return {
      label: item.label,
      project: projectCaption(project),
      ...(media
        ? {
            media:
              media.type === "video"
                ? { ...media, type: "video", poster: media.poster ?? "" }
                : { ...media, type: "image" },
          }
        : {}),
    };
  };
  return {
    title: category.title,
    tagline: category.tagline,
    description: category.description,
    Icon: iconComponents[category.icon],
    featured: category.featured,
    features: category.features,
    showcase: [slide(category.slides[0]), slide(category.slides[1])],
  };
}
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
function isMedia(value: unknown): value is Omit<HomepageMedia, "id"> {
  return (
    record(value) &&
    (value.type === "image" || value.type === "video") &&
    typeof value.src === "string" &&
    typeof value.alt === "string" &&
    (value.poster === undefined || typeof value.poster === "string")
  );
}
function isProject(value: unknown): value is HomepageProject {
  return (
    record(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.description === "string" &&
    typeof value.details === "string" &&
    typeof value.archive === "boolean" &&
    (value.url === undefined || typeof value.url === "string") &&
    Array.isArray(value.media) &&
    value.media.every(
      (media) =>
        record(media) && typeof media.id === "string" && isMedia(media),
    )
  );
}
function isSlide(value: unknown): value is HomepageSlide {
  return (
    record(value) &&
    typeof value.label === "string" &&
    typeof value.projectId === "string" &&
    (value.mediaId === undefined || typeof value.mediaId === "string")
  );
}
function isCategory(value: unknown): value is HomepageCategory {
  return (
    record(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.tagline === "string" &&
    typeof value.description === "string" &&
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
function isDocument(value: unknown): value is HomepageDocument {
  return (
    record(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.description === "string" &&
    typeof value.details === "string" &&
    Array.isArray(value.projectIds) &&
    value.projectIds.every((id) => typeof id === "string")
  );
}
function isContent(value: unknown): value is HomepageContent {
  if (
    !record(value) ||
    !Array.isArray(value.categories) ||
    !value.categories.every(isCategory) ||
    !Array.isArray(value.projects) ||
    !value.projects.every(isProject) ||
    !Array.isArray(value.documents) ||
    !value.documents.every(isDocument)
  )
    return false;
  const projects = value.projects;
  return (
    value.categories.every((category) =>
      category.slides.every((slide) => {
        const project = projects.find(
          (project) => project.id === slide.projectId,
        );
        return (
          project &&
          (!slide.mediaId ||
            project.media.some((media) => media.id === slide.mediaId))
        );
      }),
    ) &&
    value.documents.every((document) =>
      document.projectIds.every((id) =>
        projects.some((project) => project.id === id),
      ),
    )
  );
}
function snapshot(value: unknown): HomepageSnapshot {
  if (
    !record(value) ||
    typeof value.revision !== "string" ||
    !isContent(value.content)
  ) {
    console.error("Invalid homepage API response");
    throw new Error("홈페이지 설정 응답을 확인할 수 없습니다.");
  }
  return { revision: value.revision, content: value.content };
}
export const homepageApi = {
  async load(admin = false): Promise<HomepageSnapshot> {
    return snapshot(await request(admin ? "/admin/homepage" : "/homepage"));
  },
  async save(
    content: HomepageContent,
    revision: string,
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
  async upload(file: File, csrf: string): Promise<Omit<HomepageMedia, "id">> {
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
