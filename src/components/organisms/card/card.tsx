import { forwardRef, type ComponentProps } from "react";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import { portfolioProjects, type PortfolioProjectId } from "app/portfolio";
import type { Service } from "app/services";

export interface CardProps
  extends Omit<ComponentProps<"div">, keyof Service | "className" | "children">,
    Service {
  onProjectSelect: (id: PortfolioProjectId) => void;
}

function ProjectList({
  projects,
  onProjectSelect,
}: Pick<CardProps, "projects" | "onProjectSelect">) {
  return (
    <ul className="space-y-3 text-sm leading-relaxed text-gray-400">
      {projects.map((project) => (
        <li key={project.name} className="min-w-0 break-words">
          {project.portfolioId ? (
            <>
              <button
                type="button"
                aria-label={`${project.name} 포트폴리오 보기`}
                aria-haspopup="dialog"
                onClick={() =>
                  project.portfolioId && onProjectSelect(project.portfolioId)
                }
                className="rounded text-left font-semibold text-blue-300 underline decoration-blue-400/60 underline-offset-4 hover:text-blue-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
              >
                {project.name}
              </button>
              <a
                href={portfolioProjects[project.portfolioId].url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${project.name} 사이트 방문 (새 창)`}
                className="ml-1 inline-flex min-h-8 min-w-8 items-center justify-center rounded align-middle text-blue-300 hover:text-blue-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
              >
                <ArrowTopRightOnSquareIcon
                  className="h-4 w-4"
                  aria-hidden="true"
                />
              </a>
            </>
          ) : (
            <span className="font-medium text-gray-200">{project.name}</span>
          )}
          <span className="mt-1 block">{project.description}</span>
        </li>
      ))}
    </ul>
  );
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      title,
      description,
      Icon,
      features,
      projects,
      featured = false,
      projectLabel = "대표 사례",
      onProjectSelect,
      ...rest
    },
    ref,
  ) => (
    <div
      ref={ref}
      className={`min-w-0 rounded-xl border p-5 text-white sm:p-6 last:sm:col-span-2 ${
        featured
          ? "sm:col-span-2 border-blue-400/50 bg-gradient-to-br from-blue-950 to-gray-800"
          : "border-gray-700 bg-gray-800"
      }`}
      {...rest}
    >
      <div className="flex items-center justify-between gap-4">
        <h2
          className={`${featured ? "text-2xl sm:text-3xl" : "text-xl"} font-bold text-blue-300`}
        >
          {title}
        </h2>
        <Icon
          className="h-8 w-8 shrink-0 text-blue-300/70"
          aria-hidden="true"
        />
      </div>
      <p className="mt-3 text-sm leading-relaxed text-gray-300">
        {description}
      </p>
      <div
        className={`mt-5 grid gap-5 ${featured ? "sm:grid-cols-2 sm:gap-8" : ""}`}
      >
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
        <div
          className={`${featured ? "sm:border-l sm:border-blue-400/20 sm:pl-8" : "border-t border-gray-700 pt-4"}`}
        >
          <h3 className="mb-3 text-xs font-semibold tracking-wide text-gray-400">
            {projectLabel}
          </h3>
          <ProjectList
            projects={projects.slice(0, 2)}
            onProjectSelect={onProjectSelect}
          />
          {projects.length > 2 && (
            <details className="mt-4 border-t border-gray-700 pt-3">
              <summary className="cursor-pointer rounded text-sm text-gray-300 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400">
                다른 수행 사례 ({projects.length - 2})
              </summary>
              <div className="mt-4">
                <ProjectList
                  projects={projects.slice(2)}
                  onProjectSelect={onProjectSelect}
                />
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  ),
);

export default Card;
