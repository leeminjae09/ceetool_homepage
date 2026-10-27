import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import { portfolioProjects, type PortfolioProjectId } from "app/portfolio";
import type { Service, ServiceProject } from "app/services";

export type CardProps = Pick<Service, "title" | "features">;

export function ProjectCaption({
  project,
  onProjectSelect,
}: {
  project: ServiceProject;
  onProjectSelect: (id: PortfolioProjectId) => void;
}) {
  return (
    <div className="inline-flex min-h-8 items-center gap-2 whitespace-nowrap text-xs leading-relaxed text-gray-400">
      {project.portfolioId ? (
        <>
          <button
            type="button"
            aria-label={`${project.name} 포트폴리오 보기`}
            aria-haspopup="dialog"
            onClick={() =>
              project.portfolioId && onProjectSelect(project.portfolioId)
            }
            className="min-h-8 rounded text-left font-semibold text-blue-300 underline decoration-blue-400/60 underline-offset-4 hover:text-blue-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
          >
            {project.name}
          </button>
          <a
            href={project.url || portfolioProjects[project.portfolioId].url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${project.name} 사이트 방문 (새 창)`}
            className="inline-flex min-h-8 items-center justify-center rounded text-blue-300 hover:text-blue-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
          >
            <ArrowTopRightOnSquareIcon className="h-4 w-4" aria-hidden="true" />
          </a>
        </>
      ) : project.url ? (
        <a
          href={project.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${project.name} 사이트 방문 (새 창)`}
          className="inline-flex min-h-8 items-center gap-1 font-semibold text-blue-300 underline underline-offset-4 hover:text-blue-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400"
        >
          {project.name}
          <ArrowTopRightOnSquareIcon className="h-4 w-4" aria-hidden="true" />
        </a>
      ) : (
        <span className="font-medium text-gray-200">{project.name}</span>
      )}
      <span>{project.description}</span>
    </div>
  );
}

function Card({ title, features }: CardProps) {
  return (
    <ul
      aria-label={`${title} 제공 기능`}
      className="space-y-2 text-sm leading-relaxed text-gray-200"
    >
      {features.map((feature) => (
        <li key={feature} className="flex gap-2">
          <span aria-hidden="true" className="text-blue-400">
            ·
          </span>
          {feature}
        </li>
      ))}
    </ul>
  );
}

export default Card;
