import type { CodeBracketIcon } from "@heroicons/react/24/outline";
import type { ProjectDetailsProps } from "components/organisms/project-details/project-details";

export interface ServiceProject {
  name: string;
  description: string;
  portfolioId?: string;
  url?: string;
}
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
  Icon: typeof CodeBracketIcon;
  features: readonly string[];
  featured?: boolean;
}
